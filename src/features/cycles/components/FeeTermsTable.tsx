import { useState } from 'react';
import { Badge, type BadgeTone } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { TableSkeleton } from '@/components/ui/Skeleton';
import { ErrorState } from '@/components/ui/States';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/Table';
import { useToast } from '@/components/ui/toast-context';
import { formatDateTime, formatRateAsPercent } from '@/lib/format';
import { classifyFeeTerms } from '../logic';
import { useCancelFeeTerms, useFeeTerms } from '../queries';
import type { CycleOverview, FeeTerms, FeeTermsState } from '../types';
const TERMS_BADGE: Record<FeeTermsState, { tone: BadgeTone; label: string }> = {
  current: { tone: 'success', label: 'Current' },
  scheduled: { tone: 'warning', label: 'Scheduled' },
  superseded: { tone: 'neutral', label: 'Superseded' },
  cancelled: { tone: 'danger', label: 'Cancelled' },
};

/** Versioned fee terms with status; scheduled versions can be cancelled. */
export function FeeTermsTable({ cycle, canChange }: { cycle: CycleOverview; canChange: boolean }) {
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
