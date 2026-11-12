import { screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  executedQueries,
  hasOp,
  makeProfile,
  mockQuery,
  mockSignedIn,
  supabaseMock,
  type QueryOp,
} from '../../../tests/mocks/supabase';
import { renderRoute } from '../../../tests/utils';
import { slug, toCsv } from '@/lib/csv';

const ADMIN = makeProfile({
  id: '00000000-0000-4000-8000-0000000000a1',
  role: 'admin',
  full_name: 'Asha Admin',
  email: 'asha@example.test',
});
const CYCLE_ID = '00000000-0000-4000-8000-00000000cc01';
const CLIENT_A = '00000000-0000-4000-8000-0000000000c1';
const CLIENT_B = '00000000-0000-4000-8000-0000000000c2';
const SNAP_ID = '00000000-0000-4000-8000-0000000000f1';

const cycleRow = {
  id: CYCLE_ID,
  name: 'FY27 Growth Cycle',
  description: null,
  start_date: '2026-12-01',
  end_date: '2027-11-30',
  status: 'active',
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
};

const registerRow = {
  id: 'r1',
  cycle_id: CYCLE_ID,
  cycle_name: 'FY27 Growth Cycle',
  cycle_status: 'active',
  client_id: CLIENT_A,
  client_name: 'Rahul (fictional)',
  client_email: 'rahul@example.test',
  amount: '100000.00',
  received_at: '2026-11-01T10:00:00Z',
  method: 'bank_transfer',
  reference_number: 'UTR-1',
  notes: '=cmd|calc',
  status: 'verified',
  applicable_nav: '100.00000000',
  units_issued: '1000.00000000',
  verified_at: '2026-11-02T10:00:00Z',
  rejected_at: null,
  rejection_reason: null,
  reversed_at: null,
  reversal_reason: null,
  locked_fee_rate: '0.200000',
  reference_hwm: '100.00000000',
  created_at: '2026-11-01T10:05:00Z',
};

const snapshot = {
  id: SNAP_ID,
  cycle_id: CYCLE_ID,
  valuation_id: 'v1',
  nav_date: '2026-11-12T09:30:00Z',
  total_outstanding_units: '1500.00000000',
  gross_net_asset_value: '174000.00',
  gross_nav_per_unit: '116.00000000',
  net_nav_per_unit: '112.80000000',
  performance_fee_amount: '4800.00',
  calculation_version: 'per_lot_hwm_v1',
  status: 'published',
  corrects_snapshot_id: null,
  corrected_by_snapshot_id: null,
  calculated_at: '2026-11-12T09:40:00Z',
  published_at: '2026-11-12T09:45:00Z',
  publish_reason: 'Demo',
  corrected_at: null,
};

const lot = (client: string, name: string, fee: string) => ({
  id: `l-${client}`,
  snapshot_id: SNAP_ID,
  client_id: client,
  client_name: name,
  client_email: `${name.split(' ')[0]!.toLowerCase()}@example.test`,
  contribution_id: `d-${client}`,
  received_at: '2026-11-01T10:00:00Z',
  contributed_amount: '100000.00',
  units: '1000.00000000',
  entry_nav: '100.00000000',
  reference_hwm: '100.00000000',
  fee_rate: '0.200000',
  gross_nav_per_unit: '116.00000000',
  gross_value: '116000.00',
  eligible_profit_per_unit: '16.00000000',
  fee_amount: fee,
  net_value: '112800.00',
  loss_to_recover: '0.00',
});

const audit = [
  {
    id: 'a1',
    seq: 42,
    action: 'contribution.verified',
    entity_type: 'contribution',
    entity_id: 'r1',
    actor_id: ADMIN.id,
    before_data: { status: 'pending' },
    after_data: { units_issued: '1000.00000000', applicable_nav: '100.00000000', fee_rate: '0.200000' },
    reason: 'Matched bank statement',
    created_at: '2026-11-02T10:00:00Z',
    actor: { full_name: 'Asha Admin', email: ADMIN.email },
  },
];

const people = [
  { id: ADMIN.id, full_name: 'Asha Admin', email: ADMIN.email, role: 'admin', status: 'active' },
  {
    id: '00000000-0000-4000-8000-0000000000a2',
    full_name: 'Second Admin',
    email: 'b@example.test',
    role: 'admin',
    status: 'active',
  },
  {
    id: CLIENT_A,
    full_name: 'Rahul (fictional)',
    email: 'rahul@example.test',
    role: 'client',
    status: 'active',
  },
  {
    id: CLIENT_B,
    full_name: 'Amit (fictional)',
    email: 'amit@example.test',
    role: 'client',
    status: 'active',
  },
];

const created: Blob[] = [];

function mockReports() {
  mockQuery((table: string, ops: QueryOp[]) => {
    if (table === 'cycle_overview') return { data: [cycleRow], error: null };
    if (table === 'contribution_register') return { data: [registerRow], error: null, count: 1 };
    if (table === 'nav_snapshots') return { data: [snapshot], error: null };
    if (table === 'lot_fee_accrual_report')
      return {
        data: [lot(CLIENT_A, 'Rahul (fictional)', '3200.00'), lot(CLIENT_B, 'Amit (fictional)', '1600.00')],
        error: null,
      };
    if (table === 'audit_logs') return { data: audit, error: null, count: 1 };
    if (table === 'profiles' && hasOp(ops, 'limit')) return { data: people, error: null };
    return undefined;
  });
}

beforeEach(() => {
  mockSignedIn(ADMIN);
  mockReports();
  created.length = 0;
  (URL as unknown as { createObjectURL: (b: Blob) => string }).createObjectURL = (b: Blob) => {
    created.push(b);
    return 'blob:test';
  };
  (URL as unknown as { revokeObjectURL: () => void }).revokeObjectURL = () => {};
});

describe('csv helpers', () => {
  it('neutralises formulas and builds safe file names', () => {
    expect(toCsv(['n'], [['=cmd|calc'], [-5]])).toBe("n\r\n'=cmd|calc\r\n-5\r\n");
    expect(slug('FY 2026–27 Growth!')).toBe('fy-2026-27-growth');
  });
});

describe('Reports', () => {
  it('contribution register filters by status and date (IST) and exports safe CSV', async () => {
    const { user } = renderRoute('/admin/reports');
    expect(await screen.findByText('Rahul (fictional)')).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText('Status'), 'verified');
    await user.type(screen.getByLabelText('From (IST)'), '2026-11-01');
    await user.type(screen.getByLabelText('To (IST)'), '2026-11-30');
    await waitFor(() => {
      const q = executedQueries.filter((e) => e.table === 'contribution_register').at(-1)!;
      expect(q.ops).toEqual(
        expect.arrayContaining([
          { method: 'eq', args: ['status', 'verified'] },
          { method: 'gte', args: ['received_at', '2026-11-01T00:00:00+05:30'] },
          { method: 'lt', args: ['received_at', '2026-12-01T00:00:00+05:30'] },
        ]),
      );
    });
    await user.click(screen.getByRole('button', { name: 'Download CSV' }));
    await waitFor(() => expect(created).toHaveLength(1));
    const text = await created[0]!.text();
    expect(text).toContain("'=cmd|calc");
    expect(text).toContain('UTR-1');
  });

  it('client statement shows only the chosen client’s lots', async () => {
    const { user } = renderRoute('/admin/reports?tab=statement');
    await screen.findByRole('option', { name: /Rahul/ });
    await user.selectOptions(screen.getByLabelText('Client'), CLIENT_A);
    await screen.findByRole('option', { name: /FY27 Growth Cycle/ });
    await user.selectOptions(screen.getByLabelText('Cycle'), CYCLE_ID);
    expect(await screen.findByRole('heading', { name: 'Investment statement' })).toBeInTheDocument();
    const lots = await screen.findByRole('table', { name: 'Valued lots' });
    expect(within(lots).getByText('₹3,200.00')).toBeInTheDocument();
    expect(within(lots).queryByText('₹1,600.00')).toBeNull();
  });

  it('NAV history and performance-fee reports list published data', async () => {
    const { user, unmount } = renderRoute('/admin/reports?tab=nav');
    expect(await screen.findByText('Choose the filters above.')).toBeInTheDocument();
    await screen.findByRole('option', { name: /FY27 Growth Cycle/ });
    await user.selectOptions(screen.getByLabelText('Cycle'), CYCLE_ID);
    expect(await screen.findByText('₹116.0000')).toBeInTheDocument();
    unmount();

    const r = renderRoute('/admin/reports?tab=fees');
    await screen.findByRole('option', { name: /FY27 Growth Cycle/ });
    await r.user.selectOptions(screen.getByLabelText('Cycle'), CYCLE_ID);
    expect(await screen.findByText(/Total indicative fee/)).toHaveTextContent('₹4,800.00');
  });

  it('audit log filters, explains entries and shows before/after details', async () => {
    const { user } = renderRoute('/admin/reports?tab=audit');
    expect(
      await screen.findByRole('link', { name: /Verified: 1,000.00000000 units issued at NAV ₹100.00000000/ }),
    ).toHaveAttribute('href', '/admin/contributions/r1');
    expect(screen.getByText('Reason: Matched bank statement')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Details' }));
    expect(screen.getByText(/"units_issued": "1000.00000000"/)).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText('By'), 'system');
    await waitFor(() => {
      const q = executedQueries.filter((e) => e.table === 'audit_logs').at(-1)!;
      expect(q.ops).toEqual(expect.arrayContaining([{ method: 'is', args: ['actor_id', null] }]));
    });
  });
});

describe('Settings', () => {
  it('lists admins and removes admin access with a reason (not for yourself)', async () => {
    const { user } = renderRoute('/admin/settings');
    expect(await screen.findByText('Second Admin')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Remove admin access' })).toHaveLength(1);
    await user.click(screen.getByRole('button', { name: 'Remove admin access' }));
    const dialog = await screen.findByRole('dialog', { name: /Remove admin access from Second Admin/ });
    await user.type(within(dialog).getByLabelText(/Reason/), 'No longer managing the pool');
    await user.click(within(dialog).getByRole('button', { name: 'Remove admin access' }));
    await waitFor(() =>
      expect(supabaseMock.rpc).toHaveBeenCalledWith('admin_set_user_role', {
        p_user_id: '00000000-0000-4000-8000-0000000000a2',
        p_role: 'client',
        p_reason: 'No longer managing the pool',
      }),
    );
  });

  it('grants admin access to an active client', async () => {
    const { user } = renderRoute('/admin/settings');
    await user.click(await screen.findByRole('button', { name: 'Grant admin access' }));
    const dialog = await screen.findByRole('dialog', { name: 'Grant administrator access?' });
    expect(within(dialog).getByRole('button', { name: 'Grant admin access' })).toBeDisabled();
    await user.selectOptions(within(dialog).getByLabelText('Person'), CLIENT_B);
    await user.type(within(dialog).getByLabelText(/Reason/), 'Co-manager for the demo');
    await user.click(within(dialog).getByRole('button', { name: 'Grant admin access' }));
    await waitFor(() =>
      expect(supabaseMock.rpc).toHaveBeenCalledWith('admin_set_user_role', {
        p_user_id: CLIENT_B,
        p_role: 'admin',
        p_reason: 'Co-manager for the demo',
      }),
    );
  });
});
