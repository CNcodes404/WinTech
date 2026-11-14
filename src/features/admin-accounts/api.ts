import { FunctionsHttpError } from '@supabase/supabase-js';
import type { AppRole, ProfileStatus } from '@/features/auth/types';
import { UserFacingError } from '@/lib/errors';
import { supabase } from '@/lib/supabase/client';
import { GENERIC_SAVE_ERROR, toUserFacingDbError as toUserFacing } from '@/lib/supabase/errors';

/**
 * Admin account-management calls. Authorization is enforced server-side (SECURITY DEFINER
 * functions + Edge Function); these wrappers only translate errors into safe messages.
 */

export const GENERIC_ERROR = GENERIC_SAVE_ERROR;

export async function setUserRole(userId: string, role: AppRole, reason: string): Promise<void> {
  const { error } = await supabase.rpc('admin_set_user_role', {
    p_user_id: userId,
    p_role: role,
    p_reason: reason,
  });
  if (error) throw toUserFacing(error);
}

/** Phrase the admin must type to confirm erasing all data (checked again on the server). */
export const RESET_PHRASE = 'ERASE ALL DATA';

/**
 * Erases all cycles, contributions, valuations, NAVs, fees and non-account audit history.
 * User accounts and their history are kept. Returns the number of rows removed per area.
 */
export async function resetAllData(confirmation: string, reason: string): Promise<Record<string, number>> {
  const { data, error } = await supabase.rpc('admin_reset_demo_data', {
    p_confirmation: confirmation,
    p_reason: reason,
  });
  if (error) throw toUserFacing(error);
  return (data ?? {}) as Record<string, number>;
}

export async function setUserStatus(userId: string, status: ProfileStatus, reason: string): Promise<void> {
  const { error } = await supabase.rpc('admin_set_user_status', {
    p_user_id: userId,
    p_status: status,
    p_reason: reason,
  });
  if (error) throw toUserFacing(error);
}

export interface CreateClientAccountInput {
  email: string;
  fullName: string;
  phone?: string | null;
  temporaryPassword: string;
}

export type CreateClientFieldErrors = Partial<Record<keyof CreateClientAccountInput, string>>;

/** Validation problems the form should show next to the fields. */
export class CreateClientValidationError extends UserFacingError {
  readonly fields: CreateClientFieldErrors;
  constructor(fields: CreateClientFieldErrors) {
    super('Please correct the highlighted fields.');
    this.name = 'CreateClientValidationError';
    this.fields = fields;
  }
}

const FUNCTION_ERRORS: Record<string, string> = {
  unauthenticated: 'Your session has expired. Please sign in again.',
  forbidden: 'Only active administrators can create client accounts.',
  email_exists: 'An account with this email address already exists.',
  payload_too_large: 'The request was too large.',
  server_not_configured: 'Account creation is not configured on the server yet.',
};

export async function createClientAccount(
  input: CreateClientAccountInput,
): Promise<{ id: string; email: string }> {
  const { data, error } = await supabase.functions.invoke<{ id: string; email: string }>(
    'admin-create-client',
    { body: { ...input, phone: input.phone ?? null } },
  );

  if (error) {
    if (error instanceof FunctionsHttpError) {
      const body = (await (error.context as Response).json().catch(() => null)) as {
        error?: string;
        fields?: CreateClientFieldErrors;
      } | null;
      if (body?.error === 'validation_failed' && body.fields)
        throw new CreateClientValidationError(body.fields);
      if (body?.error && FUNCTION_ERRORS[body.error]) throw new UserFacingError(FUNCTION_ERRORS[body.error]!);
    }
    throw new Error('The account could not be created. Please try again.');
  }
  if (!data) throw new Error('The account could not be created. Please try again.');
  return data;
}
