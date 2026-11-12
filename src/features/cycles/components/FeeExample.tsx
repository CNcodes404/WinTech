import { previewPerformanceFee, tryToDecimal } from '@/lib/finance';
import { formatNav, formatRateAsPercent } from '@/lib/format';

/**
 * Illustrative example so admins see what a rate means in rupees. Uses the spec example
 * (HWM ₹100 → gross ₹116). Preview only; official fees are calculated in the database.
 */
export function FeeExample({ percent }: { percent: string }) {
  const p = tryToDecimal(percent.trim());
  if (!p || p.isNegative() || p.greaterThanOrEqualTo(100)) return null;
  const rate = p.dividedBy(100);
  const r = previewPerformanceFee('116', '100', rate);
  return (
    <p className="rounded-[var(--radius-control)] bg-surface-muted px-3 py-2 text-xs text-muted">
      Example at {formatRateAsPercent(rate, { decimals: 2 })}: if NAV rises from{' '}
      {formatNav('100', { decimals: 2 })} to {formatNav('116', { decimals: 2 })}, the fee is{' '}
      <span className="num font-medium text-ink">{formatNav(r.feePerUnit, { decimals: 2 })}</span> per unit
      and the net NAV is{' '}
      <span className="num font-medium text-ink">{formatNav(r.netNavPerUnit, { decimals: 2 })}</span>. No fee
      is charged when NAV is at or below the high-water mark.
    </p>
  );
}
