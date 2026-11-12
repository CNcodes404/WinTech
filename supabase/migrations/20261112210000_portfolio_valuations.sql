-- =============================================================================
-- Module 8: manual portfolio valuations (holdings, cash, liabilities)
--
-- Rules (BUSINESS_LOGIC §3, §9; ARCHITECTURE §3):
--   * V1 source is always 'manual_demo' — admin-entered, never live prices.
--   * Lifecycle: draft → approved → superseded (by an approved correction),
--     or draft → discarded. Nothing is ever deleted.
--   * Drafts are editable. Approved valuations and their line items are an
--     immutable snapshot (enforced for every role).
--   * The server computes every derived amount; client-supplied totals are
--     never trusted:
--        market_value          = ROUND(quantity × valuation_price, 2)  (per line)
--        holdings_value        = Σ market_value
--        gross_asset_value     = holdings_value + cash_balance + other_assets
--        gross_net_asset_value = gross_asset_value − liabilities
--   * Only approved valuations can be used for NAV (Module 9).
--   * Contribution totals are never treated as portfolio value.
-- =============================================================================

create type public.valuation_status as enum ('draft', 'approved', 'superseded', 'discarded');

create table public.portfolio_valuations (
  id                     uuid primary key default gen_random_uuid(),
  cycle_id               uuid not null references public.investment_cycles (id) on delete restrict,
  valuation_at           timestamptz not null,
  source                 text not null default 'manual_demo' check (source = 'manual_demo'),
  status                 public.valuation_status not null default 'draft',
  cash_balance           numeric(20, 2) not null default 0 check (cash_balance >= 0),
  other_assets           numeric(20, 2) not null default 0 check (other_assets >= 0),
  liabilities            numeric(20, 2) not null default 0 check (liabilities >= 0),
  holdings_value         numeric(20, 2) not null default 0 check (holdings_value >= 0),
  gross_asset_value      numeric(20, 2) not null default 0 check (gross_asset_value >= 0),
  gross_net_asset_value  numeric(20, 2) not null default 0,
  notes                  text check (notes is null or char_length(notes) <= 2000),
  corrects_valuation_id  uuid references public.portfolio_valuations (id) on delete restrict,
  entered_by             uuid not null references public.profiles (id) on delete restrict,
  approved_by            uuid references public.profiles (id) on delete restrict,
  approved_at            timestamptz,
  superseded_by          uuid references public.portfolio_valuations (id) on delete restrict,
  superseded_at          timestamptz,
  discarded_at           timestamptz,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),

  constraint portfolio_valuations_totals check (
    gross_asset_value = holdings_value + cash_balance + other_assets
    and gross_net_asset_value = gross_asset_value - liabilities
  ),
  constraint portfolio_valuations_status_fields check (
    case status
      when 'draft'      then approved_at is null and superseded_at is null and discarded_at is null
      when 'approved'   then approved_by is not null and approved_at is not null and superseded_at is null
      when 'superseded' then approved_at is not null and superseded_by is not null and superseded_at is not null
      when 'discarded'  then approved_at is null and discarded_at is not null
    end
  )
);

comment on table public.portfolio_valuations is
  'Manual demo valuations. Approved rows (and their items) are immutable snapshots used for NAV.';

create index portfolio_valuations_cycle_idx on public.portfolio_valuations (cycle_id, status, valuation_at desc);
-- At most one live draft correcting the same approved valuation.
create unique index portfolio_valuations_one_correction_draft
  on public.portfolio_valuations (corrects_valuation_id) where status = 'draft';

create trigger portfolio_valuations_set_updated_at
  before update on public.portfolio_valuations
  for each row execute function public.set_updated_at();

create table public.portfolio_valuation_items (
  id               uuid primary key default gen_random_uuid(),
  valuation_id     uuid not null references public.portfolio_valuations (id) on delete restrict,
  line_no          integer not null check (line_no >= 1),
  symbol           text not null check (symbol ~ '^[A-Z0-9][A-Z0-9&._-]{0,29}$'),
  instrument_name  text check (instrument_name is null or char_length(instrument_name) <= 120),
  exchange         text check (exchange is null or exchange in ('NSE', 'BSE', 'OTHER')),
  quantity         numeric(24, 8) not null check (quantity > 0),
  valuation_price  numeric(20, 8) not null check (valuation_price >= 0),
  market_value     numeric(20, 2) not null check (market_value >= 0),
  average_cost     numeric(20, 8) check (average_cost is null or average_cost >= 0),
  notes            text check (notes is null or char_length(notes) <= 500),
  constraint portfolio_valuation_items_line_key unique (valuation_id, line_no),
  constraint portfolio_valuation_items_value check (market_value = round(quantity * valuation_price, 2))
);

create index portfolio_valuation_items_valuation_idx on public.portfolio_valuation_items (valuation_id, line_no);

-- ---------------------------------------------------------------------------
-- Guards: approved snapshots are immutable; nothing is deleted.
-- ---------------------------------------------------------------------------
create or replace function private.guard_valuation_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.id <> old.id or new.cycle_id <> old.cycle_id or new.source <> old.source
     or new.entered_by <> old.entered_by or new.created_at <> old.created_at
     or new.corrects_valuation_id is distinct from old.corrects_valuation_id then
    raise exception 'Immutable valuation fields cannot be changed.' using errcode = 'check_violation';
  end if;

  if old.status = 'draft' then
    if new.status not in ('draft', 'approved', 'discarded') then
      raise exception 'A draft can only be approved or discarded.' using errcode = 'check_violation';
    end if;
    return new;
  end if;

  if old.status = 'approved' and new.status = 'superseded'
     and new.valuation_at = old.valuation_at and new.cash_balance = old.cash_balance
     and new.other_assets = old.other_assets and new.liabilities = old.liabilities
     and new.holdings_value = old.holdings_value and new.gross_asset_value = old.gross_asset_value
     and new.gross_net_asset_value = old.gross_net_asset_value
     and new.notes is not distinct from old.notes
     and new.approved_by = old.approved_by and new.approved_at = old.approved_at then
    return new;
  end if;

  raise exception 'A % valuation is an immutable snapshot. Create a correction instead.', old.status
    using errcode = 'check_violation';
end;
$$;

revoke all on function private.guard_valuation_update() from public, anon, authenticated;

create trigger portfolio_valuations_guard_update
  before update on public.portfolio_valuations
  for each row execute function private.guard_valuation_update();

create trigger portfolio_valuations_no_delete
  before delete on public.portfolio_valuations
  for each row execute function private.reject_delete();

-- Items may only change while their valuation is a draft (draft lines are replaced on save).
create or replace function private.guard_valuation_items()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_status public.valuation_status;
begin
  select status into v_status from public.portfolio_valuations
  where id = coalesce(new.valuation_id, old.valuation_id);
  if v_status is distinct from 'draft' then
    raise exception 'Line items of a % valuation cannot be changed.', coalesce(v_status::text, 'missing')
      using errcode = 'check_violation';
  end if;
  if tg_op = 'UPDATE' and new.valuation_id <> old.valuation_id then
    raise exception 'Line items cannot move between valuations.' using errcode = 'check_violation';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

revoke all on function private.guard_valuation_items() from public, anon, authenticated;

create trigger portfolio_valuation_items_guard
  before insert or update or delete on public.portfolio_valuation_items
  for each row execute function private.guard_valuation_items();

create trigger portfolio_valuation_items_no_truncate
  before truncate on public.portfolio_valuation_items
  for each statement execute function private.reject_delete();

-- ---------------------------------------------------------------------------
-- Privileges / RLS: admin read only; all writes via functions.
-- ---------------------------------------------------------------------------
revoke all on public.portfolio_valuations, public.portfolio_valuation_items from anon, authenticated;
grant select on public.portfolio_valuations, public.portfolio_valuation_items to authenticated;

alter table public.portfolio_valuations enable row level security;
alter table public.portfolio_valuation_items enable row level security;

create policy portfolio_valuations_select_admin on public.portfolio_valuations
  for select to authenticated using ((select private.is_admin()));
create policy portfolio_valuation_items_select_admin on public.portfolio_valuation_items
  for select to authenticated using ((select private.is_admin()));

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function private.parse_money(p_value text, p_label text)
returns numeric
language plpgsql
immutable
set search_path = ''
as $$
declare
  v numeric;
begin
  if p_value is null or btrim(p_value) = '' then
    return 0;
  end if;
  begin
    v := btrim(p_value)::numeric;
  exception when others then
    raise exception '% is not a valid amount.', p_label using errcode = 'invalid_parameter_value';
  end;
  if v < 0 then
    raise exception '% cannot be negative.', p_label using errcode = 'invalid_parameter_value';
  end if;
  if v <> round(v, 2) then
    raise exception '% can have at most 2 decimal places.', p_label using errcode = 'invalid_parameter_value';
  end if;
  if v >= 1000000000000000000 then
    raise exception '% is too large.', p_label using errcode = 'invalid_parameter_value';
  end if;
  return v;
end;
$$;

revoke all on function private.parse_money(text, text) from public, anon, authenticated;

-- Recompute and store totals from the line items (single source of truth).
create or replace function private.recompute_valuation_totals(p_valuation_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_holdings numeric;
begin
  select coalesce(sum(market_value), 0) into v_holdings
  from public.portfolio_valuation_items where valuation_id = p_valuation_id;

  update public.portfolio_valuations
  set holdings_value        = v_holdings,
      gross_asset_value     = v_holdings + cash_balance + other_assets,
      gross_net_asset_value = v_holdings + cash_balance + other_assets - liabilities
  where id = p_valuation_id;
end;
$$;

revoke all on function private.recompute_valuation_totals(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Admin API
-- ---------------------------------------------------------------------------

-- Create (p_valuation_id NULL) or replace a draft. Items: JSON array of
-- { symbol, instrument_name, exchange, quantity, valuation_price, average_cost, notes }
-- with numbers as strings. All money/units are parsed and validated here.
create or replace function public.admin_save_valuation_draft(
  p_valuation_id   uuid,
  p_cycle_id       uuid,
  p_valuation_at   timestamptz,
  p_cash_balance   text,
  p_other_assets   text,
  p_liabilities    text,
  p_notes          text,
  p_items          jsonb,
  p_corrects_id    uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor   uuid := private.require_admin();
  v_cycle   public.cycle_status;
  v_id      uuid := p_valuation_id;
  v_existing public.portfolio_valuations;
  v_corr    public.portfolio_valuations;
  v_item    jsonb;
  v_line    integer := 0;
  v_symbol  text;
  v_exch    text;
  v_name    text;
  v_qty     numeric;
  v_price   numeric;
  v_avg     numeric;
  v_inotes  text;
  v_cash    numeric := private.parse_money(p_cash_balance, 'Cash balance');
  v_other   numeric := private.parse_money(p_other_assets, 'Other assets');
  v_liab    numeric := private.parse_money(p_liabilities, 'Liabilities');
  v_notes   text := nullif(btrim(coalesce(p_notes, '')), '');
  v_keys    text[] := '{}';
  v_after   jsonb;
begin
  if p_valuation_at is null or p_valuation_at > now() + interval '5 minutes' then
    raise exception 'The valuation time cannot be in the future.' using errcode = 'invalid_parameter_value';
  end if;
  if v_notes is not null and char_length(v_notes) > 2000 then
    raise exception 'Notes must be at most 2000 characters.' using errcode = 'invalid_parameter_value';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    raise exception 'Holdings must be a list.' using errcode = 'invalid_parameter_value';
  end if;
  if jsonb_array_length(p_items) > 200 then
    raise exception 'A valuation can have at most 200 holdings.' using errcode = 'invalid_parameter_value';
  end if;

  select status into v_cycle from public.investment_cycles where id = p_cycle_id;
  if not found then
    raise exception 'Cycle not found.' using errcode = 'no_data_found';
  end if;
  if v_cycle not in ('open', 'active', 'closed') then
    raise exception 'Valuations can be entered for open, active or closed cycles (this one is %).', v_cycle
      using errcode = 'check_violation';
  end if;

  if v_id is null then
    if p_corrects_id is not null then
      select * into v_corr from public.portfolio_valuations where id = p_corrects_id;
      if not found or v_corr.status <> 'approved' or v_corr.cycle_id <> p_cycle_id then
        raise exception 'Only an approved valuation of the same cycle can be corrected.' using errcode = 'check_violation';
      end if;
      if exists (select 1 from public.portfolio_valuations d where d.corrects_valuation_id = p_corrects_id and d.status = 'draft') then
        raise exception 'A correction draft already exists for this valuation. Edit or discard it first.'
          using errcode = 'check_violation';
      end if;
    end if;
    -- Totals must satisfy the check constraint at every write; holdings are added below and recomputed.
    insert into public.portfolio_valuations
      (cycle_id, valuation_at, cash_balance, other_assets, liabilities, holdings_value, gross_asset_value,
       gross_net_asset_value, notes, entered_by, corrects_valuation_id)
    values (p_cycle_id, p_valuation_at, v_cash, v_other, v_liab, 0, v_cash + v_other, v_cash + v_other - v_liab,
            v_notes, v_actor, p_corrects_id)
    returning id into v_id;
  else
    select * into v_existing from public.portfolio_valuations where id = v_id for update;
    if not found then
      raise exception 'Valuation not found.' using errcode = 'no_data_found';
    end if;
    if v_existing.status <> 'draft' then
      raise exception 'Only drafts can be edited. Create a correction instead.' using errcode = 'check_violation';
    end if;
    if v_existing.cycle_id <> p_cycle_id then
      raise exception 'A draft cannot be moved to another cycle.' using errcode = 'check_violation';
    end if;
    update public.portfolio_valuations
    set valuation_at = p_valuation_at, cash_balance = v_cash, other_assets = v_other,
        liabilities = v_liab, notes = v_notes, holdings_value = 0,
        gross_asset_value = v_cash + v_other, gross_net_asset_value = v_cash + v_other - v_liab
    where id = v_id;
    delete from public.portfolio_valuation_items where valuation_id = v_id;
  end if;

  for v_item in select value from jsonb_array_elements(p_items) loop
    v_line := v_line + 1;
    if jsonb_typeof(v_item) <> 'object' then
      raise exception 'Holding % is not valid.', v_line using errcode = 'invalid_parameter_value';
    end if;

    v_symbol := upper(btrim(coalesce(v_item ->> 'symbol', '')));
    if v_symbol !~ '^[A-Z0-9][A-Z0-9&._-]{0,29}$' then
      raise exception 'Holding %: enter a symbol (letters, digits, & . _ -; max 30).', v_line
        using errcode = 'invalid_parameter_value';
    end if;
    v_exch := nullif(upper(btrim(coalesce(v_item ->> 'exchange', ''))), '');
    if v_exch is not null and v_exch not in ('NSE', 'BSE', 'OTHER') then
      raise exception 'Holding %: exchange must be NSE, BSE or Other.', v_line using errcode = 'invalid_parameter_value';
    end if;
    if (v_symbol || '|' || coalesce(v_exch, '')) = any (v_keys) then
      raise exception 'Holding %: % appears more than once. Combine the quantities into one line.', v_line, v_symbol
        using errcode = 'invalid_parameter_value';
    end if;
    v_keys := v_keys || (v_symbol || '|' || coalesce(v_exch, ''));

    v_name := nullif(btrim(coalesce(v_item ->> 'instrument_name', '')), '');
    if v_name is not null and char_length(v_name) > 120 then
      raise exception 'Holding %: name must be at most 120 characters.', v_line using errcode = 'invalid_parameter_value';
    end if;
    v_inotes := nullif(btrim(coalesce(v_item ->> 'notes', '')), '');
    if v_inotes is not null and char_length(v_inotes) > 500 then
      raise exception 'Holding %: notes must be at most 500 characters.', v_line using errcode = 'invalid_parameter_value';
    end if;

    begin
      v_qty := btrim(v_item ->> 'quantity')::numeric;
      v_price := btrim(v_item ->> 'valuation_price')::numeric;
      v_avg := nullif(btrim(coalesce(v_item ->> 'average_cost', '')), '')::numeric;
    exception when others then
      raise exception 'Holding %: quantity, price and average cost must be numbers.', v_line
        using errcode = 'invalid_parameter_value';
    end;
    if v_qty is null or v_qty <= 0 or v_qty <> round(v_qty, 8) or v_qty >= 10000000000000000 then
      raise exception 'Holding %: quantity must be greater than 0 with at most 8 decimals.', v_line
        using errcode = 'invalid_parameter_value';
    end if;
    if v_price is null or v_price < 0 or v_price <> round(v_price, 8) or v_price >= 1000000000000 then
      raise exception 'Holding %: price must be 0 or more with at most 8 decimals.', v_line
        using errcode = 'invalid_parameter_value';
    end if;
    if v_avg is not null and (v_avg < 0 or v_avg <> round(v_avg, 8) or v_avg >= 1000000000000) then
      raise exception 'Holding %: average cost must be 0 or more with at most 8 decimals.', v_line
        using errcode = 'invalid_parameter_value';
    end if;

    insert into public.portfolio_valuation_items
      (valuation_id, line_no, symbol, instrument_name, exchange, quantity, valuation_price, market_value, average_cost, notes)
    values
      (v_id, v_line, v_symbol, v_name, v_exch, v_qty, v_price, round(v_qty * v_price, 2), v_avg, v_inotes);
  end loop;

  perform private.recompute_valuation_totals(v_id);

  select jsonb_build_object('valuation_at', valuation_at, 'items', v_line,
                            'holdings_value', holdings_value::text, 'cash_balance', cash_balance::text,
                            'other_assets', other_assets::text, 'liabilities', liabilities::text,
                            'gross_net_asset_value', gross_net_asset_value::text,
                            'corrects_valuation_id', corrects_valuation_id)
    into v_after from public.portfolio_valuations where id = v_id;
  perform private.write_audit('valuation.draft_saved', 'valuation', v_id, null, v_after);
  return v_id;
end;
$$;

revoke all on function public.admin_save_valuation_draft(uuid, uuid, timestamptz, text, text, text, text, jsonb, uuid) from public, anon;
grant execute on function public.admin_save_valuation_draft(uuid, uuid, timestamptz, text, text, text, text, jsonb, uuid) to authenticated;

create or replace function public.admin_approve_valuation(p_valuation_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor  uuid := private.require_admin();
  v_reason text := private.require_reason(p_reason);
  v_val    public.portfolio_valuations;
  v_cycle  public.cycle_status;
  v_now    timestamptz := clock_timestamp();
  v_items  integer;
begin
  select * into v_val from public.portfolio_valuations where id = p_valuation_id for update;
  if not found then
    raise exception 'Valuation not found.' using errcode = 'no_data_found';
  end if;
  if v_val.status <> 'draft' then
    raise exception 'Only drafts can be approved (this one is %).', v_val.status using errcode = 'check_violation';
  end if;
  if v_val.valuation_at > v_now then
    raise exception 'A valuation dated in the future cannot be approved.' using errcode = 'check_violation';
  end if;

  select status into v_cycle from public.investment_cycles where id = v_val.cycle_id for share;
  if v_cycle not in ('open', 'active', 'closed') then
    raise exception 'Valuations can be approved for open, active or closed cycles (this one is %).', v_cycle
      using errcode = 'check_violation';
  end if;

  select count(*) into v_items from public.portfolio_valuation_items where valuation_id = v_val.id;
  if v_items = 0 and v_val.cash_balance = 0 and v_val.other_assets = 0 then
    raise exception 'An empty valuation (no holdings, cash or other assets) cannot be approved.'
      using errcode = 'check_violation';
  end if;

  -- Recompute from the snapshot lines one final time before freezing.
  perform private.recompute_valuation_totals(v_val.id);

  update public.portfolio_valuations
  set status = 'approved', approved_by = v_actor, approved_at = v_now
  where id = v_val.id;

  if v_val.corrects_valuation_id is not null then
    update public.portfolio_valuations
    set status = 'superseded', superseded_by = v_val.id, superseded_at = v_now
    where id = v_val.corrects_valuation_id and status = 'approved';
    if not found then
      raise exception 'The valuation being corrected is no longer approved.' using errcode = 'check_violation';
    end if;
    perform private.write_audit('valuation.superseded', 'valuation', v_val.corrects_valuation_id,
      jsonb_build_object('status', 'approved'),
      jsonb_build_object('status', 'superseded', 'superseded_by', v_val.id), v_reason);
  end if;

  perform private.write_audit('valuation.approved', 'valuation', v_val.id,
    jsonb_build_object('status', 'draft'),
    (select jsonb_build_object('status', 'approved', 'valuation_at', valuation_at,
       'holdings_value', holdings_value::text, 'cash_balance', cash_balance::text,
       'other_assets', other_assets::text, 'liabilities', liabilities::text,
       'gross_asset_value', gross_asset_value::text, 'gross_net_asset_value', gross_net_asset_value::text,
       'items', v_items, 'corrects_valuation_id', corrects_valuation_id)
     from public.portfolio_valuations where id = v_val.id),
    v_reason);
end;
$$;

revoke all on function public.admin_approve_valuation(uuid, text) from public, anon;
grant execute on function public.admin_approve_valuation(uuid, text) to authenticated;

create or replace function public.admin_discard_valuation_draft(p_valuation_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor  uuid := private.require_admin();
  v_reason text := private.require_reason(p_reason);
  v_status public.valuation_status;
begin
  select status into v_status from public.portfolio_valuations where id = p_valuation_id for update;
  if not found then
    raise exception 'Valuation not found.' using errcode = 'no_data_found';
  end if;
  if v_status <> 'draft' then
    raise exception 'Only drafts can be discarded (this one is %).', v_status using errcode = 'check_violation';
  end if;
  update public.portfolio_valuations set status = 'discarded', discarded_at = clock_timestamp()
  where id = p_valuation_id;
  perform private.write_audit('valuation.discarded', 'valuation', p_valuation_id,
    jsonb_build_object('status', 'draft'), jsonb_build_object('status', 'discarded'), v_reason);
end;
$$;

revoke all on function public.admin_discard_valuation_draft(uuid, text) from public, anon;
grant execute on function public.admin_discard_valuation_draft(uuid, text) to authenticated;
