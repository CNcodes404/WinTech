import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { auditKeys } from '@/features/audit/api';
import { isUuid } from '@/lib/utils/uuid';
import {
  approveValuation,
  discardValuationDraft,
  getValuation,
  listValuations,
  saveValuationDraft,
  type SaveDraftParams,
} from './api';

export const valuationKeys = {
  all: ['valuations'] as const,
  list: (cycleId: string) => ['valuations', 'list', cycleId] as const,
  detail: (id: string) => ['valuations', 'detail', id] as const,
};

const refresh = (qc: QueryClient) =>
  Promise.all([
    qc.invalidateQueries({ queryKey: valuationKeys.all }),
    qc.invalidateQueries({ queryKey: auditKeys.all }),
  ]);

export function useValuations(cycleId: string) {
  return useQuery({
    queryKey: valuationKeys.list(cycleId),
    queryFn: () => listValuations(cycleId),
    enabled: isUuid(cycleId),
  });
}

export function useValuation(id: string) {
  return useQuery({
    queryKey: valuationKeys.detail(id),
    queryFn: () => getValuation(id),
    enabled: isUuid(id),
  });
}

export function useSaveValuationDraft() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (p: SaveDraftParams) => saveValuationDraft(p),
    onSuccess: () => refresh(qc),
  });
}

export function useApproveValuation(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (reason: string) => approveValuation(id, reason),
    onSuccess: () => refresh(qc),
  });
}

export function useDiscardValuation(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (reason: string) => discardValuationDraft(id, reason),
    onSuccess: () => refresh(qc),
  });
}
