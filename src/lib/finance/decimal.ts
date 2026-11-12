import DecimalBase from 'decimal.js';

/**
 * Isolated Decimal constructor for all financial math in the browser.
 *
 * IMPORTANT: browser-side calculations are for previews and display only.
 * Authoritative NAV, units and fees are computed in PostgreSQL (NUMERIC) functions.
 *
 * Precision 40 significant digits comfortably exceeds NUMERIC(24,8) / NUMERIC(20,8) ranges
 * used in the database, so intermediate results never lose precision before final rounding.
 */
export const Decimal = DecimalBase.clone({
  precision: 40,
  rounding: DecimalBase.ROUND_HALF_UP,
  toExpNeg: -30,
  toExpPos: 40,
});

export type Decimal = InstanceType<typeof Decimal>;

/** Values accepted from forms / API. Prefer strings: NUMERIC columns should arrive as strings. */
export type DecimalInput = string | number | Decimal;

const DECIMAL_STRING = /^-?\d+(\.\d+)?$/;

export class InvalidDecimalError extends Error {
  constructor(value: unknown) {
    super(`Invalid decimal value: ${String(value)}`);
    this.name = 'InvalidDecimalError';
  }
}

/**
 * Convert an input to Decimal, rejecting anything ambiguous.
 * - Strings must be plain decimal notation (no exponent, no commas, no currency symbols).
 * - Numbers must be finite. Non-integer numbers are accepted but discouraged because they may
 *   already carry binary floating-point error; pass strings for money wherever possible.
 */
export function toDecimal(value: DecimalInput): Decimal {
  if (value instanceof Decimal) return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new InvalidDecimalError(value);
    return new Decimal(value);
  }
  const trimmed = value.trim();
  if (!DECIMAL_STRING.test(trimmed)) throw new InvalidDecimalError(value);
  return new Decimal(trimmed);
}

/** Non-throwing variant for form validation. */
export function tryToDecimal(value: DecimalInput | null | undefined): Decimal | null {
  if (value === null || value === undefined || value === '') return null;
  try {
    return toDecimal(value);
  } catch {
    return null;
  }
}
