-- =============================================================================
-- Tests for the fund-level fee model (Module 15, method fund_level_v2)
--   * one NAV for everyone: NAV = (assets − performance fee on total profit) / units
--   * monthly admin fee per client: monthly fee × completed months since the client's first
--     investment, up to the NAV date (deducted even without profit)
--   * money received on a day is issued at the latest NAV dated BEFORE that day
--
-- SAFE TO RUN AGAINST ANY DATABASE: one DO block that always ends by raising an
-- exception, so every change is rolled back. "Earlier days" are seeded directly as
-- the owner (timestamps in the past), then the admin API is used as normal.
--
-- Expected final output:   ALL_FEE_TESTS_PASSED (n checks)
-- =============================================================================
do $$
declare
  v_admin  uuid := gen_random_uuid();
  v_a      uuid := gen_random_uuid();
  v_b      uuid := gen_random_uuid();
  v_other  uuid := gen_random_uuid();
  v_cycle  uuid;
  v_terms  uuid;
  c_a      uuid;
  c_b      uuid;
  v_val    uuid;
  v_t2     timestamptz := now() - interval '2 days';
  s1       uuid;
  s2       uuid;
  s3       uuid;
  v_units  numeric;
  v_nav    numeric;
  v_n      int;
  v_num    numeric;
  v_raised boolean;
  v_checks int := 0;
  v_s      public.nav_snapshots;
  v_p      record;
  v_cr     public.fee_crystallisations;
begin
  insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, email_confirmed_at, created_at, updated_at)
  values
    (v_admin, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ftest-admin@example.test', '{"full_name":"F Admin"}', now(), now(), now()),
    (v_a,     '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ftest-a@example.test', '{"full_name":"Client A (fictional)"}', now(), now(), now()),
    (v_b,     '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ftest-b@example.test', '{"full_name":"Client B (fictional)"}', now(), now(), now()),
    (v_other, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ftest-other@example.test', '{"full_name":"Other"}', now(), now(), now());
  update public.profiles set role = 'admin' where id = v_admin;

  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';

  -- 50% performance fee, default admin fee ₹100 per month.
  v_cycle := public.admin_create_cycle('FTest Cycle', null, current_date - 90, current_date + 300, 100, 0.5);
  perform public.admin_set_cycle_status(v_cycle, 'open', 'Open for test');
  if (select admin_fee_amount from public.investment_cycles where id = v_cycle) <> 100 then
    raise exception 'TEST FAILED: default monthly admin fee';
  end if;
  -- Completed months (India time): only full months count.
  execute 'set local role postgres';
  if private.completed_months('2027-01-01 10:00+05:30', '2027-03-15 15:30+05:30') <> 2
     or private.completed_months('2027-01-20 10:00+05:30', '2027-03-15 15:30+05:30') <> 1
     or private.completed_months('2027-01-31 10:00+05:30', '2027-02-28 15:30+05:30') <> 0
     or private.completed_months('2027-03-15 10:00+05:30', '2027-01-01 10:00+05:30') <> 0 then
    raise exception 'TEST FAILED: completed months';
  end if;
  execute 'set local role authenticated';
  v_checks := v_checks + 1;

  -- ================================================================ 2 months + 5 days ago: Client A ₹1,00,000 at ₹100 → 1,000 units
  execute 'set local role postgres';
  select id into v_terms from public.cycle_fee_terms where cycle_id = v_cycle and version = 1;
  insert into public.contributions
    (cycle_id, client_id, amount, received_at, method, reference_number, status, recorded_by,
     verified_by, verified_at, applicable_nav, units_issued, created_at)
  values (v_cycle, v_a, 100000, now() - interval '2 months 5 days', 'bank_transfer', 'F-1', 'verified', v_admin,
          v_admin, now() - interval '2 months 5 days', 100, 1000, now() - interval '2 months 5 days')
  returning id into c_a;
  insert into public.client_unit_allocations
    (cycle_id, client_id, contribution_id, entry_type, units, amount, entry_nav, reference_hwm, fee_rate,
     fee_terms_id, created_by, created_at)
  values (v_cycle, v_a, c_a, 'issue', 1000, 100000, 100, 100, 0.5, v_terms, v_admin, now() - interval '2 months 5 days');
  execute 'set local role authenticated';

  -- ================================================================ 2 days ago: market NAV 130 → client NAV 115 (owner's example)
  v_val := public.admin_save_valuation_draft(null, v_cycle, v_t2, '130000', '0', '0', null, '[]');
  perform public.admin_approve_valuation(v_val, 'Close of day');
  s1 := public.admin_calculate_nav(v_val, null);
  select * into v_s from public.nav_snapshots where id = s1;
  if v_s.calculation_version <> 'fund_level_v2' or v_s.gross_nav_per_unit <> 130 or v_s.net_contributed <> 100000
     or v_s.profit_before_fee <> 30000 or v_s.performance_fee_rate <> 0.5 or v_s.performance_fee_amount <> 15000
     or v_s.net_nav_per_unit <> 115 then
    raise exception 'TEST FAILED: 100 → 130 at 50%% should give NAV 115: %', row_to_json(v_s);
  end if;
  v_checks := v_checks + 1;
  perform public.admin_publish_nav(s1, 'Published close of day');

  -- Admin position report: value 1,15,000, profit 15,000; 2 completed months × ₹100 → final profit 14,800.
  select * into v_p from public.client_position_report where snapshot_id = s1 and client_id = v_a;
  if v_p.net_value <> 115000 or v_p.profit <> 15000 or v_p.performance_fee_share <> 15000
     or v_p.admin_fee_monthly <> 100 or v_p.admin_fee_months <> 2 or v_p.admin_fee <> 200
     or v_p.final_profit <> 14800 or v_p.final_value <> 114800 then
    raise exception 'TEST FAILED: client A position: %', row_to_json(v_p);
  end if;
  v_checks := v_checks + 1;

  -- What client A sees: NAV 115, profit 15,000, admin fee 2 × ₹100, final profit 14,800 — no performance fee.
  perform set_config('request.jwt.claims', json_build_object('sub', v_a, 'role', 'authenticated')::text, true);
  select * into v_p from public.client_my_cycles();
  if v_p.latest_nav <> '115.00000000' or v_p.current_value <> '115000.00' or v_p.profit <> '15000.00'
     or v_p.admin_fee_monthly <> '100.00' or v_p.admin_fee_months <> 2 or v_p.admin_fee <> '200.00'
     or v_p.final_profit <> '14800.00' or v_p.final_value <> '114800.00' then
    raise exception 'TEST FAILED: client A portal figures: %', row_to_json(v_p);
  end if;
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  v_checks := v_checks + 1;

  -- ================================================================ previous-day NAV rule (India time)
  execute 'set local role postgres';
  if private.applicable_nav(v_cycle, private.ist_day_start(v_t2) + interval '1 day' - interval '1 second') <> 100 then
    raise exception 'TEST FAILED: money late on the NAV day must use the earlier NAV (base 100)';
  end if;
  if private.applicable_nav(v_cycle, private.ist_day_start(v_t2) + interval '1 day') <> 115 then
    raise exception 'TEST FAILED: money from the next day must use that NAV (115)';
  end if;
  if private.applicable_nav(v_cycle, private.ist_day_start(v_t2) + interval '3 days' + interval '20 hours') <> 115 then
    raise exception 'TEST FAILED: days without a NAV (weekend) must use the last NAV before them';
  end if;
  execute 'set local role authenticated';
  v_checks := v_checks + 1;

  -- ================================================================ today: Client B joins mid-cycle at NAV 115
  c_b := public.admin_record_contribution(v_cycle, v_b, 130000, now() - interval '1 hour', 'upi', 'F-2', null);
  select nav_date into v_s.nav_date from public.admin_preview_verification(c_b);
  if v_s.nav_date <> v_t2 then raise exception 'TEST FAILED: preview should name the NAV date used'; end if;
  -- Verification date: not before receipt, not on/before the latest published NAV, not in the future.
  v_raised := false;
  begin
    perform public.admin_verify_contribution(c_b, 'Before receipt', now() - interval '2 hours');
  exception when invalid_parameter_value then v_raised := true;
  end;
  if not v_raised then raise exception 'TEST FAILED: verified before the money was received'; end if;
  -- Old paperwork received before the published NAV: verifying it inside published history is refused.
  c_a := public.admin_record_contribution(v_cycle, v_b, 5000, v_t2 - interval '1 hour', 'other', 'F-OLD', null);
  v_raised := false;
  begin
    perform public.admin_verify_contribution(c_a, 'Inside published history', v_t2 - interval '30 minutes');
  exception when invalid_parameter_value then
    v_raised := sqlerrm like '%after the latest published NAV%';
  end;
  if not v_raised then raise exception 'TEST FAILED: verification dated before a published NAV accepted'; end if;
  perform public.admin_reject_contribution(c_a, 'Test paperwork only');
  v_raised := false;
  begin
    perform public.admin_verify_contribution(c_b, 'Future date', now() + interval '1 day');
  exception when invalid_parameter_value then v_raised := true;
  end;
  if not v_raised then raise exception 'TEST FAILED: future verification date accepted'; end if;
  v_checks := v_checks + 1;

  perform public.admin_verify_contribution(c_b, 'Joined mid-cycle', now() - interval '30 minutes');
  if (select verified_at from public.contributions where id = c_b) <> now() - interval '30 minutes'
     or (select created_at from public.client_unit_allocations where contribution_id = c_b) <> now() - interval '30 minutes' then
    raise exception 'TEST FAILED: chosen verification date not used for the units';
  end if;
  v_checks := v_checks + 1;
  select units_issued into v_units from public.contributions where id = c_b;
  if (select applicable_nav from public.contributions where id = c_b) <> 115 or v_units <> 1130.43478260 then
    raise exception 'TEST FAILED: B should get 1,130.43478260 units at 115 (got %)', v_units;
  end if;
  v_checks := v_checks + 1;
  perform pg_sleep(0.02);

  -- Market rises 130 → 140 on all money: assets 2,80,000; invested 2,30,000 → profit 50,000, fee 25,000.
  v_val := public.admin_save_valuation_draft(null, v_cycle, clock_timestamp(), '280000', '0', '0', null, '[]');
  perform public.admin_approve_valuation(v_val, 'Close of day');
  s2 := public.admin_calculate_nav(v_val, null);
  select * into v_s from public.nav_snapshots where id = s2;
  v_nav := round(255000::numeric(38, 20) / (1000 + v_units), 8);
  if v_s.net_contributed <> 230000 or v_s.profit_before_fee <> 50000 or v_s.performance_fee_amount <> 25000
     or v_s.net_nav_per_unit <> v_nav then
    raise exception 'TEST FAILED: mid-cycle NAV (expected %): %', v_nav, row_to_json(v_s);
  end if;
  v_checks := v_checks + 1;

  -- Both clients share one NAV; positions reconcile to assets − fee (within rounding).
  select count(*), sum(net_value) into v_n, v_num from public.client_position_report
   where snapshot_id = s2 and net_nav_per_unit = v_nav;
  if v_n <> 2 or abs(v_num - 255000) > 0.02 then
    raise exception 'TEST FAILED: positions do not reconcile (% clients, total %)', v_n, v_num;
  end if;
  select * into v_p from public.client_position_report where snapshot_id = s2 and client_id = v_b;
  if v_p.contributed <> 130000 or v_p.net_value <> round(v_units * v_nav, 2)
     or v_p.profit <> round(v_units * v_nav, 2) - 130000
     -- B joined today: no completed month yet, so no admin fee.
     or v_p.admin_fee_months <> 0 or v_p.final_profit <> v_p.profit then
    raise exception 'TEST FAILED: client B position: %', row_to_json(v_p);
  end if;
  v_checks := v_checks + 1;
  perform public.admin_publish_nav(s2, 'Published close of day');

  -- ================================================================ loss: no performance fee, admin fee still deducted
  perform pg_sleep(0.02);
  v_val := public.admin_save_valuation_draft(null, v_cycle, clock_timestamp(), '200000', '0', '0', null, '[]');
  perform public.admin_approve_valuation(v_val, 'Market fell');
  s3 := public.admin_calculate_nav(v_val, null);
  select * into v_s from public.nav_snapshots where id = s3;
  if v_s.profit_before_fee <> -30000 or v_s.performance_fee_amount <> 0 or v_s.net_nav_per_unit <> v_s.gross_nav_per_unit then
    raise exception 'TEST FAILED: with a loss there is no fee and NAV = gross NAV: %', row_to_json(v_s);
  end if;
  select * into v_p from public.client_position_report where snapshot_id = s3 and client_id = v_a;
  if v_p.profit >= 0 or v_p.admin_fee <> 200 or v_p.final_profit <> v_p.profit - 200 then
    raise exception 'TEST FAILED: admin fee must be deducted even at a loss: %', row_to_json(v_p);
  end if;
  v_checks := v_checks + 1;
  perform public.admin_publish_nav(s3, 'Published after fall');

  -- Published fee figures are frozen.
  execute 'set local role postgres';
  v_raised := false;
  begin
    update public.nav_snapshots set performance_fee_amount = 0 where id = s2;
  exception when check_violation then v_raised := true;
  end;
  if not v_raised then raise exception 'TEST FAILED: published fee edited'; end if;
  v_raised := false;
  begin
    update public.nav_snapshots set profit_before_fee = 0 where id = s2;
  exception when check_violation then v_raised := true;
  end;
  if not v_raised then raise exception 'TEST FAILED: published profit edited'; end if;
  execute 'set local role authenticated';
  v_checks := v_checks + 1;

  -- ================================================================ admin fee edit + cycle close record
  perform public.admin_set_admin_fee(v_cycle, 150, 'Revised admin cost');
  select admin_fee into v_num from public.client_position_report where snapshot_id = s3 and client_id = v_a;
  if v_num <> 300 then raise exception 'TEST FAILED: edited monthly fee not applied (% for 2 months)', v_num; end if;
  v_checks := v_checks + 1;

  v_raised := false;
  begin
    perform public.admin_record_fee_crystallisation(v_cycle, 'Too early');
  exception when check_violation then v_raised := true;
  end;
  if not v_raised then raise exception 'TEST FAILED: crystallised an open cycle'; end if;
  perform public.admin_set_cycle_status(v_cycle, 'active', 'Deployed');
  perform public.admin_set_cycle_status(v_cycle, 'closed', 'Cycle ended');
  perform public.admin_record_fee_crystallisation(v_cycle, 'Final fees recorded');
  select * into v_cr from public.fee_crystallisations where cycle_id = v_cycle;
  -- A: 2 months × ₹150; B: 0 months → total ₹300.
  if v_cr.total_fee_amount <> 0 or v_cr.admin_fee_per_client <> 150 or v_cr.clients_charged <> 2
     or v_cr.admin_fee_total <> 300 or v_cr.snapshot_id <> s3 then
    raise exception 'TEST FAILED: crystallisation: %', row_to_json(v_cr);
  end if;
  v_raised := false;
  begin
    perform public.admin_record_fee_crystallisation(v_cycle, 'Second time');
  exception when check_violation then v_raised := true;
  end;
  if not v_raised then raise exception 'TEST FAILED: crystallised twice'; end if;
  v_checks := v_checks + 1;

  -- ================================================================ clients cannot read fee data or change fees
  perform set_config('request.jwt.claims', json_build_object('sub', v_other, 'role', 'authenticated')::text, true);
  select count(*) into v_n from public.client_position_report;
  if v_n <> 0 then raise exception 'TEST FAILED: client can read the position report'; end if;
  select count(*) into v_n from public.fee_crystallisations;
  if v_n <> 0 then raise exception 'TEST FAILED: client can read crystallisations'; end if;
  v_raised := false;
  begin
    perform public.admin_set_admin_fee(v_cycle, 0, 'Client attempt');
  exception when insufficient_privilege then v_raised := true;
  end;
  if not v_raised then raise exception 'TEST FAILED: client could change the admin fee'; end if;
  v_checks := v_checks + 1;

  raise exception 'ALL_FEE_TESTS_PASSED (% checks)', v_checks;
end;
$$;
