import { describe, expect, it } from 'vitest';
import { cn } from './utils';

describe('cn', () => {
  it('joins plain class names', () => {
    expect(cn('a', 'b')).toBe('a b');
  });

  it('drops falsy values', () => {
    expect(cn('a', false, null, undefined, '', 'b')).toBe('a b');
  });

  it('accepts arrays and conditional objects', () => {
    expect(cn(['a', 'b'], { c: true, d: false })).toBe('a b c');
  });

  it('lets the last conflicting Tailwind class win', () => {
    expect(cn('px-2', 'px-4')).toBe('px-4');
    expect(cn('text-sm text-red-500', 'text-blue-500')).toBe('text-sm text-blue-500');
  });

  it('keeps non-conflicting Tailwind classes', () => {
    expect(cn('px-2', 'py-4')).toBe('px-2 py-4');
  });

  it('returns an empty string for no input', () => {
    expect(cn()).toBe('');
  });
});
