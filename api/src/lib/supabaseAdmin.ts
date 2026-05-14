import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let admin: SupabaseClient | null = null;

export function isSupabaseConfigured(): boolean {
  return Boolean(process.env.SUPABASE_URL?.trim() && process.env.SUPABASE_SERVICE_ROLE_KEY?.trim());
}

export function getSupabaseAdmin(): SupabaseClient {
  if (!isSupabaseConfigured()) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set");
  }
  if (!admin) {
    admin = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return admin;
}

export type AuthJwtUser = { id: string; email?: string };

export async function verifyBearerJwt(jwt: string): Promise<AuthJwtUser | null> {
  const client = getSupabaseAdmin();
  const { data, error } = await client.auth.getUser(jwt);
  if (error || !data.user) return null;
  return { id: data.user.id, email: data.user.email ?? undefined };
}

function toIntId(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") return Number.parseInt(value, 10);
  return Number.NaN;
}

/**
 * Resolves JWT auth user (uuid) to your `public.users.id` (int8).
 * Requires column `public.users.auth_user_id uuid` (see supabase/migrations).
 */
export async function getOrCreateInternalUserId(auth: AuthJwtUser): Promise<number> {
  const client = getSupabaseAdmin();

  const { data: existing, error: selErr } = await client
    .from("users")
    .select("id")
    .eq("auth_user_id", auth.id)
    .maybeSingle();

  if (selErr) throw new Error(selErr.message);
  if (existing?.id != null) {
    const n = toIntId(existing.id);
    if (!Number.isFinite(n)) throw new Error("Invalid users.id from database");
    return n;
  }

  const { data: inserted, error: insErr } = await client
    .from("users")
    .insert({
      auth_user_id: auth.id,
      email: auth.email ?? null,
      full_name: null,
    })
    .select("id")
    .single();

  if (!insErr && inserted?.id != null) {
    const n = toIntId(inserted.id);
    if (!Number.isFinite(n)) throw new Error("Invalid users.id after insert");
    return n;
  }

  // Race: row created between select and insert
  const { data: again, error: againErr } = await client
    .from("users")
    .select("id")
    .eq("auth_user_id", auth.id)
    .maybeSingle();

  if (againErr) throw new Error(againErr.message);
  if (again?.id != null) {
    const n = toIntId(again.id);
    if (!Number.isFinite(n)) throw new Error("Invalid users.id on retry");
    return n;
  }

  throw new Error(insErr?.message ?? "Could not create or load public.users row (add auth_user_id column?)");
}
