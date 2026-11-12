import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createClientAccount,
  setUserStatus,
  type CreateClientAccountInput,
} from '@/features/admin-accounts/api';
import type { ProfileStatus } from '@/features/auth/types';
import { getClient, listClientHistory, listClients, updateClientContact } from './api';
import type { ClientListParams } from './types';

export const clientKeys = {
  all: ['clients'] as const,
  list: (p: ClientListParams) => ['clients', 'list', p] as const,
  detail: (id: string) => ['clients', 'detail', id] as const,
  history: (id: string) => ['clients', 'history', id] as const,
};

export function useClientList(params: ClientListParams) {
  return useQuery({
    queryKey: clientKeys.list(params),
    queryFn: () => listClients(params),
    placeholderData: keepPreviousData,
  });
}

export const isUuid = (v: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

export function useClient(id: string) {
  return useQuery({ queryKey: clientKeys.detail(id), queryFn: () => getClient(id), enabled: isUuid(id) });
}

export function useClientHistory(id: string) {
  return useQuery({ queryKey: clientKeys.history(id), queryFn: () => listClientHistory(id) });
}

export function useCreateClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateClientAccountInput) => createClientAccount(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: clientKeys.all }),
  });
}

export function useUpdateClientContact(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (values: { fullName: string; phone: string }) => updateClientContact(id, values),
    onSuccess: () => qc.invalidateQueries({ queryKey: clientKeys.all }),
  });
}

export function useSetClientStatus(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ status, reason }: { status: ProfileStatus; reason: string }) =>
      setUserStatus(id, status, reason),
    onSuccess: () => qc.invalidateQueries({ queryKey: clientKeys.all }),
  });
}
