import { FlaskConical } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

/** Persistent disclaimer required on every screen showing figures (README principle 6). */
export function DemoNotice({ className }: { className?: string }) {
  return (
    <p className={cn('flex items-start gap-2 text-xs text-muted', className)}>
      <FlaskConical aria-hidden="true" className="mt-px size-3.5 shrink-0 text-warning" />
      <span>
        Prototype with fictional demo data. Figures are manually entered and are not live market data. Not a
        live payment, brokerage or investment service.
      </span>
    </p>
  );
}
