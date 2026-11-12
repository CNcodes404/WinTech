import { CircleCheck, ChevronLeft, FilePenLine, Pencil, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { DemoBadge } from '@/components/ui/DemoBadge';
import { LoadingRegion, Skeleton } from '@/components/ui/Skeleton';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/Table';
import { useToast } from '@/components/ui/toast-context';
import { EntityHistory } from '@/features/audit/EntityHistory';
import { useCycle } from '@/features/cycles/queries';
import { formatDateTime, formatINR, formatUnits } from '@/lib/format';
import { cn } from '@/lib/utils/cn';
import { isUuid } from '@/lib/utils/uuid';
import { ValuationStatusBadge } from '../components/ValuationStatusBadge';
import { describeValuationEntry } from '../logic';
import { useApproveValuation, useDiscardValuation, useValuation } from '../queries';
import { EXCHANGE_LABEL } from '../types';

export function ValuationDetailPage() {
  const { valuationId = '' } = useParams();
  const { data, isPending, isError, refetch } = useValuation(valuationId);
  const cycle = useCycle(data?.valuation.cycle_id ?? '');
  const approve = useApproveValuation(valuationId);
  const discard = useDiscardValuation(valuationId);
  const { toast } = useToast();
  const [approveOpen, setApproveOpen] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);

  const back = (
    <Link
      to={data ? `/admin/portfolio?cycle=${data.valuation.cycle_id}` : '/admin/portfolio'}
      className="mb-3 inline-flex items-center gap-1 text-sm font-medium text-muted hover:text-ink"
    >
      <ChevronLeft aria-hidden="true" className="size-4" />
      Portfolio
    </Link>
  );

  if (!isUuid(valuationId) || (!isPending && !isError && !data)) {
    return (
      <>
        {back}
        <Card>
          <EmptyState title="Valuation not found" />
        </Card>
      </>
    );
  }
  if (isPending) {
    return (
      <LoadingRegion label="Loading valuation">
        {back}
        <Skeleton className="h-8 w-72" />
        <Skeleton className="mt-6 h-64" />
      </LoadingRegion>
    );
  }
  if (isError || !data) {
    return (
      <>
        {back}
        <Card>
          <ErrorState message="This valuation could not be loaded." onRetry={() => void refetch()} />
        </Card>
      </>
    );
  }

  const { valuation: v, items } = data;
  const totals: [string, string, boolean?][] = [
    ['Holdings value', formatINR(v.holdings_value)],
    ['Cash balance', formatINR(v.cash_balance)],
    ['Other assets', formatINR(v.other_assets)],
    ['Gross assets', formatINR(v.gross_asset_value)],
    ['Liabilities', formatINR(v.liabilities)],
    ['Net asset value', formatINR(v.gross_net_asset_value), true],
  ];

  return (
    <>
      {back}
      <PageHeader
        title={`Valuation · ${formatDateTime(v.valuation_at)}`}
        badges={
          <>
            <ValuationStatusBadge status={v.status} />
            <DemoBadge kind="manual" />
          </>
        }
        description={cycle.data ? `Cycle: ${cycle.data.name}` : undefined}
        actions={
          v.status === 'draft' ? (
            <>
              <Button variant="ghost" onClick={() => setDiscardOpen(true)}>
                <Trash2 aria-hidden="true" className="size-4" />
                Discard
              </Button>
              <Button variant="secondary" asChild>
                <Link to={`/admin/portfolio/valuations/${v.id}/edit`}>
                  <Pencil aria-hidden="true" className="size-4" />
                  Edit draft
                </Link>
              </Button>
              <Button onClick={() => setApproveOpen(true)}>
                <CircleCheck aria-hidden="true" className="size-4" />
                Approve
              </Button>
            </>
          ) : v.status === 'approved' ? (
            <Button variant="secondary" asChild>
              <Link to={`/admin/portfolio/valuations/new?cycle=${v.cycle_id}&corrects=${v.id}`}>
                <FilePenLine aria-hidden="true" className="size-4" />
                Create correction
              </Link>
            </Button>
          ) : null
        }
      />

      {v.status === 'superseded' && v.superseded_by && (
        <p className="mb-4 rounded-[var(--radius-control)] bg-surface-muted px-3 py-2 text-sm">
          This valuation was replaced by an approved{' '}
          <Link
            to={`/admin/portfolio/valuations/${v.superseded_by}`}
            className="font-medium text-emerald-700 hover:underline"
          >
            correction
          </Link>{' '}
          on {formatDateTime(v.superseded_at)}. It is kept unchanged for the audit trail.
        </p>
      )}
      {v.corrects_valuation_id && (
        <p className="mb-4 rounded-[var(--radius-control)] bg-surface-muted px-3 py-2 text-sm">
          Correction of{' '}
          <Link
            to={`/admin/portfolio/valuations/${v.corrects_valuation_id}`}
            className="font-medium text-emerald-700 hover:underline"
          >
            an earlier valuation
          </Link>
          .
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader
              title="Holdings"
              description={`${items.length} line(s). Market value = quantity × valuation price, rounded to paise.`}
            />
            {items.length === 0 ? (
              <p className="px-5 py-4 text-sm text-muted">No holdings in this valuation.</p>
            ) : (
              <Table caption="Holdings" minWidth={760}>
                <THead>
                  <tr>
                    <TH>Symbol</TH>
                    <TH>Name</TH>
                    <TH>Exchange</TH>
                    <TH numeric>Quantity</TH>
                    <TH numeric>Price</TH>
                    <TH numeric>Avg cost</TH>
                    <TH numeric>Market value</TH>
                  </tr>
                </THead>
                <TBody>
                  {items.map((i) => (
                    <TR key={i.id}>
                      <TD className="font-medium">{i.symbol}</TD>
                      <TD className="text-muted">{i.instrument_name ?? '—'}</TD>
                      <TD className="text-muted">{i.exchange ? EXCHANGE_LABEL[i.exchange] : '—'}</TD>
                      <TD numeric>{formatUnits(i.quantity, { decimals: 4 })}</TD>
                      <TD numeric>{formatINR(i.valuation_price, { decimals: 4 })}</TD>
                      <TD numeric className="text-muted">
                        {i.average_cost ? formatINR(i.average_cost, { decimals: 4 }) : '—'}
                      </TD>
                      <TD numeric className="font-medium">
                        {formatINR(i.market_value)}
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            )}
          </Card>
          {v.notes && (
            <Card>
              <CardHeader title="Notes" />
              <CardContent>
                <p className="text-sm whitespace-pre-wrap">{v.notes}</p>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Totals" description="Calculated by the server." />
            <CardContent>
              <dl className="space-y-2 text-sm">
                {totals.map(([k, val, strong]) => (
                  <div
                    key={k}
                    className={cn('flex justify-between gap-3', strong && 'border-t border-line pt-2')}
                  >
                    <dt className={strong ? 'font-medium' : 'text-muted'}>{k}</dt>
                    <dd className={cn('num', strong && 'font-semibold')}>{val}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-3 text-xs text-muted">
                Source: manual demo entry ·{' '}
                {v.approved_at ? `approved ${formatDateTime(v.approved_at)}` : 'not approved'}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader title="History" description="From the audit log." />
            <EntityHistory entityType="valuation" entityId={v.id} describe={describeValuationEntry} />
          </Card>
        </div>
      </div>

      <ConfirmDialog
        open={approveOpen}
        onOpenChange={setApproveOpen}
        title="Approve this valuation?"
        description="It becomes an immutable snapshot that can be used to calculate NAV. Mistakes can only be fixed with a correction."
        confirmLabel="Approve valuation"
        requireReason
        reasonLabel="Approval note (recorded in the audit log)"
        onConfirm={async (reason) => {
          await approve.mutateAsync(reason);
          toast({ title: 'Valuation approved' });
        }}
      >
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-[var(--radius-control)] bg-surface-muted p-3 text-sm">
          <dt className="text-muted">Valuation time</dt>
          <dd className="text-right num">{formatDateTime(v.valuation_at)}</dd>
          <dt className="text-muted">Holdings</dt>
          <dd className="text-right num">{items.length}</dd>
          <dt className="text-muted">Net asset value</dt>
          <dd className="text-right num font-semibold">{formatINR(v.gross_net_asset_value)}</dd>
        </dl>
      </ConfirmDialog>
      <ConfirmDialog
        open={discardOpen}
        onOpenChange={setDiscardOpen}
        title="Discard this draft?"
        description="It will not be used for NAV. The record is kept as discarded."
        confirmLabel="Discard draft"
        tone="danger"
        requireReason
        onConfirm={async (reason) => {
          await discard.mutateAsync(reason);
          toast({ title: 'Draft discarded' });
        }}
      />
    </>
  );
}
