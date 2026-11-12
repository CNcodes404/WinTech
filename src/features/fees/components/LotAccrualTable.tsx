import { Link } from 'react-router';
import { Badge } from '@/components/ui/Badge';
import { TableSkeleton } from '@/components/ui/Skeleton';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/Table';
import { InfoTip } from '@/components/ui/Tooltip';
import { formatDate, formatINR, formatNav, formatRateAsPercent, formatUnits } from '@/lib/format';
import { toDecimal } from '@/lib/finance';
import { useLotAccruals } from '../api';

/** Per-lot fee breakdown for one NAV snapshot (server-computed). */
export function LotAccrualTable({ snapshotId }: { snapshotId: string }) {
  const { data, isPending, isError, refetch } = useLotAccruals(snapshotId);
  if (isPending) return <TableSkeleton rows={4} columns={6} />;
  if (isError)
    return <ErrorState message="Fee details could not be loaded." onRetry={() => void refetch()} />;
  if (data.length === 0) return <EmptyState title="No lots at this NAV" />;

  return (
    <Table caption="Fee accrual per contribution lot" minWidth={1040}>
      <THead>
        <tr>
          <TH>Client · lot</TH>
          <TH numeric>Units</TH>
          <TH numeric>
            Starting NAV (HWM) <InfoTip term="hwm" />
          </TH>
          <TH numeric>Fee rate</TH>
          <TH numeric>Gross value</TH>
          <TH numeric>Eligible profit / unit</TH>
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
        {data.map((r) => {
          const below = toDecimal(r.loss_to_recover).greaterThan(0);
          return (
            <TR key={r.id}>
              <TD>
                <Link to={`/admin/clients/${r.client_id}`} className="font-medium hover:underline">
                  {r.client_name || r.client_email}
                </Link>
                <Link
                  to={`/admin/contributions/${r.contribution_id}`}
                  className="block text-xs text-muted hover:underline"
                >
                  {formatINR(r.contributed_amount)} · {formatDate(r.received_at)}
                </Link>
              </TD>
              <TD numeric>{formatUnits(r.units, { decimals: 4 })}</TD>
              <TD numeric>{formatNav(r.reference_hwm)}</TD>
              <TD numeric>{formatRateAsPercent(r.fee_rate)}</TD>
              <TD numeric>{formatINR(r.gross_value)}</TD>
              <TD numeric>{formatNav(r.eligible_profit_per_unit)}</TD>
              <TD numeric className="font-medium">
                {formatINR(r.fee_amount)}
              </TD>
              <TD numeric className="font-medium">
                {formatINR(r.net_value)}
              </TD>
              <TD>
                {below ? (
                  <Badge tone="caution">Below HWM · {formatINR(r.loss_to_recover)} to recover</Badge>
                ) : toDecimal(r.fee_amount).greaterThan(0) ? (
                  <Badge tone="success">Above HWM</Badge>
                ) : (
                  <Badge tone="neutral">At HWM</Badge>
                )}
              </TD>
            </TR>
          );
        })}
      </TBody>
    </Table>
  );
}
