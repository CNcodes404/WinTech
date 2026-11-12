import { CircleAlert } from 'lucide-react';
import {
  forwardRef,
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { cn } from '@/lib/utils/cn';

const controlBase =
  'w-full rounded-[var(--radius-control)] border bg-surface px-3 text-sm text-ink placeholder:text-muted/70 ' +
  'transition-colors focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-0 ' +
  'disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-muted';

const controlState = (invalid?: boolean) =>
  invalid
    ? 'border-loss focus-visible:outline-loss'
    : 'border-line hover:border-navy-200 focus-visible:outline-emerald-500';

type InvalidProp = { invalid?: boolean };

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & InvalidProp>(
  function Input({ className, invalid, ...props }, ref) {
    return (
      <input
        ref={ref}
        className={cn(controlBase, controlState(invalid), 'h-10', className)}
        aria-invalid={invalid || undefined}
        {...props}
      />
    );
  },
);

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement> & InvalidProp
>(function Textarea({ className, invalid, rows = 3, ...props }, ref) {
  return (
    <textarea
      ref={ref}
      rows={rows}
      className={cn(controlBase, controlState(invalid), 'py-2', className)}
      aria-invalid={invalid || undefined}
      {...props}
    />
  );
});

/** Native select: best keyboard, screen-reader and mobile support. */
export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement> & InvalidProp>(
  function Select({ className, invalid, children, ...props }, ref) {
    return (
      <select
        ref={ref}
        className={cn(controlBase, controlState(invalid), 'h-10 pr-8', className)}
        aria-invalid={invalid || undefined}
        {...props}
      >
        {children}
      </select>
    );
  },
);

export interface FieldControlProps {
  id: string;
  'aria-describedby'?: string;
  invalid: boolean;
  required?: boolean;
}

interface FormFieldProps {
  label: ReactNode;
  /** Short helper text shown under the label (e.g. "Enter as a percentage, e.g. 20"). */
  hint?: ReactNode;
  /** Inline validation message. */
  error?: string;
  required?: boolean;
  className?: string;
  /** Render prop receives the id/aria wiring for the control. */
  children: (control: FieldControlProps) => ReactNode;
}

/**
 * Label + control + hint + inline error, with correct `for`/`aria-describedby` wiring so screen
 * readers announce the hint and the error together with the field.
 */
export function FormField({ label, hint, error, required, className, children }: FormFieldProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;

  return (
    <div className={cn('space-y-1.5', className)}>
      <label htmlFor={id} className="block text-sm font-medium text-ink">
        {label}
        {required && (
          <span className="ml-0.5 text-loss" aria-hidden="true">
            *
          </span>
        )}
        {required && <span className="sr-only"> (required)</span>}
      </label>
      {hint && (
        <p id={hintId} className="text-xs text-muted">
          {hint}
        </p>
      )}
      {children({ id, 'aria-describedby': describedBy, invalid: Boolean(error), required })}
      {error && (
        <p id={errorId} className="flex items-center gap-1 text-xs font-medium text-loss">
          <CircleAlert aria-hidden="true" className="size-3.5 shrink-0" />
          {error}
        </p>
      )}
    </div>
  );
}
