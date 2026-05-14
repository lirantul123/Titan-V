import type { NextFunction, Request, Response } from "express";
import { getOrCreateInternalUserId, isSupabaseConfigured, verifyBearerJwt } from "../lib/supabaseAdmin.js";

export function requireSupabaseUser(req: Request, res: Response, next: NextFunction): void {
  void (async () => {
    try {
      const raw = req.headers.authorization;
      if (!isSupabaseConfigured()) {
        const hasBearer = Boolean(raw?.startsWith("Bearer ") && raw.slice("Bearer ".length).trim());
        if (hasBearer) {
          res.status(503).json({
            error: "API_NOT_CONFIGURED_FOR_AUTH",
            message:
              "This API has no Supabase server keys, so it cannot scope the registry per user. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY on the API (same project as the app).",
          });
          return;
        }
        next();
        return;
      }

      if (!raw?.startsWith("Bearer ")) {
        res.status(401).json({ error: "UNAUTHORIZED", message: "Authorization: Bearer <access_token> required" });
        return;
      }

      const jwt = raw.slice("Bearer ".length).trim();
      if (!jwt) {
        res.status(401).json({ error: "UNAUTHORIZED", message: "Empty bearer token" });
        return;
      }

      const user = await verifyBearerJwt(jwt);
      if (!user) {
        res.status(401).json({ error: "UNAUTHORIZED", message: "Invalid or expired session" });
        return;
      }

      req.authUser = user;
      try {
        req.internalUserId = await getOrCreateInternalUserId(user);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "User resolution failed";
        res.status(500).json({
          error: "USER_SYNC_FAILED",
          message: msg,
          hint: "Add column public.users.auth_user_id uuid (see supabase/migrations/20260215120000_users_auth_user_id.sql)",
        });
        return;
      }

      next();
    } catch (err) {
      next(err);
    }
  })();
}
