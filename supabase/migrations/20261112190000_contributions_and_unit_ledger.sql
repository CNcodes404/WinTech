-- =============================================================================
-- Module 7: manual contributions, verification and unit issuance
--
-- Accounting rules (BUSINESS_LOGIC §2, §8, §10; DECISIONS B, C, F):
--   * A contribution issues units only when an admin VERIFIES it, exactly once.
--   * units = TRUNC(amount / applicable_nav, 8)   (round DOWN; never over-issue)
--   * applicable_nav = latest published gross NAV as of received_at, else the
--     cycle's base NAV. NAV publishing arrives in Module 9; until then this is
--     always the base NAV (see private.applicable_nav).
--   * Each lot locks the fee rate in force at issuance and starts with
--     reference HWM = entry NAV and loss carry-forward = 0.
--   * The unit ledger (client_unit_allocations) is append-only. A reversal is
--     a NEGATIVE entry; nothing is ever edited or deleted.
--     Outstanding units = SUM(units) over the ledger.
--   * Contributions are accepted only while the cycle is open or active.
--   * Every change is audited in the same transaction.
-- =============================================================================

-- Make the shared append-only guard name the table it protects (it now guards the unit ledger too).
create or replace function private.reject_audit_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception '% is append-only (% is not allowed).', tg_table_name, tg_op
    using errcode = 'insufficient_privilege';
end;
$$;

create type public.contribution_method as enum ('upi', 'bank_transfer', 'cheque', 'other');
create type public.contribution_status as enum ('pending', 'verified', 'rejected', 'reversed');
create type public.allocation_entry_type as enum ('issue', 'reversal');

-- ---------------------------------------------------------------------------
-- contributions
-- ---------------------------------------------------------------------------
create table public.contributions (
  id                  uuid primary key default gen_random_uuid(),
  cycle_id            uuid not null references public.investment_cycles (id) on delete restrict,
  client_id           uuid not null references public.profiles (id) on delete restrict,
  amount              numeric(20, 2) not null check (amount > 0 and amount < 10000000000000),
  received_at         timestamptz not null,
  method              public.contribution_method not null,
  reference_number    text check (reference_number is null or char_length(reference_number) between 1 and 100),
  notes               text check (notes is null or char_length(notes) <= 1000),
  proof_storage_path  text, -- reserved for receipt uploads (not used in V1)
  status              public.contribution_status not null default 'pending',
  recorded_by         uuid not null references public.profiles (id) on delete restrict,
  verified_by         uuid references public.profiles (id) on delete restrict,
  verified_at         timestamptz,
  applicable_nav      numeric(20, 8) check (applicable_nav is null or applicable_nav > 0),
  units_issued        numeric(24, 8) check (units_issued is null or units_issued > 0),
  rejected_by         uuid references public.profiles (id) on delete restrict,
  rejected_at         timestamptz,
  rejection_reason    text,
  reversed_by         uuid references public.profiles (id) on delete restrict,
  reversed_at         timestamptz,
  reversal_reason     text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  constraint contributions_status_fields check (
    case status
      when 'pending' then
        verified_at is null and applicable_nav is null and units_issued is null
        and rejected_at is null and reversed_at is null
      when 'verified' then
        verified_by is not null and verified_at is not null and applicable_nav is not null
        and units_issued is not null and rejected_at is null and reversed_at is null
      when 'rejected' then
        rejected_by is not null and rejected_at is not null and rejection_reason is not null
        and verified_at is null and units_issued is null and reversed_at is null
      when 'reversed' then
        verified_at is not null and units_issued is not null
        and reversed_by is not null and reversed_at is not null and reversal_reason is not null
    end
  )
);

comment on table public.contributions is
  'Manually recorded contributions (V1: no payment gateway). Units are issued only on verification.';
comment on column public.contributions.notes is 'Admin-only internal notes. Never exposed to clients.';

create index contributions_cycle_idx on public.contributions (cycle_id, status, received_at desc);
create index contributions_client_idx on public.contributions (client_id, received_at desc);
create index contributions_status_idx on public.contributions (status, received_at desc);

-- The same payment reference (UTR / cheque no.) cannot be recorded twice while live.
create unique index contributions_live_reference_key
  on public.contributions (method, lower(btrim(reference_number)))
  where reference_number is not null and status in ('pending', 'verified');

create trigger contributions_set_updated_at
  before update on public.contributions
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- client_unit_allocations: append-only unit ledger
-- ---------------------------------------------------------------------------
create table public.client_unit_allocations (
  id                  uuid primary key default gen_random_uuid(),
  cycle_id            uuid not null references public.investment_cycles (id) on delete restrict,
  client_id           uuid not null references public.profiles (id) on delete restrict,
  contribution_id     uuid not null references public.contributions (id) on delete restrict,
  entry_type          public.allocation_entry_type not null,
  units               numeric(24, 8) not null check (units <> 0),
  amount              numeric(20, 2) not null,
  entry_nav           numeric(20, 8) not null check (entry_nav > 0),
  reference_hwm       numeric(20, 8) not null check (reference_hwm > 0),
  loss_carry_forward  numeric(20, 2) not null default 0 check (loss_carry_forward >= 0),
  fee_rate            numeric(8, 6) not null check (fee_rate >= 0 and fee_rate < 1),
  fee_terms_id        uuid not null references public.cycle_fee_terms (id) on delete restrict,
  created_by          uuid not null references public.profiles (id) on delete restrict,
  created_at          timestamptz not null default clock_timestamp(),

  -- Exactly one issue and at most one reversal per contribution (DB-level "issue once").
  constraint client_unit_allocations_once unique (contribution_id, entry_type),
  constraint client_unit_allocations_sign check (
    (entry_type = 'issue' and units > 0 and amount > 0)
    or (entry_type = 'reversal' and units < 0 and amount < 0)
  )
);

comment on table public.client_unit_allocations is
  'Append-only unit ledger. issue = contribution lot (locks entry NAV, HWM and fee rate); reversal = negative mirror entry.';

create index client_unit_allocations_cycle_idx on public.client_unit_allocations (cycle_id, client_id);
create index client_unit_allocations_client_idx on public.client_unit_allocations (client_id, cycle_id);

create trigger client_unit_allocations_no_update_delete
  before update or delete on public.client_unit_allocations
  for each row execute function private.reject_audit_mutation();

create trigger client_unit_allocations_no_truncate
  before truncate on public.client_unit_allocations
  for each statement execute function private.reject_audit_mutation();

-- ---------------------------------------------------------------------------
-- Guard: contributions follow pending → verified|rejected, verified → reversed;
-- recorded facts never change. Applies to every role.
-- ---------------------------------------------------------------------------
create or replace function private.guard_contribution_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.id <> old.id or new.cycle_id <> old.cycle_id or new.client_id <> old.client_id
     or new.amount <> old.amount or new.received_at <> old.received_at or new.method <> old.method
     or new.reference_number is distinct from old.reference_number
     or new.recorded_by <> old.recorded_by or new.created_at <> old.created_at then
    raise exception 'Recorded contribution details cannot be changed. Reject or reverse it instead.'
      using errcode = 'check_violation';
  end if;

  if old.status in ('verified', 'reversed')
     and (new.applicable_nav <> old.applicable_nav or new.units_issued <> old.units_issued
          or new.verified_at <> old.verified_at or new.verified_by <> old.verified_by) then
    raise exception 'Issued units and NAV can never be changed.' using errcode = 'check_violation';
  end if;

  if new.status <> old.status and not (
       (old.status = 'pending'  and new.status in ('verified', 'rejected'))
    or (old.status = 'verified' and new.status = 'reversed')
  ) then
    raise exception 'A % contribution cannot become %.', old.status, new.status using errcode = 'check_violation';
  end if;

  if old.status in ('rejected', 'reversed') and new is distinct from old then
    raise exception 'A % contribution is final.', old.status using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

revoke all on function private.guard_contribution_update() from public, anon, authenticated;

create trigger contributions_guard_update
  before update on public.contributions
  for each row execute function private.guard_contribution_update();

create trigger contributions_no_delete
  before delete on public.contributions
  for each row execute function private.reject_delete();

-- ---------------------------------------------------------------------------
-- NAV used for unit issuance (Decision B).
-- Module 9 replaces this body to use the latest PUBLISHED gross NAV as of
-- p_at, falling back to the base NAV. Callers must not change.
-- ---------------------------------------------------------------------------
create or replace function private.applicable_nav(p_cycle_id uuid, p_at timestamptz)
returns numeric
language sql
stable
security definer
set search_path = ''
as $$
  select c.base_nav from public.investment_cycles c where c.id = p_cycle_id;
$$;

revoke all on function private.applicable_nav(uuid, timestamptz) from public, anon, authenticated;

-- units = TRUNC(amount / nav, 8). The dividend is widened to scale 20 first so Postgres's
-- division keeps ample precision before truncation (no premature rounding).
create or replace function private.units_for(p_amount numeric, p_nav numeric)
returns numeric
language sql
immutable
set search_path = ''
as $$
  select trunc(p_amount::numeric(38, 20) / p_nav, 8);
$$;

revoke all on function private.units_for(numeric, numeric) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Read models (security_invoker → caller's RLS applies)
-- ---------------------------------------------------------------------------
create view public.contribution_register
with (security_invoker = true)
as
select
  c.id, c.cycle_id, cy.name as cycle_name, cy.status as cycle_status,
  c.client_id, p.full_name as client_name, p.email as client_email,
  c.amount, c.received_at, c.method, c.reference_number, c.notes, c.status,
  c.applicable_nav, c.units_issued,
  c.recorded_by, c.verified_by, c.verified_at,
  c.rejected_at, c.rejection_reason, c.reversed_at, c.reversal_reason,
  a.fee_rate as locked_fee_rate, a.reference_hwm,
  c.created_at, c.updated_at
from public.contributions c
join public.investment_cycles cy on cy.id = c.cycle_id
join public.profiles p on p.id = c.client_id
left join public.client_unit_allocations a on a.contribution_id = c.id and a.entry_type = 'issue';

create view public.cycle_unit_summary
with (security_invoker = true)
as
select
  cy.id as cycle_id,
  coalesce((select sum(a.units) from public.client_unit_allocations a where a.cycle_id = cy.id), 0)
    as outstanding_units,
  coalesce((select sum(a.amount) from public.client_unit_allocations a where a.cycle_id = cy.id), 0)
    as net_contributed,
  (select count(*) from public.contributions c where c.cycle_id = cy.id and c.status = 'pending')
    as pending_count,
  coalesce((select sum(c.amount) from public.contributions c where c.cycle_id = cy.id and c.status = 'pending'), 0)
    as pending_amount,
  (select count(distinct a.client_id) from public.client_unit_allocations a
    where a.cycle_id = cy.id and a.entry_type = 'issue'
      and not exists (select 1 from public.client_unit_allocations r
                      where r.contribution_id = a.contribution_id and r.entry_type = 'reversal'))
    as investor_count
from public.investment_cycles cy;

create view public.client_cycle_holdings
with (security_invoker = true)
as
select
  a.client_id, a.cycle_id, cy.name as cycle_name, cy.status as cycle_status,
  sum(a.units) as units,
  sum(a.amount) as net_contributed,
  count(*) filter (where a.entry_type = 'issue') as lots_issued,
  count(*) filter (where a.entry_type = 'reversal') as lots_reversed
from public.client_unit_allocations a
join public.investment_cycles cy on cy.id = a.cycle_id
group by a.client_id, a.cycle_id, cy.name, cy.status;

-- ---------------------------------------------------------------------------
-- Privileges and RLS (admin read; client visibility arrives with the portal,
-- through views that exclude admin-only notes — Module 12).
-- ---------------------------------------------------------------------------
revoke all on public.contributions, public.client_unit_allocations,
  public.contribution_register, public.cycle_unit_summary, public.client_cycle_holdings
  from anon, authenticated;
grant select on public.contributions, public.client_unit_allocations,
  public.contribution_register, public.cycle_unit_summary, public.client_cycle_holdings
  to authenticated;

alter table public.contributions enable row level security;
alter table public.client_unit_allocations enable row level security;

create policy contributions_select_admin on public.contributions
  for select to authenticated using ((select private.is_admin()));
create policy client_unit_allocations_select_admin on public.client_unit_allocations
  for select to authenticated using ((select private.is_admin()));

-- ---------------------------------------------------------------------------
-- Admin API
-- ---------------------------------------------------------------------------
create or replace function public.admin_record_contribution(
  p_cycle_id     uuid,
  p_client_id    uuid,
  p_amount       numeric,
  p_received_at  timestamptz,
  p_method       public.contribution_method,
  p_reference    text,
  p_notes        text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor  uuid := private.require_admin();
  v_cycle  public.investment_cycles;
  v_client public.profiles;
  v_ref    text := nullif(btrim(coalesce(p_reference, '')), '');
  v_notes  text := nullif(btrim(coalesce(p_notes, '')), '');
  v_id     uuid;
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'The amount must be greater than zero.' using errcode = 'invalid_parameter_value';
  end if;
  if p_amount <> round(p_amount, 2) then
    raise exception 'The amount can have at most 2 decimal places (paise).' using errcode = 'invalid_parameter_value';
  end if;
  if p_amount >= 10000000000000 then
    raise exception 'The amount is too large.' using errcode = 'invalid_parameter_value';
  end if;
  if p_received_at is null or p_received_at > now() + interval '5 minutes' then
    raise exception 'The received date cannot be in the future.' using errcode = 'invalid_parameter_value';
  end if;
  if p_method is null then
    raise exception 'Choose a payment method.' using errcode = 'invalid_parameter_value';
  end if;
  if v_ref is not null and char_length(v_ref) > 100 then
    raise exception 'The reference must be at most 100 characters.' using errcode = 'invalid_parameter_value';
  end if;
  if v_notes is not null and char_length(v_notes) > 1000 then
    raise exception 'Notes must be at most 1000 characters.' using errcode = 'invalid_parameter_value';
  end if;

  select * into v_cycle from public.investment_cycles where id = p_cycle_id for share;
  if not found then
    raise exception 'Cycle not found.' using errcode = 'no_data_found';
  end if;
  if v_cycle.status not in ('open', 'active') then
    raise exception 'Contributions can only be recorded while the cycle is open or active (it is %).', v_cycle.status
      using errcode = 'check_violation';
  end if;

  select * into v_client from public.profiles where id = p_client_id;
  if not found or v_client.role <> 'client' then
    raise exception 'Client not found.' using errcode = 'no_data_found';
  end if;
  if v_client.status <> 'active' then
    raise exception 'This client account is inactive.' using errcode = 'check_violation';
  end if;

  if v_ref is not null and exists (
    select 1 from public.contributions c
    where c.method = p_method and lower(btrim(c.reference_number)) = lower(v_ref)
      and c.status in ('pending', 'verified')
  ) then
    raise exception 'A contribution with this % reference is already recorded.', replace(p_method::text, '_', ' ')
      using errcode = 'check_violation';
  end if;

  insert into public.contributions
    (cycle_id, client_id, amount, received_at, method, reference_number, notes, recorded_by)
  values (p_cycle_id, p_client_id, p_amount, p_received_at, p_method, v_ref, v_notes, v_actor)
  returning id into v_id;

  perform private.write_audit(
    'contribution.recorded', 'contribution', v_id, null,
    jsonb_build_object('cycle_id', p_cycle_id, 'client_id', p_client_id, 'amount', p_amount::text,
                       'received_at', p_received_at, 'method', p_method, 'reference_number', v_ref)
  );
  return v_id;
end;
$$;

revoke all on function public.admin_record_contribution(uuid, uuid, numeric, timestamptz, public.contribution_method, text, text) from public, anon;
grant execute on function public.admin_record_contribution(uuid, uuid, numeric, timestamptz, public.contribution_method, text, text) to authenticated;

-- Server-computed preview of what verification would issue (nothing is written).
create or replace function public.admin_preview_verification(p_contribution_id uuid)
returns table (applicable_nav text, units text, fee_rate text, fee_version integer)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_c     public.contributions;
  v_nav   numeric;
  v_terms public.cycle_fee_terms;
begin
  perform private.require_admin();
  select * into v_c from public.contributions where id = p_contribution_id;
  if not found then
    raise exception 'Contribution not found.' using errcode = 'no_data_found';
  end if;
  v_nav := private.applicable_nav(v_c.cycle_id, v_c.received_at);
  v_terms := private.fee_terms_at(v_c.cycle_id, clock_timestamp());
  return query select v_nav::text, private.units_for(v_c.amount, v_nav)::text,
                      v_terms.performance_fee_rate::text, v_terms.version;
end;
$$;

revoke all on function public.admin_preview_verification(uuid) from public, anon;
grant execute on function public.admin_preview_verification(uuid) to authenticated;

create or replace function public.admin_verify_contribution(p_contribution_id uuid, p_reason text)
returns table (applicable_nav text, units text, fee_rate text)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_actor  uuid := private.require_admin();
  v_reason text := private.require_reason(p_reason);
  v_c      public.contributions;
  v_cycle  public.cycle_status;
  v_client public.profile_status;
  v_now    timestamptz := clock_timestamp();
  v_nav    numeric;
  v_units  numeric;
  v_terms  public.cycle_fee_terms;
begin
  -- Row lock serialises concurrent verifications of the same contribution.
  select * into v_c from public.contributions where id = p_contribution_id for update;
  if not found then
    raise exception 'Contribution not found.' using errcode = 'no_data_found';
  end if;
  if v_c.status <> 'pending' then
    raise exception 'This contribution is already % and cannot be verified again.', v_c.status
      using errcode = 'check_violation';
  end if;

  select status into v_cycle from public.investment_cycles where id = v_c.cycle_id for share;
  if v_cycle not in ('open', 'active') then
    raise exception 'Units can only be issued while the cycle is open or active (it is %).', v_cycle
      using errcode = 'check_violation';
  end if;

  select status into v_client from public.profiles where id = v_c.client_id;
  if v_client <> 'active' then
    raise exception 'This client account is inactive. Reactivate it before verifying.' using errcode = 'check_violation';
  end if;

  v_nav := private.applicable_nav(v_c.cycle_id, v_c.received_at);
  if v_nav is null or v_nav <= 0 then
    raise exception 'No applicable NAV is available for this cycle.' using errcode = 'check_violation';
  end if;
  v_terms := private.fee_terms_at(v_c.cycle_id, v_now);
  if v_terms.id is null then
    raise exception 'No fee terms are in force for this cycle.' using errcode = 'check_violation';
  end if;
  v_units := private.units_for(v_c.amount, v_nav);
  if v_units <= 0 then
    raise exception 'The amount is too small to issue any units at NAV %.', v_nav using errcode = 'check_violation';
  end if;

  update public.contributions
  set status = 'verified', verified_by = v_actor, verified_at = v_now,
      applicable_nav = v_nav, units_issued = v_units
  where id = v_c.id;

  insert into public.client_unit_allocations
    (cycle_id, client_id, contribution_id, entry_type, units, amount, entry_nav, reference_hwm,
     loss_carry_forward, fee_rate, fee_terms_id, created_by, created_at)
  values
    (v_c.cycle_id, v_c.client_id, v_c.id, 'issue', v_units, v_c.amount, v_nav, v_nav,
     0, v_terms.performance_fee_rate, v_terms.id, v_actor, v_now);

  perform private.write_audit(
    'contribution.verified', 'contribution', v_c.id,
    jsonb_build_object('status', 'pending'),
    jsonb_build_object('status', 'verified', 'amount', v_c.amount::text, 'applicable_nav', v_nav::text,
                       'units_issued', v_units::text, 'fee_rate', v_terms.performance_fee_rate::text,
                       'fee_terms_version', v_terms.version, 'reference_hwm', v_nav::text),
    v_reason
  );

  return query select v_nav::text, v_units::text, v_terms.performance_fee_rate::text;
end;
$$;

revoke all on function public.admin_verify_contribution(uuid, text) from public, anon;
grant execute on function public.admin_verify_contribution(uuid, text) to authenticated;

create or replace function public.admin_reject_contribution(p_contribution_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor  uuid := private.require_admin();
  v_reason text := private.require_reason(p_reason);
  v_status public.contribution_status;
begin
  select status into v_status from public.contributions where id = p_contribution_id for update;
  if not found then
    raise exception 'Contribution not found.' using errcode = 'no_data_found';
  end if;
  if v_status <> 'pending' then
    raise exception 'Only pending contributions can be rejected (this one is %).', v_status
      using errcode = 'check_violation';
  end if;

  update public.contributions
  set status = 'rejected', rejected_by = v_actor, rejected_at = clock_timestamp(), rejection_reason = v_reason
  where id = p_contribution_id;

  perform private.write_audit('contribution.rejected', 'contribution', p_contribution_id,
    jsonb_build_object('status', 'pending'), jsonb_build_object('status', 'rejected'), v_reason);
end;
$$;

revoke all on function public.admin_reject_contribution(uuid, text) from public, anon;
grant execute on function public.admin_reject_contribution(uuid, text) to authenticated;

create or replace function public.admin_reverse_contribution(p_contribution_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor  uuid := private.require_admin();
  v_reason text := private.require_reason(p_reason);
  v_c      public.contributions;
  v_issue  public.client_unit_allocations;
  v_cycle  public.cycle_status;
  v_now    timestamptz := clock_timestamp();
begin
  select * into v_c from public.contributions where id = p_contribution_id for update;
  if not found then
    raise exception 'Contribution not found.' using errcode = 'no_data_found';
  end if;
  if v_c.status <> 'verified' then
    raise exception 'Only verified contributions can be reversed (this one is %).', v_c.status
      using errcode = 'check_violation';
  end if;

  select status into v_cycle from public.investment_cycles where id = v_c.cycle_id for share;
  if v_cycle not in ('open', 'active') then
    raise exception 'Contributions cannot be reversed after the cycle is closed.' using errcode = 'check_violation';
  end if;

  select * into v_issue from public.client_unit_allocations
  where contribution_id = v_c.id and entry_type = 'issue';

  update public.contributions
  set status = 'reversed', reversed_by = v_actor, reversed_at = v_now, reversal_reason = v_reason
  where id = v_c.id;

  -- Mirror entry: removes exactly the units issued; the original lot row is untouched.
  insert into public.client_unit_allocations
    (cycle_id, client_id, contribution_id, entry_type, units, amount, entry_nav, reference_hwm,
     loss_carry_forward, fee_rate, fee_terms_id, created_by, created_at)
  values
    (v_issue.cycle_id, v_issue.client_id, v_c.id, 'reversal', -v_issue.units, -v_issue.amount,
     v_issue.entry_nav, v_issue.reference_hwm, 0, v_issue.fee_rate, v_issue.fee_terms_id, v_actor, v_now);

  perform private.write_audit('contribution.reversed', 'contribution', v_c.id,
    jsonb_build_object('status', 'verified', 'units_issued', v_issue.units::text),
    jsonb_build_object('status', 'reversed', 'units_reversed', v_issue.units::text), v_reason);
end;
$$;

revoke all on function public.admin_reverse_contribution(uuid, text) from public, anon;
grant execute on function public.admin_reverse_contribution(uuid, text) to authenticated;
