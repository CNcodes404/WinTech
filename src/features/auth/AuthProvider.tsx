import type { Session } from '@supabase/supabase-js';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { supabase } from '@/lib/supabase/client';
import { fetchOwnProfile, signOut as apiSignOut } from './api';
import { AuthContext, type AuthState } from './auth-context';
import { profileQueryKey } from './redirects';

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [session, setSession] = useState<Session | null>(null);
  const [initialised, setInitialised] = useState(false);
  const [passwordRecovery, setPasswordRecovery] = useState(false);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setInitialised(true);
    });

    // Keep this callback synchronous and free of Supabase calls (avoids auth lock deadlocks).
    const { data } = supabase.auth.onAuthStateChange((event, next) => {
      setSession(next);
      setInitialised(true);
      if (event === 'PASSWORD_RECOVERY') setPasswordRecovery(true);
      if (event === 'SIGNED_OUT') {
        setPasswordRecovery(false);
        // Drop every cached record so nothing leaks to the next user of this browser.
        queryClient.clear();
      }
    });

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, [queryClient]);

  const userId = session?.user.id;
  const profileQuery = useQuery({
    queryKey: profileQueryKey(userId),
    queryFn: () => fetchOwnProfile(userId!),
    enabled: Boolean(userId),
    staleTime: 5 * 60_000,
  });

  const signOut = useCallback(async () => {
    try {
      await apiSignOut();
    } finally {
      setSession(null);
      queryClient.clear();
    }
  }, [queryClient]);

  const clearPasswordRecovery = useCallback(() => setPasswordRecovery(false), []);

  const value = useMemo<AuthState>(
    () => ({
      status: !initialised ? 'loading' : session ? 'signedIn' : 'signedOut',
      session,
      user: session?.user ?? null,
      profile: profileQuery.data ?? null,
      profileLoading: Boolean(userId) && profileQuery.isPending,
      profileError: profileQuery.isError,
      passwordRecovery,
      clearPasswordRecovery,
      signOut,
    }),
    [
      initialised,
      session,
      userId,
      profileQuery.data,
      profileQuery.isPending,
      profileQuery.isError,
      passwordRecovery,
      clearPasswordRecovery,
      signOut,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
