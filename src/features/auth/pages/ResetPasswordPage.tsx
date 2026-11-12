import { zodResolver } from '@hookform/resolvers/zod';
import { KeyRound } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router';
import { Button } from '@/components/ui/Button';
import { FormField } from '@/components/ui/Form';
import { useToast } from '@/components/ui/toast-context';
import { useDocumentTitle } from '@/lib/hooks/useDocumentTitle';
import { updatePassword } from '../api';
import { useAuth } from '../auth-context';
import { AuthHeading, FormAlert } from '../components/AuthLayout';
import { PasswordInput } from '../components/PasswordInput';
import { authErrorMessage } from '../errors';
import { newPasswordSchema, type NewPasswordValues } from '../schemas';
import { homePathFor } from '../types';

/**
 * Reached from the emailed recovery link. Supabase exchanges the link code for a short-lived
 * session (detectSessionInUrl); without a session the link is invalid or expired.
 */
export function ResetPasswordPage() {
  useDocumentTitle('Choose a new password');
  const auth = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<NewPasswordValues>({
    resolver: zodResolver(newPasswordSchema),
    defaultValues: { password: '', confirmPassword: '' },
  });

  if (auth.status === 'loading') {
    return (
      <p role="status" className="text-center text-sm text-muted">
        Checking your reset link…
      </p>
    );
  }

  if (auth.status === 'signedOut') {
    return (
      <div className="text-center">
        <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-warning-soft text-warning">
          <KeyRound aria-hidden="true" className="size-6" />
        </span>
        <h1 className="mt-4 text-xl">Link invalid or expired</h1>
        <p className="mt-2 text-sm text-muted">
          Reset links can be used once and expire quickly. Please request a new one.
        </p>
        <Link
          to="/forgot-password"
          className="mt-6 inline-block text-sm font-medium text-emerald-600 hover:underline"
        >
          Request a new link
        </Link>
      </div>
    );
  }

  const onSubmit = handleSubmit(async ({ password }) => {
    setFormError(null);
    try {
      await updatePassword(password);
      auth.clearPasswordRecovery();
      toast({ title: 'Password updated', description: 'Use your new password next time you sign in.' });
      navigate(auth.profile ? homePathFor(auth.profile.role) : '/', { replace: true });
    } catch (err) {
      setFormError(authErrorMessage(err));
    }
  });

  return (
    <>
      <AuthHeading title="Choose a new password" description={auth.user?.email ?? undefined} />
      <FormAlert message={formError} />
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <FormField
          label="New password"
          hint="At least 10 characters, including a letter and a number."
          error={errors.password?.message}
        >
          {(field) => <PasswordInput {...field} {...register('password')} autoComplete="new-password" />}
        </FormField>
        <FormField label="Confirm new password" error={errors.confirmPassword?.message}>
          {(field) => (
            <PasswordInput {...field} {...register('confirmPassword')} autoComplete="new-password" />
          )}
        </FormField>
        <Button type="submit" className="w-full" loading={isSubmitting}>
          Update password
        </Button>
      </form>
    </>
  );
}
