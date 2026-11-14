import { Clock, IndianRupee, Lock, Percent } from 'lucide-react';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { DemoBadge } from '@/components/ui/DemoBadge';
import { Select } from '@/components/ui/Form';
import { TableSkeleton } from '@/components/ui/Skeleton';
import { StatCard } from '@/components/ui/StatCard';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { useToast } from '@/components/ui/toast-context';
import { AdminFeeDialog } from '@/features/cycles/components/AdminFeeDialog';
import { FeeExample } from '@/features/cycles/components/FeeExample';
import { FeeTermsTable } from '@/features/cycles/components/FeeTermsTable';
import { useCycles } from '@/features/cycles/queries';
import { rateToPercent } from '@/features/cycles/schemas';
import { feeRateEditable } from '@/features/cycles/types';
import { useNavSnapshots } from '@/features/nav/queries';
import { clientNav, FUND_LEVEL } from '@/features/nav/types';
import { formatDateTime, formatINR, formatNav, formatRateAsPercent, formatSignedINR } from '@/lib/format';
import { isUuid } from '@/lib/utils/uuid';
import { useCrystallisation, usePositions, useRecordCrystallisation } from '../api';
import { LotAccrualTable } from '../components/LotAccrualTable';
import { PositionTable } from '../components/PositionTable';
import { summarisePositions } from '../logic';

export function ProfitSharingPage() {
  const [sp, setSp] = useSearchParams();
  const cycles = useCycles();
  const selectable = (cycles.data ?? []).filter((c) => c.status !== 'draft');
  const cycle =
    selectable.find((c) => c.id === sp.get('cycle')) ??
    selectable.find((c) => c.status === 'active' || c.status === 'open') ??
    selectable[0];
  const cycleId = cycle?.id ?? '';
  const snapshots = useNavSnapshots(isUuid(cycleId) ? cycleId : '');
  const latest = snapshots.data?.find((s) => s.status === 'published');
  const fundLevel = latest?.calculation_version === FUND_LEVEL;
  const positions = usePositions(fundLevel ? latest.id : '');
  const crystallisation = useCrystallisation(cycleId);
  const record = useRecordCrystallisation(cycleId);
  const { toast } = useToast();
  const [crystalliseOpen, setCrystalliseOpen] = useState(false);
  const [adminFeeOpen, setAdminFeeOpen] = useState(false);
  const summary = positions.data ? summarisePositions(positions.data) : null;

  return (
    <>
      <PageHeader
        title="Profit Sharing"
        description="Performance fee on each cycle's total profit (never shown to clients) and the flat admin fee per client (shown to clients). Indicative only."
        badges={<DemoBadge />}
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
            icon={Percent}
            title="No cycle yet"
            description="Open an investment cycle to see fees."
          />
        </Card>
      ) : (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <label htmlFor="fees-cycle" className="text-muted">
              Cycle
            </label>
            <Select
              id="fees-cycle"
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

          <div className="grid gap-6 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader
                title="Fees for this cycle"
                description="The performance fee can be changed until trading starts. The admin fee can be changed until the cycle is settled."
                actions={
                  <div className="flex flex-wrap gap-2">
                    {cycle.status !== 'settled' && (
                      <Button size="sm" variant="secondary" onClick={() => setAdminFeeOpen(true)}>
                        <IndianRupee aria-hidden="true" className="size-4" />
                        Change admin fee
                      </Button>
                    )}
                    {feeRateEditable(cycle.status) && (
                      <Button size="sm" variant="secondary" asChild>
                        <Link to={`/admin/cycles/${cycle.id}`}>Change performance fee</Link>
                      </Button>
                    )}
                  </div>
                }
              />
              <CardContent className="grid gap-4 border-b border-line sm:grid-cols-2">
                <div>
                  <p className="text-sm text-muted">Performance fee (admin only)</p>
                  <p className="num text-2xl font-semibold">{formatRateAsPercent(cycle.current_fee_rate)}</p>
                  <p className="text-xs text-muted">
                    of the cycle's profit · version {cycle.current_fee_version ?? '—'}
                    {!feeRateEditable(cycle.status) && (
                      <span className="ml-1 inline-flex items-center gap-0.5">
                        · <Lock aria-hidden="true" className="size-3" /> locked
                      </span>
                    )}
                  </p>
                  {cycle.pending_fee_rate && (
                    <p className="mt-2 flex items-center gap-1.5 text-sm text-warning">
                      <Clock aria-hidden="true" className="size-4" />
                      Changes to {formatRateAsPercent(cycle.pending_fee_rate)} on{' '}
                      {formatDateTime(cycle.pending_fee_effective_from)}
                    </p>
                  )}
                </div>
                <div>
                  <p className="text-sm text-muted">Admin fee (clients see it)</p>
                  <p className="num text-2xl font-semibold">{formatINR(cycle.admin_fee_amount)}</p>
                  <p className="text-xs text-muted">per client for this cycle, even without profit</p>
                </div>
              </CardContent>
              <FeeTermsTable cycle={cycle} canChange={feeRateEditable(cycle.status)} />
            </Card>

            <Card>
              <CardHeader title="How the fees work" as="h2" />
              <CardContent className="space-y-3 text-sm">
                <ol className="list-decimal space-y-1 pl-5 text-muted">
                  <li>Cycle profit = net asset value − all money invested.</li>
                  <li>Performance fee = profit × rate. No fee when there is no profit.</li>
                  <li>
                    <strong className="text-ink">NAV</strong> = (net asset value − performance fee) ÷ units.
                    One NAV for every client; this is the NAV clients see.
                  </li>
                  <li>Each client's profit = units × NAV − money they invested.</li>
                  <li>The admin fee is then deducted to give the client's final profit.</li>
                </ol>
                <p className="text-xs text-muted">
                  Clients never see the performance fee. With money added mid-cycle, a single NAV shares the
                  fee across clients, so value can shift slightly between early and later clients.
                </p>
                {cycle.current_fee_rate && (
                  <FeeExample
                    percent={rateToPercent(cycle.current_fee_rate)}
                    adminFee={cycle.admin_fee_amount}
                  />
                )}
              </CardContent>
            </Card>
          </div>

          {snapshots.isPending ? (
            <Card>
              <TableSkeleton rows={4} columns={6} />
            </Card>
          ) : !latest ? (
            <Card>
              <EmptyState
                icon={Percent}
                title="No published NAV yet"
                description="Fees are calculated when a NAV is published."
                action={
                  <Button size="sm" variant="secondary" asChild>
                    <Link to={`/admin/nav?cycle=${cycle.id}`}>Go to NAV & Performance</Link>
                  </Button>
                }
              />
            </Card>
          ) : fundLevel ? (
            <>
              <section
                aria-label="Fees at the latest NAV"
                className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
              >
                <StatCard
                  label="Cycle profit"
                  value={formatSignedINR(latest.profit_before_fee)}
                  meta={`as of ${formatDateTime(latest.nav_date)}`}
                />
                <StatCard
                  label="Performance fee"
                  term="performanceFee"
                  value={formatINR(latest.performance_fee_amount ?? '0')}
                  meta={`${formatRateAsPercent(latest.performance_fee_rate)} of profit · admin only`}
                />
                <StatCard
                  label="NAV per unit"
                  term="netNav"
                  value={formatNav(clientNav(latest))}
                  meta={`Market NAV ${formatNav(latest.gross_nav_per_unit)}`}
                />
                <StatCard
                  label="Admin fees"
                  term="adminFee"
                  loading={!summary}
                  value={summary ? formatINR(summary.adminFees) : '—'}
                  meta={
                    summary
                      ? `${summary.clients} client(s) × ${formatINR(cycle.admin_fee_amount)}`
                      : undefined
                  }
                />
              </section>

              <Card>
                <CardHeader
                  title="Client positions at the latest NAV"
                  description={`At the NAV published for ${formatDateTime(latest.nav_date)}. Calculated by the server.`}
                />
                <PositionTable snapshotId={latest.id} />
              </Card>
            </>
          ) : (
            <Card>
              <CardHeader
                title="Fee per contribution lot"
                description="This NAV used the earlier per-lot method. New NAVs use the cycle-profit method."
              />
              <LotAccrualTable snapshotId={latest.id} />
            </Card>
          )}

          {cycle.status === 'closed' || cycle.status === 'settled' ? (
            <Card>
              <CardHeader
                title="Final fees at cycle close"
                description="Informational record only. No money is deducted, paid or settled by the app."
              />
              <CardContent>
                {crystallisation.data ? (
                  <dl className="grid gap-4 text-sm sm:grid-cols-4">
                    <div>
                      <dt className="text-muted">Final performance fee</dt>
                      <dd className="mt-0.5 num text-lg font-semibold">
                        {formatINR(crystallisation.data.total_fee_amount)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted">Admin fees</dt>
                      <dd className="mt-0.5 num text-lg font-semibold">
                        {formatINR(crystallisation.data.admin_fee_total)}
                      </dd>
                      <dd className="text-xs text-muted">
                        {crystallisation.data.clients_charged} client(s) ×{' '}
                        {formatINR(crystallisation.data.admin_fee_per_client)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted">Closing NAV per unit</dt>
                      <dd className="mt-0.5 num text-lg font-semibold">
                        {formatNav(crystallisation.data.net_nav_per_unit)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted">Recorded</dt>
                      <dd className="mt-0.5">{formatDateTime(crystallisation.data.recorded_at)}</dd>
                      <dd className="text-muted">{crystallisation.data.note}</dd>
                    </div>
                  </dl>
                ) : (
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm text-muted">
                      Record the fees at the closing NAV (
                      {latest ? formatDateTime(latest.nav_date) : 'none published'}).
                    </p>
                    <Button onClick={() => setCrystalliseOpen(true)} disabled={!latest}>
                      <Lock aria-hidden="true" className="size-4" />
                      Record final fees
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : null}
        </div>
      )}

      {cycle && (
        <ConfirmDialog
          open={crystalliseOpen}
          onOpenChange={setCrystalliseOpen}
          title="Record the final fees for this cycle?"
          description="Uses the latest published NAV and the current admin fee. This is an informational record; it can be made once and cannot be changed."
          confirmLabel="Record final fees"
          requireReason
          reasonLabel="Note (recorded in the audit log)"
          onConfirm={async (note) => {
            await record.mutateAsync(note);
            toast({ title: 'Final fees recorded' });
          }}
        />
      )}
      {cycle && adminFeeOpen && <AdminFeeDialog cycle={cycle} onClose={() => setAdminFeeOpen(false)} />}
    </>
  );
}
