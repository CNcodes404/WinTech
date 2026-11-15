/**
 * ILLUSTRATIVE MOCK performance data for the public website (owner request, 15 Nov 2026).
 * Not actual or projected returns. Replace with real, verified figures before launch.
 *
 * Window: the last 5 years, Dec 2021 → Nov 2026 (60 month-ends), starting from ₹1,00,000.
 *   WINTECH Prime  — 3-year cycles: Dec 2021–Nov 2024 (completed), Dec 2024–Nov 2027 (in progress).
 *   WINTECH Expert — 1-year cycles: Dec–Nov each year, 5 completed.
 * Money is assumed to roll from one cycle into the next. Figures are after fees (illustrative).
 */

export interface StrategyCycle {
  label: string;
  /** Total return of the cycle as a fraction (0.15 = +15%), to date if in progress. */
  ret: number;
  months: number;
  inProgress?: boolean;
}

export interface Strategy {
  key: 'prime' | 'expert';
  name: string;
  cycleLength: string;
  color: string;
  description: string;
  cycles: StrategyCycle[];
}

export const STRATEGIES: Strategy[] = [
  {
    key: 'prime',
    name: 'WINTECH Prime',
    cycleLength: '3-year cycle',
    color: '#0f9d83',
    description: 'Longer horizon, diversified multi-sector portfolio held through market cycles.',
    cycles: [
      { label: 'Dec 2021 – Nov 2024', ret: 0.485, months: 36 },
      { label: 'Dec 2024 – Nov 2027', ret: 0.213, months: 24, inProgress: true },
    ],
  },
  {
    key: 'expert',
    name: 'WINTECH Expert',
    cycleLength: '1-year cycle',
    color: '#4f46e5',
    description: 'Shorter cycles with a focused, actively reviewed selection of opportunities.',
    cycles: [
      { label: 'Dec 2021 – Nov 2022', ret: 0.074, months: 12 },
      { label: 'Dec 2022 – Nov 2023', ret: 0.198, months: 12 },
      { label: 'Dec 2023 – Nov 2024', ret: 0.146, months: 12 },
      { label: 'Dec 2024 – Nov 2025', ret: -0.032, months: 12 },
      { label: 'Dec 2025 – Nov 2026', ret: 0.119, months: 12 },
    ],
  },
];

export const START_VALUE = 100000;

/** Whole rupees for display of the illustrative series (not a financial calculation). */
const whole = (v: number) => Number(v.toFixed(0));
const START = { year: 2021, month: 11 }; // 30 Nov 2021 = starting point (month index 0)
const MONTHS = 60;

/** Deterministic month-to-month variation so the lines look natural but always hit each cycle's total. */
function wiggle(m: number, seed: number): number {
  return (
    Math.sin(m * 1.37 + seed) * 0.9 + Math.cos(m * 0.61 + seed * 2) * 0.6 + Math.sin(m * 2.9 + seed) * 0.35
  );
}

/** Monthly values for one strategy (length MONTHS + 1, starting at START_VALUE). */
function series(s: Strategy, seed: number): number[] {
  const values = [START_VALUE];
  let m = 0;
  for (const c of s.cycles) {
    const total = Math.log(1 + c.ret);
    const w = Array.from({ length: c.months }, (_, i) => wiggle(m + i, seed));
    const mean = w.reduce((a, b) => a + b, 0) / w.length;
    for (let i = 0; i < c.months; i++) {
      const step = total / c.months + 0.022 * (w[i]! - mean);
      values.push(values.at(-1)! * Math.exp(step));
    }
    m += c.months;
  }
  return values;
}

export interface GrowthPoint {
  /** Month-end label, e.g. "Nov 2021". */
  label: string;
  t: number;
  prime: number;
  expert: number;
}

const monthLabel = (offset: number) => {
  const d = new Date(Date.UTC(START.year, START.month - 1 + offset, 1));
  return d.toLocaleDateString('en-IN', { month: 'short', year: 'numeric', timeZone: 'UTC' });
};

const primeSeries = series(STRATEGIES[0]!, 0.4);
const expertSeries = series(STRATEGIES[1]!, 1.9);

export const GROWTH: GrowthPoint[] = Array.from({ length: MONTHS + 1 }, (_, i) => ({
  label: monthLabel(i),
  t: Date.UTC(START.year, START.month - 1 + i, 28),
  prime: whole(primeSeries[i]!),
  expert: whole(expertSeries[i]!),
}));

export interface StrategySummary {
  key: Strategy['key'];
  endValue: number;
  totalReturn: number;
  /** Compound annual growth rate over the 5-year window. */
  cagr: number;
  completedCycles: number;
  bestCycle: StrategyCycle;
  worstCycle: StrategyCycle;
}

export function summarise(s: Strategy): StrategySummary {
  const total = s.cycles.reduce((acc, c) => acc * (1 + c.ret), 1);
  const completed = s.cycles.filter((c) => !c.inProgress);
  const byRet = [...s.cycles].sort((a, b) => b.ret - a.ret);
  return {
    key: s.key,
    endValue: whole(START_VALUE * total),
    totalReturn: total - 1,
    cagr: total ** (12 / MONTHS) - 1,
    completedCycles: completed.length,
    bestCycle: byRet[0]!,
    worstCycle: byRet.at(-1)!,
  };
}

export const PERFORMANCE_NOTE =
  'Illustrative mock data for demonstration only. These are not actual or projected returns of any WINTECH strategy. Past performance is not indicative of future results; investments are subject to market risks.';
