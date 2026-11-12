import { supabase } from '@/lib/supabase/client';
import { numericParam, toUserFacingDbError } from '@/lib/supabase/errors';
import { ilikeAny } from '@/lib/supabase/search';
import {
  CONTRIBUTIONS_PAGE_SIZE,
  type ClientHolding,
  type ContributionListParams,
  type ContributionMethod,
  type ContributionRow,
  type CycleUnitSummary,
  type VerificationPreview,
} from './types';

/**
 * Admin-only (RLS). Official units/NAV are computed by Postgres on verification; nothing here
 * calculates them. NUMERIC columns are selected as text.
 */

const REGISTER_COLUMNS = [
  'id',
  'cycle_id',
  'cycle_name',
  'cycle_status',
  'client_id',
  'client_name',
  'client_email',
  'amount::text',
  'received_at',
  'method',
  'reference_number',
  'notes',
  'status',
  'applicable_nav::text',
  'units_issued::text',
  'verified_at',
  'rejected_at',
  'rejection_reason',
  'reversed_at',
  'reversal_reason',
  'locked_fee_rate::text',
  'reference_hwm::text',
  'created_at',
].join(', ');

export async function listContributions(
  p: ContributionListParams & { clientId?: string },
): Promise<{ rows: ContributionRow[]; total: number }> {
  let q = supabase.from('contribution_register').select(REGISTER_COLUMNS, { count: 'exact' });
  if (p.status !== 'all') q = q.eq('status', p.status);
  if (p.cycle) q = q.eq('cycle_id', p.cycle);
  if (p.clientId) q = q.eq('client_id', p.clientId);
  const or = ilikeAny(['client_name', 'client_email', 'reference_number'], p.q);
  if (or) q = q.or(or);

  const from = (p.page - 1) * CONTRIBUTIONS_PAGE_SIZE;
  const { data, error, count } = await q
    .order('received_at', { ascending: false })
    .order('id', { ascending: true })
    .range(from, from + CONTRIBUTIONS_PAGE_SIZE - 1);
  if (error) throw error;
  return { rows: (data ?? []) as unknown as ContributionRow[], total: count ?? 0 };
}

export async function getContribution(id: string): Promise<ContributionRow | null> {
  const { data, error } = await supabase
    .from('contribution_register')
    .select(REGISTER_COLUMNS)
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data as unknown as ContributionRow | null;
}

export interface RecordContributionParams {
  cycleId: string;
  clientId: string;
  amount: string;
  receivedAt: string; // ISO timestamp
  method: ContributionMethod;
  reference: string;
  notes: string;
}

export async function recordContribution(p: RecordContributionParams): Promise<string> {
  const { data, error } = await supabase.rpc('admin_record_contribution', {
    p_cycle_id: p.cycleId,
    p_client_id: p.clientId,
    p_amount: numericParam(p.amount),
    p_received_at: p.receivedAt,
    p_method: p.method,
    p_reference: p.reference,
    p_notes: p.notes,
  });
  if (error) throw toUserFacingDbError(error, 'The contribution could not be recorded. Please try again.');
  return data as string;
}

export async function previewVerification(id: string): Promise<VerificationPreview> {
  const { data, error } = await supabase.rpc('admin_preview_verification', { p_contribution_id: id });
  if (error) throw toUserFacingDbError(error, 'The verification preview could not be calculated.');
  const row = (data as unknown as VerificationPreview[] | null)?.[0];
  if (!row) throw new Error('The verification preview could not be calculated.');
  return row;
}

export async function verifyContribution(
  id: string,
  reason: string,
): Promise<{ units: string; applicable_nav: string }> {
  const { data, error } = await supabase.rpc('admin_verify_contribution', {
    p_contribution_id: id,
    p_reason: reason,
  });
  if (error) throw toUserFacingDbError(error, 'The contribution could not be verified. Nothing was changed.');
  const row = (data as unknown as { units: string; applicable_nav: string }[] | null)?.[0];
  return row ?? { units: '', applicable_nav: '' };
}

export async function rejectContribution(id: string, reason: string): Promise<void> {
  const { error } = await supabase.rpc('admin_reject_contribution', {
    p_contribution_id: id,
    p_reason: reason,
  });
  if (error) throw toUserFacingDbError(error);
}

export async function reverseContribution(id: string, reason: string): Promise<void> {
  const { error } = await supabase.rpc('admin_reverse_contribution', {
    p_contribution_id: id,
    p_reason: reason,
  });
  if (error) throw toUserFacingDbError(error);
}

export async function getCycleUnitSummary(cycleId: string): Promise<CycleUnitSummary | null> {
  const { data, error } = await supabase
    .from('cycle_unit_summary')
    .select(
      'cycle_id, outstanding_units::text, net_contributed::text, pending_count, pending_amount::text, investor_count',
    )
    .eq('cycle_id', cycleId)
    .maybeSingle();
  if (error) throw error;
  return data as unknown as CycleUnitSummary | null;
}

export async function listClientHoldings(clientId: string): Promise<ClientHolding[]> {
  const { data, error } = await supabase
    .from('client_cycle_holdings')
    .select(
      'cycle_id, cycle_name, cycle_status, units::text, net_contributed::text, lots_issued, lots_reversed',
    )
    .eq('client_id', clientId)
    .order('cycle_name');
  if (error) throw error;
  return (data ?? []) as unknown as ClientHolding[];
}

/** Options for the record form. */
export async function listActiveClientOptions(): Promise<{ id: string; full_name: string; email: string }[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, email')
    .eq('role', 'client')
    .eq('status', 'active')
    .order('full_name')
    .limit(1000);
  if (error) throw error;
  return data ?? [];
}

export async function listOpenCycleOptions(): Promise<
  { id: string; name: string; base_nav: string; status: string }[]
> {
  const { data, error } = await supabase
    .from('cycle_overview')
    .select('id, name, base_nav::text, status')
    .in('status', ['open', 'active'])
    .order('start_date', { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as { id: string; name: string; base_nav: string; status: string }[];
}
