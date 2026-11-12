import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it } from 'vitest';
import { routes } from './routes';

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(<RouterProvider router={router} />);
  return router;
}

describe('routing skeleton', () => {
  it('renders the foundation preview at /', async () => {
    renderAt('/');
    expect(
      await screen.findByRole('heading', { level: 1, name: /WinTech Investment Platform/i }),
    ).toBeInTheDocument();
    expect(screen.getByText('DEMO DATA')).toBeInTheDocument();
    // Spec example rendered via decimal-safe helpers
    expect(screen.getByText('1,363.63636363')).toBeInTheDocument();
    expect(screen.getByText('₹1,50,000.00')).toBeInTheDocument();
  });

  it('redirects /admin to /admin/overview', async () => {
    const router = renderAt('/admin');
    expect(await screen.findByRole('heading', { name: 'Overview' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/admin/overview');
  });

  it('redirects /client to /client/overview', async () => {
    const router = renderAt('/client');
    expect(await screen.findByRole('heading', { name: 'Overview' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/client/overview');
  });

  it('shows 404 for unknown routes', async () => {
    renderAt('/does-not-exist');
    expect(await screen.findByRole('heading', { name: 'Page not found' })).toBeInTheDocument();
  });
});
