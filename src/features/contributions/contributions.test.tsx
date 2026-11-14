import { screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  executedQueries,
  hasOp,
  makeProfile,
  mockQuery,
  mockSignedIn,
  opArgs,
  supabaseMock,
} from '../../../tests/mocks/supabase';
import { renderRoute } from '../../../tests/utils';
import { describeContributionEntry } from './logic';
import { normaliseAmount, recordContributionSchema } from './schemas';
import type { ContributionRow } from './types';

const ADMIN = makeProfile({
  id: '00000000-0000-4000-8000-0000000000a1',
  role: 'admin',
  full_name: 'Asha Admin',
});
const CLIENT_ID = '00000000-0000-4000-8000-0000000000c1';
const CYCLE_ID = '00000000-0000-4000-8000-00000000cc01';
const CONTRIB_ID = '00000000-0000-4000-8000-0000000000d1';

const row = (o: Partial<ContributionRow> = {}): ContributionRow => ({
  id: CONTRIB_ID,
  cycle_id: CYCLE_ID,
  cycle_name: 'FY27 Growth Cycle',
  cycle_status: 'open',
  client_id: CLIENT_ID,
  client_name: 'Sagar (fictional)',
  client_email: 'sagar@example.test',
  amount: '150000.00',
  received_at: '2026-11-12T04:30:00Z',
  method: 'cheque',
  reference_number: 'CHQ-000123',
  notes: 'Deposited at branch',
  status: 'pending',
  applicable_nav: null,
  units_issued: null,
  verified_at: null,
  rejected_at: null,
  rejection_reason: null,
  reversed_at: null,
  reversal_reason: null,
  locked_fee_rate: null,
  reference_hwm: null,
  created_at: '2026-11-12T05:00:00Z',
  ...o,
});

function mockRegister(r: ContributionRow) {
  mockQuery((table, ops) => {
    if (table === 'contribution_register' && hasOp(ops, 'maybeSingle')) return { data: r, error: null };
    if (table === 'contribution_register') return { data: [r], error: null, count: 1 };
    if (table === 'audit_logs') return { data: [], error: null };
    return undefined;
  });
}

// ------------------------------------------------------------------------------------------------
describe('form rules', () => {
  it('accepts Indian grouping and rejects sub-paise amounts', () => {
    expect(normaliseAmount('₹ 1,50,000.50')).toBe('150000.50');
    const base = {
      clientId: CLIENT_ID,
      cycleId: CYCLE_ID,
      receivedAt: '2026-01-01T10:00',
      method: 'upi' as const,
      reference: '',
      notes: '',
    };
    expect(recordContributionSchema.safeParse({ ...base, amount: '1,00,000' })).toMatchObject({
      success: true,
      data: { amount: '100000' },
    });
    expect(recordContributionSchema.safeParse({ ...base, amount: '100.005' }).success).toBe(false);
    expect(recordContributionSchema.safeParse({ ...base, amount: '0' }).success).toBe(false);
    expect(
      recordContributionSchema.safeParse({ ...base, amount: '10', receivedAt: '2999-01-01T00:00' }).success,
    ).toBe(false);
  });

  it('describes audit entries', () => {
    expect(
      describeContributionEntry({
        action: 'contribution.verified',
        before_data: null,
        after_data: { units_issued: '1363.63636363', applicable_nav: '110.00000000', fee_rate: '0.200000' },
      }),
    ).toBe('Verified: 1,363.63636363 units issued at NAV ₹110.00000000');
  });
});

// ------------------------------------------------------------------------------------------------
describe('ContributionsPage', () => {
  beforeEach(() => mockSignedIn(ADMIN));

  it('lists contributions and filters by status', async () => {
    mockRegister(row());
    mockQuery((table) => (table === 'cycle_overview' ? { data: [], error: null } : undefined));
    const { user } = renderRoute('/admin/contributions');
    expect((await screen.findAllByText('Sagar (fictional)')).length).toBeGreaterThan(0);
    expect(screen.getAllByText('₹1,50,000.00').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Pending').length).toBeGreaterThan(0);

    await user.selectOptions(screen.getByLabelText('Status'), 'pending');
    await waitFor(() =>
      expect(
        executedQueries.some(
          (q) =>
            q.table === 'contribution_register' &&
            q.ops.some((o) => o.method === 'eq' && o.args[1] === 'pending'),
        ),
      ).toBe(true),
    );
  });

  it('records a contribution as pending with exact string amounts', async () => {
    mockQuery((table, ops) => {
      if (table === 'contribution_register') return { data: [], error: null, count: 0 };
      if (table === 'profiles' && hasOp(ops, 'limit'))
        return {
          data: [{ id: CLIENT_ID, full_name: 'Sagar (fictional)', email: 'sagar@example.test' }],
          error: null,
        };
      if (table === 'cycle_overview' && hasOp(ops, 'in'))
        return {
          data: [{ id: CYCLE_ID, name: 'FY27 Growth Cycle', base_nav: '110.00000000', status: 'open' }],
          error: null,
        };
      if (table === 'cycle_overview') return { data: [], error: null };
      return undefined;
    });
    supabaseMock.rpc.mockResolvedValueOnce({ data: CONTRIB_ID, error: null });

    const { user, router } = renderRoute('/admin/contributions');
    await user.click((await screen.findAllByRole('button', { name: 'Record contribution' }))[0]!);
    const dialog = await screen.findByRole('dialog', { name: 'Record contribution' });

    await waitFor(() => expect(within(dialog).getByRole('option', { name: /Sagar/ })).toBeInTheDocument());
    await user.selectOptions(within(dialog).getByLabelText(/Client/), CLIENT_ID);
    await user.selectOptions(within(dialog).getByLabelText(/^Cycle/), CYCLE_ID);
    await user.type(within(dialog).getByLabelText(/Amount received/), '1,50,000');
    expect(within(dialog).getByText(/Estimate:/)).toHaveTextContent('1,363.63636363');
    await user.selectOptions(within(dialog).getByLabelText(/Payment method/), 'cheque');
    await user.type(within(dialog).getByLabelText(/Reference/), 'CHQ-000123');
    const receivedAt = (within(dialog).getByLabelText(/Received on/) as HTMLInputElement).value;
    await user.click(within(dialog).getByRole('button', { name: 'Record as pending' }));

    await waitFor(() =>
      expect(supabaseMock.rpc).toHaveBeenCalledWith('admin_record_contribution', {
        p_cycle_id: CYCLE_ID,
        p_client_id: CLIENT_ID,
        p_amount: '150000',
        p_received_at: `${receivedAt}:00+05:30`,
        p_method: 'cheque',
        p_reference: 'CHQ-000123',
        p_notes: '',
      }),
    );
    await waitFor(() => expect(router.state.location.pathname).toBe(`/admin/contributions/${CONTRIB_ID}`));
  });
});

// ------------------------------------------------------------------------------------------------
describe('ContributionDetailPage', () => {
  beforeEach(() => mockSignedIn(ADMIN));

  it('verifies using the server preview and a mandatory note', async () => {
    mockRegister(row());
    supabaseMock.rpc.mockImplementation(async (fn: string) => {
      if (fn === 'admin_preview_verification')
        return {
          data: [
            {
              applicable_nav: '110.00000000',
              units: '1363.63636363',
              fee_rate: '0.200000',
              fee_version: 1,
              nav_date: '2026-11-11T10:00:00Z',
            },
          ],
          error: null,
        };
      if (fn === 'admin_verify_contribution')
        return {
          data: [{ applicable_nav: '110.00000000', units: '1363.63636363', fee_rate: '0.200000' }],
          error: null,
        };
      return { data: null, error: null };
    });

    const { user } = renderRoute(`/admin/contributions/${CONTRIB_ID}`);
    expect(
      await screen.findByRole('heading', { level: 1, name: /₹1,50,000.00 from Sagar/ }),
    ).toBeInTheDocument();
    expect(screen.getByText('Deposited at branch')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Verify & issue units' }));
    const dialog = await screen.findByRole('dialog', { name: /Verify contribution/ });
    expect(await within(dialog).findByText('1,363.63636363')).toBeInTheDocument();
    expect(within(dialog).getByText('₹110.00000000')).toBeInTheDocument();
    // The NAV date used is shown (previous-day rule); the performance fee is not part of verification.
    expect(within(dialog).getByText(/Published NAV as of 11 Nov 2026/)).toBeInTheDocument();
    expect(within(dialog).getByText(/gets the NAV published for the day before/)).toBeInTheDocument();
    expect(within(dialog).queryByText(/20\.00%/)).toBeNull();

    await user.click(within(dialog).getByRole('button', { name: 'Verify & issue units' }));
    expect(supabaseMock.rpc).not.toHaveBeenCalledWith('admin_verify_contribution', expect.anything());

    await user.type(within(dialog).getByLabelText(/Verification note/), 'Cheque cleared on 12 Nov');
    await user.click(within(dialog).getByRole('button', { name: 'Verify & issue units' }));
    await waitFor(() =>
      expect(supabaseMock.rpc).toHaveBeenCalledWith('admin_verify_contribution', {
        p_contribution_id: CONTRIB_ID,
        p_reason: 'Cheque cleared on 12 Nov',
      }),
    );
    expect(await screen.findByText('1,363.63636363 units issued.')).toBeInTheDocument();
  });

  it('shows a clear message when the server refuses (e.g. already verified)', async () => {
    mockRegister(row());
    supabaseMock.rpc.mockImplementation(async (fn: string) => {
      if (fn === 'admin_preview_verification')
        return {
          data: [
            {
              applicable_nav: '110',
              units: '1363.63636363',
              fee_rate: '0.2',
              fee_version: 1,
              nav_date: null,
            },
          ],
          error: null,
        };
      return {
        data: null,
        error: {
          code: '23514',
          message: 'This contribution is already verified and cannot be verified again.',
        },
      };
    });
    const { user } = renderRoute(`/admin/contributions/${CONTRIB_ID}`);
    await user.click(await screen.findByRole('button', { name: 'Verify & issue units' }));
    const dialog = await screen.findByRole('dialog', { name: /Verify contribution/ });
    await within(dialog).findByText('1,363.63636363');
    await user.type(within(dialog).getByLabelText(/Verification note/), 'Second attempt');
    await user.click(within(dialog).getByRole('button', { name: 'Verify & issue units' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('already verified');
  });

  it('rejects a pending contribution with a reason', async () => {
    mockRegister(row());
    const { user } = renderRoute(`/admin/contributions/${CONTRIB_ID}`);
    await user.click(await screen.findByRole('button', { name: 'Reject' }));
    const dialog = await screen.findByRole('dialog', { name: 'Reject this contribution?' });
    await user.type(within(dialog).getByLabelText(/Reason/), 'Cheque bounced');
    await user.click(within(dialog).getByRole('button', { name: 'Reject' }));
    await waitFor(() =>
      expect(supabaseMock.rpc).toHaveBeenCalledWith('admin_reject_contribution', {
        p_contribution_id: CONTRIB_ID,
        p_reason: 'Cheque bounced',
      }),
    );
  });

  it('shows the issued units and reverses a verified contribution', async () => {
    mockRegister(
      row({
        status: 'verified',
        applicable_nav: '110.00000000',
        units_issued: '1363.63636363',
        locked_fee_rate: '0.200000',
        reference_hwm: '110.00000000',
        verified_at: '2026-11-12T06:00:00Z',
      }),
    );
    const { user } = renderRoute(`/admin/contributions/${CONTRIB_ID}`);
    expect(await screen.findByText('1,363.63636363')).toBeInTheDocument();
    expect(screen.getByText('₹110.00000000')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Verify & issue units' })).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Reverse' }));
    const dialog = await screen.findByRole('dialog', { name: 'Reverse this contribution?' });
    expect(within(dialog).getByText(/removes 1,363.63636363 units/)).toBeInTheDocument();
    await user.type(within(dialog).getByLabelText(/Reason/), 'Bank recalled the transfer');
    await user.click(within(dialog).getByRole('button', { name: 'Reverse contribution' }));
    await waitFor(() =>
      expect(supabaseMock.rpc).toHaveBeenCalledWith('admin_reverse_contribution', {
        p_contribution_id: CONTRIB_ID,
        p_reason: 'Bank recalled the transfer',
      }),
    );
  });

  it('blocks verification when the cycle no longer accepts contributions', async () => {
    mockRegister(row({ cycle_status: 'closed' }));
    renderRoute(`/admin/contributions/${CONTRIB_ID}`);
    expect(await screen.findByRole('button', { name: 'Verify & issue units' })).toBeDisabled();
    expect(screen.getByText(/Units can only be issued while it is open or active/)).toBeInTheDocument();
  });
});

describe('integration into other pages', () => {
  beforeEach(() => mockSignedIn(ADMIN));

  it('cycle page shows unit totals from the ledger', async () => {
    mockQuery((table, ops) => {
      if (table === 'cycle_unit_summary')
        return {
          data: {
            cycle_id: CYCLE_ID,
            outstanding_units: '1839.82683982',
            net_contributed: '200000.00',
            pending_count: 2,
            pending_amount: '7500.00',
            investor_count: 2,
          },
          error: null,
        };
      if (table === 'cycle_overview' && hasOp(ops, 'maybeSingle'))
        return {
          data: {
            id: CYCLE_ID,
            name: 'FY27 Growth Cycle',
            description: null,
            start_date: '2026-12-01',
            end_date: '2027-11-30',
            status: 'open',
            base_nav: '100.00000000',
            currency: 'INR',
            created_at: '2026-11-12T10:00:00Z',
            updated_at: '2026-11-12T10:00:00Z',
            current_fee_rate: '0.200000',
            current_fee_version: 1,
            current_fee_effective_from: '2026-11-12T10:00:00Z',
            pending_fee_rate: null,
            pending_fee_version: null,
            pending_fee_effective_from: null,
          },
          error: null,
        };
      return undefined;
    });
    renderRoute(`/admin/cycles/${CYCLE_ID}`);
    expect(await screen.findByText('1,839.8268')).toBeInTheDocument();
    expect(screen.getByText('₹2,00,000.00')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '2 to review' })).toHaveAttribute(
      'href',
      `/admin/contributions?status=pending&cycle=${CYCLE_ID}`,
    );
    const q = executedQueries.find((e) => e.table === 'cycle_unit_summary');
    expect(opArgs(q!.ops, 'eq')).toEqual(['cycle_id', CYCLE_ID]);
  });
});
