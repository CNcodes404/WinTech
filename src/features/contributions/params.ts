import { isUuid } from '@/lib/utils/uuid';
import type { ContributionListParams, ContributionStatusFilter } from './types';

export const DEFAULT_CONTRIBUTION_PARAMS: ContributionListParams = {
  q: '',
  status: 'all',
  cycle: '',
  page: 1,
};

const STATUSES: ContributionStatusFilter[] = ['all', 'pending', 'verified', 'rejected', 'reversed'];

export function parseContributionParams(sp: URLSearchParams): ContributionListParams {
  const status = sp.get('status') as ContributionStatusFilter | null;
  const cycle = sp.get('cycle') ?? '';
  const page = Number.parseInt(sp.get('page') ?? '1', 10);
  return {
    q: (sp.get('q') ?? '').slice(0, 100),
    status: status && STATUSES.includes(status) ? status : 'all',
    cycle: isUuid(cycle) ? cycle : '',
    page: Number.isFinite(page) && page > 0 ? Math.min(page, 10_000) : 1,
  };
}

export function toContributionSearchParams(p: ContributionListParams): URLSearchParams {
  const sp = new URLSearchParams();
  if (p.q) sp.set('q', p.q);
  if (p.status !== 'all') sp.set('status', p.status);
  if (p.cycle) sp.set('cycle', p.cycle);
  if (p.page !== 1) sp.set('page', String(p.page));
  return sp;
}
