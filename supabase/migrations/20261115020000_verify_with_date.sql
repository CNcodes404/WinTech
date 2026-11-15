-- =============================================================================
-- Verification date (owner request, 15 Nov 2026)
--
-- admin_verify_contribution gains an optional p_verified_at. Units join the pool at that time
-- (ledger created_at = verified_at), so demos and late paperwork can be recorded on the right day.
-- Safeguards (published history never changes):
--   * not before the money was received, not in the future;
--   * strictly after the cycle's latest published NAV, so no published NAV's units change;
--   * NULL = now (unchanged behaviour).
-- The NAV used is still the latest NAV dated before the day the money was RECEIVED.
-- The real time of the click is kept in the audit entry (recorded_at).
-- =============================================================================

drop function public.admin_verify_contribution(uuid, text);

create function public.admin_verify_contribution(
  p_contribution_id uuid,
  p_reason          text,
  p_verified_at     timestamptz default null
)
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
  v_at     timestamptz := coalesce(p_verified_at, clock_timestamp());
  v_latest timestamptz;
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

  if v_at > v_now + interval '5 minutes' then
    raise exception 'The verification date cannot be in the future.' using errcode = 'invalid_parameter_value';
  end if;
  if v_at < v_c.received_at then
    raise exception 'The verification date cannot be before the money was received (%).',
      to_char(v_c.received_at at time zone 'Asia/Kolkata', 'DD Mon YYYY HH24:MI') using errcode = 'invalid_parameter_value';
  end if;
  v_at := least(v_at, v_now);

  select max(nav_date) into v_latest from public.nav_snapshots
  where cycle_id = v_c.cycle_id and status in ('published', 'corrected');
  if v_latest is not null and v_at <= v_latest then
    raise exception 'The verification date must be after the latest published NAV (%), so published NAVs stay unchanged.',
      to_char(v_latest at time zone 'Asia/Kolkata', 'DD Mon YYYY HH24:MI') using errcode = 'invalid_parameter_value';
  end if;

  v_nav := private.applicable_nav(v_c.cycle_id, v_c.received_at);
  if v_nav is null or v_nav <= 0 then
    raise exception 'No applicable NAV is available for this cycle.' using errcode = 'check_violation';
  end if;
  v_terms := coalesce(
    private.fee_terms_at(v_c.cycle_id, v_at),
    (select t from public.cycle_fee_terms t
      where t.cycle_id = v_c.cycle_id and t.cancelled_at is null order by t.effective_from limit 1)
  );
  if v_terms.id is null then
    raise exception 'No fee terms are in force for this cycle.' using errcode = 'check_violation';
  end if;
  v_units := private.units_for(v_c.amount, v_nav);
  if v_units <= 0 then
    raise exception 'The amount is too small to issue any units at NAV %.', v_nav using errcode = 'check_violation';
  end if;

  update public.contributions
  set status = 'verified', verified_by = v_actor, verified_at = v_at,
      applicable_nav = v_nav, units_issued = v_units
  where id = v_c.id;

  insert into public.client_unit_allocations
    (cycle_id, client_id, contribution_id, entry_type, units, amount, entry_nav, reference_hwm,
     loss_carry_forward, fee_rate, fee_terms_id, created_by, created_at)
  values
    (v_c.cycle_id, v_c.client_id, v_c.id, 'issue', v_units, v_c.amount, v_nav, v_nav,
     0, v_terms.performance_fee_rate, v_terms.id, v_actor, v_at);

  perform private.write_audit(
    'contribution.verified', 'contribution', v_c.id,
    jsonb_build_object('status', 'pending'),
    jsonb_build_object('status', 'verified', 'amount', v_c.amount::text, 'applicable_nav', v_nav::text,
                       'units_issued', v_units::text, 'verified_at', v_at, 'recorded_at', v_now,
                       'fee_rate', v_terms.performance_fee_rate::text, 'fee_terms_version', v_terms.version),
    v_reason
  );

  return query select v_nav::text, v_units::text, v_terms.performance_fee_rate::text;
end;
$$;

revoke all on function public.admin_verify_contribution(uuid, text, timestamptz) from public, anon;
grant execute on function public.admin_verify_contribution(uuid, text, timestamptz) to authenticated;
