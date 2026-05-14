-- Maps Supabase Auth (JWT `sub` = auth.users.id) to your int8 `public.users.id`
-- Run in SQL Editor if this column is not already in your table.

alter table public.users
  add column if not exists auth_user_id uuid references auth.users (id) on delete set null;

create unique index if not exists users_auth_user_id_unique
  on public.users (auth_user_id)
  where auth_user_id is not null;

comment on column public.users.auth_user_id is 'Supabase Auth user id; API resolves JWT to public.users.id via this column.';
