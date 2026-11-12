import { Briefcase, Calculator, CircleCheck, HandCoins, Send, UserPlus } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { DemoBadge } from '@/components/ui/DemoBadge';
import { Select } from '@/components/ui/Form';
import { Skeleton } from '@/components/ui/Skeleton';
import { StatCard } from '@/components/ui/StatCard';
import { ErrorState } from '@/components/ui/States';
import { AddClientDialog } from '@/features/clients/components/AddClientDialog';
import { RecordContributionDialog } from '@/features/contributions/components/RecordContributionDialog';
import { useCycleUnitSummary } from '@/features/contributions/queries';
import { CycleStatusBadge } from '@/features/cycles/components/CycleStatusBadge';
import { useCycles } from '@/features/cycles/queries';
import { useLotAccruals } from '@/features/fees/api';
import { useNavSnapshots } from '@/features/nav/queries';
import { useValuations } from '@/features/portfolio/queries';
import {
  formatDate,
  formatDateTime,
  formatINR,
  formatNav,
  formatRateAsPercent,
  formatSignedINR,
  formatSignedPercent,
  formatUnits,
} from '@/lib/format';
import { tryToDecimal } from '@/lib/finance';
import { isUuid } from '@/lib/utils/uuid';
import { useActiveClientCount } from '../api';
import { RecentActivity } from '../components/RecentActivity';
import { SetupChecklist } from '../components/SetupChecklist';
import { unrealisedPnl } from '../logic';

const ACCEPTS = new Set(['open', 'active']);

function AttentionItem({ to, children }: { to: string; children: ReactNode }) {
  return (
    <li>
      <Link
        to={to}
        className="flex items-center justify-between gap-3 px-5 py-3 text-sm hover:bg-surface-muted"
      >
        <span>{children}</span>
        <span aria-hidden="true" className="text-emerald-700">
          Review →
        </span>
      </Link>
    </li>
  );
}

export function AdminOverviewPage() {
  const [sp, setSp] = useSearchParams();
  const cycles = useCycles();
  const clients = useActiveClientCount();
  const all = cycles.data ?? [];
  const cycle =
    all.find((c) => c.id === sp.get('cycle')) ??
    all.find((c) => c.status === 'active' || c.status === 'open') ??
    all[0];
  const cycleId = cycle && isUuid(cycle.id) ? cycle.id : '';

  const units = useCycleUnitSummary(cycleId);
  const valuations = useValuations(cycleId);
  const snapshots = useNavSnapshots(cycleId);
  const latestValuation = valuations.data?.find((v) => v.status === 'approved');
  const draftValuations = valuations.data?.filter((v) => v.status === 'draft') ?? [];
  const latestNav = snapshots.data?.find((s) => s.status === 'published');
  const draftNav = snapshots.data?.find((s) => s.status === 'draft');
  const lots = useLotAccruals(latestNav?.id ?? '');
  const pnl = lots.data && lots.data.length > 0 ? unrealisedPnl(lots.data) : null;

  const [addClientOpen, setAddClientOpen] = useState(false);
  const [recordOpen, setRecordOpen] = useState(false);

  const loading = cycles.isPending || clients.isPending;

  const quickActions = (
    <>
      <Button variant="secondary" onClick={() => setAddClientOpen(true)}>
        <UserPlus aria-hidden="true" className="size-4" />
        Add client
      </Button>
      <Button
        variant="secondary"
        onClick={() => setRecordOpen(true)}
        disabled={!cycle || !ACCEPTS.has(cycle.status)}
      >
        <HandCoins aria-hidden="true" className="size-4" />
        Record contribution
      </Button>
      {cycle && cycle.status !== 'draft' && cycle.status !== 'settled' && (
        <Button variant="secondary" asChild>
          <Link to={`/admin/portfolio/valuations/new?cycle=${cycle.id}`}>
            <Briefcase aria-hidden="true" className="size-4" />
            Add valuation
          </Link>
        </Button>
      )}
      {cycle && cycle.status !== 'draft' && (
        <Button asChild>
          <Link to={`/admin/nav?cycle=${cycle.id}`}>
            <Calculator aria-hidden="true" className="size-4" />
            Calculate NAV
          </Link>
        </Button>
      )}
    </>
  );

  if (cycles.isError) {
    return (
      <>
        <PageHeader title="Overview" />
        <Card>
          <ErrorState message="The overview could not be loaded." onRetry={() => void cycles.refetch()} />
        </Card>
      </>
    );
  }

  const setupIncomplete = !loading && (!cycle || !latestNav);
  const steps = [
    { label: 'Add at least one client', done: (clients.data ?? 0) > 0, href: '/admin/clients' },
    { label: 'Create an investment cycle with a fee rate', done: all.length > 0, href: '/admin/cycles' },
    {
      label: 'Open the cycle for contributions',
      done: all.some((c) => c.status !== 'draft'),
      href: cycle ? `/admin/cycles/${cycle.id}` : '/admin/cycles',
    },
    {
      label: 'Record and verify a contribution (issues units)',
      done: Boolean(tryToDecimal(units.data?.outstanding_units ?? '0')?.greaterThan(0)),
      href: '/admin/contributions',
    },
    {
      label: 'Enter and approve a portfolio valuation',
      done: Boolean(latestValuation),
      href: cycle ? `/admin/portfolio?cycle=${cycle.id}` : '/admin/portfolio',
    },
    {
      label: 'Calculate and publish NAV',
      done: Boolean(latestNav),
      href: cycle ? `/admin/nav?cycle=${cycle.id}` : '/admin/nav',
    },
  ];

  const pendingCount = units.data?.pending_count ?? 0;
  const attention = cycle
    ? [
        pendingCount > 0 && (
          <AttentionItem key="pending" to={`/admin/contributions?status=pending&cycle=${cycle.id}`}>
            <span className="num font-medium">{pendingCount}</span> contribution(s) awaiting verification (
            {formatINR(units.data?.pending_amount ?? '0')})
          </AttentionItem>
        ),
        ...draftValuations.map((v) => (
          <AttentionItem key={v.id} to={`/admin/portfolio/valuations/${v.id}`}>
            Valuation draft for {formatDateTime(v.valuation_at)} awaiting approval
          </AttentionItem>
        )),
        draftNav && (
          <AttentionItem key="nav" to={`/admin/nav/snapshots/${draftNav.id}`}>
            Draft NAV of <span className="num font-medium">{formatNav(draftNav.gross_nav_per_unit)}</span>{' '}
            awaiting publishing
          </AttentionItem>
        ),
      ].filter(Boolean)
    : [];

  return (
    <>
      <PageHeader
        title="Overview"
        badges={<DemoBadge />}
        description="Key figures for the selected cycle, from manually entered demo data."
        actions={quickActions}
      />

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 8 }, (_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      ) : (
        <div className="space-y-6">
          {cycle && (
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <label htmlFor="overview-cycle" className="text-muted">
                Cycle
              </label>
              <Select
                id="overview-cycle"
                value={cycle.id}
                onChange={(e) => setSp({ cycle: e.target.value }, { replace: true })}
                className="w-64"
              >
                {all.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
              <CycleStatusBadge status={cycle.status} />
              <span className="num text-muted">
                {formatDate(cycle.start_date)} – {formatDate(cycle.end_date)}
              </span>
            </div>
          )}

          {setupIncomplete && <SetupChecklist steps={steps} />}

          {cycle && (
            <>
              <section aria-label="Key figures" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <StatCard
                  label="Verified contributions"
                  loading={units.isPending}
                  value={formatINR(units.data?.net_contributed ?? '0')}
                  meta={`${units.data?.investor_count ?? 0} investor(s) · after reversals`}
                />
                <StatCard
                  label="Portfolio value"
                  loading={valuations.isPending}
                  value={latestValuation ? formatINR(latestValuation.gross_net_asset_value) : '—'}
                  meta={
                    latestValuation
                      ? `as of ${formatDateTime(latestValuation.valuation_at)}`
                      : 'No approved valuation'
                  }
                  badge={<DemoBadge kind="manual" />}
                />
                <StatCard
                  label="Gross NAV per unit"
                  term="grossNav"
                  loading={snapshots.isPending}
                  value={formatNav(latestNav?.gross_nav_per_unit ?? cycle.base_nav)}
                  meta={
                    latestNav
                      ? `published for ${formatDateTime(latestNav.nav_date)}`
                      : 'Base NAV (nothing published)'
                  }
                />
                <StatCard
                  label="Net NAV per unit"
                  term="netNav"
                  loading={snapshots.isPending}
                  value={latestNav?.net_nav_per_unit ? formatNav(latestNav.net_nav_per_unit) : '—'}
                  meta="Weighted average after indicative fee"
                />
                <StatCard
                  label="Outstanding units"
                  term="outstandingUnits"
                  loading={units.isPending}
                  value={formatUnits(units.data?.outstanding_units ?? '0', { decimals: 4 })}
                />
                <StatCard
                  label="Unrealised P/L"
                  term="unrealizedPL"
                  loading={Boolean(latestNav) && lots.isPending}
                  value={pnl ? formatSignedINR(pnl.grossPnl) : '—'}
                  trend={
                    pnl?.grossReturn
                      ? {
                          direction: pnl.grossPnl.isNegative() ? 'down' : 'up',
                          label: formatSignedPercent(pnl.grossReturn),
                        }
                      : undefined
                  }
                  meta={pnl ? 'Before fee, at the latest NAV' : 'Publish a NAV to see P/L'}
                />
                <StatCard
                  label="Unrealised P/L after fee"
                  loading={Boolean(latestNav) && lots.isPending}
                  value={pnl ? formatSignedINR(pnl.netPnl) : '—'}
                  trend={
                    pnl?.netReturn
                      ? {
                          direction: pnl.netPnl.isNegative() ? 'down' : 'up',
                          label: formatSignedPercent(pnl.netReturn),
                        }
                      : undefined
                  }
                  meta={
                    latestNav?.performance_fee_amount
                      ? `Indicative fee ${formatINR(latestNav.performance_fee_amount)}`
                      : undefined
                  }
                />
                <StatCard
                  label="Performance-fee rate"
                  term="performanceFee"
                  value={formatRateAsPercent(cycle.current_fee_rate)}
                  meta={
                    cycle.pending_fee_rate
                      ? `Changes to ${formatRateAsPercent(cycle.pending_fee_rate)} on ${formatDate(cycle.pending_fee_effective_from)}`
                      : `Version ${cycle.current_fee_version ?? '—'}`
                  }
                />
              </section>

              <div className="grid gap-6 lg:grid-cols-3">
                <Card className="h-fit">
                  <CardHeader title="Needs your attention" as="h2" />
                  {attention.length === 0 ? (
                    <p className="flex items-center gap-2 px-5 py-4 text-sm text-muted">
                      <CircleCheck aria-hidden="true" className="size-4 text-gain" />
                      All caught up for this cycle.
                    </p>
                  ) : (
                    <ul className="divide-y divide-line">{attention}</ul>
                  )}
                  {latestNav && (
                    <p className="flex items-center gap-1.5 border-t border-line px-5 py-3 text-xs text-muted">
                      <Send aria-hidden="true" className="size-3.5" />
                      Last NAV published {formatDateTime(latestNav.published_at)}
                    </p>
                  )}
                </Card>
                <Card className="lg:col-span-2">
                  <CardHeader
                    title="Recent activity"
                    description="Latest entries from the audit log."
                    as="h2"
                  />
                  <RecentActivity />
                </Card>
              </div>
            </>
          )}
        </div>
      )}

      <AddClientDialog open={addClientOpen} onOpenChange={setAddClientOpen} />
      {recordOpen && cycle && (
        <RecordContributionDialog onClose={() => setRecordOpen(false)} defaultCycleId={cycle.id} />
      )}
    </>
  );
}
