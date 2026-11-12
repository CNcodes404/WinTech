import { Calculator, ChartLine, ChevronRight } from 'lucide-react';
import { lazy, Suspense, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { DemoBadge } from '@/components/ui/DemoBadge';
import { Select } from '@/components/ui/Form';
import { TableSkeleton } from '@/components/ui/Skeleton';
import { StatCard } from '@/components/ui/StatCard';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/Table';
import { useCycles } from '@/features/cycles/queries';
import { formatDateTime, formatINR, formatNav, formatSignedPercent, formatUnits } from '@/lib/format';
import { isUuid } from '@/lib/utils/uuid';
import { CalculateNavDialog } from '../components/CalculateNavDialog';
// Charting code is loaded only when this page renders a chart.
const NavHistoryChart = lazy(() =>
  import('../components/NavHistoryChart').then((m) => ({ default: m.NavHistoryChart })),
);
import { NavStatusBadge } from '../components/NavStatusBadge';
import { chartPoints, navChange } from '../logic';
import { useNavSnapshots } from '../queries';

const CALCULABLE = new Set(['open', 'active', 'closed']);

export function NavPage() {
  const [sp, setSp] = useSearchParams();
  const cycles = useCycles();
  const selectable = (cycles.data ?? []).filter((c) => c.status !== 'draft');
  const cycle =
    selectable.find((c) => c.id === sp.get('cycle')) ??
    selectable.find((c) => c.status === 'active' || c.status === 'open') ??
    selectable[0];
  const snapshots = useNavSnapshots(cycle && isUuid(cycle.id) ? cycle.id : '');
  const [calcOpen, setCalcOpen] = useState(false);

  const latest = snapshots.data?.find((s) => s.status === 'published');
  const draft = snapshots.data?.find((s) => s.status === 'draft');
  const change = latest && cycle ? navChange(latest.gross_nav_per_unit, cycle.base_nav) : null;
  const points = chartPoints(snapshots.data ?? []);

  return (
    <>
      <PageHeader
        title="NAV & Performance"
        description="Gross NAV per unit, calculated from approved manual valuations. Not real-time market pricing."
        badges={<DemoBadge kind="manual" />}
        actions={
          cycle &&
          CALCULABLE.has(cycle.status) && (
            <Button onClick={() => setCalcOpen(true)}>
              <Calculator aria-hidden="true" className="size-4" />
              Calculate NAV
            </Button>
          )
        }
      />

      {cycles.isPending ? (
        <Card>
          <TableSkeleton rows={3} columns={4} />
        </Card>
      ) : cycles.isError ? (
        <Card>
          <ErrorState message="Cycles could not be loaded." onRetry={() => void cycles.refetch()} />
        </Card>
      ) : !cycle ? (
        <Card>
          <EmptyState
            icon={ChartLine}
            title="No cycle yet"
            description="Open an investment cycle to start tracking NAV."
          />
        </Card>
      ) : (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <label htmlFor="nav-cycle" className="text-muted">
              Cycle
            </label>
            <Select
              id="nav-cycle"
              value={cycle.id}
              onChange={(e) => setSp({ cycle: e.target.value }, { replace: true })}
              className="w-64"
            >
              {selectable.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.status})
                </option>
              ))}
            </Select>
          </div>

          {draft && (
            <p
              role="status"
              className="flex flex-wrap items-center gap-2 rounded-[var(--radius-control)] bg-warning-soft px-3 py-2 text-sm text-warning"
            >
              A draft NAV of <span className="num font-medium">{formatNav(draft.gross_nav_per_unit)}</span> is
              waiting to be reviewed.
              <Link to={`/admin/nav/snapshots/${draft.id}`} className="font-medium underline">
                Review and publish
              </Link>
            </p>
          )}

          <section aria-label="Latest published NAV" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Gross NAV per unit"
              term="grossNav"
              loading={snapshots.isPending}
              value={latest ? formatNav(latest.gross_nav_per_unit) : formatNav(cycle.base_nav)}
              meta={latest ? `as of ${formatDateTime(latest.nav_date)}` : 'Base NAV (nothing published yet)'}
              trend={
                change && latest
                  ? {
                      direction: change.startsWith('-') ? 'down' : 'up',
                      label: `${formatSignedPercent(change)} vs base`,
                    }
                  : undefined
              }
            />
            <StatCard
              label="Net asset value"
              loading={snapshots.isPending}
              value={latest ? formatINR(latest.gross_net_asset_value) : '—'}
              badge={<DemoBadge kind="manual" />}
            />
            <StatCard
              label="Outstanding units"
              term="outstandingUnits"
              loading={snapshots.isPending}
              value={latest ? formatUnits(latest.total_outstanding_units, { decimals: 4 }) : '—'}
            />
            <StatCard
              label="Net NAV per unit"
              term="netNav"
              loading={snapshots.isPending}
              value={latest?.net_nav_per_unit ? formatNav(latest.net_nav_per_unit) : '—'}
              meta={
                latest?.performance_fee_amount
                  ? `After ${formatINR(latest.performance_fee_amount)} indicative fee (weighted average)`
                  : 'After performance fee'
              }
            />
          </section>

          <Card>
            <CardHeader
              title="Gross NAV per unit"
              description="Published values only. Hover a point for its exact value."
            />
            <div className="px-2 py-4 sm:px-4">
              {snapshots.isPending ? (
                <TableSkeleton rows={4} columns={1} />
              ) : points.length === 0 ? (
                <p className="px-3 py-8 text-center text-sm text-muted">No published NAV yet.</p>
              ) : (
                <Suspense fallback={<TableSkeleton rows={4} columns={1} />}>
                  <NavHistoryChart points={points} baseNav={cycle.base_nav} />
                </Suspense>
              )}
            </div>
          </Card>

          <Card>
            <CardHeader
              title="NAV snapshots"
              description="Each snapshot references the approved valuation it was calculated from."
            />
            {snapshots.isPending ? (
              <TableSkeleton rows={4} columns={5} />
            ) : snapshots.isError ? (
              <ErrorState
                message="NAV snapshots could not be loaded."
                onRetry={() => void snapshots.refetch()}
              />
            ) : snapshots.data.length === 0 ? (
              <EmptyState
                icon={ChartLine}
                title="No NAV calculated yet"
                description="Approve a valuation in Portfolio, then calculate and publish NAV."
              />
            ) : (
              <Table caption="NAV snapshots" minWidth={760}>
                <THead>
                  <tr>
                    <TH>As of</TH>
                    <TH>Status</TH>
                    <TH numeric>Net asset value</TH>
                    <TH numeric>Outstanding units</TH>
                    <TH numeric>Gross NAV / unit</TH>
                    <TH>
                      <span className="sr-only">Open</span>
                    </TH>
                  </tr>
                </THead>
                <TBody>
                  {snapshots.data.map((s) => (
                    <TR key={s.id}>
                      <TD className="num font-medium">
                        <Link to={`/admin/nav/snapshots/${s.id}`} className="hover:underline">
                          {formatDateTime(s.nav_date)}
                        </Link>
                      </TD>
                      <TD>
                        <NavStatusBadge status={s.status} />
                      </TD>
                      <TD numeric>{formatINR(s.gross_net_asset_value)}</TD>
                      <TD numeric>{formatUnits(s.total_outstanding_units, { decimals: 4 })}</TD>
                      <TD numeric className="font-medium">
                        {formatNav(s.gross_nav_per_unit)}
                      </TD>
                      <TD align="right">
                        <Link
                          to={`/admin/nav/snapshots/${s.id}`}
                          className="inline-flex rounded p-1 text-muted hover:bg-navy-50 hover:text-ink"
                          aria-label={`Open NAV as of ${formatDateTime(s.nav_date)}`}
                        >
                          <ChevronRight aria-hidden="true" className="size-4" />
                        </Link>
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            )}
          </Card>
        </div>
      )}

      {calcOpen && cycle && <CalculateNavDialog cycleId={cycle.id} onClose={() => setCalcOpen(false)} />}
    </>
  );
}
