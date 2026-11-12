import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, Navigate, useLocation, useNavigate } from 'react-router';
import { Button } from '@/components/ui/Button';
import { FormField, Input } from '@/components/ui/Form';
import { PageSpinner } from '@/components/ui/Spinner';
import { useDocumentTitle } from '@/lib/hooks/useDocumentTitle';
import { fetchOwnProfile, signInWithPassword, signOut } from '../api';
import { useAuth } from '../auth-context';
import { AuthHeading, FormAlert } from '../components/AuthLayout';
import { PasswordInput } from '../components/PasswordInput';
import { authErrorMessage } from '../errors';
import { profileQueryKey, safeReturnPath } from '../redirects';
import { loginSchema, type LoginValues } from '../schemas';

export function LoginPage() {
  useDocumentTitle('Sign in');
  const auth = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const from = (location.state as { from?: string } | null)?.from;

  // Already signed in with an active profile: go straight to the right area.
  if (auth.status === 'loading') return <PageSpinner />;
  if (auth.status === 'signedIn' && auth.profile?.status === 'active' && !isSubmitting) {
    return <Navigate to={safeReturnPath(from, auth.profile.role)} replace />;
  }

  const onSubmit = handleSubmit(async ({ email, password }) => {
    setFormError(null);
    try {
      const { user } = await signInWithPassword(email, password);
      const profile = await queryClient.fetchQuery({
        queryKey: profileQueryKey(user.id),
        queryFn: () => fetchOwnProfile(user.id),
      });
      if (!profile || profile.status !== 'active') {
        await signOut();
        setFormError('This account is not active. Please contact the administrator.');
        return;
      }
      navigate(safeReturnPath(from, profile.role), { replace: true });
    } catch (err) {
      setFormError(authErrorMessage(err));
    }
  });

  return (
    <>
      <AuthHeading
        title="Sign in"
        description="Use the email address your administrator registered for you."
      />
      <FormAlert message={formError} />
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <FormField label="Email address" error={errors.email?.message}>
          {(field) => (
            <Input {...field} {...register('email')} type="email" autoComplete="username" inputMode="email" />
          )}
        </FormField>
        <FormField label="Password" error={errors.password?.message}>
          {(field) => <PasswordInput {...field} {...register('password')} autoComplete="current-password" />}
        </FormField>
        <div className="flex justify-end">
          <Link to="/forgot-password" className="text-sm font-medium text-emerald-600 hover:underline">
            Forgot password?
          </Link>
        </div>
        <Button type="submit" className="w-full" loading={isSubmitting}>
          Sign in
        </Button>
      </form>
      <p className="mt-6 text-center text-xs text-muted">
        There is no public sign-up. Accounts are created by the administrator.
      </p>
    </>
  );
}
