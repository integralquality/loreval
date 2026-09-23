/**
 * A textarea that shows syntax-coloured DSL.
 *
 * The usual overlay trick: a `<pre>` renders the highlighted source, and a
 * transparent textarea sits exactly on top of it to take the typing. The two
 * must agree on every metric that affects layout — font, size, line height,
 * padding, wrapping, tab size — or the caret drifts away from the glyphs, so
 * those are defined once in `SHARED` below and applied to both.
 *
 * The designer's editor does the same thing with its own line numbers and
 * autocomplete; this is the plain version, for places that just need a
 * coloured input.
 */
import { useRef, useState } from 'react';
import type { UIEvent } from 'react';
import { highlightDSL } from '../../lib/dsl-highlight';

/** Everything that has to match between the two layers, character for character. */
const SHARED = 'font-mono text-[11px] leading-5 p-3 whitespace-pre-wrap break-words';

interface Props {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  className?: string;
  /** Marks the field as holding invalid input, for the border colour. */
  invalid?: boolean;
}

export function DslTextarea({
  value,
  onChange,
  placeholder,
  rows = 10,
  className = '',
  invalid = false,
}: Props) {
  const highlightRef = useRef<HTMLPreElement>(null);
  const [focused, setFocused] = useState(false);

  // The highlight layer does not scroll on its own — it is dragged along by
  // the textarea, which is the element that actually has the scrollbar.
  const handleScroll = (e: UIEvent<HTMLTextAreaElement>) => {
    const pre = highlightRef.current;
    if (!pre) return;
    pre.scrollTop = e.currentTarget.scrollTop;
    pre.scrollLeft = e.currentTarget.scrollLeft;
  };

  const border = invalid
    ? 'border-red-500/50'
    : focused
      ? 'border-zinc-400'
      : 'border-white/15';

  return (
    <div
      className={`relative rounded border bg-zinc-950 transition-colors ${border} ${className}`}
      style={{ height: `calc(${rows} * 1.25rem + 1.5rem)` }}
    >
      <pre
        ref={highlightRef}
        aria-hidden="true"
        className={`absolute inset-0 m-0 overflow-hidden pointer-events-none ${SHARED}`}
        dangerouslySetInnerHTML={{ __html: highlightDSL(value) }}
      />
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        onScroll={handleScroll}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={placeholder}
        spellCheck={false}
        autoCorrect="off"
        autoCapitalize="off"
        className={`absolute inset-0 w-full h-full resize-none bg-transparent outline-none border-none overflow-auto text-transparent caret-zinc-200 placeholder-zinc-600 selection:bg-orange-500/30 ${SHARED}`}
      />
    </div>
  );
}
