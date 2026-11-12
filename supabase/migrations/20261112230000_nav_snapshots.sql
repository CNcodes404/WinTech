-- =============================================================================
-- Module 9: NAV calculation and publishing (gross NAV)
--
-- Rules (BUSINESS_LOGIC §3, §10; DECISIONS B, E, F):
--   gross_nav_per_unit = ROUND(gross_net_asset_value / outstanding_units, 8)   (HALF_UP)
--   * Calculated ONLY from an approved valuation; the snapshot references it.
--   * outstanding_units = Σ ledger units with created_at ≤ valuation_at.
--   * Decision E: a NEW snapshot is refused if the unit ledger changed after
--     the valuation timestamp (new money is not in that valuation). A
--     CORRECTION re-values the same past date using the units as of that date.
--   * Lifecycle: draft → published (immutable) → corrected (by a published
--     correction for the same as-of date); draft → discarded. Never deleted.
--   * Published NAVs move forward in time per cycle (no back-dated publishing
--     except corrections).
--   * Decision B: unit issuance uses the latest PUBLISHED gross NAV as of the
--     contribution's received_at, else the cycle's base NAV. Units already
--     issued are never rewritten when a NAV is corrected.
--   * Performance-fee and net NAV columns are filled by Module 10.
-- =============================================================================

create type public.nav_snapshot_status as enum ('draft', 'published', 'corrected', 'discarded');

create table public.nav_snapshots (
  id                       uuid primary key default gen_random_uuid(),
  cycle_id                 uuid not null references public.investment_cycles (id) on delete restrict,
  valuation_id             uuid not null references public.portfolio_valuations (id) on delete restrict,
  nav_date                 timestamptz not null,  -- = valuation.valuation_at (as-of time)
  total_outstanding_units  numeric(24, 8) not null check (total_outstanding_units > 0),
  gross_net_asset_value    numeric(20, 2) not null check (gross_net_asset_value > 0),
  gross_nav_per_unit       numeric(20, 8) not null check (gross_nav_per_unit > 0),
  -- Filled by the fee model (Module 10); NULL until then.
  performance_fee_rate     numeric(8, 6),
  performance_fee_amount   numeric(20, 2) check (performance_fee_amount is null or performance_fee_amount >= 0),
  net_nav_per_unit         numeric(20, 8),
  calculation_version      text not null default 'gross_v1',
  status                   public.nav_snapshot_status not null default 'draft',
  corrects_snapshot_id     uuid references public.nav_snapshots (id) on delete restrict,
  created_by               uuid not null references public.profiles (id) on delete restrict,
  calculated_at            timestamptz not null default clock_timestamp(),
  published_by             uuid references public.profiles (id) on delete restrict,
  published_at             timestamptz,
  publish_reason           text,
  corrected_by_snapshot_id uuid references public.nav_snapshots (id) on delete restrict,
  corrected_at             timestamptz,
  discarded_at             timestamptz,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),

  constraint nav_snapshots_status_fields check (
    case status
      when 'draft'     then published_at is null and corrected_at is null and discarded_at is null
      when 'published' then published_by is not null and published_at is not null and publish_reason is not null
                            and corrected_at is null
      when 'corrected' then published_at is not null and corrected_by_snapshot_id is not null and corrected_at is not null
      when 'discarded' then published_at is null and discarded_at is not null
    end
  )
);

comment on table public.nav_snapshots is
  'NAV snapshots calculated from approved valuations. Published rows are immutable; corrections create new rows.';

create index nav_snapshots_cycle_idx on public.nav_snapshots (cycle_id, status, nav_date desc);
-- One live published NAV per cycle and as-of instant.
create unique index nav_snapshots_one_published_per_date
  on public.nav_snapshots (cycle_id, nav_date) where status = 'published';
-- At most one draft per cycle (recalculating replaces it).
create unique index nav_snapshots_one_draft_per_cycle
  on public.nav_snapshots (cycle_id) where status = 'draft';

create trigger nav_snapshots_set_updated_at
  before update on public.nav_snapshots
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Guard: published figures never change; only status transitions are allowed.
-- ---------------------------------------------------------------------------
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

revoke all on function private.guard_nav_snapshot_update() from public, anon, authenticated;

create trigger nav_snapshots_guard_update
  before update on public.nav_snapshots
  for each row execute function private.guard_nav_snapshot_update();

create trigger nav_snapshots_no_delete
  before delete on public.nav_snapshots
  for each row execute function private.reject_delete();

-- ---------------------------------------------------------------------------
-- Decision B: NAV used for unit issuance.
-- ---------------------------------------------------------------------------
create or replace function private.applicable_nav(p_cycle_id uuid, p_at timestamptz)
returns numeric
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select s.gross_nav_per_unit
       from public.nav_snapshots s
      where s.cycle_id = p_cycle_id and s.status = 'published' and s.nav_date <= p_at
      order by s.nav_date desc, s.published_at desc
      limit 1),
    (select c.base_nav from public.investment_cycles c where c.id = p_cycle_id)
  );
$$;

revoke all on function private.applicable_nav(uuid, timestamptz) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Units outstanding as of a time, and the Decision E staleness check.
-- ---------------------------------------------------------------------------
create or replace function private.units_as_of(p_cycle_id uuid, p_at timestamptz)
returns numeric
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum(a.units), 0)
  from public.client_unit_allocations a
  where a.cycle_id = p_cycle_id and a.created_at <= p_at;
$$;

revoke all on function private.units_as_of(uuid, timestamptz) from public, anon, authenticated;

create or replace function private.ledger_changes_after(p_cycle_id uuid, p_at timestamptz)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer
  from public.client_unit_allocations a
  where a.cycle_id = p_cycle_id and a.created_at > p_at;
$$;

revoke all on function private.ledger_changes_after(uuid, timestamptz) from public, anon, authenticated;

-- gross NAV per unit, HALF_UP to 8 dp, with a widened dividend (no premature rounding).
create or replace function private.gross_nav_for(p_net_asset_value numeric, p_units numeric)
returns numeric
language sql
immutable
set search_path = ''
as $$
  select round(p_net_asset_value::numeric(38, 20) / p_units, 8);
$$;

revoke all on function private.gross_nav_for(numeric, numeric) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Privileges / RLS: admin read; client NAV visibility arrives with the portal.
-- ---------------------------------------------------------------------------
revoke all on public.nav_snapshots from anon, authenticated;
grant select on public.nav_snapshots to authenticated;
alter table public.nav_snapshots enable row level security;
create policy nav_snapshots_select_admin on public.nav_snapshots
  for select to authenticated using ((select private.is_admin()));

-- ---------------------------------------------------------------------------
-- Admin API
-- ---------------------------------------------------------------------------
create or replace function public.admin_calculate_nav(p_valuation_id uuid, p_corrects_snapshot_id uuid default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor    uuid := private.require_admin();
  v_val      public.portfolio_valuations;
  v_cycle    public.investment_cycles;
  v_orig     public.nav_snapshots;
  v_latest   timestamptz;
  v_changes  integer;
  v_units    numeric;
  v_nav      numeric;
  v_old      uuid;
  v_id       uuid;
begin
  select * into v_val from public.portfolio_valuations where id = p_valuation_id;
  if not found then
    raise exception 'Valuation not found.' using errcode = 'no_data_found';
  end if;
  if v_val.status <> 'approved' then
    raise exception 'NAV can only be calculated from an approved valuation (this one is %).', v_val.status
      using errcode = 'check_violation';
  end if;

  select * into v_cycle from public.investment_cycles where id = v_val.cycle_id for share;
  if v_cycle.status not in ('open', 'active', 'closed') then
    raise exception 'NAV can be calculated for open, active or closed cycles (this one is %).', v_cycle.status
      using errcode = 'check_violation';
  end if;

  if p_corrects_snapshot_id is not null then
    select * into v_orig from public.nav_snapshots where id = p_corrects_snapshot_id;
    if not found or v_orig.status <> 'published' or v_orig.cycle_id <> v_val.cycle_id then
      raise exception 'Only a published NAV of the same cycle can be corrected.' using errcode = 'check_violation';
    end if;
    if v_orig.nav_date <> v_val.valuation_at then
      raise exception 'A correction must use a valuation for the same date and time as the NAV it corrects.'
        using errcode = 'check_violation';
    end if;
  else
    -- Decision E: new money after the valuation is not reflected in it.
    v_changes := private.ledger_changes_after(v_val.cycle_id, v_val.valuation_at);
    if v_changes > 0 then
      raise exception 'Units changed after this valuation (% ledger entr%). Record and approve a newer valuation first.',
        v_changes, case when v_changes = 1 then 'y' else 'ies' end using errcode = 'check_violation';
    end if;
    select max(nav_date) into v_latest from public.nav_snapshots
    where cycle_id = v_val.cycle_id and status = 'published';
    if v_latest is not null and v_val.valuation_at <= v_latest then
      raise exception 'A NAV as of % or later is already published. Use a newer valuation, or correct that NAV.',
        to_char(v_latest at time zone 'Asia/Kolkata', 'DD Mon YYYY HH24:MI') using errcode = 'check_violation';
    end if;
  end if;

  v_units := private.units_as_of(v_val.cycle_id, v_val.valuation_at);
  if v_units <= 0 then
    raise exception 'No units were outstanding at the valuation time, so NAV per unit cannot be calculated.'
      using errcode = 'check_violation';
  end if;
  if v_val.gross_net_asset_value <= 0 then
    raise exception 'The net asset value is zero or negative; a NAV cannot be calculated.' using errcode = 'check_violation';
  end if;
  v_nav := private.gross_nav_for(v_val.gross_net_asset_value, v_units);

  -- Recalculating replaces the cycle's existing draft.
  select id into v_old from public.nav_snapshots where cycle_id = v_val.cycle_id and status = 'draft' for update;
  if found then
    update public.nav_snapshots set status = 'discarded', discarded_at = clock_timestamp() where id = v_old;
    perform private.write_audit('nav.discarded', 'nav_snapshot', v_old,
      jsonb_build_object('status', 'draft'), jsonb_build_object('status', 'discarded'),
      'Replaced by a recalculation.');
  end if;

  insert into public.nav_snapshots
    (cycle_id, valuation_id, nav_date, total_outstanding_units, gross_net_asset_value, gross_nav_per_unit,
     corrects_snapshot_id, created_by)
  values
    (v_val.cycle_id, v_val.id, v_val.valuation_at, v_units, v_val.gross_net_asset_value, v_nav,
     p_corrects_snapshot_id, v_actor)
  returning id into v_id;

  perform private.write_audit('nav.calculated', 'nav_snapshot', v_id, null,
    jsonb_build_object('cycle_id', v_val.cycle_id, 'valuation_id', v_val.id, 'nav_date', v_val.valuation_at,
      'gross_net_asset_value', v_val.gross_net_asset_value::text, 'total_outstanding_units', v_units::text,
      'gross_nav_per_unit', v_nav::text, 'corrects_snapshot_id', p_corrects_snapshot_id));
  return v_id;
end;
$$;

revoke all on function public.admin_calculate_nav(uuid, uuid) from public, anon;
grant execute on function public.admin_calculate_nav(uuid, uuid) to authenticated;

create or replace function public.admin_publish_nav(p_snapshot_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor   uuid := private.require_admin();
  v_reason  text := private.require_reason(p_reason);
  v_s       public.nav_snapshots;
  v_val     public.valuation_status;
  v_cycle   public.cycle_status;
  v_units   numeric;
  v_latest  timestamptz;
  v_changes integer;
  v_now     timestamptz := clock_timestamp();
begin
  select * into v_s from public.nav_snapshots where id = p_snapshot_id for update;
  if not found then
    raise exception 'NAV snapshot not found.' using errcode = 'no_data_found';
  end if;
  if v_s.status <> 'draft' then
    raise exception 'Only draft NAVs can be published (this one is %).', v_s.status using errcode = 'check_violation';
  end if;

  select status into v_cycle from public.investment_cycles where id = v_s.cycle_id for share;
  if v_cycle not in ('open', 'active', 'closed') then
    raise exception 'NAV can be published for open, active or closed cycles (this one is %).', v_cycle
      using errcode = 'check_violation';
  end if;

  -- Re-validate: the inputs must still be exactly what was calculated.
  select status into v_val from public.portfolio_valuations where id = v_s.valuation_id;
  if v_val <> 'approved' then
    raise exception 'The valuation behind this NAV is no longer approved (%). Recalculate from the current valuation.', v_val
      using errcode = 'check_violation';
  end if;
  v_units := private.units_as_of(v_s.cycle_id, v_s.nav_date);
  if v_units <> v_s.total_outstanding_units then
    raise exception 'Outstanding units changed since this NAV was calculated. Recalculate it.' using errcode = 'check_violation';
  end if;

  if v_s.corrects_snapshot_id is null then
    v_changes := private.ledger_changes_after(v_s.cycle_id, v_s.nav_date);
    if v_changes > 0 then
      raise exception 'Units changed after the valuation time. Record and approve a newer valuation, then recalculate.'
        using errcode = 'check_violation';
    end if;
    select max(nav_date) into v_latest from public.nav_snapshots
    where cycle_id = v_s.cycle_id and status = 'published';
    if v_latest is not null and v_s.nav_date <= v_latest then
      raise exception 'A NAV as of the same or a later time is already published.' using errcode = 'check_violation';
    end if;
  else
    update public.nav_snapshots
    set status = 'corrected', corrected_by_snapshot_id = v_s.id, corrected_at = v_now
    where id = v_s.corrects_snapshot_id and status = 'published';
    if not found then
      raise exception 'The NAV being corrected is no longer published.' using errcode = 'check_violation';
    end if;
    perform private.write_audit('nav.corrected', 'nav_snapshot', v_s.corrects_snapshot_id,
      jsonb_build_object('status', 'published'),
      jsonb_build_object('status', 'corrected', 'corrected_by_snapshot_id', v_s.id,
                         'new_gross_nav_per_unit', v_s.gross_nav_per_unit::text),
      v_reason);
  end if;

  update public.nav_snapshots
  set status = 'published', published_by = v_actor, published_at = v_now, publish_reason = v_reason
  where id = v_s.id;

  perform private.write_audit('nav.published', 'nav_snapshot', v_s.id,
    jsonb_build_object('status', 'draft'),
    jsonb_build_object('status', 'published', 'nav_date', v_s.nav_date,
      'gross_nav_per_unit', v_s.gross_nav_per_unit::text,
      'total_outstanding_units', v_s.total_outstanding_units::text,
      'gross_net_asset_value', v_s.gross_net_asset_value::text,
      'corrects_snapshot_id', v_s.corrects_snapshot_id),
    v_reason);
end;
$$;

revoke all on function public.admin_publish_nav(uuid, text) from public, anon;
grant execute on function public.admin_publish_nav(uuid, text) to authenticated;

create or replace function public.admin_discard_nav_draft(p_snapshot_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor  uuid := private.require_admin();
  v_reason text := private.require_reason(p_reason);
  v_status public.nav_snapshot_status;
begin
  select status into v_status from public.nav_snapshots where id = p_snapshot_id for update;
  if not found then
    raise exception 'NAV snapshot not found.' using errcode = 'no_data_found';
  end if;
  if v_status <> 'draft' then
    raise exception 'Only draft NAVs can be discarded (this one is %).', v_status using errcode = 'check_violation';
  end if;
  update public.nav_snapshots set status = 'discarded', discarded_at = clock_timestamp() where id = p_snapshot_id;
  perform private.write_audit('nav.discarded', 'nav_snapshot', p_snapshot_id,
    jsonb_build_object('status', 'draft'), jsonb_build_object('status', 'discarded'), v_reason);
end;
$$;

revoke all on function public.admin_discard_nav_draft(uuid, text) from public, anon;
grant execute on function public.admin_discard_nav_draft(uuid, text) to authenticated;
