import { zodResolver } from '@hookform/resolvers/zod';
import { Info } from 'lucide-react';
import { useId, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { FormField, Input, Textarea } from '@/components/ui/Form';
import { useToast } from '@/components/ui/toast-context';
import { UserFacingError } from '@/lib/errors';
import { addDaysIso, formatRateAsPercent, isoDateInIST, startOfDayIST } from '@/lib/format';
import { useAddFeeTerms } from '../queries';
import { changeFeeSchema, percentToRate, type ChangeFeeValues } from '../schemas';
import type { CycleOverview } from '../types';
import { FeeExample } from './FeeExample';
import { FormError } from './FormAlert';

/**
 * Adds a new fee-terms version. Existing contribution lots keep the rate they were issued with;
 * the new rate applies to contributions verified on or after the effective time.
 * Render only while open.
 */
export function ChangeFeeDialog({ cycle, onClose }: { cycle: CycleOverview; onClose: () => void }) {
  const formId = useId();
  const { toast } = useToast();
  const addTerms = useAddFeeTerms(cycle.id);
  const [formError, setFormError] = useState<string | null>(null);
  const tomorrow = addDaysIso(isoDateInIST(), 1);

  const {
    register,
    handleSubmit,
    control,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ChangeFeeValues>({
    resolver: zodResolver(changeFeeSchema),
    defaultValues: { feePercent: '', when: 'now', effectiveDate: tomorrow, reason: '' },
  });
  const [feePercent, when] = useWatch({ control, name: ['feePercent', 'when'] });

  const onSubmit = handleSubmit(async (v) => {
    setFormError(null);
    if (v.when === 'date' && v.effectiveDate < tomorrow) {
      setError('effectiveDate', { message: 'Choose a future date, or select “Immediately”.' });
      return;
    }
    try {
      await addTerms.mutateAsync({
        feeRate: percentToRate(v.feePercent),
        effectiveFrom: v.when === 'now' ? null : startOfDayIST(v.effectiveDate),
        reason: v.reason,
      });
      toast({
        title: v.when === 'now' ? 'Fee rate changed' : 'Fee change scheduled',
        description: `New rate: ${formatRateAsPercent(percentToRate(v.feePercent))}`,
      });
      onClose();
    } catch (err) {
      setFormError(
        err instanceof UserFacingError ? err.message : 'The fee rate could not be changed. Please try again.',
      );
    }
  });

  return (
    <Dialog
      open
      onOpenChange={(next) => !next && !isSubmitting && onClose()}
      title="Change performance-fee rate"
      description={`Current rate: ${formatRateAsPercent(cycle.current_fee_rate)} (version ${cycle.current_fee_version ?? '—'})`}
      dismissible={!isSubmitting}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" form={formId} loading={isSubmitting}>
            {when === 'now' ? 'Change rate now' : 'Schedule change'}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={onSubmit} noValidate className="space-y-4">
        <FormError message={formError} />
        <p className="flex items-start gap-2 rounded-[var(--radius-control)] bg-info-soft px-3 py-2 text-sm text-info">
          <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <span>
            The new rate applies only to contributions verified on or after the effective time. Existing
            contribution lots keep their original rate. Past calculations are never changed.
          </span>
        </p>
        <FormField label="New performance fee (%)" required error={errors.feePercent?.message}>
          {(field) => (
            <Input
              {...field}
              {...register('feePercent')}
              inputMode="decimal"
              placeholder="e.g. 20"
              className="num"
            />
          )}
        </FormField>
        <FeeExample percent={feePercent ?? ''} />

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Takes effect</legend>
          <label className="flex items-center gap-2 text-sm">
            <input type="radio" value="now" {...register('when')} className="size-4 accent-emerald-500" />
            Immediately
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="radio" value="date" {...register('when')} className="size-4 accent-emerald-500" />
            From the start of a future date (IST)
          </label>
        </fieldset>
        {when === 'date' && (
          <FormField label="Effective date" required error={errors.effectiveDate?.message}>
            {(field) => <Input {...field} {...register('effectiveDate')} type="date" min={tomorrow} />}
          </FormField>
        )}

        <FormField
          label="Reason for the change"
          required
          hint="Recorded with the new version and in the audit log."
          error={errors.reason?.message}
        >
          {(field) => <Textarea {...field} {...register('reason')} rows={2} maxLength={1000} />}
        </FormField>
      </form>
    </Dialog>
  );
}
