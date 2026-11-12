import { PageHeader } from '@/components/layout/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { DemoBadge } from '@/components/ui/DemoBadge';
import { TableSkeleton } from '@/components/ui/Skeleton';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/Table';
import { InfoTip } from '@/components/ui/Tooltip';
import { toDecimal } from '@/lib/finance';
import {
  formatDate,
  formatDateTime,
  formatINR,
  formatNav,
  formatRateAsPercent,
  formatUnits,
} from '@/lib/format';
import { useMyContributions, useMyLots, useSelectedClientCycle, type ClientLot } from '../api';
import { PortalCycleBar } from '../components/PortalCycleBar';
import { PortalDisclaimer } from '../components/PortalDisclaimer';
import { PortalEmpty } from '../components/PortalEmpty';

function Breakdown({ lot }: { lot: ClientLot }) {
  const above = toDecimal(lot.eligible_profit_per_unit).greaterThan(0);
  return (
    <ol className="list-decimal space-y-1.5 pl-5 text-sm">
      <li>
        On {formatDate(lot.received_at)} your contribution of{' '}
        <span className="num font-medium">{formatINR(lot.amount)}</span> bought{' '}
        <span className="num font-medium">{formatUnits(lot.units)}</span> units at{' '}
        <span className="num font-medium">{formatNav(lot.entry_nav)}</span> per unit. That NAV is this
        contribution's high-water mark.
      </li>
      <li>
        At the NAV of <span className="num font-medium">{formatNav(lot.gross_nav_per_unit)}</span> (
        {formatDateTime(lot.nav_date)}), its gross value is {formatUnits(lot.units)} ×{' '}
        {formatNav(lot.gross_nav_per_unit)} ={' '}
        <span className="num font-medium">{formatINR(lot.gross_value)}</span>.
      </li>
      {above ? (
        <li>
          Profit above the high-water mark is {formatNav(lot.eligible_profit_per_unit)} per unit. The
          performance fee of {formatRateAsPercent(lot.fee_rate)} on that profit is{' '}
          <span className="num font-medium">{formatINR(lot.fee_amount)}</span>.
        </li>
      ) : (
        <li>
          The NAV is not above the high-water mark, so <strong>no performance fee</strong> applies
          {toDecimal(lot.loss_to_recover).greaterThan(0) && (
            <>
              {' '}
              (<span className="num">{formatINR(lot.loss_to_recover)}</span> must be recovered first)
            </>
          )}
          .
        </li>
      )}
      <li>
        Indicative net value: <span className="num font-semibold">{formatINR(lot.net_value)}</span>.
      </li>
    </ol>
  );
}

export function MyInvestmentPage() {
  const { cycles, cycle, select } = useSelectedClientCycle();
  const lots = useMyLots(cycle?.cycle_id ?? '');
  const contributions = useMyContributions();
  const header = (
    <PageHeader
      title="My Investment"
      description="Each verified contribution is a separate lot with its own starting NAV and fee rate."
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

  const pending = (contributions.data ?? []).filter(
    (c) => c.cycle_id === cycle.cycle_id && c.status === 'pending',
  );

  return (
    <>
      {header}
      <div className="space-y-6">
        <PortalCycleBar cycles={cycles.data} cycle={cycle} onSelect={select} />

        <Card>
          <CardHeader
            title="Your contribution lots"
            description={
              lots.data?.[0]
                ? `Valued at the NAV published for ${formatDateTime(lots.data[0].nav_date)}.`
                : 'Lots are valued once a NAV is published.'
            }
          />
          {lots.isPending ? (
            <TableSkeleton rows={3} columns={6} />
          ) : lots.isError ? (
            <ErrorState message="Your lots could not be loaded." onRetry={() => void lots.refetch()} />
          ) : lots.data.length === 0 ? (
            <EmptyState
              title="No valued lots yet"
              description="Your lots appear here after the next NAV is published."
            />
          ) : (
            <Table caption="Your contribution lots" minWidth={900}>
              <THead>
                <tr>
                  <TH>Date</TH>
                  <TH numeric>Amount</TH>
                  <TH numeric>
                    Entry NAV <InfoTip term="hwm" />
                  </TH>
                  <TH numeric>
                    Units <InfoTip term="units" />
                  </TH>
                  <TH numeric>Fee rate</TH>
                  <TH numeric>Gross value</TH>
                  <TH numeric>
                    Fee <InfoTip term="performanceFee" />
                  </TH>
                  <TH numeric>
                    Net value <InfoTip term="netValue" />
                  </TH>
                  <TH>Position</TH>
                </tr>
              </THead>
              <TBody>
                {lots.data.map((l) => (
                  <TR key={l.contribution_id}>
                    <TD className="num">{formatDate(l.received_at)}</TD>
                    <TD numeric>{formatINR(l.amount)}</TD>
                    <TD numeric>{formatNav(l.entry_nav)}</TD>
                    <TD numeric>{formatUnits(l.units, { decimals: 4 })}</TD>
                    <TD numeric>{formatRateAsPercent(l.fee_rate)}</TD>
                    <TD numeric>{formatINR(l.gross_value)}</TD>
                    <TD numeric>{formatINR(l.fee_amount)}</TD>
                    <TD numeric className="font-medium">
                      {formatINR(l.net_value)}
                    </TD>
                    <TD>
                      {toDecimal(l.loss_to_recover).greaterThan(0) ? (
                        <Badge tone="caution">Below starting NAV</Badge>
                      ) : toDecimal(l.fee_amount).greaterThan(0) ? (
                        <Badge tone="success">In profit</Badge>
                      ) : (
                        <Badge tone="neutral">At starting NAV</Badge>
                      )}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </Card>

        {lots.data && lots.data.length > 0 && (
          <Card>
            <CardHeader
              title="How your value is calculated"
              description="Step by step for each lot."
              as="h2"
            />
            <CardContent className="space-y-6">
              {lots.data.map((l) => (
                <section
                  key={l.contribution_id}
                  aria-label={`Lot of ${formatINR(l.amount)} on ${formatDate(l.received_at)}`}
                >
                  <h3 className="mb-2 text-sm">
                    Lot of {formatINR(l.amount)} · {formatDate(l.received_at)}
                  </h3>
                  <Breakdown lot={l} />
                </section>
              ))}
            </CardContent>
          </Card>
        )}

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
