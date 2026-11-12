import { useEffect } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router';
import { useAuth } from '@/features/auth/auth-context';

/**
 * Top-level route element. Sends users who open a password-recovery link to the reset screen,
 * wherever Supabase redirected them.
 */
export function RootLayout() {
  const { passwordRecovery } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  useEffect(() => {
    if (passwordRecovery && pathname !== '/reset-password') navigate('/reset-password', { replace: true });
  }, [passwordRecovery, pathname, navigate]);

  return <Outlet />;
}
