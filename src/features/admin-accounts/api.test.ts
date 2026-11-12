import { FunctionsHttpError } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';
import { UserFacingError } from '@/lib/errors';
import { supabaseMock } from '../../../tests/mocks/supabase';
import {
  createClientAccount,
  CreateClientValidationError,
  GENERIC_ERROR,
  setUserRole,
  setUserStatus,
} from './api';

function httpError(status: number, body: unknown) {
  return new FunctionsHttpError(
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }),
  );
}

describe('setUserRole / setUserStatus', () => {
  it('calls the audited RPCs with the reason', async () => {
    await setUserRole('u1', 'admin', 'Second admin for demo');
    expect(supabaseMock.rpc).toHaveBeenCalledWith('admin_set_user_role', {
      p_user_id: 'u1',
      p_role: 'admin',
      p_reason: 'Second admin for demo',
    });
    await setUserStatus('u1', 'inactive', 'Left the group');
    expect(supabaseMock.rpc).toHaveBeenCalledWith('admin_set_user_status', {
      p_user_id: 'u1',
      p_status: 'inactive',
      p_reason: 'Left the group',
    });
  });

  it('passes through deliberate, user-safe database messages', async () => {
    supabaseMock.rpc.mockResolvedValueOnce({
      data: null,
      error: { code: '23514', message: 'You cannot change your own role.' },
    });
    const err = await setUserRole('me', 'client', 'Testing self change').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(UserFacingError);
    expect((err as Error).message).toBe('You cannot change your own role.');
  });

  it('hides unexpected database errors', async () => {
    supabaseMock.rpc.mockResolvedValueOnce({
      data: null,
      error: { code: '42P01', message: 'relation "public.secret" does not exist' },
    });
    const err = await setUserStatus('u1', 'inactive', 'reason here').catch((e: unknown) => e);
    expect(err).not.toBeInstanceOf(UserFacingError);
    expect((err as Error).message).toBe(GENERIC_ERROR);
  });
});

describe('createClientAccount', () => {
  const input = { email: 'p@example.test', fullName: 'Priya Shah', temporaryPassword: 'Welcome2026x' };

  it('invokes the Edge Function and returns the new account', async () => {
    supabaseMock.functions.invoke.mockResolvedValueOnce({
      data: { id: 'new-id', email: input.email },
      error: null,
    });
    await expect(createClientAccount(input)).resolves.toEqual({ id: 'new-id', email: input.email });
    expect(supabaseMock.functions.invoke).toHaveBeenCalledWith('admin-create-client', {
      body: { ...input, phone: null },
    });
  });

  it('surfaces field errors for the form', async () => {
    supabaseMock.functions.invoke.mockResolvedValueOnce({
      data: null,
      error: httpError(422, {
        error: 'validation_failed',
        fields: { email: 'Enter a valid email address.' },
      }),
    });
    const err = await createClientAccount(input).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(CreateClientValidationError);
    expect((err as CreateClientValidationError).fields.email).toBe('Enter a valid email address.');
  });

  it('maps known errors to friendly messages', async () => {
    supabaseMock.functions.invoke.mockResolvedValueOnce({
      data: null,
      error: httpError(409, { error: 'email_exists' }),
    });
    await expect(createClientAccount(input)).rejects.toThrow(
      'An account with this email address already exists.',
    );

    supabaseMock.functions.invoke.mockResolvedValueOnce({
      data: null,
      error: httpError(403, { error: 'forbidden' }),
    });
    await expect(createClientAccount(input)).rejects.toThrow(/Only active administrators/);
  });

  it('uses a generic message for anything else', async () => {
    supabaseMock.functions.invoke.mockResolvedValueOnce({ data: null, error: new Error('network down') });
    await expect(createClientAccount(input)).rejects.toThrow(
      'The account could not be created. Please try again.',
    );
  });
});
