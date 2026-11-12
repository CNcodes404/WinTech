import { zodResolver } from '@hookform/resolvers/zod';
import { useId, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { FormField, Input, Textarea } from '@/components/ui/Form';
import { useToast } from '@/components/ui/toast-context';
import { UserFacingError } from '@/lib/errors';
import { useUpdateCycle } from '../queries';
import { editCycleSchema, type EditCycleValues } from '../schemas';
import type { CycleOverview } from '../types';
import { FormError } from './FormAlert';

const LOCKED = 'cursor-not-allowed bg-surface-muted text-muted';

/** Render only while open. Fields lock according to the cycle status (also enforced in the DB). */
export function EditCycleDialog({ cycle, onClose }: { cycle: CycleOverview; onClose: () => void }) {
  const formId = useId();
  const { toast } = useToast();
  const update = useUpdateCycle(cycle.id);
  const [formError, setFormError] = useState<string | null>(null);
  const datesLocked = !(cycle.status === 'draft' || cycle.status === 'open');
  const navLocked = cycle.status !== 'draft';

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<EditCycleValues>({
    resolver: zodResolver(editCycleSchema),
    defaultValues: {
      name: cycle.name,
      description: cycle.description ?? '',
      startDate: cycle.start_date,
      endDate: cycle.end_date,
      baseNav: cycle.base_nav,
      reason: '',
    },
  });

  const onSubmit = handleSubmit(async (v) => {
    setFormError(null);
    try {
      await update.mutateAsync(v);
      toast({ title: 'Cycle updated' });
      onClose();
    } catch (err) {
      setFormError(
        err instanceof UserFacingError ? err.message : 'The changes could not be saved. Please try again.',
      );
    }
  });

  return (
    <Dialog
      open
      onOpenChange={(next) => !next && !isSubmitting && onClose()}
      title="Edit cycle"
      dismissible={!isSubmitting}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" form={formId} loading={isSubmitting} disabled={!isDirty}>
            Save changes
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={onSubmit} noValidate className="space-y-4">
        <FormError message={formError} />
        <FormField label="Cycle name" required error={errors.name?.message}>
          {(field) => <Input {...field} {...register('name')} autoComplete="off" />}
        </FormField>
        <FormField label="Description" hint="Optional" error={errors.description?.message}>
          {(field) => <Textarea {...field} {...register('description')} rows={2} />}
        </FormField>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            label="Start date"
            hint={datesLocked ? 'Locked after the cycle becomes active.' : undefined}
            error={errors.startDate?.message}
          >
            {(field) => (
              <Input
                {...field}
                {...register('startDate')}
                type="date"
                readOnly={datesLocked}
                className={datesLocked ? LOCKED : undefined}
              />
            )}
          </FormField>
          <FormField label="End date" error={errors.endDate?.message}>
            {(field) => (
              <Input
                {...field}
                {...register('endDate')}
                type="date"
                readOnly={datesLocked}
                className={datesLocked ? LOCKED : undefined}
              />
            )}
          </FormField>
        </div>
        <FormField
          label="Base NAV (₹ per unit)"
          hint={navLocked ? 'Locked once the cycle is opened.' : 'Editable only while the cycle is a draft.'}
          error={errors.baseNav?.message}
        >
          {(field) => (
            <Input
              {...field}
              {...register('baseNav')}
              inputMode="decimal"
              readOnly={navLocked}
              className={navLocked ? `num ${LOCKED}` : 'num'}
            />
          )}
        </FormField>
        <FormField
          label="Reason for the change"
          required
          hint="Recorded in the audit log."
          error={errors.reason?.message}
        >
          {(field) => <Textarea {...field} {...register('reason')} rows={2} maxLength={1000} />}
        </FormField>
      </form>
    </Dialog>
  );
}
