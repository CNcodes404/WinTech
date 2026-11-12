import { zodResolver } from '@hookform/resolvers/zod';
import { useId, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { useNavigate } from 'react-router';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { FormField, Input, Textarea } from '@/components/ui/Form';
import { useToast } from '@/components/ui/toast-context';
import { UserFacingError } from '@/lib/errors';
import { isoDateInIST } from '@/lib/format';
import { useCreateCycle } from '../queries';
import { createCycleSchema, percentToRate, type CreateCycleValues } from '../schemas';
import { FeeExample } from './FeeExample';
import { FormError } from './FormAlert';

/** Render only while open so each opening starts with a fresh form. */
export function CreateCycleDialog({ onClose }: { onClose: () => void }) {
  const formId = useId();
  const navigate = useNavigate();
  const { toast } = useToast();
  const create = useCreateCycle();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<CreateCycleValues>({
    resolver: zodResolver(createCycleSchema),
    defaultValues: {
      name: '',
      description: '',
      startDate: isoDateInIST(),
      endDate: '',
      baseNav: '100',
      feePercent: '',
    },
  });
  const feePercent = useWatch({ control, name: 'feePercent' });

  const onSubmit = handleSubmit(async (v) => {
    setFormError(null);
    try {
      const id = await create.mutateAsync({
        name: v.name,
        description: v.description,
        startDate: v.startDate,
        endDate: v.endDate,
        baseNav: v.baseNav,
        feeRate: percentToRate(v.feePercent),
      });
      toast({ title: 'Cycle created', description: 'It is a draft until you open it for contributions.' });
      onClose();
      navigate(`/admin/cycles/${id}`);
    } catch (err) {
      setFormError(
        err instanceof UserFacingError ? err.message : 'The cycle could not be created. Please try again.',
      );
    }
  });

  return (
    <Dialog
      open
      onOpenChange={(next) => !next && !isSubmitting && onClose()}
      title="New investment cycle"
      description="Starts as a draft. You can review it before opening it for contributions."
      dismissible={!isSubmitting}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" form={formId} loading={isSubmitting}>
            Create cycle
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={onSubmit} noValidate className="space-y-4">
        <FormError message={formError} />
        <FormField
          label="Cycle name"
          required
          hint="e.g. FY 2026–27 Growth Cycle"
          error={errors.name?.message}
        >
          {(field) => <Input {...field} {...register('name')} autoComplete="off" />}
        </FormField>
        <FormField label="Description" hint="Optional" error={errors.description?.message}>
          {(field) => <Textarea {...field} {...register('description')} rows={2} />}
        </FormField>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Start date" required error={errors.startDate?.message}>
            {(field) => <Input {...field} {...register('startDate')} type="date" />}
          </FormField>
          <FormField label="End date" required error={errors.endDate?.message}>
            {(field) => <Input {...field} {...register('endDate')} type="date" />}
          </FormField>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            label="Base NAV (₹ per unit)"
            required
            hint="NAV at launch. Locked once the cycle opens."
            error={errors.baseNav?.message}
          >
            {(field) => <Input {...field} {...register('baseNav')} inputMode="decimal" className="num" />}
          </FormField>
          <FormField
            label="Performance fee (%)"
            required
            hint="Share of eligible profit, e.g. 20."
            error={errors.feePercent?.message}
          >
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
        </div>
        <FeeExample percent={feePercent ?? ''} />
      </form>
    </Dialog>
  );
}
