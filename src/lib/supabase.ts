import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/**
 * Whether accounts and level sharing are available.
 *
 * These features need a Supabase project, but the designer, the campaign and
 * the eval page are entirely local (models are called with the user's own key),
 * so a missing config must not take the whole app down.
 */
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const SUPABASE_SETUP_MESSAGE =
  'Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in a local .env file to enable accounts and level sharing.';

/**
 * Stand-in used when the env vars are absent. `createClient` throws on an empty
 * URL, and it runs at module load — which would crash every page, including the
 * ones that never touch Supabase. This defers the failure to the first actual
 * use, with a message that says what to do about it.
 */
function unconfiguredClient(): SupabaseClient {
  return new Proxy({} as SupabaseClient, {
    get() {
      throw new Error(SUPABASE_SETUP_MESSAGE);
    },
  });
}

if (!isSupabaseConfigured) {
  console.warn(`[loreval] ${SUPABASE_SETUP_MESSAGE}`);
}

export const supabase: SupabaseClient = isSupabaseConfigured
  ? createClient(supabaseUrl as string, supabaseAnonKey as string)
  : unconfiguredClient();
