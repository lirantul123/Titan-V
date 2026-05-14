import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null | undefined;

export function isBrowserSupabaseConfigured(): boolean {
  const url = import.meta.env.VITE_SUPABASE_URL?.trim();
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();
  return Boolean(url && key);
}

export function getBrowserSupabase(): SupabaseClient | null {
  if (client === undefined) {
    const url = import.meta.env.VITE_SUPABASE_URL?.trim();
    const key = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();
    if (!url || !key) {
      client = null;
    } else {
      client = createClient(url, key, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
      });
    }
  }
  return client;
}
