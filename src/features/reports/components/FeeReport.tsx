import { useState } from 'react';
import { Select } from '@/components/ui/Form';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/Table';
import { useCycles } from '@/features/cycles/queries';
import { useLotAccruals } from '@/features/fees/api';
import { summariseAccruals } from '@/features/fees/logic';
import { useNavSnapshots } from '@/features/nav/queries';
import { downloadCsv, slug, toCsv } from '@/lib/csv';
import {
  formatDate,
  formatDateTime,
  formatINR,
  formatNav,
  formatRateAsPercent,
  formatUnits,
  isoDateInIST,
} from '@/lib/format';
import { CycleFilter, FilterField, ReportCard } from './ReportParts';

export function FeeReport() {
  const [cycleId, setCycleId] = useState('');
  const [snapshotId, setSnapshotId] = useState('');
  const cycles = useCycles();
  const snapshots = useNavSnapshots(cycleId);
  const options = (snapshots.data ?? []).filter((s) => s.status === 'published' || s.status === 'corrected');
  const selected = options.find((s) => s.id === snapshotId) ?? options[0];
  const lots = useLotAccruals(selected?.id ?? '');
  const cycleName = cycles.data?.find((c) => c.id === cycleId)?.name ?? 'cycle';
  const summary = lots.data ? summariseAccruals(lots.data) : null;

  function download() {
    if (!lots.data || !selected) return;
    const csv = toCsv(
      [
        'NAV as of',
        'Client',
        'Client email',
        'Contribution received',
        'Contributed (INR)',
        'Units',
        'Starting NAV (HWM)',
        'Fee rate',
        'Gross NAV',
        'Gross value (INR)',
        'Eligible profit per unit',
        'Indicative fee (INR)',
        'Net value (INR)',
        'Loss to recover (INR)',
        'Method',
      ],
      lots.data.map((l) => [
        selected.nav_date,
        l.client_name,
        l.client_email,
        l.received_at,
        l.contributed_amount,
        l.units,
        l.reference_hwm,
        l.fee_rate,
        l.gross_nav_per_unit,
        l.gross_value,
        l.eligible_profit_per_unit,
        l.fee_amount,
        l.net_value,
        l.loss_to_recover,
        'per_lot_hwm_v1 (indicative, demo)',
      ]),
    );
    downloadCsv(`performance-fee-${slug(cycleName)}-${isoDateInIST()}.csv`, csv);
  }

  const state = !cycleId
    ? 'idle'
    : snapshots.isPending || (selected && lots.isPending)
      ? 'loading'
      : snapshots.isError || lots.isError
        ? 'error'
        : !selected || (lots.data?.length ?? 0) === 0
          ? 'empty'
          : 'ready';

  return (
    <ReportCard
      title="Performance-fee report"
      description="Indicative fee per contribution lot at a published NAV (method per_lot_hwm_v1)."
      state={state}
      emptyText="No published NAV with lots for this cycle."
      onRetry={() => void lots.refetch()}
      total={lots.data?.length}
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
                    {formatDateTime(s.nav_date)} — {formatNav(s.gross_nav_per_unit)}
                    {s.status === 'corrected' ? ' (corrected)' : ''}
                  </option>
                ))}
              </Select>
            </FilterField>
          )}
        </>
      }
    >
      {summary && (
        <p className="border-b border-line px-5 py-3 text-sm">
          Total indicative fee <span className="num font-semibold">{formatINR(summary.fee)}</span> · gross
          value <span className="num">{formatINR(summary.grossValue)}</span> · net value{' '}
          <span className="num">{formatINR(summary.netValue)}</span> · {summary.lotsBelowHwm} lot(s) below HWM
        </p>
      )}
      <Table caption="Performance fee per lot" minWidth={900}>
        <THead>
          <tr>
            <TH>Client · lot</TH>
            <TH numeric>Units</TH>
            <TH numeric>HWM</TH>
            <TH numeric>Rate</TH>
            <TH numeric>Gross value</TH>
            <TH numeric>Fee</TH>
            <TH numeric>Net value</TH>
            <TH numeric>Loss to recover</TH>
          </tr>
        </THead>
        <TBody>
          {lots.data?.map((l) => (
            <TR key={l.id}>
              <TD>
                {l.client_name || l.client_email}
                <span className="block text-xs text-muted">
                  {formatINR(l.contributed_amount)} · {formatDate(l.received_at)}
                </span>
              </TD>
              <TD numeric>{formatUnits(l.units, { decimals: 4 })}</TD>
              <TD numeric>{formatNav(l.reference_hwm)}</TD>
              <TD numeric>{formatRateAsPercent(l.fee_rate)}</TD>
              <TD numeric>{formatINR(l.gross_value)}</TD>
              <TD numeric>{formatINR(l.fee_amount)}</TD>
              <TD numeric>{formatINR(l.net_value)}</TD>
              <TD numeric>{formatINR(l.loss_to_recover)}</TD>
            </TR>
          ))}
        </TBody>
      </Table>
    </ReportCard>
  );
}
