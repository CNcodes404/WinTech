-- =============================================================================
-- Tests for admin_reset_demo_data (rollback-only; the reset runs and is undone).
-- Expected final output:   ALL_RESET_TESTS_PASSED (n checks)
-- =============================================================================
do $$
declare
  v_admin   uuid := gen_random_uuid();
  v_client  uuid := gen_random_uuid();
  v_cycle   uuid;
  v_c       uuid;
  v_val     uuid;
  v_valc    uuid;
  v_snap    uuid;
  v_snapc   uuid;
  v_t       timestamptz;
  v_users   int;
  v_paudit  int;
  v_n       int;
  v_result  jsonb;
  v_raised  boolean;
  v_checks  int := 0;
begin
  insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, email_confirmed_at, created_at, updated_at)
  values
    (v_admin,  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rtest-admin@example.test', '{"full_name":"R Admin"}', now(), now(), now()),
    (v_client, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rtest-client@example.test', '{"full_name":"R Client"}', now(), now(), now());
  update public.profiles set role = 'admin' where id = v_admin;

  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';

  -- Build data including correction chains (NAV corrected, valuation superseded).
  v_cycle := public.admin_create_cycle('RTest Cycle', null, current_date - 10, current_date + 300, 100, 0.2);
  perform public.admin_set_cycle_status(v_cycle, 'open', 'Open for test');
  v_c := public.admin_record_contribution(v_cycle, v_client, 100000, now() - interval '1 hour', 'upi', 'R-1', 'note');
  perform public.admin_verify_contribution(v_c, 'Verified for test');
  perform public.admin_add_fee_terms(v_cycle, 0.25, now() + interval '30 days', 'Scheduled change');
  perform pg_sleep(0.02);
  v_t := clock_timestamp();
  v_val := public.admin_save_valuation_draft(null, v_cycle, v_t, '110000', '0', '0', null, '[{"symbol":"INFY","quantity":"1","valuation_price":"10"}]');
  perform public.admin_approve_valuation(v_val, 'Approve for test');
  v_snap := public.admin_calculate_nav(v_val, null);
  perform public.admin_publish_nav(v_snap, 'Publish for test');
  v_valc := public.admin_save_valuation_draft(null, v_cycle, v_t, '108000', '0', '0', null, '[]', v_val);
  perform public.admin_approve_valuation(v_valc, 'Correct for test');
  v_snapc := public.admin_calculate_nav(v_valc, v_snap);
  perform public.admin_publish_nav(v_snapc, 'Publish correction');

  select count(*) into v_users from public.profiles;
  select count(*) into v_paudit from public.audit_logs where entity_type = 'profile';

  -- Client cannot reset.
  perform set_config('request.jwt.claims', json_build_object('sub', v_client, 'role', 'authenticated')::text, true);
  v_raised := false;
  begin
    perform public.admin_reset_demo_data('ERASE ALL DATA', 'Client attempt');
  exception when insufficient_privilege then v_raised := true;
  end;
  if not v_raised then raise exception 'TEST FAILED: client could reset data'; end if;
  v_checks := v_checks + 1;

  -- Wrong phrase / missing reason.
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  v_raised := false;
  begin
    perform public.admin_reset_demo_data('erase all data', 'Wrong case phrase');
  exception when invalid_parameter_value then v_raised := true;
  end;
  if not v_raised then raise exception 'TEST FAILED: wrong confirmation phrase accepted'; end if;
  v_raised := false;
  begin
    perform public.admin_reset_demo_data('ERASE ALL DATA', 'no');
  exception when invalid_parameter_value then v_raised := true;
  end;
  if not v_raised then raise exception 'TEST FAILED: reset without a reason accepted'; end if;
  v_checks := v_checks + 1;

  -- Server-side switch.
  execute 'set local role postgres';
  update private.app_config set value = 'false'::jsonb where key = 'demo_reset_enabled';
  execute 'set local role authenticated';
  v_raised := false;
  begin
    perform public.admin_reset_demo_data('ERASE ALL DATA', 'Switch is off');
  exception when check_violation then v_raised := true;
  end;
  if not v_raised then raise exception 'TEST FAILED: reset ran while disabled'; end if;
  execute 'set local role postgres';
  update private.app_config set value = 'true'::jsonb where key = 'demo_reset_enabled';
  execute 'set local role authenticated';
  v_checks := v_checks + 1;

  -- Reset.
  v_result := public.admin_reset_demo_data('ERASE ALL DATA', 'Fresh start for demo');
  if (v_result ->> 'cycles')::int < 1 or (v_result ->> 'nav_snapshots')::int < 2 then
    raise exception 'TEST FAILED: reset summary incomplete: %', v_result;
  end if;
  v_checks := v_checks + 1;

  execute 'set local role postgres';
  select (select count(*) from public.investment_cycles) + (select count(*) from public.cycle_fee_terms)
       + (select count(*) from public.contributions) + (select count(*) from public.client_unit_allocations)
       + (select count(*) from public.portfolio_valuations) + (select count(*) from public.portfolio_valuation_items)
       + (select count(*) from public.nav_snapshots) + (select count(*) from public.lot_fee_accruals)
       + (select count(*) from public.fee_crystallisations)
    into v_n;
  if v_n <> 0 then raise exception 'TEST FAILED: % business rows remain after reset', v_n; end if;
  v_checks := v_checks + 1;

  select count(*) into v_n from public.profiles;
  if v_n <> v_users then raise exception 'TEST FAILED: users changed (% → %)', v_users, v_n; end if;
  select count(*) into v_n from public.audit_logs where entity_type = 'profile';
  if v_n <> v_paudit then raise exception 'TEST FAILED: profile history changed'; end if;
  select count(*) into v_n from public.audit_logs where entity_type <> 'profile';
  if v_n <> 1 then raise exception 'TEST FAILED: expected only the reset entry, found % non-profile entries', v_n; end if;
  select count(*) into v_n from public.audit_logs
   where action = 'maintenance.data_reset' and actor_id = v_admin and reason = 'Fresh start for demo';
  if v_n <> 1 then raise exception 'TEST FAILED: reset not audited'; end if;
  v_checks := v_checks + 1;

  -- Guards are back on.
  select count(*) into v_n from pg_trigger t join pg_class c on c.oid = t.tgrelid join pg_namespace s on s.oid = c.relnamespace
   where s.nspname = 'public' and not t.tgisinternal and t.tgenabled = 'D';
  if v_n <> 0 then raise exception 'TEST FAILED: % guard trigger(s) left disabled', v_n; end if;
  v_raised := false;
  begin
    delete from public.audit_logs where action = 'maintenance.data_reset';
  exception when insufficient_privilege then v_raised := true;
  end;
  if not v_raised then raise exception 'TEST FAILED: audit log deletable after reset'; end if;
  v_checks := v_checks + 1;

  -- The app works normally after a reset.
  execute 'set local role authenticated';
  v_cycle := public.admin_create_cycle('RTest After Reset', null, current_date, current_date + 30, 100, 0.2);
  if v_cycle is null then raise exception 'TEST FAILED: could not create a cycle after reset'; end if;
  v_checks := v_checks + 1;

  raise exception 'ALL_RESET_TESTS_PASSED (% checks)', v_checks;
end;
$$;
