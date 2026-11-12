-- =============================================================================
-- Module 3: profiles, roles and Row Level Security
--
-- Security model (ARCHITECTURE_AND_DATA_MODEL.md §2, §5):
--   * Every auth user gets exactly one profile, created server-side by trigger.
--   * New profiles are ALWAYS role 'client'. The role is never read from
--     user-supplied metadata, so nobody can self-assign admin.
--   * Clients can read only their own profile and can edit only full_name/phone.
--   * role / status / email changes are not grantable to API users at all;
--     admin role changes will go through audited SECURITY DEFINER functions.
--   * The last active admin can never be demoted or deactivated.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------
create type public.app_role as enum ('admin', 'client');
create type public.profile_status as enum ('active', 'inactive');

-- ---------------------------------------------------------------------------
-- Shared trigger: maintain updated_at
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete restrict,
  full_name   text not null default '' check (char_length(full_name) <= 120),
  email       text not null check (char_length(email) <= 320),
  phone       text check (phone is null or phone ~ '^\+?[0-9 ()-]{7,20}$'),
  role        public.app_role not null default 'client',
  status      public.profile_status not null default 'active',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.profiles is
  'One row per auth user. role/status are admin-controlled; clients may edit only full_name and phone.';
comment on column public.profiles.id is
  'Same as auth.users.id. ON DELETE RESTRICT: deactivate users instead of deleting them (audit trail).';

create unique index profiles_email_lower_key on public.profiles (lower(email));
create index profiles_role_status_idx on public.profiles (role, status);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Role helper used by RLS policies across the schema.
-- SECURITY DEFINER so it can read profiles without recursing through RLS.
-- ---------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.role = 'admin'
      and p.status = 'active'
  );
$$;

comment on function public.is_admin() is
  'True when the calling user is an active admin. Use in RLS policies as (select public.is_admin()).';

revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

-- ---------------------------------------------------------------------------
-- Guard: never leave the system without an active admin.
-- ---------------------------------------------------------------------------
create or replace function public.protect_last_admin()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.role = 'admin' and old.status = 'active'
     and (new.role <> 'admin' or new.status <> 'active') then
    if not exists (
      select 1 from public.profiles p
      where p.id <> old.id and p.role = 'admin' and p.status = 'active'
    ) then
      raise exception 'Cannot demote or deactivate the last active admin.'
        using errcode = 'check_violation';
    end if;
  end if;
  return new;
end;
$$;

revoke all on function public.protect_last_admin() from public, anon, authenticated;

create trigger profiles_protect_last_admin
  before update of role, status on public.profiles
  for each row execute function public.protect_last_admin();

-- ---------------------------------------------------------------------------
-- Create a profile for every new auth user (role is ALWAYS 'client').
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    coalesce(new.email, ''),
    left(coalesce(nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''), ''), 120)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke all on function public.handle_new_auth_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- Keep profiles.email in sync when the auth email changes.
create or replace function public.handle_auth_user_email_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.email is distinct from old.email then
    update public.profiles set email = coalesce(new.email, '') where id = new.id;
  end if;
  return new;
end;
$$;

revoke all on function public.handle_auth_user_email_change() from public, anon, authenticated;

create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row execute function public.handle_auth_user_email_change();

-- Backfill profiles for users that already exist (created before this migration).
insert into public.profiles (id, email)
select u.id, coalesce(u.email, '')
from auth.users u
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Privileges: least privilege, column-level for updates.
-- ---------------------------------------------------------------------------
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant update (full_name, phone) on public.profiles to authenticated;
-- No INSERT/DELETE for API users: profiles are created by trigger and never deleted.

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;

create policy profiles_select_own
  on public.profiles for select to authenticated
  using (id = (select auth.uid()));

create policy profiles_select_admin
  on public.profiles for select to authenticated
  using ((select public.is_admin()));

create policy profiles_update_own
  on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

create policy profiles_update_admin
  on public.profiles for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));
