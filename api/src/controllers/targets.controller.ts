import type { Request, Response } from "express";
import {
  createTarget,
  deleteTarget,
  listTargets,
} from "../repositories/targetRepository.js";

export function getTargets(_req: Request, res: Response): void {
  res.json({ targets: listTargets() });
}

export function postTarget(req: Request, res: Response): void {
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

  const target = createTarget({ name, lat, lon });
  res.status(201).json({ target });
}

export function removeTarget(req: Request, res: Response): void {
  const { id } = req.params;
  if (!id) {
    res.status(400).json({ error: "VALIDATION_ERROR", message: "Missing id" });
    return;
  }
  const ok = deleteTarget(id);
  if (!ok) {
    res.status(404).json({ error: "NOT_FOUND", message: "Target not found" });
    return;
  }
  res.status(204).send();
}
