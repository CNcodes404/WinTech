import { LogIn, Menu, X } from 'lucide-react';
import { useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router';
import { BrandMark } from '@/components/layout/BrandMark';
import { useAuth } from '@/features/auth/auth-context';
import { homePathFor } from '@/features/auth/types';
import { cn } from '@/lib/utils/cn';
import { BRAND, DISCLAIMER, SECTIONS } from '../content';
import { useActiveSection, useScrolled } from '../hooks';

const sectionHref = (id: string, onHome: boolean) => (onHome ? `#${id}` : `/#${id}`);

function AccountLink({ className, onClick }: { className?: string; onClick?: () => void }) {
  const auth = useAuth();
  const signedIn = auth.status === 'signedIn' && auth.profile?.status === 'active';
  return (
    <Link
      to={signedIn && auth.profile ? homePathFor(auth.profile.role) : '/login'}
      onClick={onClick}
      className={cn(
        'inline-flex h-10 items-center gap-2 rounded-[var(--radius-control)] bg-gradient-to-r from-emerald-600 to-teal-700 px-4 text-sm font-semibold text-white shadow-sm hover:from-emerald-700 hover:to-teal-800',
        className,
      )}
    >
      <LogIn aria-hidden="true" className="size-4" />
      {signedIn ? 'Go to dashboard' : 'Client login'}
    </Link>
  );
}

export function SiteHeader() {
  const { pathname } = useLocation();
  const onHome = pathname === '/';
  const active = useActiveSection(onHome ? SECTIONS.map((s) => s.id) : []);
  const scrolled = useScrolled();
  const [open, setOpen] = useState(false);

  return (
    <header
      className={cn(
        'sticky top-0 z-40 transition-all duration-300 print:hidden',
        scrolled || !onHome ? 'bg-white/90 shadow-[var(--shadow-card)] backdrop-blur' : 'bg-transparent',
      )}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-6 px-4 sm:px-6">
        <Link to="/" aria-label={`${BRAND.name} home`} onClick={() => setOpen(false)}>
          <BrandMark inverted={!scrolled && onHome} />
        </Link>
        <nav aria-label="Website" className="ml-auto hidden lg:block">
          <ul className="flex items-center gap-1">
            {SECTIONS.map((s) => {
              const isActive = onHome && active === s.id;
              return (
                <li key={s.id}>
                  <a
                    href={sectionHref(s.id, onHome)}
                    aria-current={isActive ? 'true' : undefined}
                    className={cn(
                      'rounded-full px-3 py-1.5 text-sm font-medium transition-colors',
                      !scrolled && onHome
                        ? isActive
                          ? 'bg-white/15 text-white'
                          : 'text-navy-100 hover:text-white'
                        : isActive
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'text-muted hover:text-ink',
                    )}
                  >
                    {s.label}
                  </a>
                </li>
              );
            })}
          </ul>
        </nav>
        <AccountLink className="ml-auto hidden sm:inline-flex lg:ml-2" />
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-controls="site-mobile-menu"
          aria-label={open ? 'Close menu' : 'Open menu'}
          className={cn(
            'ml-auto rounded-md p-2 sm:ml-0 lg:hidden',
            !scrolled && onHome && !open ? 'text-white hover:bg-white/10' : 'text-ink hover:bg-navy-50',
          )}
        >
          {open ? (
            <X aria-hidden="true" className="size-5" />
          ) : (
            <Menu aria-hidden="true" className="size-5" />
          )}
        </button>
      </div>
      {open && (
        <div
          id="site-mobile-menu"
          className="border-t border-line bg-white shadow-[var(--shadow-overlay)] lg:hidden"
        >
          <ul className="mx-auto grid max-w-7xl gap-1 px-4 py-3 sm:px-6">
            {SECTIONS.map((s) => (
              <li key={s.id}>
                <a
                  href={sectionHref(s.id, onHome)}
                  onClick={() => setOpen(false)}
                  className="block rounded-[var(--radius-control)] px-3 py-2 text-sm font-medium text-ink hover:bg-emerald-50"
                >
                  {s.label}
                </a>
              </li>
            ))}
            <li className="pt-2 sm:hidden">
              <AccountLink className="w-full justify-center" onClick={() => setOpen(false)} />
            </li>
          </ul>
        </div>
      )}
    </header>
  );
}

export function SiteFooter() {
  const { pathname } = useLocation();
  const onHome = pathname === '/';
  const links = [
    ...SECTIONS.filter((s) => s.id !== 'how-it-works'),
    { id: 'risk', label: 'Risk Disclosure' },
  ];
  return (
    <footer className="relative overflow-hidden bg-gradient-to-b from-navy-900 to-[#101c33] text-navy-100 print:hidden">
      <span aria-hidden="true" className="absolute inset-x-0 top-0 h-1 brand-rule" />
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <BrandMark inverted />
          <p className="mt-4 text-lg font-semibold text-white">
            {BRAND.name} – {BRAND.tagline}
          </p>
          <p className="mt-2 text-sm">{BRAND.pillars.join('. ')}.</p>
        </div>
        <nav aria-label="Quick links">
          <h2 className="text-sm font-bold tracking-wide text-white uppercase">Quick links</h2>
          <ul className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            {links.map((l) => (
              <li key={l.id}>
                <a href={sectionHref(l.id, onHome)} className="hover:text-white hover:underline">
                  {l.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <div>
          <h2 className="text-sm font-bold tracking-wide text-white uppercase">Legal</h2>
          <ul className="mt-4 space-y-2 text-sm">
            <li>
              <Link to="/privacy" className="hover:text-white hover:underline">
                Privacy Policy
              </Link>
            </li>
            <li>
              <Link to="/terms" className="hover:text-white hover:underline">
                Terms &amp; Conditions
              </Link>
            </li>
            <li>
              <Link to="/login" className="hover:text-white hover:underline">
                Client login
              </Link>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="mx-auto max-w-7xl space-y-3 px-4 py-6 text-xs text-navy-200 sm:px-6">
          <p>
            <strong className="text-white">Disclaimer:</strong> {DISCLAIMER}
          </p>
          <p>
            © {new Date().getFullYear()} {BRAND.name}. All Rights Reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}

/** Public website shell (header + footer), separate from the admin and client app shells. */
export function SiteLayout() {
  return (
    <div className="flex min-h-dvh flex-col bg-white">
      <a
        href="#site-main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[70] focus:rounded-md focus:bg-surface focus:px-3 focus:py-2 focus:text-sm"
      >
        Skip to content
      </a>
      <SiteHeader />
      <main id="site-main" tabIndex={-1} className="flex-1 focus:outline-none">
        <Outlet />
      </main>
      <SiteFooter />
    </div>
  );
}
