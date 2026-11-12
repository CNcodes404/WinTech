import type { HTMLAttributes, TdHTMLAttributes, ThHTMLAttributes } from 'react';
import { cn } from '@/lib/utils/cn';

/**
 * Table primitives. The wrapper scrolls horizontally on small screens so wide financial tables
 * remain usable without breaking the page layout.
 */
export function Table({
  className,
  caption,
  minWidth = 640,
  children,
  ...props
}: HTMLAttributes<HTMLTableElement> & { caption?: string; minWidth?: number }) {
  return (
    // Focusable so keyboard users can scroll the overflow region.
    // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
    <div className="overflow-x-auto" tabIndex={0} role="region" aria-label={caption ?? 'Table'}>
      <table className={cn('w-full text-sm', className)} style={{ minWidth }} {...props}>
        {caption && <caption className="sr-only">{caption}</caption>}
        {children}
      </table>
    </div>
  );
}

export function THead({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead
      className={cn(
        'border-b border-line bg-surface-muted text-left text-xs font-semibold tracking-wide text-muted uppercase',
        className,
      )}
      {...props}
    />
  );
}

export function TBody({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={cn('divide-y divide-line', className)} {...props} />;
}

export function TR({ className, ...props }: HTMLAttributes<HTMLTableRowElement>) {
  return <tr className={cn('hover:bg-surface-muted/60', className)} {...props} />;
}

type Align = { align?: 'left' | 'right' | 'center'; numeric?: boolean };

const alignCls = (align: Align['align'], numeric?: boolean) =>
  cn(
    align === 'right' || numeric ? 'text-right' : align === 'center' ? 'text-center' : 'text-left',
    numeric && 'num',
  );

export function TH({ className, align, numeric, ...props }: ThHTMLAttributes<HTMLTableCellElement> & Align) {
  return <th scope="col" className={cn('px-4 py-3', alignCls(align, numeric), className)} {...props} />;
}

export function TD({ className, align, numeric, ...props }: TdHTMLAttributes<HTMLTableCellElement> & Align) {
  return <td className={cn('px-4 py-3 align-middle', alignCls(align, numeric), className)} {...props} />;
}
