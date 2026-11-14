import { zodResolver } from '@hookform/resolvers/zod';
import { useId, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { FormField, Input, Textarea } from '@/components/ui/Form';
import { useToast } from '@/components/ui/toast-context';
import { UserFacingError } from '@/lib/errors';
import { formatINR } from '@/lib/format';
import { useSetAdminFee } from '../queries';
import { adminFeeSchema, type AdminFeeValues } from '../schemas';
import type { CycleOverview } from '../types';
import { FormError } from './FormAlert';

/** Edit the flat ₹ admin fee per client. Render only while open. */
export function AdminFeeDialog({ cycle, onClose }: { cycle: CycleOverview; onClose: () => void }) {
  const formId = useId();
  const { toast } = useToast();
  const setFee = useSetAdminFee(cycle.id);
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<AdminFeeValues>({
    resolver: zodResolver(adminFeeSchema),
    defaultValues: { amount: cycle.admin_fee_amount, reason: '' },
  });

  const onSubmit = handleSubmit(async (v) => {
    setFormError(null);
    try {
      await setFee.mutateAsync({ amount: v.amount, reason: v.reason });
      toast({ title: 'Admin fee updated', description: `${formatINR(v.amount)} per client` });
      onClose();
    } catch (err) {
      setFormError(
        err instanceof UserFacingError
          ? err.message
          : 'The admin fee could not be changed. Please try again.',
      );
    }
  });

  return (
    <Dialog
      open
      onOpenChange={(next) => !next && !isSubmitting && onClose()}
      title="Change admin fee"
      description={`Current fee: ${formatINR(cycle.admin_fee_amount)} per client for this cycle.`}
      dismissible={!isSubmitting}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" form={formId} loading={isSubmitting}>
            Save admin fee
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={onSubmit} noValidate className="space-y-4">
        <FormError message={formError} />
        <FormField
          label="Admin fee (₹ per client)"
          required
          hint="Applies to every client in this cycle straight away, including their current figures."
          error={errors.amount?.message}
        >
          {(field) => <Input {...field} {...register('amount')} inputMode="decimal" className="num" />}
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
