// Pure validation for the admin-create-client Edge Function.
// No Deno or Node APIs: shared by the function (Deno) and unit tests (Vitest).

export interface CreateClientInput {
  email: string;
  fullName: string;
  phone: string | null;
  temporaryPassword: string;
}

export type FieldErrors = Partial<Record<keyof CreateClientInput, string>>;

export type ValidationResult = { ok: true; value: CreateClientInput } | { ok: false; errors: FieldErrors };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE = /^\+?[0-9 ()-]{7,20}$/;

export function validateCreateClientInput(raw: unknown): ValidationResult {
  const body = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const errors: FieldErrors = {};

  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  if (!email) errors.email = 'Email is required.';
  else if (email.length > 320 || !EMAIL.test(email)) errors.email = 'Enter a valid email address.';

  const fullName = typeof body.fullName === 'string' ? body.fullName.trim().replace(/\s+/g, ' ') : '';
  if (fullName.length < 2) errors.fullName = 'Full name is required.';
  else if (fullName.length > 120) errors.fullName = 'Full name must be at most 120 characters.';

  const phoneRaw = typeof body.phone === 'string' ? body.phone.trim() : '';
  const phone = phoneRaw === '' ? null : phoneRaw;
  if (phone !== null && !PHONE.test(phone))
    errors.phone = 'Enter a valid phone number, e.g. +91 98765 43210.';

  const temporaryPassword = typeof body.temporaryPassword === 'string' ? body.temporaryPassword : '';
  if (temporaryPassword.length < 10) errors.temporaryPassword = 'Use at least 10 characters.';
  else if (temporaryPassword.length > 128) errors.temporaryPassword = 'Use at most 128 characters.';
  else if (!/[A-Za-z]/.test(temporaryPassword) || !/[0-9]/.test(temporaryPassword)) {
    errors.temporaryPassword = 'Include at least one letter and one number.';
  }

  // Reject unexpected fields (e.g. attempts to pass "role").
  const allowed = new Set(['email', 'fullName', 'phone', 'temporaryPassword']);
  const unexpected = Object.keys(body).filter((k) => !allowed.has(k));
  if (unexpected.length > 0) {
    return { ok: false, errors: { email: errors.email ?? `Unexpected field(s): ${unexpected.join(', ')}` } };
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, value: { email, fullName, phone, temporaryPassword } };
}

/** CORS: echo the origin only when it is on the allow-list. */
export function corsHeaders(
  origin: string | null,
  allowedOrigins: readonly string[],
): Record<string, string> {
  const headers: Record<string, string> = {
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '600',
    Vary: 'Origin',
  };
  if (origin && allowedOrigins.includes(origin)) headers['Access-Control-Allow-Origin'] = origin;
  return headers;
}
