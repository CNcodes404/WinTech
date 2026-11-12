import { CircleCheck, CircleX, Clock, Info, Minus, TriangleAlert, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';

const TONES = {
  neutral: { cls: 'border-line bg-surface-muted text-muted', icon: Minus },
  success: { cls: 'border-emerald-100 bg-gain-soft text-emerald-700', icon: CircleCheck },
  warning: { cls: 'border-warning/25 bg-warning-soft text-warning', icon: Clock },
  danger: { cls: 'border-loss/20 bg-loss-soft text-loss', icon: CircleX },
  info: { cls: 'border-info/20 bg-info-soft text-info', icon: Info },
  caution: { cls: 'border-warning/25 bg-warning-soft text-warning', icon: TriangleAlert },
} as const satisfies Record<string, { cls: string; icon: LucideIcon }>;

export type BadgeTone = keyof typeof TONES;

interface BadgeProps {
  tone?: BadgeTone;
  children: ReactNode;
  /** Status is never conveyed by colour alone: an icon is shown by default. */
  icon?: LucideIcon | false;
  className?: string;
}

export function Badge({ tone = 'neutral', children, icon, className }: BadgeProps) {
  const t = TONES[tone];
  const Icon = icon === false ? null : (icon ?? t.icon);
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap',
        t.cls,
        className,
      )}
    >
      {Icon && <Icon aria-hidden="true" className="size-3.5" />}
      {children}
    </span>
  );
}
