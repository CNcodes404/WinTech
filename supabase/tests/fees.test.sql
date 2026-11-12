-- =============================================================================
-- Tests for per-lot performance-fee accruals (Module 10, method per_lot_hwm_v1)
--
-- SAFE TO RUN AGAINST ANY DATABASE: one DO block that always ends by raising an
-- exception, so every change is rolled back.
--
-- Expected final output:   ALL_FEE_TESTS_PASSED (n checks)
-- Run: npx supabase db query --remote --yes -f supabase/tests/fees.test.sql
-- =============================================================================
do $$
declare
  v_admin  uuid := gen_random_uuid();
  v_rahul  uuid := gen_random_uuid();
  v_amit   uuid := gen_random_uuid();
  v_sagar  uuid := gen_random_uuid();
  v_other  uuid := gen_random_uuid();
  v_cycle  uuid;
  c_rahul  uuid;
  c_amit   uuid;
  c_sagar  uuid;
  c_rev    uuid;
  v_val    uuid;
  s1       uuid;
  s2       uuid;
  s3       uuid;
  v_g      numeric;
  v_units  numeric;
  v_n      int;
  v_text   text;
  v_raised boolean;
  v_checks int := 0;
  v_s      public.nav_snapshots;
  v_f      public.lot_fee_accruals;
begin
  insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, email_confirmed_at, created_at, updated_at)
  values
    (v_admin, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ftest-admin@example.test', '{"full_name":"F Admin"}', now(), now(), now()),
    (v_rahul, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ftest-rahul@example.test', '{"full_name":"Rahul (fictional)"}', now(), now(), now()),
    (v_amit,  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ftest-amit@example.test',  '{"full_name":"Amit (fictional)"}',  now(), now(), now()),
    (v_sagar, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ftest-sagar@example.test', '{"full_name":"Sagar (fictional)"}', now(), now(), now()),
    (v_other, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ftest-other@example.test', '{"full_name":"Other"}', now(), now(), now());
  update public.profiles set role = 'admin' where id = v_admin;

  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';

  v_cycle := public.admin_create_cycle('FTest Cycle', null, current_date - 30, current_date + 300, 100, 0.2);
  perform public.admin_set_cycle_status(v_cycle, 'open', 'Open for test');

  -- Rahul: ₹1,00,000 at ₹100 → 1,000 units (fee rate 20% locked).
  c_rahul := public.admin_record_contribution(v_cycle, v_rahul, 100000, now() - interval '2 hours', 'bank_transfer', 'F-1', null);
  perform public.admin_verify_contribution(c_rahul, 'Matched bank statement');
  perform pg_sleep(0.02);

  -- ================================================================ spec example: HWM 100 → gross 116 @ 20%
  v_val := public.admin_save_valuation_draft(null, v_cycle, clock_timestamp(), '116000', '0', '0', null, '[]');
  perform public.admin_approve_valuation(v_val, 'Demo valuation');
  s1 := public.admin_calculate_nav(v_val, null);

  select * into v_f from public.lot_fee_accruals where snapshot_id = s1 and contribution_id = c_rahul;
  if v_f.eligible_profit_per_unit <> 16 or v_f.fee_amount <> 3200 or v_f.gross_value <> 116000
     or v_f.net_value <> 112800 or v_f.loss_to_recover <> 0 or v_f.fee_rate <> 0.2 or v_f.reference_hwm <> 100 then
    raise exception 'TEST FAILED: spec example accrual: %', row_to_json(v_f);
  end if;
  select * into v_s from public.nav_snapshots where id = s1;
  if v_s.performance_fee_amount <> 3200 or v_s.net_nav_per_unit <> 112.8 or v_s.calculation_version <> 'per_lot_hwm_v1' then
    raise exception 'TEST FAILED: snapshot fee totals: %', row_to_json(v_s);
  end if;
  v_checks := v_checks + 2;

  perform public.admin_publish_nav(s1, 'Published at 116');

  -- Published accruals and fee totals are frozen.
  execute 'set local role postgres';
  v_raised := false;
  begin
    update public.lot_fee_accruals set fee_amount = 0 where snapshot_id = s1;
  exception when insufficient_privilege then v_raised := true;
  end;
  if not v_raised then raise exception 'TEST FAILED: accrual edited'; end if;
  v_raised := false;
  begin
    update public.nav_snapshots set performance_fee_amount = 0 where id = s1;
  exception when check_violation then v_raised := true;
  end;
  if not v_raised then raise exception 'TEST FAILED: published fee total edited'; end if;
  v_raised := false;
  begin
    delete from public.lot_fee_accruals where snapshot_id = s1;
  exception when insufficient_privilege then v_raised := true;
  end;
  if not v_raised then raise exception 'TEST FAILED: accruals deleted'; end if;
  execute 'set local role authenticated';
  v_checks := v_checks + 1;

  -- ================================================================ later entrant at ₹116, fee-rate change
  perform pg_sleep(0.02);
  c_amit := public.admin_record_contribution(v_cycle, v_amit, 50000, clock_timestamp(), 'upi', 'F-2', null);
  perform public.admin_verify_contribution(c_amit, 'Joined at 116');

  -- New rate 25% applies only to lots issued afterwards.
  perform public.admin_add_fee_terms(v_cycle, 0.25, now() + interval '5 milliseconds', 'Rate change for test');
  perform pg_sleep(0.05);
  c_sagar := public.admin_record_contribution(v_cycle, v_sagar, 11600, clock_timestamp(), 'cheque', 'F-3', null);
  perform public.admin_verify_contribution(c_sagar, 'Joined at 116 after rate change');
  -- A lot that is reversed before the next valuation is excluded from it.
  c_rev := public.admin_record_contribution(v_cycle, v_sagar, 5800, clock_timestamp(), 'other', 'F-4', null);
  perform public.admin_verify_contribution(c_rev, 'Will be reversed');
  perform public.admin_reverse_contribution(c_rev, 'Bounced');
  perform pg_sleep(0.02);

  -- ================================================================ NAV falls to ~₹110: Rahul still in profit, Amit/Sagar below HWM
  select sum(units) into v_units from public.client_unit_allocations where cycle_id = v_cycle;
  -- net asset value giving NAV ≈ 110
  v_val := public.admin_save_valuation_draft(null, v_cycle, clock_timestamp(), (round(v_units * 110, 2))::text, '0', '0', null, '[]');
  perform public.admin_approve_valuation(v_val, 'NAV fell to 110');
  s2 := public.admin_calculate_nav(v_val, null);
  select gross_nav_per_unit into v_g from public.nav_snapshots where id = s2;

  -- Rahul (HWM 100, 20%): fee on the gain above 100 only.
  select * into v_f from public.lot_fee_accruals where snapshot_id = s2 and contribution_id = c_rahul;
  if v_f.fee_amount <> round(1000 * (v_g - 100) * 0.2, 2) or v_f.loss_to_recover <> 0 then
    raise exception 'TEST FAILED: Rahul accrual at %: %', v_g, row_to_json(v_f);
  end if;
  -- Amit (HWM 116): NOT charged for gains before he joined; loss shown, no fee.
  select * into v_f from public.lot_fee_accruals where snapshot_id = s2 and contribution_id = c_amit;
  if v_f.fee_amount <> 0 or v_f.reference_hwm <> 116 or v_f.loss_to_recover <> round(v_f.units * (116 - v_g), 2) then
    raise exception 'TEST FAILED: Amit should owe no fee below his HWM: %', row_to_json(v_f);
  end if;
  -- Sagar's lot carries the newer 25% rate.
  select * into v_f from public.lot_fee_accruals where snapshot_id = s2 and contribution_id = c_sagar;
  if v_f.fee_rate <> 0.25 then raise exception 'TEST FAILED: Sagar lot fee rate % (expected 0.25)', v_f.fee_rate; end if;
  -- Reversed lot excluded; lot units reconcile with snapshot units; totals reconcile.
  select count(*) into v_n from public.lot_fee_accruals where snapshot_id = s2 and contribution_id = c_rev;
  if v_n <> 0 then raise exception 'TEST FAILED: reversed lot accrued'; end if;
  select * into v_s from public.nav_snapshots where id = s2;
  if (select sum(units) from public.lot_fee_accruals where snapshot_id = s2) <> v_s.total_outstanding_units
     or (select sum(fee_amount) from public.lot_fee_accruals where snapshot_id = s2) <> v_s.performance_fee_amount
     or v_s.net_nav_per_unit <> round((v_s.gross_net_asset_value - v_s.performance_fee_amount)::numeric(38, 20) / v_s.total_outstanding_units, 8) then
    raise exception 'TEST FAILED: snapshot totals do not reconcile: %', row_to_json(v_s);
  end if;
  v_checks := v_checks + 4;
  perform public.admin_publish_nav(s2, 'Published at ~110');

  -- ================================================================ fall below Rahul's HWM: no fee anywhere, never negative
  perform pg_sleep(0.02);
  v_val := public.admin_save_valuation_draft(null, v_cycle, clock_timestamp(), (round(v_units * 90, 2))::text, '0', '0', null, '[]');
  perform public.admin_approve_valuation(v_val, 'NAV fell to 90');
  s3 := public.admin_calculate_nav(v_val, null);
  select count(*) into v_n from public.lot_fee_accruals where snapshot_id = s3 and fee_amount > 0;
  if v_n <> 0 then raise exception 'TEST FAILED: fee charged below every HWM'; end if;
  select performance_fee_amount, gross_nav_per_unit, net_nav_per_unit into v_s.performance_fee_amount, v_g, v_s.net_nav_per_unit
  from public.nav_snapshots where id = s3;
  if v_s.performance_fee_amount <> 0 or v_s.net_nav_per_unit <> v_g then
    raise exception 'TEST FAILED: with no fee, net NAV must equal gross NAV';
  end if;
  select loss_to_recover into v_g from public.lot_fee_accruals where snapshot_id = s3 and contribution_id = c_rahul;
  if v_g <> 10000 then raise exception 'TEST FAILED: Rahul loss to recover % (expected 10000.00)', v_g; end if;
  v_checks := v_checks + 2;
  perform public.admin_publish_nav(s3, 'Published at ~90');

  -- ================================================================ crystallisation (informational, closed cycles only)
  v_raised := false;
  begin
    perform public.admin_record_fee_crystallisation(v_cycle, 'Too early');
  exception when check_violation then v_raised := true;
  end;
  if not v_raised then raise exception 'TEST FAILED: crystallised an open cycle'; end if;
  perform public.admin_set_cycle_status(v_cycle, 'active', 'Deployed');
  perform public.admin_set_cycle_status(v_cycle, 'closed', 'Cycle ended');
  perform public.admin_record_fee_crystallisation(v_cycle, 'Final indicative fee recorded');
  select total_fee_amount::text into v_text from public.fee_crystallisations where cycle_id = v_cycle;
  if v_text <> '0.00' then raise exception 'TEST FAILED: crystallised fee % (latest NAV had no fee)', v_text; end if;
  v_raised := false;
  begin
    perform public.admin_record_fee_crystallisation(v_cycle, 'Second time');
  exception when check_violation then v_raised := true;
  end;
  if not v_raised then raise exception 'TEST FAILED: crystallised twice'; end if;
  select count(*) into v_n from public.audit_logs where entity_id = v_cycle and action = 'fees.crystallised';
  if v_n <> 1 then raise exception 'TEST FAILED: crystallisation not audited'; end if;
  v_checks := v_checks + 1;

  -- ================================================================ clients cannot read fee data
  perform set_config('request.jwt.claims', json_build_object('sub', v_other, 'role', 'authenticated')::text, true);
  select count(*) into v_n from public.lot_fee_accruals;
  if v_n <> 0 then raise exception 'TEST FAILED: client can read fee accruals'; end if;
  select count(*) into v_n from public.lot_fee_accrual_report;
  if v_n <> 0 then raise exception 'TEST FAILED: client can read the fee report'; end if;
  v_raised := false;
  begin
    perform public.admin_record_fee_crystallisation(v_cycle, 'Client attempt');
  exception when insufficient_privilege then v_raised := true;
  end;
  if not v_raised then raise exception 'TEST FAILED: client could record a crystallisation'; end if;
  v_checks := v_checks + 1;

  raise exception 'ALL_FEE_TESTS_PASSED (% checks)', v_checks;
end;
$$;
