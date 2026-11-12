import { Link, NavLink, Outlet } from 'react-router';
import { CLIENT_NAV } from '@/app/navigation';
import { DemoBadge } from '@/components/ui/DemoBadge';
import { cn } from '@/lib/utils/cn';
import { BrandMark } from './BrandMark';
import { DemoNotice } from './DemoNotice';
import { UserMenu } from './UserMenu';
import { useShellUser } from './useShellUser';

const BASE = '/client';

/**
 * Simple, read-only client shell. Top tabs on md+, bottom tab bar on phones for thumb reach.
 */
export function ClientLayout() {
  const shellUser = useShellUser();
  return (
    <div className="min-h-dvh pb-20 md:pb-0">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[70] focus:rounded-md focus:bg-surface focus:px-3 focus:py-2 focus:text-sm"
      >
        Skip to content
      </a>

      <header className="sticky top-0 z-20 border-b border-line bg-surface/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4 sm:px-6">
          <Link to={`${BASE}/overview`} aria-label="WinTech home">
            <BrandMark />
          </Link>
          <nav aria-label="Client" className="hidden h-full md:block">
            <ul className="flex h-full items-stretch gap-1">
              {CLIENT_NAV.map((item) => (
                <li key={item.path} className="flex">
                  <NavLink
                    to={`${BASE}/${item.path}`}
                    className={({ isActive }) =>
                      cn(
                        'flex items-center border-b-2 px-3 text-sm font-medium transition-colors',
                        isActive
                          ? 'border-emerald-500 text-ink'
                          : 'border-transparent text-muted hover:text-ink',
                      )
                    }
                  >
                    {item.title}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <DemoBadge className="hidden sm:inline-flex" />
            <UserMenu user={shellUser.user} onSignOut={shellUser.onSignOut} profilePath={`${BASE}/profile`} />
          </div>
        </div>
      </header>

      <main
        id="main"
        tabIndex={-1}
        className="mx-auto w-full max-w-6xl px-4 py-6 focus:outline-none sm:px-6 lg:py-8"
      >
        <Outlet />
      </main>

      <footer className="mx-auto w-full max-w-6xl px-4 pb-6 sm:px-6">
        <DemoNotice className="border-t border-line pt-4" />
      </footer>

      {/* Mobile bottom tab bar */}
      <nav
        aria-label="Client"
        className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        <ul className="grid grid-cols-5">
          {CLIENT_NAV.map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.path}>
                <NavLink
                  to={`${BASE}/${item.path}`}
                  className={({ isActive }) =>
                    cn(
                      'flex flex-col items-center gap-1 px-1 py-2 text-[11px] font-medium',
                      isActive ? 'text-emerald-600' : 'text-muted',
                    )
                  }
                >
                  <Icon aria-hidden="true" className="size-5" />
                  <span className="truncate">
                    {item.title === 'My Investment' ? 'Investment' : item.title}
                  </span>
                </NavLink>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
