-- =============================================================================
-- Admin "reset demo data" (requested by the project owner, 14 Nov 2026)
--
-- Erases ALL business data so a demo can start fresh, while keeping every user:
--   deleted : fee accruals, fee crystallisations, NAV snapshots, valuation lines,
--             valuations, unit ledger, contributions, fee terms, cycles, and all
--             audit entries EXCEPT those about user accounts (entity_type 'profile').
--   kept    : auth users, profiles (role/status/contact unchanged), profile
--             history in the audit log.
--
-- This is the only sanctioned exception to the append-only design. Safeguards:
--   * active admin only, typed confirmation phrase, mandatory reason;
--   * a server-side switch (private.app_config.demo_reset_enabled) — set it to
--     false before any real use and the function refuses to run;
--   * runs atomically: guards are disabled and re-enabled inside the same
--     transaction (FK constraint triggers stay on); any failure rolls back all;
--   * one audit entry 'maintenance.data_reset' records who, why and what.
-- =============================================================================

create table private.app_config (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now()
);

comment on table private.app_config is
  'Server-side switches not editable through the API. demo_reset_enabled=false disables admin_reset_demo_data().';

insert into private.app_config (key, value) values ('demo_reset_enabled', 'true'::jsonb);

revoke all on private.app_config from public, anon, authenticated;

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
  delete from public.lot_fee_accruals;
  delete from public.fee_crystallisations;
  update public.nav_snapshots
     set status = 'discarded', published_at = null, corrected_at = null, discarded_at = now(),
         corrects_snapshot_id = null, corrected_by_snapshot_id = null;
  delete from public.nav_snapshots;
  delete from public.portfolio_valuation_items;
  update public.portfolio_valuations
     set status = 'discarded', approved_at = null, superseded_at = null, discarded_at = now(),
         corrects_valuation_id = null, superseded_by = null;
  delete from public.portfolio_valuations;
  delete from public.client_unit_allocations;
  delete from public.contributions;
  delete from public.cycle_fee_terms;
  delete from public.investment_cycles;
  delete from public.audit_logs where entity_type <> 'profile';

  foreach t in array v_tables loop
    execute format('alter table public.%I enable trigger user', t);
  end loop;

  perform private.write_audit('maintenance.data_reset', 'maintenance', null, v_counts, null, v_reason, v_actor);
  return v_counts;
end;
$$;

revoke all on function public.admin_reset_demo_data(text, text) from public, anon;
grant execute on function public.admin_reset_demo_data(text, text) to authenticated;
