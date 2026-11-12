-- =============================================================================
-- FICTIONAL DEMO DATA SEED  —  WARNING: PERMANENT
--
-- Financial records in this app are append-only by design, so everything this
-- script creates (clients, cycle, contributions, valuations, NAVs, fee accruals,
-- audit entries) can never be deleted from the database it runs against.
--
-- * All people and amounts are fictional. Emails use the reserved
--   example.test domain; every reason is prefixed "[Demo seed]".
-- * Runs through the same audited admin functions as the UI, acting as the
--   earliest active administrator, so every business rule and audit entry applies.
-- * Idempotent: does nothing if the demo cycle already exists.
-- * Temporary passwords for the demo client logins are generated at run time,
--   returned by the final SELECT, and stored nowhere else. Clients must change
--   them at first sign-in.
--
-- Run (once): npx supabase db query --remote -f supabase/seed/demo_seed.sql
-- Note: the timeline is compressed. NAVs can only be calculated from valuations
-- dated after the units they cover (Decision E), and the ledger records real
-- time, so the three demo NAVs are seconds apart rather than months apart.
-- =============================================================================

create temp table demo_logins (email text, full_name text, temporary_password text) on commit preserve rows;

do $$
declare
  v_cycle_name constant text := 'Demo Growth Cycle FY2026-27 (fictional)';
  v_admin   uuid;
  v_cycle   uuid;
  v_ids     uuid[] := '{}';
  v_c       uuid;
  v_val     uuid;
  v_snap    uuid;
  v_units   numeric;
  v_hold    numeric;
  v_pw      text;
  r         record;
  -- Fictional clients: name, email, phone, password-required login
  v_people  constant text[][] := array[
    ['Rahul Mehta (fictional)',   'rahul.mehta@example.test',   '+91 90000 00001'],
    ['Amit Kulkarni (fictional)', 'amit.kulkarni@example.test', '+91 90000 00002'],
    ['Sagar Patil (fictional)',   'sagar.patil@example.test',   '+91 90000 00003'],
    ['Priya Shah (fictional)',    'priya.shah@example.test',    '+91 90000 00004'],
    ['Neha Joshi (fictional)',    'neha.joshi@example.test',    '+91 90000 00005']
  ];
begin
  if exists (select 1 from public.investment_cycles where name = v_cycle_name) then
    raise notice 'Demo data already present; nothing to do.';
    return;
  end if;

  select id into v_admin from public.profiles
   where role = 'admin' and status = 'active' order by created_at limit 1;
  if v_admin is null then
    raise exception 'No active administrator found to act as the seeding admin.';
  end if;

  -- ------------------------------------------------------------ demo client logins
  for i in 1 .. array_length(v_people, 1) loop
    v_c := gen_random_uuid();
    v_pw := 'Demo' || encode(extensions.gen_random_bytes(5), 'hex') || 'x7';
    insert into auth.users (
      id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change_token_new, email_change
    ) values (
      v_c, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', v_people[i][2],
      extensions.crypt(v_pw, extensions.gen_salt('bf')), now(),
      jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email'), 'created_by', v_admin),
      jsonb_build_object('full_name', v_people[i][1], 'phone', v_people[i][3]),
      now(), now(), '', '', '', ''
    );
    insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    values (gen_random_uuid(), v_c, v_c::text,
            jsonb_build_object('sub', v_c::text, 'email', v_people[i][2], 'email_verified', true),
            'email', null, now(), now());
    insert into demo_logins values (v_people[i][2], v_people[i][1], v_pw);
    v_ids := v_ids || v_c;
  end loop;

  -- Act as the administrator for the audited functions.
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);

  -- ------------------------------------------------------------ cycle (fee 20%, configurable)
  v_cycle := public.admin_create_cycle(v_cycle_name,
    'Fictional demonstration cycle. Manual demo valuations only; not live market data.',
    current_date - 30, current_date + 335, 100, 0.20);
  perform public.admin_set_cycle_status(v_cycle, 'open', '[Demo seed] Open for contributions');
  perform public.admin_set_cycle_status(v_cycle, 'active', '[Demo seed] Capital deployed');

  -- ------------------------------------------------------------ Rahul: ₹1,00,000 at base NAV ₹100
  v_c := public.admin_record_contribution(v_cycle, v_ids[1], 100000, now() - interval '25 days',
    'bank_transfer', 'DEMO-UTR-0001', '[Demo seed] Initial contribution');
  perform public.admin_verify_contribution(v_c, '[Demo seed] Matched demo bank statement');
  perform pg_sleep(1);

  -- ------------------------------------------------------------ Valuation A → NAV ₹105
  v_val := public.admin_save_valuation_draft(null, v_cycle, clock_timestamp(), '8000', '0', '0',
    '[Demo seed] Fictional prices',
    '[{"symbol":"INFY","instrument_name":"Infosys (demo price)","exchange":"NSE","quantity":"20","valuation_price":"1500"},
      {"symbol":"TCS","instrument_name":"TCS (demo price)","exchange":"NSE","quantity":"10","valuation_price":"3500"},
      {"symbol":"HDFCBANK","instrument_name":"HDFC Bank (demo price)","exchange":"NSE","quantity":"20","valuation_price":"1600"}]');
  perform public.admin_approve_valuation(v_val, '[Demo seed] Demo prices checked');
  v_snap := public.admin_calculate_nav(v_val, null);
  perform public.admin_publish_nav(v_snap, '[Demo seed] First demo NAV');
  perform pg_sleep(1);

  -- ------------------------------------------------------------ Amit: ₹50,000 at ₹105
  v_c := public.admin_record_contribution(v_cycle, v_ids[2], 50000, clock_timestamp(),
    'upi', 'DEMO-UPI-0002', null);
  perform public.admin_verify_contribution(v_c, '[Demo seed] Matched demo UPI receipt');
  perform pg_sleep(1);

  -- ------------------------------------------------------------ Valuation B → NAV ≈ ₹110
  select sum(units) into v_units from public.client_unit_allocations where cycle_id = v_cycle;
  v_hold := 31000 + 36000 + 32000;  -- INFY 20×1550, TCS 10×3600, HDFCBANK 20×1600
  v_val := public.admin_save_valuation_draft(null, v_cycle, clock_timestamp(),
    (round(v_units * 110, 2) - v_hold)::text, '0', '0', '[Demo seed] Fictional prices',
    '[{"symbol":"INFY","instrument_name":"Infosys (demo price)","exchange":"NSE","quantity":"20","valuation_price":"1550"},
      {"symbol":"TCS","instrument_name":"TCS (demo price)","exchange":"NSE","quantity":"10","valuation_price":"3600"},
      {"symbol":"HDFCBANK","instrument_name":"HDFC Bank (demo price)","exchange":"NSE","quantity":"20","valuation_price":"1600"}]');
  perform public.admin_approve_valuation(v_val, '[Demo seed] Demo prices checked');
  v_snap := public.admin_calculate_nav(v_val, null);
  perform public.admin_publish_nav(v_snap, '[Demo seed] Second demo NAV');
  perform pg_sleep(1);

  -- ------------------------------------------------------------ Sagar: ₹1,50,000 at ≈ ₹110
  v_c := public.admin_record_contribution(v_cycle, v_ids[3], 150000, clock_timestamp(),
    'cheque', 'DEMO-CHQ-0003', null);
  perform public.admin_verify_contribution(v_c, '[Demo seed] Demo cheque cleared');
  perform pg_sleep(1);

  -- ------------------------------------------------------------ Valuation C → NAV ≈ ₹116 (fees accrue)
  select sum(units) into v_units from public.client_unit_allocations where cycle_id = v_cycle;
  v_hold := 34000 + 39000 + 36000;  -- INFY 20×1700, TCS 10×3900, HDFCBANK 20×1800
  v_val := public.admin_save_valuation_draft(null, v_cycle, clock_timestamp(),
    (round(v_units * 116, 2) - v_hold)::text, '0', '2500', '[Demo seed] Fictional prices; demo brokerage payable',
    '[{"symbol":"INFY","instrument_name":"Infosys (demo price)","exchange":"NSE","quantity":"20","valuation_price":"1700"},
      {"symbol":"TCS","instrument_name":"TCS (demo price)","exchange":"NSE","quantity":"10","valuation_price":"3900"},
      {"symbol":"HDFCBANK","instrument_name":"HDFC Bank (demo price)","exchange":"NSE","quantity":"20","valuation_price":"1800"}]');
  perform public.admin_approve_valuation(v_val, '[Demo seed] Demo prices checked');
  v_snap := public.admin_calculate_nav(v_val, null);
  perform public.admin_publish_nav(v_snap, '[Demo seed] Third demo NAV');

  -- ------------------------------------------------------------ open items for the admin dashboard
  perform public.admin_record_contribution(v_cycle, v_ids[4], 25000, now() - interval '1 day',
    'cheque', 'DEMO-CHQ-0004', '[Demo seed] Awaiting clearance');
  v_c := public.admin_record_contribution(v_cycle, v_ids[5], 10000, now() - interval '2 days',
    'upi', 'DEMO-UPI-0005', null);
  perform public.admin_reject_contribution(v_c, '[Demo seed] Payment not found in demo bank statement');

  raise notice 'Demo data created for cycle %', v_cycle;
end;
$$;

select email, full_name, temporary_password from demo_logins order by email;
