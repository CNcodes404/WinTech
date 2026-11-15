import { BadgeIndianRupee, ExternalLink } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge, type BadgeTone } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Select } from '@/components/ui/Form';
import { TableSkeleton } from '@/components/ui/Skeleton';
import { StatCard } from '@/components/ui/StatCard';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { useToast } from '@/components/ui/toast-context';
import { formatDateTime, formatINR } from '@/lib/format';
import {
  METHOD_TEXT,
  usePaymentRequests,
  useReviewPaymentRequest,
  type PaymentRequestRow,
  type PaymentRequestStatus,
} from './api';

const STATUS: Record<PaymentRequestStatus, { label: string; tone: BadgeTone }> = {
  submitted: { label: 'To review', tone: 'info' },
  approved: { label: 'Approved', tone: 'success' },
  rejected: { label: 'Rejected', tone: 'danger' },
};

/** Admin: check client-submitted payment details against the bank, then approve or reject. */
export function PaymentRequestsPage() {
  const [filter, setFilter] = useState<PaymentRequestStatus | ''>('submitted');
  const all = usePaymentRequests('');
  const list = usePaymentRequests(filter);
  const review = useReviewPaymentRequest();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [action, setAction] = useState<{ row: PaymentRequestRow; kind: 'approve' | 'reject' } | null>(null);
  const count = (s: PaymentRequestStatus) => (all.data ?? []).filter((r) => r.status === s).length;
  const pendingAmount = (all.data ?? [])
    .filter((r) => r.status === 'submitted')
    .reduce((s, r) => s + Number(r.amount), 0);

  return (
    <>
      <PageHeader
        title="Payment Requests"
        description="Payment details submitted by clients after paying by UPI QR or bank transfer. Match each one with the bank statement before approving."
      />
      <section aria-label="Payment request counts" className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard
          label="To review"
          tone="sky"
          loading={all.isPending}
          value={String(count('submitted'))}
          meta={`${formatINR(pendingAmount.toFixed(2))} claimed`}
        />
        <StatCard label="Approved" tone="emerald" loading={all.isPending} value={String(count('approved'))} />
        <StatCard label="Rejected" tone="rose" loading={all.isPending} value={String(count('rejected'))} />
      </section>

      <Card>
        <div className="flex flex-wrap items-center gap-2 border-b border-line px-5 py-3 text-sm">
          <label htmlFor="pr-filter" className="text-muted">
            Show
          </label>
          <Select
            id="pr-filter"
            value={filter}
            onChange={(e) => setFilter(e.target.value as PaymentRequestStatus | '')}
            className="w-44"
          >
            <option value="submitted">To review</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="">All</option>
          </Select>
        </div>
        {list.isPending ? (
          <TableSkeleton rows={4} columns={5} />
        ) : list.isError ? (
          <ErrorState message="Payment requests could not be loaded." onRetry={() => void list.refetch()} />
        ) : list.data.length === 0 ? (
          <EmptyState
            icon={BadgeIndianRupee}
            title={filter === 'submitted' ? 'Nothing to review' : 'No payment requests'}
            description="Requests appear here when clients submit payment details from Add funds."
          />
        ) : (
          <ul className="divide-y divide-line">
            {list.data.map((r) => (
              <li key={r.id} className="px-5 py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link to={`/admin/clients/${r.client_id}`} className="font-semibold hover:underline">
                        {r.client_name || r.client_email}
                      </Link>
                      <Badge tone={STATUS[r.status].tone}>{STATUS[r.status].label}</Badge>
                    </div>
                    <p className="mt-1 num text-2xl font-bold">{formatINR(r.amount)}</p>
                    <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-sm">
                      <dt className="text-muted">Cycle</dt>
                      <dd>{r.cycle_name}</dd>
                      <dt className="text-muted">Paid on</dt>
                      <dd className="num">{formatDateTime(r.paid_at)}</dd>
                      <dt className="text-muted">Method</dt>
                      <dd>{METHOD_TEXT[r.method]}</dd>
                      {r.payer_upi_id && (
                        <>
                          <dt className="text-muted">Payer UPI ID</dt>
                          <dd className="num break-all">{r.payer_upi_id}</dd>
                        </>
                      )}
                      <dt className="text-muted">Transaction ID / UTR</dt>
                      <dd className="num font-semibold">{r.transaction_ref}</dd>
                      {r.payer_name && (
                        <>
                          <dt className="text-muted">Account holder</dt>
                          <dd>{r.payer_name}</dd>
                        </>
                      )}
                      {r.note && (
                        <>
                          <dt className="text-muted">Client note</dt>
                          <dd className="break-words">{r.note}</dd>
                        </>
                      )}
                      <dt className="text-muted">Submitted</dt>
                      <dd className="num">{formatDateTime(r.created_at)}</dd>
                    </dl>
                    {r.status !== 'submitted' && (
                      <p className="mt-2 text-xs text-muted">
                        {STATUS[r.status].label} {r.reviewed_at ? formatDateTime(r.reviewed_at) : ''}
                        {r.reviewer_name ? ` by ${r.reviewer_name}` : ''} · {r.review_reason}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {r.status === 'submitted' ? (
                      <>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setAction({ row: r, kind: 'reject' })}
                        >
                          Reject
                        </Button>
                        <Button size="sm" onClick={() => setAction({ row: r, kind: 'approve' })}>
                          Approve &amp; add contribution
                        </Button>
                      </>
                    ) : r.contribution_id ? (
                      <Button size="sm" variant="secondary" asChild>
                        <Link to={`/admin/contributions/${r.contribution_id}`}>
                          <ExternalLink aria-hidden="true" className="size-3.5" />
                          Open contribution
                        </Link>
                      </Button>
                    ) : null}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {action && (
        <ConfirmDialog
          open
          onOpenChange={(o) => !o && setAction(null)}
          title={
            action.kind === 'approve'
              ? `Approve ${formatINR(action.row.amount)} from ${action.row.client_name || action.row.client_email}?`
              : 'Reject this payment request?'
          }
          description={
            action.kind === 'approve'
              ? `Confirm you found UTR ${action.row.transaction_ref} for ${formatINR(action.row.amount)} in the bank statement. A pending contribution is recorded; you then verify it to issue units.`
              : 'The client will see your reason and can submit corrected details.'
          }
          confirmLabel={action.kind === 'approve' ? 'Approve & add contribution' : 'Reject request'}
          tone={action.kind === 'approve' ? 'primary' : 'danger'}
          requireReason
          reasonLabel={
            action.kind === 'approve'
              ? 'Verification note (recorded in the audit log and shown to the client)'
              : 'Reason (shown to the client)'
          }
          onConfirm={async (reason) => {
            const contributionId = await review.mutateAsync({
              id: action.row.id,
              action: action.kind,
              reason,
            });
            if (action.kind === 'approve' && contributionId) {
              toast({ title: 'Contribution added', description: 'Now verify it to issue units.' });
              navigate(`/admin/contributions/${contributionId}`);
            } else {
              toast({ title: 'Payment request rejected' });
            }
          }}
        />
      )}
    </>
  );
}
