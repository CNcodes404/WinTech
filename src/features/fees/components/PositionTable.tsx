import { Link } from 'react-router';
import { TableSkeleton } from '@/components/ui/Skeleton';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/Table';
import { InfoTip } from '@/components/ui/Tooltip';
import { formatINR, formatSignedINR, formatUnits } from '@/lib/format';
import { cn } from '@/lib/utils/cn';
import { usePositions } from '../api';

const tone = (v: string) => (v.startsWith('-') ? 'text-loss' : 'text-gain');

/**
 * Each client's position at one NAV (server-computed, admin only). The performance-fee share is
 * units × (market NAV − NAV); clients see only the columns from "Value" onwards.
 */
export function PositionTable({ snapshotId }: { snapshotId: string }) {
  const { data, isPending, isError, refetch } = usePositions(snapshotId);
  if (isPending) return <TableSkeleton rows={4} columns={7} />;
  if (isError)
    return <ErrorState message="Client positions could not be loaded." onRetry={() => void refetch()} />;
  if (data.length === 0) return <EmptyState title="No clients held units at this NAV" />;

  return (
    <Table caption="Client positions at this NAV" minWidth={1080}>
      <THead>
        <tr>
          <TH>Client</TH>
          <TH numeric>Units</TH>
          <TH numeric>Invested</TH>
          <TH numeric>
            Market value <InfoTip term="grossValue" />
          </TH>
          <TH numeric>
            Performance fee share <InfoTip term="performanceFee" />
          </TH>
          <TH numeric>
            Value (client sees) <InfoTip term="netValue" />
          </TH>
          <TH numeric>
            Profit <InfoTip term="profit" />
          </TH>
          <TH numeric>
            Admin fee <InfoTip term="adminFee" />
          </TH>
          <TH numeric>
            Final profit <InfoTip term="finalProfit" />
          </TH>
        </tr>
      </THead>
      <TBody>
        {data.map((r) => (
          <TR key={r.client_id}>
            <TD>
              <Link to={`/admin/clients/${r.client_id}`} className="font-medium hover:underline">
                {r.client_name || r.client_email}
              </Link>
            </TD>
            <TD numeric>{formatUnits(r.units, { decimals: 4 })}</TD>
            <TD numeric>{formatINR(r.contributed)}</TD>
            <TD numeric className="text-muted">
              {formatINR(r.gross_value)}
            </TD>
            <TD numeric className="text-muted">
              {formatINR(r.performance_fee_share)}
            </TD>
            <TD numeric className="font-medium">
              {formatINR(r.net_value)}
            </TD>
            <TD numeric className={tone(r.profit)}>
              {formatSignedINR(r.profit)}
            </TD>
            <TD numeric>{formatINR(r.admin_fee)}</TD>
            <TD numeric className={cn('font-semibold', tone(r.final_profit))}>
              {formatSignedINR(r.final_profit)}
            </TD>
          </TR>
        ))}
      </TBody>
    </Table>
  );
}
