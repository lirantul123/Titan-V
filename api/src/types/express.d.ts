import type { AuthJwtUser } from "../lib/supabaseAdmin.js";

declare global {
  namespace Express {
    interface Request {
      /** Supabase Auth identity (JWT `sub`) when Supabase is configured */
      authUser?: AuthJwtUser;
      /** `public.users.id` (int8) after resolving `auth_user_id` */
      internalUserId?: number;
    }
  }
}

export {};
