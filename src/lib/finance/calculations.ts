import { Decimal, toDecimal, type DecimalInput } from './decimal';
import { roundMoney, roundNav, roundUnits } from './rounding';

/**
 * PREVIEW-ONLY financial formulas (BUSINESS_LOGIC_AND_FORMULAS.md).
 * These mirror the database functions so forms can show a live preview, but they are never
 * the source of truth. Official values always come from PostgreSQL.
 */

export class FinancialInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FinancialInputError';
  }
}

function requirePositive(name: string, value: Decimal): void {
  if (!value.isPositive() || value.isZero()) {
    throw new FinancialInputError(`${name} must be greater than zero.`);
  }
}

function requireNonNegative(name: string, value: Decimal): void {
  if (value.isNegative()) throw new FinancialInputError(`${name} cannot be negative.`);
}

/** units_issued = accepted_contribution_amount / applicable_nav_per_unit (units rounded DOWN to 8 dp). */
export function calculateUnitsIssued(amount: DecimalInput, navPerUnit: DecimalInput): Decimal {
  const a = toDecimal(amount);
  const nav = toDecimal(navPerUnit);
  requirePositive('Contribution amount', a);
  requirePositive('NAV per unit', nav);
  return roundUnits(a.dividedBy(nav));
}

/** market_value = quantity * valuation_price (money, 2 dp). */
export function calculateHoldingMarketValue(quantity: DecimalInput, price: DecimalInput): Decimal {
  const q = toDecimal(quantity);
  const p = toDecimal(price);
  requireNonNegative('Quantity', q);
  requireNonNegative('Valuation price', p);
  return roundMoney(q.times(p));
}

/** gross_net_asset_value = total_asset_value - total_liabilities (money, 2 dp; may be negative). */
export function calculateNetAssetValue(totalAssets: DecimalInput, liabilities: DecimalInput): Decimal {
  const assets = toDecimal(totalAssets);
  const liab = toDecimal(liabilities);
  requireNonNegative('Total assets', assets);
  requireNonNegative('Liabilities', liab);
  return roundMoney(assets.minus(liab));
}

/** gross_nav_per_unit = gross_net_asset_value / total_outstanding_units (8 dp). */
export function calculateGrossNavPerUnit(
  netAssetValue: DecimalInput,
  outstandingUnits: DecimalInput,
): Decimal {
  const units = toDecimal(outstandingUnits);
  requirePositive('Outstanding units', units);
  return roundNav(toDecimal(netAssetValue).dividedBy(units));
}

export interface FeePreview {
  grossProfitPerUnit: Decimal;
  feePerUnit: Decimal;
  netNavPerUnit: Decimal;
}

/**
 * Simple single-period fee illustration (no loss carry-forward). The full per-lot
 * HWM / loss-recovery model is implemented server-side in Module 10.
 *
 * gross_profit_per_unit = max(0, gross_nav - reference_hwm)
 * fee_per_unit          = gross_profit_per_unit * fee_rate   (never negative)
 * net_nav_per_unit      = gross_nav - fee_per_unit
 */
export function previewPerformanceFee(
  grossNavPerUnit: DecimalInput,
  referenceHwm: DecimalInput,
  feeRate: DecimalInput,
): FeePreview {
  const gross = toDecimal(grossNavPerUnit);
  const hwm = toDecimal(referenceHwm);
  const rate = toDecimal(feeRate);
  requirePositive('Reference NAV / HWM', hwm);
  if (rate.isNegative() || rate.greaterThan(1)) {
    throw new FinancialInputError('Fee rate must be between 0 and 1 (e.g. 0.20 for 20%).');
  }
  const grossProfitPerUnit = roundNav(Decimal.max(0, gross.minus(hwm)));
  const feePerUnit = roundNav(grossProfitPerUnit.times(rate));
  return {
    grossProfitPerUnit,
    feePerUnit,
    netNavPerUnit: roundNav(gross.minus(feePerUnit)),
  };
}

/** value = units * nav_per_unit (money, 2 dp). */
export function calculateValue(units: DecimalInput, navPerUnit: DecimalInput): Decimal {
  return roundMoney(toDecimal(units).times(toDecimal(navPerUnit)));
}
