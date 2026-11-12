import { Clock, Lock, Percent } from 'lucide-react';
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
import { FeeExample } from '@/features/cycles/components/FeeExample';
import { FeeTermsTable } from '@/features/cycles/components/FeeTermsTable';
import { useCycles } from '@/features/cycles/queries';
import { rateToPercent } from '@/features/cycles/schemas';
import { useNavSnapshots } from '@/features/nav/queries';
import { formatDateTime, formatINR, formatNav, formatRateAsPercent } from '@/lib/format';
import { isUuid } from '@/lib/utils/uuid';
import { useCrystallisation, useLotAccruals, useRecordCrystallisation } from '../api';
import { LotAccrualTable } from '../components/LotAccrualTable';
import { summariseAccruals } from '../logic';

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
  const accruals = useLotAccruals(latest?.id ?? '');
  const crystallisation = useCrystallisation(cycleId);
  const record = useRecordCrystallisation(cycleId);
  const { toast } = useToast();
  const [crystalliseOpen, setCrystalliseOpen] = useState(false);
  const summary = accruals.data ? summariseAccruals(accruals.data) : null;

  return (
    <>
      <PageHeader
        title="Profit Sharing"
        description="Performance fee per contribution lot: a share of profit above each lot's starting NAV (high-water mark). Indicative only."
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
                title="Fee rate"
                description="Configured per cycle and versioned. Each lot keeps the rate in force when it was issued."
                actions={
                  <Button size="sm" variant="secondary" asChild>
                    <Link to={`/admin/cycles/${cycle.id}`}>Change rate</Link>
                  </Button>
                }
              />
              <CardContent className="border-b border-line">
                <p className="num text-2xl font-semibold">{formatRateAsPercent(cycle.current_fee_rate)}</p>
                <p className="text-xs text-muted">
                  Version {cycle.current_fee_version ?? '—'} · effective since{' '}
                  {formatDateTime(cycle.current_fee_effective_from)}
                </p>
                {cycle.pending_fee_rate && (
                  <p className="mt-2 flex items-center gap-1.5 text-sm text-warning">
                    <Clock aria-hidden="true" className="size-4" />
                    Changes to {formatRateAsPercent(cycle.pending_fee_rate)} on{' '}
                    {formatDateTime(cycle.pending_fee_effective_from)}
                  </p>
                )}
              </CardContent>
              <FeeTermsTable
                cycle={cycle}
                canChange={cycle.status !== 'closed' && cycle.status !== 'settled'}
              />
            </Card>

            <Card>
              <CardHeader title="How the fee works" as="h2" />
              <CardContent className="space-y-3 text-sm">
                <p>
                  Each contribution lot starts with a <strong>high-water mark (HWM)</strong> equal to the NAV
                  it was issued at.
                </p>
                <ul className="list-disc space-y-1 pl-5 text-muted">
                  <li>Eligible profit per unit = NAV − HWM, never below zero.</li>
                  <li>Fee = eligible profit × units × the lot's fee rate.</li>
                  <li>Below the HWM there is no fee; the shortfall must be recovered first.</li>
                  <li>Later entrants are never charged for gains made before they joined.</li>
                  <li>Fees are accrued (indicative) during the cycle; nothing is deducted or paid.</li>
                </ul>
                {cycle.current_fee_rate && <FeeExample percent={rateToPercent(cycle.current_fee_rate)} />}
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
                description="Fees are accrued when a NAV is published."
                action={
                  <Button size="sm" variant="secondary" asChild>
                    <Link to={`/admin/nav?cycle=${cycle.id}`}>Go to NAV & Performance</Link>
                  </Button>
                }
              />
            </Card>
          ) : (
            <>
              <section
                aria-label="Fee accrual at the latest NAV"
                className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
              >
                <StatCard
                  label="Gross NAV per unit"
                  term="grossNav"
                  value={formatNav(latest.gross_nav_per_unit)}
                  meta={`as of ${formatDateTime(latest.nav_date)}`}
                />
                <StatCard
                  label="Indicative fee accrued"
                  term="performanceFee"
                  value={formatINR(latest.performance_fee_amount ?? '0')}
                  meta={summary ? `${summary.lotsWithFee} of ${summary.lots} lot(s) above HWM` : undefined}
                />
                <StatCard
                  label="Net NAV per unit"
                  term="netNav"
                  value={formatNav(latest.net_nav_per_unit)}
                  meta="Weighted average across lots"
                />
                <StatCard
                  label="Loss to recover"
                  loading={!summary}
                  value={summary ? formatINR(summary.lossToRecover) : '—'}
                  meta={summary ? `${summary.lotsBelowHwm} lot(s) below HWM` : undefined}
                />
              </section>

              <Card>
                <CardHeader
                  title="Fee per contribution lot"
                  description={`At the NAV published for ${formatDateTime(latest.nav_date)}. Calculated by the server and frozen on publish.`}
                />
                <LotAccrualTable snapshotId={latest.id} />
              </Card>
            </>
          )}

          {cycle.status === 'closed' || cycle.status === 'settled' ? (
            <Card>
              <CardHeader
                title="Final fee at cycle close"
                description="Informational record only. No money is deducted, paid or settled by the app."
              />
              <CardContent>
                {crystallisation.data ? (
                  <dl className="grid gap-4 text-sm sm:grid-cols-3">
                    <div>
                      <dt className="text-muted">Final indicative fee</dt>
                      <dd className="mt-0.5 num text-lg font-semibold">
                        {formatINR(crystallisation.data.total_fee_amount)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted">Net NAV per unit</dt>
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
                      Record the fee at the closing NAV (
                      {latest ? formatDateTime(latest.nav_date) : 'none published'}).
                    </p>
                    <Button onClick={() => setCrystalliseOpen(true)} disabled={!latest}>
                      <Lock aria-hidden="true" className="size-4" />
                      Record final fee
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
          title="Record the final fee for this cycle?"
          description="Uses the latest published NAV. This is an informational record; it can be made once and cannot be changed."
          confirmLabel="Record final fee"
          requireReason
          reasonLabel="Note (recorded in the audit log)"
          onConfirm={async (note) => {
            await record.mutateAsync(note);
            toast({ title: 'Final fee recorded' });
          }}
        />
      )}
    </>
  );
}
