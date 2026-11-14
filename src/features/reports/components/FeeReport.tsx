import { useState } from 'react';
import { Select } from '@/components/ui/Form';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/Table';
import { useCycles } from '@/features/cycles/queries';
import { usePositions } from '@/features/fees/api';
import { summarisePositions } from '@/features/fees/logic';
import { useNavSnapshots } from '@/features/nav/queries';
import { clientNav, FUND_LEVEL } from '@/features/nav/types';
import { downloadCsv, slug, toCsv } from '@/lib/csv';
import {
  formatDateTime,
  formatINR,
  formatNav,
  formatRateAsPercent,
  formatSignedINR,
  formatUnits,
  isoDateInIST,
} from '@/lib/format';
import { CycleFilter, FilterField, ReportCard } from './ReportParts';

/** Fees per client at a published NAV (cycle-profit method). Admin only. */
export function FeeReport() {
  const [cycleId, setCycleId] = useState('');
  const [snapshotId, setSnapshotId] = useState('');
  const cycles = useCycles();
  const snapshots = useNavSnapshots(cycleId);
  const options = (snapshots.data ?? []).filter(
    (s) => (s.status === 'published' || s.status === 'corrected') && s.calculation_version === FUND_LEVEL,
  );
  const selected = options.find((s) => s.id === snapshotId) ?? options[0];
  const positions = usePositions(selected?.id ?? '');
  const cycleName = cycles.data?.find((c) => c.id === cycleId)?.name ?? 'cycle';
  const summary = positions.data ? summarisePositions(positions.data) : null;

  function download() {
    if (!positions.data || !selected) return;
    const csv = toCsv(
      [
        'NAV as of',
        'Client',
        'Client email',
        'Units',
        'Invested (INR)',
        'Market NAV',
        'NAV (client sees)',
        'Market value (INR)',
        'Performance fee share (INR)',
        'Value (INR)',
        'Profit (INR)',
        'Admin fee (INR)',
        'Final profit (INR)',
        'Cycle performance fee (INR)',
        'Performance fee rate',
        'Method',
      ],
      positions.data.map((p) => [
        selected.nav_date,
        p.client_name,
        p.client_email,
        p.units,
        p.contributed,
        p.gross_nav_per_unit,
        p.net_nav_per_unit,
        p.gross_value,
        p.performance_fee_share,
        p.net_value,
        p.profit,
        p.admin_fee,
        p.final_profit,
        selected.performance_fee_amount,
        selected.performance_fee_rate,
        'fund_level_v2 (indicative, demo)',
      ]),
    );
    downloadCsv(`fees-${slug(cycleName)}-${isoDateInIST()}.csv`, csv);
  }

  const state = !cycleId
    ? 'idle'
    : snapshots.isPending || (selected && positions.isPending)
      ? 'loading'
      : snapshots.isError || positions.isError
        ? 'error'
        : !selected || (positions.data?.length ?? 0) === 0
          ? 'empty'
          : 'ready';

  return (
    <ReportCard
      title="Fee report"
      description="Performance fee on the cycle's profit and admin fee per client, at a published NAV."
      state={state}
      emptyText="No published NAV with client positions for this cycle."
      onRetry={() => void positions.refetch()}
      total={positions.data?.length}
      onDownload={download}
      filters={
        <>
          <CycleFilter
            id="fee-cycle"
            value={cycleId}
            onChange={(v) => {
              setCycleId(v);
              setSnapshotId('');
            }}
          />
          {options.length > 0 && (
            <FilterField label="NAV" htmlFor="fee-snapshot">
              <Select
                id="fee-snapshot"
                value={selected?.id ?? ''}
                onChange={(e) => setSnapshotId(e.target.value)}
                className="w-72"
              >
                {options.map((s) => (
                  <option key={s.id} value={s.id}>
                    {formatDateTime(s.nav_date)} — {formatNav(clientNav(s))}
                    {s.status === 'corrected' ? ' (corrected)' : ''}
                  </option>
                ))}
              </Select>
            </FilterField>
          )}
        </>
      }
    >
      {summary && selected && (
        <p className="border-b border-line px-5 py-3 text-sm">
          Cycle profit{' '}
          <span className="num font-semibold">{formatSignedINR(selected.profit_before_fee)}</span> ·
          performance fee{' '}
          <span className="num font-semibold">{formatINR(selected.performance_fee_amount)}</span> (
          {formatRateAsPercent(selected.performance_fee_rate)}) · admin fees{' '}
          <span className="num font-semibold">{formatINR(summary.adminFees)}</span> · clients' final profit{' '}
          <span className="num">{formatSignedINR(summary.finalProfit)}</span>
        </p>
      )}
      <Table caption="Fees per client" minWidth={900}>
        <THead>
          <tr>
            <TH>Client</TH>
            <TH numeric>Units</TH>
            <TH numeric>Invested</TH>
            <TH numeric>Performance fee share</TH>
            <TH numeric>Value</TH>
            <TH numeric>Profit</TH>
            <TH numeric>Admin fee</TH>
            <TH numeric>Final profit</TH>
          </tr>
        </THead>
        <TBody>
          {positions.data?.map((p) => (
            <TR key={p.client_id}>
              <TD>{p.client_name || p.client_email}</TD>
              <TD numeric>{formatUnits(p.units, { decimals: 4 })}</TD>
              <TD numeric>{formatINR(p.contributed)}</TD>
              <TD numeric>{formatINR(p.performance_fee_share)}</TD>
              <TD numeric>{formatINR(p.net_value)}</TD>
              <TD numeric>{formatSignedINR(p.profit)}</TD>
              <TD numeric>{formatINR(p.admin_fee)}</TD>
              <TD numeric className="font-medium">
                {formatSignedINR(p.final_profit)}
              </TD>
            </TR>
          ))}
        </TBody>
      </Table>
    </ReportCard>
  );
}
