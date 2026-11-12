import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import type { ReactNode } from 'react';
import type { GlossaryTerm } from '@/lib/glossary';
import { cn } from '@/lib/utils/cn';
import { Card } from './Card';
import { Skeleton } from './Skeleton';
import { InfoTip } from './Tooltip';

interface StatCardProps {
  label: string;
  /** Pre-formatted value (use helpers from @/lib/format; never format money ad hoc). */
  value: ReactNode;
  term?: GlossaryTerm;
  /** Optional secondary line, e.g. "as of 12 Nov 2026". */
  meta?: ReactNode;
  /** Direction of change; shows icon + text so it is not colour-only. */
  trend?: { direction: 'up' | 'down'; label: string };
  badge?: ReactNode;
  loading?: boolean;
  className?: string;
}

export function StatCard({ label, value, term, meta, trend, badge, loading, className }: StatCardProps) {
  return (
    <Card className={cn('p-4', className)}>
      <div className="flex items-start justify-between gap-2">
        <p className="flex items-center gap-1 text-xs font-medium text-muted">
          {label}
          {term && <InfoTip term={term} />}
        </p>
        {badge}
      </div>
      {loading ? (
        <Skeleton className="mt-2 h-7 w-32" />
      ) : (
        <p className="mt-1 num text-2xl font-semibold tracking-tight">{value}</p>
      )}
      {(trend || meta) && !loading && (
        <div className="mt-1 flex flex-wrap items-center gap-x-2 text-xs">
          {trend && (
            <span
              className={cn(
                'inline-flex items-center gap-0.5 num font-medium',
                trend.direction === 'up' ? 'text-gain' : 'text-loss',
              )}
            >
              {trend.direction === 'up' ? (
                <ArrowUpRight aria-hidden="true" className="size-3.5" />
              ) : (
                <ArrowDownRight aria-hidden="true" className="size-3.5" />
              )}
              <span className="sr-only">{trend.direction === 'up' ? 'Up' : 'Down'} </span>
              {trend.label}
            </span>
          )}
          {meta && <span className="text-muted">{meta}</span>}
        </div>
      )}
    </Card>
  );
}
