import { Link, useSearchParams } from 'react-router';
import { PageHeader } from '@/components/layout/PageHeader';
import { DemoBadge } from '@/components/ui/DemoBadge';
import { cn } from '@/lib/utils/cn';
import { AuditLogViewer } from '../components/AuditLogViewer';
import { ClientStatementReport } from '../components/ClientStatementReport';
import { ContributionRegisterReport } from '../components/ContributionRegisterReport';
import { FeeReport } from '../components/FeeReport';
import { NavHistoryReport } from '../components/NavHistoryReport';
import { ValuationReport } from '../components/ValuationReport';

const TABS = [
  { id: 'contributions', label: 'Contribution register', render: () => <ContributionRegisterReport /> },
  { id: 'statement', label: 'Client statement', render: () => <ClientStatementReport /> },
  { id: 'valuations', label: 'Valuations', render: () => <ValuationReport /> },
  { id: 'nav', label: 'NAV history', render: () => <NavHistoryReport /> },
  { id: 'fees', label: 'Performance fee', render: () => <FeeReport /> },
  { id: 'audit', label: 'Audit log', render: () => <AuditLogViewer /> },
] as const;

export function ReportsPage() {
  const [sp] = useSearchParams();
  const active = TABS.find((t) => t.id === sp.get('tab')) ?? TABS[0];

  return (
    <>
      <PageHeader
        title="Reports"
        description="Read-only reports with CSV export. Statements can also be printed or saved as PDF."
        badges={<DemoBadge />}
      />
      <nav aria-label="Reports" className="mb-6 overflow-x-auto print:hidden">
        <ul className="flex min-w-max gap-1 border-b border-line">
          {TABS.map((t) => {
            const current = t.id === active.id;
            return (
              <li key={t.id}>
                <Link
                  to={`?tab=${t.id}`}
                  replace
                  aria-current={current ? 'page' : undefined}
                  className={cn(
                    '-mb-px inline-block border-b-2 px-3 py-2 text-sm font-medium whitespace-nowrap',
                    current ? 'border-emerald-500 text-ink' : 'border-transparent text-muted hover:text-ink',
                  )}
                >
                  {t.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      {active.render()}
    </>
  );
}
