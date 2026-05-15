import { findDuplicateTarget } from "./targetDedupe";
import type { Target } from "./types";

export type GeocodeHit = { lat: number; lon: number; displayName: string };

export type CreateTargetResult =
  | { ok: true; target: Target }
  | { ok: false; reason: "duplicate" | "api"; message: string };

export async function createTargetAt(
  apiFetch: (input: string | URL, init?: RequestInit) => Promise<Response>,
  apiBase: string,
  existing: Target[],
  hit: GeocodeHit,
): Promise<CreateTargetResult> {
  const name = hit.displayName.split(",")[0].trim().toUpperCase() || `PIN_${hit.lat.toFixed(2)}`;
  if (findDuplicateTarget(existing, name, hit.lat, hit.lon)) {
    return { ok: false, reason: "duplicate", message: "DUPLICATE — ALREADY_IN_REGISTRY" };
  }

  const createRes = await apiFetch(`${apiBase}/api/v1/targets`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, lat: hit.lat, lon: hit.lon }),
  });
  const created = (await createRes.json().catch(() => ({}))) as {
    message?: string;
    target?: Target;
  };

  if (createRes.status === 409) {
    return { ok: false, reason: "duplicate", message: created.message || "DUPLICATE — ALREADY_IN_REGISTRY" };
  }
  if (!createRes.ok || !created.target) {
    return { ok: false, reason: "api", message: created.message || "TARGET_CREATE_FAILED" };
  }

  return {
    ok: true,
    target: {
      id: created.target.id,
      name: created.target.name,
      lat: created.target.lat,
      lon: created.target.lon,
    },
  };
}

export async function geocodeQuery(
  apiFetch: (input: string | URL, init?: RequestInit) => Promise<Response>,
  apiBase: string,
  query: string,
): Promise<GeocodeHit[]> {
  const res = await apiFetch(`${apiBase}/api/v1/geocode`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ q: query.trim() }),
  });
  const payload = (await res.json().catch(() => ({}))) as {
    message?: string;
    results?: GeocodeHit[];
  };
  if (!res.ok) throw new Error(payload.message || "GEOCODE_FAILED");
  return payload.results ?? [];
}

export async function reverseGeocode(
  apiFetch: (input: string | URL, init?: RequestInit) => Promise<Response>,
  apiBase: string,
  lat: number,
  lon: number,
): Promise<GeocodeHit | null> {
  const res = await apiFetch(`${apiBase}/api/v1/geocode`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ lat, lon }),
  });
  const payload = (await res.json().catch(() => ({}))) as {
    results?: GeocodeHit[];
    message?: string;
  };
  if (!res.ok) return null;
  return payload.results?.[0] ?? null;
}
