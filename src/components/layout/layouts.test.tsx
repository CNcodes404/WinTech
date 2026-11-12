import { screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { ADMIN_NAV } from '@/app/navigation';
import { makeProfile, mockSignedIn, supabaseMock } from '../../../tests/mocks/supabase';
import { renderRoute } from '../../../tests/utils';

describe('AdminLayout', () => {
  beforeEach(() => mockSignedIn(makeProfile({ role: 'admin', full_name: 'Asha Admin' })));

  it('shows the signed-in admin and signs out to the login page', async () => {
    const { user, router } = renderRoute('/admin/overview');
    const trigger = await screen.findByRole('button', { name: 'Account menu for Asha Admin' });
    await user.click(trigger);
    await user.click(await screen.findByRole('menuitem', { name: 'Sign out' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
    expect(supabaseMock.auth.signOut).toHaveBeenCalled();
  });

  it('lists every admin section in spec order and marks the active page', async () => {
    renderRoute('/admin/clients');
    await screen.findByRole('heading', { level: 1, name: 'Clients' });

    const [sidebar] = screen.getAllByRole('navigation', { name: 'Admin' });
    const items = within(sidebar!).getAllByRole('listitem');
    expect(items.map((li) => li.textContent?.replace('Later', '').trim())).toEqual(
      ADMIN_NAV.map((i) => i.title),
    );

    expect(within(sidebar!).getByRole('link', { name: 'Clients' })).toHaveAttribute('aria-current', 'page');
    expect(within(sidebar!).getByRole('link', { name: 'Overview' })).not.toHaveAttribute('aria-current');
  });

  it('renders Settlements as disabled (not a link) in V1', async () => {
    renderRoute('/admin/overview');
    await screen.findByRole('heading', { level: 1, name: 'Overview' });
    const [sidebar] = screen.getAllByRole('navigation', { name: 'Admin' });
    expect(within(sidebar!).queryByRole('link', { name: /Settlements/ })).toBeNull();
    expect(within(sidebar!).getByText('Settlements').closest('[aria-disabled="true"]')).not.toBeNull();
  });

  it('opens the mobile drawer and closes it after navigating', async () => {
    const { user, router } = renderRoute('/admin/overview');
    await screen.findByRole('heading', { level: 1, name: 'Overview' });

    await user.click(screen.getByRole('button', { name: 'Open navigation menu' }));
    const drawer = await screen.findByRole('dialog');
    await user.click(within(drawer).getByRole('link', { name: 'Contributions' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(router.state.location.pathname).toBe('/admin/contributions');
  });

  it('shows the persistent demo disclaimer', async () => {
    renderRoute('/admin/overview');
    expect(await screen.findByText(/not live market data/i)).toBeInTheDocument();
  });

  it('provides a skip link to main content', async () => {
    renderRoute('/admin/overview');
    expect(await screen.findByRole('link', { name: 'Skip to content' })).toHaveAttribute('href', '#main');
  });
});

describe('ClientLayout', () => {
  beforeEach(() => mockSignedIn(makeProfile({ role: 'client' })));

  it('does not expose any admin navigation', async () => {
    renderRoute('/client/overview');
    await screen.findByRole('heading', { level: 1, name: 'Overview' });
    expect(screen.queryByRole('navigation', { name: 'Admin' })).toBeNull();
    for (const label of ['Clients', 'Contributions', 'Portfolio', 'Profit Sharing', 'Settings']) {
      expect(screen.queryByRole('link', { name: label })).toBeNull();
    }
    expect(screen.queryAllByRole('link').some((a) => a.getAttribute('href')?.startsWith('/admin'))).toBe(
      false,
    );
  });

  it('marks the active client tab', async () => {
    renderRoute('/client/statements');
    await screen.findByRole('heading', { level: 1, name: 'Statements' });
    const navs = screen.getAllByRole('navigation', { name: 'Client' });
    for (const nav of navs) {
      expect(within(nav).getByRole('link', { name: /Statements/ })).toHaveAttribute('aria-current', 'page');
    }
  });
});
