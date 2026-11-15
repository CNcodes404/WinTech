-- =============================================================================
-- Monthly admin fee (owner request, 15 Nov 2026)
--
-- investment_cycles.admin_fee_amount is now a MONTHLY fee per client (default ₹100).
-- Admin fee due = admin_fee_amount × completed months, counted per client
--   from the client's FIRST investment in the cycle (first unit issue)
--   to the as-of date (the NAV date being shown; "now" before any NAV),
--   in India time. Completed months only: joined 1 Jan, NAV 15 Mar → 2 months.
-- =============================================================================

comment on column public.investment_cycles.admin_fee_amount is
  'Admin fee in ₹ per client per COMPLETED MONTH since the client''s first investment (shown to clients).';

alter table public.investment_cycles alter column admin_fee_amount set default 100;

-- Existing cycles still on the old flat default (₹1,000) move to the new monthly default (₹100).
select set_config('app.audit_reason', 'Admin fee changed to a monthly fee (default ₹100 per month).', true);
update public.investment_cycles set admin_fee_amount = 100
where admin_fee_amount = 1000 and status <> 'settled';

-- Completed calendar months between two instants, in India time (never negative).
create or replace function private.completed_months(p_from timestamptz, p_to timestamptz)
returns integer
language sql
stable
set search_path = ''
as $$
  select case
    when p_from is null or p_to is null or p_to <= p_from then 0
    else (extract(year from age(p_to at time zone 'Asia/Kolkata', p_from at time zone 'Asia/Kolkata')) * 12
        + extract(month from age(p_to at time zone 'Asia/Kolkata', p_from at time zone 'Asia/Kolkata')))::integer
  end;
$$;

revoke all on function private.completed_months(timestamptz, timestamptz) from public, anon, authenticated;

-- Default for new cycles: ₹100 per month.
create or replace function public.admin_create_cycle(
  p_name        text,
  p_description text,
  p_start_date  date,
  p_end_date    date,
  p_base_nav    numeric,
  p_fee_rate    numeric,
  p_admin_fee   numeric default 100
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
      'base_nav', p_base_nav::text, 'admin_fee_amount', p_admin_fee::text, 'admin_fee_basis', 'per_month',
      'status', 'draft', 'currency', 'INR'
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

-- ---------------------------------------------------------------------------
-- Admin position report: admin fee = monthly fee × completed months as of the NAV.
-- ---------------------------------------------------------------------------
drop view public.client_position_report;

create view public.client_position_report
with (security_invoker = true)
as
select
  s.id as snapshot_id, s.cycle_id, s.nav_date, s.status as snapshot_status,
  x.client_id, p.full_name as client_name, p.email as client_email,
  x.units, x.contributed, x.first_invested_at,
  s.gross_nav_per_unit, s.net_nav_per_unit,
  round(x.units * s.gross_nav_per_unit, 2) as gross_value,
  round(x.units * s.net_nav_per_unit, 2) as net_value,
  round(x.units * s.gross_nav_per_unit, 2) - round(x.units * s.net_nav_per_unit, 2) as performance_fee_share,
  round(x.units * s.net_nav_per_unit, 2) - x.contributed as profit,
  cy.admin_fee_amount as admin_fee_monthly,
  m.months as admin_fee_months,
  cy.admin_fee_amount * m.months as admin_fee,
  round(x.units * s.net_nav_per_unit, 2) - x.contributed - cy.admin_fee_amount * m.months as final_profit,
  round(x.units * s.net_nav_per_unit, 2) - cy.admin_fee_amount * m.months as final_value
from public.nav_snapshots s
join public.investment_cycles cy on cy.id = s.cycle_id
cross join lateral (
  select a.client_id, sum(a.units) as units, sum(a.amount) as contributed,
         min(a.created_at) filter (where a.entry_type = 'issue') as first_invested_at
  from public.client_unit_allocations a
  where a.cycle_id = s.cycle_id and a.created_at <= s.nav_date
  group by a.client_id
) x
cross join lateral (select private.completed_months(x.first_invested_at, s.nav_date) as months) m
join public.profiles p on p.id = x.client_id
where x.units > 0 and s.calculation_version = 'fund_level_v2';

comment on view public.client_position_report is
  'Admin-only: per-client value, profit, performance-fee share and monthly admin fee at each fund_level_v2 NAV.';

revoke all on public.client_position_report from anon, authenticated;
grant select on public.client_position_report to authenticated;

-- ---------------------------------------------------------------------------
-- Cycle-close record: admin fee total = Σ per-client monthly fees at the closing NAV.
-- (admin_fee_per_client now records the monthly fee in force.)
-- ---------------------------------------------------------------------------
comment on column public.fee_crystallisations.admin_fee_per_client is 'Monthly admin fee per client at close.';

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
  v_total   numeric;
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

  select count(*), coalesce(sum(r.admin_fee), 0) into v_clients, v_total
  from public.client_position_report r where r.snapshot_id = v_snap.id;

  insert into public.fee_crystallisations
    (cycle_id, snapshot_id, total_fee_amount, net_nav_per_unit, note, recorded_by,
     admin_fee_per_client, clients_charged, admin_fee_total)
  values (p_cycle_id, v_snap.id, coalesce(v_snap.performance_fee_amount, 0), v_snap.net_nav_per_unit, v_note, v_actor,
          v_cycle.admin_fee_amount, v_clients, v_total)
  returning id into v_id;

  perform private.write_audit('fees.crystallised', 'cycle', p_cycle_id, null,
    jsonb_build_object('snapshot_id', v_snap.id, 'nav_date', v_snap.nav_date,
      'total_fee_amount', v_snap.performance_fee_amount::text,
      'net_nav_per_unit', v_snap.net_nav_per_unit::text,
      'admin_fee_monthly', v_cycle.admin_fee_amount::text, 'clients_charged', v_clients,
      'admin_fee_total', v_total::text, 'informational', true),
    v_note);
  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Client view: admin fee = monthly fee × completed months since the client's first investment,
-- up to the latest NAV date (or now, before the first NAV).
-- ---------------------------------------------------------------------------
drop function public.client_my_cycles();

create function public.client_my_cycles()
returns table (
  cycle_id          uuid,
  cycle_name        text,
  cycle_status      text,
  start_date        date,
  end_date          date,
  base_nav          text,
  units             text,
  net_contributed   text,
  latest_nav_date   timestamptz,
  latest_nav        text,
  current_value     text,
  profit            text,
  admin_fee_monthly text,
  admin_fee_months  integer,
  admin_fee         text,
  final_profit      text,
  final_value       text,
  first_invested_at timestamptz
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
    select a.cycle_id, sum(a.units) as units, sum(a.amount) as net_contributed,
           min(a.created_at) filter (where a.entry_type = 'issue') as first_at
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
           m.admin_fee_amount as monthly,
           case when coalesce(h.units, 0) > 0
                then private.completed_months(h.first_at, coalesce(l.nav_date, now())) else 0 end as months,
           h.first_at
    from mine m
    left join holding h on h.cycle_id = m.id
    left join latest l on l.cycle_id = m.id
  )
  select m.id, m.name, m.status::text, m.start_date, m.end_date, m.base_nav::text,
         v.units::text, v.contributed::text,
         l.nav_date, l.nav::text,
         v.value::text, (v.value - v.contributed)::text,
         v.monthly::text, v.months, (v.monthly * v.months)::text,
         (v.value - v.contributed - v.monthly * v.months)::text, (v.value - v.monthly * v.months)::text,
         v.first_at
  from mine m
  join valued v on v.cycle_id = m.id
  left join latest l on l.cycle_id = m.id
  order by m.start_date desc;
end;
$$;

revoke all on function public.client_my_cycles() from public, anon;
grant execute on function public.client_my_cycles() to authenticated;
