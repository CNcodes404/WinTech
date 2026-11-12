import { screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { hasOp, makeProfile, mockQuery, mockSignedIn } from '../../../tests/mocks/supabase';
import { renderRoute } from '../../../tests/utils';
import type { LotAccrual } from '../fees/api';
import type { ActivityEntry } from './api';
import { activityLink, describeActivity, unrealisedPnl } from './logic';

const ADMIN = makeProfile({
  id: '00000000-0000-4000-8000-0000000000a1',
  role: 'admin',
  full_name: 'Asha Admin',
});
const CYCLE_ID = '00000000-0000-4000-8000-00000000cc01';
const SNAP_ID = '00000000-0000-4000-8000-0000000000f1';

const lot = (o: Partial<LotAccrual>): LotAccrual => ({
  id: 'l1',
  snapshot_id: SNAP_ID,
  client_id: 'c1',
  client_name: 'Rahul (fictional)',
  client_email: 'r@example.test',
  contribution_id: 'd1',
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
    contribution_id: 'd2',
    contributed_amount: '50000.00',
    units: '431.03448275',
    reference_hwm: '116.00000000',
    gross_value: '50000.00',
    eligible_profit_per_unit: '0',
    fee_amount: '0.00',
    net_value: '50000.00',
  }),
];

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

const snapshot = (o: Record<string, unknown> = {}) => ({
  id: SNAP_ID,
  cycle_id: CYCLE_ID,
  valuation_id: 'v1',
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
  ...o,
});

const activity: ActivityEntry[] = [
  {
    id: 'a1',
    action: 'nav.published',
    entity_type: 'nav_snapshot',
    entity_id: SNAP_ID,
    before_data: { status: 'draft' },
    after_data: { gross_nav_per_unit: '116.00000000', nav_date: '2026-11-12T09:30:00Z' },
    reason: 'Demo',
    created_at: '2026-11-12T09:45:00Z',
    actor: { full_name: 'Asha Admin', email: 'a@example.test' },
  },
  {
    id: 'a2',
    action: 'profile.role_changed',
    entity_type: 'profile',
    entity_id: 'p1',
    before_data: { role: 'client' },
    after_data: { role: 'admin' },
    reason: 'Bootstrap',
    created_at: '2026-11-12T08:00:00Z',
    actor: null,
  },
];

function mockOverview({ withCycle = true, withNav = true } = {}) {
  mockQuery((table, ops) => {
    if (
      table === 'profiles' &&
      hasOp(ops, 'select') &&
      ops.some((o) => o.method === 'eq' && o.args[1] === 'client')
    )
      return { data: null, error: null, count: withCycle ? 3 : 0 };
    if (table === 'cycle_overview') return { data: withCycle ? [cycleRow] : [], error: null };
    if (table === 'cycle_unit_summary')
      return {
        data: {
          cycle_id: CYCLE_ID,
          outstanding_units: '1431.03448275',
          net_contributed: '150000.00',
          pending_count: 2,
          pending_amount: '7500.00',
          investor_count: 2,
        },
        error: null,
      };
    if (table === 'portfolio_valuations')
      return {
        data: [
          {
            id: 'v2',
            cycle_id: CYCLE_ID,
            valuation_at: '2026-11-13T09:30:00Z',
            status: 'draft',
            gross_net_asset_value: '170000.00',
            items: [{ count: 0 }],
          },
          {
            id: 'v1',
            cycle_id: CYCLE_ID,
            valuation_at: '2026-11-12T09:30:00Z',
            status: 'approved',
            gross_net_asset_value: '166000.00',
            items: [{ count: 0 }],
          },
        ],
        error: null,
      };
    if (table === 'nav_snapshots') return { data: withNav ? [snapshot()] : [], error: null };
    if (table === 'lot_fee_accrual_report') return { data: LOTS, error: null };
    if (table === 'audit_logs') return { data: activity, error: null };
    return undefined;
  });
}

describe('overview logic', () => {
  it('computes unrealised P/L from the same lots and as-of time', () => {
    const p = unrealisedPnl(LOTS);
    expect(p.contributed.toFixed(2)).toBe('150000.00');
    expect(p.grossPnl.toFixed(2)).toBe('16000.00');
    expect(p.netPnl.toFixed(2)).toBe('12800.00');
    expect(p.grossReturn?.toFixed(6)).toBe('0.106667');
  });

  it('describes and links audit entries of every type', () => {
    expect(describeActivity(activity[0]!)).toBe(
      'Published gross NAV ₹116.00000000 as of 12 Nov 2026, 03:00 pm',
    );
    expect(describeActivity(activity[1]!)).toBe('Role changed from client to admin');
    expect(activityLink(activity[0]!)).toBe(`/admin/nav/snapshots/${SNAP_ID}`);
    expect(activityLink({ ...activity[0]!, entity_type: 'unknown' })).toBeNull();
  });
});

describe('AdminOverviewPage', () => {
  beforeEach(() => mockSignedIn(ADMIN));

  it('shows key figures, P/L, attention items and recent activity', async () => {
    mockOverview();
    renderRoute('/admin/overview');
    const figures = await screen.findByRole('region', { name: 'Key figures' });
    expect(await within(figures).findByText('₹1,50,000.00')).toBeInTheDocument();
    expect(within(figures).getByText('₹1,66,000.00')).toBeInTheDocument();
    expect(within(figures).getByText('₹116.0000')).toBeInTheDocument();
    expect(within(figures).getByText('₹113.7639')).toBeInTheDocument();
    expect(await within(figures).findByText('+₹16,000.00')).toBeInTheDocument();
    expect(within(figures).getByText('+₹12,800.00')).toBeInTheDocument();
    expect(within(figures).getByText('20.00%')).toBeInTheDocument();

    expect(screen.getByRole('link', { name: /2 contribution\(s\) awaiting verification/ })).toHaveAttribute(
      'href',
      `/admin/contributions?status=pending&cycle=${CYCLE_ID}`,
    );
    expect(screen.getByRole('link', { name: /Valuation draft for .* awaiting approval/ })).toHaveAttribute(
      'href',
      '/admin/portfolio/valuations/v2',
    );
    expect(
      await screen.findByRole('link', {
        name: 'Published gross NAV ₹116.00000000 as of 12 Nov 2026, 03:00 pm',
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(/system \/ project owner/)).toBeInTheDocument();
    // Setup is complete, so no checklist.
    expect(screen.queryByRole('heading', { name: 'Get started' })).toBeNull();
  });

  it('guides first-time setup when nothing exists yet', async () => {
    mockOverview({ withCycle: false });
    renderRoute('/admin/overview');
    expect(await screen.findByRole('heading', { name: 'Get started' })).toBeInTheDocument();
    expect(screen.getByText('Add at least one client')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Start' })).toHaveAttribute('href', '/admin/clients');
    expect(screen.getByRole('button', { name: 'Record contribution' })).toBeDisabled();
  });

  it('asks for a published NAV before showing P/L', async () => {
    mockOverview({ withNav: false });
    renderRoute('/admin/overview');
    expect(await screen.findByText('Publish a NAV to see P/L')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Get started' })).toBeInTheDocument();
  });
});
