import { Navigate, Outlet, useLocation } from 'react-router';
import { PageSpinner } from '@/components/ui/Spinner';
import { ErrorState } from '@/components/ui/States';
import { useAuth } from './auth-context';
import { AccountUnavailable } from './pages/RootRedirect';
import { homePathFor, type AppRole } from './types';

/**
 * Route guard for an area of the app. This is a usability layer only: every query is also
 * authorised by Postgres RLS, so a bypassed guard still cannot reveal data.
 *
 * - Signed out            → /login (remembers where the user was going)
 * - Inactive / no profile → account notice
 * - Wrong role            → the user's own home (clients never see admin screens)
 */
export function RequireRole({ allow: role }: { allow: AppRole }) {
  const auth = useAuth();
  const location = useLocation();

  if (auth.status === 'loading' || auth.profileLoading) return <PageSpinner />;

  if (auth.status === 'signedOut') {
    return <Navigate to="/login" replace state={{ from: `${location.pathname}${location.search}` }} />;
  }

  if (auth.profileError) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <ErrorState message="We could not load your account. Please refresh the page." />
      </div>
    );
  }

  if (!auth.profile || auth.profile.status !== 'active') return <AccountUnavailable />;

  if (auth.profile.role !== role) return <Navigate to={homePathFor(auth.profile.role)} replace />;

  return <Outlet />;
}
