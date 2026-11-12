import { useId, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { FormField, Select } from '@/components/ui/Form';
import { useToast } from '@/components/ui/toast-context';
import { useValuations } from '@/features/portfolio/queries';
import { UserFacingError } from '@/lib/errors';
import { formatDateTime, formatINR } from '@/lib/format';
import { useCalculateNav } from '../queries';
import type { NavSnapshot } from '../types';

interface Props {
  cycleId: string;
  /** When set, calculates a correction of this published NAV. */
  correcting?: NavSnapshot;
  onClose: () => void;
}

/** Choose an approved valuation and let the server calculate a draft NAV. Render only while open. */
export function CalculateNavDialog({ cycleId, correcting, onClose }: Props) {
  const formId = useId();
  const navigate = useNavigate();
  const { toast } = useToast();
  const calculate = useCalculateNav();
  const valuations = useValuations(cycleId);
  const [error, setError] = useState<string | null>(null);

  const options = (valuations.data ?? []).filter((v) =>
    correcting
      ? v.status === 'approved' &&
        v.id !== correcting.valuation_id &&
        new Date(v.valuation_at).getTime() === new Date(correcting.nav_date).getTime()
      : v.status === 'approved',
  );
  const [selected, setSelected] = useState('');
  const valuationId = selected || options[0]?.id || '';

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!valuationId) return;
    setError(null);
    try {
      const id = await calculate.mutateAsync({ valuationId, correctsId: correcting?.id ?? null });
      toast({ title: 'Draft NAV calculated', description: 'Review the breakdown, then publish it.' });
      onClose();
      navigate(`/admin/nav/snapshots/${id}`);
    } catch (err) {
      setError(
        err instanceof UserFacingError ? err.message : 'NAV could not be calculated. Please try again.',
      );
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(next) => !next && !calculate.isPending && onClose()}
      title={correcting ? 'Correct this NAV' : 'Calculate NAV'}
      description={
        correcting
          ? 'Uses an approved corrected valuation for the same date and time. The original stays on record as corrected.'
          : 'Calculates a draft from an approved valuation. Nothing is published until you confirm.'
      }
      dismissible={!calculate.isPending}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={calculate.isPending}>
            Cancel
          </Button>
          <Button type="submit" form={formId} loading={calculate.isPending} disabled={!valuationId}>
            Calculate draft
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={onSubmit} noValidate className="space-y-4">
        {error && (
          <p
            role="alert"
            className="rounded-[var(--radius-control)] border border-loss/20 bg-loss-soft px-3 py-2 text-sm text-loss"
          >
            {error}
          </p>
        )}
        {valuations.isPending ? (
          <p role="status" className="text-sm text-muted">
            Loading valuations…
          </p>
        ) : options.length === 0 ? (
          <p className="rounded-[var(--radius-control)] bg-warning-soft px-3 py-2 text-sm text-warning">
            {correcting ? (
              <>
                No approved corrected valuation exists for {formatDateTime(correcting.nav_date)}. First open
                the valuation in{' '}
                <Link
                  className="font-medium underline"
                  to={`/admin/portfolio/valuations/${correcting.valuation_id}`}
                >
                  Portfolio
                </Link>{' '}
                and create and approve a correction.
              </>
            ) : (
              <>
                There is no approved valuation for this cycle yet.{' '}
                <Link className="font-medium underline" to={`/admin/portfolio?cycle=${cycleId}`}>
                  Go to Portfolio
                </Link>
                .
              </>
            )}
          </p>
        ) : (
          <FormField label="Approved valuation" hint="The latest is selected by default.">
            {(field) => (
              <Select {...field} value={valuationId} onChange={(e) => setSelected(e.target.value)}>
                {options.map((v) => (
                  <option key={v.id} value={v.id}>
                    {formatDateTime(v.valuation_at)} — net asset value {formatINR(v.gross_net_asset_value)}
                  </option>
                ))}
              </Select>
            )}
          </FormField>
        )}
      </form>
    </Dialog>
  );
}
