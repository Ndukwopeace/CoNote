-- Test-only stand-ins for what a real Supabase project already provides: the auth schema, the three
-- API roles and auth.uid(). Never applied to a real project.

-- The API roles. service_role skips Row Level Security, as on Supabase.
do $$ begin
  if not exists (select from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end $$;

-- Logins, with the two metadata columns the sign-up trigger reads.
create schema if not exists auth;
create table auth.users (
  id uuid primary key,
  email text,
  raw_app_meta_data jsonb not null default '{}'::jsonb,
  raw_user_meta_data jsonb not null default '{}'::jsonb
);

-- The caller's ID, read the way Supabase reads it: from the request's JWT claims.
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
grant usage on schema auth to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;

-- The server role writes freely (bypassing RLS), as Edge Functions do.
alter default privileges in schema public grant all on tables to service_role;

-- pgcrypto, in the schema Supabase puts extensions in, for the seed's password hashing.
create schema if not exists extensions;
create extension if not exists pgcrypto schema extensions;
-- auth.users columns the seed fills in, as on Supabase.
alter table auth.users
  add column instance_id uuid, add column aud text, add column role text,
  add column encrypted_password text, add column email_confirmed_at timestamptz,
  add column created_at timestamptz, add column updated_at timestamptz,
  add column confirmation_token text, add column recovery_token text,
  add column email_change_token_new text, add column email_change text,
  add column email_change_token_current text, add column reauthentication_token text,
  add column phone_change text, add column phone_change_token text,
  add column last_sign_in_at timestamptz;
-- The identities table the seed fills in, with the columns the seed uses.
create table auth.identities (
  provider_id text not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  identity_data jsonb not null,
  provider text not null,
  last_sign_in_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz
);
