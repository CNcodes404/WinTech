import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderRoute } from '../../tests/utils';
import { ADMIN_NAV, CLIENT_NAV } from './navigation';

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
    const { router } = renderRoute('/admin');
    expect(await screen.findByRole('heading', { level: 1, name: 'Overview' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/admin/overview');
    expect(screen.getAllByRole('navigation', { name: 'Admin' }).length).toBeGreaterThan(0);
  });

  it('redirects /client to /client/overview inside the client shell', async () => {
    const { router } = renderRoute('/client');
    expect(await screen.findByRole('heading', { level: 1, name: 'Overview' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/client/overview');
  });

  it('every admin and client nav item resolves to a page', async () => {
    for (const item of ADMIN_NAV) {
      const { unmount } = renderRoute(`/admin/${item.path}`);
      expect(await screen.findByRole('heading', { level: 1, name: item.title })).toBeInTheDocument();
      unmount();
    }
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
    renderRoute('/admin/nope');
    expect(await screen.findByRole('heading', { name: 'Page not found' })).toBeInTheDocument();
    // Still inside the admin shell
    expect(screen.getAllByRole('navigation', { name: 'Admin' }).length).toBeGreaterThan(0);
  });

  it('sets the document title from the page header', async () => {
    renderRoute('/admin/clients');
    await screen.findByRole('heading', { level: 1, name: 'Clients' });
    expect(document.title).toBe('Clients · WinTech');
  });

  it('settlements page explains it is not available in V1', async () => {
    renderRoute('/admin/settlements');
    const main = await screen.findByRole('main');
    expect(within(main).getByText('Not available in V1')).toBeInTheDocument();
  });
});
