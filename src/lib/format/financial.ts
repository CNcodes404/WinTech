import { toDecimal, type DecimalInput } from '@/lib/finance/decimal';
import { formatDecimalIndian } from './number';

const EMPTY = '—';

type Maybe<T> = T | null | undefined;

function isEmpty(value: Maybe<DecimalInput>): value is null | undefined {
  return value === null || value === undefined || value === '';
}

/** ₹1,25,000.00 — negative values render as -₹1,250.00. */
export function formatINR(value: Maybe<DecimalInput>, options: { decimals?: number } = {}): string {
  if (isEmpty(value)) return EMPTY;
  const decimals = options.decimals ?? 2;
  const s = formatDecimalIndian(value, decimals);
  return s.startsWith('-') ? `-₹${s.slice(1)}` : `₹${s}`;
}

/** Signed INR for profit/loss: +₹1,250.00 / -₹1,250.00 / ₹0.00. */
export function formatSignedINR(value: Maybe<DecimalInput>, options: { decimals?: number } = {}): string {
  if (isEmpty(value)) return EMPTY;
  const d = toDecimal(value);
  const base = formatINR(d, options);
  return d.isPositive() && !d.isZero() ? `+${base}` : base;
}

/** NAV per unit. Display default 4 dp; stored with 8 dp. */
export function formatNav(value: Maybe<DecimalInput>, options: { decimals?: number } = {}): string {
  return formatINR(value, { decimals: options.decimals ?? 4 });
}

/** Units, default full 8 dp precision. */
export function formatUnits(value: Maybe<DecimalInput>, options: { decimals?: number } = {}): string {
  if (isEmpty(value)) return EMPTY;
  return formatDecimalIndian(value, options.decimals ?? 8);
}

/** Rate stored as a fraction (0.2) displayed as a percentage (20.00%). */
export function formatRateAsPercent(rate: Maybe<DecimalInput>, options: { decimals?: number } = {}): string {
  if (isEmpty(rate)) return EMPTY;
  return `${formatDecimalIndian(toDecimal(rate).times(100), options.decimals ?? 2)}%`;
}

/** Signed percentage change, e.g. +5.25% / -3.10%. Input is a fraction. */
export function formatSignedPercent(rate: Maybe<DecimalInput>, options: { decimals?: number } = {}): string {
  if (isEmpty(rate)) return EMPTY;
  const d = toDecimal(rate);
  const base = formatRateAsPercent(d, options);
  return d.isPositive() && !d.isZero() ? `+${base}` : base;
}
