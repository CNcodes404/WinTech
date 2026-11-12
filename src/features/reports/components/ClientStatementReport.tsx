import { Printer } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Form';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/Table';
import { METHOD_LABEL } from '@/features/contributions/types';
import { useCycles } from '@/features/cycles/queries';
import { useLotAccruals } from '@/features/fees/api';
import { summariseAccruals } from '@/features/fees/logic';
import { useNavSnapshots } from '@/features/nav/queries';
import { downloadCsv, slug, toCsv } from '@/lib/csv';
import { Decimal } from '@/lib/finance';
import {
  formatDate,
  formatDateTime,
  formatINR,
  formatNav,
  formatRateAsPercent,
  formatSignedINR,
  formatUnits,
  isoDateInIST,
} from '@/lib/format';
import { isUuid } from '@/lib/utils/uuid';
import { useContributionRegister, usePeople } from '../api';
import { CycleFilter, FilterField, ReportCard } from './ReportParts';

/** Admin view of any client's statement for a cycle (printable + CSV). */
export function ClientStatementReport() {
  const [clientId, setClientId] = useState('');
  const [cycleId, setCycleId] = useState('');
  const people = usePeople();
  const cycles = useCycles();
  const clients = (people.data ?? []).filter((p) => p.role === 'client');
  const client = clients.find((c) => c.id === clientId);
  const cycle = cycles.data?.find((c) => c.id === cycleId);
  const ready = isUuid(clientId) && isUuid(cycleId);

  const register = useContributionRegister(
    { cycleId, status: 'all', range: { from: '', to: '' }, clientId },
    ready,
  );
  const snapshots = useNavSnapshots(ready ? cycleId : '');
  const latest = snapshots.data?.find((s) => s.status === 'published');
  const allLots = useLotAccruals(latest?.id ?? '');
  const lots = (allLots.data ?? []).filter((l) => l.client_id === clientId);
  const summary = summariseAccruals(lots);
  const contributedValued = lots.reduce((s, l) => s.plus(l.contributed_amount), new Decimal(0));
  const pnl = lots.length ? summary.netValue.minus(contributedValued) : null;

  function download() {
    if (!client || !cycle) return;
    const header = toCsv(
      ['Statement', 'Client', 'Email', 'Cycle', 'Valued as of', 'Generated'],
      [
        [
          'WinTech client statement (DEMO, admin copy)',
          client.full_name,
          client.email,
          cycle.name,
          latest?.nav_date ?? '',
          new Date().toISOString(),
        ],
      ],
    );
    const lotCsv = toCsv(
      [
        'Contribution received',
        'Contributed (INR)',
        'Units',
        'Entry NAV',
        'Fee rate',
        'Gross value (INR)',
        'Indicative fee (INR)',
        'Net value (INR)',
        'Loss to recover (INR)',
      ],
      lots.map((l) => [
        l.received_at,
        l.contributed_amount,
        l.units,
        l.entry_nav,
        l.fee_rate,
        l.gross_value,
        l.fee_amount,
        l.net_value,
        l.loss_to_recover,
      ]),
    );
    const contribCsv = toCsv(
      ['Received', 'Amount (INR)', 'Method', 'Reference', 'Status', 'NAV applied', 'Units issued'],
      (register.data?.rows ?? []).map((r) => [
        r.received_at,
        r.amount,
        METHOD_LABEL[r.method],
        r.reference_number,
        r.status,
        r.applicable_nav,
        r.units_issued,
      ]),
    );
    downloadCsv(
      `statement-${slug(client.full_name || client.email)}-${slug(cycle.name)}-${isoDateInIST()}.csv`,
      `${header}\r\nLots\r\n${lotCsv}\r\nContributions\r\n${contribCsv}`,
    );
  }

  const state = !ready
    ? 'idle'
    : register.isPending || snapshots.isPending || (latest && allLots.isPending)
      ? 'loading'
      : register.isError || snapshots.isError || allLots.isError
        ? 'error'
        : (register.data?.total ?? 0) === 0
          ? 'empty'
          : 'ready';

  return (
    <ReportCard
      title="Client statement"
      description="The same figures the client sees, for any client and cycle. Print or save as PDF, or download CSV."
      state={state}
      idleText="Choose a client and a cycle."
      emptyText="This client has no contributions in this cycle."
      onDownload={download}
      filters={
        <>
          <FilterField label="Client" htmlFor="st-client">
            <Select
              id="st-client"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              className="w-64"
            >
              <option value="">Choose a client</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.full_name || c.email}
                  {c.status === 'inactive' ? ' (inactive)' : ''}
                </option>
              ))}
            </Select>
          </FilterField>
          <CycleFilter id="st-cycle" value={cycleId} onChange={setCycleId} />
          {state === 'ready' && (
            <Button variant="secondary" size="sm" onClick={() => window.print()}>
              <Printer aria-hidden="true" className="size-4" />
              Print / save as PDF
            </Button>
          )}
        </>
      }
    >
      <div className="space-y-5 px-5 py-5">
        <header className="flex flex-wrap justify-between gap-4 border-b border-line pb-4">
          <div>
            <h3 className="text-lg">Investment statement</h3>
            <p className="text-sm text-muted">WinTech · demonstration prototype · admin copy</p>
          </div>
          <dl className="grid grid-cols-[auto_auto] gap-x-4 gap-y-1 text-sm">
            <dt className="text-muted">Client</dt>
            <dd className="font-medium">{client?.full_name || client?.email}</dd>
            <dt className="text-muted">Cycle</dt>
            <dd>{cycle?.name}</dd>
            <dt className="text-muted">Valued as of</dt>
            <dd className="num">{latest ? formatDateTime(latest.nav_date) : 'No NAV published'}</dd>
            <dt className="text-muted">Generated</dt>
            <dd className="num">{formatDateTime(new Date())}</dd>
          </dl>
        </header>

        <dl className="grid gap-3 text-sm sm:grid-cols-4">
          {[
            ['Contributed (valued lots)', formatINR(contributedValued)],
            ['Indicative gross value', formatINR(summary.grossValue)],
            ['Indicative fee', formatINR(summary.fee)],
            ['Indicative net value', formatINR(summary.netValue)],
            ['Net profit / loss', pnl ? formatSignedINR(pnl) : '—'],
            ['Latest gross NAV', latest ? formatNav(latest.gross_nav_per_unit, { decimals: 8 }) : '—'],
          ].map(([k, v]) => (
            <div key={k}>
              <dt className="text-muted">{k}</dt>
              <dd className="num font-medium">{v}</dd>
            </div>
          ))}
        </dl>

        {lots.length > 0 && (
          <Table caption="Valued lots" minWidth={760}>
            <THead>
              <tr>
                <TH>Date</TH>
                <TH numeric>Amount</TH>
                <TH numeric>Entry NAV</TH>
                <TH numeric>Units</TH>
                <TH numeric>Rate</TH>
                <TH numeric>Gross value</TH>
                <TH numeric>Fee</TH>
                <TH numeric>Net value</TH>
              </tr>
            </THead>
            <TBody>
              {lots.map((l) => (
                <TR key={l.id}>
                  <TD className="num">{formatDate(l.received_at)}</TD>
                  <TD numeric>{formatINR(l.contributed_amount)}</TD>
                  <TD numeric>{formatNav(l.entry_nav)}</TD>
                  <TD numeric>{formatUnits(l.units)}</TD>
                  <TD numeric>{formatRateAsPercent(l.fee_rate)}</TD>
                  <TD numeric>{formatINR(l.gross_value)}</TD>
                  <TD numeric>{formatINR(l.fee_amount)}</TD>
                  <TD numeric>{formatINR(l.net_value)}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}

        <Table caption="Contribution history" minWidth={680}>
          <THead>
            <tr>
              <TH>Received</TH>
              <TH numeric>Amount</TH>
              <TH>Method</TH>
              <TH>Status</TH>
              <TH numeric>NAV applied</TH>
              <TH numeric>Units</TH>
            </tr>
          </THead>
          <TBody>
            {register.data?.rows.map((r) => (
              <TR key={r.id}>
                <TD className="num">{formatDateTime(r.received_at)}</TD>
                <TD numeric>{formatINR(r.amount)}</TD>
                <TD>{METHOD_LABEL[r.method]}</TD>
                <TD>{r.status}</TD>
                <TD numeric>{r.applicable_nav ? formatNav(r.applicable_nav) : '—'}</TD>
                <TD numeric>{r.units_issued ? formatUnits(r.units_issued) : '—'}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
        <p className="text-xs text-muted">
          Indicative figures from manually entered demo valuations; not live market data. The performance fee
          is accrued for information only. Not an official account statement.
        </p>
      </div>
    </ReportCard>
  );
}
