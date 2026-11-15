import { ChartColumn, ChartLine, Table2, TriangleAlert } from 'lucide-react';
import { lazy, Suspense, useState } from 'react';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/Table';
import { formatINR, formatSignedPercent } from '@/lib/format';
import { cn } from '@/lib/utils/cn';
import { GROWTH, PERFORMANCE_NOTE, START_VALUE, STRATEGIES, summarise } from '../performance';
import { Reveal, SectionHeading } from './Reveal';

// Charting code loads only when the section renders.
const GrowthChart = lazy(() => import('./PerformanceChart').then((m) => ({ default: m.GrowthChart })));
const CycleReturnsChart = lazy(() =>
  import('./PerformanceChart').then((m) => ({ default: m.CycleReturnsChart })),
);

type View = 'growth' | 'cycles' | 'table';

const pct = (v: number) => formatSignedPercent(v, { decimals: 1 });
const inr = (v: number) => formatINR(v, { decimals: 0 });

function StrategyCards() {
  return (
    <div className="grid gap-5 md:grid-cols-2">
      {STRATEGIES.map((s, i) => {
        const m = summarise(s);
        return (
          <Reveal key={s.key} delay={i * 120} className="h-full">
            <article className="relative h-full overflow-hidden rounded-2xl border border-line bg-white p-6 shadow-[var(--shadow-card)]">
              <span
                aria-hidden="true"
                className="absolute inset-x-0 top-0 h-1.5"
                style={{ background: s.color }}
              />
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h3 className="flex items-center gap-2 text-xl font-bold">
                    <span
                      aria-hidden="true"
                      className="size-3 rounded-full"
                      style={{ background: s.color }}
                    />
                    {s.name}
                  </h3>
                  <p className="mt-1 text-sm text-muted">{s.description}</p>
                </div>
                <span className="rounded-full bg-surface-muted px-3 py-1 text-xs font-semibold text-ink">
                  {s.cycleLength}
                </span>
              </div>
              <dl className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
                <div>
                  <dt className="text-xs font-semibold tracking-wide text-muted uppercase">₹1L became</dt>
                  <dd className="mt-1 num text-lg font-bold">{inr(m.endValue)}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold tracking-wide text-muted uppercase">5-year growth</dt>
                  <dd className="mt-1 num text-lg font-bold text-emerald-700">{pct(m.totalReturn)}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold tracking-wide text-muted uppercase">Per year (avg)</dt>
                  <dd className="mt-1 num text-lg font-bold">{pct(m.cagr)}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold tracking-wide text-muted uppercase">Cycles done</dt>
                  <dd className="mt-1 num text-lg font-bold">{m.completedCycles}</dd>
                </div>
              </dl>
              <p className="mt-4 text-xs text-muted">
                Best cycle {pct(m.bestCycle.ret)} ({m.bestCycle.label}) · weakest {pct(m.worstCycle.ret)} (
                {m.worstCycle.label})
              </p>
            </article>
          </Reveal>
        );
      })}
    </div>
  );
}

function DataTables() {
  const yearEnds = GROWTH.filter((_, i) => i % 12 === 0);
  return (
    <div className="space-y-6">
      <Table caption="Value of ₹1,00,000 at each year end (illustrative)" minWidth={480}>
        <THead>
          <tr>
            <TH>Month end</TH>
            {STRATEGIES.map((s) => (
              <TH key={s.key} numeric>
                {s.name}
              </TH>
            ))}
          </tr>
        </THead>
        <TBody>
          {yearEnds.map((p) => (
            <TR key={p.label}>
              <TD className="num">{p.label}</TD>
              {STRATEGIES.map((s) => (
                <TD key={s.key} numeric>
                  {inr(p[s.key])}
                </TD>
              ))}
            </TR>
          ))}
        </TBody>
      </Table>
      <Table caption="Return per cycle (illustrative)" minWidth={480}>
        <THead>
          <tr>
            <TH>Strategy</TH>
            <TH>Cycle</TH>
            <TH numeric>Return</TH>
          </tr>
        </THead>
        <TBody>
          {STRATEGIES.flatMap((s) =>
            s.cycles.map((c) => (
              <TR key={`${s.key}-${c.label}`}>
                <TD>{s.name}</TD>
                <TD className="num">
                  {c.label}
                  {c.inProgress ? ' (in progress)' : ''}
                </TD>
                <TD numeric className="font-medium">
                  {pct(c.ret)}
                </TD>
              </TR>
            )),
          )}
        </TBody>
      </Table>
    </div>
  );
}

/** Public website: 5-year performance of the two strategies (illustrative mock data). */
export function PerformanceSection() {
  const [view, setView] = useState<View>('growth');
  const views: { key: View; label: string; icon: typeof ChartLine }[] = [
    { key: 'growth', label: 'Growth of ₹1 lakh', icon: ChartLine },
    { key: 'cycles', label: 'Return per cycle', icon: ChartColumn },
    { key: 'table', label: 'View as table', icon: Table2 },
  ];
  return (
    <section id="performance" className="bg-gradient-to-b from-indigo-50/60 via-white to-white py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <SectionHeading
          eyebrow="Performance"
          title="Five Years of Disciplined Investing"
          intro={`How ${formatINR(START_VALUE, { decimals: 0 })} invested in each strategy would have grown over the last five years.`}
        />
        <Reveal>
          <p
            role="note"
            className="mx-auto mt-6 flex max-w-3xl items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
          >
            <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-amber-600" />
            <span>
              <strong>Illustrative mock data.</strong> Shown for demonstration only — not actual or projected
              returns.
            </span>
          </p>
        </Reveal>

        <div className="mt-10">
          <StrategyCards />
        </div>

        <Reveal>
          <div className="mt-8 overflow-hidden rounded-2xl border border-line bg-white shadow-[var(--shadow-card)]">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-3">
              <div
                role="group"
                aria-label="Chart view"
                className="inline-flex rounded-full bg-surface-muted p-1"
              >
                {views.map((v) => (
                  <button
                    key={v.key}
                    type="button"
                    aria-pressed={view === v.key}
                    onClick={() => setView(v.key)}
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors',
                      view === v.key ? 'bg-white text-ink shadow-sm' : 'text-muted hover:text-ink',
                    )}
                  >
                    <v.icon aria-hidden="true" className="size-4" />
                    {v.label}
                  </button>
                ))}
              </div>
              {view === 'growth' && (
                <ul className="flex flex-wrap gap-4 text-sm" aria-label="Legend">
                  {STRATEGIES.map((s) => (
                    <li key={s.key} className="flex items-center gap-2 font-medium text-ink">
                      <span
                        aria-hidden="true"
                        className="h-1 w-5 rounded-full"
                        style={{ background: s.color }}
                      />
                      {s.name}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="px-3 py-5 sm:px-5">
              {view === 'table' ? (
                <DataTables />
              ) : (
                <Suspense fallback={<div className="h-72 animate-pulse rounded-xl bg-surface-muted" />}>
                  {view === 'growth' ? <GrowthChart /> : <CycleReturnsChart />}
                </Suspense>
              )}
              {view === 'cycles' && (
                <p className="mt-3 text-xs text-muted">
                  Hatched bar = cycle still in progress (return so far).
                </p>
              )}
            </div>
          </div>
        </Reveal>
        <p className="mt-4 text-center text-xs text-muted">{PERFORMANCE_NOTE}</p>
      </div>
    </section>
  );
}
