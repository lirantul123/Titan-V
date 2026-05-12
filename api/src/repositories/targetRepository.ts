import { randomUUID } from "crypto";
import type { CreateTargetInput, Target } from "../models/Target.js";

const store = new Map<string, Target>();

export function resetTargetStore(): void {
  store.clear();
}

export function listTargets(): Target[] {
  return [...store.values()].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );
}

export function getTarget(id: string): Target | undefined {
  return store.get(id);
}

export function createTarget(input: CreateTargetInput): Target {
  const now = new Date().toISOString();
  const id = randomUUID();
  const row: Target = {
    id,
    name: input.name.trim().toUpperCase(),
    lat: input.lat,
    lon: input.lon,
    createdAt: now,
  };
  store.set(id, row);
  return row;
}

export function deleteTarget(id: string): boolean {
  return store.delete(id);
}
