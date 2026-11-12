import { ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { Select } from '@/components/ui/Form';
import { Pagination } from '@/components/ui/Pagination';
import { activityLink, describeActivity } from '@/features/overview/logic';
import { downloadCsv, toCsv } from '@/lib/csv';
import { formatDateTime, isoDateInIST } from '@/lib/format';
import { cn } from '@/lib/utils/cn';
import {
  AUDIT_PAGE_SIZE,
  EXPORT_LIMIT,
  fetchAuditExport,
  useAuditPage,
  usePeople,
  type AuditFilters,
  type AuditRow,
} from '../api';
import { DateRangeFilter, FilterField, ReportCard } from './ReportParts';

const ENTITY_TYPES: [string, string][] = [
  ['', 'All types'],
  ['profile', 'People'],
  ['cycle', 'Cycles & fees'],
  ['contribution', 'Contributions'],
  ['valuation', 'Valuations'],
  ['nav_snapshot', 'NAV'],
];

const ACTIONS = [
  'profile.created',
  'profile.updated',
  'profile.status_changed',
  'profile.role_changed',
  'profile.password_changed',
  'cycle.created',
  'cycle.updated',
  'cycle.status_changed',
  'fee_terms.created',
  'fee_terms.cancelled',
  'fees.crystallised',
  'contribution.recorded',
  'contribution.verified',
  'contribution.rejected',
  'contribution.reversed',
  'valuation.draft_saved',
  'valuation.approved',
  'valuation.superseded',
  'valuation.discarded',
  'nav.calculated',
  'nav.published',
  'nav.corrected',
  'nav.discarded',
];

function Detail({ row }: { row: AuditRow }) {
  return (
    <div className="grid gap-3 bg-surface-muted px-5 py-3 text-xs sm:grid-cols-2">
      <div>
        <p className="font-medium text-muted">Before</p>
        <pre className="mt-1 overflow-x-auto rounded bg-surface p-2 break-all whitespace-pre-wrap">
          {row.before_data ? JSON.stringify(row.before_data, null, 2) : '—'}
        </pre>
      </div>
      <div>
        <p className="font-medium text-muted">After</p>
        <pre className="mt-1 overflow-x-auto rounded bg-surface p-2 break-all whitespace-pre-wrap">
          {row.after_data ? JSON.stringify(row.after_data, null, 2) : '—'}
        </pre>
      </div>
      <p className="text-muted sm:col-span-2">
        Entry #{row.seq} · {row.action} · {row.entity_type} {row.entity_id ?? ''}
      </p>
    </div>
  );
}

/** Read-only, filterable view of the append-only audit log. */
export function AuditLogViewer() {
  const [filters, setFilters] = useState<AuditFilters>({
    entityType: '',
    action: '',
    actorId: '',
    range: { from: '', to: '' },
  });
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<string | null>(null);
  const people = usePeople();
  const admins = (people.data ?? []).filter((p) => p.role === 'admin');
  const { data, isPending, isError, refetch } = useAuditPage(filters, page);

  const update = (patch: Partial<AuditFilters>) => {
    setFilters((f) => ({ ...f, ...patch }));
    setPage(1);
  };

  async function download() {
    const { rows } = await fetchAuditExport(filters);
    const csv = toCsv(
      [
        'Seq',
        'Time',
        'Actor',
        'Actor email',
        'Action',
        'Entity type',
        'Entity id',
        'Description',
        'Reason',
        'Before (JSON)',
        'After (JSON)',
      ],
      rows.map((r) => [
        r.seq,
        r.created_at,
        r.actor?.full_name ?? 'system / project owner',
        r.actor?.email ?? '',
        r.action,
        r.entity_type,
        r.entity_id,
        describeActivity(r),
        r.reason,
        r.before_data ? JSON.stringify(r.before_data) : '',
        r.after_data ? JSON.stringify(r.after_data) : '',
      ]),
    );
    downloadCsv(`audit-log-${isoDateInIST()}.csv`, csv);
  }

  const state = isPending ? 'loading' : isError ? 'error' : data.total === 0 ? 'empty' : 'ready';

  return (
    <ReportCard
      title="Audit log"
      description="Append-only record of every change: who, what, when and why. Entries cannot be edited or deleted."
      state={state}
      onRetry={() => void refetch()}
      onDownload={() => void download()}
      filters={
        <>
          <FilterField label="Type" htmlFor="audit-type">
            <Select
              id="audit-type"
              value={filters.entityType}
              onChange={(e) => update({ entityType: e.target.value })}
              className="w-44"
            >
              {ENTITY_TYPES.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </Select>
          </FilterField>
          <FilterField label="Action" htmlFor="audit-action">
            <Select
              id="audit-action"
              value={filters.action}
              onChange={(e) => update({ action: e.target.value })}
              className="w-56"
            >
              <option value="">All actions</option>
              {ACTIONS.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </Select>
          </FilterField>
          <FilterField label="By" htmlFor="audit-actor">
            <Select
              id="audit-actor"
              value={filters.actorId}
              onChange={(e) => update({ actorId: e.target.value })}
              className="w-48"
            >
              <option value="">Anyone</option>
              {admins.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.full_name || a.email}
                </option>
              ))}
              <option value="system">System / project owner</option>
            </Select>
          </FilterField>
          <DateRangeFilter idPrefix="audit" value={filters.range} onChange={(range) => update({ range })} />
        </>
      }
    >
      <ol className="divide-y divide-line">
        {data?.rows.map((r) => {
          const href = activityLink(r);
          const expanded = open === r.id;
          return (
            <li key={r.id}>
              <div className="flex flex-wrap items-start gap-3 px-5 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">
                    {href ? (
                      <Link to={href} className="hover:underline">
                        {describeActivity(r)}
                      </Link>
                    ) : (
                      describeActivity(r)
                    )}
                  </p>
                  {r.reason && <p className="mt-0.5 text-sm break-words text-muted">Reason: {r.reason}</p>}
                  <p className="mt-0.5 text-xs text-muted">
                    <time dateTime={r.created_at}>{formatDateTime(r.created_at)}</time> ·{' '}
                    {r.actor ? r.actor.full_name || r.actor.email : 'system / project owner'} ·{' '}
                    <code>{r.action}</code>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(expanded ? null : r.id)}
                  aria-expanded={expanded}
                  className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-muted hover:bg-navy-50 hover:text-ink"
                >
                  Details
                  <ChevronDown
                    aria-hidden="true"
                    className={cn('size-3.5 transition-transform', expanded && 'rotate-180')}
                  />
                </button>
              </div>
              {expanded && <Detail row={r} />}
            </li>
          );
        })}
      </ol>
      <div className="border-t border-line">
        <Pagination
          page={page}
          pageSize={AUDIT_PAGE_SIZE}
          total={data?.total ?? 0}
          onPageChange={setPage}
          itemLabel="entries"
        />
      </div>
      {(data?.total ?? 0) > EXPORT_LIMIT && (
        <p className="px-5 pb-3 text-xs text-warning">
          CSV export includes the latest 5,000 matching entries.
        </p>
      )}
    </ReportCard>
  );
}
