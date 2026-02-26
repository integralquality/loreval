import { useState, useRef, useCallback, useMemo } from 'react';
import type { KeyboardEvent } from 'react';
import { Eye, EyeOff, Copy, AlertTriangle, Check } from 'lucide-react';
import type { Level } from '../../types';
import { parseDSL } from '../../dsl/parser';
import type { ParseResult, ParseError } from '../../dsl/types';
import { LevelPreview } from './LevelPreview';

// ── Syntax highlighting ─────────────────────────────────────

const KEYWORD_COLOR = '#c084fc';   // purple-400
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
const AGENT_TYPES = new Set(['player', 'dog', 'cat', 'rabbit', 'robot']);
const COLOR_MAP: Record<string, string> = {
  orange: '#fb923c', purple: '#c084fc', pink: '#f472b6',
  blue: '#60a5fa', green: '#6ee7b7', red: '#f87171',
  none: '#71717a',
};

function span(text: string, color: string): string {
  // Escape HTML
  const escaped = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return `<span style="color:${color}">${escaped}</span>`;
}

function highlightLine(line: string): string {
  // Blank
  if (/^\s*$/.test(line)) return '\n';

  // Comment
  if (/^\s*#/.test(line)) return span(line, COMMENT_COLOR) + '\n';

  // Header: level "name" WxH
  const headerMatch = /^(level)\s+("(?:[^"\\]|\\.)*")\s+(\d+x\d+)$/.exec(line);
  if (headerMatch) {
    return span(headerMatch[1], KEYWORD_COLOR) + ' '
      + span(headerMatch[2], STRING_COLOR) + ' '
      + span(headerMatch[3], NUMBER_COLOR) + '\n';
  }

  // Grid label
  if (/^grid:\s*$/.test(line)) return span('grid:', KEYWORD_COLOR) + '\n';

  // Grid row (indented single chars separated by spaces)
  if (/^\s+\S(\s+\S)*\s*$/.test(line)) {
    const indent = line.match(/^(\s+)/)![1];
    const tokens = line.trim().split(/\s+/);
    const highlighted = tokens.map(ch => {
      if (ch === 'W') return span(ch, GRID_WALL);
      if (ch === 'R') return span(ch, GRID_ROAD);
      if (ch === '.') return span(ch, GRID_EMPTY);
      if ('^v<>'.includes(ch)) return span(ch, ARROW_COLOR);
      // Custom legend chars — use a distinct color
      return span(ch, TYPE_COLOR);
    });
    return span(indent, DEFAULT_COLOR) + highlighted.join(' ') + '\n';
  }

  // Let declaration: let C = type:color:meta
  const letMatch = /^(let)\s+(\S)\s*(=)\s*(.+)$/.exec(line);
  if (letMatch) {
    const spec = highlightTileSpec(letMatch[4].trim());
    return span(letMatch[1], KEYWORD_COLOR) + ' '
      + span(letMatch[2], TYPE_COLOR) + ' '
      + span(letMatch[3], OPERATOR_COLOR) + ' '
      + spec + '\n';
  }

  // Agent line: agent type color start(x,y) -> reach(x,y) [rules]
  const agentMatch = /^(agent)\s+(\S+)\s+(\S+)\s+(start)\((\d+),(\d+)\)(.*)$/.exec(line);
  if (agentMatch) {
    let result = span(agentMatch[1], KEYWORD_COLOR) + ' '
      + span(agentMatch[2], AGENT_TYPES.has(agentMatch[2]) ? AGENT_COLOR : DEFAULT_COLOR) + ' '
      + span(agentMatch[3], COLOR_MAP[agentMatch[3]] || DEFAULT_COLOR) + ' '
      + span(agentMatch[4], KEYWORD_COLOR)
      + span('(', OPERATOR_COLOR)
      + span(agentMatch[5], NUMBER_COLOR)
      + span(',', OPERATOR_COLOR)
      + span(agentMatch[6], NUMBER_COLOR)
      + span(')', OPERATOR_COLOR);

    let rest = agentMatch[7];

    // -> reach(x,y)
    const reachMatch = /^\s*(->)\s*(reach)\((\d+),(\d+)\)(.*)$/.exec(rest);
    if (reachMatch) {
      result += ' ' + span(reachMatch[1], OPERATOR_COLOR) + ' '
        + span(reachMatch[2], KEYWORD_COLOR)
        + span('(', OPERATOR_COLOR)
        + span(reachMatch[3], NUMBER_COLOR)
        + span(',', OPERATOR_COLOR)
        + span(reachMatch[4], NUMBER_COLOR)
        + span(')', OPERATOR_COLOR);
      rest = reachMatch[5];
    }

    // [rules]
    const rulesMatch = /^\s*(\[)([^\]]*)(\])$/.exec(rest);
    if (rulesMatch) {
      result += ' ' + span(rulesMatch[1], OPERATOR_COLOR)
        + highlightRules(rulesMatch[2])
        + span(rulesMatch[3], OPERATOR_COLOR);
    }

    return result + '\n';
  }

  // Fallback — plain text
  return span(line, DEFAULT_COLOR) + '\n';
}

function highlightTileSpec(spec: string): string {
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
      // meta: key=val,key=val
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
    const prefix = i > 0 ? span(', ', OPERATOR_COLOR) : '';
    const colonIdx = trimmed.indexOf(':');
    if (colonIdx === -1) {
      return prefix + span(trimmed, TYPE_COLOR);
    }
    return prefix
      + span(trimmed.slice(0, colonIdx), TYPE_COLOR)
      + span(':', OPERATOR_COLOR)
      + span(trimmed.slice(colonIdx + 1), NUMBER_COLOR);
  }).join('');
}

function highlightDSL(source: string): string {
  return source.split('\n').map(highlightLine).join('');
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
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const highlightRef = useRef<HTMLPreElement>(null);
  const gutterRef = useRef<HTMLDivElement>(null);

  const lineCount = code.split('\n').length;

  const highlighted = useMemo(() => highlightDSL(code), [code]);

  // Sync scroll across gutter, highlight overlay, and textarea
  const handleScroll = useCallback(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    if (gutterRef.current) gutterRef.current.scrollTop = ta.scrollTop;
    if (highlightRef.current) {
      highlightRef.current.scrollTop = ta.scrollTop;
      highlightRef.current.scrollLeft = ta.scrollLeft;
    }
  }, []);

  const handleCodeChange = useCallback((value: string) => {
    setCode(value);
    onCodeChange?.(value);
  }, [onCodeChange]);

  const handleParse = useCallback(() => {
    const result = parseDSL(code);
    setParseResult(result);
    if (result.level && result.errors.length === 0) {
      setShowPreview(true);
      onApply(result.level);
    }
  }, [code, onApply]);

  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Tab inserts 2 spaces
    if (e.key === 'Tab') {
      e.preventDefault();
      const ta = e.currentTarget;
      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      const newCode = code.slice(0, start) + '  ' + code.slice(end);
      handleCodeChange(newCode);
      // Restore cursor position
      requestAnimationFrame(() => {
        ta.selectionStart = ta.selectionEnd = start + 2;
      });
    }
  }, [code, handleCodeChange]);

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
          className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white text-xs font-medium rounded-md transition-colors"
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
          {/* Editor area: highlight overlay + textarea stacked */}
          <div className="flex-1 relative min-h-0">
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
              spellCheck={false}
              autoCorrect="off"
              autoCapitalize="off"
              className="absolute inset-0 w-full h-full bg-transparent font-mono text-sm leading-6 py-4 pl-3 pr-4 resize-none outline-none border-none text-transparent caret-zinc-200 selection:bg-purple-500/30"
              style={{ tabSize: 2 }}
              placeholder={`level "My Level" 8x6\n\ngrid:\n  W W W W W W W W\n  W R R R R R R W\n  W R W G R W R W\n  W R R R R W R W\n  W W R W R R R W\n  W W W W W W W W\n\nlet G = goal:orange:id=g1\n\nagent dog orange start(1,1) -> reach(3,2)`}
            />
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
