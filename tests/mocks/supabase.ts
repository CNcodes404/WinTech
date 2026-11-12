import type { AuthChangeEvent, Session } from '@supabase/supabase-js';
import { vi } from 'vitest';
import type { Profile } from '@/features/auth/types';

/**
 * In-memory stand-in for the Supabase client used by every test. Tests never touch the real
 * project. Use `mockSignedIn(profile)` / `mockSignedOut()` to control the auth state.
 */
type Listener = (event: AuthChangeEvent, session: Session | null) => void;

const listeners = new Set<Listener>();

export const mockDb: { session: Session | null; profile: Profile | null } = {
  session: null,
  profile: null,
};

function fakeSession(profile: Profile): Session {
  return {
    access_token: 'test-access-token',
    refresh_token: 'test-refresh-token',
    expires_in: 3600,
    token_type: 'bearer',
    user: {
      id: profile.id,
      email: profile.email,
      aud: 'authenticated',
      app_metadata: {},
      user_metadata: {},
      created_at: '2026-11-12T00:00:00Z',
    },
  } as Session;
}

export function emitAuth(event: AuthChangeEvent, session: Session | null) {
  listeners.forEach((l) => l(event, session));
}

export const supabaseMock = {
  auth: {
    getSession: vi.fn(async () => ({ data: { session: mockDb.session }, error: null })),
    onAuthStateChange: vi.fn((cb: Listener) => {
      listeners.add(cb);
      return { data: { subscription: { unsubscribe: () => listeners.delete(cb) } } };
    }),
    signInWithPassword: vi.fn(),
    signOut: vi.fn(async () => {
      mockDb.session = null;
      emitAuth('SIGNED_OUT', null);
      return { error: null };
    }),
    resetPasswordForEmail: vi.fn(async () => ({ data: {}, error: null })),
    updateUser: vi.fn(async () => ({ data: { user: mockDb.session?.user ?? null }, error: null })),
  },
  rpc: vi.fn(
    async (_fn: string, _args?: Record<string, unknown>) =>
      ({ data: null, error: null }) as {
        data: unknown;
        error: { code?: string; message?: string } | null;
      },
  ),
  functions: {
    invoke: vi.fn(
      async (_name: string, _options?: unknown) =>
        ({ data: null, error: null }) as {
          data: unknown;
          error: unknown;
        },
    ),
  },
  from: vi.fn((table: string) => queryBuilder(table)),
};

// ------------------------------------------------------------------------------------------------
// Chainable query-builder double. Every call (select/eq/or/order/range/update/…) is recorded; the
// result comes from handlers registered with `mockQuery`, newest first. Unhandled queries resolve
// to an empty result, except the auth profile lookup which returns the signed-in profile.
// ------------------------------------------------------------------------------------------------
export interface QueryOp {
  method: string;
  args: unknown[];
}
export interface QueryResult {
  data: unknown;
  error: { code?: string; message?: string } | null;
  count?: number | null;
}
type QueryHandler = (table: string, ops: QueryOp[]) => QueryResult | undefined;

const queryHandlers: QueryHandler[] = [];
/** Every query executed during the test, for assertions. */
export const executedQueries: Array<{ table: string; ops: QueryOp[] }> = [];

export function mockQuery(handler: QueryHandler) {
  queryHandlers.unshift(handler);
}

export const hasOp = (ops: QueryOp[], method: string) => ops.some((o) => o.method === method);
export const opArgs = (ops: QueryOp[], method: string) => ops.find((o) => o.method === method)?.args;

function resolveQuery(table: string, ops: QueryOp[]): QueryResult {
  executedQueries.push({ table, ops });
  for (const h of queryHandlers) {
    const r = h(table, ops);
    if (r) return r;
  }
  const isAuthProfileLookup =
    table === 'profiles' && hasOp(ops, 'maybeSingle') && !hasOp(ops, 'update') && !hasOp(ops, 'or');
  if (isAuthProfileLookup) {
    const id = opArgs(ops, 'eq')?.[1];
    return { data: mockDb.profile && mockDb.profile.id === id ? mockDb.profile : null, error: null };
  }
  return { data: hasOp(ops, 'single') || hasOp(ops, 'maybeSingle') ? null : [], error: null, count: 0 };
}

function queryBuilder(table: string) {
  const ops: QueryOp[] = [];
  const run = () => Promise.resolve(resolveQuery(table, ops));
  const builder: Record<string, unknown> = new Proxy(
    {},
    {
      get(_t, prop: string) {
        if (prop === 'then') {
          return (onFulfilled: (v: QueryResult) => unknown, onRejected?: (e: unknown) => unknown) =>
            run().then(onFulfilled, onRejected);
        }
        return (...args: unknown[]) => {
          ops.push({ method: prop, args });
          if (prop === 'single' || prop === 'maybeSingle') return run();
          return builder;
        };
      },
    },
  );
  return builder;
}

export function makeProfile(overrides: Partial<Profile> = {}): Profile {
  return {
    id: '00000000-0000-4000-8000-000000000001',
    full_name: 'Test User',
    email: 'test.user@example.test',
    phone: null,
    role: 'client',
    status: 'active',
    ...overrides,
  };
}

export function mockSignedIn(profile: Profile) {
  mockDb.profile = profile;
  mockDb.session = fakeSession(profile);
}

export function mockSignedOut() {
  mockDb.profile = null;
  mockDb.session = null;
}

/** Make the next signInWithPassword succeed as `profile`. */
export function mockSignInSucceeds(profile: Profile) {
  supabaseMock.auth.signInWithPassword.mockImplementationOnce(async () => {
    mockSignedIn(profile);
    emitAuth('SIGNED_IN', mockDb.session);
    return { data: { user: mockDb.session!.user, session: mockDb.session }, error: null };
  });
}

export function resetSupabaseMock() {
  // clearAllMocks keeps implementations; restore defaults so stubs never leak between tests.
  supabaseMock.rpc.mockReset();
  supabaseMock.rpc.mockImplementation(async () => ({ data: null, error: null }));
  supabaseMock.functions.invoke.mockReset();
  supabaseMock.functions.invoke.mockImplementation(async () => ({ data: null, error: null }));
  supabaseMock.auth.signInWithPassword.mockReset();
  mockSignedOut();
  listeners.clear();
  queryHandlers.length = 0;
  executedQueries.length = 0;
  vi.clearAllMocks();
}
