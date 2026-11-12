import { CircleAlert } from 'lucide-react';
import { useId, useState, type FormEvent, type ReactNode } from 'react';
import { UserFacingError } from '@/lib/errors';
import { Button } from './Button';
import { Dialog } from './Dialog';
import { FormField, Textarea } from './Form';

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  /** Plain-language consequence of the action ("This issues units and cannot be undone"). */
  description: ReactNode;
  /** Optional summary of what will change (amounts, NAV, units…). */
  children?: ReactNode;
  confirmLabel: string;
  tone?: 'primary' | 'danger';
  /** When true, a written reason is mandatory and is passed to onConfirm (stored in the audit log). */
  requireReason?: boolean;
  reasonLabel?: string;
  minReasonLength?: number;
  /**
   * Return a promise; the dialog stays open and locked until it settles. If it rejects, the dialog
   * stays open and shows `errorMessage` (or the error's message if it is user-safe — see UserFacingError).
   */
  onConfirm: (reason: string) => Promise<void> | void;
  errorMessage?: string;
  /** Disable confirming (e.g. while a server preview is loading or failed). */
  confirmDisabled?: boolean;
}

/**
 * Confirmation for financial / destructive actions. Locks while the action runs so it cannot be
 * submitted twice, and optionally captures an audit reason.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  confirmLabel,
  tone = 'primary',
  requireReason = false,
  reasonLabel = 'Reason (recorded in the audit log)',
  minReasonLength = 5,
  onConfirm,
  errorMessage = 'The action could not be completed. Nothing was changed. Please try again.',
  confirmDisabled = false,
}: ConfirmDialogProps) {
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [touched, setTouched] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const trimmed = reason.trim();
  const reasonError =
    requireReason && trimmed.length < minReasonLength
      ? `Please enter at least ${minReasonLength} characters.`
      : undefined;

  function handleOpenChange(next: boolean) {
    if (submitting) return;
    if (!next) {
      setReason('');
      setTouched(false);
      setFailure(null);
    }
    onOpenChange(next);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (reasonError || submitting || confirmDisabled) return;
    setSubmitting(true);
    setFailure(null);
    try {
      await onConfirm(trimmed);
    } catch (err) {
      // Never surface raw backend errors; only explicitly user-safe messages.
      setFailure(err instanceof UserFacingError ? err.message : errorMessage);
      setSubmitting(false);
      return;
    }
    setSubmitting(false);
    setReason('');
    setTouched(false);
    onOpenChange(false);
  }

  const formId = useId();

  return (
    <Dialog
      open={open}
      onOpenChange={handleOpenChange}
      title={title}
      description={description}
      size="sm"
      dismissible={!submitting}
      footer={
        <>
          <Button variant="secondary" onClick={() => handleOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" form={formId} variant={tone} loading={submitting} disabled={confirmDisabled}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={handleSubmit} noValidate className="space-y-4">
        {failure && (
          <p
            role="alert"
            className="flex items-start gap-2 rounded-[var(--radius-control)] border border-loss/20 bg-loss-soft px-3 py-2 text-sm text-loss"
          >
            <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            {failure}
          </p>
        )}
        {children}
        {requireReason && (
          <FormField label={reasonLabel} required error={touched ? reasonError : undefined}>
            {(field) => (
              <Textarea
                {...field}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                onBlur={() => setTouched(true)}
                disabled={submitting}
                maxLength={500}
              />
            )}
          </FormField>
        )}
      </form>
    </Dialog>
  );
}
