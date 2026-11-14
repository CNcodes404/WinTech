import { supabase } from '@/lib/supabase/client';
import { numericParam, toUserFacingDbError } from '@/lib/supabase/errors';
import type { CycleOverview, CycleStatus, FeeTerms } from './types';

/** Admin-only (RLS). All writes go through audited SECURITY DEFINER functions. */

const OVERVIEW_COLUMNS = [
  'id',
  'name',
  'description',
  'start_date',
  'end_date',
  'status',
  'base_nav::text',
  'currency',
  'created_at',
  'updated_at',
  'current_fee_rate::text',
  'current_fee_version',
  'current_fee_effective_from',
  'pending_fee_rate::text',
  'pending_fee_version',
  'pending_fee_effective_from',
  'admin_fee_amount::text',
].join(', ');

export async function listCycles(): Promise<CycleOverview[]> {
  const { data, error } = await supabase
    .from('cycle_overview')
    .select(OVERVIEW_COLUMNS)
    .order('start_date', { ascending: false })
    .order('name', { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as CycleOverview[];
}

export async function getCycle(id: string): Promise<CycleOverview | null> {
  const { data, error } = await supabase
    .from('cycle_overview')
    .select(OVERVIEW_COLUMNS)
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data as unknown as CycleOverview | null;
}

export async function listFeeTerms(cycleId: string): Promise<FeeTerms[]> {
  const { data, error } = await supabase
    .from('cycle_fee_terms')
    .select(
      'id, version, performance_fee_rate::text, fee_policy, effective_from, reason, created_at, cancelled_at, cancel_reason, creator:profiles!cycle_fee_terms_created_by_fkey(full_name, email)',
    )
    .eq('cycle_id', cycleId)
    .order('version', { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as FeeTerms[];
}

export interface CycleInput {
  name: string;
  description: string;
  startDate: string;
  endDate: string;
  /** Decimal string, e.g. "100". */
  baseNav: string;
}

export async function createCycle(
  input: CycleInput & { feeRate: string; adminFee: string },
): Promise<string> {
  const { data, error } = await supabase.rpc('admin_create_cycle', {
    p_name: input.name,
    p_description: input.description,
    p_start_date: input.startDate,
    p_end_date: input.endDate,
    p_base_nav: numericParam(input.baseNav),
    p_fee_rate: numericParam(input.feeRate),
    p_admin_fee: numericParam(input.adminFee),
  });
  if (error) throw toUserFacingDbError(error, 'The cycle could not be created. Please try again.');
  return data as string;
}

/** Flat ₹ admin fee per client for this cycle. Editable until the cycle is settled (audited). */
export async function setAdminFee(cycleId: string, amount: string, reason: string): Promise<void> {
  const { error } = await supabase.rpc('admin_set_admin_fee', {
    p_cycle_id: cycleId,
    p_amount: numericParam(amount),
    p_reason: reason,
  });
  if (error) throw toUserFacingDbError(error);
}

export async function updateCycle(id: string, input: CycleInput & { reason: string }): Promise<void> {
  const { error } = await supabase.rpc('admin_update_cycle', {
    p_cycle_id: id,
    p_name: input.name,
    p_description: input.description,
    p_start_date: input.startDate,
    p_end_date: input.endDate,
    p_base_nav: numericParam(input.baseNav),
    p_reason: input.reason,
  });
  if (error) throw toUserFacingDbError(error);
}

export async function setCycleStatus(id: string, status: CycleStatus, reason: string): Promise<void> {
  const { error } = await supabase.rpc('admin_set_cycle_status', {
    p_cycle_id: id,
    p_status: status,
    p_reason: reason,
  });
  if (error) throw toUserFacingDbError(error);
}

/** effectiveFrom: ISO timestamp, or null for "immediately". */
export async function addFeeTerms(
  cycleId: string,
  feeRate: string,
  effectiveFrom: string | null,
  reason: string,
): Promise<void> {
  const { error } = await supabase.rpc('admin_add_fee_terms', {
    p_cycle_id: cycleId,
    p_fee_rate: numericParam(feeRate),
    // null = effective immediately (server time).
    p_effective_from: effectiveFrom as string,
    p_reason: reason,
  });
  if (error) throw toUserFacingDbError(error);
}

export async function cancelFeeTerms(termsId: string, reason: string): Promise<void> {
  const { error } = await supabase.rpc('admin_cancel_fee_terms', { p_terms_id: termsId, p_reason: reason });
  if (error) throw toUserFacingDbError(error);
}
