import { HandCoins, Plus } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { TableSkeleton } from '@/components/ui/Skeleton';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/Table';
import { InfoTip } from '@/components/ui/Tooltip';
import { formatDateTime, formatINR, formatUnits } from '@/lib/format';
import { useClientHoldings, useContributionList } from '../queries';
import { ContributionStatusBadge } from './ContributionStatusBadge';
import { RecordContributionDialog } from './RecordContributionDialog';

/** Admin client-detail section: units held per cycle and the client's contributions. */
export function ClientInvestmentPanel({
  clientId,
  clientActive,
}: {
  clientId: string;
  clientActive: boolean;
}) {
  const holdings = useClientHoldings(clientId);
  const contributions = useContributionList({ q: '', status: 'all', cycle: '', page: 1, clientId });
  const [recordOpen, setRecordOpen] = useState(false);

  return (
    <Card>
      <CardHeader
        title="Investment"
        description="Units held per cycle (net of reversals) and contribution history."
        actions={
          clientActive && (
            <Button size="sm" variant="secondary" onClick={() => setRecordOpen(true)}>
              <Plus aria-hidden="true" className="size-4" />
              Record contribution
            </Button>
          )
        }
      />
      {holdings.isPending || contributions.isPending ? (
        <TableSkeleton rows={3} columns={4} />
      ) : holdings.isError || contributions.isError ? (
        <ErrorState
          message="Investment details could not be loaded."
          onRetry={() => {
            void holdings.refetch();
            void contributions.refetch();
          }}
        />
      ) : contributions.data.total === 0 ? (
        <EmptyState
          icon={HandCoins}
          title="No contributions yet"
          description="Recorded contributions will appear here."
        />
      ) : (
        <>
          {holdings.data.length > 0 && (
            <Table caption="Units held per cycle" minWidth={520}>
              <THead>
                <tr>
                  <TH>Cycle</TH>
                  <TH numeric>Net contributed</TH>
                  <TH numeric>
                    Units <InfoTip term="units" />
                  </TH>
                </tr>
              </THead>
              <TBody>
                {holdings.data.map((h) => (
                  <TR key={h.cycle_id}>
                    <TD className="font-medium">
                      <Link to={`/admin/cycles/${h.cycle_id}`} className="hover:underline">
                        {h.cycle_name}
                      </Link>
                    </TD>
                    <TD numeric>{formatINR(h.net_contributed)}</TD>
                    <TD numeric>{formatUnits(h.units)}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
          <h3 className="border-t border-line px-5 pt-4 pb-2 text-sm">Contributions</h3>
          <ul className="divide-y divide-line">
            {contributions.data.rows.map((c) => (
              <li key={c.id}>
                <Link
                  to={`/admin/contributions/${c.id}`}
                  className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 hover:bg-surface-muted"
                >
                  <span>
                    <span className="num font-medium">{formatINR(c.amount)}</span>
                    <span className="ml-2 text-sm text-muted">
                      {c.cycle_name} · {formatDateTime(c.received_at)}
                    </span>
                  </span>
                  <ContributionStatusBadge status={c.status} />
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
      {recordOpen && (
        <RecordContributionDialog onClose={() => setRecordOpen(false)} defaultClientId={clientId} />
      )}
    </Card>
  );
}
