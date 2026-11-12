import { zodResolver } from '@hookform/resolvers/zod';
import { MailCheck } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router';
import { Button } from '@/components/ui/Button';
import { FormField, Input } from '@/components/ui/Form';
import { useDocumentTitle } from '@/lib/hooks/useDocumentTitle';
import { requestPasswordReset } from '../api';
import { AuthHeading, FormAlert } from '../components/AuthLayout';
import { authErrorMessage } from '../errors';
import { forgotPasswordSchema, type ForgotPasswordValues } from '../schemas';

/** Errors that are safe to show because they don't reveal whether the account exists. */
function isNonRevealingError(err: unknown): boolean {
  const e = err as { status?: number; message?: string } | null;
  return e?.status === 429 || e?.message === 'Failed to fetch';
}

export function ForgotPasswordPage() {
  useDocumentTitle('Reset password');
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: '' },
  });

  const onSubmit = handleSubmit(async ({ email }) => {
    setFormError(null);
    try {
      await requestPasswordReset(email);
      setSentTo(email);
    } catch (err) {
      // Same confirmation for unknown emails, so the form can't be used to discover accounts.
      if (isNonRevealingError(err)) setFormError(authErrorMessage(err));
      else setSentTo(email);
    }
  });

  if (sentTo) {
    return (
      <div className="text-center">
        <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-gain-soft text-gain">
          <MailCheck aria-hidden="true" className="size-6" />
        </span>
        <h1 className="mt-4 text-xl">Check your email</h1>
        <p className="mt-2 text-sm text-muted" role="status">
          If an account exists for <span className="font-medium text-ink">{sentTo}</span>, we have sent a link
          to reset the password. The link expires after a short time.
        </p>
        <Link to="/login" className="mt-6 inline-block text-sm font-medium text-emerald-600 hover:underline">
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <>
      <AuthHeading title="Reset password" description="Enter your email and we'll send you a reset link." />
      <FormAlert message={formError} />
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <FormField label="Email address" error={errors.email?.message}>
          {(field) => (
            <Input {...field} {...register('email')} type="email" autoComplete="username" inputMode="email" />
          )}
        </FormField>
        <Button type="submit" className="w-full" loading={isSubmitting}>
          Send reset link
        </Button>
      </form>
      <p className="mt-6 text-center text-sm">
        <Link to="/login" className="font-medium text-emerald-600 hover:underline">
          Back to sign in
        </Link>
      </p>
    </>
  );
}
