import { lazy, Suspense } from 'react';
import { Link } from 'react-router';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardHeader } from '@/components/ui/Card';
import { DemoBadge } from '@/components/ui/DemoBadge';
import { Skeleton, TableSkeleton } from '@/components/ui/Skeleton';
import { StatCard } from '@/components/ui/StatCard';
import { ErrorState } from '@/components/ui/States';
import type { NavChartPoint } from '@/features/nav/logic';
import { Decimal, toDecimal } from '@/lib/finance';
import {
  formatDateTime,
  formatINR,
  formatNav,
  formatSignedINR,
  formatSignedPercent,
  formatUnits,
} from '@/lib/format';
import { useMyActivity, useMyLots, useMyNavHistory, useSelectedClientCycle } from '../api';
import { PortalCycleBar } from '../components/PortalCycleBar';
import { PortalDisclaimer } from '../components/PortalDisclaimer';
import { PortalEmpty } from '../components/PortalEmpty';
import { clientPosition, describeClientActivity } from '../logic';

const NavHistoryChart = lazy(() =>
  import('@/features/nav/components/NavHistoryChart').then((m) => ({ default: m.NavHistoryChart })),
);

export function ClientOverviewPage() {
  const { cycles, cycle, select } = useSelectedClientCycle();
  const lots = useMyLots(cycle?.cycle_id ?? '');
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

  const valuedUnits = lots.data
    ? lots.data.reduce((s, l) => s.plus(toDecimal(l.units)), new Decimal(0))
    : null;
  const pos = clientPosition(cycle, valuedUnits);
  const points: NavChartPoint[] = (nav.data ?? []).map((p) => ({
    t: new Date(p.nav_date).getTime(),
    nav: toDecimal(p.gross_nav_per_unit).toNumber(), // display-only
    exact: p.gross_nav_per_unit,
  }));

  return (
    <>
      {header}
      <div className="space-y-6">
        <PortalCycleBar cycles={cycles.data} cycle={cycle} onSelect={select} />

        <section aria-label="Your investment" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard
            label="Total contributed"
            value={formatINR(cycle.net_contributed)}
            meta="Verified, after any reversals"
          />
          <StatCard label="Units held" term="units" value={formatUnits(cycle.units, { decimals: 4 })} />
          <StatCard
            label="Latest NAV per unit"
            term="grossNav"
            value={formatNav(cycle.latest_gross_nav ?? cycle.base_nav)}
            meta={
              cycle.latest_nav_date
                ? `as of ${formatDateTime(cycle.latest_nav_date)}`
                : 'Starting NAV (no NAV published yet)'
            }
          />
          <StatCard
            label="Indicative net value"
            term="netValue"
            loading={lots.isPending && Boolean(cycle.latest_nav_date)}
            value={pos.netValue ? formatINR(pos.netValue) : '—'}
            meta={
              pos.netNavPerUnit
                ? `Your net NAV ${formatNav(pos.netNavPerUnit)} per unit`
                : 'After a NAV is published'
            }
          />
          <StatCard
            label="Net profit / loss"
            value={pos.pnl ? formatSignedINR(pos.pnl) : '—'}
            trend={
              pos.pnl && pos.pnlReturn
                ? {
                    direction: pos.pnl.isNegative() ? 'down' : 'up',
                    label: formatSignedPercent(pos.pnlReturn),
                  }
                : undefined
            }
            meta="After the indicative performance fee"
          />
          <StatCard
            label="Indicative performance fee"
            term="performanceFee"
            value={formatINR(cycle.fee_amount ?? '0')}
            meta={
              cycle.loss_to_recover && toDecimal(cycle.loss_to_recover).greaterThan(0)
                ? `No fee until ${formatINR(cycle.loss_to_recover)} is recovered`
                : 'Accrued only; nothing deducted'
            }
          />
        </section>

        {pos.hasUnvaluedLots && (
          <p
            role="status"
            className="rounded-[var(--radius-control)] bg-info-soft px-3 py-2 text-sm text-info"
          >
            Some of your contributions were verified after the latest NAV. They will be valued when the next
            NAV is published.
          </p>
        )}

        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader
              title="NAV per unit over time"
              description="Published gross NAV of your cycle."
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
