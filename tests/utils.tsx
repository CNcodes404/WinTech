import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactElement } from 'react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { AppProviders } from '@/app/providers';
import { routes } from '@/app/routes';

export function renderWithProviders(ui: ReactElement) {
  return { user: userEvent.setup(), ...render(<AppProviders>{ui}</AppProviders>) };
}

export function renderRoute(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  const result = renderWithProviders(<RouterProvider router={router} />);
  return { router, ...result };
}
