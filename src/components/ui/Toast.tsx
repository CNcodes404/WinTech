import { CircleCheck, CircleX, Info, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';
import { ToastContext, type ToastInput, type ToastTone } from './toast-context';

interface ToastItem extends Required<Omit<ToastInput, 'description'>> {
  id: number;
  description?: string;
}

const TONE = {
  success: { icon: CircleCheck, cls: 'text-gain' },
  error: { icon: CircleX, cls: 'text-loss' },
  info: { icon: Info, cls: 'text-info' },
} as const satisfies Record<ToastTone, unknown>;

const DURATION_MS = 5000;

/** Lightweight success/error notifications announced via aria-live. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: number) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) clearTimeout(timer);
    timers.current.delete(id);
  }, []);

  const toast = useCallback(
    ({ title, description, tone = 'success' }: ToastInput) => {
      const id = nextId.current++;
      setItems((prev) => [...prev.slice(-3), { id, title, description, tone }]);
      // Errors stay until dismissed so users don't miss them.
      if (tone !== 'error')
        timers.current.set(
          id,
          setTimeout(() => dismiss(id), DURATION_MS),
        );
    },
    [dismiss],
  );

  useEffect(() => {
    const map = timers.current;
    return () => map.forEach(clearTimeout);
  }, []);

  const api = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="false"
        className="pointer-events-none fixed inset-x-4 bottom-4 z-[60] flex flex-col items-end gap-2 sm:left-auto sm:w-96"
      >
        {items.map((t) => {
          const { icon: Icon, cls } = TONE[t.tone];
          return (
            <div
              key={t.id}
              role={t.tone === 'error' ? 'alert' : 'status'}
              className="pointer-events-auto flex w-full items-start gap-3 rounded-[var(--radius-card)] border border-line bg-surface p-4 shadow-[var(--shadow-overlay)]"
            >
              <Icon aria-hidden="true" className={cn('mt-0.5 size-5 shrink-0', cls)} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{t.title}</p>
                {t.description && <p className="mt-0.5 text-sm text-muted">{t.description}</p>}
              </div>
              <button
                type="button"
                onClick={() => dismiss(t.id)}
                className="-m-1 rounded-md p-1 text-muted hover:bg-navy-50 hover:text-ink"
                aria-label="Dismiss notification"
              >
                <X aria-hidden="true" className="size-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
