import type { ClientListParams, ClientSort, ClientStatusFilter, SortDir } from './types';

export const DEFAULT_LIST_PARAMS: ClientListParams = {
  q: '',
  status: 'all',
  sort: 'name',
  dir: 'asc',
  page: 1,
};

/**
 * Make free text safe to embed in a PostgREST `or=(…)` filter: drop characters with syntactic
 * meaning there (, ( ) " \ * % :) and limit the length. The value is also double-quoted by the caller.
 */
export function sanitizeSearch(raw: string): string {
  return raw
    .replace(/[,()"\\*%:]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 100);
}

export function parseListParams(sp: URLSearchParams): ClientListParams {
  const status = sp.get('status');
  const sort = sp.get('sort');
  const dir = sp.get('dir');
  const page = Number.parseInt(sp.get('page') ?? '1', 10);
  return {
    q: (sp.get('q') ?? '').slice(0, 100),
    status: (['all', 'active', 'inactive'] as const).includes(status as ClientStatusFilter)
      ? (status as ClientStatusFilter)
      : 'all',
    sort: sort === 'created' ? ('created' satisfies ClientSort) : 'name',
    dir: dir === 'desc' ? ('desc' satisfies SortDir) : 'asc',
    page: Number.isFinite(page) && page > 0 ? Math.min(page, 10_000) : 1,
  };
}

/** Serialise only non-default values so URLs stay short and shareable. */
export function toSearchParams(p: ClientListParams): URLSearchParams {
  const sp = new URLSearchParams();
  if (p.q) sp.set('q', p.q);
  if (p.status !== DEFAULT_LIST_PARAMS.status) sp.set('status', p.status);
  if (p.sort !== DEFAULT_LIST_PARAMS.sort) sp.set('sort', p.sort);
  if (p.dir !== DEFAULT_LIST_PARAMS.dir) sp.set('dir', p.dir);
  if (p.page !== 1) sp.set('page', String(p.page));
  return sp;
}
