-- =============================================================================
-- Tests for contributions, verification and the unit ledger (Module 7)
--
-- SAFE TO RUN AGAINST ANY DATABASE: one DO block that always ends by raising an
-- exception, so every change is rolled back.
--
-- Expected final output:   ALL_CONTRIBUTION_TESTS_PASSED (n checks)
-- Run: npx supabase db query --remote --yes -f supabase/tests/contributions.test.sql
-- =============================================================================
do $$
declare
  v_admin  uuid := gen_random_uuid();
  v_rahul  uuid := gen_random_uuid();
  v_amit   uuid := gen_random_uuid();
  v_sagar  uuid := gen_random_uuid();
  v_cyc100 uuid;
  v_cyc105 uuid;
  v_cyc110 uuid;
  v_draft  uuid;
  c_rahul  uuid;
  c_amit   uuid;
  c_sagar  uuid;
  c_x      uuid;
  c_y      uuid;
  c_rej    uuid;
  v_n      int;
  v_num    numeric;
  v_text   text;
  v_raised boolean;
  v_checks int := 0;
  v_row    record;
begin
  insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, email_confirmed_at, created_at, updated_at)
  values
    (v_admin, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ctest-admin@example.test', '{"full_name":"C Admin"}', now(), now(), now()),
    (v_rahul, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ctest-rahul@example.test', '{"full_name":"Rahul (fictional)"}', now(), now(), now()),
    (v_amit,  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ctest-amit@example.test',  '{"full_name":"Amit (fictional)"}',  now(), now(), now()),
    (v_sagar, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ctest-sagar@example.test', '{"full_name":"Sagar (fictional)"}', now(), now(), now());
  update public.profiles set role = 'admin' where id = v_admin;

  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';

  v_cyc100 := public.admin_create_cycle('CTest NAV 100', null, current_date - 10, current_date + 300, 100, 0.2);
  v_cyc105 := public.admin_create_cycle('CTest NAV 105', null, current_date - 10, current_date + 300, 105, 0.2);
  v_cyc110 := public.admin_create_cycle('CTest NAV 110', null, current_date - 10, current_date + 300, 110, 0.2);
  v_draft  := public.admin_create_cycle('CTest Draft',   null, current_date - 10, current_date + 300, 100, 0.2);
  perform public.admin_set_cycle_status(v_cyc100, 'open', 'Open for test');
  perform public.admin_set_cycle_status(v_cyc105, 'open', 'Open for test');
  perform public.admin_set_cycle_status(v_cyc110, 'open', 'Open for test');

  -- ================================================================ recording rules
  v_raised := false;
  begin
    perform public.admin_record_contribution(v_draft, v_rahul, 1000, now(), 'upi', null, null);
  exception when check_violation then v_raised := true;
  end;
  if not v_raised then raise exception 'TEST FAILED: contribution recorded in a draft cycle'; end if;
  v_checks := v_checks + 1;

  v_raised := false;
  begin
    perform public.admin_record_contribution(v_cyc100, v_rahul, 0, now(), 'upi', null, null);
  exception when invalid_parameter_value then v_raised := true;
  end;
  if not v_raised then raise exception 'TEST FAILED: zero amount accepted'; end if;
  v_checks := v_checks + 1;

  v_raised := false;
  begin
    perform public.admin_record_contribution(v_cyc100, v_rahul, 100.005, now(), 'upi', null, null);
  exception when invalid_parameter_value then v_raised := true;
  end;
  if not v_raised then raise exception 'TEST FAILED: fractional paise accepted'; end if;
  v_checks := v_checks + 1;

  v_raised := false;
  begin
    perform public.admin_record_contribution(v_cyc100, v_rahul, 1000, now() + interval '1 day', 'upi', null, null);
  exception when invalid_parameter_value then v_raised := true;
  end;
  if not v_raised then raise exception 'TEST FAILED: future received date accepted'; end if;
  v_checks := v_checks + 1;

  v_raised := false;
  begin
    perform public.admin_record_contribution(v_cyc100, v_admin, 1000, now(), 'upi', null, null);
  exception when no_data_found then v_raised := true;
  end;
  if not v_raised then raise exception 'TEST FAILED: contribution recorded for an admin (non-client)'; end if;
  v_checks := v_checks + 1;

  -- ================================================================ spec examples (BUSINESS_LOGIC §2)
  c_rahul := public.admin_record_contribution(v_cyc100, v_rahul, 100000,  now() - interval '1 hour', 'bank_transfer', 'UTR-RAHUL-1', 'Internal note');
  c_amit  := public.admin_record_contribution(v_cyc105, v_amit,  50000,   now() - interval '1 hour', 'upi',           'UPI-AMIT-1',  null);
  c_sagar := public.admin_record_contribution(v_cyc110, v_sagar, 150000,  now() - interval '1 hour', 'cheque',        'CHQ-000123',  null);

  -- No units before verification.
  select count(*) into v_n from public.client_unit_allocations where contribution_id in (c_rahul, c_amit, c_sagar);
  if v_n <> 0 then raise exception 'TEST FAILED: units issued before verification'; end if;
  v_checks := v_checks + 1;

  -- Server preview equals what verification issues.
  select units into v_text from public.admin_preview_verification(c_amit);
  if v_text <> '476.19047619' then raise exception 'TEST FAILED: preview units %, expected 476.19047619', v_text; end if;
  v_checks := v_checks + 1;

  perform public.admin_verify_contribution(c_rahul, 'Matched bank statement');
  perform public.admin_verify_contribution(c_amit,  'Matched UPI receipt');
  perform public.admin_verify_contribution(c_sagar, 'Cheque cleared');

  select units_issued into v_num from public.contributions where id = c_rahul;
  if v_num <> 1000.00000000 then raise exception 'TEST FAILED: Rahul units %, expected 1000', v_num; end if;
  select units_issued into v_num from public.contributions where id = c_amit;
  if v_num::text <> '476.19047619' then raise exception 'TEST FAILED: Amit units %, expected 476.19047619', v_num; end if;
  select units_issued into v_num from public.contributions where id = c_sagar;
  if v_num::text <> '1363.63636363' then raise exception 'TEST FAILED: Sagar units % (must round DOWN to 1363.63636363)', v_num; end if;
  v_checks := v_checks + 3;

  -- Never over-issue: units × entry NAV ≤ amount, for every lot.
  select count(*) into v_n from public.client_unit_allocations
   where entry_type = 'issue' and contribution_id in (c_rahul, c_amit, c_sagar) and units * entry_nav > amount;
  if v_n <> 0 then raise exception 'TEST FAILED: a lot is worth more than its contribution at entry NAV'; end if;
  v_checks := v_checks + 1;

  -- Lot fields: entry NAV = HWM, zero loss carry-forward, locked fee rate.
  select * into v_row from public.client_unit_allocations where contribution_id = c_amit and entry_type = 'issue';
  if v_row.entry_nav <> 105 or v_row.reference_hwm <> 105 or v_row.loss_carry_forward <> 0 or v_row.fee_rate <> 0.2 then
    raise exception 'TEST FAILED: lot fields incorrect: %', row_to_json(v_row);
  end if;
  v_checks := v_checks + 1;

  -- ================================================================ issue exactly once
  v_raised := false;
  begin
    perform public.admin_verify_contribution(c_rahul, 'Verify twice by mistake');
  exception when check_violation then v_raised := true;
  end;
  if not v_raised then raise exception 'TEST FAILED: double verification accepted'; end if;
  select count(*) into v_n from public.client_unit_allocations where contribution_id = c_rahul;
  if v_n <> 1 then raise exception 'TEST FAILED: % ledger rows for one contribution', v_n; end if;
  v_checks := v_checks + 1;

  v_raised := false;
  begin
    perform public.admin_verify_contribution(c_rahul, 'x');
  exception when invalid_parameter_value then v_raised := true;
  end;
  if not v_raised then raise exception 'TEST FAILED: verification without a reason accepted'; end if;
  v_checks := v_checks + 1;

  -- Duplicate live reference rejected; allowed again once the first is rejected.
  v_raised := false;
  begin
    perform public.admin_record_contribution(v_cyc105, v_amit, 50000, now(), 'upi', ' upi-amit-1 ', null);
  exception when check_violation then v_raised := true;
  end;
  if not v_raised then raise exception 'TEST FAILED: duplicate payment reference accepted'; end if;
  v_checks := v_checks + 1;

  -- ================================================================ reject
  c_rej := public.admin_record_contribution(v_cyc105, v_amit, 2500, now(), 'upi', 'UPI-DUP-9', null);
  perform public.admin_reject_contribution(c_rej, 'Payment not received in bank');
  select status::text into v_text from public.contributions where id = c_rej;
  if v_text <> 'rejected' then raise exception 'TEST FAILED: reject did not apply'; end if;
  v_raised := false;
  begin
    perform public.admin_verify_contribution(c_rej, 'Verify a rejected one');
  exception when check_violation then v_raised := true;
  end;
  if not v_raised then raise exception 'TEST FAILED: rejected contribution verified'; end if;
  perform public.admin_record_contribution(v_cyc105, v_amit, 2500, now(), 'upi', 'UPI-DUP-9', 'Re-recorded after rejection');
  v_checks := v_checks + 1;

  -- ================================================================ reverse
  perform public.admin_reverse_contribution(c_rahul, 'Bank recalled the transfer');
  select sum(units) into v_num from public.client_unit_allocations where contribution_id = c_rahul;
  if v_num <> 0 then raise exception 'TEST FAILED: reversal did not cancel units (net %)', v_num; end if;
  select count(*) into v_n from public.client_unit_allocations where contribution_id = c_rahul;
  if v_n <> 2 then raise exception 'TEST FAILED: reversal should add a mirror row (rows %)', v_n; end if;
  select outstanding_units into v_num from public.cycle_unit_summary where cycle_id = v_cyc100;
  if v_num <> 0 then raise exception 'TEST FAILED: outstanding units after reversal %', v_num; end if;
  v_raised := false;
  begin
    perform public.admin_reverse_contribution(c_rahul, 'Reverse twice');
  exception when check_violation then v_raised := true;
  end;
  if not v_raised then raise exception 'TEST FAILED: double reversal accepted'; end if;
  v_checks := v_checks + 1;

  -- ================================================================ fee rate locked per lot (Decision C)
  c_x := public.admin_record_contribution(v_cyc105, v_amit, 10500, now(), 'other', null, null);
  c_y := public.admin_record_contribution(v_cyc105, v_amit, 21000, now(), 'other', null, null);
  perform public.admin_verify_contribution(c_x, 'Before rate change');
  perform public.admin_add_fee_terms(v_cyc105, 0.25, now() + interval '5 milliseconds', 'Rate change for test');
  perform pg_sleep(0.05);
  perform public.admin_verify_contribution(c_y, 'After rate change');
  select fee_rate into v_num from public.client_unit_allocations where contribution_id = c_x and entry_type = 'issue';
  if v_num <> 0.2 then raise exception 'TEST FAILED: earlier lot fee rate changed to %', v_num; end if;
  select fee_rate into v_num from public.client_unit_allocations where contribution_id = c_y and entry_type = 'issue';
  if v_num <> 0.25 then raise exception 'TEST FAILED: later lot fee rate %, expected 0.25', v_num; end if;
  v_checks := v_checks + 1;

  -- Holdings and summary
  select outstanding_units, investor_count into v_num, v_n from public.cycle_unit_summary where cycle_id = v_cyc105;
  -- 476.19047619 + 100 + 200
  if v_num <> 776.19047619 or v_n <> 1 then raise exception 'TEST FAILED: cycle summary (units %, investors %)', v_num, v_n; end if;
  select units into v_num from public.client_cycle_holdings where client_id = v_amit and cycle_id = v_cyc105;
  if v_num <> 776.19047619 then raise exception 'TEST FAILED: client holdings %', v_num; end if;
  v_checks := v_checks + 1;

  -- ================================================================ inactive client / closed cycle
  c_x := public.admin_record_contribution(v_cyc110, v_sagar, 11000, now(), 'upi', null, null);
  perform public.admin_set_user_status(v_sagar, 'inactive', 'Left the group');
  v_raised := false;
  begin
    perform public.admin_verify_contribution(c_x, 'Verify for inactive client');
  exception when check_violation then v_raised := true;
  end;
  if not v_raised then raise exception 'TEST FAILED: verified for an inactive client'; end if;
  v_checks := v_checks + 1;

  perform public.admin_set_cycle_status(v_cyc110, 'active', 'Deploy');
  perform public.admin_set_cycle_status(v_cyc110, 'closed', 'End of cycle');
  v_raised := false;
  begin
    perform public.admin_record_contribution(v_cyc110, v_amit, 1000, now(), 'upi', null, null);
  exception when check_violation then v_raised := true;
  end;
  if not v_raised then raise exception 'TEST FAILED: recorded into a closed cycle'; end if;
  v_raised := false;
  begin
    perform public.admin_reverse_contribution(c_sagar, 'Reverse after close');
  exception when check_violation then v_raised := true;
  end;
  if not v_raised then raise exception 'TEST FAILED: reversed after cycle close'; end if;
  v_checks := v_checks + 1;

  -- ================================================================ audit
  select count(*) into v_n from public.audit_logs
   where entity_type = 'contribution' and entity_id = c_sagar and action = 'contribution.verified'
     and reason = 'Cheque cleared' and after_data ->> 'units_issued' = '1363.63636363' and actor_id = v_admin;
  if v_n <> 1 then raise exception 'TEST FAILED: verification not audited correctly'; end if;
  select count(*) into v_n from public.audit_logs
   where entity_id = c_rahul and action in ('contribution.recorded', 'contribution.verified', 'contribution.reversed');
  if v_n <> 3 then raise exception 'TEST FAILED: Rahul audit trail has % rows, expected 3', v_n; end if;
  v_checks := v_checks + 1;

  -- ================================================================ clients see nothing; cannot act
  perform set_config('request.jwt.claims', json_build_object('sub', v_amit, 'role', 'authenticated')::text, true);
  select count(*) into v_n from public.contributions;
  if v_n <> 0 then raise exception 'TEST FAILED: client can read contributions (admin notes)'; end if;
  select count(*) into v_n from public.contribution_register;
  if v_n <> 0 then raise exception 'TEST FAILED: client can read the contribution register'; end if;
  v_raised := false;
  begin
    perform public.admin_record_contribution(v_cyc105, v_amit, 1000, now(), 'upi', null, null);
  exception when insufficient_privilege then v_raised := true;
  end;
  if not v_raised then raise exception 'TEST FAILED: client could record a contribution'; end if;
  v_raised := false;
  begin
    perform public.admin_verify_contribution(c_y, 'Client verifying');
  exception when insufficient_privilege then v_raised := true;
  end;
  if not v_raised then raise exception 'TEST FAILED: client could verify'; end if;
  v_raised := false;
  begin
    insert into public.client_unit_allocations (cycle_id, client_id, contribution_id, entry_type, units, amount, entry_nav, reference_hwm, fee_rate, fee_terms_id, created_by)
    select v_cyc105, v_amit, c_amit, 'issue', 999, 1, 1, 1, 0, id, v_amit from public.cycle_fee_terms limit 1;
  exception when insufficient_privilege then v_raised := true;
  end;
  if not v_raised then raise exception 'TEST FAILED: client could insert units'; end if;
  v_checks := v_checks + 1;

  -- ================================================================ owner-level tampering
  execute 'set local role postgres';

  v_raised := false;
  begin
    update public.contributions set amount = 1 where id = c_amit;
  exception when check_violation then v_raised := true;
  end;
  if not v_raised then raise exception 'TEST FAILED: owner changed a contribution amount'; end if;

  v_raised := false;
  begin
    update public.contributions set units_issued = 9999 where id = c_amit;
  exception when check_violation then v_raised := true;
  end;
  if not v_raised then raise exception 'TEST FAILED: owner changed issued units'; end if;

  v_raised := false;
  begin
    update public.client_unit_allocations set units = 9999 where contribution_id = c_amit;
  exception when insufficient_privilege then v_raised := true;
  end;
  if not v_raised then raise exception 'TEST FAILED: owner edited the unit ledger'; end if;

  v_raised := false;
  begin
    delete from public.client_unit_allocations where contribution_id = c_amit;
  exception when insufficient_privilege then v_raised := true;
  end;
  if not v_raised then raise exception 'TEST FAILED: owner deleted ledger rows'; end if;

  v_raised := false;
  begin
    delete from public.contributions where id = c_amit;
  exception when insufficient_privilege then v_raised := true;
  end;
  if not v_raised then raise exception 'TEST FAILED: owner deleted a contribution'; end if;

  v_raised := false;
  begin
    insert into public.client_unit_allocations (cycle_id, client_id, contribution_id, entry_type, units, amount, entry_nav, reference_hwm, fee_rate, fee_terms_id, created_by)
    select v_cyc105, v_amit, c_amit, 'issue', 1, 1, 1, 1, 0, id, v_admin from public.cycle_fee_terms where cycle_id = v_cyc105 limit 1;
  exception when unique_violation then v_raised := true;
  end;
  if not v_raised then raise exception 'TEST FAILED: second issue row for the same contribution accepted'; end if;
  v_checks := v_checks + 1;

  raise exception 'ALL_CONTRIBUTION_TESTS_PASSED (% checks)', v_checks;
end;
$$;
