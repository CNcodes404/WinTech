import { FlaskConical } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

const LABELS = {
  demo: 'Demo data',
  manual: 'Manual demo entry',
} as const;

interface DemoBadgeProps {
  /** `demo` for seeded fictional data, `manual` for admin-entered valuations. */
  kind?: keyof typeof LABELS;
  className?: string;
}

/** Persistent label so demo/manual figures are never mistaken for live market data. */
export function DemoBadge({ kind = 'demo', className }: DemoBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border border-warning/30 bg-warning-soft px-2 py-0.5 text-xs font-semibold text-warning',
        className,
      )}
    >
      <FlaskConical aria-hidden="true" className="size-3.5" />
      {LABELS[kind]}
    </span>
  );
}
