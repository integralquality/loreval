import { describe, expect, it } from 'vitest';
import { DEFAULT_THEME, THEMES, getTheme } from './themes';

describe('THEMES', () => {
  it('has unique ids', () => {
    const ids = THEMES.map(t => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('gives every theme a label, a wall style and a floor style', () => {
    for (const theme of THEMES) {
      expect(theme.label.length).toBeGreaterThan(0);
      expect(theme.wall).toBeTypeOf('object');
      expect(theme.floor).toBeTypeOf('object');
    }
  });

  it('gives every theme a hex preview color', () => {
    for (const theme of THEMES) {
      expect(theme.wallPreview).toMatch(/^#[0-9a-fA-F]{3,8}$/);
    }
  });
});

describe('getTheme', () => {
  it('looks a theme up by id', () => {
    for (const theme of THEMES) {
      expect(getTheme(theme.id)).toBe(theme);
    }
  });

  it('falls back to the first theme for an unknown id', () => {
    expect(getTheme('not-a-theme')).toBe(THEMES[0]);
  });

  it('falls back to the first theme when no id is given', () => {
    expect(getTheme()).toBe(THEMES[0]);
    expect(getTheme(undefined)).toBe(THEMES[0]);
  });
});

describe('DEFAULT_THEME', () => {
  it('names a theme that exists', () => {
    expect(THEMES.some(t => t.id === DEFAULT_THEME)).toBe(true);
  });

  it('resolves to the same theme the fallback returns', () => {
    expect(getTheme(DEFAULT_THEME)).toBe(THEMES[0]);
  });
});
