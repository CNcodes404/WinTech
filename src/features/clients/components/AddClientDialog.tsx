import { zodResolver } from '@hookform/resolvers/zod';
import { CircleCheck, RefreshCw, TriangleAlert } from 'lucide-react';
import { useId, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { FormField, Input } from '@/components/ui/Form';
import { CreateClientValidationError } from '@/features/admin-accounts/api';
import { UserFacingError } from '@/lib/errors';
import { generateTemporaryPassword } from '../password';
import { useCreateClient } from '../queries';
import { createClientSchema, type CreateClientValues } from '../schemas';
import { CopyButton } from './CopyButton';

interface AddClientDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface Created {
  id: string;
  email: string;
  fullName: string;
  temporaryPassword: string;
}

const emptyValues = (): CreateClientValues => ({
  fullName: '',
  email: '',
  phone: '',
  temporaryPassword: generateTemporaryPassword(),
});

/**
 * Creates a client login via the admin-create-client Edge Function. The temporary password is
 * shown exactly once after creation so the admin can share it securely.
 */
export function AddClientDialog({ open, onOpenChange }: AddClientDialogProps) {
  const formId = useId();
  const createClient = useCreateClient();
  const [created, setCreated] = useState<Created | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateClientValues>({
    resolver: zodResolver(createClientSchema),
    defaultValues: emptyValues(),
  });

  function close() {
    if (isSubmitting) return;
    onOpenChange(false);
    // Clear everything (including the shown password) once the dialog is closed.
    setTimeout(() => {
      setCreated(null);
      setFormError(null);
      reset(emptyValues());
    }, 200);
  }

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      const result = await createClient.mutateAsync({
        email: values.email,
        fullName: values.fullName,
        phone: values.phone || null,
        temporaryPassword: values.temporaryPassword,
      });
      setCreated({ ...result, fullName: values.fullName, temporaryPassword: values.temporaryPassword });
    } catch (err) {
      if (err instanceof CreateClientValidationError) {
        for (const [field, message] of Object.entries(err.fields)) {
          if (message) setError(field as keyof CreateClientValues, { message });
        }
      }
      setFormError(
        err instanceof UserFacingError ? err.message : 'The account could not be created. Please try again.',
      );
    }
  });

  if (created) {
    return (
      <Dialog
        open={open}
        onOpenChange={(next) => !next && close()}
        title="Client account created"
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={close}>
              Done
            </Button>
            <Button asChild>
              <Link to={`/admin/clients/${created.id}`} onClick={close}>
                View client
              </Link>
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="flex items-center gap-2 text-sm">
            <CircleCheck aria-hidden="true" className="size-5 text-gain" />
            <span>
              <span className="font-medium">{created.fullName}</span> can now sign in.
            </span>
          </p>
          <dl className="divide-y divide-line rounded-[var(--radius-control)] border border-line text-sm">
            <div className="flex items-center justify-between gap-3 px-3 py-2">
              <div className="min-w-0">
                <dt className="text-xs text-muted">Email</dt>
                <dd className="truncate font-medium">{created.email}</dd>
              </div>
              <CopyButton value={created.email} label="email" />
            </div>
            <div className="flex items-center justify-between gap-3 px-3 py-2">
              <div className="min-w-0">
                <dt className="text-xs text-muted">Temporary password</dt>
                <dd className="truncate font-mono num font-medium">{created.temporaryPassword}</dd>
              </div>
              <CopyButton value={created.temporaryPassword} label="temporary password" />
            </div>
          </dl>
          <p className="flex items-start gap-2 rounded-[var(--radius-control)] bg-warning-soft px-3 py-2 text-sm text-warning">
            <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            <span>
              Share these details privately. The password will not be shown again. Ask the client to change it
              after their first sign-in (Forgot password → reset).
            </span>
          </p>
        </div>
      </Dialog>
    );
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => !next && close()}
      title="Add client"
      description="Creates a client login. Clients can only see their own records."
      dismissible={!isSubmitting}
      footer={
        <>
          <Button variant="secondary" onClick={close} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" form={formId} loading={isSubmitting}>
            Create client
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
        <FormField label="Email address" required hint="Used to sign in." error={errors.email?.message}>
          {(field) => (
            <Input {...field} {...register('email')} type="email" inputMode="email" autoComplete="off" />
          )}
        </FormField>
        <FormField label="Phone" hint="Optional, e.g. +91 98765 43210" error={errors.phone?.message}>
          {(field) => (
            <Input {...field} {...register('phone')} type="tel" inputMode="tel" autoComplete="off" />
          )}
        </FormField>
        <FormField
          label="Temporary password"
          required
          hint="Generated for you. At least 10 characters with a letter and a number."
          error={errors.temporaryPassword?.message}
        >
          {(field) => (
            <div className="flex gap-2">
              <Input
                {...field}
                {...register('temporaryPassword')}
                className="font-mono"
                autoComplete="new-password"
                spellCheck={false}
              />
              <Button
                variant="secondary"
                size="icon"
                aria-label="Generate a new password"
                onClick={() =>
                  setValue('temporaryPassword', generateTemporaryPassword(), { shouldValidate: true })
                }
              >
                <RefreshCw aria-hidden="true" className="size-4" />
              </Button>
            </div>
          )}
        </FormField>
      </form>
    </Dialog>
  );
}
