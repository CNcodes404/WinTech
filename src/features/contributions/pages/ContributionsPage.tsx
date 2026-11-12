import { ChevronRight, HandCoins, Plus, SearchX } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { DemoBadge } from '@/components/ui/DemoBadge';
import { Select } from '@/components/ui/Form';
import { Pagination } from '@/components/ui/Pagination';
import { SearchInput } from '@/components/ui/SearchInput';
import { TableSkeleton } from '@/components/ui/Skeleton';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/Table';
import { useCycles } from '@/features/cycles/queries';
import { formatDateTime, formatINR, formatUnits } from '@/lib/format';
import { useDebouncedValue } from '@/lib/hooks/useDebouncedValue';
import { ContributionStatusBadge } from '../components/ContributionStatusBadge';
import { RecordContributionDialog } from '../components/RecordContributionDialog';
import { parseContributionParams, toContributionSearchParams } from '../params';
import { useContributionList } from '../queries';
import { CONTRIBUTIONS_PAGE_SIZE, METHOD_LABEL, type ContributionListParams } from '../types';

export function ContributionsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const params = parseContributionParams(searchParams);
  const [recordOpen, setRecordOpen] = useState(false);
  const [search, setSearch] = useState(params.q);
  const debounced = useDebouncedValue(search, 300);
  const cycles = useCycles();

  const update = (patch: Partial<ContributionListParams>) =>
    setSearchParams(toContributionSearchParams({ ...params, page: 1, ...patch }), { replace: true });

  useEffect(() => {
    if (debounced.trim() !== params.q) update({ q: debounced.trim() });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only react to the debounced text
  }, [debounced]);

  const { data, isPending, isError, refetch } = useContributionList(params);
  const filtersActive = params.q !== '' || params.status !== 'all' || params.cycle !== '';

  return (
    <>
      <PageHeader
        title="Contributions"
        description="Manually recorded contributions. Verify each one to issue units at the applicable NAV."
        badges={<DemoBadge kind="manual" />}
        actions={
          <Button onClick={() => setRecordOpen(true)}>
            <Plus aria-hidden="true" className="size-4" />
            Record contribution
          </Button>
        }
      />

      <Card>
        <div className="flex flex-col gap-3 border-b border-line p-4 lg:flex-row lg:items-center">
          <SearchInput
            label="Search by client name, email or payment reference"
            placeholder="Search client or reference"
            value={search}
            onValueChange={setSearch}
            className="lg:max-w-sm lg:flex-1"
          />
          <div className="flex flex-wrap items-center gap-3 text-sm text-muted">
            <label htmlFor="contribution-status-filter">Status</label>
            <Select
              id="contribution-status-filter"
              value={params.status}
              onChange={(e) => update({ status: e.target.value as ContributionListParams['status'] })}
              className="w-36"
            >
              <option value="all">All</option>
              <option value="pending">Pending</option>
              <option value="verified">Verified</option>
              <option value="rejected">Rejected</option>
              <option value="reversed">Reversed</option>
            </Select>
            <label htmlFor="contribution-cycle-filter">Cycle</label>
            <Select
              id="contribution-cycle-filter"
              value={params.cycle}
              onChange={(e) => update({ cycle: e.target.value })}
              className="w-52"
            >
              <option value="">All cycles</option>
              {cycles.data?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </div>
        </div>

        {isPending ? (
          <TableSkeleton rows={6} columns={6} />
        ) : isError ? (
          <ErrorState message="The contributions could not be loaded." onRetry={() => void refetch()} />
        ) : data.total === 0 ? (
          filtersActive ? (
            <EmptyState
              icon={SearchX}
              title="No contributions match"
              description="Try a different search or clear the filters."
              action={
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setSearch('');
                    update({ q: '', status: 'all', cycle: '' });
                  }}
                >
                  Clear filters
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon={HandCoins}
              title="No contributions yet"
              description="Record a contribution once money has been received. It stays pending until you verify it."
              action={
                <Button size="sm" onClick={() => setRecordOpen(true)}>
                  <Plus aria-hidden="true" className="size-4" />
                  Record contribution
                </Button>
              }
            />
          )
        ) : (
          <>
            <div className="hidden md:block">
              <Table caption="Contributions" minWidth={900}>
                <THead>
                  <tr>
                    <TH>Client</TH>
                    <TH>Cycle</TH>
                    <TH numeric>Amount</TH>
                    <TH>Received</TH>
                    <TH>Method / reference</TH>
                    <TH numeric>Units</TH>
                    <TH>Status</TH>
                    <TH>
                      <span className="sr-only">Open</span>
                    </TH>
                  </tr>
                </THead>
                <TBody>
                  {data.rows.map((c) => (
                    <TR key={c.id}>
                      <TD className="font-medium">
                        <Link to={`/admin/contributions/${c.id}`} className="hover:underline">
                          {c.client_name || c.client_email}
                        </Link>
                      </TD>
                      <TD className="text-muted">{c.cycle_name}</TD>
                      <TD numeric className="font-medium">
                        {formatINR(c.amount)}
                      </TD>
                      <TD className="num text-muted">{formatDateTime(c.received_at)}</TD>
                      <TD className="text-muted">
                        {METHOD_LABEL[c.method]}
                        {c.reference_number && <span className="block text-xs">{c.reference_number}</span>}
                      </TD>
                      <TD numeric>{c.units_issued ? formatUnits(c.units_issued, { decimals: 4 }) : '—'}</TD>
                      <TD>
                        <ContributionStatusBadge status={c.status} />
                      </TD>
                      <TD align="right">
                        <Link
                          to={`/admin/contributions/${c.id}`}
                          className="inline-flex rounded p-1 text-muted hover:bg-navy-50 hover:text-ink"
                          aria-label={`Open contribution from ${c.client_name || c.client_email}`}
                        >
                          <ChevronRight aria-hidden="true" className="size-4" />
                        </Link>
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </div>
            <ul className="divide-y divide-line md:hidden">
              {data.rows.map((c) => (
                <li key={c.id}>
                  <Link
                    to={`/admin/contributions/${c.id}`}
                    className="block px-4 py-3 hover:bg-surface-muted"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate font-medium">{c.client_name || c.client_email}</p>
                      <ContributionStatusBadge status={c.status} />
                    </div>
                    <p className="mt-1 num text-sm text-muted">
                      {formatINR(c.amount)} · {c.cycle_name} · {formatDateTime(c.received_at)}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
            <div className="border-t border-line">
              <Pagination
                page={params.page}
                pageSize={CONTRIBUTIONS_PAGE_SIZE}
                total={data.total}
                onPageChange={(page) =>
                  setSearchParams(toContributionSearchParams({ ...params, page }), { replace: true })
                }
                itemLabel="contributions"
              />
            </div>
          </>
        )}
      </Card>

      {recordOpen && (
        <RecordContributionDialog onClose={() => setRecordOpen(false)} defaultCycleId={params.cycle} />
      )}
    </>
  );
}
