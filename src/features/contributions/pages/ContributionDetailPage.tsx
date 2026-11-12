import { CircleCheck, CircleX, ChevronLeft, Undo2 } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import type { GlossaryTerm } from '@/lib/glossary';
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
import { formatDateTime, formatINR, formatNav, formatRateAsPercent, formatUnits } from '@/lib/format';
import { isUuid } from '@/lib/utils/uuid';
import { ContributionStatusBadge } from '../components/ContributionStatusBadge';
import { VerifyDialog } from '../components/VerifyDialog';
import { describeContributionEntry } from '../logic';
import { useContribution, useRejectContribution, useReverseContribution } from '../queries';
import { METHOD_LABEL } from '../types';

function BackLink() {
  return (
    <Link
      to="/admin/contributions"
      className="mb-3 inline-flex items-center gap-1 text-sm font-medium text-muted hover:text-ink"
    >
      <ChevronLeft aria-hidden="true" className="size-4" />
      All contributions
    </Link>
  );
}

function Field({ label, children, term }: { label: string; children: ReactNode; term?: GlossaryTerm }) {
  return (
    <div>
      <dt className="flex items-center gap-1 text-muted">
        {label}
        {term && <InfoTip term={term} />}
      </dt>
      <dd className="mt-0.5 font-medium">{children}</dd>
    </div>
  );
}

export function ContributionDetailPage() {
  const { contributionId = '' } = useParams();
  const { data: c, isPending, isError, refetch } = useContribution(contributionId);
  const reject = useRejectContribution(contributionId);
  const reverse = useReverseContribution(contributionId);
  const { toast } = useToast();
  const [verifyOpen, setVerifyOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reverseOpen, setReverseOpen] = useState(false);

  if (!isUuid(contributionId) || (!isPending && !isError && !c)) {
    return (
      <>
        <BackLink />
        <Card>
          <EmptyState title="Contribution not found" />
        </Card>
      </>
    );
  }
  if (isPending) {
    return (
      <LoadingRegion label="Loading contribution">
        <BackLink />
        <Skeleton className="h-8 w-72" />
        <Skeleton className="mt-6 h-48" />
      </LoadingRegion>
    );
  }
  if (isError || !c) {
    return (
      <>
        <BackLink />
        <Card>
          <ErrorState message="This contribution could not be loaded." onRetry={() => void refetch()} />
        </Card>
      </>
    );
  }

  const cycleAcceptsChanges = c.cycle_status === 'open' || c.cycle_status === 'active';
  const hasUnits = c.status === 'verified' || c.status === 'reversed';

  return (
    <>
      <BackLink />
      <PageHeader
        title={`${formatINR(c.amount)} from ${c.client_name || c.client_email}`}
        badges={
          <>
            <ContributionStatusBadge status={c.status} />
            <DemoBadge kind="manual" />
          </>
        }
        description={`${c.cycle_name} · received ${formatDateTime(c.received_at)}`}
        actions={
          <>
            {c.status === 'pending' && (
              <>
                <Button variant="secondary" onClick={() => setRejectOpen(true)}>
                  <CircleX aria-hidden="true" className="size-4" />
                  Reject
                </Button>
                <Button onClick={() => setVerifyOpen(true)} disabled={!cycleAcceptsChanges}>
                  <CircleCheck aria-hidden="true" className="size-4" />
                  Verify & issue units
                </Button>
              </>
            )}
            {c.status === 'verified' && cycleAcceptsChanges && (
              <Button variant="danger" onClick={() => setReverseOpen(true)}>
                <Undo2 aria-hidden="true" className="size-4" />
                Reverse
              </Button>
            )}
          </>
        }
      />

      {c.status === 'pending' && !cycleAcceptsChanges && (
        <p
          role="status"
          className="mb-4 rounded-[var(--radius-control)] bg-warning-soft px-3 py-2 text-sm text-warning"
        >
          The cycle is {c.cycle_status}. Units can only be issued while it is open or active.
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader title="Payment details" />
            <CardContent>
              <dl className="grid gap-x-6 gap-y-4 text-sm sm:grid-cols-2">
                <Field label="Client">
                  <Link to={`/admin/clients/${c.client_id}`} className="text-emerald-700 hover:underline">
                    {c.client_name || c.client_email}
                  </Link>
                </Field>
                <Field label="Cycle">
                  <Link to={`/admin/cycles/${c.cycle_id}`} className="text-emerald-700 hover:underline">
                    {c.cycle_name}
                  </Link>
                </Field>
                <Field label="Amount">
                  <span className="num">{formatINR(c.amount)}</span>
                </Field>
                <Field label="Received">
                  <span className="num">{formatDateTime(c.received_at)}</span>
                </Field>
                <Field label="Method">{METHOD_LABEL[c.method]}</Field>
                <Field label="Reference">{c.reference_number ?? '—'}</Field>
                <div className="sm:col-span-2">
                  <dt className="text-muted">Internal notes (admin only)</dt>
                  <dd className="mt-0.5 whitespace-pre-wrap">{c.notes ?? '—'}</dd>
                </div>
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader
              title="Unit allocation"
              description={
                hasUnits
                  ? 'Calculated by the server at verification.'
                  : 'Issued when the contribution is verified.'
              }
            />
            <CardContent>
              {hasUnits ? (
                <dl className="grid gap-x-6 gap-y-4 text-sm sm:grid-cols-2">
                  <Field label="Applicable NAV" term="nav">
                    <span className="num">{formatNav(c.applicable_nav, { decimals: 8 })}</span>
                  </Field>
                  <Field label="Units issued" term="units">
                    <span className="num">{formatUnits(c.units_issued)}</span>
                  </Field>
                  <Field label="Fee rate (locked for this lot)" term="performanceFee">
                    <span className="num">{formatRateAsPercent(c.locked_fee_rate)}</span>
                  </Field>
                  <Field label="Starting high-water mark" term="hwm">
                    <span className="num">{formatNav(c.reference_hwm, { decimals: 8 })}</span>
                  </Field>
                  <Field label="Verified">
                    <span className="num">{formatDateTime(c.verified_at)}</span>
                  </Field>
                  {c.status === 'reversed' && (
                    <Field label="Reversed">
                      <span className="num">{formatDateTime(c.reversed_at)}</span>
                      <span className="block font-normal text-muted">{c.reversal_reason}</span>
                    </Field>
                  )}
                </dl>
              ) : c.status === 'rejected' ? (
                <p className="text-sm">
                  Rejected on <span className="num">{formatDateTime(c.rejected_at)}</span>. No units were
                  issued.
                  <span className="mt-1 block text-muted">Reason: {c.rejection_reason}</span>
                </p>
              ) : (
                <p className="text-sm text-muted">Pending verification. No units have been issued yet.</p>
              )}
            </CardContent>
          </Card>
        </div>

        <Card className="h-fit">
          <CardHeader title="History" description="From the audit log." />
          <EntityHistory entityType="contribution" entityId={c.id} describe={describeContributionEntry} />
        </Card>
      </div>

      {verifyOpen && <VerifyDialog contribution={c} onClose={() => setVerifyOpen(false)} />}
      <ConfirmDialog
        open={rejectOpen}
        onOpenChange={setRejectOpen}
        title="Reject this contribution?"
        description="No units will be issued. The record is kept; you can record it again later if needed."
        confirmLabel="Reject"
        tone="danger"
        requireReason
        onConfirm={async (reason) => {
          await reject.mutateAsync(reason);
          toast({ title: 'Contribution rejected' });
        }}
      />
      <ConfirmDialog
        open={reverseOpen}
        onOpenChange={setReverseOpen}
        title="Reverse this contribution?"
        description={`Adds a reversing entry that removes ${formatUnits(c.units_issued)} units. The original entry is kept for the audit trail. This cannot be undone.`}
        confirmLabel="Reverse contribution"
        tone="danger"
        requireReason
        onConfirm={async (reason) => {
          await reverse.mutateAsync(reason);
          toast({ title: 'Contribution reversed' });
        }}
      />
    </>
  );
}
