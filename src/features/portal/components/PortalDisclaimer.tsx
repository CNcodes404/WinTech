import { Info } from 'lucide-react';

/** Prominent disclaimer required on client screens with figures. */
export function PortalDisclaimer() {
  return (
    <p className="flex items-start gap-2 rounded-[var(--radius-card)] border border-line bg-surface px-4 py-3 text-sm text-muted">
      <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-info" />
      <span>
        Figures are <strong className="font-medium text-ink">indicative</strong>, based on manually entered
        demo valuations, and are <strong className="font-medium text-ink">not live market data</strong>. The
        admin fee is shown for information; nothing has been deducted or paid by this app. No returns are
        guaranteed.
      </span>
    </p>
  );
}
