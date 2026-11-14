-- =============================================================================
-- Module 15: fund-level performance fee, flat admin fee, previous-day NAV pricing
-- (approved by the product owner on 14 Nov 2026; replaces per_lot_hwm_v1 for new NAVs)
--
-- NAV method "fund_level_v2" (one NAV for every client of a cycle):
--   net_contributed   C = Σ ledger amounts as of the NAV time
--   profit            P = gross net asset value G − C
--   performance fee   F = ROUND(max(0, P) × rate, 2)          (rate in force at the NAV time)
--   NAV per unit        = ROUND((G − F) / outstanding units, 8)   ← the NAV clients see
--   gross NAV per unit  = ROUND(G / units, 8)                      (admin only)
--   Known property (accepted): with mid-cycle money the fee is shared through the single NAV,
--   so value can shift between clients who joined at different times.
--
-- Admin fee: a flat ₹ amount per client per cycle (investment_cycles.admin_fee_amount,
--   default ₹1,000), editable by admins until the cycle is settled, always deducted
--   (also when there is no profit). Clients see it; they never see the performance fee.
--
-- Unit issuance: money received on day D (India time) gets the latest published NAV dated
--   BEFORE day D (normally the previous trading day's), else the cycle's base NAV.
--
-- Performance fee rate: editable (versioned) while the cycle is draft/open; locked once the
--   cycle is active. A cycle cannot be activated while a rate change is still scheduled.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Admin fee on cycles
-- ---------------------------------------------------------------------------
alter table public.investment_cycles
  add column admin_fee_amount numeric(20, 2) not null default 1000
  check (admin_fee_amount >= 0 and admin_fee_amount < 1000000000000);

comment on column public.investment_cycles.admin_fee_amount is
  'Flat admin fee in ₹ charged once per client per cycle (shown to clients; always deducted).';

create or replace function private.validate_admin_fee(p_amount numeric)
returns numeric
language plpgsql
immutable
set search_path = ''
as $$
begin
  if p_amount is null or p_amount < 0 then
    raise exception 'The admin fee must be ₹0 or more.' using errcode = 'invalid_parameter_value';
  end if;
  if p_amount <> round(p_amount, 2) then
    raise exception 'The admin fee can have at most 2 decimal places (paise).' using errcode = 'invalid_parameter_value';
  end if;
  if p_amount >= 1000000000000 then
    raise exception 'The admin fee is too large.' using errcode = 'invalid_parameter_value';
  end if;
  return p_amount;
end;
$$;

revoke all on function private.validate_admin_fee(numeric) from public, anon, authenticated;

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

  if new.admin_fee_amount <> old.admin_fee_amount and old.status = 'settled' then
    raise exception 'The admin fee cannot be changed after the cycle is settled.' using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

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
  if new.admin_fee_amount is distinct from old.admin_fee_amount then
    v_before := v_before || jsonb_build_object('admin_fee_amount', old.admin_fee_amount::text);
    v_after  := v_after  || jsonb_build_object('admin_fee_amount', new.admin_fee_amount::text);
    v_action := 'cycle.admin_fee_changed';
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

-- ---------------------------------------------------------------------------
-- Fee policy label for new fee terms
-- ---------------------------------------------------------------------------
alter table public.cycle_fee_terms drop constraint cycle_fee_terms_fee_policy_check;
alter table public.cycle_fee_terms add constraint cycle_fee_terms_fee_policy_check
  check (fee_policy in ('per_lot_hwm_v1', 'fund_level_v2'));
alter table public.cycle_fee_terms alter column fee_policy set default 'fund_level_v2';

-- Cycle list read model: + admin fee (appended column).
create or replace view public.cycle_overview
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
  nxt.effective_from       as pending_fee_effective_from,
  c.admin_fee_amount
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
-- Cycle admin API
-- ---------------------------------------------------------------------------
drop function public.admin_create_cycle(text, text, date, date, numeric, numeric);

create function public.admin_create_cycle(
  p_name        text,
  p_description text,
  p_start_date  date,
  p_end_date    date,
  p_base_nav    numeric,
  p_fee_rate    numeric,
  p_admin_fee   numeric default 1000
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
  perform private.validate_admin_fee(p_admin_fee);

  insert into public.investment_cycles (name, description, start_date, end_date, base_nav, admin_fee_amount, created_by)
  values (btrim(p_name), v_desc, p_start_date, p_end_date, p_base_nav, p_admin_fee, v_actor)
  returning id into v_cycle;

  insert into public.cycle_fee_terms (cycle_id, version, performance_fee_rate, effective_from, reason, created_by)
  values (v_cycle, 1, p_fee_rate, now(), 'Initial fee terms set when the cycle was created.', v_actor)
  returning id into v_terms;

  perform private.write_audit(
    'cycle.created', 'cycle', v_cycle, null,
    jsonb_build_object(
      'name', btrim(p_name), 'description', v_desc, 'start_date', p_start_date, 'end_date', p_end_date,
      'base_nav', p_base_nav::text, 'admin_fee_amount', p_admin_fee::text, 'status', 'draft', 'currency', 'INR'
    )
  );
  perform private.write_audit(
    'fee_terms.created', 'cycle', v_cycle, null,
    jsonb_build_object('terms_id', v_terms, 'version', 1, 'performance_fee_rate', p_fee_rate::text,
                       'fee_policy', 'fund_level_v2', 'effective_from', now())
  );
  return v_cycle;
end;
$$;

revoke all on function public.admin_create_cycle(text, text, date, date, numeric, numeric, numeric) from public, anon;
grant execute on function public.admin_create_cycle(text, text, date, date, numeric, numeric, numeric) to authenticated;

create or replace function public.admin_set_admin_fee(p_cycle_id uuid, p_amount numeric, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_current numeric;
begin
  perform private.require_admin();
  perform set_config('app.audit_reason', private.require_reason(p_reason), true);
  perform private.validate_admin_fee(p_amount);

  select admin_fee_amount into v_current from public.investment_cycles where id = p_cycle_id for update;
  if not found then
    raise exception 'Cycle not found.' using errcode = 'no_data_found';
  end if;
  if v_current = p_amount then
    raise exception 'The admin fee is already %.', p_amount using errcode = 'invalid_parameter_value';
  end if;
  -- The settled-cycle rule is enforced by the guard trigger.
  update public.investment_cycles set admin_fee_amount = p_amount where id = p_cycle_id;
end;
$$;

revoke all on function public.admin_set_admin_fee(uuid, numeric, text) from public, anon;
grant execute on function public.admin_set_admin_fee(uuid, numeric, text) to authenticated;

-- Performance fee: versioned changes only while draft/open.
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
  if v_status not in ('draft', 'open') then
    raise exception 'The performance fee is locked once the cycle is active (this one is %).', v_status
      using errcode = 'check_violation';
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
                       'fee_policy', 'fund_level_v2', 'effective_from', v_effective),
    v_reason
  );
  return v_terms;
end;
$$;

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
  v_pending timestamptz;
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

  -- The performance fee is locked once active: no scheduled change may take effect later.
  if p_status = 'active' then
    select min(effective_from) into v_pending from public.cycle_fee_terms
    where cycle_id = p_cycle_id and cancelled_at is null and effective_from > now();
    if v_pending is not null then
      raise exception 'A performance fee change is scheduled for %. Cancel it before starting trading; the rate is locked once the cycle is active.',
        to_char(v_pending at time zone 'Asia/Kolkata', 'DD Mon YYYY HH24:MI') using errcode = 'check_violation';
    end if;
  end if;

  -- Transition rules are enforced by the guard trigger (single source of truth).
  update public.investment_cycles set status = p_status where id = p_cycle_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- NAV snapshots: fund-level fee
-- ---------------------------------------------------------------------------
alter table public.nav_snapshots
  add column net_contributed numeric(20, 2),
  add column profit_before_fee numeric(20, 2);

comment on column public.nav_snapshots.net_nav_per_unit is
  'fund_level_v2: the NAV clients see = (gross net asset value − performance fee) / units. per_lot_hwm_v1: weighted average.';

alter table public.nav_snapshots alter column calculation_version set default 'fund_level_v2';

create or replace function private.guard_nav_snapshot_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.id <> old.id or new.cycle_id <> old.cycle_id or new.valuation_id <> old.valuation_id
     or new.nav_date <> old.nav_date or new.total_outstanding_units <> old.total_outstanding_units
     or new.gross_net_asset_value <> old.gross_net_asset_value or new.gross_nav_per_unit <> old.gross_nav_per_unit
     or new.calculation_version <> old.calculation_version
     or new.corrects_snapshot_id is distinct from old.corrects_snapshot_id
     or new.created_by <> old.created_by or new.calculated_at <> old.calculated_at then
    raise exception 'NAV figures are immutable. Calculate a new snapshot instead.' using errcode = 'check_violation';
  end if;

  if old.status in ('published', 'corrected', 'discarded') and (
       new.performance_fee_rate is distinct from old.performance_fee_rate
    or new.performance_fee_amount is distinct from old.performance_fee_amount
    or new.net_nav_per_unit is distinct from old.net_nav_per_unit
    or new.net_contributed is distinct from old.net_contributed
    or new.profit_before_fee is distinct from old.profit_before_fee
    or new.published_by is distinct from old.published_by
    or new.published_at is distinct from old.published_at
    or new.publish_reason is distinct from old.publish_reason) then
    raise exception 'A % NAV snapshot cannot be changed.', old.status using errcode = 'check_violation';
  end if;

  if new.status <> old.status and not (
       (old.status = 'draft' and new.status in ('published', 'discarded'))
    or (old.status = 'published' and new.status = 'corrected')
  ) then
    raise exception 'A % NAV snapshot cannot become %.', old.status, new.status using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

-- Performance-fee rate for a NAV time: the version in force then, else the cycle's first version.
create or replace function private.performance_fee_rate_at(p_cycle_id uuid, p_at timestamptz)
returns numeric
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (private.fee_terms_at(p_cycle_id, p_at)).performance_fee_rate,
    (select t.performance_fee_rate from public.cycle_fee_terms t
      where t.cycle_id = p_cycle_id and t.cancelled_at is null order by t.effective_from limit 1),
    0
  );
$$;

revoke all on function private.performance_fee_rate_at(uuid, timestamptz) from public, anon, authenticated;

-- Replaces the per-lot accrual: computes the fund-level fee and the NAV clients see.
create or replace function private.accrue_lot_fees()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_contrib numeric;
  v_profit  numeric;
  v_rate    numeric;
  v_fee     numeric;
begin
  select coalesce(sum(a.amount), 0) into v_contrib
  from public.client_unit_allocations a
  where a.cycle_id = new.cycle_id and a.created_at <= new.nav_date;

  v_profit := new.gross_net_asset_value - v_contrib;
  v_rate   := private.performance_fee_rate_at(new.cycle_id, new.nav_date);
  v_fee    := round(greatest(v_profit, 0) * v_rate, 2);

  update public.nav_snapshots
  set performance_fee_rate   = v_rate,
      performance_fee_amount = v_fee,
      net_contributed        = v_contrib,
      profit_before_fee      = v_profit,
      net_nav_per_unit       = round((new.gross_net_asset_value - v_fee)::numeric(38, 20) / new.total_outstanding_units, 8)
  where id = new.id;
  return null;
end;
$$;

-- The NAV clients see for a snapshot of either method.
create or replace function private.client_nav_of(p_snapshot public.nav_snapshots)
returns numeric
language sql
immutable
set search_path = ''
as $$
  select coalesce(p_snapshot.net_nav_per_unit, p_snapshot.gross_nav_per_unit);
$$;

revoke all on function private.client_nav_of(public.nav_snapshots) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Unit issuance: previous-day NAV (India time)
-- ---------------------------------------------------------------------------
create or replace function private.ist_day_start(p_at timestamptz)
returns timestamptz
language sql
stable
set search_path = ''
as $$
  select (date_trunc('day', p_at at time zone 'Asia/Kolkata')) at time zone 'Asia/Kolkata';
$$;

revoke all on function private.ist_day_start(timestamptz) from public, anon, authenticated;

-- The published snapshot used for money received at p_at (none → base NAV).
create or replace function private.applicable_snapshot(p_cycle_id uuid, p_at timestamptz)
returns public.nav_snapshots
language sql
stable
security definer
set search_path = ''
as $$
  select s.*
  from public.nav_snapshots s
  where s.cycle_id = p_cycle_id and s.status = 'published' and s.nav_date < private.ist_day_start(p_at)
  order by s.nav_date desc, s.published_at desc
  limit 1;
$$;

revoke all on function private.applicable_snapshot(uuid, timestamptz) from public, anon, authenticated;

create or replace function private.applicable_nav(p_cycle_id uuid, p_at timestamptz)
returns numeric
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select case when s.id is null then null
                 when s.calculation_version = 'fund_level_v2' then s.net_nav_per_unit
                 else s.gross_nav_per_unit end
       from private.applicable_snapshot(p_cycle_id, p_at) s),
    (select c.base_nav from public.investment_cycles c where c.id = p_cycle_id)
  );
$$;

drop function public.admin_preview_verification(uuid);

create function public.admin_preview_verification(p_contribution_id uuid)
returns table (applicable_nav text, units text, fee_rate text, fee_version integer, nav_date timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_c     public.contributions;
  v_nav   numeric;
  v_terms public.cycle_fee_terms;
begin
  perform private.require_admin();
  select * into v_c from public.contributions where id = p_contribution_id;
  if not found then
    raise exception 'Contribution not found.' using errcode = 'no_data_found';
  end if;
  v_nav := private.applicable_nav(v_c.cycle_id, v_c.received_at);
  v_terms := private.fee_terms_at(v_c.cycle_id, clock_timestamp());
  return query select v_nav::text, private.units_for(v_c.amount, v_nav)::text,
                      v_terms.performance_fee_rate::text, v_terms.version,
                      (private.applicable_snapshot(v_c.cycle_id, v_c.received_at)).nav_date;
end;
$$;

revoke all on function public.admin_preview_verification(uuid) from public, anon;
grant execute on function public.admin_preview_verification(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Admin report: each client's position at a NAV snapshot (fund_level_v2)
-- security_invoker → base-table RLS applies (admin only).
-- ---------------------------------------------------------------------------
create view public.client_position_report
with (security_invoker = true)
as
select
  s.id as snapshot_id, s.cycle_id, s.nav_date, s.status as snapshot_status,
  x.client_id, p.full_name as client_name, p.email as client_email,
  x.units, x.contributed,
  s.gross_nav_per_unit, s.net_nav_per_unit,
  round(x.units * s.gross_nav_per_unit, 2) as gross_value,
  round(x.units * s.net_nav_per_unit, 2) as net_value,
  round(x.units * s.gross_nav_per_unit, 2) - round(x.units * s.net_nav_per_unit, 2) as performance_fee_share,
  round(x.units * s.net_nav_per_unit, 2) - x.contributed as profit,
  cy.admin_fee_amount as admin_fee,
  round(x.units * s.net_nav_per_unit, 2) - x.contributed - cy.admin_fee_amount as final_profit,
  round(x.units * s.net_nav_per_unit, 2) - cy.admin_fee_amount as final_value
from public.nav_snapshots s
join public.investment_cycles cy on cy.id = s.cycle_id
cross join lateral (
  select a.client_id, sum(a.units) as units, sum(a.amount) as contributed
  from public.client_unit_allocations a
  where a.cycle_id = s.cycle_id and a.created_at <= s.nav_date
  group by a.client_id
) x
join public.profiles p on p.id = x.client_id
where x.units > 0 and s.calculation_version = 'fund_level_v2';

comment on view public.client_position_report is
  'Admin-only: per-client value, profit, performance-fee share and admin fee at each fund_level_v2 NAV snapshot.';

revoke all on public.client_position_report from anon, authenticated;
grant select on public.client_position_report to authenticated;

-- ---------------------------------------------------------------------------
-- Cycle-close record: + admin fees
-- ---------------------------------------------------------------------------
alter table public.fee_crystallisations
  add column admin_fee_per_client numeric(20, 2) not null default 0 check (admin_fee_per_client >= 0),
  add column clients_charged integer not null default 0 check (clients_charged >= 0),
  add column admin_fee_total numeric(20, 2) not null default 0 check (admin_fee_total >= 0);

create or replace function public.admin_record_fee_crystallisation(p_cycle_id uuid, p_note text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor   uuid := private.require_admin();
  v_note    text := private.require_reason(p_note);
  v_cycle   public.investment_cycles;
  v_snap    public.nav_snapshots;
  v_clients integer;
  v_id      uuid;
begin
  select * into v_cycle from public.investment_cycles where id = p_cycle_id for update;
  if not found then
    raise exception 'Cycle not found.' using errcode = 'no_data_found';
  end if;
  if v_cycle.status <> 'closed' then
    raise exception 'The final fee can only be recorded after the cycle is closed (it is %).', v_cycle.status
      using errcode = 'check_violation';
  end if;
  if exists (select 1 from public.fee_crystallisations where cycle_id = p_cycle_id) then
    raise exception 'The final fee for this cycle has already been recorded.' using errcode = 'check_violation';
  end if;

  select * into v_snap from public.nav_snapshots
  where cycle_id = p_cycle_id and status = 'published'
  order by nav_date desc limit 1;
  if not found then
    raise exception 'Publish a closing NAV before recording the final fee.' using errcode = 'check_violation';
  end if;

  select count(*) into v_clients from (
    select a.client_id from public.client_unit_allocations a
    where a.cycle_id = p_cycle_id group by a.client_id having sum(a.units) > 0
  ) h;

  insert into public.fee_crystallisations
    (cycle_id, snapshot_id, total_fee_amount, net_nav_per_unit, note, recorded_by,
     admin_fee_per_client, clients_charged, admin_fee_total)
  values (p_cycle_id, v_snap.id, v_snap.performance_fee_amount, v_snap.net_nav_per_unit, v_note, v_actor,
          v_cycle.admin_fee_amount, v_clients, v_cycle.admin_fee_amount * v_clients)
  returning id into v_id;

  perform private.write_audit('fees.crystallised', 'cycle', p_cycle_id, null,
    jsonb_build_object('snapshot_id', v_snap.id, 'nav_date', v_snap.nav_date,
      'total_fee_amount', v_snap.performance_fee_amount::text,
      'net_nav_per_unit', v_snap.net_nav_per_unit::text,
      'admin_fee_per_client', v_cycle.admin_fee_amount::text, 'clients_charged', v_clients,
      'admin_fee_total', (v_cycle.admin_fee_amount * v_clients)::text, 'informational', true),
    v_note);
  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Client API: NAV after performance fee, admin fee, final profit.
-- No performance-fee rate, amount, gross NAV or HWM is ever returned to clients.
-- ---------------------------------------------------------------------------
drop function public.client_my_cycles();
drop function public.client_my_contributions();
drop function public.client_my_lot_values(uuid);
drop function public.client_nav_history(uuid);

create function public.client_my_cycles()
returns table (
  cycle_id         uuid,
  cycle_name       text,
  cycle_status     text,
  start_date       date,
  end_date         date,
  base_nav         text,
  units            text,
  net_contributed  text,
  latest_nav_date  timestamptz,
  latest_nav       text,
  current_value    text,
  profit           text,
  admin_fee        text,
  final_profit     text,
  final_value      text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_client uuid := private.current_client_id();
begin
  return query
  with mine as (
    select c.* from public.investment_cycles c where c.id in (select private.client_cycle_ids(v_client))
  ),
  holding as (
    select a.cycle_id, sum(a.units) as units, sum(a.amount) as net_contributed
    from public.client_unit_allocations a where a.client_id = v_client group by a.cycle_id
  ),
  latest as (
    select distinct on (s.cycle_id) s.cycle_id, s.nav_date, private.client_nav_of(s) as nav
    from public.nav_snapshots s
    where s.status = 'published' and s.cycle_id in (select id from mine)
    order by s.cycle_id, s.nav_date desc
  ),
  valued as (
    select m.id as cycle_id,
           coalesce(h.units, 0) as units,
           coalesce(h.net_contributed, 0) as contributed,
           round(coalesce(h.units, 0) * coalesce(l.nav, m.base_nav), 2) as value,
           case when coalesce(h.units, 0) > 0 then m.admin_fee_amount else 0 end as admin_fee
    from mine m
    left join holding h on h.cycle_id = m.id
    left join latest l on l.cycle_id = m.id
  )
  select m.id, m.name, m.status::text, m.start_date, m.end_date, m.base_nav::text,
         v.units::text, v.contributed::text,
         l.nav_date, l.nav::text,
         v.value::text, (v.value - v.contributed)::text, v.admin_fee::text,
         (v.value - v.contributed - v.admin_fee)::text, (v.value - v.admin_fee)::text
  from mine m
  join valued v on v.cycle_id = m.id
  left join latest l on l.cycle_id = m.id
  order by m.start_date desc;
end;
$$;

-- The client's contributions (all statuses). No notes, verifier, admin reasons or fee rate.
create function public.client_my_contributions()
returns table (
  id               uuid,
  cycle_id         uuid,
  cycle_name       text,
  amount           text,
  received_at      timestamptz,
  method           text,
  reference_number text,
  status           text,
  applicable_nav   text,
  units_issued     text,
  verified_at      timestamptz,
  rejected_at      timestamptz,
  reversed_at      timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_client uuid := private.current_client_id();
begin
  return query
  select c.id, c.cycle_id, cy.name, c.amount::text, c.received_at, c.method::text, c.reference_number,
         c.status::text, c.applicable_nav::text, c.units_issued::text,
         c.verified_at, c.rejected_at, c.reversed_at
  from public.contributions c
  join public.investment_cycles cy on cy.id = c.cycle_id
  where c.client_id = v_client
  order by c.received_at desc;
end;
$$;

-- Published NAV history (the NAV clients see) of a cycle the client is in.
create function public.client_nav_history(p_cycle_id uuid)
returns table (nav_date timestamptz, nav_per_unit text)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_client uuid := private.current_client_id();
begin
  if p_cycle_id not in (select private.client_cycle_ids(v_client)) then
    return;
  end if;
  return query
  select s.nav_date, private.client_nav_of(s)::text
  from public.nav_snapshots s
  where s.cycle_id = p_cycle_id and s.status = 'published'
  order by s.nav_date;
end;
$$;

create or replace function public.client_my_activity(p_limit integer default 50)
returns table (occurred_at timestamptz, kind text, cycle_name text, amount text, units text, nav text)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_client uuid := private.current_client_id();
begin
  return query
  select * from (
    select c.created_at, 'contribution_recorded'::text, cy.name, c.amount::text, null::text, null::text
      from public.contributions c join public.investment_cycles cy on cy.id = c.cycle_id
     where c.client_id = v_client
    union all
    select c.verified_at, 'units_issued', cy.name, c.amount::text, c.units_issued::text, c.applicable_nav::text
      from public.contributions c join public.investment_cycles cy on cy.id = c.cycle_id
     where c.client_id = v_client and c.verified_at is not null
    union all
    select c.rejected_at, 'contribution_rejected', cy.name, c.amount::text, null, null
      from public.contributions c join public.investment_cycles cy on cy.id = c.cycle_id
     where c.client_id = v_client and c.rejected_at is not null
    union all
    select c.reversed_at, 'contribution_reversed', cy.name, c.amount::text, c.units_issued::text, null
      from public.contributions c join public.investment_cycles cy on cy.id = c.cycle_id
     where c.client_id = v_client and c.reversed_at is not null
    union all
    select s.published_at, 'nav_published', cy.name, null, null, private.client_nav_of(s)::text
      from public.nav_snapshots s join public.investment_cycles cy on cy.id = s.cycle_id
     where s.status in ('published', 'corrected')
       and s.cycle_id in (select private.client_cycle_ids(v_client))
  ) e(occurred_at, kind, cycle_name, amount, units, nav)
  order by e.occurred_at desc
  limit greatest(1, least(coalesce(p_limit, 50), 200));
end;
$$;

revoke all on function public.client_my_cycles() from public, anon;
revoke all on function public.client_my_contributions() from public, anon;
revoke all on function public.client_nav_history(uuid) from public, anon;
grant execute on function public.client_my_cycles() to authenticated;
grant execute on function public.client_my_contributions() to authenticated;
grant execute on function public.client_nav_history(uuid) to authenticated;
