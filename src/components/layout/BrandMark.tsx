import { cn } from '@/lib/utils/cn';

export function BrandMark({ inverted = false, className }: { inverted?: boolean; className?: string }) {
  return (
    <span className={cn('flex items-center gap-2.5', className)}>
      <svg viewBox="0 0 32 32" aria-hidden="true" className="size-8 shrink-0">
        <rect width="32" height="32" rx="7" fill={inverted ? '#ffffff' : '#14243A'} />
        <path
          d="M7 21l5-6 4 4 9-10"
          fill="none"
          stroke="#0F9D83"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span className={cn('text-base font-semibold tracking-tight', inverted ? 'text-white' : 'text-ink')}>
        WinTech
      </span>
    </span>
  );
}
