import type { Request, Response } from "express";
import { fetchCurrentWeather } from "../services/openMeteo.service.js";

export async function weather(req: Request, res: Response): Promise<void> {
  const lat = Number(req.query.lat);
  const lon = Number(req.query.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    res.status(400).json({ error: "VALIDATION_ERROR", message: "Query params `lat` and `lon` must be numbers" });
    return;
  }

  try {
    const current = await fetchCurrentWeather(lat, lon);
    if (!current) {
      res.status(404).json({ error: "NOT_FOUND", message: "No current weather payload" });
      return;
    }
    res.json({ current_weather: current });
  } catch {
    res.status(502).json({ error: "UPSTREAM_ERROR", message: "Weather service unavailable" });
  }
}
