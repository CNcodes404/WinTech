-- =============================================================================
-- Tests for client portal data access and forced password change (Module 12)
--
-- SAFE TO RUN AGAINST ANY DATABASE: one DO block that always ends by raising an
-- exception, so every change is rolled back.
--
-- Expected final output:   ALL_CLIENT_PORTAL_TESTS_PASSED (n checks)
-- Run: npx supabase db query --remote --yes -f supabase/tests/client_portal.test.sql
-- =============================================================================
do $$
declare
  v_admin   uuid := gen_random_uuid();
  v_a       uuid := gen_random_uuid();
  v_b       uuid := gen_random_uuid();
  v_c       uuid := gen_random_uuid();
  v_new     uuid := gen_random_uuid();
  v_cycle   uuid;
  v_cycle2  uuid;
  c_a       uuid;
  c_a_pend  uuid;
  c_b       uuid;
  v_val     uuid;
  v_snap    uuid;
  v_n       int;
  v_text    text;
  v_bool    boolean;
  v_raised  boolean;
  v_checks  int := 0;
  v_row     record;
begin
  insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, raw_app_meta_data, email_confirmed_at, created_at, updated_at)
  values
    (v_admin, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ptest-admin@example.test', '{"full_name":"P Admin"}', '{}', now(), now(), now()),
    (v_a, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ptest-a@example.test', '{"full_name":"Client A"}', '{}', now(), now(), now()),
    (v_b, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ptest-b@example.test', '{"full_name":"Client B"}', '{}', now(), now(), now()),
    (v_c, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ptest-c@example.test', '{"full_name":"Client C"}', '{}', now(), now(), now());
  update public.profiles set role = 'admin' where id = v_admin;

  -- ================================================================ forced password change flag
  insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, raw_app_meta_data, email_confirmed_at, created_at, updated_at)
  values (v_new, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ptest-new@example.test',
          '{"full_name":"New Client"}', jsonb_build_object('created_by', v_admin), now(), now(), now());
  select must_change_password into v_bool from public.profiles where id = v_new;
  if not v_bool then raise exception 'TEST FAILED: admin-created account not flagged for password change'; end if;
  select must_change_password into v_bool from public.profiles where id = v_a;
  if v_bool then raise exception 'TEST FAILED: self-created/bootstrap account flagged'; end if;
  v_checks := v_checks + 1;

  -- ================================================================ admin sets up data
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';

  v_cycle := public.admin_create_cycle('PTest Cycle', null, current_date - 30, current_date + 300, 100, 0.2);
  v_cycle2 := public.admin_create_cycle('PTest Other Cycle', null, current_date - 30, current_date + 300, 100, 0.2);
  perform public.admin_set_cycle_status(v_cycle, 'open', 'Open for test');
  perform public.admin_set_cycle_status(v_cycle2, 'open', 'Open for test');

  c_a := public.admin_record_contribution(v_cycle, v_a, 100000, now() - interval '2 hours', 'bank_transfer', 'P-1', 'SECRET ADMIN NOTE');
  perform public.admin_verify_contribution(c_a, 'SECRET VERIFY REASON');
  c_b := public.admin_record_contribution(v_cycle, v_b, 50000, now() - interval '2 hours', 'upi', 'P-2', 'B private note');
  perform public.admin_verify_contribution(c_b, 'Matched');
  perform public.admin_verify_contribution(
    public.admin_record_contribution(v_cycle2, v_b, 20000, now() - interval '2 hours', 'upi', 'P-3', null), 'Matched');
  c_a_pend := public.admin_record_contribution(v_cycle, v_a, 2500, now() - interval '1 hour', 'cheque', 'P-4', 'pending note');
  perform public.admin_record_contribution(v_cycle, v_c, 1000, now() - interval '1 hour', 'upi', 'P-5', null);
  perform pg_sleep(0.02);

  -- NAV ₹116 on 1,500 units.
  v_val := public.admin_save_valuation_draft(null, v_cycle, clock_timestamp(), '174000', '0', '0', null, '[]');
  perform public.admin_approve_valuation(v_val, 'Demo valuation');
  v_snap := public.admin_calculate_nav(v_val, null);
  perform public.admin_publish_nav(v_snap, 'Published 116');

  -- Admins are not clients.
  v_raised := false;
  begin
    perform * from public.client_my_cycles();
  exception when insufficient_privilege then v_raised := true;
  end;
  if not v_raised then raise exception 'TEST FAILED: admin could call client functions'; end if;
  v_checks := v_checks + 1;

  perform public.admin_set_user_status(v_c, 'inactive', 'Left the group');

  -- ================================================================ client A
  perform set_config('request.jwt.claims', json_build_object('sub', v_a, 'role', 'authenticated')::text, true);

  select count(*) into v_n from public.client_my_cycles();
  if v_n <> 1 then raise exception 'TEST FAILED: client A sees % cycles (expected 1)', v_n; end if;
  select * into v_row from public.client_my_cycles();
  if v_row.units <> '1000.00000000' or v_row.latest_gross_nav <> '116.00000000' or v_row.fee_amount <> '3200.00'
     or v_row.gross_value <> '116000.00' or v_row.net_value <> '112800.00' or v_row.lots_contributed <> '100000.00'
     or v_row.current_fee_rate <> '0.200000' then
    raise exception 'TEST FAILED: client A cycle summary: %', row_to_json(v_row);
  end if;
  v_checks := v_checks + 2;

  select count(*) into v_n from public.client_my_contributions();
  if v_n <> 2 then raise exception 'TEST FAILED: client A sees % contributions (expected own 2)', v_n; end if;
  select string_agg(row_to_json(x)::text, ',') into v_text from public.client_my_contributions() x;
  if v_text like '%SECRET%' or v_text like '%P-2%' or v_text like '%pending note%' then
    raise exception 'TEST FAILED: admin notes/reasons or other clients leaked: %', v_text;
  end if;
  v_checks := v_checks + 1;

  select count(*) into v_n from public.client_my_lot_values(v_cycle);
  if v_n <> 1 then raise exception 'TEST FAILED: client A lots % (expected 1)', v_n; end if;
  select fee_amount into v_text from public.client_my_lot_values(v_cycle);
  if v_text <> '3200.00' then raise exception 'TEST FAILED: client A lot fee %', v_text; end if;
  v_checks := v_checks + 1;

  -- A is not in cycle 2: nothing about it.
  select count(*) into v_n from public.client_my_lot_values(v_cycle2);
  if v_n <> 0 then raise exception 'TEST FAILED: client A sees lots of a cycle they are not in'; end if;
  select count(*) into v_n from public.client_nav_history(v_cycle2);
  if v_n <> 0 then raise exception 'TEST FAILED: client A sees NAV of a cycle they are not in'; end if;
  select count(*) into v_n from public.client_nav_history(v_cycle);
  if v_n <> 1 then raise exception 'TEST FAILED: client A NAV history %', v_n; end if;
  v_checks := v_checks + 1;

  select string_agg(kind || ':' || coalesce(amount, '') , ',') into v_text from public.client_my_activity(50);
  if v_text not like '%units_issued:100000.00%' or v_text not like '%nav_published%'
     or v_text not like '%contribution_recorded:2500.00%' or v_text like '%50000.00%' then
    raise exception 'TEST FAILED: client A activity: %', v_text;
  end if;
  v_checks := v_checks + 1;

  -- No direct table access.
  select count(*) into v_n from public.contributions;
  if v_n <> 0 then raise exception 'TEST FAILED: client reads contributions table directly'; end if;
  select count(*) into v_n from public.lot_fee_accruals;
  if v_n <> 0 then raise exception 'TEST FAILED: client reads fee accruals directly'; end if;
  select count(*) into v_n from public.nav_snapshots;
  if v_n <> 0 then raise exception 'TEST FAILED: client reads NAV snapshots directly'; end if;
  select count(*) into v_n from public.portfolio_valuation_items;
  if v_n <> 0 then raise exception 'TEST FAILED: client reads holdings'; end if;
  v_checks := v_checks + 1;

  -- Profile: own phone editable, flag not.
  update public.profiles set phone = '+91 90000 11111' where id = v_a;
  get diagnostics v_n = row_count;
  if v_n <> 1 then raise exception 'TEST FAILED: client could not edit own phone'; end if;
  v_raised := false;
  begin
    update public.profiles set must_change_password = false where id = v_a;
  exception when insufficient_privilege then v_raised := true;
  end;
  if not v_raised then raise exception 'TEST FAILED: client could change must_change_password directly'; end if;
  v_checks := v_checks + 1;

  -- ================================================================ client B sees only own lots in the shared cycle
  perform set_config('request.jwt.claims', json_build_object('sub', v_b, 'role', 'authenticated')::text, true);
  select count(*) into v_n from public.client_my_cycles();
  if v_n <> 2 then raise exception 'TEST FAILED: client B cycles % (expected 2)', v_n; end if;
  select count(*) into v_n from public.client_my_lot_values(v_cycle) where contribution_id = c_a;
  if v_n <> 0 then raise exception 'TEST FAILED: client B sees client A lot'; end if;
  select fee_amount into v_text from public.client_my_lot_values(v_cycle);
  if v_text <> '1600.00' then raise exception 'TEST FAILED: client B lot fee % (expected 1600.00)', v_text; end if;
  v_checks := v_checks + 1;

  -- ================================================================ inactive client and anon blocked
  perform set_config('request.jwt.claims', json_build_object('sub', v_c, 'role', 'authenticated')::text, true);
  v_raised := false;
  begin
    perform * from public.client_my_contributions();
  exception when insufficient_privilege then v_raised := true;
  end;
  if not v_raised then raise exception 'TEST FAILED: inactive client could read data'; end if;

  execute 'set local role anon';
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  v_raised := false;
  begin
    perform * from public.client_my_cycles();
  exception when insufficient_privilege then v_raised := true;
  end;
  if not v_raised then raise exception 'TEST FAILED: anon could call client functions'; end if;
  v_checks := v_checks + 1;

  -- ================================================================ completing the password change
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', v_new, 'role', 'authenticated')::text, true);
  perform public.complete_password_change();
  execute 'set local role postgres';
  select must_change_password into v_bool from public.profiles where id = v_new;
  if v_bool then raise exception 'TEST FAILED: flag not cleared'; end if;
  select count(*) into v_n from public.audit_logs where entity_id = v_new and action = 'profile.password_changed' and actor_id = v_new;
  if v_n <> 1 then raise exception 'TEST FAILED: password change not audited'; end if;
  v_checks := v_checks + 1;

  raise exception 'ALL_CLIENT_PORTAL_TESTS_PASSED (% checks)', v_checks;
end;
$$;
