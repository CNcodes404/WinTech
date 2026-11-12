-- =============================================================================
-- Tests for audit_logs and admin role/status functions (Module 4)
--
-- SAFE TO RUN AGAINST ANY DATABASE: one DO block that always ends by raising an
-- exception, so every change is rolled back.
--
-- Expected final output:   ALL_AUDIT_TESTS_PASSED (n checks)
-- Run: npx supabase db query --remote --yes -f supabase/tests/rls_audit.test.sql
-- =============================================================================
do $$
declare
  v_admin  uuid := gen_random_uuid();
  v_c1     uuid := gen_random_uuid();
  v_c2     uuid := gen_random_uuid();
  v_new    uuid := gen_random_uuid();
  v_n      int;
  v_text   text;
  v_raised boolean;
  v_checks int := 0;
  v_row    public.audit_logs;
begin
  -- ---------------------------------------------------------------- setup
  insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, email_confirmed_at, created_at, updated_at)
  values
    (v_admin, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'audit-test-admin@example.test', '{"full_name":"Audit Admin"}', now(), now(), now()),
    (v_c1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'audit-test-c1@example.test', '{"full_name":"Client One","phone":"+91 98000 00001"}', now(), now(), now()),
    (v_c2, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'audit-test-c2@example.test', '{"full_name":"Client Two","phone":"not a phone; drop table"}', now(), now(), now());

  -- 1. Creation is audited; invalid phone from metadata is discarded.
  select count(*) into v_n from public.audit_logs where entity_id = v_c1 and action = 'profile.created';
  if v_n <> 1 then raise exception 'TEST FAILED: profile.created audit missing for c1'; end if;
  v_checks := v_checks + 1;

  select phone into v_text from public.profiles where id = v_c1;
  if v_text is distinct from '+91 98000 00001' then raise exception 'TEST FAILED: valid phone not copied, got %', v_text; end if;
  v_checks := v_checks + 1;

  select phone into v_text from public.profiles where id = v_c2;
  if v_text is not null then raise exception 'TEST FAILED: invalid phone was stored: %', v_text; end if;
  v_checks := v_checks + 1;

  update public.profiles set role = 'admin' where id = v_admin;

  -- 2. created_by in app metadata (service-role only) becomes the actor.
  insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, raw_app_meta_data, email_confirmed_at, created_at, updated_at)
  values (v_new, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
          'audit-test-new@example.test', '{"full_name":"New Client"}',
          jsonb_build_object('created_by', v_admin), now(), now(), now());
  select * into v_row from public.audit_logs where entity_id = v_new and action = 'profile.created';
  if v_row.actor_id is distinct from v_admin then raise exception 'TEST FAILED: created_by actor not recorded'; end if;
  if v_row.after_data ->> 'role' <> 'client' then raise exception 'TEST FAILED: created audit should record client role'; end if;
  v_checks := v_checks + 1;

  -- ---------------------------------------------------------------- client 1
  perform set_config('request.jwt.claims', json_build_object('sub', v_c1, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';

  select count(*) into v_n from public.audit_logs;
  if v_n <> 0 then raise exception 'TEST FAILED: client can read audit log (% rows)', v_n; end if;
  v_checks := v_checks + 1;

  v_raised := false;
  begin
    insert into public.audit_logs (action, entity_type) values ('fake.event', 'profile');
  exception when insufficient_privilege then v_raised := true;
  end;
  if not v_raised then raise exception 'TEST FAILED: client could insert audit rows'; end if;
  v_checks := v_checks + 1;

  v_raised := false;
  begin
    perform private.write_audit('fake.event', 'profile', v_c1, null, null);
  exception when insufficient_privilege then v_raised := true;
  end;
  if not v_raised then raise exception 'TEST FAILED: client could call private.write_audit'; end if;
  v_checks := v_checks + 1;

  v_raised := false;
  begin
    perform public.admin_set_user_role(v_c1, 'admin', 'I want to be admin');
  exception when insufficient_privilege then v_raised := true;
  end;
  if not v_raised then raise exception 'TEST FAILED: client could call admin_set_user_role'; end if;
  v_checks := v_checks + 1;

  v_raised := false;
  begin
    perform public.admin_set_user_status(v_c2, 'inactive', 'Disable the other client');
  exception when insufficient_privilege then v_raised := true;
  end;
  if not v_raised then raise exception 'TEST FAILED: client could call admin_set_user_status'; end if;
  v_checks := v_checks + 1;

  -- Own edit is allowed and audited with the client as actor.
  update public.profiles set full_name = 'Client One Renamed' where id = v_c1;

  -- ---------------------------------------------------------------- admin
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);

  select * into v_row from public.audit_logs
   where entity_id = v_c1 and action = 'profile.updated' order by seq desc limit 1;
  if v_row.actor_id is distinct from v_c1
     or v_row.before_data ->> 'full_name' <> 'Client One'
     or v_row.after_data ->> 'full_name' <> 'Client One Renamed' then
    raise exception 'TEST FAILED: client self-edit audit incorrect: %', row_to_json(v_row);
  end if;
  v_checks := v_checks + 1;

  v_raised := false;
  begin
    perform public.admin_set_user_role(v_c2, 'admin', 'ok');
  exception when invalid_parameter_value then v_raised := true;
  end;
  if not v_raised then raise exception 'TEST FAILED: short reason accepted'; end if;
  v_checks := v_checks + 1;

  v_raised := false;
  begin
    perform public.admin_set_user_role(v_admin, 'client', 'Demote myself please');
  exception when check_violation then v_raised := true;
  end;
  if not v_raised then raise exception 'TEST FAILED: admin could change own role'; end if;
  v_checks := v_checks + 1;

  v_raised := false;
  begin
    perform public.admin_set_user_status(v_admin, 'inactive', 'Deactivate myself');
  exception when check_violation then v_raised := true;
  end;
  if not v_raised then raise exception 'TEST FAILED: admin could deactivate self'; end if;
  v_checks := v_checks + 1;

  v_raised := false;
  begin
    perform public.admin_set_user_role(gen_random_uuid(), 'admin', 'No such user here');
  exception when no_data_found then v_raised := true;
  end;
  if not v_raised then raise exception 'TEST FAILED: unknown user did not raise'; end if;
  v_checks := v_checks + 1;

  perform public.admin_set_user_role(v_c2, 'admin', 'Second administrator for demo');
  select * into v_row from public.audit_logs
   where entity_id = v_c2 and action = 'profile.role_changed' order by seq desc limit 1;
  if v_row.actor_id is distinct from v_admin
     or v_row.reason is distinct from 'Second administrator for demo'
     or v_row.before_data ->> 'role' <> 'client'
     or v_row.after_data ->> 'role' <> 'admin' then
    raise exception 'TEST FAILED: role change audit incorrect: %', row_to_json(v_row);
  end if;
  v_checks := v_checks + 1;

  perform public.admin_set_user_status(v_c1, 'inactive', 'Left the group');
  select * into v_row from public.audit_logs
   where entity_id = v_c1 and action = 'profile.status_changed' order by seq desc limit 1;
  if v_row.after_data ->> 'status' <> 'inactive' or v_row.reason <> 'Left the group' then
    raise exception 'TEST FAILED: status change audit incorrect';
  end if;
  v_checks := v_checks + 1;

  select count(*) into v_n from public.audit_logs where entity_id in (v_admin, v_c1, v_c2, v_new);
  if v_n < 6 then raise exception 'TEST FAILED: admin should read audit rows, saw %', v_n; end if;
  v_checks := v_checks + 1;

  v_raised := false;
  begin
    update public.audit_logs set reason = 'tampered' where entity_id = v_c1;
  exception when insufficient_privilege then v_raised := true;
  end;
  if not v_raised then raise exception 'TEST FAILED: admin could update audit rows'; end if;
  v_checks := v_checks + 1;

  -- ---------------------------------------------------------------- anon
  execute 'set local role anon';
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  v_raised := false;
  begin
    perform public.admin_set_user_role(v_c1, 'admin', 'anonymous attempt');
  exception when insufficient_privilege then v_raised := true;
  end;
  if not v_raised then raise exception 'TEST FAILED: anon could call admin_set_user_role'; end if;
  v_checks := v_checks + 1;

  -- ---------------------------------------------------------------- owner-level tamper attempts
  execute 'set local role postgres';

  v_raised := false;
  begin
    delete from public.audit_logs where entity_id = v_c1;
  exception when insufficient_privilege then v_raised := true;
  end;
  if not v_raised then raise exception 'TEST FAILED: audit rows could be deleted by owner'; end if;
  v_checks := v_checks + 1;

  v_raised := false;
  begin
    update public.audit_logs set reason = 'tampered' where entity_id = v_c1;
  exception when insufficient_privilege then v_raised := true;
  end;
  if not v_raised then raise exception 'TEST FAILED: audit rows could be updated by owner'; end if;
  v_checks := v_checks + 1;

  -- Bootstrap promotion was backfilled.
  select count(*) into v_n from public.audit_logs
   where action = 'profile.role_changed' and reason like 'Bootstrap:%';
  if v_n < 1 then raise exception 'TEST FAILED: bootstrap promotion not backfilled'; end if;
  v_checks := v_checks + 1;

  raise exception 'ALL_AUDIT_TESTS_PASSED (% checks)', v_checks;
end;
$$;
