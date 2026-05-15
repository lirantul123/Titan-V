/** ~11 m at equator — treat as same place for duplicate checks */
const COORD_EPS = 1e-4;

export type TargetLike = { name: string; lat: number; lon: number };

export function isSamePlace(a: TargetLike, name: string, lat: number, lon: number): boolean {
  const n = name.trim().toUpperCase();
  const an = a.name.trim().toUpperCase();
  if (an === n) return true;
  return Math.abs(a.lat - lat) < COORD_EPS && Math.abs(a.lon - lon) < COORD_EPS;
}

export function findDuplicateTarget<T extends TargetLike>(rows: T[], name: string, lat: number, lon: number): T | undefined {
  return rows.find((t) => isSamePlace(t, name, lat, lon));
}
