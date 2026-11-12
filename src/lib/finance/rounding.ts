import { Decimal, toDecimal, type DecimalInput } from './decimal';

/**
 * Rounding policy (approved decision F). Must stay in sync with docs/ROUNDING_POLICY.md and the
 * PostgreSQL functions introduced in later modules.
 *
 * | Quantity          | Scale | Mode       | Rationale                                       |
 * |-------------------|-------|------------|-------------------------------------------------|
 * | Money (INR)       | 2     | HALF_UP    | Standard paise rounding                         |
 * | NAV per unit      | 8     | HALF_UP    | Matches NUMERIC(20,8)                           |
 * | Units             | 8     | DOWN       | Never over-issue units; residue stays in pool   |
 * | Fee / rate        | 6     | HALF_UP    | Matches NUMERIC(8,6), e.g. 0.200000 = 20%       |
 */
export const ROUNDING_POLICY = {
  money: { scale: 2, mode: Decimal.ROUND_HALF_UP },
  nav: { scale: 8, mode: Decimal.ROUND_HALF_UP },
  units: { scale: 8, mode: Decimal.ROUND_DOWN },
  rate: { scale: 6, mode: Decimal.ROUND_HALF_UP },
} as const;

export type RoundingKind = keyof typeof ROUNDING_POLICY;

export function roundAs(kind: RoundingKind, value: DecimalInput): Decimal {
  const { scale, mode } = ROUNDING_POLICY[kind];
  return toDecimal(value).toDecimalPlaces(scale, mode);
}

export const roundMoney = (v: DecimalInput) => roundAs('money', v);
export const roundNav = (v: DecimalInput) => roundAs('nav', v);
export const roundUnits = (v: DecimalInput) => roundAs('units', v);
export const roundRate = (v: DecimalInput) => roundAs('rate', v);
