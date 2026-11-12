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

export interface Crystallisation {
  id: string;
  snapshot_id: string;
  total_fee_amount: string;
  net_nav_per_unit: string;
  note: string;
  recorded_at: string;
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
    .select('id, snapshot_id, total_fee_amount::text, net_nav_per_unit::text, note, recorded_at')
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
  crystallisation: (cycleId: string) => ['fees', 'crystallisation', cycleId] as const,
};

export function useLotAccruals(snapshotId: string) {
  return useQuery({
    queryKey: feeKeys.lots(snapshotId),
    queryFn: () => listLotAccruals(snapshotId),
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
