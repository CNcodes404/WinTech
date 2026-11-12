import { Navigate, useNavigate } from 'react-router';
import { PageSpinner } from '@/components/ui/Spinner';
import { useToast } from '@/components/ui/toast-context';
import { useDocumentTitle } from '@/lib/hooks/useDocumentTitle';
import { useAuth } from '../auth-context';
import { AuthHeading } from '../components/AuthLayout';
import { NewPasswordForm } from '../components/NewPasswordForm';
import { homePathFor } from '../types';

/** Shown after signing in with a temporary password set by the administrator. */
export function ChangePasswordRequiredPage() {
  useDocumentTitle('Set your password');
  const auth = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  if (auth.status === 'loading' || auth.profileLoading) return <PageSpinner />;
  if (auth.status === 'signedOut') return <Navigate to="/login" replace />;
  if (!auth.profile) return <Navigate to="/" replace />;
  if (!auth.profile.must_change_password) return <Navigate to={homePathFor(auth.profile.role)} replace />;

  const role = auth.profile.role;
  return (
    <>
      <AuthHeading
        title="Set your own password"
        description="Your account was created with a temporary password. Choose a new one to continue."
      />
      <NewPasswordForm
        submitLabel="Save password and continue"
        onDone={() => {
          toast({ title: 'Password updated' });
          navigate(homePathFor(role), { replace: true });
        }}
      />
    </>
  );
}
