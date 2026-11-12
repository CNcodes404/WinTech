import { describe, expect, it } from 'vitest';
import { formatDate, formatDateTime } from './date';
import {
  formatINR,
  formatNav,
  formatRateAsPercent,
  formatSignedINR,
  formatSignedPercent,
  formatUnits,
} from './financial';
import { groupIndian } from './number';

describe('groupIndian', () => {
  it.each([
    ['0', '0'],
    ['999', '999'],
    ['1000', '1,000'],
    ['125000', '1,25,000'],
    ['12500000', '1,25,00,000'],
    ['1234567890', '1,23,45,67,890'],
  ])('%s → %s', (input, expected) => {
    expect(groupIndian(input)).toBe(expected);
  });
});

describe('formatINR', () => {
  it('uses Indian grouping and 2 dp', () => {
    expect(formatINR('125000')).toBe('₹1,25,000.00');
    expect(formatINR('12500000.5')).toBe('₹1,25,00,000.50');
    expect(formatINR('999')).toBe('₹999.00');
  });

  it('renders negatives with leading minus', () => {
    expect(formatINR('-1250')).toBe('-₹1,250.00');
  });

  it('does not render negative zero', () => {
    expect(formatINR('-0.001')).toBe('₹0.00');
  });

  it('keeps precision beyond JS float range', () => {
    // 17 integer digits: larger than Number.MAX_SAFE_INTEGER, must not lose the trailing digits
    expect(formatINR('90071992547409931.25')).toBe('₹90,07,19,92,54,74,09,931.25');
  });

  it('supports custom decimals and empty values', () => {
    expect(formatINR('125000', { decimals: 0 })).toBe('₹1,25,000');
    expect(formatINR(null)).toBe('—');
    expect(formatINR('')).toBe('—');
  });
});

describe('formatSignedINR', () => {
  it('adds + for gains only', () => {
    expect(formatSignedINR('1250')).toBe('+₹1,250.00');
    expect(formatSignedINR('-1250')).toBe('-₹1,250.00');
    expect(formatSignedINR('0')).toBe('₹0.00');
  });
});

describe('formatNav / formatUnits', () => {
  it('NAV displays 4 dp by default', () => {
    expect(formatNav('105.12345678')).toBe('₹105.1235');
    expect(formatNav('105.12345678', { decimals: 8 })).toBe('₹105.12345678');
  });

  it('units display 8 dp with grouping', () => {
    expect(formatUnits('1363.63636363')).toBe('1,363.63636363');
    expect(formatUnits('1000')).toBe('1,000.00000000');
  });
});

describe('percentages', () => {
  it('formats fraction as percent', () => {
    expect(formatRateAsPercent('0.2')).toBe('20.00%');
    expect(formatRateAsPercent('0.125', { decimals: 1 })).toBe('12.5%');
  });

  it('signed percent', () => {
    expect(formatSignedPercent('0.0525')).toBe('+5.25%');
    expect(formatSignedPercent('-0.031')).toBe('-3.10%');
  });
});

describe('dates (IST)', () => {
  it('converts UTC to India Standard Time', () => {
    // 20:00 UTC on 12 Nov = 01:30 IST on 13 Nov
    expect(formatDate('2026-11-12T20:00:00Z')).toBe('13 Nov 2026');
    expect(formatDateTime('2026-11-12T20:00:00Z')).toMatch(/13 Nov 2026.*01:30\s?am/i);
  });

  it('handles invalid / empty input', () => {
    expect(formatDate('not-a-date')).toBe('—');
    expect(formatDate(null)).toBe('—');
  });
});
