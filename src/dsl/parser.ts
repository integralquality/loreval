import type { Level, Tile, TileType, Entity, Direction, Rule, TileMeta } from '../types';
import type { ParseResult, ParseError, LegendEntry, RawEntity } from './types';
import {
  BUILTIN_CHARS,
  TILE_TYPE_SET,
  ENTITY_TYPE_SET,
  RULE_TYPE_SET,
  DIRECTION_SET,
  ARROW_DIRECTIONS,
} from './registry';

// ── Regex patterns ──────────────────────────────────────────

const HEADER_RE = /^level\s+"([^"]+)"\s+(\d+)x(\d+)$/;
const GRID_START_RE = /^grid:\s*$/;
const TILE_ROW_RE = /^\s+(\S(?:\s+\S)*)\s*$/;
const LET_RE = /^let\s+([^\s])\s*=\s*(.+)$/;
const AGENT_RE = /^agent\s+(player|dog|cat|rabbit|robot)\s+(\S+)\s+start\((\d+),(\d+)\)(?:\s+->\s+reach\((\d+),(\d+)\))?(?:\s+\[([^\]]+)\])?$/;
const COMMENT_RE = /^\s*#/;
const BLANK_RE = /^\s*$/;

// ── Header parsing ──────────────────────────────────────────

function parseHeader(
  line: string,
  lineNum: number
): { name: string; width: number; height: number } | ParseError {
  const m = HEADER_RE.exec(line);
  if (!m) {
    return { line: lineNum, message: `Expected: level "name" WxH` };
  }
  return { name: m[1], width: parseInt(m[2], 10), height: parseInt(m[3], 10) };
}

// ── Let parsing ─────────────────────────────────────────────

function parseTileSpec(
  spec: string,
  lineNum: number
): { tileType: string; color?: string; meta?: Record<string, string> } | ParseError {
  // spec format: "type:color:key=val,key=val"
  const parts = spec.split(':');
  const tileType = parts[0].trim();

  if (!TILE_TYPE_SET.has(tileType as TileType)) {
    return { line: lineNum, message: `Unknown tile type "${tileType}"` };
  }

  let color: string | undefined;
  let meta: Record<string, string> | undefined;

  for (let i = 1; i < parts.length; i++) {
    const part = parts[i].trim();
    if (part.includes('=')) {
      // This is a meta section: "key=val,key=val"
      meta = meta || {};
      for (const pair of part.split(',')) {
        const [k, v] = pair.split('=').map(s => s.trim());
        if (k && v) meta[k] = v;
      }
    } else if (part) {
      color = part;
    }
  }

  return { tileType, color, meta };
}

function parseLetLine(
  line: string,
  lineNum: number
): LegendEntry | ParseError {
  const m = LET_RE.exec(line);
  if (!m) {
    return { line: lineNum, message: `Invalid let format. Expected: let C = type:color` };
  }

  const char = m[1];
  const spec = m[2].trim();
  const result = parseTileSpec(spec, lineNum);

  if ('message' in result) return result;

  return {
    char,
    tileType: result.tileType,
    color: result.color,
    meta: result.meta,
  };
}

// ── Agent parsing ───────────────────────────────────────────

function parseRuleList(
  text: string,
  lineNum: number
): Array<{ type: string; value?: number }> | ParseError {
  const rules: Array<{ type: string; value?: number }> = [];

  for (const token of text.split(',')) {
    const trimmed = token.trim();
    if (!trimmed) continue;

    const colonIdx = trimmed.indexOf(':');
    if (colonIdx === -1) {
      if (!RULE_TYPE_SET.has(trimmed as any)) {
        return { line: lineNum, message: `Unknown rule type "${trimmed}"` };
      }
      rules.push({ type: trimmed });
    } else {
      const ruleType = trimmed.slice(0, colonIdx).trim();
      const ruleValue = parseInt(trimmed.slice(colonIdx + 1).trim(), 10);
      if (!RULE_TYPE_SET.has(ruleType as any)) {
        return { line: lineNum, message: `Unknown rule type "${ruleType}"` };
      }
      if (isNaN(ruleValue)) {
        return { line: lineNum, message: `Invalid rule value in "${trimmed}"` };
      }
      rules.push({ type: ruleType, value: ruleValue });
    }
  }

  return rules;
}

function parseAgentLine(
  line: string,
  lineNum: number
): RawEntity | ParseError {
  const m = AGENT_RE.exec(line);
  if (!m) {
    return { line: lineNum, message: `Invalid agent format. Expected: agent type color start(x,y) -> reach(x,y)` };
  }

  const entityType = m[1];
  const color = m[2];
  const x = parseInt(m[3], 10);
  const y = parseInt(m[4], 10);
  const reachX = m[5] !== undefined ? parseInt(m[5], 10) : undefined;
  const reachY = m[6] !== undefined ? parseInt(m[6], 10) : undefined;
  const rulesText = m[7] || undefined;

  if (!ENTITY_TYPE_SET.has(entityType as any)) {
    return { line: lineNum, message: `Unknown agent type "${entityType}"` };
  }

  let rules: Array<{ type: string; value?: number }> = [];
  if (rulesText) {
    const parsed = parseRuleList(rulesText, lineNum);
    if ('message' in parsed) return parsed;
    rules = parsed;
  }

  return { line: lineNum, entityType, color, x, y, reachX, reachY, rules };
}

// ── Level resolution ────────────────────────────────────────

function resolveLevel(
  name: string,
  width: number,
  height: number,
  charGrid: string[][],
  legend: Map<string, LegendEntry>,
  rawEntities: RawEntity[],
  errors: ParseError[],
  warnings: ParseError[]
): Level | null {
  // Build full charMap: builtins + user legend
  const charMap = new Map<string, { type: TileType; color?: string; meta?: TileMeta }>();

  for (const [ch, def] of Object.entries(BUILTIN_CHARS)) {
    charMap.set(ch, { type: def.type });
  }

  for (const [ch, entry] of legend) {
    const meta: TileMeta | undefined = entry.meta
      ? {
          ...(entry.meta.id && { id: entry.meta.id }),
          ...(entry.meta.direction && DIRECTION_SET.has(entry.meta.direction as Direction)
            ? { direction: entry.meta.direction as Direction }
            : {}),
        }
      : undefined;

    charMap.set(ch, {
      type: entry.tileType as TileType,
      color: entry.color,
      meta: meta && Object.keys(meta).length > 0 ? meta : undefined,
    });
  }

  // Also register arrow chars as one-way tiles
  for (const [arrow, dir] of Object.entries(ARROW_DIRECTIONS)) {
    if (!charMap.has(arrow)) {
      charMap.set(arrow, { type: 'one-way', meta: { direction: dir } });
    }
  }

  // Validate grid dimensions
  if (charGrid.length !== height) {
    errors.push({
      line: 0,
      message: `Expected ${height} grid rows, got ${charGrid.length}`,
    });
  }

  // Build tiles
  const tiles: Tile[][] = [];
  for (let y = 0; y < charGrid.length; y++) {
    const row = charGrid[y];
    if (row.length !== width) {
      errors.push({
        line: 0,
        message: `Grid row ${y + 1} has ${row.length} tokens, expected ${width}`,
      });
    }

    const tileRow: Tile[] = [];
    for (let x = 0; x < row.length; x++) {
      const ch = row[x];
      const def = charMap.get(ch);
      if (!def) {
        errors.push({
          line: 0,
          message: `Unknown character '${ch}' in grid at (${x}, ${y})`,
        });
        tileRow.push({ x, y, type: 'empty' });
      } else {
        tileRow.push({
          x,
          y,
          type: def.type,
          ...(def.color && { color: def.color }),
          ...(def.meta && { meta: def.meta }),
        });
      }
    }
    tiles.push(tileRow);
  }

  if (errors.length > 0) return null;

  // Resolve agents
  const entityCounts: Record<string, number> = {};
  const entities: Entity[] = [];

  for (const raw of rawEntities) {
    // Validate start position
    if (raw.x < 0 || raw.x >= width || raw.y < 0 || raw.y >= height) {
      errors.push({
        line: raw.line,
        message: `Agent start(${raw.x},${raw.y}) is outside grid bounds (${width}x${height})`,
      });
      continue;
    }

    // Validate reach position
    if (raw.reachX !== undefined && raw.reachY !== undefined) {
      if (raw.reachX < 0 || raw.reachX >= width || raw.reachY < 0 || raw.reachY >= height) {
        errors.push({
          line: raw.line,
          message: `Agent reach(${raw.reachX},${raw.reachY}) is outside grid bounds (${width}x${height})`,
        });
        continue;
      }
    }

    // Generate deterministic ID
    entityCounts[raw.entityType] = (entityCounts[raw.entityType] || 0) + 1;
    const entityId = `${raw.entityType}-${entityCounts[raw.entityType]}`;

    // Resolve reach target → goal tile
    let goalTargetId: string | undefined;
    if (raw.reachX !== undefined && raw.reachY !== undefined) {
      const targetTile = tiles[raw.reachY]?.[raw.reachX];
      if (!targetTile) {
        errors.push({
          line: raw.line,
          message: `No tile at reach(${raw.reachX},${raw.reachY})`,
        });
      } else if (targetTile.type !== 'goal') {
        warnings.push({
          line: raw.line,
          message: `Tile at reach(${raw.reachX},${raw.reachY}) is "${targetTile.type}", not a goal`,
        });
        // Still create the reach-goal rule — the position is the intent
        goalTargetId = targetTile.meta?.id || `goal-${raw.reachX}-${raw.reachY}`;
      } else {
        goalTargetId = targetTile.meta?.id || `goal-${raw.reachX}-${raw.reachY}`;
        // Ensure the goal tile has this ID in its meta
        if (!targetTile.meta?.id) {
          tiles[raw.reachY][raw.reachX] = {
            ...targetTile,
            meta: { ...targetTile.meta, id: goalTargetId },
          };
        }
      }
    }

    // Build rules
    const rules: Rule[] = [];
    let ruleIdx = 0;

    // If there's a reach target, add reach-goal if not already in rules
    if (goalTargetId && !raw.rules.some(r => r.type === 'reach-goal')) {
      ruleIdx++;
      rules.push({
        id: `${entityId}-r${ruleIdx}`,
        type: 'reach-goal',
        targetId: goalTargetId,
      });
    }

    for (const rawRule of raw.rules) {
      ruleIdx++;
      const rule: Rule = {
        id: `${entityId}-r${ruleIdx}`,
        type: rawRule.type as any,
      };
      if (rawRule.type === 'reach-goal' && goalTargetId) {
        rule.targetId = goalTargetId;
      }
      if (rawRule.value !== undefined) {
        rule.value = rawRule.value;
      }
      rules.push(rule);
    }

    entities.push({
      id: entityId,
      type: raw.entityType as any,
      position: { x: raw.x, y: raw.y },
      color: raw.color === 'none' ? undefined : raw.color,
      rules,
    });
  }

  if (errors.length > 0) return null;

  return {
    id: name.toLowerCase().replace(/\s+/g, '-'),
    name,
    width,
    height,
    tiles,
    entities,
  };
}

// ── Main parser ─────────────────────────────────────────────

export function parseDSL(source: string): ParseResult {
  const errors: ParseError[] = [];
  const warnings: ParseError[] = [];

  // Normalize line endings
  const lines = source.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');

  let headerResult: { name: string; width: number; height: number } | null = null;
  const charGrid: string[][] = [];
  const legend = new Map<string, LegendEntry>();
  const rawEntities: RawEntity[] = [];

  type Phase = 'header' | 'grid' | 'body';
  let phase: Phase = 'header';
  let gridRowStart = 0;

  for (let i = 0; i < lines.length; i++) {
    const lineNum = i + 1;
    const line = lines[i];

    // Skip comments and blanks (except in grid phase where blank ends the block)
    if (COMMENT_RE.test(line)) continue;
    if (BLANK_RE.test(line)) {
      if (phase === 'grid' && charGrid.length > 0) {
        phase = 'body';
      }
      continue;
    }

    switch (phase) {
      case 'header': {
        if (GRID_START_RE.test(line)) {
          if (!headerResult) {
            errors.push({ line: lineNum, message: 'Missing header before "grid:"' });
          }
          phase = 'grid';
          gridRowStart = lineNum;
          break;
        }

        const result = parseHeader(line, lineNum);
        if ('message' in result) {
          errors.push(result);
        } else {
          headerResult = result;
        }
        break;
      }

      case 'grid': {
        const rowMatch = TILE_ROW_RE.exec(line);
        if (rowMatch) {
          const tokens = rowMatch[1].split(/\s+/);
          charGrid.push(tokens);
        } else {
          // Non-indented line ends grid block
          phase = 'body';
          // Fall through to body processing
          i--;
        }
        break;
      }

      case 'body': {
        // Try let declaration
        if (LET_RE.test(line)) {
          const result = parseLetLine(line, lineNum);
          if ('message' in result) {
            errors.push(result);
          } else {
            if (BUILTIN_CHARS[result.char]) {
              errors.push({
                line: lineNum,
                message: `Character '${result.char}' is a built-in and cannot be redefined`,
              });
            } else if (legend.has(result.char)) {
              errors.push({
                line: lineNum,
                message: `Character '${result.char}' is already defined`,
              });
            } else {
              legend.set(result.char, result);
            }
          }
          break;
        }

        // Try agent
        if (AGENT_RE.test(line)) {
          const result = parseAgentLine(line, lineNum);
          if ('message' in result) {
            errors.push(result);
          } else {
            rawEntities.push(result);
          }
          break;
        }

        // Unknown line
        errors.push({
          line: lineNum,
          message: `Unexpected: "${line.trim()}"`,
        });
        break;
      }
    }
  }

  if (!headerResult) {
    errors.push({ line: 1, message: 'Missing level header' });
    return { level: null, errors, warnings };
  }

  if (charGrid.length === 0) {
    errors.push({ line: gridRowStart || 1, message: 'No grid rows found' });
    return { level: null, errors, warnings };
  }

  const level = resolveLevel(
    headerResult.name,
    headerResult.width,
    headerResult.height,
    charGrid,
    legend,
    rawEntities,
    errors,
    warnings
  );

  return { level, errors, warnings };
}
