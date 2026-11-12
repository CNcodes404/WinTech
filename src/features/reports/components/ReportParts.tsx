import { Download, TriangleAlert } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { Input, Select } from '@/components/ui/Form';
import { TableSkeleton } from '@/components/ui/Skeleton';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { useCycles } from '@/features/cycles/queries';
import type { DateRange } from '../api';

export const PREVIEW_ROWS = 50;

interface ReportCardProps {
  title: string;
  description: string;
  filters: ReactNode;
  state: 'loading' | 'error' | 'empty' | 'ready' | 'idle';
  emptyText?: string;
  idleText?: string;
  onRetry?: () => void;
  total?: number;
  shown?: number;
  capped?: boolean;
  onDownload?: () => void;
  children?: ReactNode;
}

/** Common frame: filters, preview, row count, CSV download. */
export function ReportCard({
  title,
  description,
  filters,
  state,
  emptyText = 'No rows match these filters.',
  idleText = 'Choose the filters above.',
  onRetry,
  total,
  shown,
  capped,
  onDownload,
  children,
}: ReportCardProps) {
  return (
    <Card>
      <CardHeader
        title={title}
        description={description}
        actions={
          onDownload && (
            <Button size="sm" onClick={onDownload} disabled={state !== 'ready'}>
              <Download aria-hidden="true" className="size-4" />
              Download CSV
            </Button>
          )
        }
      />
      <div className="flex flex-wrap items-end gap-3 border-b border-line px-5 py-4 print:hidden">
        {filters}
      </div>
      {state === 'loading' ? (
        <TableSkeleton rows={5} columns={5} />
      ) : state === 'error' ? (
        <ErrorState message="The report could not be loaded." onRetry={onRetry} />
      ) : state === 'empty' ? (
        <EmptyState title={emptyText} />
      ) : state === 'idle' ? (
        <p className="px-5 py-8 text-center text-sm text-muted">{idleText}</p>
      ) : (
        <>
          {children}
          {total !== undefined && (
            <p className="flex flex-wrap items-center gap-2 border-t border-line px-5 py-3 text-xs text-muted">
              {shown !== undefined && shown < total
                ? `Previewing ${shown} of ${total} rows. The CSV contains all ${capped ? 'exported' : ''} rows.`
                : `${total} row(s).`}
              {capped && (
                <span className="inline-flex items-center gap-1 text-warning">
                  <TriangleAlert aria-hidden="true" className="size-3.5" />
                  Export limited to the first 5,000 rows — narrow the filters.
                </span>
              )}
            </p>
          )}
        </>
      )}
    </Card>
  );
}

export function FilterField({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1">
      <label htmlFor={htmlFor} className="block text-xs font-medium text-muted">
        {label}
      </label>
      {children}
    </div>
  );
}

export function CycleFilter({
  id,
  value,
  onChange,
  allowAll = false,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  allowAll?: boolean;
}) {
  const cycles = useCycles();
  return (
    <FilterField label="Cycle" htmlFor={id}>
      <Select id={id} value={value} onChange={(e) => onChange(e.target.value)} className="w-60">
        {allowAll ? <option value="">All cycles</option> : <option value="">Choose a cycle</option>}
        {cycles.data?.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name} ({c.status})
          </option>
        ))}
      </Select>
    </FilterField>
  );
}

export function DateRangeFilter({
  idPrefix,
  value,
  onChange,
}: {
  idPrefix: string;
  value: DateRange;
  onChange: (v: DateRange) => void;
}) {
  return (
    <>
      <FilterField label="From (IST)" htmlFor={`${idPrefix}-from`}>
        <Input
          id={`${idPrefix}-from`}
          type="date"
          value={value.from}
          max={value.to || undefined}
          onChange={(e) => onChange({ ...value, from: e.target.value })}
          className="w-40"
        />
      </FilterField>
      <FilterField label="To (IST)" htmlFor={`${idPrefix}-to`}>
        <Input
          id={`${idPrefix}-to`}
          type="date"
          value={value.to}
          min={value.from || undefined}
          onChange={(e) => onChange({ ...value, to: e.target.value })}
          className="w-40"
        />
      </FilterField>
    </>
  );
}
