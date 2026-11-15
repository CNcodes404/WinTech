import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import type { ReactNode } from 'react';
import type { GlossaryTerm } from '@/lib/glossary';
import { cn } from '@/lib/utils/cn';
import { Card } from './Card';
import { Skeleton } from './Skeleton';
import { InfoTip } from './Tooltip';

/**
 * Accent colours for stat cards. Decorative only (stripe, dot, glow); the figure itself always uses
 * ink-coloured text, and gain/loss is still shown with an icon + sign, never colour alone.
 */
const TONES = {
  emerald: { stripe: 'from-emerald-500 to-teal-400', dot: 'bg-emerald-500', glow: 'bg-emerald-400/15' },
  sky: { stripe: 'from-sky-500 to-cyan-400', dot: 'bg-sky-500', glow: 'bg-sky-400/15' },
  indigo: { stripe: 'from-indigo-500 to-violet-400', dot: 'bg-indigo-500', glow: 'bg-indigo-400/15' },
  amber: { stripe: 'from-amber-500 to-orange-400', dot: 'bg-amber-500', glow: 'bg-amber-400/15' },
  violet: { stripe: 'from-violet-500 to-fuchsia-400', dot: 'bg-violet-500', glow: 'bg-violet-400/15' },
  rose: { stripe: 'from-rose-500 to-pink-400', dot: 'bg-rose-500', glow: 'bg-rose-400/15' },
  teal: { stripe: 'from-teal-500 to-emerald-400', dot: 'bg-teal-500', glow: 'bg-teal-400/15' },
} as const;

export type StatTone = keyof typeof TONES;
const TONE_ORDER = Object.keys(TONES) as StatTone[];

/** Stable colour per label, so the same figure always has the same colour on every page. */
function toneFor(label: string): StatTone {
  let h = 0;
  for (const ch of label) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return TONE_ORDER[h % TONE_ORDER.length]!;
}

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
  /** Accent colour; defaults to a stable colour derived from the label. */
  tone?: StatTone;
  className?: string;
}

export function StatCard({
  label,
  value,
  term,
  meta,
  trend,
  badge,
  loading,
  tone,
  className,
}: StatCardProps) {
  const t = TONES[tone ?? toneFor(label)];
  return (
    <Card
      className={cn(
        'relative overflow-hidden p-4 pt-5 transition-shadow hover:shadow-[var(--shadow-card-hover)]',
        className,
      )}
    >
      <span aria-hidden="true" className={cn('absolute inset-x-0 top-0 h-1 bg-gradient-to-r', t.stripe)} />
      <span
        aria-hidden="true"
        className={cn('pointer-events-none absolute -top-8 -right-8 size-24 rounded-full blur-2xl', t.glow)}
      />
      <div className="relative flex items-start justify-between gap-2">
        <p className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-muted uppercase">
          <span aria-hidden="true" className={cn('size-2 shrink-0 rounded-full', t.dot)} />
          {label}
          {term && <InfoTip term={term} />}
        </p>
        {badge}
      </div>
      {loading ? (
        <Skeleton className="mt-2 h-7 w-32" />
      ) : (
        <p className="relative mt-1.5 num text-2xl font-bold tracking-tight">{value}</p>
      )}
      {(trend || meta) && !loading && (
        <div className="relative mt-1 flex flex-wrap items-center gap-x-2 text-xs">
          {trend && (
            <span
              className={cn(
                'inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 num font-semibold',
                trend.direction === 'up' ? 'bg-gain-soft text-emerald-700' : 'bg-loss-soft text-loss',
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
