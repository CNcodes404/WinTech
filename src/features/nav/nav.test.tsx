import { screen, waitFor, within } from '@testing-library/react';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { hasOp, makeProfile, mockQuery, mockSignedIn, supabaseMock } from '../../../tests/mocks/supabase';
import { renderRoute } from '../../../tests/utils';
import { chartPoints, describeNavEntry, navChange } from './logic';
import type { NavSnapshot } from './types';

const ADMIN = makeProfile({
  id: '00000000-0000-4000-8000-0000000000a1',
  role: 'admin',
  full_name: 'Asha Admin',
});
const CYCLE_ID = '00000000-0000-4000-8000-00000000cc01';
const VAL_ID = '00000000-0000-4000-8000-0000000000e1';
const VAL_CORR_ID = '00000000-0000-4000-8000-0000000000e2';
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
  admin_fee_amount: '1000.00',
};

const snap = (o: Partial<NavSnapshot> = {}): NavSnapshot => ({
  id: SNAP_ID,
  cycle_id: CYCLE_ID,
  valuation_id: VAL_ID,
  nav_date: '2026-11-12T09:30:00Z',
  total_outstanding_units: '1000.00000000',
  gross_net_asset_value: '105000.00',
  gross_nav_per_unit: '105.00000000',
  net_nav_per_unit: null,
  performance_fee_amount: null,
  performance_fee_rate: null,
  net_contributed: null,
  profit_before_fee: null,
  calculation_version: 'gross_v1',
  status: 'published',
  corrects_snapshot_id: null,
  corrected_by_snapshot_id: null,
  calculated_at: '2026-11-12T09:40:00Z',
  published_at: '2026-11-12T09:45:00Z',
  publish_reason: 'Month-end demo NAV',
  corrected_at: null,
  ...o,
});

const valuationRow = (id: string, cash: string) => ({
  id,
  cycle_id: CYCLE_ID,
  valuation_at: '2026-11-12T09:30:00Z',
  source: 'manual_demo',
  status: 'approved',
  cash_balance: cash,
  other_assets: '0.00',
  liabilities: '0.00',
  holdings_value: '0.00',
  gross_asset_value: cash,
  gross_net_asset_value: cash,
  notes: null,
  corrects_valuation_id: null,
  superseded_by: null,
  approved_at: '2026-11-12T09:35:00Z',
  superseded_at: null,
  discarded_at: null,
  created_at: '2026-11-12T09:31:00Z',
  updated_at: '2026-11-12T09:35:00Z',
  items: [{ count: 0 }],
});

function mockNav(snapshots: NavSnapshot[], valuations = [valuationRow(VAL_ID, '105000.00')]) {
  mockQuery((table, ops) => {
    if (table === 'nav_snapshots' && hasOp(ops, 'maybeSingle'))
      return { data: snapshots[0] ?? null, error: null };
    if (table === 'nav_snapshots') return { data: snapshots, error: null };
    if (table === 'cycle_overview' && hasOp(ops, 'maybeSingle')) return { data: cycleRow, error: null };
    if (table === 'cycle_overview') return { data: [cycleRow], error: null };
    if (table === 'portfolio_valuations' && hasOp(ops, 'maybeSingle'))
      return { data: valuations[0], error: null };
    if (table === 'portfolio_valuations') return { data: valuations, error: null };
    if (table === 'portfolio_valuation_items') return { data: [], error: null };
    if (table === 'audit_logs') return { data: [], error: null };
    return undefined;
  });
}

// ------------------------------------------------------------------------------------------------
describe('NAV logic', () => {
  it('computes change vs base exactly', () => {
    expect(navChange('105.00000000', '100.00000000')).toBe('0.050000');
    expect(navChange('92.5', '100')).toBe('-0.075000');
    expect(navChange('1', '0')).toBeNull();
  });

  it('charts published NAVs only, oldest first', () => {
    const pts = chartPoints([
      snap({ id: 'b', nav_date: '2026-12-01T00:00:00Z', gross_nav_per_unit: '110.00000000' }),
      snap({ id: 'd', status: 'draft', nav_date: '2026-12-15T00:00:00Z' }),
      snap({ id: 'c', status: 'corrected', nav_date: '2026-11-20T00:00:00Z' }),
      snap({ id: 'a', nav_date: '2026-11-01T00:00:00Z' }),
    ]);
    expect(pts.map((p) => p.exact)).toEqual(['105.00000000', '110.00000000']);
  });

  it('describes NAV audit entries', () => {
    expect(
      describeNavEntry({
        action: 'nav.calculated',
        before_data: null,
        after_data: {
          gross_net_asset_value: '105000.00',
          total_outstanding_units: '1000.00000000',
          gross_nav_per_unit: '105.00000000',
        },
      }),
    ).toBe('Calculated: ₹1,05,000.00 ÷ 1,000.00000000 units = ₹105.00000000');
  });
});

// ------------------------------------------------------------------------------------------------
describe('NavPage', () => {
  // The chart is lazy-loaded; importing Recharts cold under jsdom is slow, so warm it once.
  beforeAll(async () => {
    await import('./components/NavHistoryChart');
  }, 30_000);
  beforeEach(() => mockSignedIn(ADMIN));

  it('shows the latest published NAV, change vs base, and the snapshot list', async () => {
    mockNav([snap({ id: 'draft1', status: 'draft', gross_nav_per_unit: '106.00000000' }), snap()]);
    renderRoute('/admin/nav');
    expect((await screen.findAllByText('₹105.0000')).length).toBeGreaterThan(0);
    expect(screen.getByText('+5.00% vs base')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Review and publish' })).toHaveAttribute(
      'href',
      '/admin/nav/snapshots/draft1',
    );
    expect(screen.getAllByText('Published').length).toBeGreaterThan(0);
    // The chart is lazy-loaded.
    expect(await screen.findByRole('img', { name: /^NAV per unit from ₹105.0000/ })).toBeInTheDocument();
  });

  it('shows the NAV clients see (after performance fee) next to the market NAV', async () => {
    mockNav([
      snap({
        gross_nav_per_unit: '130.00000000',
        net_nav_per_unit: '115.00000000',
        performance_fee_amount: '15000.00',
        calculation_version: 'fund_level_v2',
      }),
    ]);
    renderRoute('/admin/nav');
    const latest = await screen.findByRole('region', { name: 'Latest published NAV' });
    expect(await within(latest).findByText('₹115.0000')).toBeInTheDocument();
    expect(within(latest).getByText('+15.00% vs base')).toBeInTheDocument();
    expect(within(latest).getByText('₹130.0000')).toBeInTheDocument();
    expect(within(latest).getByText('Before the ₹15,000.00 performance fee')).toBeInTheDocument();
  });

  it('calculates a draft from the latest approved valuation', async () => {
    mockNav([]);
    supabaseMock.rpc.mockResolvedValueOnce({ data: SNAP_ID, error: null });
    const { user, router } = renderRoute('/admin/nav');
    await user.click(await screen.findByRole('button', { name: 'Calculate NAV' }));
    const dialog = await screen.findByRole('dialog', { name: 'Calculate NAV' });
    expect(await within(dialog).findByRole('option', { name: /₹1,05,000.00/ })).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Calculate draft' }));
    await waitFor(() =>
      expect(supabaseMock.rpc).toHaveBeenCalledWith('admin_calculate_nav', {
        p_valuation_id: VAL_ID,
        p_corrects_snapshot_id: undefined,
      }),
    );
    await waitFor(() => expect(router.state.location.pathname).toBe(`/admin/nav/snapshots/${SNAP_ID}`));
  });

  it('shows the server’s stale-valuation message (Decision E)', async () => {
    mockNav([]);
    supabaseMock.rpc.mockResolvedValueOnce({
      data: null,
      error: {
        code: '23514',
        message:
          'Units changed after this valuation (1 ledger entry). Record and approve a newer valuation first.',
      },
    });
    const { user } = renderRoute('/admin/nav');
    await user.click(await screen.findByRole('button', { name: 'Calculate NAV' }));
    const dialog = await screen.findByRole('dialog', { name: 'Calculate NAV' });
    await within(dialog).findByRole('option', { name: /₹1,05,000.00/ });
    await user.click(within(dialog).getByRole('button', { name: 'Calculate draft' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Units changed after this valuation');
  });
});

// ------------------------------------------------------------------------------------------------
describe('NavSnapshotPage', () => {
  beforeEach(() => mockSignedIn(ADMIN));

  it('explains the calculation and publishes with a note', async () => {
    mockNav([snap({ status: 'draft', published_at: null, publish_reason: null })]);
    const { user } = renderRoute(`/admin/nav/snapshots/${SNAP_ID}`);
    expect(await screen.findByText('₹105.00000000')).toBeInTheDocument();
    expect(screen.getByText('1,000.00000000')).toBeInTheDocument();
    expect(screen.getAllByText('₹1,05,000.00').length).toBeGreaterThan(0);

    await user.click(screen.getByRole('button', { name: 'Publish NAV' }));
    const dialog = await screen.findByRole('dialog', { name: 'Publish this NAV?' });
    await user.type(within(dialog).getByLabelText(/Publish note/), 'Month-end demo NAV');
    await user.click(within(dialog).getByRole('button', { name: 'Publish NAV' }));
    await waitFor(() =>
      expect(supabaseMock.rpc).toHaveBeenCalledWith('admin_publish_nav', {
        p_snapshot_id: SNAP_ID,
        p_reason: 'Month-end demo NAV',
      }),
    );
  });

  it('guides the admin to correct the valuation before correcting a NAV', async () => {
    mockNav([snap()]);
    const { user } = renderRoute(`/admin/nav/snapshots/${SNAP_ID}`);
    await user.click(await screen.findByRole('button', { name: 'Correct this NAV' }));
    const dialog = await screen.findByRole('dialog', { name: 'Correct this NAV' });
    expect(await within(dialog).findByText(/No approved corrected valuation exists/)).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Calculate draft' })).toBeDisabled();
  });

  it('calculates a correction from a corrected valuation for the same date', async () => {
    mockNav([snap()], [valuationRow(VAL_CORR_ID, '104000.00'), valuationRow(VAL_ID, '105000.00')]);
    supabaseMock.rpc.mockResolvedValueOnce({ data: '00000000-0000-4000-8000-0000000000f2', error: null });
    const { user } = renderRoute(`/admin/nav/snapshots/${SNAP_ID}`);
    await user.click(await screen.findByRole('button', { name: 'Correct this NAV' }));
    const dialog = await screen.findByRole('dialog', { name: 'Correct this NAV' });
    expect(await within(dialog).findByRole('option', { name: /₹1,04,000.00/ })).toBeInTheDocument();
    expect(within(dialog).queryByRole('option', { name: /₹1,05,000.00/ })).toBeNull();
    await user.click(within(dialog).getByRole('button', { name: 'Calculate draft' }));
    await waitFor(() =>
      expect(supabaseMock.rpc).toHaveBeenCalledWith('admin_calculate_nav', {
        p_valuation_id: VAL_CORR_ID,
        p_corrects_snapshot_id: SNAP_ID,
      }),
    );
  });
});
