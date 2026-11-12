-- =============================================================================
-- Module 10: per-lot performance-fee accruals (approved model, DEMO ONLY)
--
-- Method "per_lot_hwm_v1" (Decisions A, C, D; approved 2026-11-12):
--   For each contribution lot alive at a NAV snapshot's as-of time:
--     eligible_profit_per_unit = max(0, gross_nav − lot reference HWM)   -- HWM = entry NAV
--     fee_amount     = ROUND(units × eligible_profit_per_unit × lot fee_rate, 2)
--     gross_value    = ROUND(units × gross_nav, 2)
--     net_value      = gross_value − fee_amount
--     loss_to_recover= ROUND(units × max(0, HWM − gross_nav), 2)  (shown; no fee until recovered)
--   * The HWM stays at the entry NAV for the whole cycle (fees are accrued, not
--     charged, during a cycle; each cycle starts fresh). Losses are therefore
--     always recovered before any fee applies, and later entrants are never
--     charged for gains made before they joined.
--   * The fee is never negative.
--   * Snapshot totals: performance_fee_amount = Σ fee_amount;
--     net_nav_per_unit = ROUND((net asset value − Σ fee) / units, 8) — a
--     weighted average, labelled as such in the UI.
--   * Accruals are computed automatically when a snapshot is created (draft),
--     frozen when it is published, and never edited or deleted.
--   * Fee crystallisation at cycle close is recorded for information only.
-- =============================================================================

alter table public.nav_snapshots alter column calculation_version set default 'per_lot_hwm_v1';

create table public.lot_fee_accruals (
  id                         uuid primary key default gen_random_uuid(),
  snapshot_id                uuid not null references public.nav_snapshots (id) on delete restrict,
  cycle_id                   uuid not null references public.investment_cycles (id) on delete restrict,
  client_id                  uuid not null references public.profiles (id) on delete restrict,
  contribution_id            uuid not null references public.contributions (id) on delete restrict,
  units                      numeric(24, 8) not null check (units > 0),
  entry_nav                  numeric(20, 8) not null check (entry_nav > 0),
  reference_hwm              numeric(20, 8) not null check (reference_hwm > 0),
  fee_rate                   numeric(8, 6) not null check (fee_rate >= 0 and fee_rate < 1),
  gross_nav_per_unit         numeric(20, 8) not null check (gross_nav_per_unit > 0),
  gross_value                numeric(20, 2) not null check (gross_value >= 0),
  eligible_profit_per_unit   numeric(20, 8) not null check (eligible_profit_per_unit >= 0),
  fee_amount                 numeric(20, 2) not null check (fee_amount >= 0),
  net_value                  numeric(20, 2) not null,
  loss_to_recover            numeric(20, 2) not null check (loss_to_recover >= 0),
  method                     text not null default 'per_lot_hwm_v1' check (method = 'per_lot_hwm_v1'),
  created_at                 timestamptz not null default clock_timestamp(),
  constraint lot_fee_accruals_once unique (snapshot_id, contribution_id),
  constraint lot_fee_accruals_net check (net_value = gross_value - fee_amount),
  -- Fee and loss are mutually exclusive per lot.
  constraint lot_fee_accruals_fee_or_loss check (fee_amount = 0 or loss_to_recover = 0)
);

comment on table public.lot_fee_accruals is
  'Indicative per-lot performance-fee accruals for each NAV snapshot (method per_lot_hwm_v1, demo only). Append-only.';

create index lot_fee_accruals_snapshot_idx on public.lot_fee_accruals (snapshot_id);
create index lot_fee_accruals_client_idx on public.lot_fee_accruals (client_id, cycle_id);

create trigger lot_fee_accruals_no_update_delete
  before update or delete on public.lot_fee_accruals
  for each row execute function private.reject_audit_mutation();
create trigger lot_fee_accruals_no_truncate
  before truncate on public.lot_fee_accruals
  for each statement execute function private.reject_audit_mutation();

-- ---------------------------------------------------------------------------
-- Accrue fees for every lot alive at the snapshot's as-of time.
-- A lot is alive if issued at or before nav_date and not reversed at or before it,
-- so Σ lot units = private.units_as_of(cycle, nav_date) = snapshot units.
-- ---------------------------------------------------------------------------
create or replace function private.accrue_lot_fees()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_fee_total  numeric;
  v_units      numeric;
begin
  insert into public.lot_fee_accruals
    (snapshot_id, cycle_id, client_id, contribution_id, units, entry_nav, reference_hwm, fee_rate,
     gross_nav_per_unit, gross_value, eligible_profit_per_unit, fee_amount, net_value, loss_to_recover)
  select
    new.id, a.cycle_id, a.client_id, a.contribution_id, a.units, a.entry_nav, a.reference_hwm, a.fee_rate,
    new.gross_nav_per_unit,
    round(a.units * new.gross_nav_per_unit, 2),
    greatest(new.gross_nav_per_unit - a.reference_hwm, 0),
    round(a.units * greatest(new.gross_nav_per_unit - a.reference_hwm, 0) * a.fee_rate, 2),
    round(a.units * new.gross_nav_per_unit, 2)
      - round(a.units * greatest(new.gross_nav_per_unit - a.reference_hwm, 0) * a.fee_rate, 2),
    round(a.units * greatest(a.reference_hwm - new.gross_nav_per_unit, 0), 2)
  from public.client_unit_allocations a
  where a.cycle_id = new.cycle_id
    and a.entry_type = 'issue'
    and a.created_at <= new.nav_date
    and not exists (
      select 1 from public.client_unit_allocations r
      where r.contribution_id = a.contribution_id and r.entry_type = 'reversal' and r.created_at <= new.nav_date
    );

  select coalesce(sum(fee_amount), 0), coalesce(sum(units), 0)
    into v_fee_total, v_units
  from public.lot_fee_accruals where snapshot_id = new.id;

  if v_units <> new.total_outstanding_units then
    raise exception 'Lot units (%) do not match snapshot units (%).', v_units, new.total_outstanding_units
      using errcode = 'check_violation';
  end if;

  update public.nav_snapshots
  set performance_fee_amount = v_fee_total,
      net_nav_per_unit = round((new.gross_net_asset_value - v_fee_total)::numeric(38, 20) / new.total_outstanding_units, 8)
  where id = new.id;
  return null;
end;
$$;

revoke all on function private.accrue_lot_fees() from public, anon, authenticated;

create trigger nav_snapshots_accrue_lot_fees
  after insert on public.nav_snapshots
  for each row execute function private.accrue_lot_fees();

-- ---------------------------------------------------------------------------
-- Informational fee crystallisation at cycle close (Decision D). No money moves.
-- ---------------------------------------------------------------------------
create table public.fee_crystallisations (
  id                    uuid primary key default gen_random_uuid(),
  cycle_id              uuid not null unique references public.investment_cycles (id) on delete restrict,
  snapshot_id           uuid not null references public.nav_snapshots (id) on delete restrict,
  total_fee_amount      numeric(20, 2) not null check (total_fee_amount >= 0),
  net_nav_per_unit      numeric(20, 8) not null,
  note                  text not null check (char_length(btrim(note)) between 5 and 1000),
  recorded_by           uuid not null references public.profiles (id) on delete restrict,
  recorded_at           timestamptz not null default clock_timestamp()
);

comment on table public.fee_crystallisations is
  'Informational record of the final indicative fee at cycle close. No payment or settlement is performed.';

create trigger fee_crystallisations_no_update_delete
  before update or delete on public.fee_crystallisations
  for each row execute function private.reject_audit_mutation();

-- ---------------------------------------------------------------------------
-- Admin report view (security_invoker → RLS applies)
-- ---------------------------------------------------------------------------
create view public.lot_fee_accrual_report
with (security_invoker = true)
as
select
  f.id, f.snapshot_id, f.cycle_id, f.client_id, p.full_name as client_name, p.email as client_email,
  f.contribution_id, c.received_at, c.amount as contributed_amount,
  f.units, f.entry_nav, f.reference_hwm, f.fee_rate, f.gross_nav_per_unit, f.gross_value,
  f.eligible_profit_per_unit, f.fee_amount, f.net_value, f.loss_to_recover, f.method
from public.lot_fee_accruals f
join public.profiles p on p.id = f.client_id
join public.contributions c on c.id = f.contribution_id;

revoke all on public.lot_fee_accruals, public.fee_crystallisations, public.lot_fee_accrual_report
  from anon, authenticated;
grant select on public.lot_fee_accruals, public.fee_crystallisations, public.lot_fee_accrual_report
  to authenticated;

alter table public.lot_fee_accruals enable row level security;
alter table public.fee_crystallisations enable row level security;
create policy lot_fee_accruals_select_admin on public.lot_fee_accruals
  for select to authenticated using ((select private.is_admin()));
create policy fee_crystallisations_select_admin on public.fee_crystallisations
  for select to authenticated using ((select private.is_admin()));

-- ---------------------------------------------------------------------------
-- Admin API: record the informational crystallisation for a closed cycle.
-- ---------------------------------------------------------------------------
create or replace function public.admin_record_fee_crystallisation(p_cycle_id uuid, p_note text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor  uuid := private.require_admin();
  v_note   text := private.require_reason(p_note);
  v_status public.cycle_status;
  v_snap   public.nav_snapshots;
  v_id     uuid;
begin
  select status into v_status from public.investment_cycles where id = p_cycle_id for update;
  if not found then
    raise exception 'Cycle not found.' using errcode = 'no_data_found';
  end if;
  if v_status <> 'closed' then
    raise exception 'The final fee can only be recorded after the cycle is closed (it is %).', v_status
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

  insert into public.fee_crystallisations
    (cycle_id, snapshot_id, total_fee_amount, net_nav_per_unit, note, recorded_by)
  values (p_cycle_id, v_snap.id, v_snap.performance_fee_amount, v_snap.net_nav_per_unit, v_note, v_actor)
  returning id into v_id;

  perform private.write_audit('fees.crystallised', 'cycle', p_cycle_id, null,
    jsonb_build_object('snapshot_id', v_snap.id, 'nav_date', v_snap.nav_date,
      'total_fee_amount', v_snap.performance_fee_amount::text,
      'net_nav_per_unit', v_snap.net_nav_per_unit::text, 'informational', true),
    v_note);
  return v_id;
end;
$$;

revoke all on function public.admin_record_fee_crystallisation(uuid, text) from public, anon;
grant execute on function public.admin_record_fee_crystallisation(uuid, text) to authenticated;
