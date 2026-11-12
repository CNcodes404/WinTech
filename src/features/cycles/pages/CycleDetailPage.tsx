import { ChevronLeft, Clock, Pencil, Percent } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge, type BadgeTone } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { LoadingRegion, Skeleton, TableSkeleton } from '@/components/ui/Skeleton';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/Table';
import { useToast } from '@/components/ui/toast-context';
import { InfoTip } from '@/components/ui/Tooltip';
import { EntityHistory } from '@/features/audit/EntityHistory';
import { CycleUnitStats } from '@/features/contributions/components/CycleUnitStats';
import { formatDate, formatDateTime, formatNav, formatRateAsPercent } from '@/lib/format';
import { isUuid } from '@/lib/utils/uuid';
import { ChangeFeeDialog } from '../components/ChangeFeeDialog';
import { CycleStatusBadge } from '../components/CycleStatusBadge';
import { EditCycleDialog } from '../components/EditCycleDialog';
import { classifyFeeTerms, describeCycleEntry } from '../logic';
import { useCancelFeeTerms, useCycle, useFeeTerms, useSetCycleStatus } from '../queries';
import { NEXT_STATUS, type CycleOverview, type FeeTerms, type FeeTermsState } from '../types';

const TERMS_BADGE: Record<FeeTermsState, { tone: BadgeTone; label: string }> = {
  current: { tone: 'success', label: 'Current' },
  scheduled: { tone: 'warning', label: 'Scheduled' },
  superseded: { tone: 'neutral', label: 'Superseded' },
  cancelled: { tone: 'danger', label: 'Cancelled' },
};

function BackLink() {
  return (
    <Link
      to="/admin/cycles"
      className="mb-3 inline-flex items-center gap-1 text-sm font-medium text-muted hover:text-ink"
    >
      <ChevronLeft aria-hidden="true" className="size-4" />
      All cycles
    </Link>
  );
}

function FeeTermsTable({ cycle, canChange }: { cycle: CycleOverview; canChange: boolean }) {
  const { data, isPending, isError, refetch } = useFeeTerms(cycle.id);
  const cancel = useCancelFeeTerms();
  const { toast } = useToast();
  const [toCancel, setToCancel] = useState<FeeTerms | null>(null);

  if (isPending) return <TableSkeleton rows={2} columns={4} />;
  if (isError)
    return <ErrorState message="The fee history could not be loaded." onRetry={() => void refetch()} />;

  const states = classifyFeeTerms(data);
  return (
    <>
      <Table caption="Fee rate versions" minWidth={640}>
        <THead>
          <tr>
            <TH>Version</TH>
            <TH numeric>Rate</TH>
            <TH>Effective from</TH>
            <TH>Reason</TH>
            <TH>Status</TH>
          </tr>
        </THead>
        <TBody>
          {data.map((t) => {
            const state = states.get(t.id) ?? 'superseded';
            return (
              <TR key={t.id}>
                <TD className="num">v{t.version}</TD>
                <TD numeric className="font-medium">
                  {formatRateAsPercent(t.performance_fee_rate)}
                </TD>
                <TD className="num text-muted">{formatDateTime(t.effective_from)}</TD>
                <TD className="max-w-xs text-muted">
                  <span className="line-clamp-2">{t.reason}</span>
                  {t.cancel_reason && (
                    <span className="mt-0.5 block text-xs">Cancelled: {t.cancel_reason}</span>
                  )}
                </TD>
                <TD>
                  <div className="flex items-center gap-2">
                    <Badge tone={TERMS_BADGE[state].tone}>{TERMS_BADGE[state].label}</Badge>
                    {state === 'scheduled' && canChange && (
                      <Button variant="ghost" size="sm" onClick={() => setToCancel(t)}>
                        Cancel
                      </Button>
                    )}
                  </div>
                </TD>
              </TR>
            );
          })}
        </TBody>
      </Table>
      {toCancel && (
        <ConfirmDialog
          open
          onOpenChange={(open) => !open && setToCancel(null)}
          title={`Cancel scheduled change to ${formatRateAsPercent(toCancel.performance_fee_rate)}?`}
          description={`Version ${toCancel.version} will not take effect. The record is kept for the audit trail.`}
          confirmLabel="Cancel scheduled change"
          tone="danger"
          requireReason
          onConfirm={async (reason) => {
            await cancel.mutateAsync({ termsId: toCancel.id, reason });
            toast({ title: 'Scheduled fee change cancelled' });
          }}
        />
      )}
    </>
  );
}

export function CycleDetailPage() {
  const { cycleId = '' } = useParams();
  const { data: cycle, isPending, isError, refetch } = useCycle(cycleId);
  const setStatus = useSetCycleStatus(cycleId);
  const { toast } = useToast();
  const [editOpen, setEditOpen] = useState(false);
  const [feeOpen, setFeeOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);

  if (!isUuid(cycleId) || (!isPending && !isError && !cycle)) {
    return (
      <>
        <BackLink />
        <Card>
          <EmptyState title="Cycle not found" description="This cycle does not exist." />
        </Card>
      </>
    );
  }
  if (isPending) {
    return (
      <LoadingRegion label="Loading cycle">
        <BackLink />
        <Skeleton className="h-8 w-72" />
        <Skeleton className="mt-6 h-40" />
      </LoadingRegion>
    );
  }
  if (isError || !cycle) {
    return (
      <>
        <BackLink />
        <Card>
          <ErrorState message="This cycle could not be loaded." onRetry={() => void refetch()} />
        </Card>
      </>
    );
  }

  const step = NEXT_STATUS[cycle.status];
  const editable = cycle.status !== 'closed' && cycle.status !== 'settled';

  return (
    <>
      <BackLink />
      <PageHeader
        title={cycle.name}
        badges={<CycleStatusBadge status={cycle.status} />}
        description={cycle.description ?? undefined}
        actions={
          <>
            {editable && (
              <Button variant="secondary" onClick={() => setEditOpen(true)}>
                <Pencil aria-hidden="true" className="size-4" />
                Edit
              </Button>
            )}
            {step && (
              <Button
                variant={step.tone === 'danger' ? 'danger' : 'primary'}
                onClick={() => setStatusOpen(true)}
              >
                {step.action}
              </Button>
            )}
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <CycleUnitStats cycleId={cycle.id} />
          <Card>
            <CardHeader title="Summary" />
            <CardContent>
              <dl className="grid gap-x-6 gap-y-4 text-sm sm:grid-cols-3">
                <div>
                  <dt className="text-muted">Period</dt>
                  <dd className="mt-0.5 num font-medium">
                    {formatDate(cycle.start_date)} – {formatDate(cycle.end_date)}
                  </dd>
                </div>
                <div>
                  <dt className="flex items-center gap-1 text-muted">
                    Base NAV <InfoTip term="nav" />
                  </dt>
                  <dd className="mt-0.5 num font-medium">{formatNav(cycle.base_nav, { decimals: 8 })}</dd>
                </div>
                <div>
                  <dt className="text-muted">Currency</dt>
                  <dd className="mt-0.5 font-medium">{cycle.currency}</dd>
                </div>
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader
              title="Performance fee"
              description="Versioned rates. Each contribution lot keeps the rate in force when it was issued."
              actions={
                editable && (
                  <Button size="sm" variant="secondary" onClick={() => setFeeOpen(true)}>
                    <Percent aria-hidden="true" className="size-4" />
                    Change rate
                  </Button>
                )
              }
            />
            <CardContent className="space-y-1 border-b border-line">
              <p className="text-sm text-muted">Current rate</p>
              <p className="num text-2xl font-semibold">{formatRateAsPercent(cycle.current_fee_rate)}</p>
              <p className="text-xs text-muted">
                Version {cycle.current_fee_version ?? '—'} · effective since{' '}
                {formatDateTime(cycle.current_fee_effective_from)}
              </p>
              {cycle.pending_fee_rate && cycle.pending_fee_effective_from && (
                <p className="mt-2 flex items-center gap-1.5 text-sm text-warning">
                  <Clock aria-hidden="true" className="size-4" />
                  Changes to{' '}
                  <span className="num font-medium">
                    {formatRateAsPercent(cycle.pending_fee_rate)}
                  </span> on {formatDateTime(cycle.pending_fee_effective_from)}
                </p>
              )}
            </CardContent>
            <FeeTermsTable cycle={cycle} canChange={editable} />
          </Card>
        </div>

        <Card className="h-fit">
          <CardHeader title="Cycle history" description="From the audit log." />
          <EntityHistory entityType="cycle" entityId={cycle.id} describe={describeCycleEntry} />
        </Card>
      </div>

      {editOpen && <EditCycleDialog cycle={cycle} onClose={() => setEditOpen(false)} />}
      {feeOpen && <ChangeFeeDialog cycle={cycle} onClose={() => setFeeOpen(false)} />}
      {step && (
        <ConfirmDialog
          open={statusOpen}
          onOpenChange={setStatusOpen}
          title={step.title}
          description={step.description}
          confirmLabel={step.action}
          tone={step.tone}
          requireReason
          onConfirm={async (reason) => {
            await setStatus.mutateAsync({ status: step.next, reason });
            toast({ title: `Cycle is now ${step.next}` });
          }}
        />
      )}
    </>
  );
}
