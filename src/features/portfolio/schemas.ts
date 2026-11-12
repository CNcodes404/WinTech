import { z } from 'zod';
import { toDecimal } from '@/lib/finance/decimal';
import { isoDateTimeLocalInIST } from '@/lib/format';

const MONEY = /^\d{1,16}(\.\d{1,2})?$/;
const QTY = /^\d{1,16}(\.\d{1,8})?$/;
const PRICE = /^\d{1,12}(\.\d{1,8})?$/;
const SYMBOL = /^[A-Z0-9][A-Z0-9&._-]{0,29}$/;
const DATETIME_LOCAL = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

/** Strip Indian digit grouping, spaces and ₹. */
export const normaliseNumber = (raw: string) => raw.replace(/[,\s₹]/g, '');

const money = (label: string) =>
  z
    .string()
    .transform(normaliseNumber)
    .pipe(z.string().refine((v) => v === '' || MONEY.test(v), `${label}: rupees with up to 2 decimals.`))
    .transform((v) => (v === '' ? '0' : v));

export const holdingSchema = z.object({
  symbol: z
    .string()
    .trim()
    .transform((v) => v.toUpperCase())
    .pipe(z.string().min(1, 'Enter a symbol.').regex(SYMBOL, 'Letters, digits, & . _ - only (max 30).')),
  instrumentName: z.string().trim().max(120, 'Max 120 characters.'),
  exchange: z.enum(['', 'NSE', 'BSE', 'OTHER']),
  quantity: z
    .string()
    .transform(normaliseNumber)
    .pipe(
      z
        .string()
        .regex(QTY, 'Number, up to 8 decimals.')
        .refine((v) => toDecimal(v).greaterThan(0), 'Must be greater than 0.'),
    ),
  valuationPrice: z
    .string()
    .transform(normaliseNumber)
    .pipe(z.string().regex(PRICE, 'Price, up to 8 decimals.')),
  averageCost: z
    .string()
    .transform(normaliseNumber)
    .pipe(z.string().refine((v) => v === '' || PRICE.test(v), 'Price, up to 8 decimals.')),
  notes: z.string().trim().max(500, 'Max 500 characters.'),
});

export const valuationSchema = z
  .object({
    valuationAt: z
      .string()
      .regex(DATETIME_LOCAL, 'Choose the valuation date and time.')
      .refine((v) => v <= isoDateTimeLocalInIST(), 'The valuation time cannot be in the future.'),
    cashBalance: money('Cash'),
    otherAssets: money('Other assets'),
    liabilities: money('Liabilities'),
    notes: z.string().trim().max(2000, 'Max 2000 characters.'),
    holdings: z.array(holdingSchema).max(200, 'At most 200 holdings.'),
  })
  .superRefine((v, ctx) => {
    const seen = new Map<string, number>();
    v.holdings.forEach((h, i) => {
      const key = `${h.symbol}|${h.exchange}`;
      const first = seen.get(key);
      if (first !== undefined) {
        ctx.addIssue({
          code: 'custom',
          path: ['holdings', i, 'symbol'],
          message: `Duplicate of line ${first + 1}. Combine the quantities.`,
        });
      } else seen.set(key, i);
    });
  });

export type ValuationFormInput = z.input<typeof valuationSchema>;
export type ValuationFormValues = z.output<typeof valuationSchema>;
export type HoldingInput = z.input<typeof holdingSchema>;

export const emptyHolding = (): HoldingInput => ({
  symbol: '',
  instrumentName: '',
  exchange: 'NSE',
  quantity: '',
  valuationPrice: '',
  averageCost: '',
  notes: '',
});
