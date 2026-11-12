import { screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  executedQueries,
  hasOp,
  makeProfile,
  mockQuery,
  mockSignedIn,
  opArgs,
  supabaseMock,
  type QueryOp,
} from '../../../tests/mocks/supabase';
import { renderRoute } from '../../../tests/utils';
import { describeEntry } from './history';
import { DEFAULT_LIST_PARAMS, parseListParams, sanitizeSearch, toSearchParams } from './params';
import { generateTemporaryPassword } from './password';
import type { ClientRow } from './types';

const ADMIN = makeProfile({
  id: '00000000-0000-4000-8000-0000000000a1',
  role: 'admin',
  full_name: 'Asha Admin',
});

const clientRow = (n: number, overrides: Partial<ClientRow> = {}): ClientRow => ({
  id: `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`,
  full_name: `Client ${n}`,
  email: `client${n}@example.test`,
  phone: n % 2 ? '+91 98765 4321' + (n % 10) : null,
  status: 'active',
  created_at: '2026-11-10T10:00:00Z',
  ...overrides,
});

const isListQuery = (table: string, ops: QueryOp[]) => table === 'profiles' && hasOp(ops, 'range');
const listQueries = () => executedQueries.filter((q) => isListQuery(q.table, q.ops));

function mockClientList(rows: ClientRow[], total = rows.length) {
  mockQuery((table, ops) =>
    isListQuery(table, ops) ? { data: rows, error: null, count: total } : undefined,
  );
}

// ------------------------------------------------------------------------------------------------
describe('helpers', () => {
  it('sanitizeSearch strips PostgREST filter syntax', () => {
    expect(sanitizeSearch('  Priya, (shah)*% "x" \\ :y  ')).toBe('Priya shah x y');
    expect(sanitizeSearch('a'.repeat(300))).toHaveLength(100);
  });

  it('list params round-trip through the URL and ignore junk', () => {
    const p = {
      q: 'priya',
      status: 'inactive' as const,
      sort: 'created' as const,
      dir: 'desc' as const,
      page: 3,
    };
    expect(parseListParams(toSearchParams(p))).toEqual(p);
    expect(toSearchParams(DEFAULT_LIST_PARAMS).toString()).toBe('');
    expect(parseListParams(new URLSearchParams('status=hacked&page=-4&sort=x'))).toEqual(DEFAULT_LIST_PARAMS);
  });

  it('generated temporary passwords meet the policy', () => {
    for (let i = 0; i < 200; i++) {
      const p = generateTemporaryPassword();
      expect(p).toHaveLength(14);
      expect(p).toMatch(/[A-Za-z]/);
      expect(p).toMatch(/[0-9]/);
      expect(p).not.toMatch(/[0O1lI]/);
    }
    expect(new Set(Array.from({ length: 50 }, () => generateTemporaryPassword())).size).toBe(50);
  });

  it('describes audit entries in plain language', () => {
    expect(describeEntry({ action: 'profile.created', before_data: null, after_data: {} })).toBe(
      'Account created',
    );
    expect(
      describeEntry({
        action: 'profile.status_changed',
        before_data: { status: 'active' },
        after_data: { status: 'inactive' },
      }),
    ).toBe('Account deactivated');
    expect(
      describeEntry({
        action: 'profile.updated',
        before_data: { phone: null },
        after_data: { phone: '+91 90000 00000' },
      }),
    ).toBe('Updated phone “—” → “+91 90000 00000”');
  });
});

// ------------------------------------------------------------------------------------------------
describe('ClientsPage', () => {
  beforeEach(() => mockSignedIn(ADMIN));

  it('lists clients from the database (role = client only)', async () => {
    mockClientList([clientRow(1), clientRow(2, { status: 'inactive' })]);
    renderRoute('/admin/clients');
    expect(await screen.findAllByText('Client 1')).not.toHaveLength(0);
    expect(screen.getAllByText('client2@example.test').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Inactive').length).toBeGreaterThan(0);
    expect(screen.getByText('Showing 1–2 of 2 clients')).toBeInTheDocument();

    const q = listQueries().at(-1)!;
    expect(opArgs(q.ops, 'eq')).toEqual(['role', 'client']);
  });

  it('shows a first-run empty state', async () => {
    mockClientList([]);
    renderRoute('/admin/clients');
    expect(await screen.findByRole('heading', { name: 'No clients yet' })).toBeInTheDocument();
  });

  it('searches with a sanitised term and keeps it in the URL', async () => {
    mockClientList([clientRow(1)]);
    const { user, router } = renderRoute('/admin/clients');
    await screen.findAllByText('Client 1');

    await user.type(screen.getByLabelText('Search clients by name, email or phone'), 'priya,(x)');
    await waitFor(() => expect(router.state.location.search).toBe('?q=priya%2C%28x%29'));
    await waitFor(() => {
      const or = listQueries()
        .map((q) => opArgs(q.ops, 'or')?.[0])
        .find(Boolean);
      expect(or).toBe('full_name.ilike."%priya x%",email.ilike."%priya x%",phone.ilike."%priya x%"');
    });
  });

  it('filters by status and shows a no-match state', async () => {
    mockQuery((table, ops) => {
      if (!isListQuery(table, ops)) return undefined;
      const filtered = ops.some((o) => o.method === 'eq' && o.args[0] === 'status');
      return filtered ? { data: [], error: null, count: 0 } : { data: [clientRow(1)], error: null, count: 1 };
    });
    const { user } = renderRoute('/admin/clients');
    await screen.findAllByText('Client 1');
    await user.selectOptions(screen.getByLabelText('Status'), 'inactive');
    expect(await screen.findByRole('heading', { name: 'No clients match' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(await screen.findAllByText('Client 1')).not.toHaveLength(0);
  });

  it('paginates server-side', async () => {
    mockClientList(
      Array.from({ length: 20 }, (_, i) => clientRow(i + 1)),
      45,
    );
    const { user, router } = renderRoute('/admin/clients');
    expect(await screen.findByText('Showing 1–20 of 45 clients')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Next page' }));
    await waitFor(() => expect(router.state.location.search).toBe('?page=2'));
    await waitFor(() => expect(opArgs(listQueries().at(-1)!.ops, 'range')).toEqual([20, 39]));
  });

  it('sorts by date added', async () => {
    mockClientList([clientRow(1)]);
    const { user } = renderRoute('/admin/clients');
    await screen.findAllByText('Client 1');
    await user.click(screen.getByRole('button', { name: /Added/ }));
    await waitFor(() =>
      expect(opArgs(listQueries().at(-1)!.ops, 'order')).toEqual(['created_at', { ascending: false }]),
    );
    expect(screen.getByRole('columnheader', { name: /Added/ })).toHaveAttribute('aria-sort', 'descending');
  });
});

// ------------------------------------------------------------------------------------------------
describe('Add client', () => {
  beforeEach(() => {
    mockSignedIn(ADMIN);
    mockClientList([]);
  });

  it('validates, creates the account and shows the credentials once', async () => {
    supabaseMock.functions.invoke.mockResolvedValueOnce({
      data: { id: '00000000-0000-4000-8000-0000000000c9', email: 'priya@example.test' },
      error: null,
    });
    const { user } = renderRoute('/admin/clients');
    await user.click((await screen.findAllByRole('button', { name: 'Add client' }))[0]!);
    const dialog = await screen.findByRole('dialog', { name: 'Add client' });

    await user.click(within(dialog).getByRole('button', { name: 'Create client' }));
    expect(await within(dialog).findByText('Enter the client’s full name.')).toBeInTheDocument();
    expect(supabaseMock.functions.invoke).not.toHaveBeenCalled();

    await user.type(within(dialog).getByLabelText(/Full name/), 'Priya Shah');
    await user.type(within(dialog).getByLabelText(/Email address/), 'priya@example.test');
    const password = (within(dialog).getByLabelText(/Temporary password/) as HTMLInputElement).value;
    expect(password).toMatch(/^(?=.*[A-Za-z])(?=.*\d).{14}$/);
    await user.click(within(dialog).getByRole('button', { name: 'Create client' }));

    const success = await screen.findByRole('dialog', { name: 'Client account created' });
    expect(within(success).getByText(password)).toBeInTheDocument();
    expect(supabaseMock.functions.invoke).toHaveBeenCalledWith('admin-create-client', {
      body: { email: 'priya@example.test', fullName: 'Priya Shah', phone: null, temporaryPassword: password },
    });
    expect(within(success).getByRole('link', { name: 'View client' })).toHaveAttribute(
      'href',
      '/admin/clients/00000000-0000-4000-8000-0000000000c9',
    );
  });

  it('shows a clear message when the email already exists', async () => {
    const { FunctionsHttpError } = await import('@supabase/supabase-js');
    supabaseMock.functions.invoke.mockResolvedValueOnce({
      data: null,
      error: new FunctionsHttpError(new Response(JSON.stringify({ error: 'email_exists' }), { status: 409 })),
    });
    const { user } = renderRoute('/admin/clients');
    await user.click((await screen.findAllByRole('button', { name: 'Add client' }))[0]!);
    const dialog = await screen.findByRole('dialog', { name: 'Add client' });
    await user.type(within(dialog).getByLabelText(/Full name/), 'Priya Shah');
    await user.type(within(dialog).getByLabelText(/Email address/), 'taken@example.test');
    await user.click(within(dialog).getByRole('button', { name: 'Create client' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'An account with this email address already exists.',
    );
  });
});

// ------------------------------------------------------------------------------------------------
describe('ClientDetailPage', () => {
  const CLIENT = { ...clientRow(7, { phone: '+91 90000 00007' }), updated_at: '2026-11-11T09:00:00Z' };

  beforeEach(() => {
    mockSignedIn(ADMIN);
    mockQuery((table, ops) =>
      table === 'profiles' &&
      hasOp(ops, 'maybeSingle') &&
      ops.some((o) => o.method === 'eq' && o.args[1] === CLIENT.id)
        ? { data: CLIENT, error: null }
        : undefined,
    );
    mockQuery((table) =>
      table === 'audit_logs'
        ? {
            data: [
              {
                id: 'a1',
                action: 'profile.created',
                before_data: null,
                after_data: { role: 'client' },
                reason: null,
                created_at: '2026-11-10T10:00:00Z',
                actor: { full_name: 'Asha Admin', email: ADMIN.email },
              },
            ],
            error: null,
          }
        : undefined,
    );
  });

  it('shows profile and audit history', async () => {
    renderRoute(`/admin/clients/${CLIENT.id}`);
    expect(await screen.findByRole('heading', { level: 1, name: 'Client 7' })).toBeInTheDocument();
    expect(screen.getByText('+91 90000 00007')).toBeInTheDocument();
    expect(await screen.findByText('Account created')).toBeInTheDocument();
    expect(screen.getByText(/by Asha Admin/)).toBeInTheDocument();
  });

  it('shows not-found for invalid ids without querying', async () => {
    renderRoute('/admin/clients/not-a-uuid');
    expect(await screen.findByRole('heading', { name: 'Client not found' })).toBeInTheDocument();
    expect(executedQueries.some((q) => q.ops.some((o) => o.args[1] === 'not-a-uuid'))).toBe(false);
  });

  it('edits contact details (name and phone only)', async () => {
    mockQuery((table, ops) =>
      table === 'profiles' && hasOp(ops, 'update') ? { data: [{ id: CLIENT.id }], error: null } : undefined,
    );
    const { user } = renderRoute(`/admin/clients/${CLIENT.id}`);
    await user.click(await screen.findByRole('button', { name: 'Edit details' }));
    const dialog = await screen.findByRole('dialog', { name: 'Edit contact details' });
    const name = within(dialog).getByLabelText(/Full name/);
    await user.clear(name);
    await user.type(name, 'Client Seven');
    await user.clear(within(dialog).getByLabelText(/Phone/));
    await user.click(within(dialog).getByRole('button', { name: 'Save changes' }));

    await waitFor(() => {
      const upd = executedQueries.find((q) => hasOp(q.ops, 'update'));
      expect(opArgs(upd!.ops, 'update')).toEqual([{ full_name: 'Client Seven', phone: null }]);
    });
    expect(await screen.findByText('Contact details updated')).toBeInTheDocument();
  });

  it('deactivates with a mandatory reason through the audited function', async () => {
    const { user } = renderRoute(`/admin/clients/${CLIENT.id}`);
    await user.click(await screen.findByRole('button', { name: 'Deactivate' }));
    const dialog = await screen.findByRole('dialog', { name: /Deactivate Client 7/ });
    await user.click(within(dialog).getByRole('button', { name: 'Deactivate' }));
    expect(supabaseMock.rpc).not.toHaveBeenCalled();

    await user.type(within(dialog).getByLabelText(/Reason/), 'Left the investment group');
    await user.click(within(dialog).getByRole('button', { name: 'Deactivate' }));
    await waitFor(() =>
      expect(supabaseMock.rpc).toHaveBeenCalledWith('admin_set_user_status', {
        p_user_id: CLIENT.id,
        p_status: 'inactive',
        p_reason: 'Left the investment group',
      }),
    );
    expect(await screen.findByText('Client deactivated')).toBeInTheDocument();
  });
});
