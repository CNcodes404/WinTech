import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query';
import { auditKeys } from '@/features/audit/api';
import { cycleKeys } from '@/features/cycles/queries';
import { isUuid } from '@/lib/utils/uuid';
import {
  getContribution,
  getCycleUnitSummary,
  listActiveClientOptions,
  listClientHoldings,
  listContributions,
  listOpenCycleOptions,
  previewVerification,
  recordContribution,
  rejectContribution,
  reverseContribution,
  verifyContribution,
  type RecordContributionParams,
} from './api';
import type { ContributionListParams } from './types';

export const contributionKeys = {
  all: ['contributions'] as const,
  list: (p: ContributionListParams & { clientId?: string }) => ['contributions', 'list', p] as const,
  detail: (id: string) => ['contributions', 'detail', id] as const,
  preview: (id: string) => ['contributions', 'preview', id] as const,
  cycleSummary: (cycleId: string) => ['contributions', 'cycle-summary', cycleId] as const,
  holdings: (clientId: string) => ['contributions', 'holdings', clientId] as const,
  clientOptions: () => ['contributions', 'client-options'] as const,
  cycleOptions: () => ['contributions', 'cycle-options'] as const,
};

/** Any financial change can affect lists, summaries, holdings, cycles and audit history. */
const refresh = (qc: QueryClient) =>
  Promise.all([
    qc.invalidateQueries({ queryKey: contributionKeys.all }),
    qc.invalidateQueries({ queryKey: cycleKeys.all }),
    qc.invalidateQueries({ queryKey: auditKeys.all }),
  ]);

export function useContributionList(params: ContributionListParams & { clientId?: string }) {
  return useQuery({
    queryKey: contributionKeys.list(params),
    queryFn: () => listContributions(params),
    placeholderData: keepPreviousData,
  });
}

export function useContribution(id: string) {
  return useQuery({
    queryKey: contributionKeys.detail(id),
    queryFn: () => getContribution(id),
    enabled: isUuid(id),
  });
}

export function useVerificationPreview(id: string, enabled: boolean) {
  return useQuery({
    queryKey: contributionKeys.preview(id),
    queryFn: () => previewVerification(id),
    enabled: enabled && isUuid(id),
    staleTime: 0,
    gcTime: 0,
  });
}

export function useCycleUnitSummary(cycleId: string) {
  return useQuery({
    queryKey: contributionKeys.cycleSummary(cycleId),
    queryFn: () => getCycleUnitSummary(cycleId),
    enabled: isUuid(cycleId),
  });
}

export function useClientHoldings(clientId: string) {
  return useQuery({
    queryKey: contributionKeys.holdings(clientId),
    queryFn: () => listClientHoldings(clientId),
    enabled: isUuid(clientId),
  });
}

export function useRecordFormOptions(enabled: boolean) {
  const clients = useQuery({
    queryKey: contributionKeys.clientOptions(),
    queryFn: listActiveClientOptions,
    enabled,
  });
  const cycles = useQuery({
    queryKey: contributionKeys.cycleOptions(),
    queryFn: listOpenCycleOptions,
    enabled,
  });
  return { clients, cycles };
}

export function useRecordContribution() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (p: RecordContributionParams) => recordContribution(p),
    onSuccess: () => refresh(qc),
  });
}

export function useVerifyContribution(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (reason: string) => verifyContribution(id, reason),
    onSuccess: () => refresh(qc),
  });
}

export function useRejectContribution(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (reason: string) => rejectContribution(id, reason),
    onSuccess: () => refresh(qc),
  });
}

export function useReverseContribution(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (reason: string) => reverseContribution(id, reason),
    onSuccess: () => refresh(qc),
  });
}
