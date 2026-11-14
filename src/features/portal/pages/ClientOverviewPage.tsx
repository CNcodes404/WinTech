import { lazy, Suspense } from 'react';
import { Link } from 'react-router';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardHeader } from '@/components/ui/Card';
import { DemoBadge } from '@/components/ui/DemoBadge';
import { Skeleton, TableSkeleton } from '@/components/ui/Skeleton';
import { StatCard } from '@/components/ui/StatCard';
import { ErrorState } from '@/components/ui/States';
import type { NavChartPoint } from '@/features/nav/logic';
import { toDecimal } from '@/lib/finance';
import {
  formatDateTime,
  formatINR,
  formatNav,
  formatSignedINR,
  formatSignedPercent,
  formatUnits,
} from '@/lib/format';
import { useMyActivity, useMyNavHistory, useSelectedClientCycle } from '../api';
import { PortalCycleBar } from '../components/PortalCycleBar';
import { PortalDisclaimer } from '../components/PortalDisclaimer';
import { PortalEmpty } from '../components/PortalEmpty';
import { describeClientActivity, returnOn } from '../logic';

const NavHistoryChart = lazy(() =>
  import('@/features/nav/components/NavHistoryChart').then((m) => ({ default: m.NavHistoryChart })),
);

const trendOf = (amount: string, invested: string) => {
  const r = returnOn(amount, invested);
  return r
    ? {
        direction: amount.startsWith('-') ? ('down' as const) : ('up' as const),
        label: formatSignedPercent(r),
      }
    : undefined;
};

export function ClientOverviewPage() {
  const { cycles, cycle, select } = useSelectedClientCycle();
  const nav = useMyNavHistory(cycle?.cycle_id ?? '');
  const activity = useMyActivity();

  const header = <PageHeader title="Overview" badges={<DemoBadge />} />;

  if (cycles.isPending) {
    return (
      <>
        {header}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      </>
    );
  }
  if (cycles.isError) {
    return (
      <>
        {header}
        <Card>
          <ErrorState message="Your investment could not be loaded." onRetry={() => void cycles.refetch()} />
        </Card>
      </>
    );
  }
  if (!cycle) {
    return (
      <>
        {header}
        <div className="space-y-6">
          <PortalEmpty />
          <PortalDisclaimer />
        </div>
      </>
    );
  }

  const points: NavChartPoint[] = (nav.data ?? []).map((p) => ({
    t: new Date(p.nav_date).getTime(),
    nav: toDecimal(p.nav_per_unit).toNumber(), // display-only
    exact: p.nav_per_unit,
  }));

  return (
    <>
      {header}
      <div className="space-y-6">
        <PortalCycleBar cycles={cycles.data} cycle={cycle} onSelect={select} />

        <section aria-label="Your investment" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Total invested"
            value={formatINR(cycle.net_contributed)}
            meta="Verified, after any reversals"
          />
          <StatCard label="Units held" term="units" value={formatUnits(cycle.units, { decimals: 4 })} />
          <StatCard
            label="NAV per unit"
            term="nav"
            value={formatNav(cycle.latest_nav ?? cycle.base_nav)}
            meta={
              cycle.latest_nav_date
                ? `as of ${formatDateTime(cycle.latest_nav_date)}`
                : 'Starting NAV (no NAV published yet)'
            }
          />
          <StatCard
            label="Current value"
            term="netValue"
            value={formatINR(cycle.current_value)}
            meta="Units × NAV per unit"
          />
          <StatCard
            label="Profit"
            term="profit"
            value={formatSignedINR(cycle.profit)}
            trend={trendOf(cycle.profit, cycle.net_contributed)}
            meta="Current value − total invested"
          />
          <StatCard
            label="Admin fee"
            term="adminFee"
            value={formatINR(cycle.admin_fee)}
            meta="For this cycle, deducted from your profit"
          />
          <StatCard
            label="Final profit"
            term="finalProfit"
            value={formatSignedINR(cycle.final_profit)}
            trend={trendOf(cycle.final_profit, cycle.net_contributed)}
            meta={`Value after admin fee ${formatINR(cycle.final_value)}`}
          />
        </section>

        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader
              title="NAV per unit over time"
              description="Published NAV of your cycle, updated once a day."
              as="h2"
            />
            <div className="px-2 py-4 sm:px-4">
              {nav.isPending ? (
                <TableSkeleton rows={4} columns={1} />
              ) : points.length === 0 ? (
                <p className="px-3 py-8 text-center text-sm text-muted">No NAV has been published yet.</p>
              ) : (
                <Suspense fallback={<TableSkeleton rows={4} columns={1} />}>
                  <NavHistoryChart points={points} baseNav={cycle.base_nav} />
                </Suspense>
              )}
            </div>
          </Card>
          <Card>
            <CardHeader
              title="Recent activity"
              as="h2"
              actions={
                <Link to="/client/activity" className="text-sm font-medium text-emerald-700 hover:underline">
                  View all
                </Link>
              }
            />
            {activity.isPending ? (
              <TableSkeleton rows={4} columns={1} />
            ) : (
              <ol className="divide-y divide-line">
                {(activity.data ?? []).slice(0, 5).map((a, i) => (
                  <li key={`${a.kind}-${a.occurred_at}-${i}`} className="px-5 py-3">
                    <p className="text-sm">{describeClientActivity(a)}</p>
                    <p className="mt-0.5 text-xs text-muted">{formatDateTime(a.occurred_at)}</p>
                  </li>
                ))}
              </ol>
            )}
          </Card>
        </div>

        <PortalDisclaimer />
      </div>
    </>
  );
}
