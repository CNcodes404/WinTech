/**
 * Plain-language explanations for finance terms used in tooltips (UI_UX_SPECIFICATION §5).
 * Keep wording neutral and factual. No promises of returns.
 */
export const GLOSSARY = {
  nav: {
    label: 'NAV per unit',
    description:
      'Net Asset Value per unit: the portfolio value after liabilities, divided by the total number of units issued.',
  },
  grossNav: {
    label: 'Gross NAV',
    description: 'NAV per unit before any performance fee is deducted.',
  },
  netNav: {
    label: 'Net NAV',
    description: 'NAV per unit after the applicable performance fee is deducted.',
  },
  units: {
    label: 'Units',
    description:
      'Your share of the pool. Units are issued when a contribution is verified, at the NAV applicable at that time.',
  },
  grossValue: {
    label: 'Gross value',
    description: 'Your units multiplied by the gross NAV, before performance fee.',
  },
  netValue: {
    label: 'Indicative net value',
    description:
      'Your units valued after the performance fee. Indicative only: based on manually entered demo valuations.',
  },
  performanceFee: {
    label: 'Performance fee',
    description:
      'A percentage of eligible profit above your high-water mark. It is never negative; no fee is charged when there is no eligible profit.',
  },
  hwm: {
    label: 'High-water mark',
    description:
      'The reference NAV your profit is measured from. Fees apply only to gains above it, so previous losses must be recovered first.',
  },
  outstandingUnits: {
    label: 'Outstanding units',
    description: 'Total units issued across all verified contributions in the cycle.',
  },
  unrealizedPL: {
    label: 'Unrealised P/L',
    description: 'Gain or loss on paper based on the latest valuation. Not realised until assets are sold.',
  },
} as const satisfies Record<string, { label: string; description: string }>;

export type GlossaryTerm = keyof typeof GLOSSARY;
