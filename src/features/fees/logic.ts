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

const IST_PARTS = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Kolkata',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

function istParts(d: Date): number[] {
  const p = Object.fromEntries(IST_PARTS.formatToParts(d).map((x) => [x.type, x.value]));
  return ['year', 'month', 'day', 'hour', 'minute', 'second'].map((k) => Number(p[k]));
}

/**
 * Completed calendar months from `from` to `to` in India time (never negative). Mirrors
 * private.completed_months: joined 1 Jan, NAV 15 Mar → 2. Used for the monthly admin fee.
 */
export function completedMonths(from: string | Date | null, to: string | Date | null): number {
  if (!from || !to) return 0;
  const a = new Date(from);
  const b = new Date(to);
  if (!(b > a)) return 0;
  const [y1, m1, ...rest1] = istParts(a) as [number, number, number, number, number, number];
  const [y2, m2, ...rest2] = istParts(b) as [number, number, number, number, number, number];
  let months = (y2 - y1) * 12 + (m2 - m1);
  // Not yet a full month if the day/time in the end month is earlier than the start's.
  for (let i = 0; i < rest1.length; i++) {
    if (rest2[i]! !== rest1[i]!) {
      if (rest2[i]! < rest1[i]!) months -= 1;
      break;
    }
  }
  return Math.max(0, months);
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
