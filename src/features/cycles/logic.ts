import type { AuditEntry } from '@/features/audit/api';
import { jsonObject } from '@/features/audit/api';
import { formatDate, formatDateTime, formatNav, formatRateAsPercent } from '@/lib/format';
import type { FeeTerms, FeeTermsState } from './types';
import { STATUS_LABEL, type CycleStatus } from './types';

/** Classify each version relative to `now`: the latest effective one is current. */
export function classifyFeeTerms(terms: FeeTerms[], now: Date = new Date()): Map<string, FeeTermsState> {
  const result = new Map<string, FeeTermsState>();
  const effective = terms
    .filter((t) => !t.cancelled_at && new Date(t.effective_from) <= now)
    .sort((a, b) => new Date(b.effective_from).getTime() - new Date(a.effective_from).getTime());
  const currentId = effective[0]?.id;
  for (const t of terms) {
    if (t.cancelled_at) result.set(t.id, 'cancelled');
    else if (new Date(t.effective_from) > now) result.set(t.id, 'scheduled');
    else result.set(t.id, t.id === currentId ? 'current' : 'superseded');
  }
  return result;
}

const pct = (v: unknown) => (typeof v === 'string' || typeof v === 'number' ? formatRateAsPercent(v) : '—');

/** Plain-language description of a cycle audit entry. */
export function describeCycleEntry(e: Pick<AuditEntry, 'action' | 'before_data' | 'after_data'>): string {
  const before = jsonObject(e.before_data);
  const after = jsonObject(e.after_data);
  switch (e.action) {
    case 'cycle.created':
      return `Cycle created (base NAV ${formatNav(String(after.base_nav ?? ''))})`;
    case 'cycle.status_changed':
      return `Status changed from ${STATUS_LABEL[before.status as CycleStatus] ?? before.status} to ${
        STATUS_LABEL[after.status as CycleStatus] ?? after.status
      }`;
    case 'cycle.updated': {
      const parts: string[] = [];
      if ('name' in after) parts.push(`name → “${String(after.name)}”`);
      if ('description' in after) parts.push('description');
      if ('start_date' in after) parts.push(`start date → ${formatDate(String(after.start_date))}`);
      if ('end_date' in after) parts.push(`end date → ${formatDate(String(after.end_date))}`);
      if ('base_nav' in after) parts.push(`base NAV → ${formatNav(String(after.base_nav))}`);
      return parts.length ? `Updated ${parts.join(', ')}` : 'Cycle updated';
    }
    case 'fee_terms.created':
      return after.version === 1
        ? `Fee rate set to ${pct(after.performance_fee_rate)} (version 1)`
        : `Fee rate ${pct(after.performance_fee_rate)} added as version ${String(after.version)}, effective ${formatDateTime(String(after.effective_from))}`;
    case 'fee_terms.cancelled':
      return `Scheduled fee change to ${pct(before.performance_fee_rate)} (version ${String(before.version)}) cancelled`;
    default:
      return e.action;
  }
}
