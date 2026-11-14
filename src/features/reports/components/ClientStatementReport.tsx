import { Printer } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Form';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/Table';
import { METHOD_LABEL } from '@/features/contributions/types';
import { useCycles } from '@/features/cycles/queries';
import { clientFigures } from '@/features/fees/logic';
import { useNavSnapshots } from '@/features/nav/queries';
import { clientNav } from '@/features/nav/types';
import { downloadCsv, slug, toCsv } from '@/lib/csv';
import { Decimal } from '@/lib/finance';
import {
  formatDateTime,
  formatINR,
  formatNav,
  formatSignedINR,
  formatUnits,
  isoDateInIST,
} from '@/lib/format';
import { isUuid } from '@/lib/utils/uuid';
import { useContributionRegister, usePeople } from '../api';
import { CycleFilter, FilterField, ReportCard } from './ReportParts';

/**
 * Admin copy of any client's statement for a cycle (printable + CSV): exactly the figures the client
 * sees — NAV after performance fee, value, profit, admin fee, final profit. No performance fee shown.
 */
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
  const verified = (register.data?.rows ?? []).filter((r) => r.status === 'verified');
  const nav = latest ? clientNav(latest) : (cycle?.base_nav ?? '0');
  const figures = clientFigures({
    units: verified.reduce((s, r) => s.plus(r.units_issued ?? '0'), new Decimal(0)),
    contributed: verified.reduce((s, r) => s.plus(r.amount), new Decimal(0)),
    nav,
    adminFee: cycle?.admin_fee_amount ?? '0',
  });

  function download() {
    if (!client || !cycle) return;
    const header = toCsv(
      [
        'Statement',
        'Client',
        'Email',
        'Cycle',
        'Valued as of',
        'NAV per unit',
        'Units',
        'Invested (INR)',
        'Current value (INR)',
        'Profit (INR)',
        'Admin fee (INR)',
        'Final profit (INR)',
        'Generated',
      ],
      [
        [
          'WinTech client statement (DEMO, admin copy)',
          client.full_name,
          client.email,
          cycle.name,
          latest?.nav_date ?? '',
          nav,
          figures.units.toFixed(8),
          figures.contributed.toFixed(2),
          figures.value.toFixed(2),
          figures.profit.toFixed(2),
          figures.adminFee.toFixed(2),
          figures.finalProfit.toFixed(2),
          new Date().toISOString(),
        ],
      ],
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
      `${header}\r\nContributions\r\n${contribCsv}`,
    );
  }

  const state = !ready
    ? 'idle'
    : register.isPending || snapshots.isPending
      ? 'loading'
      : register.isError || snapshots.isError
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
            <dd className="num">
              {latest ? formatDateTime(latest.nav_date) : 'No NAV published (base NAV)'}
            </dd>
            <dt className="text-muted">Generated</dt>
            <dd className="num">{formatDateTime(new Date())}</dd>
          </dl>
        </header>

        <dl className="grid gap-3 text-sm sm:grid-cols-4">
          {[
            ['NAV per unit', formatNav(nav, { decimals: 8 })],
            ['Units held', formatUnits(figures.units)],
            ['Invested', formatINR(figures.contributed)],
            ['Current value', formatINR(figures.value)],
            ['Profit', formatSignedINR(figures.profit)],
            ['Admin fee', formatINR(figures.adminFee)],
            ['Final profit', formatSignedINR(figures.finalProfit)],
            ['Value after admin fee', formatINR(figures.finalValue)],
          ].map(([k, v]) => (
            <div key={k}>
              <dt className="text-muted">{k}</dt>
              <dd className="num font-medium">{v}</dd>
            </div>
          ))}
        </dl>

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
          Indicative figures from manually entered demo valuations; not live market data. The admin fee is
          shown for information; no money is deducted by the app. Not an official account statement.
        </p>
      </div>
    </ReportCard>
  );
}
