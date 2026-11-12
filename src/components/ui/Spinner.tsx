import { LoaderCircle } from 'lucide-react';

/** Full-screen loading state for route-level waits (session restore, profile lookup). */
export function PageSpinner({ label = 'Loading' }: { label?: string }) {
  return (
    <div role="status" aria-live="polite" className="flex min-h-dvh items-center justify-center">
      <LoaderCircle aria-hidden="true" className="size-8 animate-spin text-emerald-500" />
      <span className="sr-only">{label}…</span>
    </div>
  );
}
