import { previewPerformanceFee, tryToDecimal } from '@/lib/finance';
import { formatINR, formatNav, formatRateAsPercent } from '@/lib/format';

/**
 * Illustrative example so admins see what the fees mean in rupees: ₹1,00,000 invested at NAV ₹100,
 * market NAV rises to ₹130. Preview only; official figures are calculated in the database.
 */
export function FeeExample({ percent, adminFee }: { percent: string; adminFee?: string }) {
  const p = tryToDecimal(percent.trim());
  if (!p || p.isNegative() || p.greaterThanOrEqualTo(100)) return null;
  const rate = p.dividedBy(100);
  const r = previewPerformanceFee('130', '100', rate);
  const units = 1000;
  const profit = r.netNavPerUnit.minus(100).times(units);
  const fee = tryToDecimal((adminFee ?? '').trim());
  return (
    <p className="rounded-[var(--radius-control)] bg-surface-muted px-3 py-2 text-xs text-muted">
      Example at {formatRateAsPercent(rate, { decimals: 2 })}: ₹1,00,000 invested at{' '}
      {formatNav('100', { decimals: 2 })}; the market NAV rises to {formatNav('130', { decimals: 2 })} (profit
      ₹30,000). The performance fee is{' '}
      <span className="num font-medium text-ink">{formatINR(r.feePerUnit.times(units))}</span>, so clients see
      NAV <span className="num font-medium text-ink">{formatNav(r.netNavPerUnit, { decimals: 2 })}</span> and
      a profit of <span className="num font-medium text-ink">{formatINR(profit)}</span>
      {fee && !fee.isNegative() ? (
        <>
          ; after the admin fee of {formatINR(fee)}, their final profit is{' '}
          <span className="num font-medium text-ink">{formatINR(profit.minus(fee))}</span>
        </>
      ) : null}
      . No performance fee is taken when the cycle has no profit.
    </p>
  );
}
