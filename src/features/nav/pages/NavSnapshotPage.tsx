import { ChevronLeft, FilePenLine, Send, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { DemoBadge } from '@/components/ui/DemoBadge';
import { LoadingRegion, Skeleton } from '@/components/ui/Skeleton';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { useToast } from '@/components/ui/toast-context';
import { InfoTip } from '@/components/ui/Tooltip';
import { EntityHistory } from '@/features/audit/EntityHistory';
import { useCycle } from '@/features/cycles/queries';
import { LotAccrualTable } from '@/features/fees/components/LotAccrualTable';
import { PositionTable } from '@/features/fees/components/PositionTable';
import { useValuation } from '@/features/portfolio/queries';
import {
  formatDateTime,
  formatINR,
  formatNav,
  formatRateAsPercent,
  formatSignedINR,
  formatUnits,
} from '@/lib/format';
import { isUuid } from '@/lib/utils/uuid';
import { CalculateNavDialog } from '../components/CalculateNavDialog';
import { NavStatusBadge } from '../components/NavStatusBadge';
import { describeNavEntry } from '../logic';
import { useDiscardNav, useNavSnapshot, usePublishNav } from '../queries';
import { clientNav, FUND_LEVEL } from '../types';

export function NavSnapshotPage() {
  const { snapshotId = '' } = useParams();
  const { data: s, isPending, isError, refetch } = useNavSnapshot(snapshotId);
  const valuation = useValuation(s?.valuation_id ?? '');
  const cycle = useCycle(s?.cycle_id ?? '');
  const publish = usePublishNav(snapshotId);
  const discard = useDiscardNav(snapshotId);
  const { toast } = useToast();
  const [publishOpen, setPublishOpen] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [correctOpen, setCorrectOpen] = useState(false);

  const back = (
    <Link
      to={s ? `/admin/nav?cycle=${s.cycle_id}` : '/admin/nav'}
      className="mb-3 inline-flex items-center gap-1 text-sm font-medium text-muted hover:text-ink"
    >
      <ChevronLeft aria-hidden="true" className="size-4" />
      NAV & Performance
    </Link>
  );

  if (!isUuid(snapshotId) || (!isPending && !isError && !s)) {
    return (
      <>
        {back}
        <Card>
          <EmptyState title="NAV snapshot not found" />
        </Card>
      </>
    );
  }
  if (isPending) {
    return (
      <LoadingRegion label="Loading NAV">
        {back}
        <Skeleton className="h-8 w-72" />
        <Skeleton className="mt-6 h-64" />
      </LoadingRegion>
    );
  }
  if (isError || !s) {
    return (
      <>
        {back}
        <Card>
          <ErrorState message="This NAV could not be loaded." onRetry={() => void refetch()} />
        </Card>
      </>
    );
  }

  const v = valuation.data?.valuation;
  const fundLevel = s.calculation_version === FUND_LEVEL;
  const rows: [string, string][] = v
    ? [
        ['Holdings value', formatINR(v.holdings_value)],
        ['+ Cash balance', formatINR(v.cash_balance)],
        ['+ Other assets', formatINR(v.other_assets)],
        ['− Liabilities', formatINR(v.liabilities)],
      ]
    : [];

  return (
    <>
      {back}
      <PageHeader
        title={`NAV as of ${formatDateTime(s.nav_date)}`}
        badges={
          <>
            <NavStatusBadge status={s.status} />
            <DemoBadge kind="manual" />
          </>
        }
        description={cycle.data ? `Cycle: ${cycle.data.name}` : undefined}
        actions={
          s.status === 'draft' ? (
            <>
              <Button variant="ghost" onClick={() => setDiscardOpen(true)}>
                <Trash2 aria-hidden="true" className="size-4" />
                Discard
              </Button>
              <Button onClick={() => setPublishOpen(true)}>
                <Send aria-hidden="true" className="size-4" />
                Publish NAV
              </Button>
            </>
          ) : s.status === 'published' ? (
            <Button variant="secondary" onClick={() => setCorrectOpen(true)}>
              <FilePenLine aria-hidden="true" className="size-4" />
              Correct this NAV
            </Button>
          ) : null
        }
      />

      {s.status === 'corrected' && s.corrected_by_snapshot_id && (
        <p className="mb-4 rounded-[var(--radius-control)] bg-surface-muted px-3 py-2 text-sm">
          This NAV was replaced by a{' '}
          <Link
            to={`/admin/nav/snapshots/${s.corrected_by_snapshot_id}`}
            className="font-medium text-emerald-700 hover:underline"
          >
            published correction
          </Link>{' '}
          on {formatDateTime(s.corrected_at)}. Units already issued at this NAV were not changed.
        </p>
      )}
      {s.corrects_snapshot_id && (
        <p className="mb-4 rounded-[var(--radius-control)] bg-surface-muted px-3 py-2 text-sm">
          Correction of{' '}
          <Link
            to={`/admin/nav/snapshots/${s.corrects_snapshot_id}`}
            className="font-medium text-emerald-700 hover:underline"
          >
            an earlier NAV
          </Link>{' '}
          for the same date.
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader
              title="Calculation breakdown"
              description="Every input comes from the referenced approved valuation and the unit ledger."
            />
            <CardContent>
              <dl className="space-y-2 text-sm">
                {rows.map(([k, val]) => (
                  <div key={k} className="flex justify-between gap-3">
                    <dt className="text-muted">{k}</dt>
                    <dd className="num">{val}</dd>
                  </div>
                ))}
                <div className="flex justify-between gap-3 border-t border-line pt-2">
                  <dt className="font-medium">Net asset value</dt>
                  <dd className="num font-medium">{formatINR(s.gross_net_asset_value)}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="flex items-center gap-1 font-medium">
                    ÷ Outstanding units <InfoTip term="outstandingUnits" />
                  </dt>
                  <dd className="num font-medium">{formatUnits(s.total_outstanding_units)}</dd>
                </div>
                <div className="flex justify-between gap-3 border-t border-line pt-2">
                  <dt className="flex items-center gap-1 font-medium">
                    = {fundLevel ? 'Market NAV per unit' : 'Gross NAV per unit'} <InfoTip term="grossNav" />
                  </dt>
                  <dd className="num font-medium">{formatNav(s.gross_nav_per_unit, { decimals: 8 })}</dd>
                </div>
                {fundLevel && s.performance_fee_amount !== null && (
                  <>
                    <div className="flex justify-between gap-3 pt-4">
                      <dt className="text-muted">Net asset value</dt>
                      <dd className="num">{formatINR(s.gross_net_asset_value)}</dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-muted">− Money invested (as of this NAV)</dt>
                      <dd className="num">{formatINR(s.net_contributed)}</dd>
                    </div>
                    <div className="flex justify-between gap-3 border-t border-line pt-2">
                      <dt className="font-medium">= Cycle profit</dt>
                      <dd className="num font-medium">{formatSignedINR(s.profit_before_fee)}</dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="flex items-center gap-1 text-muted">
                        Performance fee ({formatRateAsPercent(s.performance_fee_rate)} of profit, none on a
                        loss) <InfoTip term="performanceFee" />
                      </dt>
                      <dd className="num">{formatINR(s.performance_fee_amount)}</dd>
                    </div>
                    <div className="flex justify-between gap-3 border-t border-line pt-2 text-base">
                      <dt className="flex items-center gap-1 font-semibold">
                        NAV = (net asset value − fee) ÷ units <InfoTip term="netNav" />
                      </dt>
                      <dd className="num font-semibold">{formatNav(s.net_nav_per_unit, { decimals: 8 })}</dd>
                    </div>
                  </>
                )}
                {!fundLevel && s.performance_fee_amount !== null && (
                  <>
                    <div className="flex justify-between gap-3 pt-2">
                      <dt className="flex items-center gap-1 text-muted">
                        − Indicative performance fee (all lots) <InfoTip term="performanceFee" />
                      </dt>
                      <dd className="num">{formatINR(s.performance_fee_amount)}</dd>
                    </div>
                    <div className="flex justify-between gap-3 border-t border-line pt-2">
                      <dt className="flex items-center gap-1 font-medium">
                        = Net NAV per unit (weighted average) <InfoTip term="netNav" />
                      </dt>
                      <dd className="num font-medium">{formatNav(s.net_nav_per_unit, { decimals: 8 })}</dd>
                    </div>
                  </>
                )}
              </dl>
              <p className="mt-4 text-xs text-muted">
                Units and money invested are those on the ledger at the valuation time. NAV is rounded half-up
                to 8 decimals.{' '}
                {fundLevel
                  ? 'Clients see only the NAV after the performance fee, never the fee itself.'
                  : 'Earlier per-lot method: the fee was accrued per contribution lot above its starting NAV.'}{' '}
                <Link
                  to={`/admin/portfolio/valuations/${s.valuation_id}`}
                  className="font-medium text-emerald-700 hover:underline"
                >
                  View the valuation
                </Link>
                .
              </p>
            </CardContent>
          </Card>
          {fundLevel ? (
            <Card>
              <CardHeader
                title="Client positions at this NAV"
                description="Value, profit and admin fee per client. The admin fee shown is the cycle's current fee."
              />
              <PositionTable snapshotId={s.id} />
            </Card>
          ) : (
            <Card>
              <CardHeader
                title="Fee per contribution lot"
                description="Indicative accrual at this NAV (earlier per-lot method). Frozen once published."
              />
              <LotAccrualTable snapshotId={s.id} />
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Details" />
            <CardContent>
              <dl className="space-y-2 text-sm">
                <div>
                  <dt className="text-muted">Calculated</dt>
                  <dd className="num">{formatDateTime(s.calculated_at)}</dd>
                </div>
                <div>
                  <dt className="text-muted">Published</dt>
                  <dd className="num">{s.published_at ? formatDateTime(s.published_at) : 'Not published'}</dd>
                </div>
                {s.publish_reason && (
                  <div>
                    <dt className="text-muted">Publish note</dt>
                    <dd>{s.publish_reason}</dd>
                  </div>
                )}
                <div>
                  <dt className="text-muted">Method</dt>
                  <dd>{s.calculation_version}</dd>
                </div>
              </dl>
            </CardContent>
          </Card>
          <Card>
            <CardHeader title="History" description="From the audit log." />
            <EntityHistory entityType="nav_snapshot" entityId={s.id} describe={describeNavEntry} />
          </Card>
        </div>
      </div>

      <ConfirmDialog
        open={publishOpen}
        onOpenChange={setPublishOpen}
        title="Publish this NAV?"
        description="It becomes permanent, clients see it, and money received from the next day is converted to units at it. Corrections create a new snapshot."
        confirmLabel="Publish NAV"
        requireReason
        reasonLabel="Publish note (recorded in the audit log)"
        onConfirm={async (reason) => {
          await publish.mutateAsync(reason);
          toast({ title: 'NAV published', description: formatNav(clientNav(s), { decimals: 8 }) });
        }}
      >
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-[var(--radius-control)] bg-surface-muted p-3 text-sm">
          <dt className="text-muted">As of</dt>
          <dd className="text-right num">{formatDateTime(s.nav_date)}</dd>
          <dt className="text-muted">Market NAV</dt>
          <dd className="text-right num">{formatNav(s.gross_nav_per_unit, { decimals: 8 })}</dd>
          {fundLevel && (
            <>
              <dt className="text-muted">Performance fee</dt>
              <dd className="text-right num">{formatINR(s.performance_fee_amount)}</dd>
            </>
          )}
          <dt className="text-muted">NAV clients see</dt>
          <dd className="text-right num font-semibold">{formatNav(clientNav(s), { decimals: 8 })}</dd>
        </dl>
      </ConfirmDialog>
      <ConfirmDialog
        open={discardOpen}
        onOpenChange={setDiscardOpen}
        title="Discard this draft NAV?"
        description="It will not be published. The record is kept as discarded."
        confirmLabel="Discard draft"
        tone="danger"
        requireReason
        onConfirm={async (reason) => {
          await discard.mutateAsync(reason);
          toast({ title: 'Draft NAV discarded' });
        }}
      />
      {correctOpen && (
        <CalculateNavDialog cycleId={s.cycle_id} correcting={s} onClose={() => setCorrectOpen(false)} />
      )}
    </>
  );
}
