-- =============================================================================
-- Tests for client "Add funds" payment requests (rollback-only).
-- Expected final output:   ALL_PAYMENT_REQUEST_TESTS_PASSED (n checks)
-- =============================================================================
do $$
declare
  v_admin  uuid := gen_random_uuid();
  v_a      uuid := gen_random_uuid();
  v_b      uuid := gen_random_uuid();
  v_cycle  uuid;
  v_draft  uuid;
  r1       uuid;
  r2       uuid;
  v_contr  uuid;
  v_n      int;
  v_text   text;
  v_raised boolean;
  v_checks int := 0;
begin
  insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, email_confirmed_at, created_at, updated_at)
  values
    (v_admin, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'qtest-admin@example.test', '{"full_name":"Q Admin"}', now(), now(), now()),
    (v_a,     '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'qtest-a@example.test', '{"full_name":"Client A"}', now(), now(), now()),
    (v_b,     '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'qtest-b@example.test', '{"full_name":"Client B"}', now(), now(), now());
  update public.profiles set role = 'admin' where id = v_admin;

  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  v_cycle := public.admin_create_cycle('QTest Cycle', null, current_date - 10, current_date + 300, 100, 0.2);
  perform public.admin_set_cycle_status(v_cycle, 'open', 'Open for test');
  v_draft := public.admin_create_cycle('QTest Draft', null, current_date - 10, current_date + 300, 100, 0.2);

  -- ================================================================ client A submits
  perform set_config('request.jwt.claims', json_build_object('sub', v_a, 'role', 'authenticated')::text, true);
  select count(*) into v_n from public.client_open_cycles() where cycle_id = v_cycle;
  if v_n <> 1 or exists (select 1 from public.client_open_cycles() where cycle_id = v_draft) then
    raise exception 'TEST FAILED: open cycles list (open shown, draft hidden)';
  end if;
  v_checks := v_checks + 1;

  r1 := public.client_submit_payment_request(v_cycle, 50000, now() - interval '1 hour', 'upi',
                                             'clienta@okbank', 'Client A', 'utr123456789', 'Paid via QR');
  select transaction_ref into v_text from public.client_my_payment_requests() where id = r1;
  if v_text <> 'UTR123456789' then raise exception 'TEST FAILED: UTR not normalised (%)', v_text; end if;
  v_checks := v_checks + 1;

  -- Validation.
  v_raised := false;
  begin
    perform public.client_submit_payment_request(v_cycle, 1000, now(), 'upi', null, null, 'UTR000000001', null);
  exception when invalid_parameter_value then v_raised := true;
  end;
  if not v_raised then raise exception 'TEST FAILED: UPI payment without payer UPI ID accepted'; end if;
  v_raised := false;
  begin
    perform public.client_submit_payment_request(v_cycle, 1000, now() + interval '1 day', 'upi', 'clienta@okbank', null, 'UTR000000002', null);
  exception when invalid_parameter_value then v_raised := true;
  end;
  if not v_raised then raise exception 'TEST FAILED: future payment date accepted'; end if;
  v_raised := false;
  begin
    perform public.client_submit_payment_request(v_cycle, 10.555, now(), 'bank_transfer', null, null, 'UTR000000003', null);
  exception when invalid_parameter_value then v_raised := true;
  end;
  if not v_raised then raise exception 'TEST FAILED: 3-decimal amount accepted'; end if;
  v_raised := false;
  begin
    perform public.client_submit_payment_request(v_draft, 1000, now(), 'bank_transfer', null, null, 'UTR000000004', null);
  exception when check_violation then v_raised := true;
  end;
  if not v_raised then raise exception 'TEST FAILED: request for a draft cycle accepted'; end if;
  v_checks := v_checks + 1;

  -- Same UTR cannot be claimed twice (case-insensitive), even by another client.
  perform set_config('request.jwt.claims', json_build_object('sub', v_b, 'role', 'authenticated')::text, true);
  v_raised := false;
  begin
    perform public.client_submit_payment_request(v_cycle, 50000, now(), 'upi', 'clientb@okbank', null, 'UTR123456789', null);
  exception when check_violation then v_raised := true;
  end;
  if not v_raised then raise exception 'TEST FAILED: duplicate UTR accepted'; end if;
  r2 := public.client_submit_payment_request(v_cycle, 2500, now() - interval '2 hours', 'bank_transfer',
                                             null, 'Client B', 'NEFT-998877', null);
  -- B sees only own requests; no direct table access.
  select count(*) into v_n from public.client_my_payment_requests();
  if v_n <> 1 then raise exception 'TEST FAILED: client B sees % requests (expected 1)', v_n; end if;
  select count(*) into v_n from public.payment_requests;
  if v_n <> 0 then raise exception 'TEST FAILED: client reads payment_requests directly'; end if;
  v_raised := false;
  begin
    perform public.admin_approve_payment_request(r2, 'Self approval');
  exception when insufficient_privilege then v_raised := true;
  end;
  if not v_raised then raise exception 'TEST FAILED: client approved a request'; end if;
  v_checks := v_checks + 1;

  -- ================================================================ admin reviews
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  select count(*) into v_n from public.payment_request_register where status = 'submitted';
  if v_n <> 2 then raise exception 'TEST FAILED: admin register shows % submitted', v_n; end if;

  v_contr := public.admin_approve_payment_request(r1, 'Matched UPI credit in bank statement');
  select count(*) into v_n from public.contributions
   where id = v_contr and status = 'pending' and client_id = v_a and amount = 50000 and method = 'upi'
     and reference_number = 'UTR123456789' and received_at = (select paid_at from public.payment_requests where id = r1);
  if v_n <> 1 then raise exception 'TEST FAILED: approval did not record the pending contribution correctly'; end if;
  select count(*) into v_n from public.payment_requests where id = r1 and status = 'approved' and contribution_id = v_contr;
  if v_n <> 1 then raise exception 'TEST FAILED: request not linked to its contribution'; end if;
  v_checks := v_checks + 1;

  -- Units come from the normal verification step.
  perform public.admin_verify_contribution(v_contr, 'Verified after approval');
  select count(*) into v_n from public.client_unit_allocations where contribution_id = v_contr and units = 500;
  if v_n <> 1 then raise exception 'TEST FAILED: verification after approval did not issue 500 units'; end if;
  v_checks := v_checks + 1;

  v_raised := false;
  begin
    perform public.admin_approve_payment_request(r1, 'Approve twice');
  exception when check_violation then v_raised := true;
  end;
  if not v_raised then raise exception 'TEST FAILED: request approved twice'; end if;

  v_raised := false;
  begin
    perform public.admin_reject_payment_request(r2, 'no');
  exception when invalid_parameter_value then v_raised := true;
  end;
  if not v_raised then raise exception 'TEST FAILED: rejection without a reason accepted'; end if;
  perform public.admin_reject_payment_request(r2, 'No matching credit found in the bank statement');
  v_checks := v_checks + 1;

  select count(*) into v_n from public.audit_logs
   where entity_type = 'payment_request' and entity_id in (r1, r2)
     and action in ('payment_request.submitted', 'payment_request.approved', 'payment_request.rejected');
  if v_n <> 4 then raise exception 'TEST FAILED: % payment request audit rows (expected 4)', v_n; end if;
  v_checks := v_checks + 1;

  -- Client B sees the rejection reason; the UTR becomes free again after rejection.
  perform set_config('request.jwt.claims', json_build_object('sub', v_b, 'role', 'authenticated')::text, true);
  select status || ':' || review_reason into v_text from public.client_my_payment_requests() where id = r2;
  if v_text <> 'rejected:No matching credit found in the bank statement' then
    raise exception 'TEST FAILED: client does not see the rejection (%)', v_text;
  end if;
  perform public.client_submit_payment_request(v_cycle, 2500, now() - interval '1 hour', 'bank_transfer',
                                               null, null, 'NEFT-998877', 'Resubmitted with the correct date');
  v_checks := v_checks + 1;

  -- Never deleted, not even by the owner.
  execute 'set local role postgres';
  v_raised := false;
  begin
    delete from public.payment_requests where id = r2;
  exception when insufficient_privilege then v_raised := true;
  end;
  if not v_raised then raise exception 'TEST FAILED: payment request deleted'; end if;
  v_checks := v_checks + 1;

  raise exception 'ALL_PAYMENT_REQUEST_TESTS_PASSED (% checks)', v_checks;
end;
$$;
