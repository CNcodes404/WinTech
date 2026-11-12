import { ArrowDown, ArrowUp, ArrowUpDown, ChevronRight, Plus, SearchX, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Select } from '@/components/ui/Form';
import { Pagination } from '@/components/ui/Pagination';
import { SearchInput } from '@/components/ui/SearchInput';
import { TableSkeleton } from '@/components/ui/Skeleton';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/Table';
import { formatDate } from '@/lib/format';
import { useDebouncedValue } from '@/lib/hooks/useDebouncedValue';
import { AddClientDialog } from '../components/AddClientDialog';
import { ClientStatusBadge } from '../components/ClientStatusBadge';
import { parseListParams, toSearchParams } from '../params';
import { useClientList } from '../queries';
import { CLIENTS_PAGE_SIZE, type ClientListParams, type ClientSort } from '../types';

function SortIcon({ active, dir }: { active: boolean; dir: ClientListParams['dir'] }) {
  if (!active) return <ArrowUpDown aria-hidden="true" className="size-3.5 opacity-50" />;
  return dir === 'asc' ? (
    <ArrowUp aria-hidden="true" className="size-3.5" />
  ) : (
    <ArrowDown aria-hidden="true" className="size-3.5" />
  );
}

export function ClientsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const params = parseListParams(searchParams);
  const [addOpen, setAddOpen] = useState(false);

  // Local search text, synced to the URL after the user pauses typing.
  const [search, setSearch] = useState(params.q);
  const debouncedSearch = useDebouncedValue(search, 300);

  const update = (patch: Partial<ClientListParams>) =>
    setSearchParams(toSearchParams({ ...params, page: 1, ...patch }), { replace: true });

  useEffect(() => {
    if (debouncedSearch.trim() !== params.q) update({ q: debouncedSearch.trim() });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only react to the debounced text
  }, [debouncedSearch]);

  const { data, isPending, isError, refetch, isFetching } = useClientList(params);
  const filtersActive = params.q !== '' || params.status !== 'all';

  function toggleSort(sort: ClientSort) {
    if (params.sort === sort) update({ dir: params.dir === 'asc' ? 'desc' : 'asc' });
    else update({ sort, dir: sort === 'created' ? 'desc' : 'asc' });
  }

  const sortState = (sort: ClientSort) =>
    params.sort === sort ? (params.dir === 'asc' ? 'ascending' : 'descending') : 'none';

  return (
    <>
      <PageHeader
        title="Clients"
        description="Manage client accounts. Clients can only see their own records."
        actions={
          <Button onClick={() => setAddOpen(true)}>
            <Plus aria-hidden="true" className="size-4" />
            Add client
          </Button>
        }
      />

      <Card>
        <div className="flex flex-col gap-3 border-b border-line p-4 sm:flex-row sm:items-center">
          <SearchInput
            label="Search clients by name, email or phone"
            placeholder="Search name, email or phone"
            value={search}
            onValueChange={setSearch}
            className="sm:max-w-sm sm:flex-1"
          />
          <div className="flex items-center gap-2 text-sm text-muted">
            <label htmlFor="client-status-filter">Status</label>
            <Select
              id="client-status-filter"
              value={params.status}
              onChange={(e) => update({ status: e.target.value as ClientListParams['status'] })}
              className="w-36"
            >
              <option value="all">All</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </Select>
          </div>
          {isFetching && !isPending && (
            <span role="status" className="text-xs text-muted sm:ml-auto">
              Updating…
            </span>
          )}
        </div>

        {isPending ? (
          <TableSkeleton rows={6} columns={4} />
        ) : isError ? (
          <ErrorState message="The client list could not be loaded." onRetry={() => void refetch()} />
        ) : data.total === 0 && !filtersActive ? (
          <EmptyState
            icon={Users}
            title="No clients yet"
            description="Add your first client to start recording contributions."
            action={
              <Button size="sm" onClick={() => setAddOpen(true)}>
                <Plus aria-hidden="true" className="size-4" />
                Add client
              </Button>
            }
          />
        ) : data.total === 0 ? (
          <EmptyState
            icon={SearchX}
            title="No clients match"
            description="Try a different search or clear the filters."
            action={
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setSearch('');
                  update({ q: '', status: 'all' });
                }}
              >
                Clear filters
              </Button>
            }
          />
        ) : (
          <>
            {/* Desktop / tablet table */}
            <div className="hidden md:block">
              <Table caption="Clients" minWidth={720}>
                <THead>
                  <tr>
                    <TH aria-sort={sortState('name')}>
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 uppercase"
                        onClick={() => toggleSort('name')}
                      >
                        Name <SortIcon active={params.sort === 'name'} dir={params.dir} />
                      </button>
                    </TH>
                    <TH>Email</TH>
                    <TH>Phone</TH>
                    <TH>Status</TH>
                    <TH aria-sort={sortState('created')}>
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 uppercase"
                        onClick={() => toggleSort('created')}
                      >
                        Added <SortIcon active={params.sort === 'created'} dir={params.dir} />
                      </button>
                    </TH>
                    <TH>
                      <span className="sr-only">Open</span>
                    </TH>
                  </tr>
                </THead>
                <TBody>
                  {data.rows.map((c) => (
                    <TR key={c.id}>
                      <TD className="font-medium">
                        <Link to={`/admin/clients/${c.id}`} className="hover:underline">
                          {c.full_name || '(no name)'}
                        </Link>
                      </TD>
                      <TD className="text-muted">{c.email}</TD>
                      <TD className="num text-muted">{c.phone ?? '—'}</TD>
                      <TD>
                        <ClientStatusBadge status={c.status} />
                      </TD>
                      <TD className="num text-muted">{formatDate(c.created_at)}</TD>
                      <TD align="right">
                        <Link
                          to={`/admin/clients/${c.id}`}
                          className="inline-flex rounded p-1 text-muted hover:bg-navy-50 hover:text-ink"
                          aria-label={`Open ${c.full_name || c.email}`}
                        >
                          <ChevronRight aria-hidden="true" className="size-4" />
                        </Link>
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </div>

            {/* Mobile cards */}
            <ul className="divide-y divide-line md:hidden">
              {data.rows.map((c) => (
                <li key={c.id}>
                  <Link
                    to={`/admin/clients/${c.id}`}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-surface-muted"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{c.full_name || '(no name)'}</p>
                      <p className="truncate text-sm text-muted">{c.email}</p>
                    </div>
                    <ClientStatusBadge status={c.status} />
                    <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-muted" />
                  </Link>
                </li>
              ))}
            </ul>

            <div className="border-t border-line">
              <Pagination
                page={params.page}
                pageSize={CLIENTS_PAGE_SIZE}
                total={data.total}
                onPageChange={(page) =>
                  setSearchParams(toSearchParams({ ...params, page }), { replace: true })
                }
                itemLabel="clients"
              />
            </div>
          </>
        )}
      </Card>

      <p className="mt-3 text-xs text-muted">
        Contributed amount, units and indicative value will appear here once contributions are recorded.
      </p>

      <AddClientDialog open={addOpen} onOpenChange={setAddOpen} />
    </>
  );
}
