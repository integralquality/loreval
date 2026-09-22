import { describe, expect, it } from 'vitest';
import { SUPABASE_SETUP_MESSAGE, isSupabaseConfigured, supabase } from './supabase';

/**
 * The regression these cover: `createClient` throws on an empty URL, and it ran
 * at module load, so a missing .env crashed every page — including the designer
 * and eval pages, which never touch Supabase.
 *
 * Written to hold whether or not the developer running them has a .env.
 */
describe('supabase module', () => {
  it('imports without throwing regardless of configuration', () => {
    // Reaching this line at all is the assertion: a throwing module would fail
    // the whole file at collection time.
    expect(typeof isSupabaseConfigured).toBe('boolean');
  });

  it('exposes a usable client when configured, and an explaining stub when not', () => {
    if (isSupabaseConfigured) {
      expect(supabase.auth).toBeDefined();
      expect(supabase.from).toBeTypeOf('function');
    } else {
      expect(() => supabase.auth).toThrow(SUPABASE_SETUP_MESSAGE);
      expect(() => supabase.from).toThrow(/not configured/i);
    }
  });

  it('names both required variables in the setup message', () => {
    expect(SUPABASE_SETUP_MESSAGE).toContain('VITE_SUPABASE_URL');
    expect(SUPABASE_SETUP_MESSAGE).toContain('VITE_SUPABASE_ANON_KEY');
  });
});
