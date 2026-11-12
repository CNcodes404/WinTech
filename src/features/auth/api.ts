import { supabase } from '@/lib/supabase/client';
import type { Profile } from './types';

export async function signInWithPassword(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signOut() {
  // 'local' scope: sign out this browser only.
  const { error } = await supabase.auth.signOut({ scope: 'local' });
  if (error) throw error;
}

export async function requestPasswordReset(email: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`,
  });
  if (error) throw error;
}

export async function updatePassword(password: string) {
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw error;
  // Clears the "must change temporary password" flag (no-op if not set). A failure here is not
  // fatal: the password itself has already been changed.
  await supabase.rpc('complete_password_change').then(
    () => undefined,
    () => undefined,
  );
}

/** Reads the caller's own profile. RLS guarantees a client can never read anyone else's. */
export async function fetchOwnProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, email, phone, role, status, must_change_password')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}
