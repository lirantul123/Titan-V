import type { Request, Response } from "express";

export function ping(_req: Request, res: Response): void {
  res.json({
    ok: true,
    serverTime: new Date().toISOString(),
    message: "MS_SYNC_OK",
  });
}
