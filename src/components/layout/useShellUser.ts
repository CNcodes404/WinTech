import { useCallback } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '@/features/auth/auth-context';
import { ROLE_LABEL } from '@/features/auth/types';
import type { ShellUser } from './UserMenu';

const SIGNED_OUT: ShellUser = { name: 'Not signed in', email: '—', roleLabel: 'Guest' };

/** Identity + sign-out handler for the app shells' account menu. */
export function useShellUser(): { user: ShellUser; onSignOut?: () => void } {
  const { profile, user, signOut } = useAuth();
  const navigate = useNavigate();

  const onSignOut = useCallback(() => {
    void signOut()
      .catch(() => {})
      .finally(() => navigate('/login', { replace: true }));
  }, [signOut, navigate]);

  if (!user) return { user: SIGNED_OUT };
  return {
    user: {
      name: profile?.full_name || profile?.email || user.email || 'Account',
      email: profile?.email ?? user.email ?? '',
      roleLabel: profile ? ROLE_LABEL[profile.role] : '…',
    },
    onSignOut,
  };
}
