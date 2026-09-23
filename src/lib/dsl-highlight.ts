/**
 * Syntax highlighting for the puzzle DSL.
 *
 * Extracted from the designer's code editor so the eval page's "paste DSL"
 * field can use the same colours: one grammar, highlighted one way, wherever
 * the DSL is shown.
 *
 * Emits an HTML string rather than React nodes because it is rendered into a
 * `<pre>` sitting behind a transparent textarea, and the two have to lay out
 * identically character for character. Every interpolated value goes through
 * `span()`, which escapes it.
 */

const KEYWORD_COLOR = '#93c5fd';   // blue-300 — matches DSL keyword color on landing/docs
const STRING_COLOR = '#86efac';    // green-300
const NUMBER_COLOR = '#fdba74';    // orange-300
const TYPE_COLOR = '#67e8f9';      // cyan-300
const COMMENT_COLOR = '#71717a';   // zinc-500
const OPERATOR_COLOR = '#a1a1aa';  // zinc-400
const GRID_WALL = '#f87171';       // red-400
const GRID_ROAD = '#a1a1aa';       // zinc-400
const GRID_EMPTY = '#52525b';      // zinc-600
const ARROW_COLOR = '#fbbf24';     // amber-400
const DEFAULT_COLOR = '#e4e4e7';   // zinc-200

const TILE_TYPES = new Set([
  'wall', 'floor', 'floor-white', 'empty', 'goal', 'door',
  'switch', 'paint', 'one-way', 'lock', 'start',
]);
// No agent types needed — syntax is now: agent color start(x,y)
const COLOR_MAP: Record<string, string> = {
  orange: '#fb923c', purple: '#c084fc', pink: '#f472b6',
  blue: '#60a5fa', green: '#6ee7b7', red: '#f87171',
  none: '#71717a',
};

function span(text: string, color: string): string {
  const escaped = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return `<span style="color:${color}">${escaped}</span>`;
}

function highlightLine(line: string): string {
  if (/^\s*$/.test(line)) return '\n';
  if (/^\s*#/.test(line)) return span(line, COMMENT_COLOR) + '\n';

  const headerMatch = /^(level)\s+("(?:[^"\\]|\\.)*")\s+(\d+x\d+)$/.exec(line);
  if (headerMatch) {
    return span(headerMatch[1], KEYWORD_COLOR) + ' '
      + span(headerMatch[2], STRING_COLOR) + ' '
      + span(headerMatch[3], NUMBER_COLOR) + '\n';
  }

  // grid = [ or legacy grid:
  const gridMatch = /^(grid)\s*(=)\s*(\[)\s*$/.exec(line);
  if (gridMatch) {
    return span(gridMatch[1], KEYWORD_COLOR) + ' '
      + span(gridMatch[2], OPERATOR_COLOR) + ' '
      + span(gridMatch[3], OPERATOR_COLOR) + '\n';
  }
  if (/^grid:\s*$/.test(line)) return span('grid:', KEYWORD_COLOR) + '\n';
  if (/^\s*\]\s*$/.test(line)) return span(line.trimEnd(), OPERATOR_COLOR) + '\n';

  if (/^\s+\S(\s+\S)*\s*,?\s*$/.test(line)) {
    const indent = line.match(/^(\s+)/)![1];
    const hasComma = /,\s*$/.test(line);
    const stripped = line.trim().replace(/,\s*$/, '');
    const tokens = stripped.split(/\s+/);
    const highlighted = tokens.map(ch => {
      if (ch === 'W') return span(ch, GRID_WALL);
      if (ch === 'R') return span(ch, GRID_ROAD);
      if (ch === '.') return span(ch, GRID_EMPTY);
      if ('^v<>'.includes(ch)) return span(ch, ARROW_COLOR);
      return span(ch, TYPE_COLOR);
    });
    return span(indent, DEFAULT_COLOR) + highlighted.join(' ') + (hasComma ? span(',', OPERATOR_COLOR) : '') + '\n';
  }

  // tile A = tiles.goal(red) — new syntax
  const tileMatch = /^(tile)\s+(\S)\s*(=)\s*(tiles)(\.)\s*(.*)$/.exec(line);
  if (tileMatch) {
    const spec = highlightTileSpec(tileMatch[6].trim());
    return span(tileMatch[1], KEYWORD_COLOR) + ' '
      + span(tileMatch[2], TYPE_COLOR) + ' '
      + span(tileMatch[3], OPERATOR_COLOR) + ' '
      + span(tileMatch[4], KEYWORD_COLOR)
      + span(tileMatch[5], OPERATOR_COLOR)
      + spec + '\n';
  }

  // let A = goal(red) — legacy syntax
  const letMatch = /^(let)\s+(\S)\s*(=)\s*(.+)$/.exec(line);
  if (letMatch) {
    const spec = highlightTileSpec(letMatch[4].trim());
    return span(letMatch[1], KEYWORD_COLOR) + ' '
      + span(letMatch[2], TYPE_COLOR) + ' '
      + span(letMatch[3], OPERATOR_COLOR) + ' '
      + spec + '\n';
  }

  // Agent line — token-by-token to handle partial input
  if (/^agent(?=[\s(]|$)/.test(line)) {
    return highlightAgentLine(line) + '\n';
  }

  return span(line, DEFAULT_COLOR) + '\n';
}

const DIRECTIONS = new Set(['up', 'down', 'left', 'right']);

function highlightTileSpec(spec: string): string {
  // Function syntax: type(args)
  const funcMatch = /^(\S+?)\(([^)]*)\)$/.exec(spec);
  if (funcMatch) {
    const type = funcMatch[1];
    const argsStr = funcMatch[2];
    const result: string[] = [];
    result.push(span(type, TILE_TYPES.has(type) ? TYPE_COLOR : DEFAULT_COLOR));
    result.push(span('(', OPERATOR_COLOR));
    if (argsStr) {
      const args = argsStr.split(',');
      args.forEach((arg, i) => {
        if (i > 0) result.push(span(',', OPERATOR_COLOR));
        const trimmed = arg.trim();
        if (COLOR_MAP[trimmed]) {
          result.push(span(trimmed, COLOR_MAP[trimmed]));
        } else if (DIRECTIONS.has(trimmed)) {
          result.push(span(trimmed, ARROW_COLOR));
        } else {
          result.push(span(trimmed, STRING_COLOR));
        }
      });
    }
    result.push(span(')', OPERATOR_COLOR));
    return result.join('');
  }

  // Bare type (no args): wall, empty, floor-white
  if (TILE_TYPES.has(spec)) {
    return span(spec, TYPE_COLOR);
  }

  // Legacy colon syntax fallback
  const parts = spec.split(':');
  const result: string[] = [];
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i].trim();
    if (i > 0) result.push(span(':', OPERATOR_COLOR));
    if (i === 0 && TILE_TYPES.has(part)) {
      result.push(span(part, TYPE_COLOR));
    } else if (COLOR_MAP[part]) {
      result.push(span(part, COLOR_MAP[part]));
    } else if (part.includes('=')) {
      const pairs = part.split(',');
      result.push(pairs.map(pair => {
        const eq = pair.indexOf('=');
        if (eq === -1) return span(pair, DEFAULT_COLOR);
        return span(pair.slice(0, eq), OPERATOR_COLOR)
          + span('=', OPERATOR_COLOR)
          + span(pair.slice(eq + 1), STRING_COLOR);
      }).join(span(',', OPERATOR_COLOR)));
    } else {
      result.push(span(part, DEFAULT_COLOR));
    }
  }
  return result.join('');
}

function highlightRules(text: string): string {
  const tokens = text.split(',');
  return tokens.map((token, i) => {
    const trimmed = token.trim();
    const pfx = i > 0 ? span(', ', OPERATOR_COLOR) : '';
    const colonIdx = trimmed.indexOf(':');
    if (colonIdx === -1) return pfx + span(trimmed, TYPE_COLOR);
    return pfx
      + span(trimmed.slice(0, colonIdx), TYPE_COLOR)
      + span(':', OPERATOR_COLOR)
      + span(trimmed.slice(colonIdx + 1), NUMBER_COLOR);
  }).join('');
}

/** Highlight an agent line progressively — handles partial input at any point */
function highlightAgentLine(line: string): string {
  let pos = 0;
  const out: string[] = [];

  function eat(re: RegExp): RegExpExecArray | null {
    const m = re.exec(line.slice(pos));
    if (m) pos += m[0].length;
    return m;
  }

  function rest(): string {
    if (pos < line.length) {
      const r = line.slice(pos);
      pos = line.length;
      return span(r, DEFAULT_COLOR);
    }
    return '';
  }

  // "agent"
  const kw = eat(/^(agent)\b/);
  if (!kw) return span(line, DEFAULT_COLOR);
  out.push(span(kw[1], KEYWORD_COLOR));

  // Function syntax: agent(color) or legacy: agent color
  const funcOpen = eat(/^(\()/);
  if (funcOpen) {
    // agent(color) syntax
    out.push(span(funcOpen[1], OPERATOR_COLOR));
    const acolor = eat(/^([^)]*)/);
    if (acolor && acolor[1]) {
      const colorName = acolor[1].trim();
      out.push(span(colorName, COLOR_MAP[colorName] || DEFAULT_COLOR));
    }
    const funcClose = eat(/^(\))/);
    if (!funcClose) return out.join('') + rest();
    out.push(span(funcClose[1], OPERATOR_COLOR));
  } else {
    // Legacy: agent color
    const ws1 = eat(/^(\s+)/);
    if (!ws1) return out.join('') + rest();
    out.push(ws1[1]);
    const acolor = eat(/^(\S+)/);
    if (!acolor) return out.join('') + rest();
    out.push(span(acolor[1], COLOR_MAP[acolor[1]] || DEFAULT_COLOR));
  }

  // whitespace + start(x,y) — handle partial
  const ws2 = eat(/^(\s+)/);
  if (!ws2) return out.join('') + rest();
  out.push(ws2[1]);

  // "start" keyword
  const startKw = eat(/^(start)/);
  if (!startKw) return out.join('') + rest();
  out.push(span(startKw[1], KEYWORD_COLOR));

  // "("
  const lp1 = eat(/^(\()/);
  if (!lp1) return out.join('') + rest();
  out.push(span(lp1[1], OPERATOR_COLOR));

  // x
  const sx = eat(/^(\d+)/);
  if (!sx) return out.join('') + rest();
  out.push(span(sx[1], NUMBER_COLOR));

  // ","
  const c1 = eat(/^(,)/);
  if (!c1) return out.join('') + rest();
  out.push(span(c1[1], OPERATOR_COLOR));

  // y
  const sy = eat(/^(\d+)/);
  if (!sy) return out.join('') + rest();
  out.push(span(sy[1], NUMBER_COLOR));

  // ")"
  const rp1 = eat(/^(\))/);
  if (!rp1) return out.join('') + rest();
  out.push(span(rp1[1], OPERATOR_COLOR));

  // Optional: " and reach(x,y)" — handle partial
  const andKw = eat(/^(\s+)(and)\b/);
  if (!andKw) {
    // Maybe partial keyword or brackets
    return out.join('') + highlightAgentTail(line.slice(pos));
  }
  out.push(andKw[1]);
  out.push(span(andKw[2], KEYWORD_COLOR));

  const ws4 = eat(/^(\s*)/);
  out.push(ws4 ? ws4[1] : '');

  // "reach" keyword
  const reachKw = eat(/^(reach)/);
  if (!reachKw) return out.join('') + rest();
  out.push(span(reachKw[1], KEYWORD_COLOR));

  // "("
  const lp2 = eat(/^(\()/);
  if (!lp2) return out.join('') + rest();
  out.push(span(lp2[1], OPERATOR_COLOR));

  // x
  const rx = eat(/^(\d+)/);
  if (!rx) return out.join('') + rest();
  out.push(span(rx[1], NUMBER_COLOR));

  // ","
  const c2 = eat(/^(,)/);
  if (!c2) return out.join('') + rest();
  out.push(span(c2[1], OPERATOR_COLOR));

  // y
  const ry = eat(/^(\d+)/);
  if (!ry) return out.join('') + rest();
  out.push(span(ry[1], NUMBER_COLOR));

  // ")"
  const rp2 = eat(/^(\))/);
  if (!rp2) return out.join('') + rest();
  out.push(span(rp2[1], OPERATOR_COLOR));

  // Tail: optional [rules] or leftover
  out.push(highlightAgentTail(line.slice(pos)));

  return out.join('');
}

/** Highlight trailing portion of agent line — brackets with rules, or leftover text */
function highlightAgentTail(text: string): string {
  if (!text || !text.trim()) return span(text, DEFAULT_COLOR);
  const rulesMatch = /^(\s*)(\[)([^\]]*)(\])?(.*)$/.exec(text);
  if (rulesMatch) {
    let result = rulesMatch[1]
      + span(rulesMatch[2], OPERATOR_COLOR)
      + highlightRules(rulesMatch[3]);
    if (rulesMatch[4]) result += span(rulesMatch[4], OPERATOR_COLOR);
    if (rulesMatch[5]) result += span(rulesMatch[5], DEFAULT_COLOR);
    return result;
  }
  return span(text, DEFAULT_COLOR);
}

export function highlightDSL(source: string): string {
  return source.split('\n').map(highlightLine).join('');
}
