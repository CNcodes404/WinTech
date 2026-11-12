import { zodResolver } from '@hookform/resolvers/zod';
import { Info } from 'lucide-react';
import { useId, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { useNavigate } from 'react-router';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { FormField, Input, Select, Textarea } from '@/components/ui/Form';
import { useToast } from '@/components/ui/toast-context';
import { UserFacingError } from '@/lib/errors';
import { calculateUnitsIssued, tryToDecimal } from '@/lib/finance';
import {
  dateTimeLocalISTToIso,
  formatINR,
  formatNav,
  formatUnits,
  isoDateTimeLocalInIST,
} from '@/lib/format';
import { useRecordContribution, useRecordFormOptions } from '../queries';
import {
  normaliseAmount,
  recordContributionSchema,
  type RecordContributionInput,
  type RecordContributionValues,
} from '../schemas';
import { METHOD_LABEL, REFERENCE_HINT, type ContributionMethod } from '../types';

interface Props {
  onClose: () => void;
  defaultClientId?: string;
  defaultCycleId?: string;
}

/** Records a manual contribution as PENDING. No units are issued until it is verified. Render only while open. */
export function RecordContributionDialog({ onClose, defaultClientId = '', defaultCycleId = '' }: Props) {
  const formId = useId();
  const navigate = useNavigate();
  const { toast } = useToast();
  const record = useRecordContribution();
  const { clients, cycles } = useRecordFormOptions(true);
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<RecordContributionInput, unknown, RecordContributionValues>({
    resolver: zodResolver(recordContributionSchema),
    defaultValues: {
      clientId: defaultClientId,
      cycleId: defaultCycleId,
      amount: '',
      receivedAt: isoDateTimeLocalInIST(),
      method: 'upi',
      reference: '',
      notes: '',
    },
  });
  const [amountRaw, cycleId, method] = useWatch({ control, name: ['amount', 'cycleId', 'method'] });

  const cycle = cycles.data?.find((c) => c.id === cycleId);
  const amount = tryToDecimal(normaliseAmount(amountRaw ?? ''));
  const estimate =
    cycle && amount && amount.greaterThan(0) && amount.decimalPlaces() <= 2
      ? calculateUnitsIssued(amount, cycle.base_nav)
      : null;

  const onSubmit = handleSubmit(async (v) => {
    setFormError(null);
    try {
      const id = await record.mutateAsync({
        cycleId: v.cycleId,
        clientId: v.clientId,
        amount: v.amount,
        receivedAt: dateTimeLocalISTToIso(v.receivedAt),
        method: v.method,
        reference: v.reference,
        notes: v.notes,
      });
      toast({ title: 'Contribution recorded', description: 'It is pending until you verify it.' });
      onClose();
      navigate(`/admin/contributions/${id}`);
    } catch (err) {
      setFormError(
        err instanceof UserFacingError
          ? err.message
          : 'The contribution could not be recorded. Please try again.',
      );
    }
  });

  const noCycles = cycles.isSuccess && cycles.data.length === 0;

  return (
    <Dialog
      open
      onOpenChange={(next) => !next && !isSubmitting && onClose()}
      title="Record contribution"
      description="Manual entry (no payment gateway in V1). Units are issued only when you verify it."
      dismissible={!isSubmitting}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" form={formId} loading={isSubmitting} disabled={noCycles}>
            Record as pending
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={onSubmit} noValidate className="space-y-4">
        {formError && (
          <p
            role="alert"
            className="rounded-[var(--radius-control)] border border-loss/20 bg-loss-soft px-3 py-2 text-sm text-loss"
          >
            {formError}
          </p>
        )}
        {noCycles && (
          <p
            role="alert"
            className="rounded-[var(--radius-control)] bg-warning-soft px-3 py-2 text-sm text-warning"
          >
            No cycle is open for contributions. Open a cycle first (Investment Cycles).
          </p>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Client" required error={errors.clientId?.message}>
            {(field) => (
              <Select {...field} {...register('clientId')} disabled={clients.isPending}>
                <option value="">{clients.isPending ? 'Loading…' : 'Choose a client'}</option>
                {clients.data?.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.full_name || c.email} — {c.email}
                  </option>
                ))}
              </Select>
            )}
          </FormField>
          <FormField
            label="Cycle"
            required
            hint="Open or active cycles only."
            error={errors.cycleId?.message}
          >
            {(field) => (
              <Select {...field} {...register('cycleId')} disabled={cycles.isPending}>
                <option value="">{cycles.isPending ? 'Loading…' : 'Choose a cycle'}</option>
                {cycles.data?.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.status})
                  </option>
                ))}
              </Select>
            )}
          </FormField>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            label="Amount received (₹)"
            required
            hint="e.g. 1,00,000 or 50000.50"
            error={errors.amount?.message}
          >
            {(field) => (
              <Input
                {...field}
                {...register('amount')}
                inputMode="decimal"
                autoComplete="off"
                className="num"
              />
            )}
          </FormField>
          <FormField label="Received on (IST)" required error={errors.receivedAt?.message}>
            {(field) => (
              <Input
                {...field}
                {...register('receivedAt')}
                type="datetime-local"
                max={isoDateTimeLocalInIST()}
              />
            )}
          </FormField>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Payment method" required error={errors.method?.message}>
            {(field) => (
              <Select {...field} {...register('method')}>
                {(Object.keys(METHOD_LABEL) as ContributionMethod[]).map((m) => (
                  <option key={m} value={m}>
                    {METHOD_LABEL[m]}
                  </option>
                ))}
              </Select>
            )}
          </FormField>
          <FormField
            label="Reference"
            hint={`Optional — ${REFERENCE_HINT[(method as ContributionMethod) ?? 'other']}. Prevents duplicates.`}
            error={errors.reference?.message}
          >
            {(field) => <Input {...field} {...register('reference')} autoComplete="off" />}
          </FormField>
        </div>
        <FormField
          label="Internal notes"
          hint="Optional. Visible to admins only."
          error={errors.notes?.message}
        >
          {(field) => <Textarea {...field} {...register('notes')} rows={2} maxLength={1000} />}
        </FormField>

        {estimate && cycle && amount && (
          <p className="flex items-start gap-2 rounded-[var(--radius-control)] bg-info-soft px-3 py-2 text-sm text-info">
            <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            <span>
              Estimate: {formatINR(amount)} at {formatNav(cycle.base_nav)} ≈{' '}
              <span className="num font-medium">{formatUnits(estimate)}</span> units. The exact units are
              calculated by the server when you verify.
            </span>
          </p>
        )}
      </form>
    </Dialog>
  );
}
