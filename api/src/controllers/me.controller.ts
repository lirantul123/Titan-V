import type { Request, Response } from "express";
import { isSupabaseConfigured, verifyBearerJwt } from "../lib/supabaseAdmin.js";
import { asyncHandler } from "../middleware/asyncHandler.js";

export const getMe = asyncHandler(async (req: Request, res: Response) => {
  if (!isSupabaseConfigured()) {
    res.status(501).json({
      error: "NOT_CONFIGURED",
      message: "Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY on the API to enable /me",
    });
    return;
  }

  const raw = req.headers.authorization;
  if (!raw?.startsWith("Bearer ")) {
    res.status(401).json({ error: "UNAUTHORIZED", message: "Bearer token required" });
    return;
  }

  const jwt = raw.slice("Bearer ".length).trim();
  const user = await verifyBearerJwt(jwt);
  if (!user) {
    res.status(401).json({ error: "UNAUTHORIZED", message: "Invalid or expired session" });
    return;
  }

  res.json({ user: { id: user.id, email: user.email ?? null } });
});
