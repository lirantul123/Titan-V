# Supabase (Titan-V)

Your live schema (from your screenshots) is what the API targets:

## `public.users`

| Column | Type | Notes |
|--------|------|--------|
| `id` | `int8` | Primary key (bigint). |
| `created_at` | `timestamptz` | e.g. default `now()`. |
| `email` | `text` | |
| `full_name` | `text` | |
| **`auth_user_id`** | **`uuid`** | **Required for Titan-V + Supabase Auth.** Maps JWT `sub` → this row. Run migration below. |

## `public.areas`

| Column | Type | Notes |
|--------|------|--------|
| `id` | `int8` | Primary key. |
| `created_at` | `timestamptz` | |
| `name` | `text` | Display / registry name. |
| `user_id` | `int8` | FK → `public.users.id`. |
| `lat` | `float8` | |
| `lng` | `float8` | |
| `updated_at` | `timestamptz` | API sets on insert (optional on your side). |

## Migration you must apply

JWTs carry **`auth.users.id` (uuid)** while your app user key is **`int8`**. Add the bridge column once:

**File:** `migrations/20260215120000_users_auth_user_id.sql`

Run it **after** your `users` / `areas` tables exist, using either:

1. **SQL Editor** — paste the contents of `migrations/20260215120000_users_auth_user_id.sql` and run, or  
2. **CLI** (from repo root): `npx supabase@latest link` (pick your project once), then `npm run db:push` to apply all files under `supabase/migrations/`.

On first authenticated API call, the server **inserts** a `public.users` row with `auth_user_id` + email if none exists, then uses returned **`id`** as `areas.user_id`.

## Auth: email + password (app default)

### Where passwords live (do **not** add a password column to `public.users`)

- **Hashed passwords** live in Supabase **`auth.users`**. Your **`public.users`** row links with **`auth_user_id`** (uuid) — see `migrations/20260215120000_users_auth_user_id.sql`.
- The app uses **`signInWithPassword`** / **`signUp`** only; no Google or magic-link UI.

### Supabase dashboard (required for “no mail” register)

1. **Authentication → Providers → Email** — enable **Email** and **password**.
2. **Turn off email confirmation** (same screen or **Authentication** settings, wording varies): new users must get a **session immediately** without a Gmail link. Until this is off, Supabase may send confirmation mail and block sign-in.
3. **Authentication → URL configuration** — add **`http://localhost:5173/`** and **`http://localhost:5173/#/`** (and production URLs) under **Redirect URLs** if Supabase asks for them.

## Env

- **App:** `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (`app/.env.example`).
- **API:** `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` — when set, `/api/v1/targets` requires `Authorization: Bearer <access_token>` and reads/writes **`public.areas`** scoped by resolved **`users.id`**.

## RLS

You have RLS on `users`. The API uses the **service role** key, which **bypasses RLS** for server-side writes. Client-side direct table access should still use policies you define for the **anon** key if you ever query from the browser.
