import type { Level, Tile, TileType, Entity, Direction } from '../types';
import { BUILTIN_CHARS, DIRECTION_ARROWS } from './registry';

// ── Tile signature ──────────────────────────────────────────

/** Canonical string key for a tile's type+color+meta combination */
function tileSignature(tile: Tile): string | null {
  // Builtins: no color, no meta
  for (const [, def] of Object.entries(BUILTIN_CHARS)) {
    if (tile.type === def.type && !tile.color && !tile.meta) return null;
  }
  let sig = tile.type as string;
  if (tile.color) sig += ':' + tile.color;
  if (tile.meta) {
    const parts: string[] = [];
    if (tile.meta.id) parts.push('id=' + tile.meta.id);
    if (tile.meta.direction) parts.push('direction=' + tile.meta.direction);
    if (parts.length > 0) sig += ':' + parts.sort().join(',');
  }
  return sig;
}

/** Check if a tile is a one-way with only a direction (can use arrow shorthand) */
function isArrowTile(tile: Tile): Direction | null {
  if (tile.type === 'one-way' && tile.meta?.direction && !tile.color && !tile.meta.id) {
    return tile.meta.direction;
  }
  return null;
}

// ── Character assignment ────────────────────────────────────

/** Pick a unique single char for each non-builtin tile signature */
function assignLegendChars(
  signatures: Map<string, { type: TileType; color?: string; meta?: Record<string, string> }>
): Map<string, string> {
  const used = new Set(Object.keys(BUILTIN_CHARS));
  // Also reserve arrow chars
  for (const arrow of Object.values(DIRECTION_ARROWS)) {
    used.add(arrow);
  }

  const assignments = new Map<string, string>();
  const candidates = 'ABCDEFGHIJKLMNOPQSTUVXYZ123456789'; // skip R, W (builtins)

  for (const [sig, info] of signatures) {
    // Try first letter of type (uppercase)
    let candidate = info.type[0].toUpperCase();
    if (info.type === 'floor-white' || info.type === 'floor') candidate = 'F';

    if (!used.has(candidate)) {
      used.add(candidate);
      assignments.set(sig, candidate);
      continue;
    }

    // Try first letter of color
    if (info.color) {
      candidate = info.color[0].toUpperCase();
      if (!used.has(candidate)) {
        used.add(candidate);
        assignments.set(sig, candidate);
        continue;
      }
    }

    // Fallback: sequential from candidates
    let found = false;
    for (const ch of candidates) {
      if (!used.has(ch)) {
        used.add(ch);
        assignments.set(sig, ch);
        found = true;
        break;
      }
    }

    if (!found) {
      // Extremely unlikely — more than 35 unique tile signatures
      assignments.set(sig, '?');
    }
  }

  return assignments;
}

// ── Serializer ──────────────────────────────────────────────

export function serializeDSL(level: Level): string {
  const lines: string[] = [];

  // Header
  const escapedName = level.name.replace(/"/g, '\\"');
  lines.push(`level "${escapedName}" ${level.width}x${level.height}`);
  lines.push('');

  // Collect unique non-builtin tile signatures
  const sigToInfo = new Map<string, { type: TileType; color?: string; meta?: Record<string, string> }>();

  for (let y = 0; y < level.height; y++) {
    for (let x = 0; x < level.width; x++) {
      const tile = level.tiles[y]?.[x];
      if (!tile) continue;
      if (isArrowTile(tile)) continue; // arrows use shorthand, no legend needed
      const sig = tileSignature(tile);
      if (sig && !sigToInfo.has(sig)) {
        const meta: Record<string, string> = {};
        if (tile.meta?.id) meta.id = tile.meta.id;
        if (tile.meta?.direction) meta.direction = tile.meta.direction;
        sigToInfo.set(sig, {
          type: tile.type,
          color: tile.color,
          meta: Object.keys(meta).length > 0 ? meta : undefined,
        });
      }
    }
  }

  // Assign chars
  const sigToChar = assignLegendChars(sigToInfo);

  // Build reverse lookup: for each tile, what char to emit
  const builtinReverse = new Map<TileType, string>();
  for (const [ch, def] of Object.entries(BUILTIN_CHARS)) {
    builtinReverse.set(def.type, ch);
  }

  function tileToChar(tile: Tile): string {
    // Check arrow shorthand first
    const arrowDir = isArrowTile(tile);
    if (arrowDir) return DIRECTION_ARROWS[arrowDir];

    // Check builtin (no color, no meta)
    if (!tile.color && !tile.meta) {
      const builtin = builtinReverse.get(tile.type);
      if (builtin) return builtin;
    }

    // Look up in legend
    const sig = tileSignature(tile);
    if (sig) {
      const ch = sigToChar.get(sig);
      if (ch) return ch;
    }

    // Fallback
    return builtinReverse.get(tile.type) || '.';
  }

  // Grid block
  lines.push('grid:');
  for (let y = 0; y < level.height; y++) {
    const row: string[] = [];
    for (let x = 0; x < level.width; x++) {
      const tile = level.tiles[y]?.[x];
      row.push(tile ? tileToChar(tile) : '.');
    }
    lines.push('  ' + row.join(' '));
  }

  // Let declarations
  const legendEntries = Array.from(sigToChar.entries())
    .map(([sig, ch]) => ({ sig, ch, info: sigToInfo.get(sig)! }))
    .sort((a, b) => a.ch.localeCompare(b.ch));

  if (legendEntries.length > 0) {
    lines.push('');
    for (const { ch, info } of legendEntries) {
      let spec = info.type as string;
      if (info.color) spec += ':' + info.color;
      if (info.meta && Object.keys(info.meta).length > 0) {
        const metaParts = Object.entries(info.meta)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([k, v]) => `${k}=${v}`);
        spec += ':' + metaParts.join(',');
      }
      lines.push(`let ${ch} = ${spec}`);
    }
  }

  // Agent section
  if (level.entities.length > 0) {
    lines.push('');
    for (const entity of level.entities) {
      let line = `agent ${entity.type} ${entity.color || 'none'} start(${entity.position.x},${entity.position.y})`;

      // Find reach target position from reach-goal rule
      const reachGoal = entity.rules.find(r => r.type === 'reach-goal');
      if (reachGoal?.targetId) {
        const pos = findGoalPosition(reachGoal.targetId, level);
        if (pos) {
          line += ` and reach(${pos.x},${pos.y})`;
        }
      }

      // Extra rules (skip reach-goal since it's expressed via "and reach()")
      const extraRules = entity.rules.filter(r => r.type !== 'reach-goal');
      const ruleStrs: string[] = [];
      for (const rule of extraRules) {
        if (rule.value !== undefined) {
          ruleStrs.push(`${rule.type}:${rule.value}`);
        } else {
          ruleStrs.push(rule.type);
        }
      }
      if (ruleStrs.length > 0) {
        line += ` [${ruleStrs.join(', ')}]`;
      }

      lines.push(line);
    }
  }

  lines.push('');
  return lines.join('\n');
}

/** Find the grid position of a goal tile by its meta ID */
function findGoalPosition(
  goalId: string,
  level: Level
): { x: number; y: number } | null {
  for (let y = 0; y < level.height; y++) {
    for (let x = 0; x < level.width; x++) {
      const tile = level.tiles[y]?.[x];
      if (tile?.type === 'goal' && tile.meta?.id === goalId) {
        return { x, y };
      }
    }
  }
  return null;
}
