import { screen } from '@testing-library/react';
import axe from 'axe-core';
import { beforeEach, describe, expect, it } from 'vitest';
import { hasOp, makeProfile, mockQuery, mockSignedIn, supabaseMock } from './mocks/supabase';
import { renderRoute } from './utils';

/**
 * Automated accessibility checks (axe-core) on the main screens.
 * jsdom cannot compute colour contrast or layout, so `color-contrast` is disabled here; contrast is
 * covered by the design tokens and manual review (docs/QA_CHECKLIST.md).
 */
async function expectNoViolations() {
  const results = await axe.run(document.body, {
    rules: { 'color-contrast': { enabled: false }, region: { enabled: false } },
  });
  const summary = results.violations.map(
    (v) =>
      `${v.id} (${v.impact}): ${v.help} → ${v.nodes
        .map((n) => n.target.join(' '))
        .slice(0, 3)
        .join(' | ')}`,
  );
  expect(summary).toEqual([]);
}

const CYCLE = {
  id: '00000000-0000-4000-8000-00000000cc01',
  name: 'Demo Cycle',
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

function mockAdminData() {
  mockQuery((table, ops) => {
    if (table === 'cycle_overview' && hasOp(ops, 'maybeSingle')) return { data: CYCLE, error: null };
    if (table === 'cycle_overview') return { data: [CYCLE], error: null };
    if (table === 'profiles' && hasOp(ops, 'range'))
      return {
        data: [
          {
            id: 'c1',
            full_name: 'Client One',
            email: 'c1@example.test',
            phone: null,
            status: 'active',
            created_at: '2026-11-01T00:00:00Z',
          },
        ],
        error: null,
        count: 1,
      };
    if (table === 'contribution_register') return { data: [], error: null, count: 0 };
    return undefined;
  });
}

describe('accessibility (axe)', () => {
  beforeEach(() => mockAdminData());

  it('sign-in page', async () => {
    renderRoute('/login');
    await screen.findByRole('heading', { name: 'Sign in' });
    await expectNoViolations();
  });

  it.each([
    ['/admin/overview', 'Overview'],
    ['/admin/clients', 'Clients'],
    ['/admin/cycles', 'Investment Cycles'],
    ['/admin/contributions', 'Contributions'],
    ['/admin/reports', 'Reports'],
    ['/admin/settings', 'Settings'],
  ])('admin %s', async (path, heading) => {
    mockSignedIn(makeProfile({ role: 'admin', full_name: 'Asha Admin' }));
    renderRoute(path);
    await screen.findByRole('heading', { level: 1, name: heading });
    await expectNoViolations();
  });

  it.each([
    ['/client/overview', 'Overview'],
    ['/client/investment', 'My Investment'],
    ['/client/statements', 'Statements'],
    ['/client/profile', 'Profile'],
  ])('client %s', async (path, heading) => {
    mockSignedIn(makeProfile({ role: 'client', full_name: 'Client One' }));
    supabaseMock.rpc.mockImplementation(async () => ({ data: [], error: null }));
    renderRoute(path);
    await screen.findByRole('heading', { level: 1, name: heading });
    await expectNoViolations();
  });
});
