import { Decimal, roundMoney, toDecimal, type DecimalInput } from '@/lib/finance';
import type { ClientPosition, LotAccrual } from './api';

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

export interface ClientFigures {
  units: Decimal;
  contributed: Decimal;
  value: Decimal;
  profit: Decimal;
  adminFee: Decimal;
  finalProfit: Decimal;
  finalValue: Decimal;
}

/**
 * The figures a client sees for one cycle, mirroring public.client_my_cycles():
 * value = ROUND(units × NAV, 2); profit = value − invested; admin fee applies while units are held.
 */
export function clientFigures(input: {
  units: DecimalInput;
  contributed: DecimalInput;
  nav: DecimalInput;
  adminFee: DecimalInput;
}): ClientFigures {
  const units = toDecimal(input.units);
  const contributed = toDecimal(input.contributed);
  const value = roundMoney(units.times(toDecimal(input.nav)));
  const adminFee = units.greaterThan(0) ? toDecimal(input.adminFee) : new Decimal(0);
  const profit = value.minus(contributed);
  return {
    units,
    contributed,
    value,
    profit,
    adminFee,
    finalProfit: profit.minus(adminFee),
    finalValue: value.minus(adminFee),
  };
}

export interface PositionSummary {
  clients: number;
  contributed: Decimal;
  grossValue: Decimal;
  performanceFee: Decimal;
  netValue: Decimal;
  profit: Decimal;
  adminFees: Decimal;
  finalProfit: Decimal;
}

/** Totals of server-computed client positions at one NAV (sums of already-rounded amounts). */
export function summarisePositions(rows: ClientPosition[]): PositionSummary {
  const zero = new Decimal(0);
  return rows.reduce<PositionSummary>(
    (s, r) => ({
      clients: s.clients + 1,
      contributed: s.contributed.plus(r.contributed),
      grossValue: s.grossValue.plus(r.gross_value),
      performanceFee: s.performanceFee.plus(r.performance_fee_share),
      netValue: s.netValue.plus(r.net_value),
      profit: s.profit.plus(r.profit),
      adminFees: s.adminFees.plus(r.admin_fee),
      finalProfit: s.finalProfit.plus(r.final_profit),
    }),
    {
      clients: 0,
      contributed: zero,
      grossValue: zero,
      performanceFee: zero,
      netValue: zero,
      profit: zero,
      adminFees: zero,
      finalProfit: zero,
    },
  );
}
