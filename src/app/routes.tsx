import { Navigate, type RouteObject } from 'react-router';
import { ADMIN_NAV, CLIENT_NAV } from '@/app/navigation';
import { FoundationPreviewPage } from '@/app/pages/FoundationPreviewPage';
import { NotFoundPage } from '@/app/pages/NotFoundPage';
import { PlaceholderPage } from '@/app/pages/PlaceholderPage';
import { RouteErrorPage } from '@/app/pages/RouteErrorPage';
import { UiKitPage } from '@/app/pages/UiKitPage';
import { RootLayout } from '@/app/RootLayout';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { ClientLayout } from '@/components/layout/ClientLayout';
import { AuthLayout } from '@/features/auth/components/AuthLayout';
import { ForgotPasswordPage } from '@/features/auth/pages/ForgotPasswordPage';
import { LoginPage } from '@/features/auth/pages/LoginPage';
import { ResetPasswordPage } from '@/features/auth/pages/ResetPasswordPage';
import { RootRedirect } from '@/features/auth/pages/RootRedirect';

/**
 * Route map. Role guards for /admin and /client arrive in Module 4. Frontend guards are a UX
 * convenience only — real access control is enforced by Supabase RLS.
 */
export const routes: RouteObject[] = [
  {
    path: '/',
    element: <RootLayout />,
    errorElement: <RouteErrorPage />,
    children: [
      { index: true, element: <RootRedirect /> },
      {
        element: <AuthLayout />,
        children: [
          { path: 'login', element: <LoginPage /> },
          { path: 'forgot-password', element: <ForgotPasswordPage /> },
          { path: 'reset-password', element: <ResetPasswordPage /> },
        ],
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
      ...(import.meta.env.DEV ? [{ path: 'dev/foundation', element: <FoundationPreviewPage /> }] : []),
      { path: '*', element: <NotFoundPage /> },
    ],
  },
];
