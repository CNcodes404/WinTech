import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query';
import {
  createClientAccount,
  setUserStatus,
  type CreateClientAccountInput,
} from '@/features/admin-accounts/api';
import { auditKeys } from '@/features/audit/api';
import type { ProfileStatus } from '@/features/auth/types';
import { isUuid } from '@/lib/utils/uuid';
import { getClient, listClients, updateClientContact } from './api';
import type { ClientListParams } from './types';

export { isUuid };

export const clientKeys = {
  all: ['clients'] as const,
  list: (p: ClientListParams) => ['clients', 'list', p] as const,
  detail: (id: string) => ['clients', 'detail', id] as const,
};

const refreshClients = (qc: QueryClient) =>
  Promise.all([
    qc.invalidateQueries({ queryKey: clientKeys.all }),
    qc.invalidateQueries({ queryKey: auditKeys.all }),
  ]);

export function useClientList(params: ClientListParams) {
  return useQuery({
    queryKey: clientKeys.list(params),
    queryFn: () => listClients(params),
    placeholderData: keepPreviousData,
  });
}

export function useClient(id: string) {
  return useQuery({ queryKey: clientKeys.detail(id), queryFn: () => getClient(id), enabled: isUuid(id) });
}

export function useCreateClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateClientAccountInput) => createClientAccount(input),
    onSuccess: () => refreshClients(qc),
  });
}

export function useUpdateClientContact(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (values: { fullName: string; phone: string }) => updateClientContact(id, values),
    onSuccess: () => refreshClients(qc),
  });
}

export function useSetClientStatus(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ status, reason }: { status: ProfileStatus; reason: string }) =>
      setUserStatus(id, status, reason),
    onSuccess: () => refreshClients(qc),
  });
}
