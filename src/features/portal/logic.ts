import type { Decimal } from '@/lib/finance';
import { roundMoney, toDecimal, tryToDecimal } from '@/lib/finance';
import { formatINR, formatNav, formatUnits } from '@/lib/format';
import type { ActivityKind, ClientActivity, ClientContribution, ClientCycle } from './api';

/** Return on invested money as a fraction (0.05 = +5%); null when nothing is invested. */
export function returnOn(amount: string, invested: string): Decimal | null {
  const a = tryToDecimal(amount);
  const i = tryToDecimal(invested);
  if (!a || !i || i.isZero()) return null;
  return a.dividedBy(i).toDecimalPlaces(6);
}

export interface HoldingRow {
  id: string;
  received_at: string;
  amount: Decimal;
  entryNav: string;
  units: Decimal;
  value: Decimal;
  profit: Decimal;
}

/**
 * Each verified contribution valued at the cycle's current NAV (display only). Per-contribution values
 * are rounded separately, so their sum can differ from the cycle total by a few paise.
 */
export function holdingRows(contributions: ClientContribution[], c: ClientCycle): HoldingRow[] {
  const nav = toDecimal(c.latest_nav ?? c.base_nav);
  return contributions
    .filter((x) => x.cycle_id === c.cycle_id && x.status === 'verified' && x.units_issued && x.applicable_nav)
    .sort((a, b) => a.received_at.localeCompare(b.received_at))
    .map((x) => {
      const units = toDecimal(x.units_issued!);
      const amount = toDecimal(x.amount);
      const value = roundMoney(units.times(nav));
      return {
        id: x.id,
        received_at: x.received_at,
        amount,
        entryNav: x.applicable_nav!,
        units,
        value,
        profit: value.minus(amount),
      };
    });
}

const KIND_TEXT: Record<ActivityKind, string> = {
  contribution_recorded: 'Contribution received — awaiting verification',
  units_issued: 'Contribution verified — units issued',
  contribution_rejected: 'Contribution not accepted',
  contribution_reversed: 'Contribution reversed — units removed',
  nav_published: 'NAV published',
};

export function describeClientActivity(a: ClientActivity): string {
  const base = KIND_TEXT[a.kind] ?? a.kind;
  switch (a.kind) {
    case 'contribution_recorded':
    case 'contribution_rejected':
      return `${base}: ${formatINR(a.amount)}`;
    case 'units_issued':
      return `${base}: ${formatINR(a.amount)} → ${formatUnits(a.units)} units at ${formatNav(a.nav)}`;
    case 'contribution_reversed':
      return `${base}: ${formatUnits(a.units)} units`;
    case 'nav_published':
      return `${base}: ${formatNav(a.nav)} per unit`;
    default:
      return base;
  }
}

export { downloadCsv, toCsv } from '@/lib/csv';
