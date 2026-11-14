import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { DemoBadge } from '@/components/ui/DemoBadge';
import { TableSkeleton } from '@/components/ui/Skeleton';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/Table';
import { InfoTip } from '@/components/ui/Tooltip';
import { formatDate, formatDateTime, formatINR, formatNav, formatSignedINR, formatUnits } from '@/lib/format';
import { useMyContributions, useSelectedClientCycle } from '../api';
import { PortalCycleBar } from '../components/PortalCycleBar';
import { PortalDisclaimer } from '../components/PortalDisclaimer';
import { PortalEmpty } from '../components/PortalEmpty';
import { holdingRows } from '../logic';

export function MyInvestmentPage() {
  const { cycles, cycle, select } = useSelectedClientCycle();
  const contributions = useMyContributions();
  const header = (
    <PageHeader
      title="My Investment"
      description="Your contributions, the units they bought and what they are worth at the latest NAV."
      badges={<DemoBadge />}
    />
  );

  if (cycles.isPending) {
    return (
      <>
        {header}
        <Card>
          <TableSkeleton rows={4} columns={6} />
        </Card>
      </>
    );
  }
  if (cycles.isError) {
    return (
      <>
        {header}
        <Card>
          <ErrorState message="Your investment could not be loaded." onRetry={() => void cycles.refetch()} />
        </Card>
      </>
    );
  }
  if (!cycle) {
    return (
      <>
        {header}
        <PortalEmpty />
      </>
    );
  }

  const rows = holdingRows(contributions.data ?? [], cycle);
  const pending = (contributions.data ?? []).filter(
    (c) => c.cycle_id === cycle.cycle_id && c.status === 'pending',
  );
  const nav = cycle.latest_nav ?? cycle.base_nav;

  return (
    <>
      {header}
      <div className="space-y-6">
        <PortalCycleBar cycles={cycles.data} cycle={cycle} onSelect={select} />

        <Card>
          <CardHeader
            title="Your contributions"
            description={
              cycle.latest_nav_date
                ? `Valued at the NAV published for ${formatDateTime(cycle.latest_nav_date)}.`
                : 'Valued at the starting NAV until the first NAV is published.'
            }
          />
          {contributions.isPending ? (
            <TableSkeleton rows={3} columns={6} />
          ) : contributions.isError ? (
            <ErrorState
              message="Your contributions could not be loaded."
              onRetry={() => void contributions.refetch()}
            />
          ) : rows.length === 0 ? (
            <EmptyState
              title="No verified contributions yet"
              description="Units are issued when your contribution is verified."
            />
          ) : (
            <Table caption="Your contributions" minWidth={720}>
              <THead>
                <tr>
                  <TH>Date</TH>
                  <TH numeric>Amount</TH>
                  <TH numeric>
                    NAV applied <InfoTip term="nav" />
                  </TH>
                  <TH numeric>
                    Units <InfoTip term="units" />
                  </TH>
                  <TH numeric>
                    Value now <InfoTip term="netValue" />
                  </TH>
                  <TH numeric>
                    Profit <InfoTip term="profit" />
                  </TH>
                </tr>
              </THead>
              <TBody>
                {rows.map((r) => (
                  <TR key={r.id}>
                    <TD className="num">{formatDate(r.received_at)}</TD>
                    <TD numeric>{formatINR(r.amount)}</TD>
                    <TD numeric>{formatNav(r.entryNav)}</TD>
                    <TD numeric>{formatUnits(r.units, { decimals: 4 })}</TD>
                    <TD numeric className="font-medium">
                      {formatINR(r.value)}
                    </TD>
                    <TD numeric className={r.profit.isNegative() ? 'text-loss' : 'text-gain'}>
                      {formatSignedINR(r.profit)}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </Card>

        <Card>
          <CardHeader
            title="How your value is calculated"
            description="For this cycle, step by step."
            as="h2"
          />
          <CardContent>
            <ol className="list-decimal space-y-1.5 pl-5 text-sm">
              <li>
                Each contribution is converted to units at the NAV published for the day before the money was
                received (or the starting NAV if none was published yet).
              </li>
              <li>
                You hold <span className="num font-medium">{formatUnits(cycle.units)}</span> units. At the NAV
                of <span className="num font-medium">{formatNav(nav)}</span>, they are worth{' '}
                <span className="num font-medium">{formatINR(cycle.current_value)}</span>.
              </li>
              <li>
                You invested <span className="num font-medium">{formatINR(cycle.net_contributed)}</span>, so
                your profit is <span className="num font-medium">{formatSignedINR(cycle.profit)}</span>.
              </li>
              <li>
                The admin fee for this cycle is{' '}
                <span className="num font-medium">{formatINR(cycle.admin_fee)}</span>, so your final profit is{' '}
                <span className="num font-semibold">{formatSignedINR(cycle.final_profit)}</span>.
              </li>
            </ol>
          </CardContent>
        </Card>

        {pending.length > 0 && (
          <Card>
            <CardHeader
              title="Awaiting verification"
              description="No units are issued until a contribution is verified."
            />
            <ul className="divide-y divide-line">
              {pending.map((p) => (
                <li key={p.id} className="flex justify-between gap-3 px-5 py-3 text-sm">
                  <span className="num">{formatINR(p.amount)}</span>
                  <span className="text-muted">Received {formatDateTime(p.received_at)}</span>
                </li>
              ))}
            </ul>
          </Card>
        )}

        <PortalDisclaimer />
      </div>
    </>
  );
}
