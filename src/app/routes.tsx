import { Navigate, type RouteObject } from 'react-router';
import { ADMIN_NAV, CLIENT_NAV } from '@/app/navigation';
import { FoundationPreviewPage } from '@/app/pages/FoundationPreviewPage';
import { NotFoundPage } from '@/app/pages/NotFoundPage';
import { PlaceholderPage } from '@/app/pages/PlaceholderPage';
import { RouteErrorPage } from '@/app/pages/RouteErrorPage';
import { UiKitPage } from '@/app/pages/UiKitPage';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { ClientLayout } from '@/components/layout/ClientLayout';

/**
 * Route map. Authentication arrives in Module 3 and role guards in Module 4. Frontend guards are a
 * UX convenience only — real access control is enforced by Supabase RLS.
 */
export const routes: RouteObject[] = [
  {
    path: '/',
    errorElement: <RouteErrorPage />,
    children: [
      { index: true, element: <FoundationPreviewPage /> },
      {
        path: 'login',
        element: <PlaceholderPage title="Sign in" description="Authentication arrives in Module 3." />,
      },
      {
        path: 'admin',
        element: <AdminLayout />,
        children: [
          { index: true, element: <Navigate to="overview" replace /> },
          ...ADMIN_NAV.map((item) => ({ path: item.path, element: <PlaceholderPage item={item} /> })),
          // Developer component showcase inside the real shell (removed from production builds).
          ...(import.meta.env.DEV ? [{ path: 'ui-kit', element: <UiKitPage /> }] : []),
          { path: '*', element: <NotFoundPage embedded /> },
        ],
      },
      {
        path: 'client',
        element: <ClientLayout />,
        children: [
          { index: true, element: <Navigate to="overview" replace /> },
          ...CLIENT_NAV.map((item) => ({ path: item.path, element: <PlaceholderPage item={item} /> })),
          { path: '*', element: <NotFoundPage embedded /> },
        ],
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
];
