import { describeContributionEntry } from '@/features/contributions/logic';
import { describeCycleEntry } from '@/features/cycles/logic';
import { describeEntry as describeProfileEntry } from '@/features/clients/history';
import type { ClientPosition } from '@/features/fees/api';
import { describeNavEntry } from '@/features/nav/logic';
import { describeValuationEntry } from '@/features/portfolio/logic';
import { Decimal, toDecimal } from '@/lib/finance';
import type { ActivityEntry } from './api';

/** Plain-language sentence for any audit entry, using each feature's own wording. */
export function describeActivity(e: ActivityEntry): string {
  if (e.action === 'fees.crystallised') return 'Final fees recorded at cycle close';
  if (e.action === 'maintenance.demo_data_removed') {
    return 'Fictional demo financial data removed by the project owner (user accounts kept)';
  }
  if (e.action === 'maintenance.data_reset') {
    return 'All data erased for a fresh start (user accounts kept)';
  }
  switch (e.entity_type) {
    case 'profile':
      return describeProfileEntry(e);
    case 'cycle':
      return describeCycleEntry(e);
    case 'contribution':
      return describeContributionEntry(e);
    case 'valuation':
      return describeValuationEntry(e);
    case 'nav_snapshot':
      return describeNavEntry(e);
    default:
      return e.action;
  }
}

/** Where an audit entry's entity lives in the admin UI. */
export function activityLink(e: ActivityEntry): string | null {
  if (!e.entity_id) return null;
  switch (e.entity_type) {
    case 'profile':
      return `/admin/clients/${e.entity_id}`;
    case 'cycle':
      return `/admin/cycles/${e.entity_id}`;
    case 'contribution':
      return `/admin/contributions/${e.entity_id}`;
    case 'valuation':
      return `/admin/portfolio/valuations/${e.entity_id}`;
    case 'nav_snapshot':
      return `/admin/nav/snapshots/${e.entity_id}`;
    default:
      return null;
  }
}

export interface UnrealisedPnl {
  contributed: Decimal;
  grossValue: Decimal;
  netValue: Decimal;
  adminFees: Decimal;
  /** Before any fee (market value − invested). */
  grossPnl: Decimal;
  /** After the performance fee (what clients see as profit). */
  netPnl: Decimal;
  /** After the performance fee and admin fees (clients' final profit). */
  finalPnl: Decimal;
  /** Fraction of contributed capital, e.g. 0.05 = +5%. Null when nothing contributed. */
  grossReturn: Decimal | null;
  finalReturn: Decimal | null;
}

/**
 * Aggregate unrealised P/L at a published NAV from the server's per-client positions, so capital and
 * value refer to exactly the same units and the same as-of time. Display-only aggregation.
 */
export function unrealisedPnl(positions: ClientPosition[]): UnrealisedPnl {
  const zero = new Decimal(0);
  const sum = (f: (p: ClientPosition) => string) => positions.reduce((s, p) => s.plus(toDecimal(f(p))), zero);
  const contributed = sum((p) => p.contributed);
  const grossValue = sum((p) => p.gross_value);
  const netValue = sum((p) => p.net_value);
  const adminFees = sum((p) => p.admin_fee);
  const grossPnl = grossValue.minus(contributed);
  const netPnl = netValue.minus(contributed);
  const finalPnl = netPnl.minus(adminFees);
  const pct = (v: Decimal) => (contributed.isZero() ? null : v.dividedBy(contributed).toDecimalPlaces(6));
  return {
    contributed,
    grossValue,
    netValue,
    adminFees,
    grossPnl,
    netPnl,
    finalPnl,
    grossReturn: pct(grossPnl),
    finalReturn: pct(finalPnl),
  };
}
