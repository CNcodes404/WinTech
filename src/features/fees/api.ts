import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { auditKeys } from '@/features/audit/api';
import { supabase } from '@/lib/supabase/client';
import { toUserFacingDbError } from '@/lib/supabase/errors';
import { isUuid } from '@/lib/utils/uuid';

/** Admin-only (RLS). Accruals are computed by Postgres when a NAV snapshot is created. */

export interface LotAccrual {
  id: string;
  snapshot_id: string;
  client_id: string;
  client_name: string;
  client_email: string;
  contribution_id: string;
  received_at: string;
  contributed_amount: string;
  units: string;
  entry_nav: string;
  reference_hwm: string;
  fee_rate: string;
  gross_nav_per_unit: string;
  gross_value: string;
  eligible_profit_per_unit: string;
  fee_amount: string;
  net_value: string;
  loss_to_recover: string;
}

/** Per-client position at a fund_level_v2 NAV snapshot (view client_position_report, admin only). */
export interface ClientPosition {
  snapshot_id: string;
  client_id: string;
  client_name: string;
  client_email: string;
  units: string;
  contributed: string;
  gross_nav_per_unit: string;
  net_nav_per_unit: string;
  gross_value: string;
  net_value: string;
  performance_fee_share: string;
  profit: string;
  admin_fee: string;
  final_profit: string;
  final_value: string;
}

export interface Crystallisation {
  id: string;
  snapshot_id: string;
  total_fee_amount: string;
  net_nav_per_unit: string;
  admin_fee_per_client: string;
  clients_charged: number;
  admin_fee_total: string;
  note: string;
  recorded_at: string;
}

const POSITION_COLUMNS = [
  'snapshot_id',
  'client_id',
  'client_name',
  'client_email',
  'units::text',
  'contributed::text',
  'gross_nav_per_unit::text',
  'net_nav_per_unit::text',
  'gross_value::text',
  'net_value::text',
  'performance_fee_share::text',
  'profit::text',
  'admin_fee::text',
  'final_profit::text',
  'final_value::text',
].join(', ');

export async function listPositions(snapshotId: string): Promise<ClientPosition[]> {
  const { data, error } = await supabase
    .from('client_position_report')
    .select(POSITION_COLUMNS)
    .eq('snapshot_id', snapshotId)
    .order('client_name');
  if (error) throw error;
  return (data ?? []) as unknown as ClientPosition[];
}

const ACCRUAL_COLUMNS = [
  'id',
  'snapshot_id',
  'client_id',
  'client_name',
  'client_email',
  'contribution_id',
  'received_at',
  'contributed_amount::text',
  'units::text',
  'entry_nav::text',
  'reference_hwm::text',
  'fee_rate::text',
  'gross_nav_per_unit::text',
  'gross_value::text',
  'eligible_profit_per_unit::text',
  'fee_amount::text',
  'net_value::text',
  'loss_to_recover::text',
].join(', ');

export async function listLotAccruals(snapshotId: string): Promise<LotAccrual[]> {
  const { data, error } = await supabase
    .from('lot_fee_accrual_report')
    .select(ACCRUAL_COLUMNS)
    .eq('snapshot_id', snapshotId)
    .order('client_name')
    .order('received_at');
  if (error) throw error;
  return (data ?? []) as unknown as LotAccrual[];
}

export async function getCrystallisation(cycleId: string): Promise<Crystallisation | null> {
  const { data, error } = await supabase
    .from('fee_crystallisations')
    .select(
      'id, snapshot_id, total_fee_amount::text, net_nav_per_unit::text, admin_fee_per_client::text, clients_charged, admin_fee_total::text, note, recorded_at',
    )
    .eq('cycle_id', cycleId)
    .maybeSingle();
  if (error) throw error;
  return data as unknown as Crystallisation | null;
}

export async function recordCrystallisation(cycleId: string, note: string): Promise<void> {
  const { error } = await supabase.rpc('admin_record_fee_crystallisation', {
    p_cycle_id: cycleId,
    p_note: note,
  });
  if (error) throw toUserFacingDbError(error);
}

export const feeKeys = {
  all: ['fees'] as const,
  lots: (snapshotId: string) => ['fees', 'lots', snapshotId] as const,
  positions: (snapshotId: string) => ['fees', 'positions', snapshotId] as const,
  crystallisation: (cycleId: string) => ['fees', 'crystallisation', cycleId] as const,
};

export function useLotAccruals(snapshotId: string) {
  return useQuery({
    queryKey: feeKeys.lots(snapshotId),
    queryFn: () => listLotAccruals(snapshotId),
    enabled: isUuid(snapshotId),
  });
}

export function usePositions(snapshotId: string) {
  return useQuery({
    queryKey: feeKeys.positions(snapshotId),
    queryFn: () => listPositions(snapshotId),
    enabled: isUuid(snapshotId),
  });
}

export function useCrystallisation(cycleId: string) {
  return useQuery({
    queryKey: feeKeys.crystallisation(cycleId),
    queryFn: () => getCrystallisation(cycleId),
    enabled: isUuid(cycleId),
  });
}

export function useRecordCrystallisation(cycleId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (note: string) => recordCrystallisation(cycleId, note),
    onSuccess: () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: feeKeys.all }),
        qc.invalidateQueries({ queryKey: auditKeys.all }),
      ]),
  });
}
