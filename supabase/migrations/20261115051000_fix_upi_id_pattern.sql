-- Fix: Postgres regular expressions allow at most 255 repetitions, so the UPI ID pattern's {2,256}
-- failed at runtime. UPI IDs are short; use 2–128 characters before the @.
alter table public.payment_requests drop constraint payment_requests_payer_upi_id_check;
alter table public.payment_requests add constraint payment_requests_payer_upi_id_check
  check (payer_upi_id is null or payer_upi_id ~ '^[A-Za-z0-9._-]{2,128}@[A-Za-z][A-Za-z0-9.-]{1,63}$');

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
  if p_method = 'upi' and (v_upi is null or v_upi !~ '^[A-Za-z0-9._-]{2,128}@[A-Za-z][A-Za-z0-9.-]{1,63}$') then
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
