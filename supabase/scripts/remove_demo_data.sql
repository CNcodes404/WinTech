-- =============================================================================
-- One-off maintenance: remove the fictional DEMO financial data (approved by the
-- project owner on 13 Nov 2026). User accounts and their profile audit entries
-- are kept unchanged.
--
-- Financial tables are append-only by design. This script is the ONLY sanctioned
-- exception: inside one atomic DO block it disables the user-defined guard
-- triggers (foreign-key constraint triggers stay ON), deletes the demo cycle's
-- records in dependency order, re-enables the guards, and writes one audit entry
-- describing the cleanup. Any failure rolls back everything, guards included.
--
-- Run: npx supabase db query --remote -f supabase/scripts/remove_demo_data.sql
-- =============================================================================
do $$
declare
  v_name   constant text := 'Demo Growth Cycle FY2026-27 (fictional)';
  v_cycle  uuid;
  v_admin  uuid;
  v_ids    uuid[];
  v_counts jsonb;
  v_audit  integer;
  t        text;
  v_tables constant text[] := array[
    'lot_fee_accruals', 'fee_crystallisations', 'nav_snapshots', 'portfolio_valuation_items',
    'portfolio_valuations', 'client_unit_allocations', 'contributions', 'cycle_fee_terms',
    'investment_cycles', 'audit_logs'
  ];
begin
  execute 'set local role postgres';

  select id into v_cycle from public.investment_cycles where name = v_name;
  if v_cycle is null then
    raise notice 'No demo cycle found; nothing to remove.';
    return;
  end if;

  select id into v_admin from public.profiles
   where role = 'admin' and status = 'active' order by created_at limit 1;

  -- Every entity id belonging to the demo cycle (for its audit entries).
  select array_agg(x) into v_ids from (
    select v_cycle as x
    union all select id from public.contributions where cycle_id = v_cycle
    union all select id from public.portfolio_valuations where cycle_id = v_cycle
    union all select id from public.nav_snapshots where cycle_id = v_cycle
  ) s;

  v_counts := jsonb_build_object(
    'cycle', v_name,
    'contributions', (select count(*) from public.contributions where cycle_id = v_cycle),
    'ledger_rows', (select count(*) from public.client_unit_allocations where cycle_id = v_cycle),
    'valuations', (select count(*) from public.portfolio_valuations where cycle_id = v_cycle),
    'valuation_items', (select count(*) from public.portfolio_valuation_items i
                         join public.portfolio_valuations v on v.id = i.valuation_id where v.cycle_id = v_cycle),
    'nav_snapshots', (select count(*) from public.nav_snapshots where cycle_id = v_cycle),
    'fee_accruals', (select count(*) from public.lot_fee_accruals where cycle_id = v_cycle),
    'fee_terms', (select count(*) from public.cycle_fee_terms where cycle_id = v_cycle),
    'audit_entries', (select count(*) from public.audit_logs where entity_id = any (v_ids))
  );

  -- Guards off (user triggers only; FK constraint triggers remain active).
  foreach t in array v_tables loop
    execute format('alter table public.%I disable trigger user', t);
  end loop;

  delete from public.lot_fee_accruals where cycle_id = v_cycle;
  delete from public.fee_crystallisations where cycle_id = v_cycle;
  delete from public.nav_snapshots where cycle_id = v_cycle;
  delete from public.portfolio_valuation_items
   where valuation_id in (select id from public.portfolio_valuations where cycle_id = v_cycle);
  delete from public.portfolio_valuations where cycle_id = v_cycle;
  delete from public.client_unit_allocations where cycle_id = v_cycle;
  delete from public.contributions where cycle_id = v_cycle;
  delete from public.cycle_fee_terms where cycle_id = v_cycle;
  delete from public.investment_cycles where id = v_cycle;
  delete from public.audit_logs where entity_id = any (v_ids);

  -- Guards back on.
  foreach t in array v_tables loop
    execute format('alter table public.%I enable trigger user', t);
  end loop;

  perform private.write_audit(
    'maintenance.demo_data_removed', 'maintenance', null, v_counts, null,
    'Fictional demo financial data removed at the project owner''s request; user accounts kept.',
    v_admin
  );

  select count(*) into v_audit from public.audit_logs where entity_id = any (v_ids);
  if exists (select 1 from public.investment_cycles where id = v_cycle) or v_audit > 0 then
    raise exception 'Cleanup verification failed; rolling back.';
  end if;

  raise notice 'Removed: %', v_counts;
end;
$$;
