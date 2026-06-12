import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import type { KeyboardEvent } from 'react';
import { Eye, EyeOff, Copy, AlertTriangle, Check } from 'lucide-react';
import type { Level } from '../../types';
import { parseDSL } from '../../dsl/parser';
import type { ParseResult, ParseError } from '../../dsl/types';
import { LevelPreview } from './LevelPreview';

// ── Syntax highlighting ─────────────────────────────────────

const KEYWORD_COLOR = '#93c5fd';   // blue-300 — matches DSL keyword color on landing/docs
const STRING_COLOR = '#86efac';    // green-300
const NUMBER_COLOR = '#fdba74';    // orange-300
const TYPE_COLOR = '#67e8f9';      // cyan-300
const AGENT_COLOR = '#fde047';     // yellow-300
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

function highlightDSL(source: string): string {
  return source.split('\n').map(highlightLine).join('');
}

// ── Autocomplete ────────────────────────────────────────────

interface Suggestion {
  label: string;
  detail?: string;
  insert: string; // text to insert (may differ from label, e.g. include trailing colon)
}

interface ACState {
  items: Suggestion[];
  index: number;
  top: number;
  left: number;
  prefix: string;       // the partial word being matched
  prefixStart: number;  // position in code where prefix begins
}

const LINE_HEIGHT = 24; // leading-6
const PAD_TOP = 16;     // py-4
const PAD_LEFT = 12;    // pl-3

const KW_SUGGESTIONS: Suggestion[] = [
  { label: 'level',  detail: 'Level header',  insert: 'level ' },
  { label: 'grid',   detail: 'Grid block',    insert: 'grid = [\n  ' },
  { label: 'tile',   detail: 'Tile variable', insert: 'tile ' },
  { label: 'agent',  detail: 'Agent',         insert: 'agent(' },
  { label: '#',       detail: 'Comment',      insert: '# ' },
];

const TILE_SUGGESTIONS: Suggestion[] = [
  { label: 'wall',       detail: 'Brick wall',       insert: 'wall' },
  { label: 'floor-white', detail: 'Road tile',       insert: 'floor-white' },
  { label: 'goal',       detail: 'Exit tile',        insert: 'goal(' },
  { label: 'door',       detail: 'Color door',       insert: 'door(' },
  { label: 'switch',     detail: 'Toggle switch',    insert: 'switch(' },
  { label: 'paint',      detail: 'Color changer',    insert: 'paint(' },
  { label: 'one-way',    detail: 'Directional',      insert: 'one-way(' },
  { label: 'lock',       detail: 'Color lock',       insert: 'lock(' },
  { label: 'empty',      detail: 'Empty tile',       insert: 'empty' },
];

const AGENT_COLOR_SUGGESTIONS: Suggestion[] = [
  { label: 'orange', insert: 'orange) ' },
  { label: 'purple', insert: 'purple) ' },
  { label: 'pink',   insert: 'pink) ' },
  { label: 'blue',   insert: 'blue) ' },
  { label: 'green',  insert: 'green) ' },
  { label: 'red',    insert: 'red) ' },
];

const COLOR_SUGGESTIONS: Suggestion[] = [
  { label: 'orange', insert: 'orange)' },
  { label: 'purple', insert: 'purple)' },
  { label: 'pink',   insert: 'pink)' },
  { label: 'blue',   insert: 'blue)' },
  { label: 'green',  insert: 'green)' },
  { label: 'red',    insert: 'red)' },
  { label: 'none',   detail: 'No color', insert: 'none)' },
];

const RULE_SUGGESTIONS: Suggestion[] = [
  { label: 'max-steps',  detail: 'Limit moves', insert: 'max-steps:' },
  { label: 'reach-goal', detail: 'Reach exit',  insert: 'reach-goal' },
];

const META_KEY_SUGGESTIONS: Suggestion[] = [
  { label: 'id=',        detail: 'Tile identifier', insert: 'id=' },
  { label: 'direction=', detail: 'Direction',       insert: 'direction=' },
];

const DIRECTION_SUGGESTIONS: Suggestion[] = [
  { label: 'up',    insert: 'up)' },
  { label: 'down',  insert: 'down)' },
  { label: 'left',  insert: 'left)' },
  { label: 'right', insert: 'right)' },
];

type ContextType = 'line-start' | 'tile-ns' | 'tile-type' | 'tile-color' | 'tile-meta-key' | 'direction-val'
  | 'agent-color' | 'agent-start' | 'agent-and' | 'agent-reach' | 'rule' | 'none';

function getContext(code: string, cursor: number): { type: ContextType; prefix: string; prefixStart: number } {
  const lineStart = code.lastIndexOf('\n', cursor - 1) + 1;
  const lineBefore = code.slice(lineStart, cursor);

  // Find current word — treat . ( ) as word boundaries
  const wordMatch = /([^\s.()]*)$/.exec(lineBefore);
  const prefix = wordMatch ? wordMatch[1] : '';
  const prefixStart = cursor - prefix.length;
  const before = lineBefore.slice(0, lineBefore.length - prefix.length).trimEnd();

  // Inside grid rows (indented lines when we've seen grid:)
  if (/^\s+\S/.test(lineBefore) && !lineBefore.trimStart().startsWith('tile') && !lineBefore.trimStart().startsWith('let') && !lineBefore.trimStart().startsWith('agent')) {
    return { type: 'none', prefix, prefixStart };
  }

  // Empty or whitespace-only before prefix → line start
  if (before === '') return { type: 'line-start', prefix, prefixStart };

  // After "tile A = " — suggest tiles. namespace
  if (/^tile\s+\S\s*=\s*$/.test(before + ' ')) return { type: 'tile-ns', prefix, prefixStart };

  // After "tile A = tiles." — suggest tile types
  if (/^tile\s+\S\s*=\s*tiles\.$/.test(before)) return { type: 'tile-type', prefix, prefixStart };

  // After "tile A = tiles.type(" — suggest color/direction
  if (/^tile\s+\S\s*=\s*tiles\.\S+\($/.test(before)) {
    const tileType = before.match(/tiles\.(\S+?)\($/)?.[1] || '';
    if (tileType === 'one-way') return { type: 'direction-val', prefix, prefixStart };
    return { type: 'tile-color', prefix, prefixStart };
  }

  // After "let X = " (legacy)
  if (/^let\s+\S\s*=\s*$/.test(before + ' ')) return { type: 'tile-type', prefix, prefixStart };

  // After "let X = type(" — suggest color (legacy function syntax)
  if (/^let\s+\S\s*=\s*\S+\($/.test(before)) {
    const tileType = before.match(/=\s*(\S+?)\($/)?.[1] || '';
    if (tileType === 'one-way') return { type: 'direction-val', prefix, prefixStart };
    return { type: 'tile-color', prefix, prefixStart };
  }

  // After "let X = type:" (color or meta — legacy colon syntax)
  if (/^let\s+\S\s*=\s*\S+:$/.test(before)) {
    const eqIdx = before.indexOf('=');
    const afterEq = before.slice(eqIdx + 1).trim();
    const colonCount = (afterEq.match(/:/g) || []).length;
    if (colonCount >= 2) return { type: 'tile-meta-key', prefix, prefixStart };
    return { type: 'tile-color', prefix, prefixStart };
  }

  // After "let X = type:color:" (meta keys)
  if (/^let\s+\S\s*=\s*\S+:\S+:$/.test(before)) return { type: 'tile-meta-key', prefix, prefixStart };

  // After "direction="
  if (/direction=$/.test(before)) return { type: 'direction-val', prefix, prefixStart };

  // After "agent(" — suggest color (function syntax)
  if (/^agent\($/.test(before)) return { type: 'agent-color', prefix, prefixStart };

  // After "agent " — suggest color (legacy syntax)
  if (/^agent\s*$/.test(before)) return { type: 'agent-color', prefix, prefixStart };

  // After "agent(color) " or "agent color " — suggest start(
  if (/^agent(?:\(\S+\)|\s+\S+)\s*$/.test(before)) return { type: 'agent-start', prefix, prefixStart };

  // After "start(x,y) " — suggest and
  if (/^agent.*start\(\d+,\d+\)\s*$/.test(before)) return { type: 'agent-and', prefix, prefixStart };

  // After "and " — suggest reach(
  if (/^agent.*\)\s+and\s*$/.test(before)) return { type: 'agent-reach', prefix, prefixStart };

  // Inside brackets [...]
  const openBracket = lineBefore.lastIndexOf('[');
  const closeBracket = lineBefore.lastIndexOf(']');
  if (openBracket > closeBracket) {
    // Check if after a comma or right after [
    const insideBracket = lineBefore.slice(openBracket + 1);
    if (/^[^,]*$/.test(insideBracket) || /,\s*\S*$/.test(insideBracket)) {
      return { type: 'rule', prefix, prefixStart };
    }
  }

  return { type: 'none', prefix, prefixStart };
}

function getSuggestions(type: ContextType, prefix: string): Suggestion[] {
  let pool: Suggestion[];
  switch (type) {
    case 'line-start':    pool = KW_SUGGESTIONS; break;
    case 'tile-ns':       pool = [{ label: 'tiles.', detail: 'Tile namespace', insert: 'tiles.' }]; break;
    case 'tile-type':     pool = TILE_SUGGESTIONS; break;
    case 'tile-color':    pool = COLOR_SUGGESTIONS; break;
    case 'tile-meta-key': pool = META_KEY_SUGGESTIONS; break;
    case 'direction-val': pool = DIRECTION_SUGGESTIONS; break;
    case 'agent-color':   pool = AGENT_COLOR_SUGGESTIONS; break;
    case 'agent-start':   pool = [{ label: 'start(', detail: 'Start position', insert: 'start(' }]; break;
    case 'agent-and':     pool = [{ label: 'and', detail: 'Chain condition', insert: 'and ' }]; break;
    case 'agent-reach':   pool = [{ label: 'reach(', detail: 'Target position', insert: 'reach(' }]; break;
    case 'rule':          pool = RULE_SUGGESTIONS; break;
    default: return [];
  }
  if (!prefix) return pool;
  const lower = prefix.toLowerCase();
  return pool.filter(s => s.label.toLowerCase().startsWith(lower));
}

function measureCharWidth(): number {
  const el = document.createElement('span');
  el.style.fontFamily = 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace';
  el.style.fontSize = '14px';
  el.style.position = 'absolute';
  el.style.visibility = 'hidden';
  el.textContent = 'X';
  document.body.appendChild(el);
  const w = el.getBoundingClientRect().width;
  document.body.removeChild(el);
  return w;
}

// ── Component ───────────────────────────────────────────────

interface CodeEditorPanelProps {
  initialCode: string;
  onApply: (level: Level) => void;
  onCodeChange?: (code: string) => void;
}

export function CodeEditorPanel({ initialCode, onApply, onCodeChange }: CodeEditorPanelProps) {
  const [code, setCode] = useState(initialCode);
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [copied, setCopied] = useState(false);
  const [ac, setAc] = useState<ACState | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const highlightRef = useRef<HTMLPreElement>(null);
  const gutterRef = useRef<HTMLDivElement>(null);
  const charWidthRef = useRef(8.4);
  const suppressAcRef = useRef(false);

  const lineCount = code.split('\n').length;
  const highlighted = useMemo(() => highlightDSL(code), [code]);

  // Measure monospace char width once
  useEffect(() => {
    charWidthRef.current = measureCharWidth();
  }, []);

  // Compute autocomplete position from cursor
  const computeAcPosition = useCallback((cursor: number) => {
    const ta = textareaRef.current;
    if (!ta) return { top: 0, left: 0 };
    const textBefore = code.slice(0, cursor);
    const lines = textBefore.split('\n');
    const line = lines.length - 1;
    const col = lines[lines.length - 1].length;
    return {
      top: line * LINE_HEIGHT + PAD_TOP + LINE_HEIGHT - ta.scrollTop,
      left: col * charWidthRef.current + PAD_LEFT - ta.scrollLeft,
    };
  }, [code]);

  // Update autocomplete based on cursor position
  const updateAutocomplete = useCallback((newCode: string, cursor: number) => {
    if (suppressAcRef.current) {
      suppressAcRef.current = false;
      setAc(null);
      return;
    }
    const ctx = getContext(newCode, cursor);
    const items = getSuggestions(ctx.type, ctx.prefix);
    if (items.length === 0 || (items.length === 1 && items[0].label === ctx.prefix)) {
      setAc(null);
      return;
    }
    const textBefore = newCode.slice(0, cursor);
    const lines = textBefore.split('\n');
    const line = lines.length - 1;
    const col = lines[lines.length - 1].length;
    const prefixCol = col - ctx.prefix.length;
    const ta = textareaRef.current;
    setAc({
      items,
      index: 0,
      top: line * LINE_HEIGHT + PAD_TOP + LINE_HEIGHT - (ta?.scrollTop || 0),
      left: prefixCol * charWidthRef.current + PAD_LEFT - (ta?.scrollLeft || 0),
      prefix: ctx.prefix,
      prefixStart: ctx.prefixStart,
    });
  }, []);

  // Accept a suggestion
  const acceptSuggestion = useCallback((suggestion: Suggestion) => {
    const ta = textareaRef.current;
    if (!ac || !ta) return;
    const before = code.slice(0, ac.prefixStart);
    const after = code.slice(ac.prefixStart + ac.prefix.length);
    const newCode = before + suggestion.insert + after;
    const newCursor = ac.prefixStart + suggestion.insert.length;
    // Chain autocomplete if insertion ends with . or ( — otherwise suppress
    const chainable = /[.(]$/.test(suggestion.insert);
    if (!chainable) suppressAcRef.current = true;
    setCode(newCode);
    onCodeChange?.(newCode);
    setAc(null);
    requestAnimationFrame(() => {
      ta.selectionStart = ta.selectionEnd = newCursor;
      ta.focus();
      if (chainable) updateAutocomplete(newCode, newCursor);
    });
  }, [ac, code, onCodeChange]);

  const handleScroll = useCallback(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    if (gutterRef.current) gutterRef.current.scrollTop = ta.scrollTop;
    if (highlightRef.current) {
      highlightRef.current.scrollTop = ta.scrollTop;
      highlightRef.current.scrollLeft = ta.scrollLeft;
    }
    setAc(null); // dismiss on scroll
  }, []);

  const handleCodeChange = useCallback((value: string) => {
    setCode(value);
    onCodeChange?.(value);
    // Schedule autocomplete after React updates the textarea
    requestAnimationFrame(() => {
      const ta = textareaRef.current;
      if (ta) updateAutocomplete(value, ta.selectionStart);
    });
  }, [onCodeChange, updateAutocomplete]);

  const handleParse = useCallback(() => {
    const result = parseDSL(code);
    setParseResult(result);
    if (result.level && result.errors.length === 0) {
      setShowPreview(true);
      onApply(result.level);
    }
  }, [code, onApply]);

  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Autocomplete navigation
    if (ac && ac.items.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setAc(prev => prev ? { ...prev, index: (prev.index + 1) % prev.items.length } : null);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setAc(prev => prev ? { ...prev, index: (prev.index - 1 + prev.items.length) % prev.items.length } : null);
        return;
      }
      if (e.key === 'Tab' || e.key === 'Enter') {
        e.preventDefault();
        acceptSuggestion(ac.items[ac.index]);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setAc(null);
        return;
      }
    }

    // Tab inserts 2 spaces (only when autocomplete not showing)
    if (e.key === 'Tab') {
      e.preventDefault();
      const ta = e.currentTarget;
      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      const newCode = code.slice(0, start) + '  ' + code.slice(end);
      suppressAcRef.current = true;
      setCode(newCode);
      onCodeChange?.(newCode);
      requestAnimationFrame(() => {
        ta.selectionStart = ta.selectionEnd = start + 2;
      });
    }
  }, [code, ac, acceptSuggestion, onCodeChange]);

  // Dismiss autocomplete on blur
  const handleBlur = useCallback(() => {
    // Delay so clicks on dropdown items register first
    setTimeout(() => setAc(null), 150);
  }, []);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  }, [code]);

  const errors = parseResult?.errors || [];
  const warnings = parseResult?.warnings || [];
  const hasErrors = errors.length > 0;
  const previewLevel = parseResult?.level;

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 py-2 bg-zinc-900/80 border-b border-zinc-800 shrink-0">
        <button
          onClick={handleParse}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-600 hover:bg-orange-500 text-white text-xs font-medium rounded-md transition-colors"
        >
          {showPreview ? <EyeOff size={13} /> : <Eye size={13} />}
          Preview
        </button>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs rounded-md transition-colors"
        >
          {copied ? <Check size={13} className="text-green-400" /> : <Copy size={13} />}
          {copied ? 'Copied' : 'Copy'}
        </button>
        <div className="flex-1" />
        {parseResult && (
          <span className={`text-xs ${hasErrors ? 'text-red-400' : 'text-green-400'}`}>
            {hasErrors
              ? `${errors.length} error${errors.length > 1 ? 's' : ''}`
              : 'Valid'}
            {warnings.length > 0 && `, ${warnings.length} warning${warnings.length > 1 ? 's' : ''}`}
          </span>
        )}
      </div>

      {/* Main area */}
      <div className={`flex-1 flex ${showPreview && previewLevel ? 'flex-row' : 'flex-col'} min-h-0 overflow-hidden`}>
        {/* Code editor */}
        <div className={`${showPreview && previewLevel ? 'w-1/2 border-r border-zinc-800' : 'flex-1'} flex min-h-0`}>
          {/* Line numbers gutter */}
          <div
            ref={gutterRef}
            className="shrink-0 bg-zinc-900/50 text-zinc-600 font-mono text-sm leading-6 pt-4 pb-4 text-right select-none overflow-hidden border-r border-zinc-800/50"
            style={{ minWidth: `${String(lineCount).length + 2}ch`, paddingLeft: '0.5ch', paddingRight: '1ch' }}
            aria-hidden="true"
          >
            {Array.from({ length: lineCount }, (_, i) => (
              <div key={i + 1}>{i + 1}</div>
            ))}
          </div>
          {/* Editor area: highlight overlay + textarea + autocomplete */}
          <div className="flex-1 relative min-h-0 bg-zinc-950">
            {/* Syntax highlight layer */}
            <pre
              ref={highlightRef}
              className="absolute inset-0 font-mono text-sm leading-6 py-4 pl-3 pr-4 m-0 overflow-hidden pointer-events-none whitespace-pre-wrap break-words"
              style={{ tabSize: 2 }}
              aria-hidden="true"
              dangerouslySetInnerHTML={{ __html: highlighted }}
            />
            {/* Transparent textarea on top for editing */}
            <textarea
              ref={textareaRef}
              value={code}
              onChange={(e) => handleCodeChange(e.target.value)}
              onKeyDown={handleKeyDown}
              onScroll={handleScroll}
              onBlur={handleBlur}
              spellCheck={false}
              autoCorrect="off"
              autoCapitalize="off"
              className="absolute inset-0 w-full h-full bg-transparent font-mono text-sm leading-6 py-4 pl-3 pr-4 resize-none outline-none border-none text-transparent caret-zinc-200 selection:bg-orange-500/30"
              style={{ tabSize: 2 }}
              placeholder={`level "My Level" 8x6\n\ngrid = [\n  W W W W W W W W,\n  W R R R R R R W,\n  W R W G R W R W,\n  W R R R R W R W,\n  W W R W R R R W,\n  W W W W W W W W,\n]\n\ntile G = tiles.goal(orange)\n\nagent(orange) start(1,1) and reach(3,2)`}
            />
            {/* Autocomplete dropdown */}
            {ac && ac.items.length > 0 && (
              <div
                className="absolute z-50 min-w-[140px] max-h-[160px] overflow-y-auto bg-zinc-800/95 border border-zinc-700/80 rounded-md shadow-lg py-0.5 backdrop-blur-sm"
                style={{ top: ac.top, left: Math.min(ac.left, 300) }}
              >
                {ac.items.map((item, i) => (
                  <button
                    key={item.label}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      acceptSuggestion(item);
                    }}
                    className={`w-full text-left px-2 py-0.5 text-xs flex items-center gap-2 ${
                      i === ac.index
                        ? 'bg-zinc-600/60 text-zinc-100'
                        : 'text-zinc-300 hover:bg-zinc-700/40'
                    }`}
                  >
                    <span className="font-mono">{item.label}</span>
                    {item.detail && (
                      <span className="text-[10px] text-zinc-500 ml-auto">{item.detail}</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Preview panel */}
        {showPreview && previewLevel && (
          <div className="w-1/2 overflow-auto bg-zinc-950 p-4 flex items-start justify-center">
            <LevelPreview level={previewLevel} maxWidth={360} />
          </div>
        )}
      </div>

      {/* Error panel */}
      {parseResult && (errors.length > 0 || warnings.length > 0) && (
        <div className="shrink-0 max-h-32 overflow-auto border-t border-zinc-800 bg-zinc-900/60 px-4 py-2 space-y-1">
          {errors.map((e, i) => (
            <ErrorLine key={`e-${i}`} error={e} type="error" />
          ))}
          {warnings.map((w, i) => (
            <ErrorLine key={`w-${i}`} error={w} type="warning" />
          ))}
        </div>
      )}
    </div>
  );
}

function ErrorLine({ error, type }: { error: ParseError; type: 'error' | 'warning' }) {
  return (
    <div className={`flex items-start gap-2 text-xs ${type === 'error' ? 'text-red-400' : 'text-amber-400'}`}>
      <AlertTriangle size={12} className="shrink-0 mt-0.5" />
      <span>
        <span className="text-zinc-500">Line {error.line}:</span> {error.message}
      </span>
    </div>
  );
}
