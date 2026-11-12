import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { auditKeys } from '@/features/audit/api';
import { contributionKeys } from '@/features/contributions/queries';
import { isUuid } from '@/lib/utils/uuid';
import { calculateNav, discardNavDraft, getSnapshot, listSnapshots, publishNav } from './api';

export const navKeys = {
  all: ['nav'] as const,
  list: (cycleId: string) => ['nav', 'list', cycleId] as const,
  detail: (id: string) => ['nav', 'detail', id] as const,
};

/** Publishing changes the NAV used for future unit issuance, so contribution previews refresh too. */
const refresh = (qc: QueryClient) =>
  Promise.all([
    qc.invalidateQueries({ queryKey: navKeys.all }),
    qc.invalidateQueries({ queryKey: contributionKeys.all }),
    qc.invalidateQueries({ queryKey: auditKeys.all }),
  ]);

export function useNavSnapshots(cycleId: string) {
  return useQuery({
    queryKey: navKeys.list(cycleId),
    queryFn: () => listSnapshots(cycleId),
    enabled: isUuid(cycleId),
  });
}

export function useNavSnapshot(id: string) {
  return useQuery({ queryKey: navKeys.detail(id), queryFn: () => getSnapshot(id), enabled: isUuid(id) });
}

export function useCalculateNav() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ valuationId, correctsId }: { valuationId: string; correctsId: string | null }) =>
      calculateNav(valuationId, correctsId),
    onSuccess: () => refresh(qc),
  });
}

export function usePublishNav(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (reason: string) => publishNav(id, reason),
    onSuccess: () => refresh(qc),
  });
}

export function useDiscardNav(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (reason: string) => discardNavDraft(id, reason),
    onSuccess: () => refresh(qc),
  });
}
