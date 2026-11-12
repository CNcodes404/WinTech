import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { auditKeys } from '@/features/audit/api';
import { isUuid } from '@/lib/utils/uuid';
import {
  addFeeTerms,
  cancelFeeTerms,
  createCycle,
  getCycle,
  listCycles,
  listFeeTerms,
  setCycleStatus,
  updateCycle,
  type CycleInput,
} from './api';
import type { CycleStatus } from './types';

export const cycleKeys = {
  all: ['cycles'] as const,
  list: () => ['cycles', 'list'] as const,
  detail: (id: string) => ['cycles', 'detail', id] as const,
  feeTerms: (id: string) => ['cycles', 'fee-terms', id] as const,
};

const refresh = (qc: QueryClient) =>
  Promise.all([
    qc.invalidateQueries({ queryKey: cycleKeys.all }),
    qc.invalidateQueries({ queryKey: auditKeys.all }),
  ]);

export function useCycles() {
  return useQuery({ queryKey: cycleKeys.list(), queryFn: listCycles });
}

export function useCycle(id: string) {
  return useQuery({ queryKey: cycleKeys.detail(id), queryFn: () => getCycle(id), enabled: isUuid(id) });
}

export function useFeeTerms(id: string) {
  return useQuery({ queryKey: cycleKeys.feeTerms(id), queryFn: () => listFeeTerms(id), enabled: isUuid(id) });
}

export function useCreateCycle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CycleInput & { feeRate: string }) => createCycle(input),
    onSuccess: () => refresh(qc),
  });
}

export function useUpdateCycle(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CycleInput & { reason: string }) => updateCycle(id, input),
    onSuccess: () => refresh(qc),
  });
}

export function useSetCycleStatus(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ status, reason }: { status: CycleStatus; reason: string }) =>
      setCycleStatus(id, status, reason),
    onSuccess: () => refresh(qc),
  });
}

export function useAddFeeTerms(cycleId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { feeRate: string; effectiveFrom: string | null; reason: string }) =>
      addFeeTerms(cycleId, v.feeRate, v.effectiveFrom, v.reason),
    onSuccess: () => refresh(qc),
  });
}

export function useCancelFeeTerms() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ termsId, reason }: { termsId: string; reason: string }) => cancelFeeTerms(termsId, reason),
    onSuccess: () => refresh(qc),
  });
}
