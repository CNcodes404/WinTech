import { Link } from 'react-router';
import { ADMIN_NAV, CLIENT_NAV } from '@/app/navigation';
import { calculateUnitsIssued, previewPerformanceFee } from '@/lib/finance';
import { formatINR, formatNav, formatRateAsPercent, formatUnits } from '@/lib/format';

/**
 * Module 1 developer preview: design tokens, typography and decimal-safe formatting.
 * Replaced by a redirect to /login in Module 3.
 */

const SWATCHES = [
  { name: 'Navy', token: 'bg-navy-900', hex: '#14243A' },
  { name: 'Emerald', token: 'bg-emerald-500', hex: '#0F9D83' },
  { name: 'Page', token: 'bg-page', hex: '#F5F7FA' },
  { name: 'Ink', token: 'bg-ink', hex: '#172338' },
  { name: 'Muted', token: 'bg-muted', hex: '#64748B' },
  { name: 'Line', token: 'bg-line', hex: '#E2E8F0' },
  { name: 'Warning', token: 'bg-warning', hex: '#D97706' },
  { name: 'Loss', token: 'bg-loss', hex: '#DC2626' },
] as const;

// Fictional spec examples (BUSINESS_LOGIC_AND_FORMULAS.md §2 and §4).
const EXAMPLE_LOTS = [
  { client: 'Rahul (fictional)', amount: '100000', nav: '100' },
  { client: 'Amit (fictional)', amount: '50000', nav: '105' },
  { client: 'Sagar (fictional)', amount: '150000', nav: '110' },
].map((lot) => ({ ...lot, units: calculateUnitsIssued(lot.amount, lot.nav) }));

const FEE = previewPerformanceFee('116', '100', '0.20');

export function FoundationPreviewPage() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-emerald-600">Module 1 · Foundation</p>
          <h1 className="mt-1 text-3xl">WinTech Investment Platform</h1>
          <p className="mt-2 max-w-2xl text-muted">
            Design tokens, typography and decimal-safe financial formatting. This page is a developer preview
            and will be replaced by the sign-in screen.
          </p>
          <div className="mt-4 flex flex-wrap gap-2 text-sm font-medium">
            <Link className="text-emerald-600 hover:underline" to="/admin/overview">
              Admin shell →
            </Link>
            <span className="text-line" aria-hidden="true">
              |
            </span>
            <Link className="text-emerald-600 hover:underline" to="/client/overview">
              Client shell →
            </Link>
            <span className="text-line" aria-hidden="true">
              |
            </span>
            <Link className="text-emerald-600 hover:underline" to="/admin/ui-kit">
              UI kit →
            </Link>
          </div>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-warning/30 bg-warning-soft px-3 py-1 text-xs font-semibold text-warning">
          <span aria-hidden="true">●</span> DEMO DATA
        </span>
      </header>

      <section aria-labelledby="palette" className="mt-10">
        <h2 id="palette" className="text-lg">
          Palette
        </h2>
        <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {SWATCHES.map((s) => (
            <li
              key={s.name}
              className="overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface shadow-[var(--shadow-card)]"
            >
              <div className={`h-14 ${s.token} border-b border-line`} />
              <div className="px-3 py-2">
                <p className="text-sm font-medium">{s.name}</p>
                <p className="num text-xs text-muted">{s.hex}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="units" className="mt-10">
        <h2 id="units" className="text-lg">
          Unit allocation example
        </h2>
        <p className="mt-1 text-sm text-muted">
          units = amount ÷ NAV, rounded <strong>down</strong> to 8 decimal places so units are never
          over-issued.
        </p>
        <div className="mt-4 overflow-x-auto rounded-[var(--radius-card)] border border-line bg-surface shadow-[var(--shadow-card)]">
          <table className="w-full min-w-[520px] text-sm">
            <thead className="bg-surface-muted text-left text-xs font-semibold tracking-wide text-muted uppercase">
              <tr>
                <th scope="col" className="px-4 py-3">
                  Client
                </th>
                <th scope="col" className="px-4 py-3 text-right">
                  Contribution
                </th>
                <th scope="col" className="px-4 py-3 text-right">
                  Entry NAV
                </th>
                <th scope="col" className="px-4 py-3 text-right">
                  Units issued
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {EXAMPLE_LOTS.map((lot) => (
                <tr key={lot.client}>
                  <td className="px-4 py-3 font-medium">{lot.client}</td>
                  <td className="px-4 py-3 text-right num">{formatINR(lot.amount)}</td>
                  <td className="px-4 py-3 text-right num">{formatNav(lot.nav)}</td>
                  <td className="px-4 py-3 text-right num">{formatUnits(lot.units)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="fee" className="mt-10">
        <h2 id="fee" className="text-lg">
          Performance fee example
        </h2>
        <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ['Reference NAV (HWM)', formatNav('100', { decimals: 2 })],
            ['Gross NAV', formatNav('116', { decimals: 2 })],
            [
              `Fee @ ${formatRateAsPercent('0.20', { decimals: 0 })}`,
              formatNav(FEE.feePerUnit, { decimals: 2 }),
            ],
            ['Net NAV', formatNav(FEE.netNavPerUnit, { decimals: 2 })],
          ].map(([label, value]) => (
            <div
              key={label}
              className="rounded-[var(--radius-card)] border border-line bg-surface p-4 shadow-[var(--shadow-card)]"
            >
              <dt className="text-xs font-medium text-muted">{label}</dt>
              <dd className="mt-1 num text-xl font-semibold">{value}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-3 text-sm">
          <span className="font-medium text-gain">▲ Gain</span>
          <span className="mx-2 text-line">|</span>
          <span className="font-medium text-loss">▼ Loss</span>
          <span className="ml-2 text-muted">
            — status is always paired with an icon or label, never colour alone.
          </span>
        </p>
      </section>

      <section aria-labelledby="routes" className="mt-10 grid gap-6 sm:grid-cols-2">
        <h2 id="routes" className="sr-only">
          Route placeholders
        </h2>
        {[
          { label: 'Admin routes', base: '/admin', items: ADMIN_NAV },
          { label: 'Client routes', base: '/client', items: CLIENT_NAV },
        ].map((group) => (
          <div
            key={group.label}
            className="rounded-[var(--radius-card)] border border-line bg-surface p-4 shadow-[var(--shadow-card)]"
          >
            <h3 className="text-sm">{group.label}</h3>
            <ul className="mt-3 flex flex-wrap gap-2">
              {group.items.map((item) => (
                <li key={item.path}>
                  <Link
                    to={`${group.base}/${item.path}`}
                    className="inline-block rounded-[var(--radius-control)] border border-line px-2.5 py-1 text-xs font-medium text-navy-700 hover:border-emerald-500 hover:text-emerald-700"
                  >
                    {item.title}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>

      <footer className="mt-12 border-t border-line pt-4 text-xs text-muted">
        Prototype with fictional data only. Not a live payment, brokerage or investment service.
      </footer>
    </main>
  );
}
