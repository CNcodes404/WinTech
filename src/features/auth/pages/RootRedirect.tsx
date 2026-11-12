import { ShieldAlert } from 'lucide-react';
import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router';
import { Button } from '@/components/ui/Button';
import { PageSpinner } from '@/components/ui/Spinner';
import { ErrorState } from '@/components/ui/States';
import { useAuth } from '../auth-context';
import { homePathFor } from '../types';

/** `/` sends people to the right place: sign-in, their role's home, or an account notice. */
export function RootRedirect() {
  const auth = useAuth();

  if (auth.status === 'loading' || auth.profileLoading) return <PageSpinner />;
  if (auth.status === 'signedOut') return <Navigate to="/login" replace />;
  if (auth.profileError) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <ErrorState message="We could not load your account. Please refresh the page." />
      </div>
    );
  }
  if (!auth.profile || auth.profile.status !== 'active') return <AccountUnavailable />;
  return <Navigate to={homePathFor(auth.profile.role)} replace />;
}

export function AccountUnavailable() {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-4 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-warning-soft text-warning">
        <ShieldAlert aria-hidden="true" className="size-6" />
      </span>
      <h1 className="mt-4 text-xl">Account not available</h1>
      <p className="mt-2 text-sm text-muted">
        Your account is inactive or has not been set up yet. Please contact the administrator.
      </p>
      <Button
        variant="secondary"
        className="mt-6"
        loading={busy}
        onClick={async () => {
          setBusy(true);
          await signOut().catch(() => {});
          navigate('/login', { replace: true });
        }}
      >
        Sign out
      </Button>
    </main>
  );
}
