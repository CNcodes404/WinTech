import * as RadixDialog from '@radix-ui/react-dialog';
import { Menu, X } from 'lucide-react';
import { useState } from 'react';
import { Link, Outlet } from 'react-router';
import { ADMIN_NAV } from '@/app/navigation';
import { DemoBadge } from '@/components/ui/DemoBadge';
import { BrandMark } from './BrandMark';
import { DemoNotice } from './DemoNotice';
import { SidebarNav } from './SidebarNav';
import { UserMenu } from './UserMenu';
import { useShellUser } from './useShellUser';

const BASE = '/admin';

function SkipLink() {
  return (
    <a
      href="#main"
      className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[70] focus:rounded-md focus:bg-surface focus:px-3 focus:py-2 focus:text-sm focus:shadow-[var(--shadow-overlay)]"
    >
      Skip to content
    </a>
  );
}

/**
 * Desktop-first admin shell: persistent navy sidebar on lg+, compact drawer below lg.
 */
export function AdminLayout() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const shellUser = useShellUser();

  return (
    <div className="min-h-dvh">
      <SkipLink />

      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col bg-navy-900 lg:flex print:hidden">
        <div className="flex h-16 items-center px-5">
          <Link to={`${BASE}/overview`} aria-label="WinTech admin home">
            <BrandMark inverted />
          </Link>
        </div>
        <nav aria-label="Admin" className="flex-1 overflow-y-auto px-3 py-2">
          <SidebarNav items={ADMIN_NAV} basePath={BASE} />
        </nav>
        <div className="border-t border-navy-700 px-5 py-4">
          <p className="text-xs text-navy-300">Admin console · V1 prototype</p>
        </div>
      </aside>

      {/* Mobile drawer */}
      <RadixDialog.Root open={drawerOpen} onOpenChange={setDrawerOpen}>
        <RadixDialog.Portal>
          <RadixDialog.Overlay className="fixed inset-0 z-40 bg-navy-900/40 lg:hidden" />
          <RadixDialog.Content
            aria-describedby={undefined}
            className="fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col bg-navy-900 shadow-[var(--shadow-overlay)] focus:outline-none lg:hidden"
          >
            <div className="flex h-16 items-center justify-between px-5">
              <RadixDialog.Title asChild>
                <span>
                  <BrandMark inverted />
                  <span className="sr-only">Navigation menu</span>
                </span>
              </RadixDialog.Title>
              <RadixDialog.Close
                className="rounded-md p-1.5 text-navy-200 hover:bg-white/10 hover:text-white"
                aria-label="Close menu"
              >
                <X aria-hidden="true" className="size-5" />
              </RadixDialog.Close>
            </div>
            <nav aria-label="Admin" className="flex-1 overflow-y-auto px-3 py-2">
              <SidebarNav items={ADMIN_NAV} basePath={BASE} onNavigate={() => setDrawerOpen(false)} />
            </nav>
          </RadixDialog.Content>
        </RadixDialog.Portal>
      </RadixDialog.Root>

      <div className="flex min-h-dvh flex-col lg:pl-64 print:pl-0">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-line bg-surface/95 px-4 backdrop-blur sm:px-6 print:hidden">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="-ml-1 rounded-md p-2 text-ink hover:bg-navy-50 lg:hidden"
            aria-label="Open navigation menu"
            aria-expanded={drawerOpen}
          >
            <Menu aria-hidden="true" className="size-5" />
          </button>
          <Link to={`${BASE}/overview`} className="lg:hidden" aria-label="WinTech admin home">
            <BrandMark />
          </Link>
          <div className="ml-auto flex items-center gap-3">
            <DemoBadge className="hidden sm:inline-flex" />
            <UserMenu user={shellUser.user} onSignOut={shellUser.onSignOut} />
          </div>
        </header>

        <main
          id="main"
          tabIndex={-1}
          className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 focus:outline-none sm:px-6 lg:py-8"
        >
          <Outlet />
        </main>

        <footer className="mx-auto w-full max-w-7xl px-4 pb-6 sm:px-6 print:hidden">
          <DemoNotice className="border-t border-line pt-4" />
        </footer>
      </div>
    </div>
  );
}
