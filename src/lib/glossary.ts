/**
 * Plain-language explanations for finance terms used in tooltips (UI_UX_SPECIFICATION §5).
 * Keep wording neutral and factual. No promises of returns.
 *
 * Terms marked "client-safe" may appear in the client portal. The performance fee is never shown
 * to clients (Module 15), so client-safe wording must not mention it.
 */
export const GLOSSARY = {
  /** client-safe */
  nav: {
    label: 'NAV per unit',
    description:
      'The value of one unit of the cycle, published once a day after market close. Money received on a day is converted to units at the previous published NAV.',
  },
  /** admin */
  grossNav: {
    label: 'Market NAV',
    description:
      'Portfolio value after liabilities, divided by units, before the performance fee. Admin only.',
  },
  /** admin */
  netNav: {
    label: 'NAV (after performance fee)',
    description:
      'Market value minus the performance fee on the cycle’s total profit, divided by units. This is the NAV clients see.',
  },
  /** client-safe */
  units: {
    label: 'Units',
    description:
      'Your share of the pool. Units are issued when a contribution is verified, at the NAV published before the day the money was received.',
  },
  /** admin */
  grossValue: {
    label: 'Market value',
    description: 'Units multiplied by the market NAV, before the performance fee. Admin only.',
  },
  /** client-safe */
  netValue: {
    label: 'Current value',
    description:
      'Your units multiplied by the latest NAV. Indicative only: based on manually entered valuations.',
  },
  /** admin */
  performanceFee: {
    label: 'Performance fee',
    description:
      'A share of the cycle’s total profit (assets minus money invested), taken before the NAV is calculated. Zero when there is no profit. Never shown to clients.',
  },
  /** client-safe */
  adminFee: {
    label: 'Admin fee',
    description:
      'A fixed amount charged once per client per cycle. It is deducted from your value even when there is no profit.',
  },
  /** client-safe */
  profit: {
    label: 'Profit',
    description: 'Current value minus the money you invested, before the admin fee.',
  },
  /** client-safe */
  finalProfit: {
    label: 'Final profit',
    description: 'Profit after the admin fee is deducted.',
  },
  /** legacy (per-lot model before Module 15) */
  hwm: {
    label: 'High-water mark',
    description:
      'The reference NAV profit was measured from under the earlier per-lot fee model (NAVs before Module 15).',
  },
  /** admin */
  outstandingUnits: {
    label: 'Outstanding units',
    description: 'Total units issued across all verified contributions in the cycle.',
  },
  /** client-safe */
  unrealizedPL: {
    label: 'Unrealised P/L',
    description: 'Gain or loss on paper based on the latest valuation. Not realised until assets are sold.',
  },
} as const satisfies Record<string, { label: string; description: string }>;

export type GlossaryTerm = keyof typeof GLOSSARY;
