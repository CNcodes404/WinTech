-- =============================================================================
-- Module 4: append-only audit log, audited profile changes, admin role/status
-- functions, and audited account creation.
--
-- Principles (README §3 Auditability, BUSINESS_LOGIC §10):
--   * audit_logs is append-only: no UPDATE/DELETE/TRUNCATE for anyone via
--     triggers, and API users cannot INSERT directly.
--   * Audit rows are written in the SAME transaction as the change they
--     describe (triggers / SECURITY DEFINER functions), so they cannot drift.
--   * Only admins can read the audit log.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- audit_logs
-- ---------------------------------------------------------------------------
create table public.audit_logs (
  id           uuid primary key default gen_random_uuid(),
  seq          bigint generated always as identity unique,
  actor_id     uuid references public.profiles (id) on delete restrict,
  action       text not null check (action ~ '^[a-z][a-z_]*\.[a-z][a-z_]*$'),
  entity_type  text not null check (entity_type ~ '^[a-z][a-z_]*$'),
  entity_id    uuid,
  before_data  jsonb,
  after_data   jsonb,
  reason       text check (reason is null or char_length(reason) between 1 and 1000),
  created_at   timestamptz not null default now()
);

comment on table public.audit_logs is
  'Append-only audit trail. actor_id NULL = system / project owner action. Ordered by seq.';

create index audit_logs_entity_idx on public.audit_logs (entity_type, entity_id, seq desc);
create index audit_logs_actor_idx on public.audit_logs (actor_id, seq desc);
create index audit_logs_created_idx on public.audit_logs (created_at desc);

-- Append-only enforcement (applies to every role, including the table owner).
create or replace function private.reject_audit_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'audit_logs is append-only (% is not allowed).', tg_op
    using errcode = 'insufficient_privilege';
end;
$$;

revoke all on function private.reject_audit_mutation() from public, anon, authenticated;

create trigger audit_logs_no_update_delete
  before update or delete on public.audit_logs
  for each row execute function private.reject_audit_mutation();

create trigger audit_logs_no_truncate
  before truncate on public.audit_logs
  for each statement execute function private.reject_audit_mutation();

revoke all on public.audit_logs from anon, authenticated;
grant select on public.audit_logs to authenticated;

alter table public.audit_logs enable row level security;

create policy audit_logs_select_admin
  on public.audit_logs for select to authenticated
  using ((select private.is_admin()));

-- ---------------------------------------------------------------------------
-- Internal writer. Not executable by API roles; called from SECURITY DEFINER
-- functions and triggers only.
-- ---------------------------------------------------------------------------
create or replace function private.write_audit(
  p_action      text,
  p_entity_type text,
  p_entity_id   uuid,
  p_before      jsonb,
  p_after       jsonb,
  p_reason      text default null,
  p_actor_id    uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_actor uuid := coalesce(p_actor_id, (select auth.uid()));
begin
  -- Only reference actors that have a profile (service-role calls have no auth.uid()).
  if v_actor is not null and not exists (select 1 from public.profiles where id = v_actor) then
    v_actor := null;
  end if;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, before_data, after_data, reason)
  values (
    v_actor, p_action, p_entity_type, p_entity_id, p_before, p_after,
    nullif(btrim(coalesce(p_reason, nullif(current_setting('app.audit_reason', true), ''))), '')
  )
  returning id into v_id;
  return v_id;
end;
$$;

revoke all on function private.write_audit(text, text, uuid, jsonb, jsonb, text, uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Audit every profile change (who changed what, from/to).
-- A reason can be attached by the caller via set_config('app.audit_reason', …, true).
-- ---------------------------------------------------------------------------
create or replace function private.audit_profile_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_before jsonb := '{}'::jsonb;
  v_after  jsonb := '{}'::jsonb;
  v_action text := 'profile.updated';
begin
  if new.full_name is distinct from old.full_name then
    v_before := v_before || jsonb_build_object('full_name', old.full_name);
    v_after  := v_after  || jsonb_build_object('full_name', new.full_name);
  end if;
  if new.phone is distinct from old.phone then
    v_before := v_before || jsonb_build_object('phone', old.phone);
    v_after  := v_after  || jsonb_build_object('phone', new.phone);
  end if;
  if new.email is distinct from old.email then
    v_before := v_before || jsonb_build_object('email', old.email);
    v_after  := v_after  || jsonb_build_object('email', new.email);
  end if;
  if new.status is distinct from old.status then
    v_before := v_before || jsonb_build_object('status', old.status);
    v_after  := v_after  || jsonb_build_object('status', new.status);
    v_action := 'profile.status_changed';
  end if;
  if new.role is distinct from old.role then
    v_before := v_before || jsonb_build_object('role', old.role);
    v_after  := v_after  || jsonb_build_object('role', new.role);
    v_action := 'profile.role_changed';
  end if;

  if v_after <> '{}'::jsonb then
    perform private.write_audit(v_action, 'profile', new.id, v_before, v_after);
  end if;
  return new;
end;
$$;

revoke all on function private.audit_profile_update() from public, anon, authenticated;

create trigger profiles_audit_update
  after update on public.profiles
  for each row execute function private.audit_profile_update();

-- ---------------------------------------------------------------------------
-- New auth users: create profile (always 'client'), copy validated contact
-- details, and audit the creation. The creating admin is taken from
-- raw_app_meta_data.created_by, which only the service role can set.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_full_name text := left(coalesce(nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''), ''), 120);
  v_phone     text := nullif(btrim(new.raw_user_meta_data ->> 'phone'), '');
  v_creator   text := new.raw_app_meta_data ->> 'created_by';
  v_actor     uuid;
begin
  if v_phone is not null and v_phone !~ '^\+?[0-9 ()-]{7,20}$' then
    v_phone := null;
  end if;
  if v_creator ~ '^[0-9a-fA-F-]{36}$' then
    v_actor := v_creator::uuid;
  end if;

  insert into public.profiles (id, email, full_name, phone)
  values (new.id, coalesce(new.email, ''), v_full_name, v_phone)
  on conflict (id) do nothing;

  if found then
    perform private.write_audit(
      'profile.created', 'profile', new.id, null,
      jsonb_build_object('email', coalesce(new.email, ''), 'full_name', v_full_name, 'phone', v_phone, 'role', 'client'),
      null, v_actor
    );
  end if;
  return new;
end;
$$;

revoke all on function public.handle_new_auth_user() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Admin API: change a user's role / status with a mandatory reason.
-- These are deliberately callable by signed-in users; they authorize inside.
-- ---------------------------------------------------------------------------
create or replace function public.admin_set_user_role(
  p_user_id uuid,
  p_role    public.app_role,
  p_reason  text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_admin() then
    raise exception 'Only administrators can change roles.' using errcode = 'insufficient_privilege';
  end if;
  if p_user_id = (select auth.uid()) then
    raise exception 'You cannot change your own role.' using errcode = 'check_violation';
  end if;
  if char_length(btrim(coalesce(p_reason, ''))) < 5 then
    raise exception 'A reason of at least 5 characters is required.' using errcode = 'invalid_parameter_value';
  end if;

  perform set_config('app.audit_reason', btrim(p_reason), true);
  update public.profiles set role = p_role where id = p_user_id;
  if not found then
    raise exception 'User not found.' using errcode = 'no_data_found';
  end if;
end;
$$;

revoke all on function public.admin_set_user_role(uuid, public.app_role, text) from public, anon;
grant execute on function public.admin_set_user_role(uuid, public.app_role, text) to authenticated;

create or replace function public.admin_set_user_status(
  p_user_id uuid,
  p_status  public.profile_status,
  p_reason  text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_admin() then
    raise exception 'Only administrators can change account status.' using errcode = 'insufficient_privilege';
  end if;
  if p_user_id = (select auth.uid()) then
    raise exception 'You cannot change your own account status.' using errcode = 'check_violation';
  end if;
  if char_length(btrim(coalesce(p_reason, ''))) < 5 then
    raise exception 'A reason of at least 5 characters is required.' using errcode = 'invalid_parameter_value';
  end if;

  perform set_config('app.audit_reason', btrim(p_reason), true);
  update public.profiles set status = p_status where id = p_user_id;
  if not found then
    raise exception 'User not found.' using errcode = 'no_data_found';
  end if;
end;
$$;

revoke all on function public.admin_set_user_status(uuid, public.profile_status, text) from public, anon;
grant execute on function public.admin_set_user_status(uuid, public.profile_status, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Backfill: record the bootstrap promotion done before the audit log existed.
-- ---------------------------------------------------------------------------
insert into public.audit_logs (actor_id, action, entity_type, entity_id, before_data, after_data, reason)
select
  null, 'profile.role_changed', 'profile', p.id,
  jsonb_build_object('role', 'client'), jsonb_build_object('role', 'admin'),
  'Bootstrap: first administrator promoted by the project owner via Supabase CLI on 2026-11-12 (recorded retroactively).'
from public.profiles p
where p.role = 'admin';
