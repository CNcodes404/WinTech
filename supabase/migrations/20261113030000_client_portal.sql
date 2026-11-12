-- =============================================================================
-- Module 12: client portal data access + forced password change
--
-- Security model:
--   * Clients get NO direct SELECT on contributions, ledger, valuations, NAV or
--     fee tables (RLS there stays admin-only). Postgres column privileges are
--     per role, not per user, so client-facing reads go through SECURITY
--     DEFINER functions that:
--       - require the caller to be an ACTIVE CLIENT (private.current_client_id),
--       - return ONLY the caller's own rows,
--       - return ONLY client-safe columns (no admin notes, no verifier ids,
--         no admin-written reasons, no holdings, no other clients).
--   * NUMERIC values are returned as text (exact decimals).
--   * Accounts created by an admin must change their temporary password at
--     first sign-in (profiles.must_change_password). The flag is a usability
--     guard; clients cannot set it themselves (column not granted).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Forced password change
-- ---------------------------------------------------------------------------
alter table public.profiles add column must_change_password boolean not null default false;

comment on column public.profiles.must_change_password is
  'True for admin-created accounts until the user sets their own password.';

-- New users created by an admin (app_metadata.created_by) must change the temporary password.
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_full_name text := left(coalesce(nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''), ''), 120);
  v_phone     text := nullif(btrim(new.raw_user_meta_data ->> 'phone'), '');
  v_creator   text := new.raw_app_meta_data ->> 'created_by';
  v_actor     uuid;
begin
  if v_phone is not null and v_phone !~ '^\+?[0-9 ()-]{7,20}$' then
    v_phone := null;
  end if;
  if v_creator ~ '^[0-9a-fA-F-]{36}$' then
    v_actor := v_creator::uuid;
  end if;

  insert into public.profiles (id, email, full_name, phone, must_change_password)
  values (new.id, coalesce(new.email, ''), v_full_name, v_phone, v_actor is not null)
  on conflict (id) do nothing;

  if found then
    perform private.write_audit(
      'profile.created', 'profile', new.id, null,
      jsonb_build_object('email', coalesce(new.email, ''), 'full_name', v_full_name, 'phone', v_phone, 'role', 'client'),
      null, v_actor
    );
  end if;
  return new;
end;
$$;

revoke all on function public.handle_new_auth_user() from public, anon, authenticated;

-- Called by the signed-in user right after supabase.auth.updateUser({ password }) succeeds.
create or replace function public.complete_password_change()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'Not signed in.' using errcode = 'insufficient_privilege';
  end if;
  update public.profiles set must_change_password = false where id = v_uid and must_change_password;
  if found then
    perform private.write_audit('profile.password_changed', 'profile', v_uid, null,
      jsonb_build_object('must_change_password', false), null, v_uid);
  end if;
end;
$$;

revoke all on function public.complete_password_change() from public, anon;
grant execute on function public.complete_password_change() to authenticated;

-- ---------------------------------------------------------------------------
-- Caller must be an active client.
-- ---------------------------------------------------------------------------
create or replace function private.current_client_id()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null or not exists (
    select 1 from public.profiles p where p.id = v_uid and p.role = 'client' and p.status = 'active'
  ) then
    raise exception 'Only active clients can view this information.' using errcode = 'insufficient_privilege';
  end if;
  return v_uid;
end;
$$;

revoke all on function private.current_client_id() from public, anon, authenticated;

-- Cycles the client has (or had) a verified lot in.
create or replace function private.client_cycle_ids(p_client uuid)
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select distinct a.cycle_id from public.client_unit_allocations a where a.client_id = p_client;
$$;

revoke all on function private.client_cycle_ids(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Client API (own data only)
-- ---------------------------------------------------------------------------

-- One row per cycle the client holds (or held) units in, with figures at the latest published NAV.
create or replace function public.client_my_cycles()
returns table (
  cycle_id            uuid,
  cycle_name          text,
  cycle_status        text,
  start_date          date,
  end_date            date,
  base_nav            text,
  current_fee_rate    text,
  units               text,
  net_contributed     text,
  latest_nav_date     timestamptz,
  latest_gross_nav    text,
  lots_contributed    text,
  gross_value         text,
  fee_amount          text,
  net_value           text,
  loss_to_recover     text
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
  with mine as (
    select c.* from public.investment_cycles c where c.id in (select private.client_cycle_ids(v_client))
  ),
  holding as (
    select a.cycle_id, sum(a.units) as units, sum(a.amount) as net_contributed
    from public.client_unit_allocations a where a.client_id = v_client group by a.cycle_id
  ),
  latest as (
    select distinct on (s.cycle_id) s.cycle_id, s.id, s.nav_date, s.gross_nav_per_unit
    from public.nav_snapshots s
    where s.status = 'published' and s.cycle_id in (select id from mine)
    order by s.cycle_id, s.nav_date desc
  ),
  valued as (
    select l.cycle_id, sum(c.amount) as contributed, sum(f.gross_value) as gross_value,
           sum(f.fee_amount) as fee_amount, sum(f.net_value) as net_value, sum(f.loss_to_recover) as loss
    from latest l
    join public.lot_fee_accruals f on f.snapshot_id = l.id and f.client_id = v_client
    join public.contributions c on c.id = f.contribution_id
    group by l.cycle_id
  )
  select m.id, m.name, m.status::text, m.start_date, m.end_date, m.base_nav::text,
         (private.fee_terms_at(m.id, now())).performance_fee_rate::text,
         coalesce(h.units, 0)::text, coalesce(h.net_contributed, 0)::text,
         l.nav_date, l.gross_nav_per_unit::text,
         v.contributed::text, v.gross_value::text, v.fee_amount::text, v.net_value::text, v.loss::text
  from mine m
  left join holding h on h.cycle_id = m.id
  left join latest l on l.cycle_id = m.id
  left join valued v on v.cycle_id = m.id
  order by m.start_date desc;
end;
$$;

-- The client's contributions (all statuses). No notes, no verifier, no admin-written reasons.
create or replace function public.client_my_contributions()
returns table (
  id               uuid,
  cycle_id         uuid,
  cycle_name       text,
  amount           text,
  received_at      timestamptz,
  method           text,
  reference_number text,
  status           text,
  applicable_nav   text,
  units_issued     text,
  locked_fee_rate  text,
  verified_at      timestamptz,
  rejected_at      timestamptz,
  reversed_at      timestamptz
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
  select c.id, c.cycle_id, cy.name, c.amount::text, c.received_at, c.method::text, c.reference_number,
         c.status::text, c.applicable_nav::text, c.units_issued::text, a.fee_rate::text,
         c.verified_at, c.rejected_at, c.reversed_at
  from public.contributions c
  join public.investment_cycles cy on cy.id = c.cycle_id
  left join public.client_unit_allocations a on a.contribution_id = c.id and a.entry_type = 'issue'
  where c.client_id = v_client
  order by c.received_at desc;
end;
$$;

-- Per-lot values at the latest published NAV of a cycle the client is in.
create or replace function public.client_my_lot_values(p_cycle_id uuid)
returns table (
  contribution_id          uuid,
  received_at              timestamptz,
  amount                   text,
  units                    text,
  entry_nav                text,
  reference_hwm            text,
  fee_rate                 text,
  nav_date                 timestamptz,
  gross_nav_per_unit       text,
  gross_value              text,
  eligible_profit_per_unit text,
  fee_amount               text,
  net_value                text,
  loss_to_recover          text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_client uuid := private.current_client_id();
  v_snap   public.nav_snapshots;
begin
  if p_cycle_id not in (select private.client_cycle_ids(v_client)) then
    return;
  end if;
  select * into v_snap from public.nav_snapshots
  where cycle_id = p_cycle_id and status = 'published' order by nav_date desc limit 1;
  if not found then
    return;
  end if;
  return query
  select f.contribution_id, c.received_at, c.amount::text, f.units::text, f.entry_nav::text, f.reference_hwm::text,
         f.fee_rate::text, v_snap.nav_date, f.gross_nav_per_unit::text, f.gross_value::text,
         f.eligible_profit_per_unit::text, f.fee_amount::text, f.net_value::text, f.loss_to_recover::text
  from public.lot_fee_accruals f
  join public.contributions c on c.id = f.contribution_id
  where f.snapshot_id = v_snap.id and f.client_id = v_client
  order by c.received_at;
end;
$$;

-- Published gross NAV history of a cycle the client is in.
create or replace function public.client_nav_history(p_cycle_id uuid)
returns table (nav_date timestamptz, gross_nav_per_unit text)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_client uuid := private.current_client_id();
begin
  if p_cycle_id not in (select private.client_cycle_ids(v_client)) then
    return;
  end if;
  return query
  select s.nav_date, s.gross_nav_per_unit::text
  from public.nav_snapshots s
  where s.cycle_id = p_cycle_id and s.status = 'published'
  order by s.nav_date;
end;
$$;

-- Client activity feed built from facts (not the admin audit log, so no admin reasons leak).
create or replace function public.client_my_activity(p_limit integer default 50)
returns table (occurred_at timestamptz, kind text, cycle_name text, amount text, units text, nav text)
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
  select * from (
    select c.created_at, 'contribution_recorded'::text, cy.name, c.amount::text, null::text, null::text
      from public.contributions c join public.investment_cycles cy on cy.id = c.cycle_id
     where c.client_id = v_client
    union all
    select c.verified_at, 'units_issued', cy.name, c.amount::text, c.units_issued::text, c.applicable_nav::text
      from public.contributions c join public.investment_cycles cy on cy.id = c.cycle_id
     where c.client_id = v_client and c.verified_at is not null
    union all
    select c.rejected_at, 'contribution_rejected', cy.name, c.amount::text, null, null
      from public.contributions c join public.investment_cycles cy on cy.id = c.cycle_id
     where c.client_id = v_client and c.rejected_at is not null
    union all
    select c.reversed_at, 'contribution_reversed', cy.name, c.amount::text, c.units_issued::text, null
      from public.contributions c join public.investment_cycles cy on cy.id = c.cycle_id
     where c.client_id = v_client and c.reversed_at is not null
    union all
    select s.published_at, 'nav_published', cy.name, null, null, s.gross_nav_per_unit::text
      from public.nav_snapshots s join public.investment_cycles cy on cy.id = s.cycle_id
     where s.status in ('published', 'corrected')
       and s.cycle_id in (select private.client_cycle_ids(v_client))
  ) e(occurred_at, kind, cycle_name, amount, units, nav)
  order by e.occurred_at desc
  limit greatest(1, least(coalesce(p_limit, 50), 200));
end;
$$;

-- Execute grants: authenticated only (functions authorise internally).
revoke all on function public.client_my_cycles() from public, anon;
revoke all on function public.client_my_contributions() from public, anon;
revoke all on function public.client_my_lot_values(uuid) from public, anon;
revoke all on function public.client_nav_history(uuid) from public, anon;
revoke all on function public.client_my_activity(integer) from public, anon;
grant execute on function public.client_my_cycles() to authenticated;
grant execute on function public.client_my_contributions() to authenticated;
grant execute on function public.client_my_lot_values(uuid) to authenticated;
grant execute on function public.client_nav_history(uuid) to authenticated;
grant execute on function public.client_my_activity(integer) to authenticated;
