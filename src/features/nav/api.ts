import { supabase } from '@/lib/supabase/client';
import { toUserFacingDbError } from '@/lib/supabase/errors';
import type { NavSnapshot } from './types';

/** Admin-only (RLS). NAV is calculated and published by Postgres functions only. */

const COLUMNS = [
  'id',
  'cycle_id',
  'valuation_id',
  'nav_date',
  'total_outstanding_units::text',
  'gross_net_asset_value::text',
  'gross_nav_per_unit::text',
  'net_nav_per_unit::text',
  'performance_fee_amount::text',
  'calculation_version',
  'status',
  'corrects_snapshot_id',
  'corrected_by_snapshot_id',
  'calculated_at',
  'published_at',
  'publish_reason',
  'corrected_at',
].join(', ');

export async function listSnapshots(cycleId: string): Promise<NavSnapshot[]> {
  const { data, error } = await supabase
    .from('nav_snapshots')
    .select(COLUMNS)
    .eq('cycle_id', cycleId)
    .neq('status', 'discarded')
    .order('nav_date', { ascending: false })
    .order('calculated_at', { ascending: false })
    .limit(500);
  if (error) throw error;
  return (data ?? []) as unknown as NavSnapshot[];
}

export async function getSnapshot(id: string): Promise<NavSnapshot | null> {
  const { data, error } = await supabase.from('nav_snapshots').select(COLUMNS).eq('id', id).maybeSingle();
  if (error) throw error;
  return data as unknown as NavSnapshot | null;
}

export async function calculateNav(valuationId: string, correctsId: string | null): Promise<string> {
  const { data, error } = await supabase.rpc('admin_calculate_nav', {
    p_valuation_id: valuationId,
    p_corrects_snapshot_id: (correctsId ?? undefined) as string | undefined,
  });
  if (error) throw toUserFacingDbError(error, 'NAV could not be calculated. Please try again.');
  return data as string;
}

export async function publishNav(id: string, reason: string): Promise<void> {
  const { error } = await supabase.rpc('admin_publish_nav', { p_snapshot_id: id, p_reason: reason });
  if (error) throw toUserFacingDbError(error);
}

export async function discardNavDraft(id: string, reason: string): Promise<void> {
  const { error } = await supabase.rpc('admin_discard_nav_draft', { p_snapshot_id: id, p_reason: reason });
  if (error) throw toUserFacingDbError(error);
}
