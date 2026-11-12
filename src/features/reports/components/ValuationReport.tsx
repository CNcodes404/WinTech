import { useState } from 'react';
import { Select } from '@/components/ui/Form';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/Table';
import { ValuationStatusBadge } from '@/features/portfolio/components/ValuationStatusBadge';
import { useValuation, useValuations } from '@/features/portfolio/queries';
import { downloadCsv, toCsv } from '@/lib/csv';
import { formatDateTime, formatINR, formatUnits, isoDateInIST } from '@/lib/format';
import { CycleFilter, FilterField, ReportCard } from './ReportParts';

export function ValuationReport() {
  const [cycleId, setCycleId] = useState('');
  const [valuationId, setValuationId] = useState('');
  const valuations = useValuations(cycleId);
  const options = (valuations.data ?? []).filter((v) => v.status === 'approved' || v.status === 'superseded');
  const selectedId = valuationId || options[0]?.id || '';
  const detail = useValuation(selectedId);

  function download() {
    if (!detail.data) return;
    const { valuation: v, items } = detail.data;
    const lines = toCsv(
      [
        'Line',
        'Symbol',
        'Name',
        'Exchange',
        'Quantity',
        'Valuation price',
        'Average cost',
        'Market value (INR)',
      ],
      items.map((i) => [
        i.line_no,
        i.symbol,
        i.instrument_name,
        i.exchange,
        i.quantity,
        i.valuation_price,
        i.average_cost,
        i.market_value,
      ]),
    );
    const totals = toCsv(
      [
        'Valuation time',
        'Status',
        'Source',
        'Holdings (INR)',
        'Cash (INR)',
        'Other assets (INR)',
        'Liabilities (INR)',
        'Gross assets (INR)',
        'Net asset value (INR)',
        'Approved at',
      ],
      [
        [
          v.valuation_at,
          v.status,
          'manual demo entry',
          v.holdings_value,
          v.cash_balance,
          v.other_assets,
          v.liabilities,
          v.gross_asset_value,
          v.gross_net_asset_value,
          v.approved_at,
        ],
      ],
    );
    downloadCsv(
      `valuation-${isoDateInIST(new Date(v.valuation_at))}-${isoDateInIST()}.csv`,
      `${totals}\r\nHoldings\r\n${lines}`,
    );
  }

  const state = !cycleId
    ? 'idle'
    : valuations.isPending || (selectedId && detail.isPending)
      ? 'loading'
      : valuations.isError || detail.isError
        ? 'error'
        : !detail.data
          ? 'empty'
          : 'ready';
  const v = detail.data?.valuation;

  return (
    <ReportCard
      title="Portfolio valuation report"
      description="Holdings, cash and liabilities of an approved (or superseded) valuation. Manual demo entry."
      state={state}
      emptyText="No approved valuation for this cycle."
      onRetry={() => void detail.refetch()}
      total={detail.data?.items.length}
      onDownload={download}
      filters={
        <>
          <CycleFilter
            id="val-cycle"
            value={cycleId}
            onChange={(id) => {
              setCycleId(id);
              setValuationId('');
            }}
          />
          {options.length > 0 && (
            <FilterField label="Valuation" htmlFor="val-select">
              <Select
                id="val-select"
                value={selectedId}
                onChange={(e) => setValuationId(e.target.value)}
                className="w-72"
              >
                {options.map((o) => (
                  <option key={o.id} value={o.id}>
                    {formatDateTime(o.valuation_at)} — {formatINR(o.gross_net_asset_value)}
                    {o.status === 'superseded' ? ' (superseded)' : ''}
                  </option>
                ))}
              </Select>
            </FilterField>
          )}
        </>
      }
    >
      {v && (
        <div className="flex flex-wrap items-center gap-x-6 gap-y-1 border-b border-line px-5 py-3 text-sm">
          <ValuationStatusBadge status={v.status} />
          <span>
            Holdings <span className="num font-medium">{formatINR(v.holdings_value)}</span>
          </span>
          <span>
            Cash <span className="num font-medium">{formatINR(v.cash_balance)}</span>
          </span>
          <span>
            Liabilities <span className="num font-medium">{formatINR(v.liabilities)}</span>
          </span>
          <span>
            Net asset value <span className="num font-semibold">{formatINR(v.gross_net_asset_value)}</span>
          </span>
        </div>
      )}
      <Table caption="Valuation holdings" minWidth={720}>
        <THead>
          <tr>
            <TH>Symbol</TH>
            <TH>Name</TH>
            <TH numeric>Quantity</TH>
            <TH numeric>Price</TH>
            <TH numeric>Market value</TH>
          </tr>
        </THead>
        <TBody>
          {detail.data?.items.map((i) => (
            <TR key={i.id}>
              <TD className="font-medium">{i.symbol}</TD>
              <TD className="text-muted">{i.instrument_name ?? '—'}</TD>
              <TD numeric>{formatUnits(i.quantity, { decimals: 4 })}</TD>
              <TD numeric>{formatINR(i.valuation_price, { decimals: 4 })}</TD>
              <TD numeric>{formatINR(i.market_value)}</TD>
            </TR>
          ))}
        </TBody>
      </Table>
    </ReportCard>
  );
}
