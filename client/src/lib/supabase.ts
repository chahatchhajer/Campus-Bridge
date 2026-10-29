import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Only the project URL and the public anon/publishable key belong in the browser.
 * The service-role key, database URL and JWT secret live on the server and must never be VITE_* variables.
 */
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const demoMode = import.meta.env.VITE_DEMO_MODE === 'true';
export const supabaseConfigured = Boolean(url && anonKey);

export const supabase: SupabaseClient | null = supabaseConfigured
  ? createClient(url!, anonKey!, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } })
  : null;
