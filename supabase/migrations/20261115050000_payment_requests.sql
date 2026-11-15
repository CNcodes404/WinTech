-- =============================================================================
-- Client "Add funds" payment requests (owner request, 15 Nov 2026)
--
-- Flow: the client pays to WINTECH's UPI QR / bank account outside the app, then submits the
-- payment details here. An admin checks them against the bank statement and either
--   * approves → a PENDING contribution is recorded (method + UTR as reference, received at the
--     time the client paid) and linked; units are issued later through the normal verify step, or
--   * rejects → with a reason that the client can see.
-- Clients have no direct table access: they use client_* functions (own rows only).
-- Requests are never deleted (delete guard); the admin erase-all reset clears them.
-- =============================================================================

create type public.payment_request_status as enum ('submitted', 'approved', 'rejected');
create type public.payment_request_method as enum ('upi', 'bank_transfer');

create table public.payment_requests (
  id               uuid primary key default gen_random_uuid(),
  client_id        uuid not null references public.profiles (id) on delete restrict,
  cycle_id         uuid not null references public.investment_cycles (id) on delete restrict,
  amount           numeric(20, 2) not null check (amount > 0 and amount < 10000000000000),
  paid_at          timestamptz not null,
  method           public.payment_request_method not null,
  payer_upi_id     text check (payer_upi_id is null or payer_upi_id ~ '^[A-Za-z0-9._-]{2,256}@[A-Za-z][A-Za-z0-9.-]{1,63}$'),
  payer_name       text check (payer_name is null or char_length(payer_name) between 2 and 120),
  transaction_ref  text not null check (transaction_ref ~ '^[A-Za-z0-9-]{6,40}$'),
  note             text check (note is null or char_length(note) <= 500),
  status           public.payment_request_status not null default 'submitted',
  contribution_id  uuid references public.contributions (id) on delete restrict,
  reviewed_by      uuid references public.profiles (id) on delete restrict,
  reviewed_at      timestamptz,
  review_reason    text check (review_reason is null or char_length(review_reason) between 5 and 1000),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint payment_requests_upi_needs_id check (method <> 'upi' or payer_upi_id is not null),
  constraint payment_requests_status_fields check (
    case status
      when 'submitted' then contribution_id is null and reviewed_at is null
      when 'approved'  then contribution_id is not null and reviewed_at is not null and reviewed_by is not null
      when 'rejected'  then contribution_id is null and reviewed_at is not null and review_reason is not null
    end
  )
);

comment on table public.payment_requests is
  'Client-submitted payment details for funds paid to WINTECH (UPI / bank transfer), reviewed by admins.';
comment on column public.payment_requests.review_reason is 'Written by the admin; shown to the client.';

create index payment_requests_status_idx on public.payment_requests (status, created_at desc);
create index payment_requests_client_idx on public.payment_requests (client_id, created_at desc);
-- The same UTR cannot be claimed twice while it is open or approved.
create unique index payment_requests_live_ref_key
  on public.payment_requests (lower(transaction_ref)) where status in ('submitted', 'approved');

create trigger payment_requests_set_updated_at
  before update on public.payment_requests
  for each row execute function public.set_updated_at();
create trigger payment_requests_no_delete
  before delete on public.payment_requests
  for each row execute function private.reject_delete();

revoke all on public.payment_requests from anon, authenticated;
grant select on public.payment_requests to authenticated;
alter table public.payment_requests enable row level security;
create policy payment_requests_select_admin on public.payment_requests
  for select to authenticated using ((select private.is_admin()));

-- ---------------------------------------------------------------------------
-- Client API
-- ---------------------------------------------------------------------------

-- Cycles currently accepting money (any active client may see them).
create or replace function public.client_open_cycles()
returns table (cycle_id uuid, cycle_name text, cycle_status text, start_date date, end_date date, base_nav text)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  perform private.current_client_id();
  return query
  select c.id, c.name, c.status::text, c.start_date, c.end_date, c.base_nav::text
  from public.investment_cycles c
  where c.status in ('open', 'active')
  order by c.start_date desc, c.name;
end;
$$;

create or replace function public.client_submit_payment_request(
  p_cycle_id        uuid,
  p_amount          numeric,
  p_paid_at         timestamptz,
  p_method          public.payment_request_method,
  p_payer_upi_id    text,
  p_payer_name      text,
  p_transaction_ref text,
  p_note            text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_client uuid := private.current_client_id();
  v_status public.cycle_status;
  v_upi    text := nullif(btrim(coalesce(p_payer_upi_id, '')), '');
  v_name   text := nullif(btrim(coalesce(p_payer_name, '')), '');
  v_ref    text := upper(btrim(coalesce(p_transaction_ref, '')));
  v_note   text := nullif(btrim(coalesce(p_note, '')), '');
  v_id     uuid;
begin
  select status into v_status from public.investment_cycles where id = p_cycle_id;
  if not found or v_status not in ('open', 'active') then
    raise exception 'This cycle is not accepting funds right now.' using errcode = 'check_violation';
  end if;
  if p_amount is null or p_amount <= 0 or p_amount <> round(p_amount, 2) or p_amount >= 10000000000000 then
    raise exception 'Enter the amount you paid in rupees (up to 2 decimal places).' using errcode = 'invalid_parameter_value';
  end if;
  if p_paid_at is null or p_paid_at > now() + interval '5 minutes' then
    raise exception 'The payment date cannot be in the future.' using errcode = 'invalid_parameter_value';
  end if;
  if p_paid_at < now() - interval '90 days' then
    raise exception 'Payments older than 90 days must be raised with the admin directly.' using errcode = 'invalid_parameter_value';
  end if;
  if p_method is null then
    raise exception 'Choose how you paid.' using errcode = 'invalid_parameter_value';
  end if;
  if p_method = 'upi' and (v_upi is null or v_upi !~ '^[A-Za-z0-9._-]{2,256}@[A-Za-z][A-Za-z0-9.-]{1,63}$') then
    raise exception 'Enter the UPI ID you paid from (for example name@okbank).' using errcode = 'invalid_parameter_value';
  end if;
  if v_name is not null and char_length(v_name) not between 2 and 120 then
    raise exception 'The payer name must be 2–120 characters.' using errcode = 'invalid_parameter_value';
  end if;
  if v_ref !~ '^[A-Z0-9-]{6,40}$' then
    raise exception 'Enter the transaction ID / UTR shown in your payment app (6–40 letters or digits).'
      using errcode = 'invalid_parameter_value';
  end if;
  if v_note is not null and char_length(v_note) > 500 then
    raise exception 'The note must be at most 500 characters.' using errcode = 'invalid_parameter_value';
  end if;
  if exists (select 1 from public.payment_requests
             where lower(transaction_ref) = lower(v_ref) and status in ('submitted', 'approved')) then
    raise exception 'A payment with this transaction ID has already been submitted.' using errcode = 'check_violation';
  end if;
  if (select count(*) from public.payment_requests where client_id = v_client and status = 'submitted') >= 10 then
    raise exception 'You have 10 payment requests awaiting review. Please wait for them to be checked.'
      using errcode = 'check_violation';
  end if;

  insert into public.payment_requests
    (client_id, cycle_id, amount, paid_at, method, payer_upi_id, payer_name, transaction_ref, note)
  values (v_client, p_cycle_id, p_amount, p_paid_at, p_method,
          case when p_method = 'upi' then v_upi end, v_name, v_ref, v_note)
  returning id into v_id;

  perform private.write_audit('payment_request.submitted', 'payment_request', v_id, null,
    jsonb_build_object('cycle_id', p_cycle_id, 'amount', p_amount::text, 'paid_at', p_paid_at,
                       'method', p_method, 'transaction_ref', v_ref),
    null, v_client);
  return v_id;
end;
$$;

create or replace function public.client_my_payment_requests()
returns table (
  id uuid, cycle_id uuid, cycle_name text, amount text, paid_at timestamptz, method text,
  payer_upi_id text, transaction_ref text, status text, review_reason text, reviewed_at timestamptz,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_client uuid := private.current_client_id();
begin
  return query
  select r.id, r.cycle_id, c.name, r.amount::text, r.paid_at, r.method::text, r.payer_upi_id,
         r.transaction_ref, r.status::text, r.review_reason, r.reviewed_at, r.created_at
  from public.payment_requests r
  join public.investment_cycles c on c.id = r.cycle_id
  where r.client_id = v_client
  order by r.created_at desc;
end;
$$;

revoke all on function public.client_open_cycles() from public, anon;
revoke all on function public.client_submit_payment_request(uuid, numeric, timestamptz, public.payment_request_method, text, text, text, text) from public, anon;
revoke all on function public.client_my_payment_requests() from public, anon;
grant execute on function public.client_open_cycles() to authenticated;
grant execute on function public.client_submit_payment_request(uuid, numeric, timestamptz, public.payment_request_method, text, text, text, text) to authenticated;
grant execute on function public.client_my_payment_requests() to authenticated;

-- ---------------------------------------------------------------------------
-- Admin API
-- ---------------------------------------------------------------------------
create or replace function public.admin_approve_payment_request(p_request_id uuid, p_reason text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor  uuid := private.require_admin();
  v_reason text := private.require_reason(p_reason);
  v_r      public.payment_requests;
  v_contr  uuid;
begin
  select * into v_r from public.payment_requests where id = p_request_id for update;
  if not found then
    raise exception 'Payment request not found.' using errcode = 'no_data_found';
  end if;
  if v_r.status <> 'submitted' then
    raise exception 'This payment request is already %.', v_r.status using errcode = 'check_violation';
  end if;

  -- Records a pending contribution with all the usual checks (cycle open/active, client active,
  -- reference not already used). Units are issued when the contribution is verified.
  v_contr := public.admin_record_contribution(
    v_r.cycle_id, v_r.client_id, v_r.amount, v_r.paid_at,
    v_r.method::text::public.contribution_method, v_r.transaction_ref,
    concat_ws(' · ', 'From client payment request',
              case when v_r.payer_upi_id is not null then 'UPI ' || v_r.payer_upi_id end,
              v_r.payer_name, v_r.note)
  );

  update public.payment_requests
  set status = 'approved', contribution_id = v_contr, reviewed_by = v_actor, reviewed_at = clock_timestamp(),
      review_reason = v_reason
  where id = p_request_id;

  perform private.write_audit('payment_request.approved', 'payment_request', p_request_id,
    jsonb_build_object('status', 'submitted'),
    jsonb_build_object('status', 'approved', 'contribution_id', v_contr, 'amount', v_r.amount::text),
    v_reason, v_actor);
  return v_contr;
end;
$$;

create or replace function public.admin_reject_payment_request(p_request_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor  uuid := private.require_admin();
  v_reason text := private.require_reason(p_reason);
  v_status public.payment_request_status;
begin
  select status into v_status from public.payment_requests where id = p_request_id for update;
  if not found then
    raise exception 'Payment request not found.' using errcode = 'no_data_found';
  end if;
  if v_status <> 'submitted' then
    raise exception 'This payment request is already %.', v_status using errcode = 'check_violation';
  end if;
  update public.payment_requests
  set status = 'rejected', reviewed_by = v_actor, reviewed_at = clock_timestamp(), review_reason = v_reason
  where id = p_request_id;
  perform private.write_audit('payment_request.rejected', 'payment_request', p_request_id,
    jsonb_build_object('status', 'submitted'), jsonb_build_object('status', 'rejected'), v_reason, v_actor);
end;
$$;

revoke all on function public.admin_approve_payment_request(uuid, text) from public, anon;
revoke all on function public.admin_reject_payment_request(uuid, text) from public, anon;
grant execute on function public.admin_approve_payment_request(uuid, text) to authenticated;
grant execute on function public.admin_reject_payment_request(uuid, text) to authenticated;

-- Admin list read model (security_invoker → admin-only through RLS).
create view public.payment_request_register
with (security_invoker = true)
as
select r.id, r.client_id, p.full_name as client_name, p.email as client_email,
       r.cycle_id, c.name as cycle_name, c.status as cycle_status,
       r.amount, r.paid_at, r.method, r.payer_upi_id, r.payer_name, r.transaction_ref, r.note,
       r.status, r.contribution_id, r.reviewed_at, r.review_reason, r.created_at,
       rv.full_name as reviewer_name
from public.payment_requests r
join public.profiles p on p.id = r.client_id
join public.investment_cycles c on c.id = r.cycle_id
left join public.profiles rv on rv.id = r.reviewed_by;

revoke all on public.payment_request_register from anon, authenticated;
grant select on public.payment_request_register to authenticated;

-- ---------------------------------------------------------------------------
-- Erase-all reset also clears payment requests (users are still never deleted).
-- ---------------------------------------------------------------------------
create or replace function public.admin_reset_demo_data(p_confirmation text, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor   uuid := private.require_admin();
  v_reason  text := private.require_reason(p_reason);
  v_enabled boolean;
  v_counts  jsonb;
  t         text;
  v_tables  constant text[] := array[
    'lot_fee_accruals', 'fee_crystallisations', 'nav_snapshots', 'portfolio_valuation_items',
    'portfolio_valuations', 'payment_requests', 'client_unit_allocations', 'contributions',
    'cycle_fee_terms', 'investment_cycles', 'audit_logs', 'enquiries'
  ];
begin
  select (value)::boolean into v_enabled from private.app_config where key = 'demo_reset_enabled';
  if not coalesce(v_enabled, false) then
    raise exception 'Resetting data is disabled on this system.' using errcode = 'check_violation';
  end if;
  if coalesce(btrim(p_confirmation), '') <> 'ERASE ALL DATA' then
    raise exception 'Type ERASE ALL DATA exactly to confirm.' using errcode = 'invalid_parameter_value';
  end if;

  v_counts := jsonb_build_object(
    'cycles', (select count(*) from public.investment_cycles),
    'fee_terms', (select count(*) from public.cycle_fee_terms),
    'contributions', (select count(*) from public.contributions),
    'payment_requests', (select count(*) from public.payment_requests),
    'ledger_rows', (select count(*) from public.client_unit_allocations),
    'valuations', (select count(*) from public.portfolio_valuations),
    'valuation_items', (select count(*) from public.portfolio_valuation_items),
    'nav_snapshots', (select count(*) from public.nav_snapshots),
    'fee_accruals', (select count(*) from public.lot_fee_accruals),
    'fee_crystallisations', (select count(*) from public.fee_crystallisations),
    'enquiries', (select count(*) from public.enquiries),
    'audit_entries', (select count(*) from public.audit_logs where entity_type <> 'profile'),
    'users_kept', (select count(*) from public.profiles)
  );

  foreach t in array v_tables loop
    execute format('alter table public.%I disable trigger user', t);
  end loop;

  delete from public.lot_fee_accruals where true;
  delete from public.fee_crystallisations where true;
  update public.nav_snapshots
     set status = 'discarded', published_at = null, corrected_at = null, discarded_at = now(),
         corrects_snapshot_id = null, corrected_by_snapshot_id = null
   where true;
  delete from public.nav_snapshots where true;
  delete from public.portfolio_valuation_items where true;
  update public.portfolio_valuations
     set status = 'discarded', approved_at = null, superseded_at = null, discarded_at = now(),
         corrects_valuation_id = null, superseded_by = null
   where true;
  delete from public.portfolio_valuations where true;
  delete from public.payment_requests where true;
  delete from public.client_unit_allocations where true;
  delete from public.contributions where true;
  delete from public.cycle_fee_terms where true;
  delete from public.investment_cycles where true;
  delete from public.enquiries where true;
  delete from public.audit_logs where entity_type <> 'profile';

  foreach t in array v_tables loop
    execute format('alter table public.%I enable trigger user', t);
  end loop;

  perform private.write_audit('maintenance.data_reset', 'maintenance', null, v_counts, null, v_reason, v_actor);
  return v_counts;
end;
$$;
