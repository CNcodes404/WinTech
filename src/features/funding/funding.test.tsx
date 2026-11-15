import { screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { hasOp, makeProfile, mockQuery, mockSignedIn, supabaseMock } from '../../../tests/mocks/supabase';
import { renderRoute } from '../../../tests/utils';
import { upiPayLink } from './config';

const CYCLE_ID = '00000000-0000-4000-8000-00000000cc01';
const REQ_ID = '00000000-0000-4000-8000-0000000000b1';
const CONTRIB_ID = '00000000-0000-4000-8000-0000000000d1';

describe('client: add funds', () => {
  beforeEach(() => {
    mockSignedIn(makeProfile({ role: 'client', full_name: 'Rahul (fictional)' }));
    supabaseMock.rpc.mockImplementation(async (fn: string) => {
      if (fn === 'client_open_cycles')
        return {
          data: [
            {
              cycle_id: CYCLE_ID,
              cycle_name: 'FY27 Growth Cycle',
              cycle_status: 'open',
              start_date: '2026-12-01',
              end_date: '2027-11-30',
              base_nav: '100.00000000',
            },
          ],
          error: null,
        };
      if (fn === 'client_my_payment_requests')
        return {
          data: [
            {
              id: REQ_ID,
              cycle_id: CYCLE_ID,
              cycle_name: 'FY27 Growth Cycle',
              amount: '2500.00',
              paid_at: '2026-11-14T05:00:00Z',
              method: 'bank_transfer',
              payer_upi_id: null,
              transaction_ref: 'NEFT-998877',
              status: 'rejected',
              review_reason: 'No matching credit found in the bank statement',
              reviewed_at: '2026-11-14T08:00:00Z',
              created_at: '2026-11-14T06:00:00Z',
            },
          ],
          error: null,
        };
      return { data: null, error: null };
    });
  });

  it('shows the (demo) QR code and UPI ID to pay', async () => {
    renderRoute('/client/add-funds');
    expect(await screen.findByRole('img', { name: /UPI QR code to pay WINTECH \(demo\)/ })).toHaveAttribute(
      'src',
      '/payment-qr-demo.svg',
    );
    expect(screen.getByText('wintech.demo@upi')).toBeInTheDocument();
    expect(screen.getByText(/Demo QR code and UPI ID/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Copy/ })).toBeInTheDocument();
    expect(upiPayLink('50000')).toBe(
      'upi://pay?pa=wintech.demo%40upi&pn=WINTECH&cu=INR&am=50000&tn=WINTECH+investment',
    );
  });

  it('requires the payer UPI ID for UPI and submits the payment details', async () => {
    const { user } = renderRoute('/client/add-funds');
    const form = (await screen.findByRole('button', { name: 'Submit payment details' })).closest('form')!;
    await waitFor(() => expect(within(form).getByLabelText(/Investment cycle/)).toHaveValue(CYCLE_ID));
    await user.type(within(form).getByLabelText(/Amount paid/), '50000');
    await user.type(within(form).getByLabelText(/Transaction ID/), 'UTR123456789');
    await user.click(within(form).getByRole('button', { name: 'Submit payment details' }));
    expect(await within(form).findByText(/Enter the UPI ID you paid from/)).toBeInTheDocument();
    expect(supabaseMock.rpc).not.toHaveBeenCalledWith('client_submit_payment_request', expect.anything());

    await user.type(within(form).getByLabelText(/Your UPI ID/), 'rahul@okbank');
    const paidAt = within(form).getByLabelText(/Paid on/);
    await user.clear(paidAt);
    await user.type(paidAt, '2026-11-14T10:30');
    await user.click(within(form).getByRole('button', { name: 'Submit payment details' }));
    await waitFor(() =>
      expect(supabaseMock.rpc).toHaveBeenCalledWith('client_submit_payment_request', {
        p_cycle_id: CYCLE_ID,
        p_amount: '50000',
        p_paid_at: '2026-11-14T10:30:00+05:30',
        p_method: 'upi',
        p_payer_upi_id: 'rahul@okbank',
        p_payer_name: '',
        p_transaction_ref: 'UTR123456789',
        p_note: '',
      }),
    );
    expect(await screen.findByText('Payment details sent')).toBeInTheDocument();
  });

  it('lists my requests with the reason when one is not accepted', async () => {
    renderRoute('/client/add-funds');
    const table = await screen.findByRole('table', { name: 'My payment requests' });
    expect(within(table).getByText('Not accepted')).toBeInTheDocument();
    expect(within(table).getByText(/Note from WINTECH: No matching credit/)).toBeInTheDocument();
  });
});

describe('admin: payment requests', () => {
  const ROW = {
    id: REQ_ID,
    client_id: '00000000-0000-4000-8000-0000000000c1',
    client_name: 'Rahul (fictional)',
    client_email: 'rahul@example.test',
    cycle_id: CYCLE_ID,
    cycle_name: 'FY27 Growth Cycle',
    cycle_status: 'open',
    amount: '50000.00',
    paid_at: '2026-11-14T05:00:00Z',
    method: 'upi',
    payer_upi_id: 'rahul@okbank',
    payer_name: null,
    transaction_ref: 'UTR123456789',
    note: 'Paid via QR',
    status: 'submitted',
    contribution_id: null,
    reviewed_at: null,
    review_reason: null,
    reviewer_name: null,
    created_at: '2026-11-14T06:00:00Z',
  };

  beforeEach(() => {
    mockSignedIn(makeProfile({ role: 'admin' }));
    mockQuery((table, ops) =>
      table === 'payment_request_register' && hasOp(ops, 'select') ? { data: [ROW], error: null } : undefined,
    );
  });

  it('shows the payment details and approves into a contribution to verify', async () => {
    supabaseMock.rpc.mockResolvedValueOnce({ data: CONTRIB_ID, error: null });
    const { user, router } = renderRoute('/admin/payment-requests');
    expect(await screen.findByText('UTR123456789')).toBeInTheDocument();
    expect(screen.getByText('rahul@okbank')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Approve & add contribution' }));
    const dialog = await screen.findByRole('dialog', { name: /Approve ₹50,000.00 from Rahul/ });
    await user.type(within(dialog).getByLabelText(/Verification note/), 'Found in bank statement');
    await user.click(within(dialog).getByRole('button', { name: 'Approve & add contribution' }));
    await waitFor(() =>
      expect(supabaseMock.rpc).toHaveBeenCalledWith('admin_approve_payment_request', {
        p_request_id: REQ_ID,
        p_reason: 'Found in bank statement',
      }),
    );
    await waitFor(() => expect(router.state.location.pathname).toBe(`/admin/contributions/${CONTRIB_ID}`));
  });

  it('rejects with a reason the client will see', async () => {
    const { user } = renderRoute('/admin/payment-requests');
    await user.click(await screen.findByRole('button', { name: 'Reject' }));
    const dialog = await screen.findByRole('dialog', { name: 'Reject this payment request?' });
    expect(within(dialog).getByText(/client will see your reason/)).toBeInTheDocument();
    await user.type(within(dialog).getByLabelText(/Reason/), 'UTR not found');
    await user.click(within(dialog).getByRole('button', { name: 'Reject request' }));
    await waitFor(() =>
      expect(supabaseMock.rpc).toHaveBeenCalledWith('admin_reject_payment_request', {
        p_request_id: REQ_ID,
        p_reason: 'UTR not found',
      }),
    );
  });
});
