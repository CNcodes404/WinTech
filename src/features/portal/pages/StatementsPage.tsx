import { Download, Printer } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { TableSkeleton } from '@/components/ui/Skeleton';
import { ErrorState } from '@/components/ui/States';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/Table';
import { useAuth } from '@/features/auth/auth-context';
import {
  formatDate,
  formatDateTime,
  formatINR,
  formatNav,
  formatSignedINR,
  formatUnits,
  isoDateInIST,
} from '@/lib/format';
import { useMyContributions, useSelectedClientCycle } from '../api';
import { PortalCycleBar } from '../components/PortalCycleBar';
import { PortalEmpty } from '../components/PortalEmpty';
import { downloadCsv, holdingRows, toCsv } from '../logic';

const STATUS_TEXT = {
  pending: 'Pending',
  verified: 'Verified',
  rejected: 'Not accepted',
  reversed: 'Reversed',
} as const;
const METHOD_TEXT = { upi: 'UPI', bank_transfer: 'Bank transfer', cheque: 'Cheque', other: 'Other' } as const;

/** Printable statement of the client's own records (Print → Save as PDF) plus CSV download. */
export function StatementsPage() {
  const { profile } = useAuth();
  const { cycles, cycle, select } = useSelectedClientCycle();
  const contributions = useMyContributions();

  if (cycles.isPending || contributions.isPending) {
    return (
      <>
        <PageHeader title="Statements" />
        <Card>
          <TableSkeleton rows={6} columns={4} />
        </Card>
      </>
    );
  }
  if (cycles.isError || contributions.isError) {
    return (
      <>
        <PageHeader title="Statements" />
        <Card>
          <ErrorState message="Your statement could not be prepared." />
        </Card>
      </>
    );
  }
  if (!cycle) {
    return (
      <>
        <PageHeader title="Statements" />
        <PortalEmpty />
      </>
    );
  }

  const rows = holdingRows(contributions.data, cycle);
  const myContributions = contributions.data.filter((c) => c.cycle_id === cycle.cycle_id);
  const generated = new Date();
  const asOf = cycle.latest_nav_date;
  const nav = cycle.latest_nav ?? cycle.base_nav;

  function exportCsv() {
    const summaryCsv = toCsv(
      [
        'NAV per unit',
        'Units held',
        'Total invested (INR)',
        'Current value (INR)',
        'Profit (INR)',
        'Admin fee (INR)',
        'Final profit (INR)',
        'Value after admin fee (INR)',
      ],
      [
        [
          nav,
          cycle!.units,
          cycle!.net_contributed,
          cycle!.current_value,
          cycle!.profit,
          cycle!.admin_fee,
          cycle!.final_profit,
          cycle!.final_value,
        ],
      ],
    );
    const holdingsCsv = toCsv(
      ['Contribution date', 'Amount (INR)', 'NAV applied', 'Units', 'Value now (INR)', 'Profit (INR)'],
      rows.map((r) => [
        r.received_at,
        r.amount.toFixed(2),
        r.entryNav,
        r.units.toFixed(8),
        r.value.toFixed(2),
        r.profit.toFixed(2),
      ]),
    );
    const contribCsv = toCsv(
      ['Received', 'Amount (INR)', 'Method', 'Reference', 'Status', 'NAV applied', 'Units issued'],
      myContributions.map((c) => [
        c.received_at,
        c.amount,
        METHOD_TEXT[c.method],
        c.reference_number,
        STATUS_TEXT[c.status],
        c.applicable_nav,
        c.units_issued,
      ]),
    );
    const header = toCsv(
      ['Statement', 'Client', 'Cycle', 'As of NAV date', 'Generated', 'Note'],
      [
        [
          'WinTech investment statement (DEMO)',
          profile?.full_name || profile?.email || '',
          cycle!.cycle_name,
          asOf ?? '',
          generated.toISOString(),
          'Indicative figures from manual demo valuations; not live market data.',
        ],
      ],
    );
    downloadCsv(
      `wintech-statement-${cycle!.cycle_name.replace(/[^A-Za-z0-9]+/g, '-').toLowerCase()}-${isoDateInIST(generated)}.csv`,
      `${header}\r\nSummary\r\n${summaryCsv}\r\nHoldings\r\n${holdingsCsv}\r\nContributions\r\n${contribCsv}`,
    );
  }

  return (
    <>
      <PageHeader
        title="Statements"
        description="Your own records only. Print or save as PDF, or download a CSV file."
        actions={
          <div className="flex gap-2 print:hidden">
            <Button variant="secondary" onClick={exportCsv}>
              <Download aria-hidden="true" className="size-4" />
              Download CSV
            </Button>
            <Button onClick={() => window.print()}>
              <Printer aria-hidden="true" className="size-4" />
              Print / save as PDF
            </Button>
          </div>
        }
      />
      <div className="space-y-4">
        <PortalCycleBar cycles={cycles.data} cycle={cycle} onSelect={select} />

        <Card className="print:border-0 print:shadow-none">
          <CardContent className="space-y-6 py-6">
            <header className="flex flex-wrap items-start justify-between gap-4 border-b border-line pb-4">
              <div>
                <h2 className="text-lg">Investment statement</h2>
                <p className="text-sm text-muted">WinTech · demonstration prototype</p>
              </div>
              <dl className="grid grid-cols-[auto_auto] gap-x-4 gap-y-1 text-sm">
                <dt className="text-muted">Client</dt>
                <dd className="font-medium">{profile?.full_name || profile?.email}</dd>
                <dt className="text-muted">Cycle</dt>
                <dd>{cycle.cycle_name}</dd>
                <dt className="text-muted">Valued as of</dt>
                <dd className="num">{asOf ? formatDateTime(asOf) : 'No NAV published yet'}</dd>
                <dt className="text-muted">Generated</dt>
                <dd className="num">{formatDateTime(generated)}</dd>
              </dl>
            </header>

            <section aria-labelledby="st-summary">
              <h3 id="st-summary" className="text-sm">
                Summary
              </h3>
              <dl className="mt-2 grid gap-3 text-sm sm:grid-cols-4">
                {[
                  ['Total invested', formatINR(cycle.net_contributed)],
                  ['Units held', formatUnits(cycle.units)],
                  ['NAV per unit', formatNav(nav, { decimals: 8 })],
                  ['Current value', formatINR(cycle.current_value)],
                  ['Profit', formatSignedINR(cycle.profit)],
                  ['Admin fee', formatINR(cycle.admin_fee)],
                  ['Final profit', formatSignedINR(cycle.final_profit)],
                  ['Value after admin fee', formatINR(cycle.final_value)],
                ].map(([k, v]) => (
                  <div key={k}>
                    <dt className="text-muted">{k}</dt>
                    <dd className="num font-medium">{v}</dd>
                  </div>
                ))}
              </dl>
            </section>

            <section aria-labelledby="st-lots">
              <h3 id="st-lots" className="mb-2 text-sm">
                Holdings
              </h3>
              {rows.length === 0 ? (
                <p className="text-sm text-muted">No verified contributions yet.</p>
              ) : (
                <Table caption="Holdings" minWidth={680}>
                  <THead>
                    <tr>
                      <TH>Date</TH>
                      <TH numeric>Amount</TH>
                      <TH numeric>NAV applied</TH>
                      <TH numeric>Units</TH>
                      <TH numeric>Value now</TH>
                      <TH numeric>Profit</TH>
                    </tr>
                  </THead>
                  <TBody>
                    {rows.map((r) => (
                      <TR key={r.id}>
                        <TD className="num">{formatDate(r.received_at)}</TD>
                        <TD numeric>{formatINR(r.amount)}</TD>
                        <TD numeric>{formatNav(r.entryNav)}</TD>
                        <TD numeric>{formatUnits(r.units)}</TD>
                        <TD numeric>{formatINR(r.value)}</TD>
                        <TD numeric>{formatSignedINR(r.profit)}</TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              )}
            </section>

            <section aria-labelledby="st-contrib">
              <h3 id="st-contrib" className="mb-2 text-sm">
                Contribution history
              </h3>
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
                  {myContributions.map((c) => (
                    <TR key={c.id}>
                      <TD className="num">{formatDateTime(c.received_at)}</TD>
                      <TD numeric>{formatINR(c.amount)}</TD>
                      <TD>{METHOD_TEXT[c.method]}</TD>
                      <TD>{STATUS_TEXT[c.status]}</TD>
                      <TD numeric>{c.applicable_nav ? formatNav(c.applicable_nav) : '—'}</TD>
                      <TD numeric>{c.units_issued ? formatUnits(c.units_issued) : '—'}</TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </section>

            <footer className="border-t border-line pt-4 text-xs text-muted">
              Indicative figures based on manually entered demo valuations; not live market data. The admin
              fee is shown for information and has not been deducted or paid by this app. No returns are
              guaranteed. This statement is generated by a prototype and is not an official account statement.
            </footer>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
