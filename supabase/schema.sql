-- =============================================================================
-- Green Sun Technologies — database for the admin console (admin/) and the website
-- -----------------------------------------------------------------------------
-- Run this ONCE in Supabase → SQL Editor → New query → paste → Run. It is safe to run again.
--
-- What it sets up
--   gs_admins     the allow-list of accounts that may edit — nobody else can write
--   gs_products   the catalogue: one row per product, the product itself kept as JSON in `data`
--   gs_settings   the contact details shown on the site (key 'contact')
--   gs_messages   enquiries sent from the Contact page, read in the console's Enquiries page
--   gs-media      public storage bucket for product photos
--
-- Security model
--   • The website's public key can READ products and contact details (hidden products are never sent) and ADD an
--     enquiry, within tight limits. It cannot read, change or delete anything else, not even the enquiry it sent.
--   • Only signed-in users listed in gs_admins can change products, details and photos, and read enquiries.
--   • Flood guard: at most 5 enquiries an hour from one phone number and 40 an hour in all.
-- =============================================================================


-- ----------------------------------------------------------------- admins
create table if not exists public.gs_admins (
  user_id  uuid primary key references auth.users (id) on delete cascade,
  email    text,
  added_at timestamptz not null default now()
);
alter table public.gs_admins enable row level security;

-- (security definer: it may read gs_admins even though clients cannot)
create or replace function public.gs_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.gs_admins where user_id = auth.uid());
$$;
revoke all on function public.gs_is_admin() from public;
grant execute on function public.gs_is_admin() to anon, authenticated;

drop policy if exists "gs_admins: read own row" on public.gs_admins;
create policy "gs_admins: read own row" on public.gs_admins for select to authenticated using (user_id = auth.uid());
revoke all on public.gs_admins from anon, authenticated;
grant select on public.gs_admins to authenticated;


-- keeps updated_at honest whatever the browser sends
create or replace function public.gs_touch()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;


-- --------------------------------------------------------------- products
create table if not exists public.gs_products (
  id         text primary key check (id ~ '^[a-z0-9][a-z0-9-]{0,63}$'),
  sort       integer not null default 0,
  hidden     boolean not null default false,
  data       jsonb not null check (jsonb_typeof(data) = 'object' and char_length(data::text) < 60000),
  updated_at timestamptz not null default now(),
  updated_by text
);
create index if not exists gs_products_sort_idx on public.gs_products (sort, id);
alter table public.gs_products enable row level security;

drop trigger if exists gs_products_touch on public.gs_products;
create trigger gs_products_touch before insert or update on public.gs_products
  for each row execute function public.gs_touch();

drop policy if exists "gs_products: public can read visible" on public.gs_products;
drop policy if exists "gs_products: admins can insert"        on public.gs_products;
drop policy if exists "gs_products: admins can update"        on public.gs_products;
drop policy if exists "gs_products: admins can delete"        on public.gs_products;
create policy "gs_products: public can read visible" on public.gs_products for select to anon, authenticated using (not hidden or public.gs_is_admin());
create policy "gs_products: admins can insert" on public.gs_products for insert to authenticated with check (public.gs_is_admin());
create policy "gs_products: admins can update" on public.gs_products for update to authenticated using (public.gs_is_admin()) with check (public.gs_is_admin());
create policy "gs_products: admins can delete" on public.gs_products for delete to authenticated using (public.gs_is_admin());
revoke all on public.gs_products from anon, authenticated;
grant select on public.gs_products to anon, authenticated;
grant insert, update, delete on public.gs_products to authenticated;


-- --------------------------------------------------------------- settings
create table if not exists public.gs_settings (
  key        text primary key check (key in ('contact')),
  data       jsonb not null check (jsonb_typeof(data) = 'object' and char_length(data::text) < 20000),
  updated_at timestamptz not null default now(),
  updated_by text
);
alter table public.gs_settings enable row level security;

drop trigger if exists gs_settings_touch on public.gs_settings;
create trigger gs_settings_touch before insert or update on public.gs_settings
  for each row execute function public.gs_touch();

drop policy if exists "gs_settings: public can read"    on public.gs_settings;
drop policy if exists "gs_settings: admins can insert"  on public.gs_settings;
drop policy if exists "gs_settings: admins can update"  on public.gs_settings;
create policy "gs_settings: public can read" on public.gs_settings for select to anon, authenticated using (true);
create policy "gs_settings: admins can insert" on public.gs_settings for insert to authenticated with check (public.gs_is_admin());
create policy "gs_settings: admins can update" on public.gs_settings for update to authenticated using (public.gs_is_admin()) with check (public.gs_is_admin());
revoke all on public.gs_settings from anon, authenticated;
grant select on public.gs_settings to anon, authenticated;
grant insert, update on public.gs_settings to authenticated;


-- --------------------------------------------------------------- enquiries
create table if not exists public.gs_messages (
  id       uuid primary key default gen_random_uuid(),
  at       timestamptz not null default now(),
  name     text not null check (char_length(btrim(name)) between 1 and 120),
  phone    text not null check (char_length(btrim(phone)) between 3 and 40),
  email    text check (email is null or (char_length(email) between 3 and 200 and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$')),
  org      text check (char_length(org) <= 200),
  site     text check (char_length(site) <= 200),
  message  text check (char_length(message) <= 5000),
  products jsonb not null default '[]' check (jsonb_typeof(products) = 'array' and jsonb_array_length(products) <= 50 and char_length(products::text) < 8000),
  status   text not null default 'new' check (status in ('new', 'read', 'replied', 'archived')),
  starred  boolean not null default false
);
create index if not exists gs_messages_at_idx on public.gs_messages (at desc);
alter table public.gs_messages enable row level security;

drop policy if exists "gs_messages: anyone can send"   on public.gs_messages;
drop policy if exists "gs_messages: admins can read"   on public.gs_messages;
drop policy if exists "gs_messages: admins can update" on public.gs_messages;
drop policy if exists "gs_messages: admins can delete" on public.gs_messages;
create policy "gs_messages: anyone can send" on public.gs_messages
  for insert to anon, authenticated
  with check (status = 'new' and starred = false and at between now() - interval '2 minutes' and now() + interval '2 minutes');
create policy "gs_messages: admins can read"   on public.gs_messages for select to authenticated using (public.gs_is_admin());
create policy "gs_messages: admins can update" on public.gs_messages for update to authenticated using (public.gs_is_admin()) with check (public.gs_is_admin());
create policy "gs_messages: admins can delete" on public.gs_messages for delete to authenticated using (public.gs_is_admin());
revoke all on public.gs_messages from anon, authenticated;
grant insert on public.gs_messages to anon, authenticated;
grant select, update, delete on public.gs_messages to authenticated;

-- flood guard (security definer: it may count rows the sender cannot see)
create or replace function public.gs_messages_flood_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (select count(*) from public.gs_messages where phone = new.phone and at > now() - interval '1 hour') >= 5
     or (select count(*) from public.gs_messages where at > now() - interval '1 hour') >= 40 then
    raise exception 'Too many enquiries right now — please try again later, or call us directly.'
      using errcode = 'P0001';
  end if;
  new.at := now();                       -- the server's clock, whatever the browser sent
  return new;
end;
$$;
revoke all on function public.gs_messages_flood_guard() from public;

drop trigger if exists gs_messages_flood_guard on public.gs_messages;
create trigger gs_messages_flood_guard before insert on public.gs_messages
  for each row execute function public.gs_messages_flood_guard();


-- ------------------------------------------------------------- photo storage
-- public bucket: anyone can VIEW a photo by its link (the website needs that);
-- only admins can upload, replace, list or delete. 3 MB per file, images only (no SVG: it can carry scripts).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('gs-media', 'gs-media', true, 3145728, array['image/jpeg', 'image/png', 'image/webp', 'image/avif'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "gs-media: admins can list"   on storage.objects;
drop policy if exists "gs-media: admins can upload" on storage.objects;
drop policy if exists "gs-media: admins can update" on storage.objects;
drop policy if exists "gs-media: admins can delete" on storage.objects;
create policy "gs-media: admins can list"   on storage.objects for select to authenticated using (bucket_id = 'gs-media' and public.gs_is_admin());
create policy "gs-media: admins can upload" on storage.objects for insert to authenticated with check (bucket_id = 'gs-media' and public.gs_is_admin());
create policy "gs-media: admins can update" on storage.objects for update to authenticated using (bucket_id = 'gs-media' and public.gs_is_admin());
create policy "gs-media: admins can delete" on storage.objects for delete to authenticated using (bucket_id = 'gs-media' and public.gs_is_admin());


-- =============================================================================
-- LAST STEP — make your account an admin
-- 1. Supabase → Authentication → Sign In / Providers → Email: turn OFF "Allow new users to sign up".
-- 2. Authentication → Users → "Add user" → "Create new user" (email + a strong password, tick "Auto Confirm User").
-- 3. Put that email below, select just these two lines and Run:
--
--    insert into public.gs_admins (user_id, email)
--    select id, email from auth.users where email = 'owner@example.com';
--
-- To remove someone later:   delete from public.gs_admins where email = 'them@example.com';
-- To see who is an admin:    select * from public.gs_admins;
--
-- The catalogue itself needs no SQL: sign in to the console and press "Import the catalogue" on the dashboard.
-- =============================================================================
