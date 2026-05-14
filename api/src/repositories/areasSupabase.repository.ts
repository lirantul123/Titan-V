import type { CreateTargetInput, Target } from "../models/Target.js";
import { getSupabaseAdmin } from "../lib/supabaseAdmin.js";

function rowToTarget(row: Record<string, unknown>): Target {
  return {
    id: String(row.id),
    name: String(row.name),
    lat: Number(row.lat),
    lon: Number(row.lng),
    createdAt: (row.created_at as string) ?? new Date().toISOString(),
  };
}

export async function listAreasForUser(internalUserId: number): Promise<Target[]> {
  const client = getSupabaseAdmin();
  const { data, error } = await client
    .from("areas")
    .select("id, name, lat, lng, created_at")
    .eq("user_id", internalUserId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => rowToTarget(row as Record<string, unknown>));
}

export async function insertArea(internalUserId: number, input: CreateTargetInput): Promise<Target> {
  const client = getSupabaseAdmin();
  const now = new Date().toISOString();
  const { data, error } = await client
    .from("areas")
    .insert({
      user_id: internalUserId,
      name: input.name.trim().toUpperCase(),
      lat: input.lat,
      lng: input.lon,
      updated_at: now,
    })
    .select("id, name, lat, lng, created_at")
    .single();
  if (error || !data) throw new Error(error?.message ?? "insert failed");
  return rowToTarget(data as Record<string, unknown>);
}

export async function deleteAreaForUser(internalUserId: number, areaId: string): Promise<boolean> {
  const idNum = Number.parseInt(areaId, 10);
  if (!Number.isFinite(idNum)) return false;

  const client = getSupabaseAdmin();
  const { data, error } = await client.from("areas").delete().eq("id", idNum).eq("user_id", internalUserId).select("id");
  if (error) throw new Error(error.message);
  return Boolean(data && data.length > 0);
}
