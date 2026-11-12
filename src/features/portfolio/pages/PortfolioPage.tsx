import { Briefcase, ChevronRight, Plus } from 'lucide-react';
import { Link, useSearchParams } from 'react-router';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { DemoBadge } from '@/components/ui/DemoBadge';
import { Select } from '@/components/ui/Form';
import { TableSkeleton } from '@/components/ui/Skeleton';
import { StatCard } from '@/components/ui/StatCard';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/Table';
import { useCycles } from '@/features/cycles/queries';
import { formatDateTime, formatINR } from '@/lib/format';
import { isUuid } from '@/lib/utils/uuid';
import { ValuationStatusBadge } from '../components/ValuationStatusBadge';
import { useValuations } from '../queries';

const VALUABLE = new Set(['open', 'active', 'closed']);

export function PortfolioPage() {
  const [sp, setSp] = useSearchParams();
  const cycles = useCycles();
  const selectable = (cycles.data ?? []).filter((c) => c.status !== 'draft');
  const requested = sp.get('cycle') ?? '';
  const cycle =
    selectable.find((c) => c.id === requested) ??
    selectable.find((c) => c.status === 'active' || c.status === 'open') ??
    selectable[0];
  const cycleId = cycle?.id ?? '';
  const valuations = useValuations(isUuid(cycleId) ? cycleId : '');
  const latest = valuations.data?.find((v) => v.status === 'approved');
  const canValue = cycle ? VALUABLE.has(cycle.status) : false;

  return (
    <>
      <PageHeader
        title="Portfolio"
        description="Manually entered holdings, cash and liabilities. Approved valuations are used to calculate NAV."
        badges={<DemoBadge kind="manual" />}
        actions={
          cycle &&
          canValue && (
            <Button asChild>
              <Link to={`/admin/portfolio/valuations/new?cycle=${cycle.id}`}>
                <Plus aria-hidden="true" className="size-4" />
                New valuation
              </Link>
            </Button>
          )
        }
      />

      {cycles.isPending ? (
        <Card>
          <TableSkeleton rows={3} columns={4} />
        </Card>
      ) : cycles.isError ? (
        <Card>
          <ErrorState message="Cycles could not be loaded." onRetry={() => void cycles.refetch()} />
        </Card>
      ) : !cycle ? (
        <Card>
          <EmptyState
            icon={Briefcase}
            title="No cycle to value yet"
            description="Open an investment cycle first. Draft cycles cannot be valued."
            action={
              <Button size="sm" variant="secondary" asChild>
                <Link to="/admin/cycles">Go to Investment Cycles</Link>
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <label htmlFor="portfolio-cycle" className="text-muted">
              Cycle
            </label>
            <Select
              id="portfolio-cycle"
              value={cycle.id}
              onChange={(e) => setSp({ cycle: e.target.value }, { replace: true })}
              className="w-64"
            >
              {selectable.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.status})
                </option>
              ))}
            </Select>
          </div>

          <section
            aria-label="Latest approved valuation"
            className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
          >
            <StatCard
              label="Net asset value"
              loading={valuations.isPending}
              value={latest ? formatINR(latest.gross_net_asset_value) : '—'}
              meta={latest ? `as of ${formatDateTime(latest.valuation_at)}` : 'No approved valuation yet'}
              badge={<DemoBadge kind="manual" />}
            />
            <StatCard
              label="Holdings value"
              loading={valuations.isPending}
              value={latest ? formatINR(latest.holdings_value) : '—'}
            />
            <StatCard
              label="Cash balance"
              loading={valuations.isPending}
              value={latest ? formatINR(latest.cash_balance) : '—'}
            />
            <StatCard
              label="Liabilities"
              loading={valuations.isPending}
              value={latest ? formatINR(latest.liabilities) : '—'}
            />
          </section>

          <Card>
            <CardHeader
              title="Valuations"
              description="Drafts, approved snapshots and superseded corrections."
            />
            {valuations.isPending ? (
              <TableSkeleton rows={4} columns={5} />
            ) : valuations.isError ? (
              <ErrorState
                message="Valuations could not be loaded."
                onRetry={() => void valuations.refetch()}
              />
            ) : valuations.data.length === 0 ? (
              <EmptyState
                icon={Briefcase}
                title="No valuations yet"
                description="Record the holdings, cash and liabilities as of a date and time, then approve it."
              />
            ) : (
              <Table caption="Valuations" minWidth={760}>
                <THead>
                  <tr>
                    <TH>Valuation time</TH>
                    <TH>Status</TH>
                    <TH numeric>Holdings</TH>
                    <TH numeric>Cash</TH>
                    <TH numeric>Liabilities</TH>
                    <TH numeric>Net asset value</TH>
                    <TH>
                      <span className="sr-only">Open</span>
                    </TH>
                  </tr>
                </THead>
                <TBody>
                  {valuations.data.map((v) => (
                    <TR key={v.id}>
                      <TD className="num font-medium">
                        <Link to={`/admin/portfolio/valuations/${v.id}`} className="hover:underline">
                          {formatDateTime(v.valuation_at)}
                        </Link>
                        <span className="block text-xs font-normal text-muted">
                          {v.item_count ?? 0} holding(s)
                        </span>
                      </TD>
                      <TD>
                        <ValuationStatusBadge status={v.status} />
                      </TD>
                      <TD numeric>{formatINR(v.holdings_value)}</TD>
                      <TD numeric>{formatINR(v.cash_balance)}</TD>
                      <TD numeric>{formatINR(v.liabilities)}</TD>
                      <TD numeric className="font-medium">
                        {formatINR(v.gross_net_asset_value)}
                      </TD>
                      <TD align="right">
                        <Link
                          to={`/admin/portfolio/valuations/${v.id}`}
                          className="inline-flex rounded p-1 text-muted hover:bg-navy-50 hover:text-ink"
                          aria-label={`Open valuation of ${formatDateTime(v.valuation_at)}`}
                        >
                          <ChevronRight aria-hidden="true" className="size-4" />
                        </Link>
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            )}
          </Card>
          <p className="text-xs text-muted">
            V1 has no broker connection and no order placement. All prices are entered manually for
            demonstration.
          </p>
        </div>
      )}
    </>
  );
}
