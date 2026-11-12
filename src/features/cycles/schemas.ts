import { z } from 'zod';
import { toDecimal } from '@/lib/finance/decimal';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const BASE_NAV = /^\d{1,12}(\.\d{1,8})?$/;
// Up to 3 integer digits so "100" reaches the clearer "must be below 100%" message.
const PERCENT = /^\d{1,3}(\.\d{1,4})?$/;

export const isoDate = (label: string) => z.string().regex(ISO_DATE, `Choose the ${label}.`);

export const baseNavField = z
  .string()
  .trim()
  .regex(BASE_NAV, 'Enter a number such as 100 or 100.50 (up to 8 decimals).')
  .refine((v) => !BASE_NAV.test(v) || toDecimal(v).greaterThan(0), 'Base NAV must be greater than 0.');

/** Fee entered as a percentage (e.g. "20" or "17.5"), stored as a fraction with 6 decimals. */
export const feePercentField = z
  .string()
  .trim()
  .regex(PERCENT, 'Enter a percentage such as 20 or 17.5 (up to 4 decimals).')
  .refine((v) => !PERCENT.test(v) || toDecimal(v).lessThan(100), 'The fee must be below 100%.');

/** "20" → "0.2", "17.5" → "0.175" — exact decimal conversion, no floats. */
export function percentToRate(percent: string): string {
  return toDecimal(percent).dividedBy(100).toFixed();
}

export function rateToPercent(rate: string): string {
  return toDecimal(rate).times(100).toFixed();
}

const reasonField = z
  .string()
  .trim()
  .min(5, 'Please enter at least 5 characters.')
  .max(1000, 'Use at most 1000 characters.');

const cycleCore = {
  name: z.string().trim().min(3, 'Use at least 3 characters.').max(120, 'Use at most 120 characters.'),
  description: z.string().trim().max(2000, 'Use at most 2000 characters.'),
  startDate: isoDate('start date'),
  endDate: isoDate('end date'),
  baseNav: baseNavField,
};

const endAfterStart = <T extends { startDate: string; endDate: string }>(v: T) =>
  !ISO_DATE.test(v.startDate) || !ISO_DATE.test(v.endDate) || v.endDate > v.startDate;

export const createCycleSchema = z
  .object({ ...cycleCore, feePercent: feePercentField })
  .refine(endAfterStart, { path: ['endDate'], message: 'The end date must be after the start date.' });
export type CreateCycleValues = z.infer<typeof createCycleSchema>;

export const editCycleSchema = z
  .object({ ...cycleCore, reason: reasonField })
  .refine(endAfterStart, { path: ['endDate'], message: 'The end date must be after the start date.' });
export type EditCycleValues = z.infer<typeof editCycleSchema>;

export const changeFeeSchema = z
  .object({
    feePercent: feePercentField,
    when: z.enum(['now', 'date']),
    effectiveDate: z.string(),
    reason: reasonField,
  })
  .refine((v) => v.when === 'now' || ISO_DATE.test(v.effectiveDate), {
    path: ['effectiveDate'],
    message: 'Choose the date the new rate takes effect.',
  });
export type ChangeFeeValues = z.infer<typeof changeFeeSchema>;
