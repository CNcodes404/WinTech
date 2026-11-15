import { jsonObject, type AuditEntry } from '@/features/audit/api';
import { toDecimal, tryToDecimal } from '@/lib/finance';
import { formatDateTime, formatINR, formatNav, formatUnits } from '@/lib/format';
import { clientNav, type NavSnapshot } from './types';

const s = (v: unknown) => (v === null || v === undefined ? '' : String(v));

export function describeNavEntry(e: Pick<AuditEntry, 'action' | 'before_data' | 'after_data'>): string {
  const after = jsonObject(e.after_data);
  switch (e.action) {
    case 'nav.calculated':
      return `Calculated: ${formatINR(s(after.gross_net_asset_value))} ÷ ${formatUnits(
        s(after.total_outstanding_units),
      )} units = ${formatNav(s(after.gross_nav_per_unit), { decimals: 8 })}`;
    case 'nav.published':
      return `Published market NAV ${formatNav(s(after.gross_nav_per_unit), { decimals: 8 })} as of ${formatDateTime(
        s(after.nav_date),
      )}`;
    case 'nav.corrected':
      return `Corrected — replaced by ${formatNav(s(after.new_gross_nav_per_unit), { decimals: 8 })}`;
    case 'nav.discarded':
      return 'Draft discarded';
    default:
      return e.action;
  }
}

/** Change vs. a reference NAV as a fraction (e.g. 0.05 = +5%). */
export function navChange(nav: string, reference: string): string | null {
  const n = tryToDecimal(nav);
  const r = tryToDecimal(reference);
  if (!n || !r || r.isZero()) return null;
  return n.dividedBy(r).minus(1).toFixed(6);
}

export interface NavChartPoint {
  /** Epoch ms for the x-axis. */
  t: number;
  /**
   * Display-only number for plotting. Charts need numbers; the exact decimal string is kept in
   * `exact` and is what the tooltip and table show.
   */
  nav: number;
  exact: string;
  /** True for the starting point (the cycle's base NAV). */
  isBase?: boolean;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Prepend the base NAV as the first point, at the start of the cycle's start date (IST), so the chart
 * always draws a line from the starting NAV. If NAVs are dated before the start date (back-dated
 * demos), the base point is placed one day before the first NAV instead.
 */
export function withBasePoint(points: NavChartPoint[], baseNav: string, startDate: string): NavChartPoint[] {
  const start = new Date(`${startDate}T00:00:00+05:30`).getTime();
  const first = points[0]?.t;
  const t = first !== undefined && start >= first ? first - DAY_MS : start;
  return [{ t, nav: toDecimal(baseNav).toNumber(), exact: baseNav, isBase: true }, ...points];
}

/** Published NAVs only (the NAV clients see), oldest first. */
export function chartPoints(snapshots: NavSnapshot[]): NavChartPoint[] {
  return snapshots
    .filter((x) => x.status === 'published')
    .map((x) => ({
      t: new Date(x.nav_date).getTime(),
      nav: toDecimal(clientNav(x)).toNumber(),
      exact: clientNav(x),
    }))
    .sort((a, b) => a.t - b.t);
}
