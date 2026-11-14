import { screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { hasOp, makeProfile, mockQuery, mockSignedIn } from '../../../tests/mocks/supabase';
import { renderRoute } from '../../../tests/utils';
import type { ClientPosition } from '../fees/api';
import type { ActivityEntry } from './api';
import { activityLink, describeActivity, unrealisedPnl } from './logic';

const ADMIN = makeProfile({
  id: '00000000-0000-4000-8000-0000000000a1',
  role: 'admin',
  full_name: 'Asha Admin',
});
const CYCLE_ID = '00000000-0000-4000-8000-00000000cc01';
const SNAP_ID = '00000000-0000-4000-8000-0000000000f1';

const position = (o: Partial<ClientPosition>): ClientPosition => ({
  snapshot_id: SNAP_ID,
  client_id: 'c1',
  client_name: 'Rahul (fictional)',
  client_email: 'r@example.test',
  units: '1000.00000000',
  contributed: '100000.00',
  gross_nav_per_unit: '116.00000000',
  net_nav_per_unit: '113.76393849',
  gross_value: '116000.00',
  net_value: '113763.94',
  performance_fee_share: '2236.06',
  profit: '13763.94',
  admin_fee: '1000.00',
  final_profit: '12763.94',
  final_value: '112763.94',
  ...o,
});

// Cycle: assets 1,66,000; invested 1,50,000 → profit 16,000; 20% fee 3,200 → NAV 113.76393849.
const POSITIONS = [
  position({}),
  position({
    client_id: 'c2',
    client_name: 'Amit (fictional)',
    units: '431.03448275',
    contributed: '50000.00',
    gross_value: '50000.00',
    net_value: '49036.06',
    performance_fee_share: '963.94',
    profit: '-963.94',
    final_profit: '-1963.94',
    final_value: '48036.06',
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
  admin_fee_amount: '1000.00',
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
  performance_fee_rate: '0.200000',
  net_contributed: '150000.00',
  profit_before_fee: '16000.00',
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
    if (table === 'client_position_report') return { data: POSITIONS, error: null };
    if (table === 'audit_logs') return { data: activity, error: null };
    return undefined;
  });
}

describe('overview logic', () => {
  it('computes unrealised P/L from the same client positions and as-of time', () => {
    const p = unrealisedPnl(POSITIONS);
    expect(p.contributed.toFixed(2)).toBe('150000.00');
    expect(p.grossPnl.toFixed(2)).toBe('16000.00');
    // After the 3,200 performance fee (shared through the single NAV) …
    expect(p.netPnl.toFixed(2)).toBe('12800.00');
    // … and two ₹1,000 admin fees.
    expect(p.adminFees.toFixed(2)).toBe('2000.00');
    expect(p.finalPnl.toFixed(2)).toBe('10800.00');
    expect(p.grossReturn?.toFixed(6)).toBe('0.106667');
    expect(p.finalReturn?.toFixed(6)).toBe('0.072000');
  });

  it('describes and links audit entries of every type', () => {
    expect(describeActivity(activity[0]!)).toBe(
      'Published market NAV ₹116.00000000 as of 12 Nov 2026, 03:00 pm',
    );
    expect(describeActivity(activity[1]!)).toBe('Role changed from client to admin');
    expect(activityLink(activity[0]!)).toBe(`/admin/nav/snapshots/${SNAP_ID}`);
    expect(activityLink({ ...activity[0]!, entity_type: 'unknown' })).toBeNull();
    const cleanup = {
      ...activity[1]!,
      action: 'maintenance.demo_data_removed',
      entity_type: 'maintenance',
      entity_id: null,
    };
    expect(describeActivity(cleanup)).toMatch(/demo financial data removed/);
    expect(activityLink(cleanup)).toBeNull();
    expect(describeActivity({ ...cleanup, action: 'maintenance.data_reset' })).toMatch(
      /All data erased .*user accounts kept/,
    );
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
    expect(within(figures).getByText('+₹10,800.00')).toBeInTheDocument();
    expect(within(figures).getByText(/admin fees ₹2,000.00/)).toBeInTheDocument();
    expect(within(figures).getByText('20.00% · ₹1,000.00')).toBeInTheDocument();

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
        name: 'Published market NAV ₹116.00000000 as of 12 Nov 2026, 03:00 pm',
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
