import { useState } from 'react';
import { Select } from '@/components/ui/Form';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/Table';
import { ContributionStatusBadge } from '@/features/contributions/components/ContributionStatusBadge';
import { METHOD_LABEL, type ContributionStatusFilter } from '@/features/contributions/types';
import { downloadCsv, toCsv } from '@/lib/csv';
import { formatDateTime, formatINR, formatUnits, isoDateInIST } from '@/lib/format';
import { EXPORT_LIMIT, fetchContributionRegister, useContributionRegister, type DateRange } from '../api';
import { CycleFilter, DateRangeFilter, FilterField, PREVIEW_ROWS, ReportCard } from './ReportParts';

export function ContributionRegisterReport() {
  const [cycleId, setCycleId] = useState('');
  const [status, setStatus] = useState<ContributionStatusFilter>('all');
  const [range, setRange] = useState<DateRange>({ from: '', to: '' });
  const params = { cycleId, status, range };
  const { data, isPending, isError, refetch } = useContributionRegister(params);

  async function download() {
    const { rows } = await fetchContributionRegister(params);
    const csv = toCsv(
      [
        'Received',
        'Client',
        'Client email',
        'Cycle',
        'Amount (INR)',
        'Method',
        'Reference',
        'Status',
        'NAV applied',
        'Units issued',
        'Fee rate locked',
        'Verified at',
        'Rejected at',
        'Rejection reason',
        'Reversed at',
        'Reversal reason',
        'Internal notes',
      ],
      rows.map((r) => [
        r.received_at,
        r.client_name,
        r.client_email,
        r.cycle_name,
        r.amount,
        METHOD_LABEL[r.method],
        r.reference_number,
        r.status,
        r.applicable_nav,
        r.units_issued,
        r.locked_fee_rate,
        r.verified_at,
        r.rejected_at,
        r.rejection_reason,
        r.reversed_at,
        r.reversal_reason,
        r.notes,
      ]),
    );
    downloadCsv(`contribution-register-${isoDateInIST()}.csv`, csv);
  }

  const state = isPending ? 'loading' : isError ? 'error' : data.total === 0 ? 'empty' : 'ready';

  return (
    <ReportCard
      title="Contribution register"
      description="Every recorded contribution with status, NAV applied and units issued. Includes admin-only notes."
      state={state}
      onRetry={() => void refetch()}
      total={data?.total}
      shown={Math.min(PREVIEW_ROWS, data?.rows.length ?? 0)}
      capped={(data?.total ?? 0) > EXPORT_LIMIT}
      onDownload={() => void download()}
      filters={
        <>
          <CycleFilter id="reg-cycle" value={cycleId} onChange={setCycleId} allowAll />
          <FilterField label="Status" htmlFor="reg-status">
            <Select
              id="reg-status"
              value={status}
              onChange={(e) => setStatus(e.target.value as ContributionStatusFilter)}
              className="w-36"
            >
              <option value="all">All</option>
              <option value="pending">Pending</option>
              <option value="verified">Verified</option>
              <option value="rejected">Rejected</option>
              <option value="reversed">Reversed</option>
            </Select>
          </FilterField>
          <DateRangeFilter idPrefix="reg" value={range} onChange={setRange} />
        </>
      }
    >
      <Table caption="Contribution register preview" minWidth={900}>
        <THead>
          <tr>
            <TH>Received</TH>
            <TH>Client</TH>
            <TH>Cycle</TH>
            <TH numeric>Amount</TH>
            <TH>Method</TH>
            <TH>Status</TH>
            <TH numeric>Units</TH>
          </tr>
        </THead>
        <TBody>
          {data?.rows.slice(0, PREVIEW_ROWS).map((r) => (
            <TR key={r.id}>
              <TD className="num">{formatDateTime(r.received_at)}</TD>
              <TD>{r.client_name || r.client_email}</TD>
              <TD className="text-muted">{r.cycle_name}</TD>
              <TD numeric>{formatINR(r.amount)}</TD>
              <TD className="text-muted">{METHOD_LABEL[r.method]}</TD>
              <TD>
                <ContributionStatusBadge status={r.status} />
              </TD>
              <TD numeric>{r.units_issued ? formatUnits(r.units_issued, { decimals: 4 }) : '—'}</TD>
            </TR>
          ))}
        </TBody>
      </Table>
    </ReportCard>
  );
}
