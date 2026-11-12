import { describe, expect, it } from 'vitest';
import {
  calculateGrossNavPerUnit,
  calculateHoldingMarketValue,
  calculateNetAssetValue,
  calculateUnitsIssued,
  calculateValue,
  FinancialInputError,
  previewPerformanceFee,
} from './calculations';
import { Decimal, InvalidDecimalError, toDecimal, tryToDecimal } from './decimal';
import { roundMoney, roundNav, roundRate, roundUnits } from './rounding';

describe('toDecimal', () => {
  it('parses plain decimal strings exactly', () => {
    expect(toDecimal('0.1').plus('0.2').toString()).toBe('0.3');
  });

  it('rejects ambiguous or malformed strings', () => {
    for (const bad of ['1,000', '₹100', '1e5', 'abc', '', '1.', '.5']) {
      expect(() => toDecimal(bad)).toThrow(InvalidDecimalError);
    }
  });

  it('rejects non-finite numbers', () => {
    expect(() => toDecimal(Number.NaN)).toThrow(InvalidDecimalError);
    expect(() => toDecimal(Number.POSITIVE_INFINITY)).toThrow(InvalidDecimalError);
  });

  it('tryToDecimal returns null instead of throwing', () => {
    expect(tryToDecimal('abc')).toBeNull();
    expect(tryToDecimal('')).toBeNull();
    expect(tryToDecimal(undefined)).toBeNull();
    expect(tryToDecimal('12.5')?.toString()).toBe('12.5');
  });
});

describe('rounding policy', () => {
  it('money: 2 dp HALF_UP', () => {
    expect(roundMoney('10.005').toFixed(2)).toBe('10.01');
    expect(roundMoney('10.004').toFixed(2)).toBe('10.00');
    expect(roundMoney('-10.005').toFixed(2)).toBe('-10.01');
  });

  it('NAV: 8 dp HALF_UP', () => {
    expect(roundNav('105.123456785').toFixed(8)).toBe('105.12345679');
    expect(roundNav('105.123456784').toFixed(8)).toBe('105.12345678');
  });

  it('units: 8 dp ROUND_DOWN (never over-issue)', () => {
    expect(roundUnits('1.999999999').toFixed(8)).toBe('1.99999999');
    expect(roundUnits('1363.636363636363').toFixed(8)).toBe('1363.63636363');
  });

  it('rate: 6 dp HALF_UP', () => {
    expect(roundRate('0.1234565').toFixed(6)).toBe('0.123457');
  });
});

describe('calculateUnitsIssued — spec examples (BUSINESS_LOGIC §2)', () => {
  it('Rahul: ₹1,00,000 at NAV ₹100 → 1,000 units', () => {
    expect(calculateUnitsIssued('100000', '100').toFixed(8)).toBe('1000.00000000');
  });

  it('Amit: ₹50,000 at NAV ₹105 → 476.19047619 units', () => {
    expect(calculateUnitsIssued('50000', '105').toFixed(8)).toBe('476.19047619');
  });

  it('Sagar: ₹1,50,000 at NAV ₹110 → 1,363.63636363 units (rounded down, not up)', () => {
    expect(calculateUnitsIssued('150000', '110').toFixed(8)).toBe('1363.63636363');
  });

  it('issued units valued back at entry NAV never exceed the contribution', () => {
    const units = calculateUnitsIssued('150000', '110');
    expect(units.times('110').lessThanOrEqualTo('150000')).toBe(true);
  });

  it('rejects zero / negative amounts and NAV', () => {
    expect(() => calculateUnitsIssued('0', '100')).toThrow(FinancialInputError);
    expect(() => calculateUnitsIssued('-100', '100')).toThrow(FinancialInputError);
    expect(() => calculateUnitsIssued('100', '0')).toThrow(FinancialInputError);
  });
});

describe('portfolio and NAV previews', () => {
  it('holding market value = quantity × price, rounded to paise', () => {
    expect(calculateHoldingMarketValue('12.5', '2456.789').toFixed(2)).toBe('30709.86');
  });

  it('rejects negative quantity or price', () => {
    expect(() => calculateHoldingMarketValue('-1', '10')).toThrow(FinancialInputError);
    expect(() => calculateHoldingMarketValue('1', '-10')).toThrow(FinancialInputError);
  });

  it('net asset value = assets − liabilities', () => {
    expect(calculateNetAssetValue('331500.00', '1500.00').toFixed(2)).toBe('330000.00');
  });

  it('gross NAV per unit = NAV / outstanding units', () => {
    // 1000 + 476.19047619 + 1363.63636363 units
    const units = new Decimal('1000').plus('476.19047619').plus('1363.63636363');
    expect(units.toFixed(8)).toBe('2839.82683982');
    // 312381 / 2839.82683982 = 110.0000167685… → 110.00001677 (HALF_UP, 8 dp)
    expect(calculateGrossNavPerUnit('312381.00', units).toFixed(8)).toBe('110.00001677');
  });

  it('gross NAV for an exact division', () => {
    expect(calculateGrossNavPerUnit('330000.00', '3000').toFixed(8)).toBe('110.00000000');
  });

  it('gross NAV requires positive outstanding units', () => {
    expect(() => calculateGrossNavPerUnit('1000', '0')).toThrow(FinancialInputError);
  });
});

describe('previewPerformanceFee — spec example (BUSINESS_LOGIC §4)', () => {
  it('HWM ₹100, gross ₹116, 20% → fee ₹3.20, net ₹112.80', () => {
    const r = previewPerformanceFee('116', '100', '0.20');
    expect(r.grossProfitPerUnit.toFixed(2)).toBe('16.00');
    expect(r.feePerUnit.toFixed(2)).toBe('3.20');
    expect(r.netNavPerUnit.toFixed(2)).toBe('112.80');
  });

  it('fee is never negative when NAV is below HWM', () => {
    const r = previewPerformanceFee('92.5', '100', '0.20');
    expect(r.feePerUnit.isZero()).toBe(true);
    expect(r.netNavPerUnit.toFixed(2)).toBe('92.50');
  });

  it('fee rate is configurable (not hard-coded 20%)', () => {
    expect(previewPerformanceFee('116', '100', '0.15').feePerUnit.toFixed(2)).toBe('2.40');
    expect(previewPerformanceFee('116', '100', '0').feePerUnit.isZero()).toBe(true);
  });

  it('rejects rates outside 0..1', () => {
    expect(() => previewPerformanceFee('116', '100', '1.5')).toThrow(FinancialInputError);
    expect(() => previewPerformanceFee('116', '100', '-0.1')).toThrow(FinancialInputError);
  });
});

describe('calculateValue', () => {
  it('client value = units × NAV, rounded to paise', () => {
    expect(calculateValue('476.19047619', '112.80').toFixed(2)).toBe('53714.29');
  });
});
