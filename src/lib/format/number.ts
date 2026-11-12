import { Decimal, toDecimal, type DecimalInput } from '@/lib/finance/decimal';

/**
 * Group an unsigned integer string using the Indian system: last 3 digits, then pairs.
 * "12500000" -> "1,25,00,000"
 */
export function groupIndian(intDigits: string): string {
  if (intDigits.length <= 3) return intDigits;
  const last3 = intDigits.slice(-3);
  const rest = intDigits.slice(0, -3);
  return `${rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',')},${last3}`;
}

/**
 * Format a decimal with fixed scale and Indian digit grouping, without ever converting to a JS
 * float. Rounding is HALF_UP for display.
 */
export function formatDecimalIndian(value: DecimalInput, scale: number): string {
  const d = toDecimal(value).toDecimalPlaces(scale, Decimal.ROUND_HALF_UP);
  const negative = d.isNegative() && !d.isZero();
  const [intPart = '0', fracPart] = d.abs().toFixed(scale).split('.');
  const grouped = groupIndian(intPart);
  const body = fracPart ? `${grouped}.${fracPart}` : grouped;
  return negative ? `-${body}` : body;
}
