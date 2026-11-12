import { screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { readSupabaseEnv, ConfigError } from '@/lib/supabase/env';
import { makeProfile, mockSignedIn, mockSignInSucceeds, supabaseMock } from '../../../tests/mocks/supabase';
import { renderRoute } from '../../../tests/utils';
import { authErrorMessage } from './errors';
import { safeReturnPath } from './redirects';

const ADMIN = makeProfile({
  id: '00000000-0000-4000-8000-0000000000a1',
  role: 'admin',
  full_name: 'Asha Admin',
});
const CLIENT = makeProfile({
  id: '00000000-0000-4000-8000-0000000000c1',
  role: 'client',
  full_name: 'Chetan Client',
});

describe('readSupabaseEnv', () => {
  const url = 'https://abcdefghijklmnop.supabase.co';

  it('accepts a project URL and publishable key', () => {
    expect(readSupabaseEnv({ VITE_SUPABASE_URL: url, VITE_SUPABASE_ANON_KEY: 'sb_publishable_x' })).toEqual({
      url,
      anonKey: 'sb_publishable_x',
    });
  });

  it('rejects missing values and URLs with a path', () => {
    expect(() => readSupabaseEnv({})).toThrow(ConfigError);
    expect(() =>
      readSupabaseEnv({ VITE_SUPABASE_URL: `${url}/rest/v1/`, VITE_SUPABASE_ANON_KEY: 'sb_publishable_x' }),
    ).toThrow(/no path/);
  });

  it('refuses secret keys in the browser', () => {
    expect(() =>
      readSupabaseEnv({ VITE_SUPABASE_URL: url, VITE_SUPABASE_ANON_KEY: 'sb_secret_abc' }),
    ).toThrow(/secret/);
    const payload = btoa(JSON.stringify({ role: 'service_role' }));
    expect(() =>
      readSupabaseEnv({ VITE_SUPABASE_URL: url, VITE_SUPABASE_ANON_KEY: `h.${payload}.s` }),
    ).toThrow(/secret/);
  });
});

describe('authErrorMessage', () => {
  it('maps known codes and hides raw messages', () => {
    expect(authErrorMessage({ code: 'invalid_credentials' })).toBe('Email or password is incorrect.');
    expect(authErrorMessage({ status: 429 })).toMatch(/Too many attempts/);
    expect(authErrorMessage({ message: 'relation "x" does not exist' })).toMatch(/Something went wrong/);
  });
});

describe('safeReturnPath', () => {
  it('only returns to paths inside the user’s own area', () => {
    expect(safeReturnPath('/admin/clients', 'admin')).toBe('/admin/clients');
    expect(safeReturnPath('/admin/clients', 'client')).toBe('/client/overview');
    expect(safeReturnPath('//evil.example', 'admin')).toBe('/admin/overview');
    expect(safeReturnPath('/administrator', 'admin')).toBe('/admin/overview');
    expect(safeReturnPath(undefined, 'client')).toBe('/client/overview');
  });
});

describe('LoginPage', () => {
  it('shows inline validation errors', async () => {
    const { user } = renderRoute('/login');
    await user.click(await screen.findByRole('button', { name: 'Sign in' }));
    expect(await screen.findByText('Enter your email address.')).toBeInTheDocument();
    expect(screen.getByText('Enter your password.')).toBeInTheDocument();
    expect(supabaseMock.auth.signInWithPassword).not.toHaveBeenCalled();
  });

  it('shows a friendly message for wrong credentials', async () => {
    supabaseMock.auth.signInWithPassword.mockResolvedValueOnce({
      data: { user: null, session: null },
      error: { code: 'invalid_credentials', status: 400, message: 'Invalid login credentials' },
    });
    const { user } = renderRoute('/login');
    await user.type(await screen.findByLabelText('Email address'), 'someone@example.test');
    await user.type(screen.getByLabelText('Password'), 'wrong-password');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Email or password is incorrect.');
  });

  it('sends an admin to the admin overview', async () => {
    mockSignInSucceeds(ADMIN);
    const { user, router } = renderRoute('/login');
    await user.type(await screen.findByLabelText('Email address'), ADMIN.email);
    await user.type(screen.getByLabelText('Password'), 'correct-horse-1');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/admin/overview'));
  });

  it('sends a client to the client overview', async () => {
    mockSignInSucceeds(CLIENT);
    const { user, router } = renderRoute('/login');
    await user.type(await screen.findByLabelText('Email address'), CLIENT.email);
    await user.type(screen.getByLabelText('Password'), 'correct-horse-1');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/client/overview'));
  });

  it('blocks inactive accounts and signs them out', async () => {
    mockSignInSucceeds(makeProfile({ status: 'inactive' }));
    const { user } = renderRoute('/login');
    await user.type(await screen.findByLabelText('Email address'), 'old@example.test');
    await user.type(screen.getByLabelText('Password'), 'correct-horse-1');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/not active/);
    expect(supabaseMock.auth.signOut).toHaveBeenCalled();
  });

  it('toggles password visibility', async () => {
    const { user } = renderRoute('/login');
    const input = await screen.findByLabelText('Password');
    expect(input).toHaveAttribute('type', 'password');
    await user.click(screen.getByRole('button', { name: 'Show password' }));
    expect(input).toHaveAttribute('type', 'text');
  });
});

describe('root redirect', () => {
  it('sends signed-out visitors to /login', async () => {
    const { router } = renderRoute('/');
    await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
  });

  it('sends a signed-in client to their overview', async () => {
    mockSignedIn(CLIENT);
    const { router } = renderRoute('/');
    await waitFor(() => expect(router.state.location.pathname).toBe('/client/overview'));
  });

  it('shows an account notice for inactive profiles', async () => {
    mockSignedIn(makeProfile({ status: 'inactive' }));
    renderRoute('/');
    expect(await screen.findByRole('heading', { name: 'Account not available' })).toBeInTheDocument();
  });
});

describe('ForgotPasswordPage', () => {
  it('shows the same confirmation whether or not the account exists', async () => {
    supabaseMock.auth.resetPasswordForEmail.mockResolvedValueOnce({
      data: null,
      error: { code: 'user_not_found', status: 400, message: 'User not found' },
    } as never);
    const { user } = renderRoute('/forgot-password');
    await user.type(await screen.findByLabelText('Email address'), 'nobody@example.test');
    await user.click(screen.getByRole('button', { name: 'Send reset link' }));
    expect(await screen.findByRole('heading', { name: 'Check your email' })).toBeInTheDocument();
    expect(supabaseMock.auth.resetPasswordForEmail).toHaveBeenCalledWith('nobody@example.test', {
      redirectTo: `${window.location.origin}/reset-password`,
    });
  });
});

describe('ResetPasswordPage', () => {
  it('explains an invalid or expired link when there is no recovery session', async () => {
    renderRoute('/reset-password');
    expect(await screen.findByRole('heading', { name: 'Link invalid or expired' })).toBeInTheDocument();
  });

  it('validates and updates the password', async () => {
    mockSignedIn(CLIENT);
    const { user, router } = renderRoute('/reset-password');
    await user.type(await screen.findByLabelText(/^New password/), 'short');
    await user.type(screen.getByLabelText('Confirm new password'), 'different');
    await user.click(screen.getByRole('button', { name: 'Update password' }));
    expect(await screen.findByText('Use at least 10 characters.')).toBeInTheDocument();
    expect(supabaseMock.auth.updateUser).not.toHaveBeenCalled();

    await user.clear(screen.getByLabelText(/^New password/));
    await user.clear(screen.getByLabelText('Confirm new password'));
    await user.type(screen.getByLabelText(/^New password/), 'NewSecure123');
    await user.type(screen.getByLabelText('Confirm new password'), 'NewSecure123');
    await user.click(screen.getByRole('button', { name: 'Update password' }));

    await waitFor(() =>
      expect(supabaseMock.auth.updateUser).toHaveBeenCalledWith({ password: 'NewSecure123' }),
    );
    await waitFor(() => expect(router.state.location.pathname).toBe('/client/overview'));
  });
});
