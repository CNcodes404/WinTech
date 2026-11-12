import { isoDateTimeLocalInIST } from '@/lib/format';
import { emptyHolding, type ValuationFormInput } from './schemas';
import type { Valuation, ValuationItem } from './types';

/** Fresh form, or one pre-filled from an existing valuation (copy forward / edit / correction). */
export function toFormValues(
  source: { valuation: Valuation; items: ValuationItem[] } | null,
  opts: { keepTime: boolean },
): ValuationFormInput {
  if (!source) {
    return {
      valuationAt: isoDateTimeLocalInIST(),
      cashBalance: '0',
      otherAssets: '0',
      liabilities: '0',
      notes: '',
      holdings: [emptyHolding()],
    };
  }
  const { valuation: v, items } = source;
  return {
    valuationAt: opts.keepTime ? isoDateTimeLocalInIST(new Date(v.valuation_at)) : isoDateTimeLocalInIST(),
    cashBalance: v.cash_balance,
    otherAssets: v.other_assets,
    liabilities: v.liabilities,
    notes: opts.keepTime ? (v.notes ?? '') : '',
    holdings: items.map((i) => ({
      symbol: i.symbol,
      instrumentName: i.instrument_name ?? '',
      exchange: i.exchange ?? '',
      quantity: i.quantity,
      valuationPrice: i.valuation_price,
      averageCost: i.average_cost ?? '',
      notes: i.notes ?? '',
    })),
  };
}
