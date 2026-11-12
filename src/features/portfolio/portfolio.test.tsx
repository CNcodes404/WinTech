import { screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  hasOp,
  makeProfile,
  mockQuery,
  mockSignedIn,
  supabaseMock,
  type QueryOp,
} from '../../../tests/mocks/supabase';
import { renderRoute } from '../../../tests/utils';
import { previewValuation } from './logic';
import { valuationSchema } from './schemas';
import type { Valuation, ValuationItem } from './types';

const ADMIN = makeProfile({
  id: '00000000-0000-4000-8000-0000000000a1',
  role: 'admin',
  full_name: 'Asha Admin',
});
const CYCLE_ID = '00000000-0000-4000-8000-00000000cc01';
const VAL_ID = '00000000-0000-4000-8000-0000000000e1';

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

const valuation = (o: Partial<Valuation> = {}): Valuation => ({
  id: VAL_ID,
  cycle_id: CYCLE_ID,
  valuation_at: '2026-11-12T09:30:00Z',
  source: 'manual_demo',
  status: 'approved',
  cash_balance: '50000.50',
  other_assets: '0.00',
  liabilities: '1500.00',
  holdings_value: '65714.91',
  gross_asset_value: '115715.41',
  gross_net_asset_value: '114215.41',
  notes: null,
  corrects_valuation_id: null,
  superseded_by: null,
  approved_at: '2026-11-12T10:00:00Z',
  superseded_at: null,
  discarded_at: null,
  created_at: '2026-11-12T09:35:00Z',
  updated_at: '2026-11-12T10:00:00Z',
  ...o,
});

const items: ValuationItem[] = [
  {
    id: 'i1',
    line_no: 1,
    symbol: 'INFY',
    instrument_name: 'Infosys Ltd (demo)',
    exchange: 'NSE',
    quantity: '12.50000000',
    valuation_price: '2456.78900000',
    market_value: '30709.86',
    average_cost: '1500.00000000',
    notes: null,
  },
  {
    id: 'i2',
    line_no: 2,
    symbol: 'TCS',
    instrument_name: null,
    exchange: 'NSE',
    quantity: '10.00000000',
    valuation_price: '3500.50500000',
    market_value: '35005.05',
    average_cost: null,
    notes: null,
  },
];

const isDetail = (t: string, ops: QueryOp[]) => t === 'portfolio_valuations' && hasOp(ops, 'maybeSingle');

function mockPortfolio(v: Valuation, outstanding = '1000.00000000') {
  mockQuery((table, ops) => {
    if (isDetail(table, ops)) return { data: v, error: null };
    if (table === 'portfolio_valuations') return { data: [{ ...v, items: [{ count: 2 }] }], error: null };
    if (table === 'portfolio_valuation_items') return { data: items, error: null };
    if (table === 'cycle_overview' && hasOp(ops, 'maybeSingle')) return { data: cycleRow, error: null };
    if (table === 'cycle_overview') return { data: [cycleRow], error: null };
    if (table === 'cycle_unit_summary')
      return {
        data: {
          cycle_id: CYCLE_ID,
          outstanding_units: outstanding,
          net_contributed: '100000.00',
          pending_count: 0,
          pending_amount: '0',
          investor_count: 1,
        },
        error: null,
      };
    if (table === 'audit_logs') return { data: [], error: null };
    return undefined;
  });
}

// ------------------------------------------------------------------------------------------------
describe('valuation preview and rules', () => {
  it('matches the server formulas (per-line paise rounding)', () => {
    const p = previewValuation(
      [
        { quantity: '12.5', valuationPrice: '2456.789' },
        { quantity: '10', valuationPrice: '3,500.505' },
      ],
      '50,000.50',
      '0',
      '1500',
      '1000',
    );
    expect(p.lineValues.map((v) => v?.toFixed(2))).toEqual(['30709.86', '35005.05']);
    expect(p.holdings.toFixed(2)).toBe('65714.91');
    expect(p.grossAssets.toFixed(2)).toBe('115715.41');
    expect(p.netAssets.toFixed(2)).toBe('114215.41');
    expect(p.navPerUnit?.toFixed(8)).toBe('114.21541000');
  });

  it('never crashes on half-typed input', () => {
    const p = previewValuation([{ quantity: '1.', valuationPrice: 'abc' }], 'x', '-5', '', null);
    expect(p.lineValues).toEqual([null]);
    expect(p.netAssets.toFixed(2)).toBe('0.00');
    expect(p.navPerUnit).toBeNull();
  });

  it('flags duplicate holdings and bad numbers', () => {
    const base = {
      valuationAt: '2026-01-01T10:00',
      cashBalance: '0',
      otherAssets: '',
      liabilities: '',
      notes: '',
    };
    const h = { instrumentName: '', exchange: 'NSE' as const, averageCost: '', notes: '' };
    const r = valuationSchema.safeParse({
      ...base,
      holdings: [
        { ...h, symbol: 'infy', quantity: '1', valuationPrice: '10' },
        { ...h, symbol: 'INFY', quantity: '0', valuationPrice: '1.123456789' },
      ],
    });
    expect(r.success).toBe(false);
    const paths = r.error!.issues.map((i) => i.path.join('.'));
    expect(paths).toEqual(
      expect.arrayContaining(['holdings.1.symbol', 'holdings.1.quantity', 'holdings.1.valuationPrice']),
    );
  });
});

// ------------------------------------------------------------------------------------------------
describe('PortfolioPage', () => {
  beforeEach(() => mockSignedIn(ADMIN));

  it('shows the latest approved snapshot and the valuation list', async () => {
    mockPortfolio(valuation());
    renderRoute('/admin/portfolio');
    expect((await screen.findAllByText('₹1,14,215.41')).length).toBeGreaterThan(0);
    expect(screen.getAllByText('Manual demo entry').length).toBeGreaterThan(0);
    expect(screen.getByText('2 holding(s)')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'New valuation' })).toHaveAttribute(
      'href',
      `/admin/portfolio/valuations/new?cycle=${CYCLE_ID}`,
    );
  });
});

// ------------------------------------------------------------------------------------------------
describe('ValuationEditorPage', () => {
  beforeEach(() => mockSignedIn(ADMIN));

  it('pre-fills from the latest approved valuation and saves a draft with string values', async () => {
    mockPortfolio(valuation());
    supabaseMock.rpc.mockResolvedValueOnce({ data: '00000000-0000-4000-8000-0000000000e2', error: null });
    const { user, router } = renderRoute(`/admin/portfolio/valuations/new?cycle=${CYCLE_ID}`);

    expect(await screen.findByText(/Pre-filled from the latest approved valuation/)).toBeInTheDocument();
    expect(screen.getByLabelText('Line 1 symbol')).toHaveValue('INFY');
    expect(screen.getByLabelText('Line 2 market value')).toHaveTextContent('₹35,005.05');
    const totals = screen.getByRole('complementary', { name: /Valuation totals/ });
    expect(within(totals).getByText('₹1,14,215.41')).toBeInTheDocument();
    // Outstanding units load separately; wait for the indicative NAV per unit.
    expect(await within(totals).findByText('₹114.2154')).toBeInTheDocument();

    // Update a price: live preview follows.
    const price = screen.getByLabelText('Line 1 valuation price');
    await user.clear(price);
    await user.type(price, '2500');
    expect(screen.getByLabelText('Line 1 market value')).toHaveTextContent('₹31,250.00');

    await user.click(screen.getByRole('button', { name: 'Save draft' }));
    await waitFor(() => expect(supabaseMock.rpc).toHaveBeenCalledTimes(1));
    const [fn, args] = supabaseMock.rpc.mock.calls[0]!;
    expect(fn).toBe('admin_save_valuation_draft');
    expect(args).toMatchObject({
      p_valuation_id: null,
      p_cycle_id: CYCLE_ID,
      p_cash_balance: '50000.50',
      p_liabilities: '1500.00',
      p_items: [
        expect.objectContaining({ symbol: 'INFY', quantity: '12.50000000', valuation_price: '2500' }),
        expect.objectContaining({ symbol: 'TCS', valuation_price: '3500.50500000' }),
      ],
    });
    expect(String((args as Record<string, unknown>).p_valuation_at)).toMatch(/\+05:30$/);
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(
        '/admin/portfolio/valuations/00000000-0000-4000-8000-0000000000e2',
      ),
    );
  });

  it('adds and removes holding rows and validates them', async () => {
    mockPortfolio(valuation());
    const { user } = renderRoute(`/admin/portfolio/valuations/new?cycle=${CYCLE_ID}`);
    await screen.findByLabelText('Line 1 symbol');
    await user.click(screen.getByRole('button', { name: 'Add holding' }));
    expect(screen.getByLabelText('Line 3 symbol')).toBeInTheDocument();
    await user.type(screen.getByLabelText('Line 3 symbol'), 'tcs');
    await user.type(screen.getByLabelText('Line 3 quantity'), '0');
    await user.type(screen.getByLabelText('Line 3 valuation price'), '1');
    await user.click(screen.getByRole('button', { name: 'Save draft' }));
    expect(await screen.findByText('Duplicate of line 2. Combine the quantities.')).toBeInTheDocument();
    expect(screen.getByText('Must be greater than 0.')).toBeInTheDocument();
    expect(supabaseMock.rpc).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Remove line 3' }));
    expect(screen.queryByLabelText('Line 3 symbol')).toBeNull();
  });

  it('refuses to edit an approved valuation', async () => {
    mockPortfolio(valuation({ status: 'approved' }));
    renderRoute(`/admin/portfolio/valuations/${VAL_ID}/edit`);
    expect(
      await screen.findByRole('heading', { name: 'This valuation cannot be edited' }),
    ).toBeInTheDocument();
  });
});

// ------------------------------------------------------------------------------------------------
describe('ValuationDetailPage', () => {
  beforeEach(() => mockSignedIn(ADMIN));

  it('approves a draft with a mandatory note', async () => {
    mockPortfolio(valuation({ status: 'draft', approved_at: null }));
    const { user } = renderRoute(`/admin/portfolio/valuations/${VAL_ID}`);
    expect(await screen.findByText('₹30,709.86')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Approve' }));
    const dialog = await screen.findByRole('dialog', { name: 'Approve this valuation?' });
    await user.type(within(dialog).getByLabelText(/Approval note/), 'Prices checked against demo sheet');
    await user.click(within(dialog).getByRole('button', { name: 'Approve valuation' }));
    await waitFor(() =>
      expect(supabaseMock.rpc).toHaveBeenCalledWith('admin_approve_valuation', {
        p_valuation_id: VAL_ID,
        p_reason: 'Prices checked against demo sheet',
      }),
    );
  });

  it('offers a correction (not an edit) for approved valuations', async () => {
    mockPortfolio(valuation());
    renderRoute(`/admin/portfolio/valuations/${VAL_ID}`);
    expect(await screen.findByRole('link', { name: 'Create correction' })).toHaveAttribute(
      'href',
      `/admin/portfolio/valuations/new?cycle=${CYCLE_ID}&corrects=${VAL_ID}`,
    );
    expect(screen.queryByRole('button', { name: 'Approve' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Edit draft' })).toBeNull();
  });

  it('explains superseded valuations', async () => {
    mockPortfolio(
      valuation({
        status: 'superseded',
        superseded_by: '00000000-0000-4000-8000-0000000000e9',
        superseded_at: '2026-11-13T10:00:00Z',
      }),
    );
    renderRoute(`/admin/portfolio/valuations/${VAL_ID}`);
    expect(await screen.findByText(/was replaced by an approved/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'correction' })).toHaveAttribute(
      'href',
      '/admin/portfolio/valuations/00000000-0000-4000-8000-0000000000e9',
    );
  });
});
