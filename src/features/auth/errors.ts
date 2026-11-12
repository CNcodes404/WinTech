/**
 * Map Supabase Auth errors to short, user-safe messages. Never echo raw server messages, and never
 * reveal whether a given email address has an account.
 */
interface AuthLikeError {
  code?: string;
  status?: number;
  message?: string;
}

const GENERIC = 'Something went wrong. Please try again in a moment.';

const BY_CODE: Record<string, string> = {
  invalid_credentials: 'Email or password is incorrect.',
  email_not_confirmed:
    'Please confirm your email address first, or ask the administrator to resend the invite.',
  user_banned: 'This account is disabled. Please contact the administrator.',
  over_request_rate_limit: 'Too many attempts. Please wait a few minutes and try again.',
  over_email_send_rate_limit: 'Too many emails requested. Please wait a few minutes and try again.',
  same_password: 'Your new password must be different from the current one.',
  weak_password: 'This password is too weak. Use at least 10 characters with letters and numbers.',
  session_not_found: 'Your reset link has expired. Please request a new one.',
  flow_state_expired: 'Your reset link has expired. Please request a new one.',
  otp_expired: 'Your reset link has expired. Please request a new one.',
  signup_disabled: 'Accounts are created by the administrator.',
};

export function authErrorMessage(error: unknown): string {
  if (!error || typeof error !== 'object') return GENERIC;
  const e = error as AuthLikeError;
  if (e.code && BY_CODE[e.code]) return BY_CODE[e.code]!;
  if (e.status === 429) return BY_CODE.over_request_rate_limit!;
  if (e.message === 'Failed to fetch' || e.message?.includes('NetworkError')) {
    return 'Cannot reach the server. Check your internet connection and try again.';
  }
  return GENERIC;
}
