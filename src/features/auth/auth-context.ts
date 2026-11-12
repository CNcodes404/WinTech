import type { Session, User } from '@supabase/supabase-js';
import { createContext, useContext } from 'react';
import type { Profile } from './types';

export type AuthStatus = 'loading' | 'signedOut' | 'signedIn';

export interface AuthState {
  status: AuthStatus;
  session: Session | null;
  user: User | null;
  /** Null while loading, or when the account has no profile row. */
  profile: Profile | null;
  profileLoading: boolean;
  profileError: boolean;
  /** True after the user opened a password-recovery link. */
  passwordRecovery: boolean;
  clearPasswordRecovery: () => void;
  signOut: () => Promise<void>;
}

export const AuthContext = createContext<AuthState | null>(null);

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
