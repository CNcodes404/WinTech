import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { makeProfile, mockSignedIn, mockSignInSucceeds } from '../../tests/mocks/supabase';
import { renderRoute } from '../../tests/utils';
import { ADMIN_NAV, CLIENT_NAV } from './navigation';

const ADMIN = makeProfile({
  id: '00000000-0000-4000-8000-0000000000a1',
  role: 'admin',
  full_name: 'Asha Admin',
});
const CLIENT = makeProfile({ id: '00000000-0000-4000-8000-0000000000c1', full_name: 'Chetan Client' });

describe('routing', () => {
  it('renders the dev foundation preview at /dev/foundation', async () => {
    renderRoute('/dev/foundation');
    expect(
      await screen.findByRole('heading', { level: 1, name: /WinTech Investment Platform/i }),
    ).toBeInTheDocument();
    expect(screen.getByText('1,363.63636363')).toBeInTheDocument();
    expect(screen.getByText('₹1,50,000.00')).toBeInTheDocument();
  });

  it('redirects /admin to /admin/overview inside the admin shell', async () => {
    mockSignedIn(ADMIN);
    const { router } = renderRoute('/admin');
    expect(await screen.findByRole('heading', { level: 1, name: 'Overview' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/admin/overview');
    expect(screen.getAllByRole('navigation', { name: 'Admin' }).length).toBeGreaterThan(0);
  });

  it('redirects /client to /client/overview inside the client shell', async () => {
    mockSignedIn(CLIENT);
    const { router } = renderRoute('/client');
    expect(await screen.findByRole('heading', { level: 1, name: 'Overview' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/client/overview');
  });

  it('every admin and client nav item resolves to a page', async () => {
    mockSignedIn(ADMIN);
    for (const item of ADMIN_NAV) {
      const { unmount } = renderRoute(`/admin/${item.path}`);
      expect(await screen.findByRole('heading', { level: 1, name: item.title })).toBeInTheDocument();
      unmount();
    }
    mockSignedIn(CLIENT);
    for (const item of CLIENT_NAV) {
      const { unmount } = renderRoute(`/client/${item.path}`);
      expect(await screen.findByRole('heading', { level: 1, name: item.title })).toBeInTheDocument();
      unmount();
    }
  });

  it('shows 404 for unknown top-level and in-shell routes', async () => {
    const { unmount } = renderRoute('/does-not-exist');
    expect(await screen.findByRole('heading', { name: 'Page not found' })).toBeInTheDocument();
    unmount();
    mockSignedIn(ADMIN);
    renderRoute('/admin/nope');
    expect(await screen.findByRole('heading', { name: 'Page not found' })).toBeInTheDocument();
    expect(screen.getAllByRole('navigation', { name: 'Admin' }).length).toBeGreaterThan(0);
  });

  it('sets the document title from the page header', async () => {
    mockSignedIn(ADMIN);
    renderRoute('/admin/clients');
    await screen.findByRole('heading', { level: 1, name: 'Clients' });
    expect(document.title).toBe('Clients · WinTech');
  });

  it('settlements page explains it is not available in V1', async () => {
    mockSignedIn(ADMIN);
    renderRoute('/admin/settlements');
    const main = await screen.findByRole('main');
    expect(within(main).getByText('Not available in V1')).toBeInTheDocument();
  });
});

describe('route guards', () => {
  it('sends signed-out visitors of admin pages to sign-in, then back after login', async () => {
    const { router, user } = renderRoute('/admin/clients');
    await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
    expect(screen.queryByRole('navigation', { name: 'Admin' })).toBeNull();

    mockSignInSucceeds(ADMIN);
    await user.type(await screen.findByLabelText('Email address'), ADMIN.email);
    await user.type(screen.getByLabelText('Password'), 'correct-horse-1');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/admin/clients'));
  });

  it('sends signed-out visitors of client pages to sign-in', async () => {
    const { router } = renderRoute('/client/statements');
    await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
  });

  it('never shows admin screens to a client', async () => {
    mockSignedIn(CLIENT);
    const { router } = renderRoute('/admin/contributions');
    await waitFor(() => expect(router.state.location.pathname).toBe('/client/overview'));
    expect(screen.queryByRole('navigation', { name: 'Admin' })).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Contributions' })).toBeNull();
  });

  it('keeps admins in the admin area', async () => {
    mockSignedIn(ADMIN);
    const { router } = renderRoute('/client/overview');
    await waitFor(() => expect(router.state.location.pathname).toBe('/admin/overview'));
  });

  it('blocks inactive accounts from both areas', async () => {
    mockSignedIn(makeProfile({ role: 'admin', status: 'inactive' }));
    renderRoute('/admin/overview');
    expect(await screen.findByRole('heading', { name: 'Account not available' })).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Admin' })).toBeNull();
  });

  it('does not follow a return path into another role’s area', async () => {
    const { router, user } = renderRoute('/admin/reports');
    await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
    mockSignInSucceeds(CLIENT);
    await user.type(await screen.findByLabelText('Email address'), CLIENT.email);
    await user.type(screen.getByLabelText('Password'), 'correct-horse-1');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/client/overview'));
  });
});
