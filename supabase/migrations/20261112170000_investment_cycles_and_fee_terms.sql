-- =============================================================================
-- Module 6: investment cycles and versioned performance-fee terms
--
-- Decisions (docs/DECISIONS.md):
--   C  Fee rates live in a versioned, effective-dated cycle_fee_terms table.
--      Each contribution lot will lock the rate in force when it is issued
--      (Module 7), so later changes never rewrite history.
--   *  Fee terms are append-only. A not-yet-effective version may be cancelled
--      (recorded, never deleted). Effective versions are immutable.
--   *  Cycle status moves forward one step at a time:
--        draft → open → active → closed → settled   (settled = informational)
--   *  base_nav is editable only in draft; dates only in draft/open.
--   *  All writes go through admin-only SECURITY DEFINER functions and are
--      audited in the same transaction. API users have SELECT only.
-- =============================================================================

create type public.cycle_status as enum ('draft', 'open', 'active', 'closed', 'settled');

-- ---------------------------------------------------------------------------
-- investment_cycles
-- ---------------------------------------------------------------------------
create table public.investment_cycles (
  id           uuid primary key default gen_random_uuid(),
  name         text not null check (char_length(btrim(name)) between 3 and 120),
  description  text check (description is null or char_length(description) <= 2000),
  start_date   date not null,
  end_date     date not null,
  status       public.cycle_status not null default 'draft',
  base_nav     numeric(20, 8) not null default 100 check (base_nav > 0),
  currency     char(3) not null default 'INR' check (currency = 'INR'),
  created_by   uuid not null references public.profiles (id) on delete restrict,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint investment_cycles_dates_check check (end_date > start_date)
);

comment on table public.investment_cycles is
  'Investment windows. Fee rates are NOT stored here; see cycle_fee_terms (versioned).';

create unique index investment_cycles_name_key on public.investment_cycles (lower(btrim(name)));
create index investment_cycles_status_idx on public.investment_cycles (status, start_date desc);

create trigger investment_cycles_set_updated_at
  before update on public.investment_cycles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- cycle_fee_terms (append-only versions)
-- ---------------------------------------------------------------------------
create table public.cycle_fee_terms (
  id                    uuid primary key default gen_random_uuid(),
  cycle_id              uuid not null references public.investment_cycles (id) on delete restrict,
  version               integer not null check (version >= 1),
  performance_fee_rate  numeric(8, 6) not null check (performance_fee_rate >= 0 and performance_fee_rate < 1),
  fee_policy            text not null default 'per_lot_hwm_v1' check (fee_policy in ('per_lot_hwm_v1')),
  effective_from        timestamptz not null,
  reason                text not null check (char_length(btrim(reason)) between 5 and 1000),
  created_by            uuid not null references public.profiles (id) on delete restrict,
  created_at            timestamptz not null default now(),
  cancelled_at          timestamptz,
  cancelled_by          uuid references public.profiles (id) on delete restrict,
  cancel_reason         text check (cancel_reason is null or char_length(btrim(cancel_reason)) between 5 and 1000),
  constraint cycle_fee_terms_version_key unique (cycle_id, version),
  constraint cycle_fee_terms_cancel_consistency check (
    (cancelled_at is null and cancelled_by is null and cancel_reason is null)
    or (cancelled_at is not null and cancelled_by is not null and cancel_reason is not null)
  )
);

comment on table public.cycle_fee_terms is
  'Versioned performance-fee terms per cycle. Append-only; future versions may be cancelled, never edited.';
comment on column public.cycle_fee_terms.performance_fee_rate is 'Fraction, e.g. 0.200000 = 20%.';

-- At most one non-cancelled version per effective instant.
create unique index cycle_fee_terms_effective_key
  on public.cycle_fee_terms (cycle_id, effective_from) where cancelled_at is null;
create index cycle_fee_terms_lookup_idx
  on public.cycle_fee_terms (cycle_id, effective_from desc) where cancelled_at is null;

-- ---------------------------------------------------------------------------
-- Guards (defence in depth; apply to every role including the owner)
-- ---------------------------------------------------------------------------
create or replace function private.guard_cycle_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.id <> old.id or new.created_by <> old.created_by or new.created_at <> old.created_at
     or new.currency <> old.currency then
    raise exception 'Immutable cycle fields cannot be changed.' using errcode = 'check_violation';
  end if;

  if new.status <> old.status and not (
       (old.status = 'draft'  and new.status = 'open')
    or (old.status = 'open'   and new.status = 'active')
    or (old.status = 'active' and new.status = 'closed')
    or (old.status = 'closed' and new.status = 'settled')
  ) then
    raise exception 'A cycle cannot move from % to %.', old.status, new.status using errcode = 'check_violation';
  end if;

  if new.base_nav <> old.base_nav and old.status <> 'draft' then
    raise exception 'Base NAV can only be changed while the cycle is a draft.' using errcode = 'check_violation';
  end if;

  if (new.start_date <> old.start_date or new.end_date <> old.end_date)
     and old.status not in ('draft', 'open') then
    raise exception 'Dates can only be changed while the cycle is draft or open.' using errcode = 'check_violation';
  end if;

  if old.status in ('closed', 'settled')
     and (new.name <> old.name or new.description is distinct from old.description) then
    raise exception 'A closed cycle cannot be edited.' using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

revoke all on function private.guard_cycle_update() from public, anon, authenticated;

create trigger investment_cycles_guard_update
  before update on public.investment_cycles
  for each row execute function private.guard_cycle_update();

-- Generic guard: financial/master records are never deleted (deactivate / supersede instead).
create or replace function private.reject_delete()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception '% records cannot be deleted (% is not allowed).', tg_table_name, tg_op
    using errcode = 'insufficient_privilege';
end;
$$;

revoke all on function private.reject_delete() from public, anon, authenticated;

create trigger investment_cycles_no_delete
  before delete on public.investment_cycles
  for each row execute function private.reject_delete();

create or replace function private.guard_fee_terms_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- The only permitted change: cancelling a version that is not yet effective.
  if old.cancelled_at is null
     and new.cancelled_at is not null
     and old.effective_from > now()
     and new.id = old.id and new.cycle_id = old.cycle_id and new.version = old.version
     and new.performance_fee_rate = old.performance_fee_rate and new.fee_policy = old.fee_policy
     and new.effective_from = old.effective_from and new.reason = old.reason
     and new.created_by = old.created_by and new.created_at = old.created_at then
    return new;
  end if;
  raise exception 'Fee terms are immutable. Add a new version instead.' using errcode = 'insufficient_privilege';
end;
$$;

revoke all on function private.guard_fee_terms_update() from public, anon, authenticated;

create trigger cycle_fee_terms_guard_update
  before update on public.cycle_fee_terms
  for each row execute function private.guard_fee_terms_update();

create trigger cycle_fee_terms_no_delete
  before delete on public.cycle_fee_terms
  for each row execute function private.reject_delete();

create trigger cycle_fee_terms_no_truncate
  before truncate on public.cycle_fee_terms
  for each statement execute function private.reject_delete();

-- ---------------------------------------------------------------------------
-- Audit cycle changes (reason via app.audit_reason)
-- ---------------------------------------------------------------------------
create or replace function private.audit_cycle_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_before jsonb := '{}'::jsonb;
  v_after  jsonb := '{}'::jsonb;
  v_action text := 'cycle.updated';
begin
  if new.name is distinct from old.name then
    v_before := v_before || jsonb_build_object('name', old.name);
    v_after  := v_after  || jsonb_build_object('name', new.name);
  end if;
  if new.description is distinct from old.description then
    v_before := v_before || jsonb_build_object('description', old.description);
    v_after  := v_after  || jsonb_build_object('description', new.description);
  end if;
  if new.start_date is distinct from old.start_date then
    v_before := v_before || jsonb_build_object('start_date', old.start_date);
    v_after  := v_after  || jsonb_build_object('start_date', new.start_date);
  end if;
  if new.end_date is distinct from old.end_date then
    v_before := v_before || jsonb_build_object('end_date', old.end_date);
    v_after  := v_after  || jsonb_build_object('end_date', new.end_date);
  end if;
  if new.base_nav is distinct from old.base_nav then
    v_before := v_before || jsonb_build_object('base_nav', old.base_nav::text);
    v_after  := v_after  || jsonb_build_object('base_nav', new.base_nav::text);
  end if;
  if new.status is distinct from old.status then
    v_before := v_before || jsonb_build_object('status', old.status);
    v_after  := v_after  || jsonb_build_object('status', new.status);
    v_action := 'cycle.status_changed';
  end if;

  if v_after <> '{}'::jsonb then
    perform private.write_audit(v_action, 'cycle', new.id, v_before, v_after);
  end if;
  return new;
end;
$$;

revoke all on function private.audit_cycle_update() from public, anon, authenticated;

create trigger investment_cycles_audit_update
  after update on public.investment_cycles
  for each row execute function private.audit_cycle_update();

-- ---------------------------------------------------------------------------
-- Fee-rate lookup (used by unit issuance in Module 7)
-- ---------------------------------------------------------------------------
create or replace function private.fee_terms_at(p_cycle_id uuid, p_at timestamptz)
returns public.cycle_fee_terms
language sql
stable
security definer
set search_path = ''
as $$
  select t.*
  from public.cycle_fee_terms t
  where t.cycle_id = p_cycle_id
    and t.cancelled_at is null
    and t.effective_from <= p_at
  order by t.effective_from desc
  limit 1;
$$;

revoke all on function private.fee_terms_at(uuid, timestamptz) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Read model for lists: current and next scheduled fee rate per cycle.
-- security_invoker → RLS of the underlying tables applies to the caller.
-- ---------------------------------------------------------------------------
create view public.cycle_overview
with (security_invoker = true)
as
select
  c.id, c.name, c.description, c.start_date, c.end_date, c.status, c.base_nav, c.currency,
  c.created_by, c.created_at, c.updated_at,
  cur.performance_fee_rate as current_fee_rate,
  cur.version              as current_fee_version,
  cur.effective_from       as current_fee_effective_from,
  nxt.performance_fee_rate as pending_fee_rate,
  nxt.version              as pending_fee_version,
  nxt.effective_from       as pending_fee_effective_from
from public.investment_cycles c
left join lateral (
  select t.performance_fee_rate, t.version, t.effective_from
  from public.cycle_fee_terms t
  where t.cycle_id = c.id and t.cancelled_at is null and t.effective_from <= now()
  order by t.effective_from desc
  limit 1
) cur on true
left join lateral (
  select t.performance_fee_rate, t.version, t.effective_from
  from public.cycle_fee_terms t
  where t.cycle_id = c.id and t.cancelled_at is null and t.effective_from > now()
  order by t.effective_from asc
  limit 1
) nxt on true;

-- ---------------------------------------------------------------------------
-- Privileges and RLS: admins read everything. Client visibility of cycles they
-- participate in is added with the client portal (Module 12).
-- ---------------------------------------------------------------------------
revoke all on public.investment_cycles, public.cycle_fee_terms, public.cycle_overview from anon, authenticated;
grant select on public.investment_cycles, public.cycle_fee_terms, public.cycle_overview to authenticated;

alter table public.investment_cycles enable row level security;
alter table public.cycle_fee_terms enable row level security;

create policy investment_cycles_select_admin on public.investment_cycles
  for select to authenticated using ((select private.is_admin()));

create policy cycle_fee_terms_select_admin on public.cycle_fee_terms
  for select to authenticated using ((select private.is_admin()));

-- ---------------------------------------------------------------------------
-- Shared validation helpers
-- ---------------------------------------------------------------------------
create or replace function private.require_admin()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.is_admin() then
    raise exception 'Only administrators can perform this action.' using errcode = 'insufficient_privilege';
  end if;
  return (select auth.uid());
end;
$$;

revoke all on function private.require_admin() from public, anon, authenticated;

create or replace function private.require_reason(p_reason text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
begin
  if char_length(btrim(coalesce(p_reason, ''))) < 5 then
    raise exception 'A reason of at least 5 characters is required.' using errcode = 'invalid_parameter_value';
  end if;
  if char_length(btrim(p_reason)) > 1000 then
    raise exception 'The reason must be at most 1000 characters.' using errcode = 'invalid_parameter_value';
  end if;
  return btrim(p_reason);
end;
$$;

revoke all on function private.require_reason(text) from public, anon, authenticated;

create or replace function private.validate_fee_rate(p_rate numeric)
returns numeric
language plpgsql
immutable
set search_path = ''
as $$
begin
  if p_rate is null or p_rate < 0 or p_rate >= 1 then
    raise exception 'The fee rate must be at least 0%% and below 100%%.' using errcode = 'invalid_parameter_value';
  end if;
  if p_rate <> round(p_rate, 6) then
    raise exception 'The fee rate can have at most 4 decimal places as a percentage.' using errcode = 'invalid_parameter_value';
  end if;
  return p_rate;
end;
$$;

revoke all on function private.validate_fee_rate(numeric) from public, anon, authenticated;

create or replace function private.validate_cycle_fields(
  p_cycle_id uuid, p_name text, p_description text, p_start date, p_end date, p_base_nav numeric
)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if char_length(btrim(coalesce(p_name, ''))) not between 3 and 120 then
    raise exception 'The cycle name must be 3–120 characters.' using errcode = 'invalid_parameter_value';
  end if;
  if p_description is not null and char_length(p_description) > 2000 then
    raise exception 'The description must be at most 2000 characters.' using errcode = 'invalid_parameter_value';
  end if;
  if p_start is null or p_end is null or p_end <= p_start then
    raise exception 'The end date must be after the start date.' using errcode = 'invalid_parameter_value';
  end if;
  if p_base_nav is null or p_base_nav <= 0 or p_base_nav <> round(p_base_nav, 8) or p_base_nav >= 1000000000000 then
    raise exception 'Base NAV must be greater than 0 with at most 8 decimal places.' using errcode = 'invalid_parameter_value';
  end if;
  if exists (
    select 1 from public.investment_cycles c
    where lower(btrim(c.name)) = lower(btrim(p_name)) and c.id is distinct from p_cycle_id
  ) then
    raise exception 'A cycle with this name already exists.' using errcode = 'check_violation';
  end if;
end;
$$;

revoke all on function private.validate_cycle_fields(uuid, text, text, date, date, numeric) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Admin API
-- ---------------------------------------------------------------------------
create or replace function public.admin_create_cycle(
  p_name        text,
  p_description text,
  p_start_date  date,
  p_end_date    date,
  p_base_nav    numeric,
  p_fee_rate    numeric
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := private.require_admin();
  v_cycle uuid;
  v_terms uuid;
  v_desc  text := nullif(btrim(coalesce(p_description, '')), '');
begin
  perform private.validate_cycle_fields(null, p_name, v_desc, p_start_date, p_end_date, p_base_nav);
  perform private.validate_fee_rate(p_fee_rate);

  insert into public.investment_cycles (name, description, start_date, end_date, base_nav, created_by)
  values (btrim(p_name), v_desc, p_start_date, p_end_date, p_base_nav, v_actor)
  returning id into v_cycle;

  insert into public.cycle_fee_terms (cycle_id, version, performance_fee_rate, effective_from, reason, created_by)
  values (v_cycle, 1, p_fee_rate, now(), 'Initial fee terms set when the cycle was created.', v_actor)
  returning id into v_terms;

  perform private.write_audit(
    'cycle.created', 'cycle', v_cycle, null,
    jsonb_build_object(
      'name', btrim(p_name), 'description', v_desc, 'start_date', p_start_date, 'end_date', p_end_date,
      'base_nav', p_base_nav::text, 'status', 'draft', 'currency', 'INR'
    )
  );
  perform private.write_audit(
    'fee_terms.created', 'cycle', v_cycle, null,
    jsonb_build_object('terms_id', v_terms, 'version', 1, 'performance_fee_rate', p_fee_rate::text,
                       'fee_policy', 'per_lot_hwm_v1', 'effective_from', now())
  );
  return v_cycle;
end;
$$;

revoke all on function public.admin_create_cycle(text, text, date, date, numeric, numeric) from public, anon;
grant execute on function public.admin_create_cycle(text, text, date, date, numeric, numeric) to authenticated;

create or replace function public.admin_update_cycle(
  p_cycle_id    uuid,
  p_name        text,
  p_description text,
  p_start_date  date,
  p_end_date    date,
  p_base_nav    numeric,
  p_reason      text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_desc text := nullif(btrim(coalesce(p_description, '')), '');
begin
  perform private.require_admin();
  perform set_config('app.audit_reason', private.require_reason(p_reason), true);
  perform private.validate_cycle_fields(p_cycle_id, p_name, v_desc, p_start_date, p_end_date, p_base_nav);

  update public.investment_cycles
  set name = btrim(p_name), description = v_desc, start_date = p_start_date, end_date = p_end_date,
      base_nav = p_base_nav
  where id = p_cycle_id;
  if not found then
    raise exception 'Cycle not found.' using errcode = 'no_data_found';
  end if;
end;
$$;

revoke all on function public.admin_update_cycle(uuid, text, text, date, date, numeric, text) from public, anon;
grant execute on function public.admin_update_cycle(uuid, text, text, date, date, numeric, text) to authenticated;

create or replace function public.admin_set_cycle_status(
  p_cycle_id uuid,
  p_status   public.cycle_status,
  p_reason   text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_current public.cycle_status;
begin
  perform private.require_admin();
  perform set_config('app.audit_reason', private.require_reason(p_reason), true);

  select status into v_current from public.investment_cycles where id = p_cycle_id for update;
  if not found then
    raise exception 'Cycle not found.' using errcode = 'no_data_found';
  end if;
  if v_current = p_status then
    raise exception 'The cycle is already %.', p_status using errcode = 'check_violation';
  end if;

  -- Transition rules are enforced by the guard trigger (single source of truth).
  update public.investment_cycles set status = p_status where id = p_cycle_id;
end;
$$;

revoke all on function public.admin_set_cycle_status(uuid, public.cycle_status, text) from public, anon;
grant execute on function public.admin_set_cycle_status(uuid, public.cycle_status, text) to authenticated;

create or replace function public.admin_add_fee_terms(
  p_cycle_id       uuid,
  p_fee_rate       numeric,
  p_effective_from timestamptz,
  p_reason         text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor     uuid := private.require_admin();
  v_reason    text := private.require_reason(p_reason);
  v_status    public.cycle_status;
  v_effective timestamptz;
  v_version   integer;
  v_latest    timestamptz;
  v_current   numeric;
  v_terms     uuid;
begin
  perform private.validate_fee_rate(p_fee_rate);

  select status into v_status from public.investment_cycles where id = p_cycle_id for update;
  if not found then
    raise exception 'Cycle not found.' using errcode = 'no_data_found';
  end if;
  if v_status in ('closed', 'settled') then
    raise exception 'Fee terms cannot be changed after the cycle is closed.' using errcode = 'check_violation';
  end if;

  -- NULL = effective immediately. Backdating is never allowed: it would rewrite history.
  v_effective := coalesce(p_effective_from, now());
  if v_effective < now() - interval '1 minute' then
    raise exception 'The effective date cannot be in the past.' using errcode = 'invalid_parameter_value';
  end if;
  v_effective := greatest(v_effective, now());

  select max(effective_from) into v_latest
  from public.cycle_fee_terms where cycle_id = p_cycle_id and cancelled_at is null;
  if v_latest is not null and v_effective <= v_latest then
    raise exception 'The effective date must be after the latest scheduled change (%).',
      to_char(v_latest at time zone 'Asia/Kolkata', 'DD Mon YYYY HH24:MI') using errcode = 'invalid_parameter_value';
  end if;

  select t.performance_fee_rate into v_current
  from public.cycle_fee_terms t
  where t.cycle_id = p_cycle_id and t.cancelled_at is null
  order by t.effective_from desc limit 1;
  if v_current = p_fee_rate then
    raise exception 'The new rate is the same as the latest rate.' using errcode = 'invalid_parameter_value';
  end if;

  select coalesce(max(version), 0) + 1 into v_version from public.cycle_fee_terms where cycle_id = p_cycle_id;

  insert into public.cycle_fee_terms (cycle_id, version, performance_fee_rate, effective_from, reason, created_by)
  values (p_cycle_id, v_version, p_fee_rate, v_effective, v_reason, v_actor)
  returning id into v_terms;

  perform private.write_audit(
    'fee_terms.created', 'cycle', p_cycle_id,
    jsonb_build_object('performance_fee_rate', v_current::text),
    jsonb_build_object('terms_id', v_terms, 'version', v_version, 'performance_fee_rate', p_fee_rate::text,
                       'fee_policy', 'per_lot_hwm_v1', 'effective_from', v_effective),
    v_reason
  );
  return v_terms;
end;
$$;

revoke all on function public.admin_add_fee_terms(uuid, numeric, timestamptz, text) from public, anon;
grant execute on function public.admin_add_fee_terms(uuid, numeric, timestamptz, text) to authenticated;

create or replace function public.admin_cancel_fee_terms(p_terms_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor  uuid := private.require_admin();
  v_reason text := private.require_reason(p_reason);
  v_terms  public.cycle_fee_terms;
begin
  select * into v_terms from public.cycle_fee_terms where id = p_terms_id for update;
  if not found then
    raise exception 'Fee terms not found.' using errcode = 'no_data_found';
  end if;
  if v_terms.cancelled_at is not null then
    raise exception 'This scheduled change was already cancelled.' using errcode = 'check_violation';
  end if;
  if v_terms.effective_from <= now() then
    raise exception 'Only changes that have not taken effect yet can be cancelled.' using errcode = 'check_violation';
  end if;

  update public.cycle_fee_terms
  set cancelled_at = now(), cancelled_by = v_actor, cancel_reason = v_reason
  where id = p_terms_id;

  perform private.write_audit(
    'fee_terms.cancelled', 'cycle', v_terms.cycle_id,
    jsonb_build_object('terms_id', v_terms.id, 'version', v_terms.version,
                       'performance_fee_rate', v_terms.performance_fee_rate::text,
                       'effective_from', v_terms.effective_from),
    null, v_reason
  );
end;
$$;

revoke all on function public.admin_cancel_fee_terms(uuid, text) from public, anon;
grant execute on function public.admin_cancel_fee_terms(uuid, text) to authenticated;
