import { jsonObject, type AuditEntry } from '@/features/audit/api';
import { Decimal, calculateGrossNavPerUnit, calculateHoldingMarketValue, tryToDecimal } from '@/lib/finance';
import { formatDateTime, formatINR } from '@/lib/format';
import { normaliseNumber, type HoldingInput } from './schemas';

/**
 * Live PREVIEW of valuation totals while typing (decimal-safe). The server recomputes every
 * figure on save and approval; these numbers are never sent as authoritative values.
 */
export interface ValuationPreview {
  lineValues: (Decimal | null)[];
  holdings: Decimal;
  /** Parsed inputs; invalid or negative text counts as 0 in the preview (the form shows the error). */
  cash: Decimal;
  other: Decimal;
  liabilities: Decimal;
  grossAssets: Decimal;
  netAssets: Decimal;
  navPerUnit: Decimal | null;
}

const nonNeg = (raw: string | undefined): Decimal => {
  const d = tryToDecimal(normaliseNumber(raw ?? ''));
  return d && !d.isNegative() ? d : new Decimal(0);
};

export function previewValuation(
  holdings: Pick<HoldingInput, 'quantity' | 'valuationPrice'>[],
  cash: string,
  other: string,
  liabilities: string,
  outstandingUnits?: string | null,
): ValuationPreview {
  const lineValues = holdings.map((h) => {
    const q = tryToDecimal(normaliseNumber(h.quantity ?? ''));
    const p = tryToDecimal(normaliseNumber(h.valuationPrice ?? ''));
    if (!q || !p || q.isNegative() || p.isNegative()) return null;
    return calculateHoldingMarketValue(q, p);
  });
  const holdingsTotal = lineValues.reduce<Decimal>((sum, v) => (v ? sum.plus(v) : sum), new Decimal(0));
  const cashD = nonNeg(cash);
  const otherD = nonNeg(other);
  const liabD = nonNeg(liabilities);
  const grossAssets = holdingsTotal.plus(cashD).plus(otherD);
  const netAssets = grossAssets.minus(liabD);
  const units = tryToDecimal(outstandingUnits ?? '');
  return {
    lineValues,
    holdings: holdingsTotal,
    cash: cashD,
    other: otherD,
    liabilities: liabD,
    grossAssets,
    netAssets,
    navPerUnit: units && units.greaterThan(0) ? calculateGrossNavPerUnit(netAssets, units) : null,
  };
}

const s = (v: unknown) => (v === null || v === undefined ? '' : String(v));

export function describeValuationEntry(e: Pick<AuditEntry, 'action' | 'before_data' | 'after_data'>): string {
  const after = jsonObject(e.after_data);
  switch (e.action) {
    case 'valuation.draft_saved':
      return `Draft saved: ${s(after.items)} holding(s), net asset value ${formatINR(s(after.gross_net_asset_value))}`;
    case 'valuation.approved':
      return `Approved for ${formatDateTime(s(after.valuation_at))}: net asset value ${formatINR(
        s(after.gross_net_asset_value),
      )}`;
    case 'valuation.superseded':
      return 'Superseded by an approved correction';
    case 'valuation.discarded':
      return 'Draft discarded';
    default:
      return e.action;
  }
}
