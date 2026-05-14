import type { Request, Response } from "express";
import { isSupabaseConfigured } from "../lib/supabaseAdmin.js";
import {
  deleteAreaForUser,
  insertArea,
  listAreasForUser,
} from "../repositories/areasSupabase.repository.js";
import {
  createTarget,
  deleteTarget,
  listTargets,
} from "../repositories/targetRepository.js";

function toTargetPayload(t: { id: string; name: string; lat: number; lon: number }) {
  return { id: t.id, name: t.name, lat: t.lat, lon: t.lon };
}

export async function getTargets(req: Request, res: Response): Promise<void> {
  if (isSupabaseConfigured()) {
    const internalId = req.internalUserId;
    if (internalId == null) {
      res.status(401).json({ error: "UNAUTHORIZED", message: "Missing auth context" });
      return;
    }
    const list = await listAreasForUser(internalId);
    res.json({ targets: list.map(toTargetPayload) });
    return;
  }

  res.json({ targets: listTargets().map(toTargetPayload) });
}

export async function postTarget(req: Request, res: Response): Promise<void> {
  const name = typeof req.body?.name === "string" ? req.body.name : "";
  const lat = Number(req.body?.lat);
  const lon = Number(req.body?.lon);
  if (!name.trim() || !Number.isFinite(lat) || !Number.isFinite(lon)) {
    res.status(400).json({
      error: "VALIDATION_ERROR",
      message: "Body requires `name` (string) and numeric `lat`, `lon`",
    });
    return;
  }

  if (isSupabaseConfigured()) {
    const internalId = req.internalUserId;
    if (internalId == null) {
      res.status(401).json({ error: "UNAUTHORIZED", message: "Missing auth context" });
      return;
    }
    const target = await insertArea(internalId, { name, lat, lon });
    res.status(201).json({ target: toTargetPayload(target) });
    return;
  }

  const target = createTarget({ name, lat, lon });
  res.status(201).json({ target: toTargetPayload(target) });
}

export async function removeTarget(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  if (!id) {
    res.status(400).json({ error: "VALIDATION_ERROR", message: "Missing id" });
    return;
  }

  if (isSupabaseConfigured()) {
    const internalId = req.internalUserId;
    if (internalId == null) {
      res.status(401).json({ error: "UNAUTHORIZED", message: "Missing auth context" });
      return;
    }
    const ok = await deleteAreaForUser(internalId, id);
    if (!ok) {
      res.status(404).json({ error: "NOT_FOUND", message: "Target not found" });
      return;
    }
    res.status(204).send();
    return;
  }

  const ok = deleteTarget(id);
  if (!ok) {
    res.status(404).json({ error: "NOT_FOUND", message: "Target not found" });
    return;
  }
  res.status(204).send();
}
