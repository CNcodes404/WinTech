-- =============================================================================
-- RLS tests for public.profiles (Module 3)
--
-- SAFE TO RUN AGAINST ANY DATABASE: everything runs inside one DO block that
-- always ends by raising an exception, so Postgres rolls back every change
-- (test users, profile edits). Nothing is ever committed.
--
-- Expected final output:   ALL_PROFILE_RLS_TESTS_PASSED (n checks)
-- Any failure reports:     TEST FAILED: <description>
--
-- Run: npx supabase db query --remote --yes -f supabase/tests/rls_profiles.test.sql
-- =============================================================================
do $$
declare
  v_admin   uuid := gen_random_uuid();
  v_c1      uuid := gen_random_uuid();
  v_c2      uuid := gen_random_uuid();
  v_n       int;
  v_text    text;
  v_bool    boolean;
  v_raised  boolean;
  v_checks  int := 0;
  v_other_admins int;
begin
  -- ---------------------------------------------------------------- setup
  insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, email_confirmed_at, created_at, updated_at)
  values
    (v_admin, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'rls-test-admin@example.test', '{"full_name":"Test Admin"}', now(), now(), now()),
    -- Client 1 tries to self-assign admin through signup metadata.
    (v_c1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'rls-test-c1@example.test', '{"full_name":"Client One","role":"admin"}', now(), now(), now()),
    (v_c2, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'rls-test-c2@example.test', '{"full_name":"Client Two"}', now(), now(), now());

  -- 1. Trigger creates profiles; metadata cannot grant admin.
  select role::text into v_text from public.profiles where id = v_c1;
  if v_text is distinct from 'client' then raise exception 'TEST FAILED: new user role should be client, got %', v_text; end if;
  v_checks := v_checks + 1;

  select full_name into v_text from public.profiles where id = v_c1;
  if v_text is distinct from 'Client One' then raise exception 'TEST FAILED: full_name from metadata, got %', v_text; end if;
  v_checks := v_checks + 1;

  -- Promote the test admin as a privileged (migration/owner) role.
  update public.profiles set role = 'admin' where id = v_admin;

  -- ---------------------------------------------------------------- client 1
  perform set_config('request.jwt.claims', json_build_object('sub', v_c1, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';

  select count(*) into v_n from public.profiles;
  if v_n <> 1 then raise exception 'TEST FAILED: client should see exactly 1 profile, saw %', v_n; end if;
  v_checks := v_checks + 1;

  select count(*) into v_n from public.profiles where id = v_c2;
  if v_n <> 0 then raise exception 'TEST FAILED: client can read another client''s profile'; end if;
  v_checks := v_checks + 1;

  select private.is_admin() into v_bool;
  if v_bool then raise exception 'TEST FAILED: client is_admin() returned true'; end if;
  v_checks := v_checks + 1;

  update public.profiles set full_name = 'Client One Edited', phone = '+91 98765 43210' where id = v_c1;
  get diagnostics v_n = row_count;
  if v_n <> 1 then raise exception 'TEST FAILED: client could not edit own name/phone'; end if;
  v_checks := v_checks + 1;

  update public.profiles set full_name = 'Hacked' where id = v_c2;
  get diagnostics v_n = row_count;
  if v_n <> 0 then raise exception 'TEST FAILED: client edited another client''s profile'; end if;
  v_checks := v_checks + 1;

  v_raised := false;
  begin
    update public.profiles set role = 'admin' where id = v_c1;
  exception when insufficient_privilege then v_raised := true;
  end;
  if not v_raised then raise exception 'TEST FAILED: client could change own role'; end if;
  v_checks := v_checks + 1;

  v_raised := false;
  begin
    update public.profiles set status = 'inactive' where id = v_c1;
  exception when insufficient_privilege then v_raised := true;
  end;
  if not v_raised then raise exception 'TEST FAILED: client could change own status'; end if;
  v_checks := v_checks + 1;

  v_raised := false;
  begin
    update public.profiles set email = 'x@example.test' where id = v_c1;
  exception when insufficient_privilege then v_raised := true;
  end;
  if not v_raised then raise exception 'TEST FAILED: client could change own email'; end if;
  v_checks := v_checks + 1;

  v_raised := false;
  begin
    insert into public.profiles (id, email) values (gen_random_uuid(), 'fake@example.test');
  exception when insufficient_privilege then v_raised := true;
  end;
  if not v_raised then raise exception 'TEST FAILED: client could insert a profile'; end if;
  v_checks := v_checks + 1;

  v_raised := false;
  begin
    delete from public.profiles where id = v_c1;
  exception when insufficient_privilege then v_raised := true;
  end;
  if not v_raised then raise exception 'TEST FAILED: client could delete a profile'; end if;
  v_checks := v_checks + 1;

  -- ---------------------------------------------------------------- admin
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);

  select private.is_admin() into v_bool;
  if not v_bool then raise exception 'TEST FAILED: admin is_admin() returned false'; end if;
  v_checks := v_checks + 1;

  select count(*) into v_n from public.profiles where id in (v_admin, v_c1, v_c2);
  if v_n <> 3 then raise exception 'TEST FAILED: admin should see all 3 test profiles, saw %', v_n; end if;
  v_checks := v_checks + 1;

  update public.profiles set phone = '+91 90000 00000' where id = v_c2;
  get diagnostics v_n = row_count;
  if v_n <> 1 then raise exception 'TEST FAILED: admin could not edit client contact details'; end if;
  v_checks := v_checks + 1;

  -- Direct role edits are blocked even for admins (must use audited function, Module 4/5).
  v_raised := false;
  begin
    update public.profiles set role = 'admin' where id = v_c2;
  exception when insufficient_privilege then v_raised := true;
  end;
  if not v_raised then raise exception 'TEST FAILED: admin could change role without audited function'; end if;
  v_checks := v_checks + 1;

  -- ---------------------------------------------------------------- anon
  execute 'set local role anon';
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  v_raised := false;
  begin
    select count(*) into v_n from public.profiles;
  exception when insufficient_privilege then v_raised := true;
  end;
  if not v_raised then raise exception 'TEST FAILED: anon could read profiles'; end if;
  v_checks := v_checks + 1;

  v_raised := false;
  begin
    select private.is_admin() into v_bool;
  exception when insufficient_privilege then v_raised := true;
  end;
  if not v_raised then raise exception 'TEST FAILED: anon can execute is_admin()'; end if;
  v_checks := v_checks + 1;

  -- ---------------------------------------------------------------- privileged checks
  execute 'set local role postgres';

  -- Last-admin protection
  select count(*) into v_other_admins from public.profiles
   where role = 'admin' and status = 'active' and id <> v_admin;
  v_raised := false;
  begin
    update public.profiles set status = 'inactive' where id = v_admin;
  exception when check_violation then v_raised := true;
  end;
  if v_other_admins = 0 and not v_raised then
    raise exception 'TEST FAILED: last active admin could be deactivated';
  end if;
  if v_other_admins > 0 and v_raised then
    raise exception 'TEST FAILED: admin deactivation blocked although other admins exist';
  end if;
  v_checks := v_checks + 1;

  -- Email sync from auth.users
  update auth.users set email = 'rls-test-c1-new@example.test' where id = v_c1;
  select email into v_text from public.profiles where id = v_c1;
  if v_text is distinct from 'rls-test-c1-new@example.test' then
    raise exception 'TEST FAILED: profile email not synced from auth.users, got %', v_text;
  end if;
  v_checks := v_checks + 1;

  -- updated_at maintained
  select updated_at >= created_at into v_bool from public.profiles where id = v_c1;
  if not v_bool then raise exception 'TEST FAILED: updated_at not maintained'; end if;
  v_checks := v_checks + 1;

  -- Always roll back.
  raise exception 'ALL_PROFILE_RLS_TESTS_PASSED (% checks)', v_checks;
end;
$$;
