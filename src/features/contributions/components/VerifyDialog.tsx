import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { LoadingRegion, Skeleton } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/toast-context';
import { formatINR, formatNav, formatRateAsPercent, formatUnits } from '@/lib/format';
import { useVerificationPreview, useVerifyContribution } from '../queries';
import type { ContributionRow } from '../types';

/**
 * Verification shows the SERVER's preview of exactly what will be issued (NAV, units, fee rate),
 * so the admin confirms the authoritative numbers, not a browser estimate. Render only while open.
 */
export function VerifyDialog({
  contribution,
  onClose,
}: {
  contribution: ContributionRow;
  onClose: () => void;
}) {
  const preview = useVerificationPreview(contribution.id, true);
  const verify = useVerifyContribution(contribution.id);
  const { toast } = useToast();

  return (
    <ConfirmDialog
      open
      onOpenChange={(open) => !open && onClose()}
      title="Verify contribution and issue units?"
      description="Units are issued once and can only be undone by a reversing entry."
      confirmLabel="Verify & issue units"
      requireReason
      reasonLabel="Verification note (recorded in the audit log)"
      confirmDisabled={!preview.isSuccess}
      onConfirm={async (reason) => {
        const r = await verify.mutateAsync(reason);
        toast({ title: 'Contribution verified', description: `${formatUnits(r.units)} units issued.` });
      }}
    >
      {preview.isPending ? (
        <LoadingRegion label="Calculating units">
          <Skeleton className="h-24" />
        </LoadingRegion>
      ) : preview.isError ? (
        <p role="alert" className="text-sm text-loss">
          {preview.error.message}
        </p>
      ) : (
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-[var(--radius-control)] bg-surface-muted p-3 text-sm">
          <dt className="text-muted">Client</dt>
          <dd className="text-right font-medium">{contribution.client_name || contribution.client_email}</dd>
          <dt className="text-muted">Amount</dt>
          <dd className="text-right num font-medium">{formatINR(contribution.amount)}</dd>
          <dt className="text-muted">Applicable NAV</dt>
          <dd className="text-right num font-medium">
            {formatNav(preview.data.applicable_nav, { decimals: 8 })}
          </dd>
          <dt className="text-muted">Units to issue</dt>
          <dd className="text-right num font-semibold">{formatUnits(preview.data.units)}</dd>
          <dt className="text-muted">Fee rate (locked)</dt>
          <dd className="text-right num font-medium">
            {formatRateAsPercent(preview.data.fee_rate)} · v{preview.data.fee_version}
          </dd>
        </dl>
      )}
    </ConfirmDialog>
  );
}
