import { zodResolver } from '@hookform/resolvers/zod';
import { useId, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { FormField, Input } from '@/components/ui/Form';
import { useToast } from '@/components/ui/toast-context';
import { UserFacingError } from '@/lib/errors';
import { useUpdateClientContact } from '../queries';
import { clientContactSchema, type ClientContactValues } from '../schemas';
import type { ClientDetail } from '../types';

interface EditContactDialogProps {
  client: ClientDetail;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Edit name and phone. Email changes are not possible in V1 (sign-in identity).
 * Render only while open so the form starts fresh from the latest client data each time.
 */
export function EditContactDialog({ client, open, onOpenChange }: EditContactDialogProps) {
  const formId = useId();
  const { toast } = useToast();
  const update = useUpdateClientContact(client.id);
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<ClientContactValues>({
    resolver: zodResolver(clientContactSchema),
    defaultValues: { fullName: client.full_name, phone: client.phone ?? '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      await update.mutateAsync(values);
      toast({ title: 'Contact details updated' });
      onOpenChange(false);
    } catch (err) {
      setFormError(
        err instanceof UserFacingError ? err.message : 'The changes could not be saved. Please try again.',
      );
    }
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => !isSubmitting && onOpenChange(next)}
      title="Edit contact details"
      size="sm"
      dismissible={!isSubmitting}
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" form={formId} loading={isSubmitting} disabled={!isDirty}>
            Save changes
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
        <FormField label="Full name" required error={errors.fullName?.message}>
          {(field) => <Input {...field} {...register('fullName')} autoComplete="off" />}
        </FormField>
        <FormField label="Phone" hint="Optional, e.g. +91 98765 43210" error={errors.phone?.message}>
          {(field) => (
            <Input {...field} {...register('phone')} type="tel" inputMode="tel" autoComplete="off" />
          )}
        </FormField>
        <div>
          <p className="text-sm font-medium">Email address</p>
          <p className="mt-1 text-sm text-muted">{client.email}</p>
          <p className="mt-1 text-xs text-muted">The sign-in email cannot be changed here.</p>
        </div>
      </form>
    </Dialog>
  );
}
