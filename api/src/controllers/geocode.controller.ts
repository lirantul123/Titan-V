import type { Request, Response } from "express";
import { reverseNominatim, searchNominatim } from "../services/nominatim.service.js";

export async function geocode(req: Request, res: Response): Promise<void> {
  const lat = Number(req.body?.lat);
  const lon = Number(req.body?.lon);
  if (Number.isFinite(lat) && Number.isFinite(lon)) {
    try {
      const hit = await reverseNominatim(lat, lon);
      res.json({ results: hit ? [hit] : [] });
    } catch {
      res.status(502).json({ error: "UPSTREAM_ERROR", message: "Geocoding service unavailable" });
    }
    return;
  }

  const q = typeof req.body?.q === "string" ? req.body.q : "";
  if (!q.trim()) {
    res.status(400).json({
      error: "VALIDATION_ERROR",
      message: "Body requires `q` (search) or numeric `lat` and `lon` (reverse)",
    });
    return;
  }

  try {
    const results = await searchNominatim(q);
    res.json({ results });
  } catch {
    res.status(502).json({ error: "UPSTREAM_ERROR", message: "Geocoding service unavailable" });
  }
}
