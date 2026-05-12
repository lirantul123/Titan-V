import type { Request, Response } from "express";
import { searchNominatim } from "../services/nominatim.service.js";

export async function geocode(req: Request, res: Response): Promise<void> {
  const q = typeof req.body?.q === "string" ? req.body.q : "";
  if (!q.trim()) {
    res.status(400).json({ error: "VALIDATION_ERROR", message: "Field `q` is required" });
    return;
  }

  try {
    const results = await searchNominatim(q);
    res.json({ results });
  } catch {
    res.status(502).json({ error: "UPSTREAM_ERROR", message: "Geocoding service unavailable" });
  }
}
