/**
 * Supabase client — public anon key only. Server-side code that needs the
 * service role must build its own client from `SUPABASE_SERVICE_ROLE_KEY`
 * and never import this module.
 *
 * Returns null when env vars are missing so the app degrades gracefully
 * rather than crashing on first load.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url     = import.meta.env.PUBLIC_SUPABASE_URL  as string | undefined;
const anonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY as string | undefined;

export const supabase: SupabaseClient | null =
  url && anonKey
    ? createClient(url, anonKey, { auth: { persistSession: true, autoRefreshToken: true } })
    : null;

export const supabaseReady = Boolean(url && anonKey);
