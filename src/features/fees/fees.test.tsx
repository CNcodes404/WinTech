import { screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { hasOp, makeProfile, mockQuery, mockSignedIn, supabaseMock } from '../../../tests/mocks/supabase';
import { renderRoute } from '../../../tests/utils';
import { calculateFundLevelNav } from '@/lib/finance';
import type { ClientPosition, LotAccrual } from './api';
import { clientFigures, summariseAccruals, summarisePositions } from './logic';

const ADMIN = makeProfile({
  id: '00000000-0000-4000-8000-0000000000a1',
  role: 'admin',
  full_name: 'Asha Admin',
});
const CYCLE_ID = '00000000-0000-4000-8000-00000000cc01';
const SNAP_ID = '00000000-0000-4000-8000-0000000000f1';

const cycleRow = (status = 'active') => ({
  id: CYCLE_ID,
  name: 'FY27 Growth Cycle',
  description: null,
  start_date: '2026-12-01',
  end_date: '2027-11-30',
  status,
  base_nav: '100.00000000',
  currency: 'INR',
  created_at: '2026-11-12T10:00:00Z',
  updated_at: '2026-11-12T10:00:00Z',
  current_fee_rate: '0.500000',
  current_fee_version: 1,
  current_fee_effective_from: '2026-11-12T10:00:00Z',
  pending_fee_rate: null,
  pending_fee_version: null,
  pending_fee_effective_from: null,
  admin_fee_amount: '1000.00',
});

// Owner's example: ₹1,00,000 at ₹100 → market NAV 130, 50% fee on ₹30,000 profit → NAV 115.
const snapshot = (o: Record<string, unknown> = {}) => ({
  id: SNAP_ID,
  cycle_id: CYCLE_ID,
  valuation_id: '00000000-0000-4000-8000-0000000000e1',
  nav_date: '2026-11-12T09:30:00Z',
  total_outstanding_units: '1000.00000000',
  gross_net_asset_value: '130000.00',
  gross_nav_per_unit: '130.00000000',
  net_nav_per_unit: '115.00000000',
  performance_fee_amount: '15000.00',
  performance_fee_rate: '0.500000',
  net_contributed: '100000.00',
  profit_before_fee: '30000.00',
  calculation_version: 'fund_level_v2',
  status: 'published',
  corrects_snapshot_id: null,
  corrected_by_snapshot_id: null,
  calculated_at: '2026-11-12T09:40:00Z',
  published_at: '2026-11-12T09:45:00Z',
  publish_reason: 'Demo',
  corrected_at: null,
  ...o,
});

const POSITION: ClientPosition = {
  snapshot_id: SNAP_ID,
  client_id: '00000000-0000-4000-8000-0000000000c1',
  client_name: 'Rahul (fictional)',
  client_email: 'rahul@example.test',
  units: '1000.00000000',
  contributed: '100000.00',
  gross_nav_per_unit: '130.00000000',
  net_nav_per_unit: '115.00000000',
  gross_value: '130000.00',
  net_value: '115000.00',
  performance_fee_share: '15000.00',
  profit: '15000.00',
  admin_fee: '1000.00',
  final_profit: '14000.00',
  final_value: '114000.00',
};

const LEGACY_LOT: LotAccrual = {
  id: 'l1',
  snapshot_id: SNAP_ID,
  client_id: '00000000-0000-4000-8000-0000000000c1',
  client_name: 'Rahul (fictional)',
  client_email: 'rahul@example.test',
  contribution_id: '00000000-0000-4000-8000-0000000000d1',
  received_at: '2026-11-01T10:00:00Z',
  contributed_amount: '100000.00',
  units: '1000.00000000',
  entry_nav: '100.00000000',
  reference_hwm: '100.00000000',
  fee_rate: '0.200000',
  gross_nav_per_unit: '116.00000000',
  gross_value: '116000.00',
  eligible_profit_per_unit: '16.00000000',
  fee_amount: '3200.00',
  net_value: '112800.00',
  loss_to_recover: '0.00',
};

function mockFees({
  status = 'active',
  snap = snapshot(),
  crystallisation = null as unknown,
}: { status?: string; snap?: ReturnType<typeof snapshot>; crystallisation?: unknown } = {}) {
  mockQuery((table, ops) => {
    if (table === 'cycle_overview') return { data: [cycleRow(status)], error: null };
    if (table === 'cycle_fee_terms') return { data: [], error: null };
    if (table === 'nav_snapshots' && hasOp(ops, 'maybeSingle')) return { data: snap, error: null };
    if (table === 'nav_snapshots') return { data: [snap], error: null };
    if (table === 'client_position_report') return { data: [POSITION], error: null };
    if (table === 'lot_fee_accrual_report') return { data: [LEGACY_LOT], error: null };
    if (table === 'fee_crystallisations') return { data: crystallisation, error: null };
    if (table === 'portfolio_valuations') return { data: null, error: null };
    if (table === 'audit_logs') return { data: [], error: null };
    return undefined;
  });
}

describe('fee maths (mirrors the database)', () => {
  it('owner example: 100 → 130 at 50% gives NAV 115; admin fee leaves ₹14,000 final profit', () => {
    const n = calculateFundLevelNav('130000', '100000', '1000', '0.5');
    expect(n.profit.toFixed(2)).toBe('30000.00');
    expect(n.performanceFee.toFixed(2)).toBe('15000.00');
    expect(n.grossNavPerUnit.toFixed(8)).toBe('130.00000000');
    expect(n.navPerUnit.toFixed(8)).toBe('115.00000000');
    const f = clientFigures({ units: '1000', contributed: '100000', nav: n.navPerUnit, adminFee: '1000' });
    expect([f.value, f.profit, f.adminFee, f.finalProfit, f.finalValue].map((d) => d.toFixed(2))).toEqual([
      '115000.00',
      '15000.00',
      '1000.00',
      '14000.00',
      '114000.00',
    ]);
  });

  it('mid-cycle money shares one NAV (matches the database test)', () => {
    // B buys 1,130.43478260 units at 115; market rises 130 → 140 on all money.
    const n = calculateFundLevelNav('280000', '230000', '2130.43478260', '0.5');
    expect(n.performanceFee.toFixed(2)).toBe('25000.00');
    expect(n.navPerUnit.toFixed(8)).toBe('119.69387755');
  });

  it('no performance fee on a loss, but the admin fee is still deducted', () => {
    const n = calculateFundLevelNav('90000', '100000', '1000', '0.5');
    expect(n.performanceFee.toFixed(2)).toBe('0.00');
    expect(n.navPerUnit.toFixed(8)).toBe('90.00000000');
    const f = clientFigures({ units: '1000', contributed: '100000', nav: n.navPerUnit, adminFee: '1000' });
    expect(f.finalProfit.toFixed(2)).toBe('-11000.00');
    // No admin fee once all units are gone (fully reversed).
    expect(
      clientFigures({ units: '0', contributed: '0', nav: '90', adminFee: '1000' }).adminFee.toFixed(2),
    ).toBe('0.00');
  });

  it('summarises positions and legacy lots exactly', () => {
    const s = summarisePositions([POSITION, { ...POSITION, client_id: 'c2', admin_fee: '1000.00' }]);
    expect(s.performanceFee.toFixed(2)).toBe('30000.00');
    expect(s.adminFees.toFixed(2)).toBe('2000.00');
    expect(s.finalProfit.toFixed(2)).toBe('28000.00');
    expect(summariseAccruals([LEGACY_LOT]).fee.toFixed(2)).toBe('3200.00');
  });
});

describe('ProfitSharingPage', () => {
  beforeEach(() => mockSignedIn(ADMIN));

  it('shows cycle profit, performance fee, NAV and each client’s admin fee and final profit', async () => {
    mockFees();
    renderRoute('/admin/profit-sharing');
    const stats = await screen.findByRole('region', { name: 'Fees at the latest NAV' });
    expect(within(stats).getByText('+₹30,000.00')).toBeInTheDocument();
    expect(within(stats).getByText('₹15,000.00')).toBeInTheDocument();
    expect(within(stats).getByText('₹115.0000')).toBeInTheDocument();
    const row = (await screen.findByText('Rahul (fictional)')).closest('tr')!;
    expect(within(row).getByText('₹1,15,000.00')).toBeInTheDocument();
    expect(within(row).getByText('+₹15,000.00')).toBeInTheDocument();
    expect(within(row).getByText('₹1,000.00')).toBeInTheDocument();
    expect(within(row).getByText('+₹14,000.00')).toBeInTheDocument();
    expect(screen.getByText(/1 client\(s\) × ₹1,000.00/)).toBeInTheDocument();
  });

  it('locks the performance fee once active but lets admins change the admin fee', async () => {
    mockFees();
    const { user } = renderRoute('/admin/profit-sharing');
    await screen.findByRole('region', { name: 'Fees at the latest NAV' });
    expect(screen.queryByRole('link', { name: 'Change performance fee' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Change admin fee' }));
    const dialog = await screen.findByRole('dialog', { name: 'Change admin fee' });
    const amount = within(dialog).getByLabelText(/Admin fee/);
    await user.clear(amount);
    await user.type(amount, '1500');
    await user.type(within(dialog).getByLabelText(/Reason/), 'Higher admin cost');
    await user.click(within(dialog).getByRole('button', { name: 'Save admin fee' }));
    await waitFor(() =>
      expect(supabaseMock.rpc).toHaveBeenCalledWith('admin_set_admin_fee', {
        p_cycle_id: CYCLE_ID,
        p_amount: '1500',
        p_reason: 'Higher admin cost',
      }),
    );
  });

  it('still shows the per-lot table for NAVs calculated with the earlier method', async () => {
    mockFees({ snap: snapshot({ calculation_version: 'per_lot_hwm_v1' }) });
    renderRoute('/admin/profit-sharing');
    expect(await screen.findByText('₹1,12,800.00')).toBeInTheDocument();
    expect(screen.getByText(/earlier per-lot method/)).toBeInTheDocument();
  });

  it('records the informational final fees for a closed cycle', async () => {
    mockFees({ status: 'closed' });
    const { user } = renderRoute('/admin/profit-sharing');
    await user.click(await screen.findByRole('button', { name: 'Record final fees' }));
    const dialog = await screen.findByRole('dialog', { name: /Record the final fees/ });
    await user.type(within(dialog).getByLabelText(/Note/), 'Closing fees recorded for demo');
    await user.click(within(dialog).getByRole('button', { name: 'Record final fees' }));
    await waitFor(() =>
      expect(supabaseMock.rpc).toHaveBeenCalledWith('admin_record_fee_crystallisation', {
        p_cycle_id: CYCLE_ID,
        p_note: 'Closing fees recorded for demo',
      }),
    );
  });

  it('shows an existing final record with admin fees instead of the action', async () => {
    mockFees({
      status: 'closed',
      crystallisation: {
        id: 'x',
        snapshot_id: SNAP_ID,
        total_fee_amount: '15000.00',
        net_nav_per_unit: '115.00000000',
        admin_fee_per_client: '1000.00',
        clients_charged: 3,
        admin_fee_total: '3000.00',
        note: 'Closing fees recorded',
        recorded_at: '2027-12-01T10:00:00Z',
      },
    });
    renderRoute('/admin/profit-sharing');
    expect(await screen.findByText('Closing fees recorded')).toBeInTheDocument();
    expect(screen.getByText('₹3,000.00')).toBeInTheDocument();
    expect(screen.getByText(/3 client\(s\) ×/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Record final fees' })).toBeNull();
  });
});

describe('NAV snapshot page fee section', () => {
  beforeEach(() => mockSignedIn(ADMIN));

  it('explains the cycle-profit calculation and lists client positions', async () => {
    mockFees();
    renderRoute(`/admin/nav/snapshots/${SNAP_ID}`);
    expect(await screen.findByText('₹115.00000000')).toBeInTheDocument();
    expect(screen.getByText('= Cycle profit')).toBeInTheDocument();
    expect(screen.getByText(/Performance fee \(50.00% of profit/)).toBeInTheDocument();
    expect(screen.getByText('₹15,000.00')).toBeInTheDocument();
    expect(await screen.findByText('₹1,15,000.00')).toBeInTheDocument();
  });
});
