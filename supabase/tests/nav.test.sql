-- =============================================================================
-- Tests for NAV calculation, publishing, corrections and NAV-based unit
-- issuance (Module 9)
--
-- SAFE TO RUN AGAINST ANY DATABASE: one DO block that always ends by raising an
-- exception, so every change is rolled back. Uses clock_timestamp() + small
-- sleeps so ledger entries and valuations have a real time order.
--
-- Expected final output:   ALL_NAV_TESTS_PASSED (n checks)
-- Run: npx supabase db query --remote --yes -f supabase/tests/nav.test.sql
-- =============================================================================
do $$
declare
  v_admin  uuid := gen_random_uuid();
  v_rahul  uuid := gen_random_uuid();
  v_amit   uuid := gen_random_uuid();
  v_client uuid := gen_random_uuid();
  v_cycle  uuid;
  c_rahul  uuid;
  c_amit   uuid;
  c_early  uuid;
  v_val1   uuid;
  v_val1c  uuid;
  v_val3   uuid;
  v_tmp    uuid;
  s1       uuid;
  s1b      uuid;
  s3       uuid;
  s_corr   uuid;
  v_t1     timestamptz;
  v_n      int;
  v_num    numeric;
  v_text   text;
  v_raised boolean;
  v_checks int := 0;
  v_s      public.nav_snapshots;
begin
  insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, email_confirmed_at, created_at, updated_at)
  values
    (v_admin,  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ntest-admin@example.test',  '{"full_name":"N Admin"}', now(), now(), now()),
    (v_rahul,  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ntest-rahul@example.test',  '{"full_name":"Rahul (fictional)"}', now(), now(), now()),
    (v_amit,   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ntest-amit@example.test',   '{"full_name":"Amit (fictional)"}', now(), now(), now()),
    (v_client, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ntest-client@example.test', '{"full_name":"Other"}', now(), now(), now());
  update public.profiles set role = 'admin' where id = v_admin;

  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';

  v_cycle := public.admin_create_cycle('NTest Cycle', null, current_date - 30, current_date + 300, 100, 0.2);
  perform public.admin_set_cycle_status(v_cycle, 'open', 'Open for test');

  -- ================================================================ no units yet
  v_tmp := public.admin_save_valuation_draft(null, v_cycle, clock_timestamp(), '1000', '0', '0', null, '[]');
  perform public.admin_approve_valuation(v_tmp, 'Valuation before any units');
  v_raised := false;
  begin
    perform public.admin_calculate_nav(v_tmp, null);
  exception when check_violation then v_raised := true;
  end;
  if not v_raised then raise exception 'TEST FAILED: NAV calculated with zero outstanding units'; end if;
  v_checks := v_checks + 1;

  -- Rahul: ₹1,00,000 at base NAV ₹100 → 1,000 units.
  c_rahul := public.admin_record_contribution(v_cycle, v_rahul, 100000, now() - interval '2 hours', 'bank_transfer', 'N-UTR-1', null);
  perform public.admin_verify_contribution(c_rahul, 'Matched bank statement');
  perform pg_sleep(0.02);

  -- Valuation v1 after Rahul's lot: net ₹1,05,000.
  v_t1 := clock_timestamp();
  v_val1 := public.admin_save_valuation_draft(null, v_cycle, v_t1, '105000', '0', '0', 'Demo', '[]');

  v_raised := false;
  begin
    perform public.admin_calculate_nav(v_val1, null);
  exception when check_violation then v_raised := true;
  end;
  if not v_raised then raise exception 'TEST FAILED: NAV calculated from a draft valuation'; end if;
  v_checks := v_checks + 1;

  perform public.admin_approve_valuation(v_val1, 'Checked demo cash');

  -- ================================================================ calculate (gross NAV = ₹105)
  s1 := public.admin_calculate_nav(v_val1, null);
  select * into v_s from public.nav_snapshots where id = s1;
  if v_s.gross_nav_per_unit <> 105 or v_s.total_outstanding_units <> 1000 or v_s.gross_net_asset_value <> 105000
     or v_s.status <> 'draft' or v_s.nav_date <> v_t1 or v_s.valuation_id <> v_val1
     -- Module 10 fee accrual: 1000 units × (105 − HWM 100) × 20% = ₹1,000 → net NAV (105000 − 1000) / 1000 = 104
     or v_s.performance_fee_amount <> 1000 or v_s.net_nav_per_unit <> 104 then
    raise exception 'TEST FAILED: snapshot incorrect: %', row_to_json(v_s);
  end if;
  v_checks := v_checks + 1;

  -- Recalculating replaces the draft (one draft per cycle).
  s1b := public.admin_calculate_nav(v_val1, null);
  select status::text into v_text from public.nav_snapshots where id = s1;
  if v_text <> 'discarded' then raise exception 'TEST FAILED: previous draft not replaced (%)', v_text; end if;
  v_checks := v_checks + 1;

  -- ================================================================ publish
  v_raised := false;
  begin
    perform public.admin_publish_nav(s1b, 'no');
  exception when invalid_parameter_value then v_raised := true;
  end;
  if not v_raised then raise exception 'TEST FAILED: publish without reason'; end if;

  perform public.admin_publish_nav(s1b, 'Month-end demo NAV');
  select * into v_s from public.nav_snapshots where id = s1b;
  if v_s.status <> 'published' or v_s.published_by <> v_admin or v_s.publish_reason <> 'Month-end demo NAV' then
    raise exception 'TEST FAILED: publish not recorded';
  end if;
  v_checks := v_checks + 1;

  v_raised := false;
  begin
    perform public.admin_calculate_nav(v_val1, null);
  exception when check_violation then v_raised := true;
  end;
  if not v_raised then raise exception 'TEST FAILED: second NAV for an already published date'; end if;
  v_checks := v_checks + 1;

  -- ================================================================ Decision B: units at latest published NAV
  perform pg_sleep(0.02);
  -- Amit: ₹50,000 received after the ₹105 NAV → 476.19047619 units (spec example).
  c_amit := public.admin_record_contribution(v_cycle, v_amit, 50000, clock_timestamp(), 'upi', 'N-UPI-1', null);
  perform public.admin_verify_contribution(c_amit, 'Matched UPI receipt');
  select applicable_nav, units_issued into v_num, v_text from public.contributions where id = c_amit;
  if v_num <> 105 or v_text <> '476.19047619' then
    raise exception 'TEST FAILED: Amit issued at NAV % / units %, expected 105 / 476.19047619', v_num, v_text;
  end if;
  select reference_hwm into v_num from public.client_unit_allocations where contribution_id = c_amit and entry_type = 'issue';
  if v_num <> 105 then raise exception 'TEST FAILED: Amit HWM % (should equal entry NAV 105)', v_num; end if;
  v_checks := v_checks + 1;

  -- Money received BEFORE the NAV date (verified later) still uses the NAV as of its receipt (base ₹100).
  c_early := public.admin_record_contribution(v_cycle, v_rahul, 1000, now() - interval '1 day', 'cheque', 'N-CHQ-1', null);
  perform public.admin_verify_contribution(c_early, 'Late-cleared cheque');
  select applicable_nav, units_issued into v_num, v_text from public.contributions where id = c_early;
  if v_num <> 100 or v_text <> '10.00000000' then
    raise exception 'TEST FAILED: early receipt used NAV % / units %', v_num, v_text;
  end if;
  v_checks := v_checks + 1;

  -- ================================================================ Decision E: stale valuation blocked
  -- A valuation timed before Amit's lot no longer reflects the money in the pool.
  perform pg_sleep(0.02);
  v_tmp := public.admin_save_valuation_draft(null, v_cycle, v_t1 + interval '1 millisecond', '200000', '0', '0', null, '[]');
  perform public.admin_approve_valuation(v_tmp, 'Valuation timed before new units');
  v_raised := false;
  begin
    perform public.admin_calculate_nav(v_tmp, null);
  exception when check_violation then
    v_raised := true;
    v_text := sqlerrm;
  end;
  if not v_raised or v_text not like 'Units changed after this valuation%' then
    raise exception 'TEST FAILED: stale valuation not blocked (msg: %)', v_text;
  end if;
  v_checks := v_checks + 1;

  -- ================================================================ fresh valuation → second NAV
  perform pg_sleep(0.02);
  v_val3 := public.admin_save_valuation_draft(null, v_cycle, clock_timestamp(), '163480.95', '0', '0', null, '[]');
  perform public.admin_approve_valuation(v_val3, 'Fresh valuation after new money');
  s3 := public.admin_calculate_nav(v_val3, null);
  select * into v_s from public.nav_snapshots where id = s3;
  -- 1000 + 476.19047619 + 10 units
  if v_s.total_outstanding_units <> 1486.19047619
     or v_s.gross_nav_per_unit <> round(163480.95::numeric / 1486.19047619::numeric, 8) then
    raise exception 'TEST FAILED: second NAV incorrect: %', row_to_json(v_s);
  end if;
  perform public.admin_publish_nav(s3, 'Updated demo NAV');
  v_checks := v_checks + 1;

  -- Publishing order: an older-dated NAV cannot be published after a newer one.
  v_raised := false;
  begin
    perform public.admin_calculate_nav(v_val1, null);
  exception when check_violation then v_raised := true;
  end;
  if not v_raised then raise exception 'TEST FAILED: back-dated NAV accepted'; end if;
  v_checks := v_checks + 1;

  -- ================================================================ correction of the first NAV (₹105 → ₹104)
  v_val1c := public.admin_save_valuation_draft(null, v_cycle, v_t1, '104000', '0', '0', 'Corrected cash', '[]', v_val1);
  perform public.admin_approve_valuation(v_val1c, 'Cash figure corrected');

  v_raised := false;
  begin
    perform public.admin_calculate_nav(v_val1c, s3);
  exception when check_violation then v_raised := true;
  end;
  if not v_raised then raise exception 'TEST FAILED: correction with mismatched date accepted'; end if;
  v_checks := v_checks + 1;

  s_corr := public.admin_calculate_nav(v_val1c, s1b);
  select * into v_s from public.nav_snapshots where id = s_corr;
  if v_s.gross_nav_per_unit <> 104 or v_s.total_outstanding_units <> 1000 then
    raise exception 'TEST FAILED: correction uses units as of the original date: %', row_to_json(v_s);
  end if;
  perform public.admin_publish_nav(s_corr, 'Corrected month-end NAV');
  select status::text into v_text from public.nav_snapshots where id = s1b;
  if v_text <> 'corrected' then raise exception 'TEST FAILED: original NAV not marked corrected (%)', v_text; end if;
  v_checks := v_checks + 1;

  -- Already-issued units are never rewritten by a NAV correction.
  select units_issued::text into v_text from public.contributions where id = c_amit;
  if v_text <> '476.19047619' then raise exception 'TEST FAILED: issued units changed after correction (%)', v_text; end if;
  v_checks := v_checks + 1;

  -- ================================================================ non-positive NAV
  perform pg_sleep(0.02);
  v_tmp := public.admin_save_valuation_draft(null, v_cycle, clock_timestamp(), '10', '0', '100', null, '[]');
  perform public.admin_approve_valuation(v_tmp, 'Liabilities exceed assets');
  v_raised := false;
  begin
    perform public.admin_calculate_nav(v_tmp, null);
  exception when check_violation then v_raised := true;
  end;
  if not v_raised then raise exception 'TEST FAILED: NAV calculated from a negative net asset value'; end if;
  v_checks := v_checks + 1;

  -- ================================================================ audit
  select count(*) into v_n from public.audit_logs
   where entity_type = 'nav_snapshot' and entity_id in (s1b, s3, s_corr)
     and action in ('nav.published', 'nav.corrected') and actor_id = v_admin;
  if v_n <> 4 then raise exception 'TEST FAILED: publish/correct audit rows = %, expected 4', v_n; end if;
  v_checks := v_checks + 1;

  -- ================================================================ applicable NAV now follows the correction
  execute 'set local role postgres';
  if private.applicable_nav(v_cycle, v_t1 + interval '1 millisecond') <> 104 then
    raise exception 'TEST FAILED: applicable NAV ignores the correction';
  end if;
  if private.applicable_nav(v_cycle, v_t1 - interval '1 second') <> 100 then
    raise exception 'TEST FAILED: applicable NAV before first publish should be base NAV';
  end if;
  v_checks := v_checks + 1;

  -- ================================================================ owner-level tampering
  v_raised := false;
  begin
    update public.nav_snapshots set gross_nav_per_unit = 999 where id = s3;
  exception when check_violation then v_raised := true;
  end;
  if not v_raised then raise exception 'TEST FAILED: owner changed a published NAV'; end if;

  v_raised := false;
  begin
    update public.nav_snapshots set status = 'published' where id = s1b;
  exception when check_violation then v_raised := true;
  end;
  if not v_raised then raise exception 'TEST FAILED: owner restored a corrected NAV'; end if;

  v_raised := false;
  begin
    delete from public.nav_snapshots where id = s3;
  exception when insufficient_privilege then v_raised := true;
  end;
  if not v_raised then raise exception 'TEST FAILED: owner deleted a NAV snapshot'; end if;
  v_checks := v_checks + 1;

  -- ================================================================ clients
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', v_client, 'role', 'authenticated')::text, true);
  select count(*) into v_n from public.nav_snapshots;
  if v_n <> 0 then raise exception 'TEST FAILED: client can read NAV snapshots'; end if;
  v_raised := false;
  begin
    perform public.admin_calculate_nav(v_val3, null);
  exception when insufficient_privilege then v_raised := true;
  end;
  if not v_raised then raise exception 'TEST FAILED: client could calculate NAV'; end if;
  v_checks := v_checks + 1;

  raise exception 'ALL_NAV_TESTS_PASSED (% checks)', v_checks;
end;
$$;
