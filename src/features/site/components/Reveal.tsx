import type { ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';
import { useInView } from '../hooks';

/** Fades/slides content in once it scrolls into view. Disabled for reduced-motion users. */
export function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode;
  /** Stagger in ms. */
  delay?: number;
  className?: string;
}) {
  const { ref, inView } = useInView<HTMLDivElement>();
  return (
    <div
      ref={ref}
      style={{ transitionDelay: inView ? `${delay}ms` : undefined }}
      className={cn(
        'transition-all duration-700 ease-out motion-reduce:transition-none',
        inView ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0',
        className,
      )}
    >
      {children}
    </div>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  intro,
  light = false,
  center = true,
}: {
  eyebrow: string;
  title: string;
  intro?: string;
  light?: boolean;
  center?: boolean;
}) {
  return (
    <Reveal className={cn('max-w-3xl', center && 'mx-auto text-center')}>
      <p
        className={cn(
          'text-xs font-bold tracking-[0.2em] uppercase',
          light ? 'text-emerald-300' : 'text-emerald-700',
        )}
      >
        {eyebrow}
      </p>
      <h2 className={cn('mt-3 text-3xl font-bold sm:text-4xl', light && 'text-white')}>{title}</h2>
      <span
        aria-hidden="true"
        className={cn('mt-4 block h-1 w-16 rounded-full brand-rule', center && 'mx-auto')}
      />
      {intro && (
        <p className={cn('mt-4 text-base sm:text-lg', light ? 'text-navy-100' : 'text-muted')}>{intro}</p>
      )}
    </Reveal>
  );
}
