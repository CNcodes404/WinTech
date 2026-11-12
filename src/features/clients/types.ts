import type { ProfileStatus } from '@/features/auth/types';

export interface ClientRow {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  status: ProfileStatus;
  created_at: string;
}

export interface ClientDetail extends ClientRow {
  updated_at: string;
}

export type ClientStatusFilter = 'all' | ProfileStatus;
export type ClientSort = 'name' | 'created';
export type SortDir = 'asc' | 'desc';

export interface ClientListParams {
  q: string;
  status: ClientStatusFilter;
  sort: ClientSort;
  dir: SortDir;
  page: number;
}

export const CLIENTS_PAGE_SIZE = 20;
