import { Decimal, toDecimal } from '@/lib/finance';
import type { LotAccrual } from './api';

export interface AccrualSummary {
  lots: number;
  lotsWithFee: number;
  lotsBelowHwm: number;
  grossValue: Decimal;
  fee: Decimal;
  netValue: Decimal;
  lossToRecover: Decimal;
}

/** Display summary of server-computed accruals (sums of already-rounded server amounts). */
export function summariseAccruals(rows: LotAccrual[]): AccrualSummary {
  const zero = new Decimal(0);
  return rows.reduce<AccrualSummary>(
    (s, r) => ({
      lots: s.lots + 1,
      lotsWithFee: s.lotsWithFee + (toDecimal(r.fee_amount).greaterThan(0) ? 1 : 0),
      lotsBelowHwm: s.lotsBelowHwm + (toDecimal(r.loss_to_recover).greaterThan(0) ? 1 : 0),
      grossValue: s.grossValue.plus(r.gross_value),
      fee: s.fee.plus(r.fee_amount),
      netValue: s.netValue.plus(r.net_value),
      lossToRecover: s.lossToRecover.plus(r.loss_to_recover),
    }),
    {
      lots: 0,
      lotsWithFee: 0,
      lotsBelowHwm: 0,
      grossValue: zero,
      fee: zero,
      netValue: zero,
      lossToRecover: zero,
    },
  );
}
