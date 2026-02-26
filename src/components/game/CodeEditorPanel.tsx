import { useState, useRef, useCallback, useEffect } from 'react';
import type { KeyboardEvent } from 'react';
import { Eye, EyeOff, Copy, AlertTriangle, Check } from 'lucide-react';
import type { Level } from '../../types';
import { parseDSL } from '../../dsl/parser';
import type { ParseResult, ParseError } from '../../dsl/types';
import { LevelPreview } from './LevelPreview';

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
  const gutterRef = useRef<HTMLDivElement>(null);

  const lineCount = code.split('\n').length;

  // Sync gutter scroll with textarea scroll
  const handleScroll = useCallback(() => {
    if (textareaRef.current && gutterRef.current) {
      gutterRef.current.scrollTop = textareaRef.current.scrollTop;
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
        {/* Code textarea */}
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
          {/* Textarea */}
          <textarea
            ref={textareaRef}
            value={code}
            onChange={(e) => handleCodeChange(e.target.value)}
            onKeyDown={handleKeyDown}
            onScroll={handleScroll}
            spellCheck={false}
            autoCorrect="off"
            autoCapitalize="off"
            className="flex-1 bg-zinc-950 text-zinc-200 font-mono text-sm leading-6 py-4 pl-3 pr-4 resize-none outline-none border-none min-h-0"
            style={{ tabSize: 2 }}
            placeholder={`level "My Level" 8x6\n\ntiles:\n  W W W W W W W W\n  W R R R R R R W\n  W R W W R W R W\n  W R R R R W R W\n  W W R W R R R W\n  W W W W W W W W`}
          />
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
