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
  from: vi.fn((table: string) => {
    if (table !== 'profiles') throw new Error(`Unexpected table in test: ${table}`);
    const builder = {
      select: () => builder,
      eq: () => builder,
      maybeSingle: async () => ({ data: mockDb.profile, error: null }),
    };
    return builder;
  }),
};

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
  mockSignedOut();
  listeners.clear();
  vi.clearAllMocks();
}
