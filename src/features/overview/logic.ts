import { describeContributionEntry } from '@/features/contributions/logic';
import { describeCycleEntry } from '@/features/cycles/logic';
import { describeEntry as describeProfileEntry } from '@/features/clients/history';
import type { LotAccrual } from '@/features/fees/api';
import { describeNavEntry } from '@/features/nav/logic';
import { describeValuationEntry } from '@/features/portfolio/logic';
import { Decimal, toDecimal } from '@/lib/finance';
import type { ActivityEntry } from './api';

/** Plain-language sentence for any audit entry, using each feature's own wording. */
export function describeActivity(e: ActivityEntry): string {
  if (e.action === 'fees.crystallised') return 'Final indicative fee recorded at cycle close';
  if (e.action === 'maintenance.demo_data_removed') {
    return 'Fictional demo financial data removed by the project owner (user accounts kept)';
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
  grossPnl: Decimal;
  netPnl: Decimal;
  /** Fraction of contributed capital, e.g. 0.05 = +5%. Null when nothing contributed. */
  grossReturn: Decimal | null;
  netReturn: Decimal | null;
}

/**
 * Aggregate unrealised P/L at a published NAV from the server's per-lot figures, so capital and value
 * refer to exactly the same lots and the same as-of time. Display-only aggregation.
 */
export function unrealisedPnl(lots: LotAccrual[]): UnrealisedPnl {
  const zero = new Decimal(0);
  const contributed = lots.reduce((s, l) => s.plus(toDecimal(l.contributed_amount)), zero);
  const grossValue = lots.reduce((s, l) => s.plus(toDecimal(l.gross_value)), zero);
  const netValue = lots.reduce((s, l) => s.plus(toDecimal(l.net_value)), zero);
  const grossPnl = grossValue.minus(contributed);
  const netPnl = netValue.minus(contributed);
  const pct = (v: Decimal) => (contributed.isZero() ? null : v.dividedBy(contributed).toDecimalPlaces(6));
  return {
    contributed,
    grossValue,
    netValue,
    grossPnl,
    netPnl,
    grossReturn: pct(grossPnl),
    netReturn: pct(netPnl),
  };
}
