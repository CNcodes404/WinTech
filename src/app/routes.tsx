import { Navigate, type RouteObject } from 'react-router';
import { PlaceholderPage } from '@/app/pages/PlaceholderPage';
import { NotFoundPage } from '@/app/pages/NotFoundPage';
import { RouteErrorPage } from '@/app/pages/RouteErrorPage';
import { FoundationPreviewPage } from '@/app/pages/FoundationPreviewPage';

/**
 * Route map. Module 1 provides placeholders only; the admin/client shells arrive in Module 2,
 * authentication in Module 3 and role guards in Module 4. Frontend guards are a UX convenience —
 * real access control is enforced by Supabase RLS.
 */
export const ADMIN_NAV = [
  { path: 'overview', title: 'Overview' },
  { path: 'clients', title: 'Clients' },
  { path: 'cycles', title: 'Investment Cycles' },
  { path: 'contributions', title: 'Contributions' },
  { path: 'portfolio', title: 'Portfolio' },
  { path: 'nav', title: 'NAV & Performance' },
  { path: 'profit-sharing', title: 'Profit Sharing' },
  { path: 'settlements', title: 'Settlements' },
  { path: 'reports', title: 'Reports' },
  { path: 'settings', title: 'Settings' },
] as const;

export const CLIENT_NAV = [
  { path: 'overview', title: 'Overview' },
  { path: 'investment', title: 'My Investment' },
  { path: 'activity', title: 'Activity' },
  { path: 'statements', title: 'Statements' },
  { path: 'profile', title: 'Profile' },
] as const;

export const routes: RouteObject[] = [
  {
    path: '/',
    errorElement: <RouteErrorPage />,
    children: [
      { index: true, element: <FoundationPreviewPage /> },
      { path: 'login', element: <PlaceholderPage title="Sign in" area="Auth" /> },
      {
        path: 'admin',
        children: [
          { index: true, element: <Navigate to="overview" replace /> },
          ...ADMIN_NAV.map((item) => ({
            path: item.path,
            element: <PlaceholderPage title={item.title} area="Admin" />,
          })),
        ],
      },
      {
        path: 'client',
        children: [
          { index: true, element: <Navigate to="overview" replace /> },
          ...CLIENT_NAV.map((item) => ({
            path: item.path,
            element: <PlaceholderPage title={item.title} area="Client" />,
          })),
        ],
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
];
