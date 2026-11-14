-- =============================================================================
-- Fix: admin_reset_demo_data failed when called from the app.
-- Supabase loads pg-safeupdate for API (PostgREST) sessions, which rejects DELETE/UPDATE
-- without a WHERE clause ("DELETE requires a WHERE clause"). Direct SQL and the test suite
-- don't load it, so they passed. Every statement now has an explicit WHERE.
-- =============================================================================

create or replace function public.admin_reset_demo_data(p_confirmation text, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor   uuid := private.require_admin();
  v_reason  text := private.require_reason(p_reason);
  v_enabled boolean;
  v_counts  jsonb;
  t         text;
  v_tables  constant text[] := array[
    'lot_fee_accruals', 'fee_crystallisations', 'nav_snapshots', 'portfolio_valuation_items',
    'portfolio_valuations', 'client_unit_allocations', 'contributions', 'cycle_fee_terms',
    'investment_cycles', 'audit_logs'
  ];
begin
  select (value)::boolean into v_enabled from private.app_config where key = 'demo_reset_enabled';
  if not coalesce(v_enabled, false) then
    raise exception 'Resetting data is disabled on this system.' using errcode = 'check_violation';
  end if;
  if coalesce(btrim(p_confirmation), '') <> 'ERASE ALL DATA' then
    raise exception 'Type ERASE ALL DATA exactly to confirm.' using errcode = 'invalid_parameter_value';
  end if;

  v_counts := jsonb_build_object(
    'cycles', (select count(*) from public.investment_cycles),
    'fee_terms', (select count(*) from public.cycle_fee_terms),
    'contributions', (select count(*) from public.contributions),
    'ledger_rows', (select count(*) from public.client_unit_allocations),
    'valuations', (select count(*) from public.portfolio_valuations),
    'valuation_items', (select count(*) from public.portfolio_valuation_items),
    'nav_snapshots', (select count(*) from public.nav_snapshots),
    'fee_accruals', (select count(*) from public.lot_fee_accruals),
    'fee_crystallisations', (select count(*) from public.fee_crystallisations),
    'audit_entries', (select count(*) from public.audit_logs where entity_type <> 'profile'),
    'users_kept', (select count(*) from public.profiles)
  );

  foreach t in array v_tables loop
    execute format('alter table public.%I disable trigger user', t);
  end loop;

  -- Dependency order (children first). Correction chains reference each other in both
  -- directions, so rows are first unlinked; they are marked 'discarded' in the same update
  -- so every status consistency constraint still holds, then deleted.
  delete from public.lot_fee_accruals where true;
  delete from public.fee_crystallisations where true;
  update public.nav_snapshots
     set status = 'discarded', published_at = null, corrected_at = null, discarded_at = now(),
         corrects_snapshot_id = null, corrected_by_snapshot_id = null
   where true;
  delete from public.nav_snapshots where true;
  delete from public.portfolio_valuation_items where true;
  update public.portfolio_valuations
     set status = 'discarded', approved_at = null, superseded_at = null, discarded_at = now(),
         corrects_valuation_id = null, superseded_by = null
   where true;
  delete from public.portfolio_valuations where true;
  delete from public.client_unit_allocations where true;
  delete from public.contributions where true;
  delete from public.cycle_fee_terms where true;
  delete from public.investment_cycles where true;
  delete from public.audit_logs where entity_type <> 'profile';

  foreach t in array v_tables loop
    execute format('alter table public.%I enable trigger user', t);
  end loop;

  perform private.write_audit('maintenance.data_reset', 'maintenance', null, v_counts, null, v_reason, v_actor);
  return v_counts;
end;
$$;
