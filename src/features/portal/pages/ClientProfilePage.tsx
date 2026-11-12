import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { FormField, Input } from '@/components/ui/Form';
import { useToast } from '@/components/ui/toast-context';
import { useAuth } from '@/features/auth/auth-context';
import { NewPasswordForm } from '@/features/auth/components/NewPasswordForm';
import { clientContactSchema, type ClientContactValues } from '@/features/clients/schemas';
import { UserFacingError } from '@/lib/errors';
import { formatDateTime } from '@/lib/format';
import { useUpdateMyContact } from '../api';

function ContactForm({ userId, fullName, phone }: { userId: string; fullName: string; phone: string }) {
  const { toast } = useToast();
  const update = useUpdateMyContact(userId);
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<ClientContactValues>({
    resolver: zodResolver(clientContactSchema),
    defaultValues: { fullName, phone },
  });

  const onSubmit = handleSubmit(async (v) => {
    setError(null);
    try {
      await update.mutateAsync(v);
      reset(v);
      toast({ title: 'Details updated' });
    } catch (err) {
      setError(
        err instanceof UserFacingError ? err.message : 'Your details could not be saved. Please try again.',
      );
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      {error && (
        <p
          role="alert"
          className="rounded-[var(--radius-control)] border border-loss/20 bg-loss-soft px-3 py-2 text-sm text-loss"
        >
          {error}
        </p>
      )}
      <FormField label="Full name" required error={errors.fullName?.message}>
        {(field) => <Input {...field} {...register('fullName')} autoComplete="name" />}
      </FormField>
      <FormField label="Phone" hint="Optional, e.g. +91 98765 43210" error={errors.phone?.message}>
        {(field) => <Input {...field} {...register('phone')} type="tel" inputMode="tel" autoComplete="tel" />}
      </FormField>
      <Button type="submit" loading={isSubmitting} disabled={!isDirty}>
        Save details
      </Button>
    </form>
  );
}

export function ClientProfilePage() {
  const { profile, user } = useAuth();
  const { toast } = useToast();
  if (!profile) return null;

  return (
    <>
      <PageHeader title="Profile" description="Your personal details and sign-in security." />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Personal details" as="h2" />
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm font-medium">Email (sign-in)</p>
              <p className="mt-0.5 text-sm break-all text-muted">{profile.email}</p>
              <p className="mt-0.5 text-xs text-muted">
                Contact the administrator to change your sign-in email.
              </p>
            </div>
            <ContactForm
              key={profile.id}
              userId={profile.id}
              fullName={profile.full_name}
              phone={profile.phone ?? ''}
            />
          </CardContent>
        </Card>
        <Card className="h-fit">
          <CardHeader
            title="Change password"
            description={
              user?.last_sign_in_at ? `Last signed in ${formatDateTime(user.last_sign_in_at)}` : undefined
            }
            as="h2"
          />
          <CardContent>
            <NewPasswordForm
              submitLabel="Update password"
              onDone={() => toast({ title: 'Password updated' })}
            />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
