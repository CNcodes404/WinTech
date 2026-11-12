import { z } from 'zod';
import { toDecimal } from '@/lib/finance/decimal';
import { isoDateTimeLocalInIST } from '@/lib/format';
import { isUuid } from '@/lib/utils/uuid';

const AMOUNT = /^\d{1,13}(\.\d{1,2})?$/;
const DATETIME_LOCAL = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

/** Accept Indian-style grouping ("1,00,000") and stray spaces; return a plain decimal string. */
export function normaliseAmount(raw: string): string {
  return raw.replace(/[,\s₹]/g, '');
}

export const recordContributionSchema = z.object({
  clientId: z.string().refine(isUuid, 'Choose a client.'),
  cycleId: z.string().refine(isUuid, 'Choose an open or active cycle.'),
  amount: z
    .string()
    .transform(normaliseAmount)
    .pipe(
      z
        .string()
        .min(1, 'Enter the amount received.')
        .regex(AMOUNT, 'Enter rupees with up to 2 decimals, e.g. 50000 or 50000.50.')
        .refine((v) => toDecimal(v).greaterThan(0), 'The amount must be greater than zero.'),
    ),
  receivedAt: z
    .string()
    .regex(DATETIME_LOCAL, 'Choose the date and time the money was received.')
    .refine((v) => v <= isoDateTimeLocalInIST(), 'The received time cannot be in the future.'),
  method: z.enum(['upi', 'bank_transfer', 'cheque', 'other'], { message: 'Choose a payment method.' }),
  reference: z.string().trim().max(100, 'Use at most 100 characters.'),
  notes: z.string().trim().max(1000, 'Use at most 1000 characters.'),
});

export type RecordContributionInput = z.input<typeof recordContributionSchema>;
export type RecordContributionValues = z.output<typeof recordContributionSchema>;
