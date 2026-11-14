import { screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  executedQueries,
  hasOp,
  makeProfile,
  mockDb,
  mockQuery,
  mockSignedIn,
  opArgs,
  supabaseMock,
} from '../../../tests/mocks/supabase';
import { renderRoute } from '../../../tests/utils';
import type { ClientActivity, ClientContribution, ClientCycle } from './api';
import { describeClientActivity, holdingRows, returnOn, toCsv } from './logic';

const CLIENT = makeProfile({
  id: '00000000-0000-4000-8000-0000000000c1',
  full_name: 'Rahul (fictional)',
  email: 'rahul@example.test',
});
const CYCLE_ID = '00000000-0000-4000-8000-00000000cc01';

// Owner's example (Module 15): ₹1,00,000 at ₹100; market NAV 130 with a 50% performance fee → the client
// sees NAV ₹115, profit ₹15,000, admin fee ₹1,000 and final profit ₹14,000. No performance fee anywhere.
const cycle = (o: Partial<ClientCycle> = {}): ClientCycle => ({
  cycle_id: CYCLE_ID,
  cycle_name: 'FY27 Growth Cycle',
  cycle_status: 'active',
  start_date: '2026-12-01',
  end_date: '2027-11-30',
  base_nav: '100.00000000',
  units: '1000.00000000',
  net_contributed: '100000.00',
  latest_nav_date: '2026-11-12T09:30:00Z',
  latest_nav: '115.00000000',
  current_value: '115000.00',
  profit: '15000.00',
  admin_fee: '1000.00',
  final_profit: '14000.00',
  final_value: '114000.00',
  ...o,
});

const CONTRIBUTIONS: ClientContribution[] = [
  {
    id: 'd1',
    cycle_id: CYCLE_ID,
    cycle_name: 'FY27 Growth Cycle',
    amount: '100000.00',
    received_at: '2026-11-01T10:00:00Z',
    method: 'bank_transfer',
    reference_number: 'UTR-1',
    status: 'verified',
    applicable_nav: '100.00000000',
    units_issued: '1000.00000000',
    verified_at: '2026-11-02T10:00:00Z',
    rejected_at: null,
    reversed_at: null,
  },
  {
    id: 'd2',
    cycle_id: CYCLE_ID,
    cycle_name: 'FY27 Growth Cycle',
    amount: '2500.00',
    received_at: '2026-11-13T10:00:00Z',
    method: 'cheque',
    reference_number: null,
    status: 'pending',
    applicable_nav: null,
    units_issued: null,
    verified_at: null,
    rejected_at: null,
    reversed_at: null,
  },
];

const ACTIVITY: ClientActivity[] = [
  {
    occurred_at: '2026-11-12T10:00:00Z',
    kind: 'nav_published',
    cycle_name: 'FY27 Growth Cycle',
    amount: null,
    units: null,
    nav: '115.00000000',
  },
  {
    occurred_at: '2026-11-02T10:00:00Z',
    kind: 'units_issued',
    cycle_name: 'FY27 Growth Cycle',
    amount: '100000.00',
    units: '1000.00000000',
    nav: '100.00000000',
  },
];

function mockPortal({ cycles = [cycle()] } = {}) {
  supabaseMock.rpc.mockImplementation(async (fn: string) => {
    switch (fn) {
      case 'client_my_cycles':
        return { data: cycles, error: null };
      case 'client_nav_history':
        return {
          data: [{ nav_date: '2026-11-12T09:30:00Z', nav_per_unit: '115.00000000' }],
          error: null,
        };
      case 'client_my_activity':
        return { data: ACTIVITY, error: null };
      case 'client_my_contributions':
        return { data: CONTRIBUTIONS, error: null };
      default:
        return { data: null, error: null };
    }
  });
}

/** Clients must never see the performance fee or the market (gross) NAV. */
function expectNoPerformanceFee() {
  expect(document.body.textContent).not.toMatch(/performance fee|gross|high-water|130\.00/i);
}

// ------------------------------------------------------------------------------------------------
describe('portal logic', () => {
  it('builds safe CSV (quoting and formula neutralisation)', () => {
    const csv = toCsv(
      ['A', 'B'],
      [
        ['=HYPERLINK("x")', 'a,b'],
        ['-100.50', '@cmd'],
        ['line\nbreak', null],
      ],
    );
    expect(csv).toBe('A,B\r\n"\'=HYPERLINK(""x"")","a,b"\r\n-100.50,\'@cmd\r\n"line\nbreak",\r\n');
  });

  it('values each verified contribution at the current NAV', () => {
    const rows = holdingRows(CONTRIBUTIONS, cycle());
    expect(rows).toHaveLength(1);
    expect(rows[0]!.value.toFixed(2)).toBe('115000.00');
    expect(rows[0]!.profit.toFixed(2)).toBe('15000.00');
    expect(returnOn('14000.00', '100000.00')?.toFixed(6)).toBe('0.140000');
    expect(returnOn('1', '0')).toBeNull();
    // Before the first NAV, holdings are valued at the starting NAV.
    expect(holdingRows(CONTRIBUTIONS, cycle({ latest_nav: null }))[0]!.profit.toFixed(2)).toBe('0.00');
  });

  it('describes activity in plain language', () => {
    expect(describeClientActivity(ACTIVITY[1]!)).toBe(
      'Contribution verified — units issued: ₹1,00,000.00 → 1,000.00000000 units at ₹100.0000',
    );
  });
});

// ------------------------------------------------------------------------------------------------
describe('client portal pages', () => {
  beforeAll(async () => {
    await import('@/features/nav/components/NavHistoryChart');
  }, 30_000);
  beforeEach(() => mockSignedIn(CLIENT));

  it('overview shows the client’s own position and disclaimer', async () => {
    mockPortal();
    renderRoute('/client/overview');
    const figures = await screen.findByRole('region', { name: 'Your investment' });
    expect(within(figures).getByText('₹1,00,000.00')).toBeInTheDocument();
    expect(within(figures).getByText('1,000.0000')).toBeInTheDocument();
    expect(within(figures).getByText('₹115.0000')).toBeInTheDocument();
    expect(within(figures).getByText('₹1,15,000.00')).toBeInTheDocument();
    expect(within(figures).getByText('+₹15,000.00')).toBeInTheDocument();
    expect(within(figures).getByText('₹1,000.00')).toBeInTheDocument();
    expect(within(figures).getByText('+₹14,000.00')).toBeInTheDocument();
    expect(within(figures).getByText('+14.00%')).toBeInTheDocument();
    // Portal disclaimer (in addition to the site-wide footer notice).
    expect(screen.getByText(/admin fee is shown for information/)).toBeInTheDocument();
    expect(supabaseMock.rpc).toHaveBeenCalledWith('client_nav_history', { p_cycle_id: CYCLE_ID });
    expectNoPerformanceFee();
    // The portal never queries admin tables directly.
    expect(
      executedQueries.some((q) => ['contributions', 'nav_snapshots', 'lot_fee_accruals'].includes(q.table)),
    ).toBe(false);
  });

  it('shows pending money before the first verification', async () => {
    mockPortal({ cycles: [] });
    renderRoute('/client/overview');
    expect(await screen.findByRole('heading', { name: 'No verified investment yet' })).toBeInTheDocument();
    expect(await screen.findByText(/₹2,500.00 received/)).toBeInTheDocument();
  });

  it('my investment values each contribution and explains the admin fee', async () => {
    mockPortal();
    renderRoute('/client/investment');
    expect(await screen.findByRole('cell', { name: '₹1,15,000.00' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: '+₹15,000.00' })).toBeInTheDocument();
    expect(screen.getByText(/so your final profit/)).toHaveTextContent('₹1,000.00');
    expect(screen.getByText(/so your final profit/)).toHaveTextContent('+₹14,000.00');
    expect(screen.getByRole('heading', { name: 'Awaiting verification' })).toBeInTheDocument();
    expectNoPerformanceFee();
  });

  it('activity lists own events', async () => {
    mockPortal();
    renderRoute('/client/activity');
    expect(await screen.findByText(/NAV published: ₹115.0000 per unit$/)).toBeInTheDocument();
  });

  describe('statements', () => {
    const created: Blob[] = [];
    beforeEach(() => {
      created.length = 0;
      (URL as unknown as { createObjectURL: (b: Blob) => string }).createObjectURL = (b: Blob) => {
        created.push(b);
        return 'blob:test';
      };
      (URL as unknown as { revokeObjectURL: () => void }).revokeObjectURL = () => {};
    });
    afterEach(() => vi.restoreAllMocks());

    it('renders a printable statement and downloads the client’s own CSV', async () => {
      mockPortal();
      const print = vi.spyOn(window, 'print').mockImplementation(() => {});
      const { user } = renderRoute('/client/statements');
      expect(await screen.findByRole('heading', { name: 'Investment statement' })).toBeInTheDocument();
      expect(screen.getByText(/not an official account statement/)).toBeInTheDocument();
      expectNoPerformanceFee();

      await user.click(screen.getByRole('button', { name: 'Print / save as PDF' }));
      expect(print).toHaveBeenCalled();

      await user.click(screen.getByRole('button', { name: 'Download CSV' }));
      expect(created).toHaveLength(1);
      const text = await created[0]!.text();
      expect(text).toContain('Rahul (fictional)');
      expect(text).toContain('115000.00');
      expect(text).toContain('14000.00');
      expect(text).toContain('UTR-1');
      expect(text).toContain('not live market data');
      expect(text).not.toMatch(/performance|fee rate|gross/i);
    });
  });

  it('profile edits own name/phone and changes the password', async () => {
    mockPortal();
    mockQuery((table, ops) =>
      table === 'profiles' && hasOp(ops, 'update') ? { data: [{ id: CLIENT.id }], error: null } : undefined,
    );
    const { user } = renderRoute('/client/profile');
    const phone = await screen.findByLabelText(/Phone/);
    await user.type(phone, '+91 98765 43210');
    await user.click(screen.getByRole('button', { name: 'Save details' }));
    await waitFor(() => {
      const upd = executedQueries.find((q) => hasOp(q.ops, 'update'));
      expect(opArgs(upd!.ops, 'update')).toEqual([
        { full_name: 'Rahul (fictional)', phone: '+91 98765 43210' },
      ]);
    });

    await user.type(screen.getByLabelText(/^New password/), 'MyOwnPass2027');
    await user.type(screen.getByLabelText('Confirm new password'), 'MyOwnPass2027');
    await user.click(screen.getByRole('button', { name: 'Update password' }));
    await waitFor(() =>
      expect(supabaseMock.auth.updateUser).toHaveBeenCalledWith({ password: 'MyOwnPass2027' }),
    );
    await waitFor(() =>
      expect(supabaseMock.rpc.mock.calls.some((call) => call[0] === 'complete_password_change')).toBe(true),
    );
  });
});

// ------------------------------------------------------------------------------------------------
describe('forced password change', () => {
  it('sends a client with a temporary password to set their own before anything else', async () => {
    mockSignedIn({ ...CLIENT, must_change_password: true });
    mockPortal();
    const base = supabaseMock.rpc.getMockImplementation()!;
    supabaseMock.rpc.mockImplementation(async (fn: string, args?: Record<string, unknown>) => {
      if (fn === 'complete_password_change') {
        mockDb.profile = { ...mockDb.profile!, must_change_password: false };
        return { data: null, error: null };
      }
      return base(fn, args);
    });

    const { user, router } = renderRoute('/client/statements');
    await waitFor(() => expect(router.state.location.pathname).toBe('/change-password'));
    expect(screen.queryByRole('navigation', { name: /^Client/ })).toBeNull();

    await user.type(await screen.findByLabelText(/^New password/), 'MyOwnPass2027');
    await user.type(screen.getByLabelText('Confirm new password'), 'MyOwnPass2027');
    await user.click(screen.getByRole('button', { name: 'Save password and continue' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/client/overview'));
    expect(supabaseMock.auth.updateUser).toHaveBeenCalledWith({ password: 'MyOwnPass2027' });
  });
});
