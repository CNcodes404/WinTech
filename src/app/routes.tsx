import type { ReactElement } from 'react';
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
import { ChangePasswordRequiredPage } from '@/features/auth/pages/ChangePasswordRequiredPage';
import { ForgotPasswordPage } from '@/features/auth/pages/ForgotPasswordPage';
import { LoginPage } from '@/features/auth/pages/LoginPage';
import { ResetPasswordPage } from '@/features/auth/pages/ResetPasswordPage';
import { RootRedirect } from '@/features/auth/pages/RootRedirect';
import { RequireRole } from '@/features/auth/RequireRole';
import { ClientDetailPage } from '@/features/clients/pages/ClientDetailPage';
import { ClientsPage } from '@/features/clients/pages/ClientsPage';
import { ContributionDetailPage } from '@/features/contributions/pages/ContributionDetailPage';
import { ContributionsPage } from '@/features/contributions/pages/ContributionsPage';
import { CycleDetailPage } from '@/features/cycles/pages/CycleDetailPage';
import { ProfitSharingPage } from '@/features/fees/pages/ProfitSharingPage';
import { NavPage } from '@/features/nav/pages/NavPage';
import { AdminOverviewPage } from '@/features/overview/pages/AdminOverviewPage';
import { NavSnapshotPage } from '@/features/nav/pages/NavSnapshotPage';
import { ClientActivityPage } from '@/features/portal/pages/ClientActivityPage';
import { ClientOverviewPage } from '@/features/portal/pages/ClientOverviewPage';
import { ClientProfilePage } from '@/features/portal/pages/ClientProfilePage';
import { MyInvestmentPage } from '@/features/portal/pages/MyInvestmentPage';
import { StatementsPage } from '@/features/portal/pages/StatementsPage';
import { PortfolioPage } from '@/features/portfolio/pages/PortfolioPage';
import { ValuationDetailPage } from '@/features/portfolio/pages/ValuationDetailPage';
import { ValuationEditorPage } from '@/features/portfolio/pages/ValuationEditorPage';
import { CyclesPage } from '@/features/cycles/pages/CyclesPage';

/** Admin sections that have a real screen; the rest render a placeholder until their module. */
const ADMIN_PAGES: Partial<Record<string, ReactElement>> = {
  overview: <AdminOverviewPage />,
  clients: <ClientsPage />,
  cycles: <CyclesPage />,
  contributions: <ContributionsPage />,
  portfolio: <PortfolioPage />,
  nav: <NavPage />,
  'profit-sharing': <ProfitSharingPage />,
};

/** Client portal sections. */
const CLIENT_PAGES: Partial<Record<string, ReactElement>> = {
  overview: <ClientOverviewPage />,
  investment: <MyInvestmentPage />,
  activity: <ClientActivityPage />,
  statements: <StatementsPage />,
  profile: <ClientProfilePage />,
};

/**
 * Route map. /admin requires an active admin, /client an active client. Frontend guards are a UX
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
          { path: 'change-password', element: <ChangePasswordRequiredPage /> },
        ],
      },
      {
        element: <RequireRole allow="admin" />,
        children: [
          {
            path: 'admin',
            element: <AdminLayout />,
            children: [
              { index: true, element: <Navigate to="overview" replace /> },
              ...ADMIN_NAV.map((item) => ({
                path: item.path,
                element: ADMIN_PAGES[item.path] ?? <PlaceholderPage item={item} />,
              })),
              { path: 'clients/:clientId', element: <ClientDetailPage /> },
              { path: 'cycles/:cycleId', element: <CycleDetailPage /> },
              { path: 'contributions/:contributionId', element: <ContributionDetailPage /> },
              { path: 'portfolio/valuations/new', element: <ValuationEditorPage /> },
              { path: 'portfolio/valuations/:valuationId', element: <ValuationDetailPage /> },
              { path: 'portfolio/valuations/:valuationId/edit', element: <ValuationEditorPage /> },
              { path: 'nav/snapshots/:snapshotId', element: <NavSnapshotPage /> },
              // Developer component showcase inside the real shell (removed from production builds).
              ...(import.meta.env.DEV ? [{ path: 'ui-kit', element: <UiKitPage /> }] : []),
              { path: '*', element: <NotFoundPage embedded /> },
            ],
          },
        ],
      },
      {
        element: <RequireRole allow="client" />,
        children: [
          {
            path: 'client',
            element: <ClientLayout />,
            children: [
              { index: true, element: <Navigate to="overview" replace /> },
              ...CLIENT_NAV.map((item) => ({
                path: item.path,
                element: CLIENT_PAGES[item.path] ?? <PlaceholderPage item={item} />,
              })),
              { path: '*', element: <NotFoundPage embedded /> },
            ],
          },
        ],
      },
      ...(import.meta.env.DEV ? [{ path: 'dev/foundation', element: <FoundationPreviewPage /> }] : []),
      { path: '*', element: <NotFoundPage /> },
    ],
  },
];
