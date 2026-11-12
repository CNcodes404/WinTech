-- =============================================================================
-- Tests for manual portfolio valuations (Module 8)
--
-- SAFE TO RUN AGAINST ANY DATABASE: one DO block that always ends by raising an
-- exception, so every change is rolled back.
--
-- Expected final output:   ALL_VALUATION_TESTS_PASSED (n checks)
-- Run: npx supabase db query --remote --yes -f supabase/tests/valuations.test.sql
-- =============================================================================
do $$
declare
  v_admin  uuid := gen_random_uuid();
  v_client uuid := gen_random_uuid();
  v_cycle  uuid;
  v_val    uuid;
  v_corr   uuid;
  v_tmp    uuid;
  v_n      int;
  v_text   text;
  v_raised boolean;
  v_checks int := 0;
  v_row    public.portfolio_valuations;
  v_items  jsonb := '[
    {"symbol": " infy ", "instrument_name": "Infosys Ltd (demo)", "exchange": "nse", "quantity": "12.5", "valuation_price": "2456.789", "average_cost": "1500"},
    {"symbol": "TCS", "exchange": "NSE", "quantity": "10", "valuation_price": "3500.505"}
  ]';
begin
  insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, email_confirmed_at, created_at, updated_at)
  values
    (v_admin, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'vtest-admin@example.test', '{"full_name":"V Admin"}', now(), now(), now()),
    (v_client, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'vtest-client@example.test', '{"full_name":"V Client"}', now(), now(), now());
  update public.profiles set role = 'admin' where id = v_admin;

  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';

  v_cycle := public.admin_create_cycle('VTest Cycle', null, current_date - 30, current_date + 300, 100, 0.2);

  -- Draft cycle: no valuations yet.
  v_raised := false;
  begin
    perform public.admin_save_valuation_draft(null, v_cycle, now(), '1000', '0', '0', null, '[]');
  exception when check_violation then v_raised := true;
  end;
  if not v_raised then raise exception 'TEST FAILED: valuation saved for a draft cycle'; end if;
  v_checks := v_checks + 1;

  perform public.admin_set_cycle_status(v_cycle, 'open', 'Open for test');

  -- ================================================================ server-side calculation
  v_val := public.admin_save_valuation_draft(null, v_cycle, now() - interval '1 hour', '50000.50', '0', '1500', 'Demo prices', v_items);
  select * into v_row from public.portfolio_valuations where id = v_val;
  -- 12.5 × 2456.789 = 30709.8625 → 30709.86 ; 10 × 3500.505 = 35005.05
  if v_row.holdings_value <> 65714.91 or v_row.gross_asset_value <> 115715.41
     or v_row.gross_net_asset_value <> 114215.41 or v_row.status <> 'draft' or v_row.source <> 'manual_demo' then
    raise exception 'TEST FAILED: totals incorrect: %', row_to_json(v_row);
  end if;
  v_checks := v_checks + 1;

  select symbol || '/' || exchange || '/' || market_value::text into v_text
  from public.portfolio_valuation_items where valuation_id = v_val and line_no = 1;
  if v_text <> 'INFY/NSE/30709.86' then raise exception 'TEST FAILED: line 1 normalisation/value: %', v_text; end if;
  v_checks := v_checks + 1;

  -- ================================================================ validation
  v_raised := false;
  begin
    perform public.admin_save_valuation_draft(null, v_cycle, now(), '0', '0', '0', null,
      '[{"symbol":"INFY","exchange":"NSE","quantity":"1","valuation_price":"1"},{"symbol":"infy","exchange":"nse","quantity":"2","valuation_price":"1"}]');
  exception when invalid_parameter_value then v_raised := true;
  end;
  if not v_raised then raise exception 'TEST FAILED: duplicate holding accepted'; end if;
  v_checks := v_checks + 1;

  v_raised := false;
  begin
    perform public.admin_save_valuation_draft(null, v_cycle, now(), '0', '0', '0', null,
      '[{"symbol":"INFY","quantity":"0","valuation_price":"1"}]');
  exception when invalid_parameter_value then v_raised := true;
  end;
  if not v_raised then raise exception 'TEST FAILED: zero quantity accepted'; end if;
  v_checks := v_checks + 1;

  v_raised := false;
  begin
    perform public.admin_save_valuation_draft(null, v_cycle, now(), '0', '0', '0', null,
      '[{"symbol":"INFY","quantity":"ten","valuation_price":"1"}]');
  exception when invalid_parameter_value then v_raised := true;
  end;
  if not v_raised then raise exception 'TEST FAILED: non-numeric quantity accepted'; end if;
  v_checks := v_checks + 1;

  v_raised := false;
  begin
    perform public.admin_save_valuation_draft(null, v_cycle, now(), '-1', '0', '0', null, '[]');
  exception when invalid_parameter_value then v_raised := true;
  end;
  if not v_raised then raise exception 'TEST FAILED: negative cash accepted'; end if;
  v_checks := v_checks + 1;

  v_raised := false;
  begin
    perform public.admin_save_valuation_draft(null, v_cycle, now(), '1.005', '0', '0', null, '[]');
  exception when invalid_parameter_value then v_raised := true;
  end;
  if not v_raised then raise exception 'TEST FAILED: sub-paise cash accepted'; end if;
  v_checks := v_checks + 1;

  v_raised := false;
  begin
    perform public.admin_save_valuation_draft(null, v_cycle, now() + interval '1 day', '1', '0', '0', null, '[]');
  exception when invalid_parameter_value then v_raised := true;
  end;
  if not v_raised then raise exception 'TEST FAILED: future valuation time accepted'; end if;
  v_checks := v_checks + 1;

  v_raised := false;
  begin
    perform public.admin_save_valuation_draft(null, v_cycle, now(), '0', '0', '0', null,
      '[{"symbol":"DROP TABLE;","quantity":"1","valuation_price":"1"}]');
  exception when invalid_parameter_value then v_raised := true;
  end;
  if not v_raised then raise exception 'TEST FAILED: invalid symbol accepted'; end if;
  v_checks := v_checks + 1;

  -- ================================================================ edit draft (lines replaced, totals recomputed)
  perform public.admin_save_valuation_draft(v_val, v_cycle, now() - interval '1 hour', '50000.50', '0', '1500', 'Demo prices v2',
    '[{"symbol":"INFY","exchange":"NSE","quantity":"12.5","valuation_price":"2456.789"}]');
  select * into v_row from public.portfolio_valuations where id = v_val;
  select count(*) into v_n from public.portfolio_valuation_items where valuation_id = v_val;
  -- 30709.86 + 50000.50 cash − 1500 liabilities = 79210.36
  if v_n <> 1 or v_row.holdings_value <> 30709.86 or v_row.gross_net_asset_value <> 79210.36 then
    raise exception 'TEST FAILED: draft edit not applied (items %, row %)', v_n, row_to_json(v_row);
  end if;
  v_checks := v_checks + 1;

  -- Liabilities may exceed assets (negative net asset value is reported, not hidden).
  v_tmp := public.admin_save_valuation_draft(null, v_cycle, now(), '100', '0', '250', null, '[]');
  select gross_net_asset_value::text into v_text from public.portfolio_valuations where id = v_tmp;
  if v_text <> '-150.00' then raise exception 'TEST FAILED: negative NAV not represented (%)', v_text; end if;
  perform public.admin_discard_valuation_draft(v_tmp, 'Test draft not needed');
  v_checks := v_checks + 1;

  -- ================================================================ approve → immutable
  v_raised := false;
  begin
    perform public.admin_approve_valuation(v_val, 'ok');
  exception when invalid_parameter_value then v_raised := true;
  end;
  if not v_raised then raise exception 'TEST FAILED: approval without reason'; end if;
  v_checks := v_checks + 1;

  perform public.admin_approve_valuation(v_val, 'Prices checked against demo sheet');
  select * into v_row from public.portfolio_valuations where id = v_val;
  if v_row.status <> 'approved' or v_row.approved_by <> v_admin or v_row.approved_at is null then
    raise exception 'TEST FAILED: approval not recorded';
  end if;
  v_checks := v_checks + 1;

  v_raised := false;
  begin
    perform public.admin_save_valuation_draft(v_val, v_cycle, now(), '1', '0', '0', null, '[]');
  exception when check_violation then v_raised := true;
  end;
  if not v_raised then raise exception 'TEST FAILED: approved valuation edited'; end if;
  v_checks := v_checks + 1;

  v_raised := false;
  begin
    perform public.admin_discard_valuation_draft(v_val, 'Discard approved');
  exception when check_violation then v_raised := true;
  end;
  if not v_raised then raise exception 'TEST FAILED: approved valuation discarded'; end if;
  v_checks := v_checks + 1;

  -- Empty valuation cannot be approved.
  v_tmp := public.admin_save_valuation_draft(null, v_cycle, now(), '0', '0', '0', null, '[]');
  v_raised := false;
  begin
    perform public.admin_approve_valuation(v_tmp, 'Approve empty');
  exception when check_violation then v_raised := true;
  end;
  if not v_raised then raise exception 'TEST FAILED: empty valuation approved'; end if;
  perform public.admin_discard_valuation_draft(v_tmp, 'Empty test draft');
  v_raised := false;
  begin
    perform public.admin_approve_valuation(v_tmp, 'Approve discarded');
  exception when check_violation then v_raised := true;
  end;
  if not v_raised then raise exception 'TEST FAILED: discarded draft approved'; end if;
  v_checks := v_checks + 1;

  -- ================================================================ correction supersedes
  v_corr := public.admin_save_valuation_draft(null, v_cycle, (select valuation_at from public.portfolio_valuations where id = v_val),
    '50000.50', '0', '1500', 'Corrected INFY price',
    '[{"symbol":"INFY","exchange":"NSE","quantity":"12.5","valuation_price":"2450"}]', v_val);

  v_raised := false;
  begin
    perform public.admin_save_valuation_draft(null, v_cycle, now(), '1', '0', '0', null, '[]', v_val);
  exception when check_violation then v_raised := true;
  end;
  if not v_raised then raise exception 'TEST FAILED: two open corrections for one valuation'; end if;
  v_checks := v_checks + 1;

  perform public.admin_approve_valuation(v_corr, 'Price typo corrected');
  select status::text into v_text from public.portfolio_valuations where id = v_val;
  if v_text <> 'superseded' then raise exception 'TEST FAILED: original not superseded (%)', v_text; end if;
  select count(*) into v_n from public.portfolio_valuations where id = v_val and superseded_by = v_corr;
  if v_n <> 1 then raise exception 'TEST FAILED: superseded_by not set'; end if;
  v_checks := v_checks + 1;

  v_raised := false;
  begin
    perform public.admin_save_valuation_draft(null, v_cycle, now(), '1', '0', '0', null, '[]', v_val);
  exception when check_violation then v_raised := true;
  end;
  if not v_raised then raise exception 'TEST FAILED: superseded valuation corrected again'; end if;
  v_checks := v_checks + 1;

  select count(*) into v_n from public.audit_logs
   where entity_type = 'valuation' and entity_id in (v_val, v_corr)
     and action in ('valuation.approved', 'valuation.superseded');
  if v_n <> 3 then raise exception 'TEST FAILED: approval/supersede audit rows = %', v_n; end if;
  v_checks := v_checks + 1;

  -- ================================================================ clients
  perform set_config('request.jwt.claims', json_build_object('sub', v_client, 'role', 'authenticated')::text, true);
  select count(*) into v_n from public.portfolio_valuations;
  if v_n <> 0 then raise exception 'TEST FAILED: client can read valuations'; end if;
  v_raised := false;
  begin
    perform public.admin_save_valuation_draft(null, v_cycle, now(), '1', '0', '0', null, '[]');
  exception when insufficient_privilege then v_raised := true;
  end;
  if not v_raised then raise exception 'TEST FAILED: client could save a valuation'; end if;
  v_checks := v_checks + 1;

  -- ================================================================ owner-level tampering
  execute 'set local role postgres';

  v_raised := false;
  begin
    update public.portfolio_valuations set cash_balance = 999999 where id = v_corr;
  exception when check_violation then v_raised := true;
  end;
  if not v_raised then raise exception 'TEST FAILED: owner edited an approved valuation'; end if;

  v_raised := false;
  begin
    update public.portfolio_valuation_items set valuation_price = 1 where valuation_id = v_corr;
  exception when check_violation then v_raised := true;
  end;
  if not v_raised then raise exception 'TEST FAILED: owner edited approved line items'; end if;

  v_raised := false;
  begin
    delete from public.portfolio_valuation_items where valuation_id = v_corr;
  exception when check_violation then v_raised := true;
  end;
  if not v_raised then raise exception 'TEST FAILED: owner deleted approved line items'; end if;

  v_raised := false;
  begin
    delete from public.portfolio_valuations where id = v_corr;
  exception when insufficient_privilege then v_raised := true;
  end;
  if not v_raised then raise exception 'TEST FAILED: owner deleted a valuation'; end if;

  v_raised := false;
  begin
    update public.portfolio_valuations set status = 'approved' where id = v_val;
  exception when check_violation then v_raised := true;
  end;
  if not v_raised then raise exception 'TEST FAILED: owner un-superseded a valuation'; end if;
  v_checks := v_checks + 1;

  raise exception 'ALL_VALUATION_TESTS_PASSED (% checks)', v_checks;
end;
$$;
