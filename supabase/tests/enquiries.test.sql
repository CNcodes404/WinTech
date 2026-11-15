-- =============================================================================
-- Tests for public website enquiries (rollback-only).
-- Expected final output:   ALL_ENQUIRY_TESTS_PASSED (n checks)
-- =============================================================================
do $$
declare
  v_admin  uuid := gen_random_uuid();
  v_client uuid := gen_random_uuid();
  v_id     uuid;
  v_n      int;
  v_raised boolean;
  v_checks int := 0;
begin
  insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, email_confirmed_at, created_at, updated_at)
  values
    (v_admin,  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'etest-admin@example.test', '{"full_name":"E Admin"}', now(), now(), now()),
    (v_client, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'etest-client@example.test', '{"full_name":"E Client"}', now(), now(), now());
  update public.profiles set role = 'admin' where id = v_admin;

  -- ================================================================ anonymous visitor
  execute 'set local role anon';
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);

  perform public.submit_enquiry('Priya (fictional)', 'Priya@Example.test', '+91 98765 43210', 'Pune', 'investment',
                                'I would like to know more about your approach.', true, null);
  v_checks := v_checks + 1;

  -- Validation.
  v_raised := false;
  begin
    perform public.submit_enquiry('P', 'priya@example.test', null, null, 'general', 'Long enough message here.', true, null);
  exception when invalid_parameter_value then v_raised := true;
  end;
  if not v_raised then raise exception 'TEST FAILED: one-letter name accepted'; end if;
  v_raised := false;
  begin
    perform public.submit_enquiry('Priya', 'not-an-email', null, null, 'general', 'Long enough message here.', true, null);
  exception when invalid_parameter_value then v_raised := true;
  end;
  if not v_raised then raise exception 'TEST FAILED: bad email accepted'; end if;
  v_raised := false;
  begin
    perform public.submit_enquiry('Priya', 'priya@example.test', null, null, 'general', 'Long enough message here.', false, null);
  exception when invalid_parameter_value then v_raised := true;
  end;
  if not v_raised then raise exception 'TEST FAILED: enquiry without consent accepted'; end if;
  v_raised := false;
  begin
    perform public.submit_enquiry('Priya', 'priya@example.test', 'call me', null, 'general', 'Long enough message here.', true, null);
  exception when invalid_parameter_value then v_raised := true;
  end;
  if not v_raised then raise exception 'TEST FAILED: bad phone accepted'; end if;
  v_checks := v_checks + 1;

  -- Honeypot: silently ignored.
  perform public.submit_enquiry('Bot', 'bot@example.test', null, null, 'general', 'Buy cheap things now!!!', true, 'http://spam');
  v_checks := v_checks + 1;

  -- Rate limit: 3 per email per day (case-insensitive).
  perform public.submit_enquiry('Priya', 'priya@example.test', null, null, 'fees', 'Second question about fees.', true, null);
  perform public.submit_enquiry('Priya', 'PRIYA@example.test', null, null, 'other', 'Third question, last one.', true, null);
  v_raised := false;
  begin
    perform public.submit_enquiry('Priya', 'priya@example.test', null, null, 'other', 'Fourth message the same day.', true, null);
  exception when check_violation then v_raised := true;
  end;
  if not v_raised then raise exception 'TEST FAILED: per-email daily limit not enforced'; end if;
  v_checks := v_checks + 1;

  -- Visitors cannot read enquiries or use admin functions.
  v_raised := false;
  begin
    select count(*) into v_n from public.enquiries;
  exception when insufficient_privilege then v_raised := true;
  end;
  if not v_raised then raise exception 'TEST FAILED: anon can read enquiries'; end if;
  v_raised := false;
  begin
    perform public.admin_set_enquiry_status(gen_random_uuid(), 'closed', null);
  exception when insufficient_privilege then v_raised := true;
  end;
  if not v_raised then raise exception 'TEST FAILED: anon can call the admin enquiry function'; end if;
  v_checks := v_checks + 1;

  -- ================================================================ signed-in client: no access
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', v_client, 'role', 'authenticated')::text, true);
  select count(*) into v_n from public.enquiries;
  if v_n <> 0 then raise exception 'TEST FAILED: client can read enquiries'; end if;
  v_raised := false;
  begin
    perform public.admin_set_enquiry_status((select id from public.enquiries limit 1), 'closed', null);
  exception when insufficient_privilege then v_raised := true;
  end;
  if not v_raised then raise exception 'TEST FAILED: client changed an enquiry'; end if;
  v_checks := v_checks + 1;

  -- ================================================================ admin
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  select count(*) into v_n from public.enquiries where email = 'priya@example.test';
  if v_n <> 3 then raise exception 'TEST FAILED: admin sees % of Priya''s enquiries (expected 3, email lower-cased)', v_n; end if;
  select count(*) into v_n from public.enquiries where email = 'bot@example.test';
  if v_n <> 0 then raise exception 'TEST FAILED: honeypot enquiry stored'; end if;
  v_checks := v_checks + 1;

  select id into v_id from public.enquiries where interest = 'investment' and email = 'priya@example.test';
  perform public.admin_set_enquiry_status(v_id, 'contacted', 'Called on 15 Nov');
  select count(*) into v_n from public.enquiries where id = v_id and status = 'contacted' and admin_note = 'Called on 15 Nov';
  if v_n <> 1 then raise exception 'TEST FAILED: status/note not saved'; end if;
  select count(*) into v_n from public.audit_logs
   where entity_id = v_id and action = 'enquiry.status_changed' and actor_id = v_admin;
  if v_n <> 1 then raise exception 'TEST FAILED: status change not audited'; end if;
  v_checks := v_checks + 1;

  -- Never deleted through the API, not even by the owner.
  execute 'set local role postgres';
  v_raised := false;
  begin
    delete from public.enquiries where id = v_id;
  exception when insufficient_privilege then v_raised := true;
  end;
  if not v_raised then raise exception 'TEST FAILED: enquiry deleted'; end if;
  v_checks := v_checks + 1;

  raise exception 'ALL_ENQUIRY_TESTS_PASSED (% checks)', v_checks;
end;
$$;
