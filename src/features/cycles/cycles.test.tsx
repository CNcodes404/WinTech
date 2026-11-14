import { screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  executedQueries,
  hasOp,
  makeProfile,
  mockQuery,
  mockSignedIn,
  supabaseMock,
} from '../../../tests/mocks/supabase';
import { renderRoute } from '../../../tests/utils';
import { classifyFeeTerms, describeCycleEntry } from './logic';
import { percentToRate, rateToPercent } from './schemas';
import type { CycleOverview, FeeTerms } from './types';

const ADMIN = makeProfile({
  id: '00000000-0000-4000-8000-0000000000a1',
  role: 'admin',
  full_name: 'Asha Admin',
});
const CYCLE_ID = '00000000-0000-4000-8000-00000000cc01';

const cycle = (overrides: Partial<CycleOverview> = {}): CycleOverview => ({
  id: CYCLE_ID,
  name: 'FY27 Growth Cycle',
  description: 'Demo cycle',
  start_date: '2026-12-01',
  end_date: '2027-11-30',
  status: 'draft',
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
  ...overrides,
});

const terms = (o: Partial<FeeTerms>): FeeTerms => ({
  id: 't1',
  version: 1,
  performance_fee_rate: '0.200000',
  fee_policy: 'per_lot_hwm_v1',
  effective_from: '2026-11-12T10:00:00Z',
  reason: 'Initial fee terms set when the cycle was created.',
  created_at: '2026-11-12T10:00:00Z',
  cancelled_at: null,
  cancel_reason: null,
  creator: null,
  ...o,
});

function mockCycleData(c: CycleOverview, feeTerms: FeeTerms[] = [terms({})]) {
  mockQuery((table, ops) => {
    if (table === 'cycle_overview' && hasOp(ops, 'maybeSingle')) return { data: c, error: null };
    if (table === 'cycle_overview') return { data: [c], error: null };
    if (table === 'cycle_fee_terms') return { data: feeTerms, error: null };
    if (table === 'audit_logs') return { data: [], error: null };
    return undefined;
  });
}

// ------------------------------------------------------------------------------------------------
describe('conversions and logic', () => {
  it('converts percentages to rates exactly', () => {
    expect(percentToRate('20')).toBe('0.2');
    expect(percentToRate('17.5')).toBe('0.175');
    expect(percentToRate('12.3456')).toBe('0.123456');
    expect(rateToPercent('0.200000')).toBe('20');
  });

  it('classifies fee versions', () => {
    const now = new Date('2026-12-15T00:00:00Z');
    const list = [
      terms({ id: 'v1', version: 1, effective_from: '2026-11-12T00:00:00Z' }),
      terms({ id: 'v2', version: 2, effective_from: '2026-12-01T00:00:00Z' }),
      terms({
        id: 'v3',
        version: 3,
        effective_from: '2027-01-01T00:00:00Z',
        cancelled_at: '2026-12-02T00:00:00Z',
      }),
      terms({ id: 'v4', version: 4, effective_from: '2027-02-01T00:00:00Z' }),
    ];
    const s = classifyFeeTerms(list, now);
    expect(Object.fromEntries(s)).toEqual({
      v1: 'superseded',
      v2: 'current',
      v3: 'cancelled',
      v4: 'scheduled',
    });
  });

  it('describes cycle audit entries', () => {
    expect(
      describeCycleEntry({
        action: 'cycle.status_changed',
        before_data: { status: 'draft' },
        after_data: { status: 'open' },
      }),
    ).toBe('Status changed from Draft to Open');
    expect(
      describeCycleEntry({
        action: 'fee_terms.created',
        before_data: null,
        after_data: { version: 1, performance_fee_rate: '0.15' },
      }),
    ).toBe('Fee rate set to 15.00% (version 1)');
  });
});

// ------------------------------------------------------------------------------------------------
describe('CyclesPage', () => {
  beforeEach(() => mockSignedIn(ADMIN));

  it('lists cycles with decimal-safe NAV and fee formatting', async () => {
    mockCycleData(
      cycle({
        status: 'open',
        pending_fee_rate: '0.175000',
        pending_fee_effective_from: '2027-01-01T00:00:00+05:30',
      }),
    );
    renderRoute('/admin/cycles');
    expect((await screen.findAllByText('FY27 Growth Cycle')).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/₹100\.0000/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/20\.00%/).length).toBeGreaterThan(0);
    expect(screen.getByText('17.50% from 01 Jan 2027')).toBeInTheDocument();
    const q = executedQueries.find((e) => e.table === 'cycle_overview');
    expect(String(q?.ops.find((o) => o.method === 'select')?.args[0])).toContain('base_nav::text');
  });

  it('shows an empty state', async () => {
    mockQuery((table) => (table === 'cycle_overview' ? { data: [], error: null } : undefined));
    renderRoute('/admin/cycles');
    expect(await screen.findByRole('heading', { name: 'No cycles yet' })).toBeInTheDocument();
  });

  it('validates and creates a cycle with string decimals (no floats)', async () => {
    mockCycleData(cycle());
    supabaseMock.rpc.mockResolvedValueOnce({ data: CYCLE_ID, error: null });
    const { user, router } = renderRoute('/admin/cycles');
    await user.click((await screen.findAllByRole('button', { name: 'New cycle' }))[0]!);
    const dialog = await screen.findByRole('dialog', { name: 'New investment cycle' });

    await user.type(within(dialog).getByLabelText(/Cycle name/), 'FY27 Growth Cycle');
    await user.type(within(dialog).getByLabelText(/End date/), '2026-01-01');
    // Defaults: 20% performance fee and ₹1,000 admin fee.
    expect(within(dialog).getByLabelText(/Performance fee/)).toHaveValue('20');
    expect(within(dialog).getByLabelText(/Admin fee/)).toHaveValue('1000');
    await user.clear(within(dialog).getByLabelText(/Performance fee/));
    await user.type(within(dialog).getByLabelText(/Performance fee/), '100');
    await user.click(within(dialog).getByRole('button', { name: 'Create cycle' }));
    expect(await within(dialog).findByText('The end date must be after the start date.')).toBeInTheDocument();
    expect(within(dialog).getByText('The fee must be below 100%.')).toBeInTheDocument();
    expect(supabaseMock.rpc).not.toHaveBeenCalled();

    const start = (within(dialog).getByLabelText(/Start date/) as HTMLInputElement).value;
    await user.clear(within(dialog).getByLabelText(/End date/));
    await user.type(within(dialog).getByLabelText(/End date/), '2099-12-31');
    await user.clear(within(dialog).getByLabelText(/Base NAV/));
    await user.type(within(dialog).getByLabelText(/Base NAV/), '100.12345678');
    await user.clear(within(dialog).getByLabelText(/Performance fee/));
    await user.type(within(dialog).getByLabelText(/Performance fee/), '17.5');
    await user.clear(within(dialog).getByLabelText(/Admin fee/));
    await user.type(within(dialog).getByLabelText(/Admin fee/), '1500.50');
    // 100 → 130: fee 17.5% of ₹30,000 = ₹5,250 → profit ₹24,750 → final ₹23,249.50 after the admin fee.
    const example = within(dialog).getByText(/Example at/);
    expect(example).toHaveTextContent('₹5,250.00');
    expect(example).toHaveTextContent('₹24,750.00');
    expect(example).toHaveTextContent('₹23,249.50');
    await user.click(within(dialog).getByRole('button', { name: 'Create cycle' }));

    await waitFor(() =>
      expect(supabaseMock.rpc).toHaveBeenCalledWith('admin_create_cycle', {
        p_name: 'FY27 Growth Cycle',
        p_description: '',
        p_start_date: start,
        p_end_date: '2099-12-31',
        p_base_nav: '100.12345678',
        p_fee_rate: '0.175',
        p_admin_fee: '1500.50',
      }),
    );
    await waitFor(() => expect(router.state.location.pathname).toBe(`/admin/cycles/${CYCLE_ID}`));
  });
});

// ------------------------------------------------------------------------------------------------
describe('CycleDetailPage', () => {
  beforeEach(() => mockSignedIn(ADMIN));

  it('shows summary, fee versions and the next lifecycle action', async () => {
    mockCycleData(cycle(), [
      terms({
        id: 'v2',
        version: 2,
        performance_fee_rate: '0.175000',
        effective_from: '2099-01-01T00:00:00Z',
        reason: 'Agreed change',
      }),
      terms({ id: 'v1' }),
    ]);
    renderRoute(`/admin/cycles/${CYCLE_ID}`);
    expect(await screen.findByRole('heading', { level: 1, name: 'FY27 Growth Cycle' })).toBeInTheDocument();
    expect(screen.getByText('₹100.00000000')).toBeInTheDocument();
    expect(await screen.findByText('Scheduled')).toBeInTheDocument();
    expect(screen.getByText('Current')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open for contributions' })).toBeInTheDocument();
  });

  it('moves the status forward with a mandatory reason', async () => {
    mockCycleData(cycle());
    const { user } = renderRoute(`/admin/cycles/${CYCLE_ID}`);
    await user.click(await screen.findByRole('button', { name: 'Open for contributions' }));
    const dialog = await screen.findByRole('dialog', { name: /Open this cycle/ });
    await user.type(within(dialog).getByLabelText(/Reason/), 'Ready to accept contributions');
    await user.click(within(dialog).getByRole('button', { name: 'Open for contributions' }));
    await waitFor(() =>
      expect(supabaseMock.rpc).toHaveBeenCalledWith('admin_set_cycle_status', {
        p_cycle_id: CYCLE_ID,
        p_status: 'open',
        p_reason: 'Ready to accept contributions',
      }),
    );
  });

  it('locks the performance fee once active; the admin fee stays editable', async () => {
    mockCycleData(cycle({ status: 'active' }));
    const { user } = renderRoute(`/admin/cycles/${CYCLE_ID}`);
    expect(await screen.findByText('Locked since trading started')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Change rate' })).toBeNull();
    expect(screen.getByText('₹1,000.00')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Change admin fee' }));
    const dialog = await screen.findByRole('dialog', { name: 'Change admin fee' });
    await user.clear(within(dialog).getByLabelText(/Admin fee/));
    await user.type(within(dialog).getByLabelText(/Admin fee/), '1.234');
    await user.type(within(dialog).getByLabelText(/Reason/), 'Revised admin cost');
    await user.click(within(dialog).getByRole('button', { name: 'Save admin fee' }));
    expect(await within(dialog).findByText(/Enter an amount in ₹/)).toBeInTheDocument();
    await user.clear(within(dialog).getByLabelText(/Admin fee/));
    await user.type(within(dialog).getByLabelText(/Admin fee/), '1200');
    await user.click(within(dialog).getByRole('button', { name: 'Save admin fee' }));
    await waitFor(() =>
      expect(supabaseMock.rpc).toHaveBeenCalledWith('admin_set_admin_fee', {
        p_cycle_id: CYCLE_ID,
        p_amount: '1200',
        p_reason: 'Revised admin cost',
      }),
    );
  });

  it('changes the fee rate immediately or from a future date (before trading)', async () => {
    mockCycleData(cycle({ status: 'open' }));
    const { user } = renderRoute(`/admin/cycles/${CYCLE_ID}`);
    await user.click(await screen.findByRole('button', { name: 'Change rate' }));
    let dialog = await screen.findByRole('dialog', { name: 'Change performance-fee rate' });
    await user.type(within(dialog).getByLabelText(/New performance fee/), '15');
    await user.type(within(dialog).getByLabelText(/Reason/), 'Group agreed a lower fee');
    await user.click(within(dialog).getByRole('button', { name: 'Change rate now' }));
    await waitFor(() =>
      expect(supabaseMock.rpc).toHaveBeenCalledWith('admin_add_fee_terms', {
        p_cycle_id: CYCLE_ID,
        p_fee_rate: '0.15',
        p_effective_from: null,
        p_reason: 'Group agreed a lower fee',
      }),
    );

    await user.click(await screen.findByRole('button', { name: 'Change rate' }));
    dialog = await screen.findByRole('dialog', { name: 'Change performance-fee rate' });
    await user.type(within(dialog).getByLabelText(/New performance fee/), '18');
    await user.click(within(dialog).getByLabelText(/future date/));
    const date = within(dialog).getByLabelText(/Effective date/);
    await user.clear(date);
    await user.type(date, '2099-04-01');
    await user.type(within(dialog).getByLabelText(/Reason/), 'Scheduled revision');
    await user.click(within(dialog).getByRole('button', { name: 'Schedule change' }));
    await waitFor(() =>
      expect(supabaseMock.rpc).toHaveBeenLastCalledWith('admin_add_fee_terms', {
        p_cycle_id: CYCLE_ID,
        p_fee_rate: '0.18',
        p_effective_from: '2099-04-01T00:00:00+05:30',
        p_reason: 'Scheduled revision',
      }),
    );
  });

  it('cancels a scheduled fee change', async () => {
    mockCycleData(cycle(), [
      terms({
        id: 'v2',
        version: 2,
        performance_fee_rate: '0.175000',
        effective_from: '2099-01-01T00:00:00Z',
      }),
      terms({ id: 'v1' }),
    ]);
    const { user } = renderRoute(`/admin/cycles/${CYCLE_ID}`);
    await user.click(await screen.findByRole('button', { name: 'Cancel' }));
    const dialog = await screen.findByRole('dialog', { name: /Cancel scheduled change/ });
    await user.type(within(dialog).getByLabelText(/Reason/), 'Agreement postponed');
    await user.click(within(dialog).getByRole('button', { name: 'Cancel scheduled change' }));
    await waitFor(() =>
      expect(supabaseMock.rpc).toHaveBeenCalledWith('admin_cancel_fee_terms', {
        p_terms_id: 'v2',
        p_reason: 'Agreement postponed',
      }),
    );
  });

  it('locks base NAV after opening and hides edits for closed cycles', async () => {
    mockCycleData(cycle({ status: 'open' }));
    const { user, unmount } = renderRoute(`/admin/cycles/${CYCLE_ID}`);
    await user.click(await screen.findByRole('button', { name: 'Edit' }));
    const dialog = await screen.findByRole('dialog', { name: 'Edit cycle' });
    expect(within(dialog).getByLabelText(/Base NAV/)).toHaveAttribute('readonly');
    expect(within(dialog).getByLabelText(/Start date/)).not.toHaveAttribute('readonly');
    unmount();

    mockCycleData(cycle({ status: 'closed' }));
    renderRoute(`/admin/cycles/${CYCLE_ID}`);
    await screen.findByRole('heading', { level: 1, name: 'FY27 Growth Cycle' });
    expect(screen.queryByRole('button', { name: 'Edit' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Change rate' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Mark as settled' })).toBeInTheDocument();
  });

  it('shows not-found for invalid ids', async () => {
    renderRoute('/admin/cycles/xyz');
    expect(await screen.findByRole('heading', { name: 'Cycle not found' })).toBeInTheDocument();
  });
});
