import { screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { hasOp, makeProfile, mockQuery, mockSignedIn, supabaseMock } from '../../../tests/mocks/supabase';
import { renderRoute } from '../../../tests/utils';
import type { LotAccrual } from './api';
import { summariseAccruals } from './logic';

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
  current_fee_rate: '0.200000',
  current_fee_version: 1,
  current_fee_effective_from: '2026-11-12T10:00:00Z',
  pending_fee_rate: null,
  pending_fee_version: null,
  pending_fee_effective_from: null,
});

const snapshot = {
  id: SNAP_ID,
  cycle_id: CYCLE_ID,
  valuation_id: '00000000-0000-4000-8000-0000000000e1',
  nav_date: '2026-11-12T09:30:00Z',
  total_outstanding_units: '1431.03448275',
  gross_net_asset_value: '166000.00',
  gross_nav_per_unit: '116.00000000',
  net_nav_per_unit: '113.76393849',
  performance_fee_amount: '3200.00',
  calculation_version: 'per_lot_hwm_v1',
  status: 'published',
  corrects_snapshot_id: null,
  corrected_by_snapshot_id: null,
  calculated_at: '2026-11-12T09:40:00Z',
  published_at: '2026-11-12T09:45:00Z',
  publish_reason: 'Demo',
  corrected_at: null,
};

const lot = (o: Partial<LotAccrual>): LotAccrual => ({
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
  ...o,
});

const LOTS = [
  lot({}),
  lot({
    id: 'l2',
    client_name: 'Amit (fictional)',
    contribution_id: '00000000-0000-4000-8000-0000000000d2',
    units: '431.03448275',
    entry_nav: '116.00000000',
    reference_hwm: '116.00000000',
    gross_value: '50000.00',
    eligible_profit_per_unit: '0.00000000',
    fee_amount: '0.00',
    net_value: '50000.00',
    loss_to_recover: '0.00',
  }),
];

function mockFees(status = 'active', lots = LOTS, crystallisation: unknown = null) {
  mockQuery((table, ops) => {
    if (table === 'cycle_overview') return { data: [cycleRow(status)], error: null };
    if (table === 'cycle_fee_terms') return { data: [], error: null };
    if (table === 'nav_snapshots' && hasOp(ops, 'maybeSingle')) return { data: snapshot, error: null };
    if (table === 'nav_snapshots') return { data: [snapshot], error: null };
    if (table === 'lot_fee_accrual_report') return { data: lots, error: null };
    if (table === 'fee_crystallisations') return { data: crystallisation, error: null };
    if (table === 'portfolio_valuations') return { data: null, error: null };
    if (table === 'audit_logs') return { data: [], error: null };
    return undefined;
  });
}

describe('summariseAccruals', () => {
  it('adds server amounts exactly and counts positions', () => {
    const s = summariseAccruals([
      ...LOTS,
      lot({
        id: 'l3',
        fee_amount: '0.00',
        net_value: '9000.00',
        gross_value: '9000.00',
        loss_to_recover: '1000.00',
      }),
    ]);
    expect(s.fee.toFixed(2)).toBe('3200.00');
    expect(s.netValue.toFixed(2)).toBe('171800.00');
    expect(s.lossToRecover.toFixed(2)).toBe('1000.00');
    expect([s.lots, s.lotsWithFee, s.lotsBelowHwm]).toEqual([3, 1, 1]);
  });
});

describe('ProfitSharingPage', () => {
  beforeEach(() => mockSignedIn(ADMIN));

  it('shows the per-lot fee (spec example: HWM 100 → 116 @ 20% = ₹3,200)', async () => {
    mockFees();
    renderRoute('/admin/profit-sharing');
    expect(await screen.findByText('₹1,12,800.00')).toBeInTheDocument();
    expect(screen.getAllByText('₹3,200.00').length).toBeGreaterThan(0);
    expect(screen.getByText('₹113.7639')).toBeInTheDocument();
    expect(screen.getByText('1 of 2 lot(s) above HWM')).toBeInTheDocument();
    // Later entrant at the HWM: no fee.
    const amitRow = screen.getByText('Amit (fictional)').closest('tr')!;
    expect(within(amitRow).getByText('At HWM')).toBeInTheDocument();
    expect(within(amitRow).getByText('₹0.00')).toBeInTheDocument();
  });

  it('flags lots below their high-water mark', async () => {
    mockFees('active', [
      lot({
        fee_amount: '0.00',
        eligible_profit_per_unit: '0.00000000',
        gross_value: '90000.00',
        net_value: '90000.00',
        loss_to_recover: '10000.00',
      }),
    ]);
    renderRoute('/admin/profit-sharing');
    expect(await screen.findByText('Below HWM · ₹10,000.00 to recover')).toBeInTheDocument();
  });

  it('records the informational final fee for a closed cycle', async () => {
    mockFees('closed');
    const { user } = renderRoute('/admin/profit-sharing');
    await user.click(await screen.findByRole('button', { name: 'Record final fee' }));
    const dialog = await screen.findByRole('dialog', { name: /Record the final fee/ });
    await user.type(within(dialog).getByLabelText(/Note/), 'Closing fee recorded for demo');
    await user.click(within(dialog).getByRole('button', { name: 'Record final fee' }));
    await waitFor(() =>
      expect(supabaseMock.rpc).toHaveBeenCalledWith('admin_record_fee_crystallisation', {
        p_cycle_id: CYCLE_ID,
        p_note: 'Closing fee recorded for demo',
      }),
    );
  });

  it('shows an existing final fee record instead of the action', async () => {
    mockFees('closed', LOTS, {
      id: 'x',
      snapshot_id: SNAP_ID,
      total_fee_amount: '3200.00',
      net_nav_per_unit: '113.76393849',
      note: 'Closing fee recorded',
      recorded_at: '2027-12-01T10:00:00Z',
    });
    renderRoute('/admin/profit-sharing');
    expect(await screen.findByText('Closing fee recorded')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Record final fee' })).toBeNull();
  });
});

describe('NAV snapshot page fee section', () => {
  beforeEach(() => mockSignedIn(ADMIN));

  it('shows the fee and weighted net NAV in the breakdown', async () => {
    mockFees();
    renderRoute(`/admin/nav/snapshots/${SNAP_ID}`);
    expect(await screen.findByText('₹113.76393849')).toBeInTheDocument();
    expect(screen.getByText(/Indicative performance fee/)).toBeInTheDocument();
    expect(await screen.findByText('₹1,12,800.00')).toBeInTheDocument();
  });
});
