import * as RadixTooltip from '@radix-ui/react-tooltip';
import { CircleHelp } from 'lucide-react';
import type { ReactNode } from 'react';
import { GLOSSARY, type GlossaryTerm } from '@/lib/glossary';
import { cn } from '@/lib/utils/cn';

export const TooltipProvider = RadixTooltip.Provider;

interface TooltipProps {
  content: ReactNode;
  children: ReactNode;
  side?: 'top' | 'right' | 'bottom' | 'left';
}

export function Tooltip({ content, children, side = 'top' }: TooltipProps) {
  return (
    <RadixTooltip.Root>
      <RadixTooltip.Trigger asChild>{children}</RadixTooltip.Trigger>
      <RadixTooltip.Portal>
        <RadixTooltip.Content
          side={side}
          sideOffset={6}
          collisionPadding={12}
          className="z-50 max-w-xs rounded-md bg-navy-900 px-3 py-2 text-xs leading-relaxed text-white shadow-[var(--shadow-overlay)]"
        >
          {content}
          <RadixTooltip.Arrow className="fill-navy-900" />
        </RadixTooltip.Content>
      </RadixTooltip.Portal>
    </RadixTooltip.Root>
  );
}

/**
 * Inline "?" explainer for finance jargon (NAV, units, gross/net value, performance fee…).
 * Uses a real button so it is reachable by keyboard and announced by screen readers.
 */
export function InfoTip({ term, className }: { term: GlossaryTerm; className?: string }) {
  const entry = GLOSSARY[term];
  return (
    <Tooltip
      content={
        <>
          <span className="font-semibold">{entry.label}: </span>
          {entry.description}
        </>
      }
    >
      <button
        type="button"
        className={cn(
          'inline-flex size-4 items-center justify-center rounded-full align-middle text-muted hover:text-navy-700',
          className,
        )}
        aria-label={`What is ${entry.label}?`}
      >
        <CircleHelp aria-hidden="true" className="size-3.5" />
      </button>
    </Tooltip>
  );
}
