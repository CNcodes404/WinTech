import { ChevronLeft, Clock, IndianRupee, Lock, Pencil, Percent } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { LoadingRegion, Skeleton } from '@/components/ui/Skeleton';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { useToast } from '@/components/ui/toast-context';
import { InfoTip } from '@/components/ui/Tooltip';
import { EntityHistory } from '@/features/audit/EntityHistory';
import { CycleUnitStats } from '@/features/contributions/components/CycleUnitStats';
import { formatDate, formatDateTime, formatINR, formatNav, formatRateAsPercent } from '@/lib/format';
import { isUuid } from '@/lib/utils/uuid';
import { AdminFeeDialog } from '../components/AdminFeeDialog';
import { ChangeFeeDialog } from '../components/ChangeFeeDialog';
import { CycleStatusBadge } from '../components/CycleStatusBadge';
import { EditCycleDialog } from '../components/EditCycleDialog';
import { FeeTermsTable } from '../components/FeeTermsTable';
import { describeCycleEntry } from '../logic';
import { useCycle, useSetCycleStatus } from '../queries';
import { feeRateEditable, NEXT_STATUS } from '../types';

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

export function CycleDetailPage() {
  const { cycleId = '' } = useParams();
  const { data: cycle, isPending, isError, refetch } = useCycle(cycleId);
  const setStatus = useSetCycleStatus(cycleId);
  const { toast } = useToast();
  const [editOpen, setEditOpen] = useState(false);
  const [feeOpen, setFeeOpen] = useState(false);
  const [adminFeeOpen, setAdminFeeOpen] = useState(false);
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
  const rateEditable = feeRateEditable(cycle.status);

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
              description="Taken from the cycle’s total profit before the NAV is calculated. Never shown to clients."
              actions={
                rateEditable ? (
                  <Button size="sm" variant="secondary" onClick={() => setFeeOpen(true)}>
                    <Percent aria-hidden="true" className="size-4" />
                    Change rate
                  </Button>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs text-muted">
                    <Lock aria-hidden="true" className="size-3.5" />
                    Locked since trading started
                  </span>
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
            <FeeTermsTable cycle={cycle} canChange={rateEditable} />
          </Card>

          <Card>
            <CardHeader
              title="Admin fee"
              description="A fixed amount per client for this cycle, deducted even when there is no profit. Clients see it."
              actions={
                cycle.status !== 'settled' && (
                  <Button size="sm" variant="secondary" onClick={() => setAdminFeeOpen(true)}>
                    <IndianRupee aria-hidden="true" className="size-4" />
                    Change admin fee
                  </Button>
                )
              }
            />
            <CardContent>
              <p className="num text-2xl font-semibold">{formatINR(cycle.admin_fee_amount)}</p>
              <p className="text-xs text-muted">per client · changes are recorded in the cycle history</p>
            </CardContent>
          </Card>
        </div>

        <Card className="h-fit">
          <CardHeader title="Cycle history" description="From the audit log." />
          <EntityHistory entityType="cycle" entityId={cycle.id} describe={describeCycleEntry} />
        </Card>
      </div>

      {editOpen && <EditCycleDialog cycle={cycle} onClose={() => setEditOpen(false)} />}
      {feeOpen && <ChangeFeeDialog cycle={cycle} onClose={() => setFeeOpen(false)} />}
      {adminFeeOpen && <AdminFeeDialog cycle={cycle} onClose={() => setAdminFeeOpen(false)} />}
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
