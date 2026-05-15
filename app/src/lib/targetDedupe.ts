import type { Target } from "./types";

const COORD_EPS = 1e-4;

export function isSamePlace(a: Target, name: string, lat: number, lon: number): boolean {
  const n = name.trim().toUpperCase();
  const an = a.name.trim().toUpperCase();
  if (an === n) return true;
  return Math.abs(a.lat - lat) < COORD_EPS && Math.abs(a.lon - lon) < COORD_EPS;
}

export function findDuplicateTarget(targets: Target[], name: string, lat: number, lon: number): Target | undefined {
  return targets.find((t) => isSamePlace(t, name, lat, lon));
}
