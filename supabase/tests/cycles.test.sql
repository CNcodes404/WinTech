-- =============================================================================
-- Tests for investment cycles and versioned fee terms (Module 6)
--
-- SAFE TO RUN AGAINST ANY DATABASE: one DO block that always ends by raising an
-- exception, so every change is rolled back. Note: now() is constant inside a
-- transaction, which makes the effective-date checks deterministic.
--
-- Expected final output:   ALL_CYCLE_TESTS_PASSED (n checks)
-- Run: npx supabase db query --remote --yes -f supabase/tests/cycles.test.sql
-- =============================================================================
do $$
declare
  v_admin  uuid := gen_random_uuid();
  v_client uuid := gen_random_uuid();
  v_cycle  uuid;
  v_cycle2 uuid;
  v_terms  uuid;
  v_n      int;
  v_num    numeric;
  v_text   text;
  v_raised boolean;
  v_checks int := 0;
  v_ov     record;
begin
  insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, email_confirmed_at, created_at, updated_at)
  values
    (v_admin, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'cycle-test-admin@example.test', '{"full_name":"Cycle Admin"}', now(), now(), now()),
    (v_client, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'cycle-test-client@example.test', '{"full_name":"Cycle Client"}', now(), now(), now());
  update public.profiles set role = 'admin' where id = v_admin;

  -- ================================================================ client
  perform set_config('request.jwt.claims', json_build_object('sub', v_client, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';

  v_raised := false;
  begin
    perform public.admin_create_cycle('Client Cycle', null, current_date, current_date + 30, 100, 0.2);
  exception when insufficient_privilege then v_raised := true;
  end;
  if not v_raised then raise exception 'TEST FAILED: client could create a cycle'; end if;
  v_checks := v_checks + 1;

  v_raised := false;
  begin
    insert into public.investment_cycles (name, start_date, end_date, created_by)
    values ('Direct insert', current_date, current_date + 1, v_client);
  exception when insufficient_privilege then v_raised := true;
  end;
  if not v_raised then raise exception 'TEST FAILED: client could insert a cycle directly'; end if;
  v_checks := v_checks + 1;

  -- ================================================================ admin
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);

  -- Validation
  v_raised := false;
  begin
    perform public.admin_create_cycle('Bad dates', null, current_date, current_date, 100, 0.2);
  exception when invalid_parameter_value then v_raised := true;
  end;
  if not v_raised then raise exception 'TEST FAILED: end date = start date accepted'; end if;
  v_checks := v_checks + 1;

  v_raised := false;
  begin
    perform public.admin_create_cycle('Zero NAV', null, current_date, current_date + 30, 0, 0.2);
  exception when invalid_parameter_value then v_raised := true;
  end;
  if not v_raised then raise exception 'TEST FAILED: base NAV 0 accepted'; end if;
  v_checks := v_checks + 1;

  v_raised := false;
  begin
    perform public.admin_create_cycle('Full fee', null, current_date, current_date + 30, 100, 1.0);
  exception when invalid_parameter_value then v_raised := true;
  end;
  if not v_raised then raise exception 'TEST FAILED: 100%% fee accepted'; end if;
  v_checks := v_checks + 1;

  v_raised := false;
  begin
    perform public.admin_create_cycle('Too precise', null, current_date, current_date + 30, 100, 0.1234567);
  exception when invalid_parameter_value then v_raised := true;
  end;
  if not v_raised then raise exception 'TEST FAILED: 7-dp fee rate accepted'; end if;
  v_checks := v_checks + 1;

  -- Create (fee rate is configurable, not hard-coded)
  v_cycle := public.admin_create_cycle('  Test Cycle FY27  ', 'Demo cycle', current_date, current_date + 180, 100, 0.15);

  select * into v_ov from public.cycle_overview where id = v_cycle;
  if v_ov.name <> 'Test Cycle FY27' or v_ov.status <> 'draft' or v_ov.base_nav <> 100
     or v_ov.current_fee_rate <> 0.15 or v_ov.current_fee_version <> 1 or v_ov.pending_fee_rate is not null then
    raise exception 'TEST FAILED: created cycle overview incorrect: %', row_to_json(v_ov);
  end if;
  v_checks := v_checks + 1;

  v_raised := false;
  begin
    perform public.admin_create_cycle('test cycle fy27', null, current_date, current_date + 30, 100, 0.2);
  exception when check_violation then v_raised := true;
  end;
  if not v_raised then raise exception 'TEST FAILED: duplicate cycle name (case-insensitive) accepted'; end if;
  v_checks := v_checks + 1;

  select count(*) into v_n from public.audit_logs
   where entity_id = v_cycle and action in ('cycle.created', 'fee_terms.created') and actor_id = v_admin;
  if v_n <> 2 then raise exception 'TEST FAILED: creation audit rows missing (%)', v_n; end if;
  v_checks := v_checks + 1;

  -- Edit while draft (base NAV allowed)
  perform public.admin_update_cycle(v_cycle, 'Test Cycle FY27', 'Updated', current_date, current_date + 200, 105.5, 'Adjust demo base NAV');
  select base_nav into v_num from public.investment_cycles where id = v_cycle;
  if v_num <> 105.5 then raise exception 'TEST FAILED: base NAV not updated in draft'; end if;
  v_checks := v_checks + 1;

  -- Status transitions
  v_raised := false;
  begin
    perform public.admin_set_cycle_status(v_cycle, 'active', 'Skip open state');
  exception when check_violation then v_raised := true;
  end;
  if not v_raised then raise exception 'TEST FAILED: draft → active (skipping open) accepted'; end if;
  v_checks := v_checks + 1;

  v_raised := false;
  begin
    perform public.admin_set_cycle_status(v_cycle, 'open', 'no');
  exception when invalid_parameter_value then v_raised := true;
  end;
  if not v_raised then raise exception 'TEST FAILED: status change without reason accepted'; end if;
  v_checks := v_checks + 1;

  perform public.admin_set_cycle_status(v_cycle, 'open', 'Accepting contributions');

  select count(*) into v_n from public.audit_logs
   where entity_id = v_cycle and action = 'cycle.status_changed' and reason = 'Accepting contributions'
     and after_data ->> 'status' = 'open';
  if v_n <> 1 then raise exception 'TEST FAILED: status change not audited with reason'; end if;
  v_checks := v_checks + 1;

  -- Base NAV locked once open
  v_raised := false;
  begin
    perform public.admin_update_cycle(v_cycle, 'Test Cycle FY27', 'Updated', current_date, current_date + 200, 110, 'Change NAV after open');
  exception when check_violation then v_raised := true;
  end;
  if not v_raised then raise exception 'TEST FAILED: base NAV changed after open'; end if;
  v_checks := v_checks + 1;

  -- Dates still editable while open
  perform public.admin_update_cycle(v_cycle, 'Test Cycle FY27', 'Updated', current_date, current_date + 210, 105.5, 'Extend end date');
  v_checks := v_checks + 1;

  perform public.admin_set_cycle_status(v_cycle, 'active', 'Capital deployed');

  v_raised := false;
  begin
    perform public.admin_update_cycle(v_cycle, 'Test Cycle FY27', 'Updated', current_date, current_date + 220, 105.5, 'Extend again');
  exception when check_violation then v_raised := true;
  end;
  if not v_raised then raise exception 'TEST FAILED: dates changed while active'; end if;
  v_checks := v_checks + 1;

  -- Name/description still editable while active
  perform public.admin_update_cycle(v_cycle, 'Test Cycle FY27 (Main)', 'Renamed', current_date, current_date + 210, 105.5, 'Clarify the name');
  v_checks := v_checks + 1;

  -- ---------------------------------------------------------------- fee terms
  v_raised := false;
  begin
    perform public.admin_add_fee_terms(v_cycle, 0.2, now() - interval '1 day', 'Backdated change');
  exception when invalid_parameter_value then v_raised := true;
  end;
  if not v_raised then raise exception 'TEST FAILED: backdated fee terms accepted'; end if;
  v_checks := v_checks + 1;

  v_raised := false;
  begin
    perform public.admin_add_fee_terms(v_cycle, 0.15, now() + interval '1 day', 'Same rate again');
  exception when invalid_parameter_value then v_raised := true;
  end;
  if not v_raised then raise exception 'TEST FAILED: unchanged rate accepted'; end if;
  v_checks := v_checks + 1;

  v_terms := public.admin_add_fee_terms(v_cycle, 0.2, now() + interval '7 days', 'Agreed new rate from next week');

  select * into v_ov from public.cycle_overview where id = v_cycle;
  if v_ov.current_fee_rate <> 0.15 or v_ov.pending_fee_rate <> 0.2 or v_ov.pending_fee_version <> 2 then
    raise exception 'TEST FAILED: pending fee change not reflected: %', row_to_json(v_ov);
  end if;
  v_checks := v_checks + 1;

  -- private.fee_terms_at is internal (not executable by API roles); check it as the owner.
  execute 'set local role postgres';
  if (private.fee_terms_at(v_cycle, now())).performance_fee_rate <> 0.15
     or (private.fee_terms_at(v_cycle, now() + interval '8 days')).performance_fee_rate <> 0.2 then
    raise exception 'TEST FAILED: fee_terms_at returns wrong rate';
  end if;
  execute 'set local role authenticated';
  v_checks := v_checks + 1;

  v_raised := false;
  begin
    perform public.admin_add_fee_terms(v_cycle, 0.25, null, 'Immediate change before scheduled one');
  exception when invalid_parameter_value then v_raised := true;
  end;
  if not v_raised then raise exception 'TEST FAILED: change before a scheduled change accepted'; end if;
  v_checks := v_checks + 1;

  -- Cancel the pending version; effective versions cannot be cancelled.
  perform public.admin_cancel_fee_terms(v_terms, 'Agreement postponed');
  select * into v_ov from public.cycle_overview where id = v_cycle;
  if v_ov.pending_fee_rate is not null then raise exception 'TEST FAILED: cancelled version still pending'; end if;
  execute 'set local role postgres';
  if (private.fee_terms_at(v_cycle, now() + interval '8 days')).performance_fee_rate <> 0.15 then
    raise exception 'TEST FAILED: cancelled version still used for lookup';
  end if;
  execute 'set local role authenticated';
  v_checks := v_checks + 1;

  v_raised := false;
  begin
    perform public.admin_cancel_fee_terms(
      (select id from public.cycle_fee_terms where cycle_id = v_cycle and version = 1), 'Cancel the effective one');
  exception when check_violation then v_raised := true;
  end;
  if not v_raised then raise exception 'TEST FAILED: effective version cancelled'; end if;
  v_checks := v_checks + 1;

  -- A new change is allowed again; version numbers keep increasing (cancelled v2 is not reused).
  -- (now() is fixed inside this transaction, so use a time just after version 1.)
  perform public.admin_add_fee_terms(v_cycle, 0.18, now() + interval '1 minute', 'Revised rate');
  execute 'set local role postgres';
  if (private.fee_terms_at(v_cycle, now() + interval '2 minutes')).performance_fee_rate <> 0.18
     or (private.fee_terms_at(v_cycle, now() + interval '2 minutes')).version <> 3 then
    raise exception 'TEST FAILED: revised rate not effective as version 3';
  end if;
  execute 'set local role authenticated';
  v_checks := v_checks + 1;

  select count(*) into v_n from public.audit_logs
   where entity_id = v_cycle and action in ('fee_terms.created', 'fee_terms.cancelled');
  if v_n <> 4 then raise exception 'TEST FAILED: fee term audit rows = %, expected 4', v_n; end if;
  v_checks := v_checks + 1;

  -- Close: no further fee changes, no edits, no reopening.
  perform public.admin_set_cycle_status(v_cycle, 'closed', 'Cycle ended');
  v_raised := false;
  begin
    perform public.admin_add_fee_terms(v_cycle, 0.1, null, 'Change after close');
  exception when check_violation then v_raised := true;
  end;
  if not v_raised then raise exception 'TEST FAILED: fee change after close accepted'; end if;
  v_checks := v_checks + 1;

  v_raised := false;
  begin
    perform public.admin_set_cycle_status(v_cycle, 'active', 'Reopen please');
  exception when check_violation then v_raised := true;
  end;
  if not v_raised then raise exception 'TEST FAILED: closed → active accepted'; end if;
  v_checks := v_checks + 1;

  -- ================================================================ client cannot read admin data
  v_cycle2 := v_cycle;
  perform set_config('request.jwt.claims', json_build_object('sub', v_client, 'role', 'authenticated')::text, true);
  select count(*) into v_n from public.cycle_overview where id = v_cycle2;
  if v_n <> 0 then raise exception 'TEST FAILED: client can read cycle overview'; end if;
  select count(*) into v_n from public.cycle_fee_terms where cycle_id = v_cycle2;
  if v_n <> 0 then raise exception 'TEST FAILED: client can read fee terms'; end if;
  v_checks := v_checks + 1;

  v_raised := false;
  begin
    perform private.fee_terms_at(v_cycle2, now());
  exception when insufficient_privilege then v_raised := true;
  end;
  if not v_raised then raise exception 'TEST FAILED: API user can call private.fee_terms_at'; end if;
  v_checks := v_checks + 1;

  -- ================================================================ owner-level tamper attempts
  execute 'set local role postgres';

  v_raised := false;
  begin
    update public.cycle_fee_terms set performance_fee_rate = 0.5 where cycle_id = v_cycle;
  exception when insufficient_privilege then v_raised := true;
  end;
  if not v_raised then raise exception 'TEST FAILED: fee terms edited by owner'; end if;
  v_checks := v_checks + 1;

  v_raised := false;
  begin
    delete from public.cycle_fee_terms where cycle_id = v_cycle;
  exception when insufficient_privilege then v_raised := true;
  end;
  if not v_raised then raise exception 'TEST FAILED: fee terms deleted by owner'; end if;
  v_checks := v_checks + 1;

  v_raised := false;
  begin
    delete from public.investment_cycles where id = v_cycle;
  exception when insufficient_privilege then v_raised := true;
  end;
  if not v_raised then raise exception 'TEST FAILED: cycle deleted by owner'; end if;
  v_checks := v_checks + 1;

  v_raised := false;
  begin
    update public.investment_cycles set status = 'draft' where id = v_cycle;
  exception when check_violation then v_raised := true;
  end;
  if not v_raised then raise exception 'TEST FAILED: owner moved closed cycle back to draft'; end if;
  v_checks := v_checks + 1;

  raise exception 'ALL_CYCLE_TESTS_PASSED (% checks)', v_checks;
end;
$$;
