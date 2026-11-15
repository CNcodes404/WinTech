-- =============================================================================
-- Public website enquiries (owner request, 15 Nov 2026)
--
-- * Anonymous visitors submit an enquiry ONLY through public.submit_enquiry (SECURITY DEFINER):
--   validated lengths/formats, consent required, honeypot field, rate limits (per email per day
--   and a global hourly cap). Visitors can never read enquiries.
-- * Admins read enquiries (RLS) and change their status through an audited function.
-- * Enquiries are never deleted through the API (delete guard); the admin "erase all data" reset
--   clears them together with the other demo data.
-- =============================================================================

create type public.enquiry_status as enum ('new', 'contacted', 'closed');

create table public.enquiries (
  id          uuid primary key default gen_random_uuid(),
  full_name   text not null check (char_length(btrim(full_name)) between 2 and 120),
  email       text not null check (char_length(email) <= 254 and email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  phone       text check (phone is null or phone ~ '^\+?[0-9 ()-]{7,20}$'),
  city        text check (city is null or char_length(city) <= 80),
  interest    text not null default 'general'
              check (interest in ('general', 'investment', 'fees', 'partnership', 'other')),
  message     text not null check (char_length(btrim(message)) between 10 and 2000),
  consent     boolean not null check (consent),
  status      public.enquiry_status not null default 'new',
  admin_note  text check (admin_note is null or char_length(admin_note) <= 1000),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.enquiries is
  'Website enquiries. Inserted only via submit_enquiry(); readable by admins only.';

create index enquiries_status_idx on public.enquiries (status, created_at desc);
create index enquiries_email_idx on public.enquiries (lower(email), created_at desc);

create trigger enquiries_set_updated_at
  before update on public.enquiries
  for each row execute function public.set_updated_at();

create trigger enquiries_no_delete
  before delete on public.enquiries
  for each row execute function private.reject_delete();

revoke all on public.enquiries from anon, authenticated;
grant select on public.enquiries to authenticated;
alter table public.enquiries enable row level security;
create policy enquiries_select_admin on public.enquiries
  for select to authenticated using ((select private.is_admin()));

-- ---------------------------------------------------------------------------
-- Public submit (anon + authenticated)
-- ---------------------------------------------------------------------------
create or replace function public.submit_enquiry(
  p_full_name text,
  p_email     text,
  p_phone     text,
  p_city      text,
  p_interest  text,
  p_message   text,
  p_consent   boolean,
  p_website   text default null   -- honeypot: real visitors never fill this hidden field
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name  text := btrim(coalesce(p_full_name, ''));
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_phone text := nullif(btrim(coalesce(p_phone, '')), '');
  v_city  text := nullif(btrim(coalesce(p_city, '')), '');
  v_msg   text := btrim(coalesce(p_message, ''));
  v_int   text := coalesce(nullif(btrim(p_interest), ''), 'general');
begin
  -- Bots that fill the hidden field get a silent success (nothing stored).
  if nullif(btrim(coalesce(p_website, '')), '') is not null then
    return;
  end if;
  if char_length(v_name) not between 2 and 120 then
    raise exception 'Please enter your name (2–120 characters).' using errcode = 'invalid_parameter_value';
  end if;
  if char_length(v_email) > 254 or v_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Please enter a valid email address.' using errcode = 'invalid_parameter_value';
  end if;
  if v_phone is not null and v_phone !~ '^\+?[0-9 ()-]{7,20}$' then
    raise exception 'Please enter a valid phone number.' using errcode = 'invalid_parameter_value';
  end if;
  if v_city is not null and char_length(v_city) > 80 then
    raise exception 'The city must be at most 80 characters.' using errcode = 'invalid_parameter_value';
  end if;
  if v_int not in ('general', 'investment', 'fees', 'partnership', 'other') then
    v_int := 'other';
  end if;
  if char_length(v_msg) not between 10 and 2000 then
    raise exception 'Please write a message of 10–2000 characters.' using errcode = 'invalid_parameter_value';
  end if;
  if not coalesce(p_consent, false) then
    raise exception 'Please agree to be contacted about your enquiry.' using errcode = 'invalid_parameter_value';
  end if;

  -- Rate limits: 3 per email per day; 60 site-wide per hour.
  if (select count(*) from public.enquiries
       where lower(email) = v_email and created_at > now() - interval '1 day') >= 3 then
    raise exception 'We have already received your enquiries today. Our team will get back to you.'
      using errcode = 'check_violation';
  end if;
  if (select count(*) from public.enquiries where created_at > now() - interval '1 hour') >= 60 then
    raise exception 'We are receiving many enquiries right now. Please try again later.'
      using errcode = 'check_violation';
  end if;

  insert into public.enquiries (full_name, email, phone, city, interest, message, consent)
  values (v_name, v_email, v_phone, v_city, v_int, v_msg, true);
end;
$$;

revoke all on function public.submit_enquiry(text, text, text, text, text, text, boolean, text) from public;
grant execute on function public.submit_enquiry(text, text, text, text, text, text, boolean, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Admin: status + private note (audited)
-- ---------------------------------------------------------------------------
create or replace function public.admin_set_enquiry_status(
  p_enquiry_id uuid,
  p_status     public.enquiry_status,
  p_note       text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := private.require_admin();
  v_old   public.enquiries;
  v_note  text := nullif(btrim(coalesce(p_note, '')), '');
begin
  if v_note is not null and char_length(v_note) > 1000 then
    raise exception 'The note must be at most 1000 characters.' using errcode = 'invalid_parameter_value';
  end if;
  select * into v_old from public.enquiries where id = p_enquiry_id for update;
  if not found then
    raise exception 'Enquiry not found.' using errcode = 'no_data_found';
  end if;
  update public.enquiries
  set status = p_status, admin_note = coalesce(v_note, admin_note)
  where id = p_enquiry_id;
  perform private.write_audit('enquiry.status_changed', 'enquiry', p_enquiry_id,
    jsonb_build_object('status', v_old.status),
    jsonb_build_object('status', p_status, 'note_added', v_note is not null),
    null, v_actor);
end;
$$;

revoke all on function public.admin_set_enquiry_status(uuid, public.enquiry_status, text) from public, anon;
grant execute on function public.admin_set_enquiry_status(uuid, public.enquiry_status, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Erase-all reset now also clears enquiries (users are still never deleted).
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
    'portfolio_valuations', 'client_unit_allocations', 'contributions', 'cycle_fee_terms',
    'investment_cycles', 'audit_logs', 'enquiries'
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
