import { CalendarRange, ChevronRight, Clock, Plus } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { TableSkeleton } from '@/components/ui/Skeleton';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/Table';
import { InfoTip } from '@/components/ui/Tooltip';
import { formatDate, formatINR, formatNav, formatRateAsPercent } from '@/lib/format';
import { CreateCycleDialog } from '../components/CreateCycleDialog';
import { CycleStatusBadge } from '../components/CycleStatusBadge';
import { useCycles } from '../queries';
import type { CycleOverview } from '../types';

function FeeCell({ c }: { c: CycleOverview }) {
  return (
    <div>
      <span className="num font-medium">{formatRateAsPercent(c.current_fee_rate)}</span>
      <span className="mt-0.5 block num text-xs text-muted">
        + {formatINR(c.admin_fee_amount)} admin / client
      </span>
      {c.pending_fee_rate && c.pending_fee_effective_from && (
        <span className="mt-0.5 flex items-center gap-1 text-xs text-warning">
          <Clock aria-hidden="true" className="size-3" />
          <span className="num">
            {formatRateAsPercent(c.pending_fee_rate)} from {formatDate(c.pending_fee_effective_from)}
          </span>
        </span>
      )}
    </div>
  );
}

export function CyclesPage() {
  const { data, isPending, isError, refetch } = useCycles();
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <>
      <PageHeader
        title="Investment Cycles"
        description="Each cycle has its own dates, base NAV, performance-fee rate and admin fee."
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus aria-hidden="true" className="size-4" />
            New cycle
          </Button>
        }
      />

      <Card>
        {isPending ? (
          <TableSkeleton rows={4} columns={5} />
        ) : isError ? (
          <ErrorState message="The cycles could not be loaded." onRetry={() => void refetch()} />
        ) : data.length === 0 ? (
          <EmptyState
            icon={CalendarRange}
            title="No cycles yet"
            description="Create a cycle to set its dates, base NAV and performance-fee rate."
            action={
              <Button size="sm" onClick={() => setCreateOpen(true)}>
                <Plus aria-hidden="true" className="size-4" />
                New cycle
              </Button>
            }
          />
        ) : (
          <>
            <div className="hidden md:block">
              <Table caption="Investment cycles" minWidth={760}>
                <THead>
                  <tr>
                    <TH>Name</TH>
                    <TH>Status</TH>
                    <TH>Period</TH>
                    <TH numeric>
                      Base NAV <InfoTip term="nav" />
                    </TH>
                    <TH numeric>
                      Fee rate <InfoTip term="performanceFee" />
                    </TH>
                    <TH>
                      <span className="sr-only">Open</span>
                    </TH>
                  </tr>
                </THead>
                <TBody>
                  {data.map((c) => (
                    <TR key={c.id}>
                      <TD className="font-medium">
                        <Link to={`/admin/cycles/${c.id}`} className="hover:underline">
                          {c.name}
                        </Link>
                      </TD>
                      <TD>
                        <CycleStatusBadge status={c.status} />
                      </TD>
                      <TD className="num text-muted">
                        {formatDate(c.start_date)} – {formatDate(c.end_date)}
                      </TD>
                      <TD numeric>{formatNav(c.base_nav)}</TD>
                      <TD numeric>
                        <FeeCell c={c} />
                      </TD>
                      <TD align="right">
                        <Link
                          to={`/admin/cycles/${c.id}`}
                          className="inline-flex rounded p-1 text-muted hover:bg-navy-50 hover:text-ink"
                          aria-label={`Open ${c.name}`}
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
              {data.map((c) => (
                <li key={c.id}>
                  <Link to={`/admin/cycles/${c.id}`} className="block px-4 py-3 hover:bg-surface-muted">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate font-medium">{c.name}</p>
                      <CycleStatusBadge status={c.status} />
                    </div>
                    <p className="mt-1 num text-sm text-muted">
                      {formatDate(c.start_date)} – {formatDate(c.end_date)} · NAV {formatNav(c.base_nav)} ·
                      Fee {formatRateAsPercent(c.current_fee_rate)} + {formatINR(c.admin_fee_amount)}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </Card>

      {createOpen && <CreateCycleDialog onClose={() => setCreateOpen(false)} />}
    </>
  );
}
