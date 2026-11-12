import { screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../../../tests/utils';
import { Badge } from './Badge';
import { Button } from './Button';
import { UserFacingError } from '@/lib/errors';
import { ConfirmDialog } from './ConfirmDialog';
import { FormField, Input } from './Form';
import { useToast } from './toast-context';

describe('Button', () => {
  it('defaults to type="button" to avoid accidental form submits', () => {
    renderWithProviders(<Button>Save</Button>);
    expect(screen.getByRole('button', { name: 'Save' })).toHaveAttribute('type', 'button');
  });

  it('is disabled and aria-busy while loading', () => {
    renderWithProviders(<Button loading>Save</Button>);
    const btn = screen.getByRole('button', { name: 'Save' });
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute('aria-busy', 'true');
  });
});

describe('Badge', () => {
  it('renders an icon alongside text so status is not colour-only', () => {
    const { container } = renderWithProviders(<Badge tone="success">Verified</Badge>);
    expect(screen.getByText('Verified')).toBeInTheDocument();
    expect(container.querySelector('svg')).not.toBeNull();
  });
});

describe('FormField', () => {
  it('associates label, hint and error with the control', () => {
    renderWithProviders(
      <FormField label="Amount" hint="In rupees" error="Amount is required" required>
        {(field) => <Input {...field} />}
      </FormField>,
    );
    const input = screen.getByLabelText(/Amount/);
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toBeRequired();
    expect(input).toHaveAccessibleDescription('In rupees Amount is required');
  });

  it('is not marked invalid without an error', () => {
    renderWithProviders(<FormField label="Name">{(field) => <Input {...field} />}</FormField>);
    expect(screen.getByLabelText('Name')).not.toHaveAttribute('aria-invalid');
  });
});

function ConfirmHarness({ onConfirm }: { onConfirm: (reason: string) => Promise<void> }) {
  const [open, setOpen] = useState(true);
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={setOpen}
      title="Reject contribution?"
      description="The contribution will be marked rejected."
      confirmLabel="Reject"
      tone="danger"
      requireReason
      onConfirm={onConfirm}
    />
  );
}

describe('ConfirmDialog', () => {
  it('requires an audit reason before confirming', async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    const { user } = renderWithProviders(<ConfirmHarness onConfirm={onConfirm} />);

    await user.click(screen.getByRole('button', { name: 'Reject' }));
    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.getByText(/at least 5 characters/)).toBeInTheDocument();

    await user.type(screen.getByLabelText(/Reason/), '  Duplicate entry  ');
    await user.click(screen.getByRole('button', { name: 'Reject' }));

    await waitFor(() => expect(onConfirm).toHaveBeenCalledWith('Duplicate entry'));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('locks while the action is running and prevents double submit', async () => {
    let resolve!: () => void;
    const onConfirm = vi.fn(() => new Promise<void>((r) => (resolve = r)));
    const { user } = renderWithProviders(<ConfirmHarness onConfirm={onConfirm} />);

    await user.type(screen.getByLabelText(/Reason/), 'Bank reversed');
    await user.click(screen.getByRole('button', { name: 'Reject' }));

    const confirmBtn = screen.getByRole('button', { name: 'Reject' });
    expect(confirmBtn).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    await user.click(confirmBtn);
    expect(onConfirm).toHaveBeenCalledTimes(1);

    resolve();
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('stays open with a safe message if the action fails (raw error hidden)', async () => {
    const onConfirm = vi.fn().mockRejectedValue(new Error('duplicate key value violates constraint'));
    const { user } = renderWithProviders(<ConfirmHarness onConfirm={onConfirm} />);
    await user.type(screen.getByLabelText(/Reason/), 'Some reason');
    await user.click(screen.getByRole('button', { name: 'Reject' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/could not be completed/i);
    expect(screen.queryByText(/duplicate key/)).toBeNull();
    expect(screen.getByRole('button', { name: 'Reject' })).toBeEnabled();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('shows UserFacingError messages verbatim', async () => {
    const onConfirm = vi
      .fn()
      .mockRejectedValue(new UserFacingError('This contribution was already verified.'));
    const { user } = renderWithProviders(<ConfirmHarness onConfirm={onConfirm} />);
    await user.type(screen.getByLabelText(/Reason/), 'Some reason');
    await user.click(screen.getByRole('button', { name: 'Reject' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('This contribution was already verified.');
  });
});

function ToastTrigger() {
  const { toast } = useToast();
  return (
    <>
      <button onClick={() => toast({ title: 'Saved' })}>ok</button>
      <button onClick={() => toast({ title: 'Failed', tone: 'error' })}>fail</button>
    </>
  );
}

describe('Toast', () => {
  it('announces success as status and errors as alert', async () => {
    const { user } = renderWithProviders(<ToastTrigger />);
    await user.click(screen.getByRole('button', { name: 'ok' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Saved');
    await user.click(screen.getByRole('button', { name: 'fail' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Failed');
  });
});
