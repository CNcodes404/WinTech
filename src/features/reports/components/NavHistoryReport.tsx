import { useState } from 'react';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/Table';
import { useCycles } from '@/features/cycles/queries';
import { NavStatusBadge } from '@/features/nav/components/NavStatusBadge';
import { useNavSnapshots } from '@/features/nav/queries';
import { clientNav } from '@/features/nav/types';
import { downloadCsv, slug, toCsv } from '@/lib/csv';
import {
  formatDateTime,
  formatINR,
  formatNav,
  formatSignedINR,
  formatUnits,
  isoDateInIST,
} from '@/lib/format';
import { CycleFilter, ReportCard } from './ReportParts';

export function NavHistoryReport() {
  const [cycleId, setCycleId] = useState('');
  const cycles = useCycles();
  const snapshots = useNavSnapshots(cycleId);
  const rows = (snapshots.data ?? []).filter((s) => s.status === 'published' || s.status === 'corrected');
  const cycleName = cycles.data?.find((c) => c.id === cycleId)?.name ?? 'cycle';

  function download() {
    const csv = toCsv(
      [
        'As of',
        'Status',
        'Net asset value (INR)',
        'Outstanding units',
        'Market NAV per unit',
        'Money invested (INR)',
        'Cycle profit (INR)',
        'Performance fee (INR)',
        'NAV per unit (client sees)',
        'Published at',
        'Publish note',
        'Method',
      ],
      [...rows]
        .reverse()
        .map((s) => [
          s.nav_date,
          s.status,
          s.gross_net_asset_value,
          s.total_outstanding_units,
          s.gross_nav_per_unit,
          s.net_contributed,
          s.profit_before_fee,
          s.performance_fee_amount,
          clientNav(s),
          s.published_at,
          s.publish_reason,
          s.calculation_version,
        ]),
    );
    downloadCsv(`nav-history-${slug(cycleName)}-${isoDateInIST()}.csv`, csv);
  }

  const state = !cycleId
    ? 'idle'
    : snapshots.isPending
      ? 'loading'
      : snapshots.isError
        ? 'error'
        : rows.length === 0
          ? 'empty'
          : 'ready';

  return (
    <ReportCard
      title="NAV history"
      description="Published NAVs, including those later corrected (kept for the audit trail)."
      state={state}
      emptyText="No NAV has been published for this cycle."
      onRetry={() => void snapshots.refetch()}
      total={rows.length}
      onDownload={download}
      filters={<CycleFilter id="nav-cycle" value={cycleId} onChange={setCycleId} />}
    >
      <Table caption="NAV history" minWidth={820}>
        <THead>
          <tr>
            <TH>As of</TH>
            <TH>Status</TH>
            <TH numeric>Net asset value</TH>
            <TH numeric>Units</TH>
            <TH numeric>Market NAV</TH>
            <TH numeric>Cycle profit</TH>
            <TH numeric>Performance fee</TH>
            <TH numeric>NAV / unit</TH>
          </tr>
        </THead>
        <TBody>
          {rows.map((s) => (
            <TR key={s.id}>
              <TD className="num">{formatDateTime(s.nav_date)}</TD>
              <TD>
                <NavStatusBadge status={s.status} />
              </TD>
              <TD numeric>{formatINR(s.gross_net_asset_value)}</TD>
              <TD numeric>{formatUnits(s.total_outstanding_units, { decimals: 4 })}</TD>
              <TD numeric className="text-muted">
                {formatNav(s.gross_nav_per_unit)}
              </TD>
              <TD numeric>{formatSignedINR(s.profit_before_fee)}</TD>
              <TD numeric>{formatINR(s.performance_fee_amount)}</TD>
              <TD numeric className="font-medium">
                {formatNav(clientNav(s))}
              </TD>
            </TR>
          ))}
        </TBody>
      </Table>
    </ReportCard>
  );
}
