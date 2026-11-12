import { homePathFor, type AppRole } from './types';

export const profileQueryKey = (userId: string | undefined) => ['auth', 'profile', userId] as const;

/**
 * Only follow a "return to" path that belongs to the signed-in user's own area. Prevents open
 * redirects (//evil.example) and sending clients to admin URLs.
 */
export function safeReturnPath(from: unknown, role: AppRole): string {
  const home = homePathFor(role);
  if (typeof from !== 'string' || !from.startsWith('/') || from.startsWith('//')) return home;
  const area = role === 'admin' ? '/admin' : '/client';
  return from === area || from.startsWith(`${area}/`) ? from : home;
}
