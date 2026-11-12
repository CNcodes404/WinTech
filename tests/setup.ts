import '@testing-library/jest-dom/vitest';
import { cleanup, configure } from '@testing-library/react';
import { afterEach, beforeEach, vi } from 'vitest';
import { resetSupabaseMock } from './mocks/supabase';

// Tests never talk to the real Supabase project.
vi.mock('@/lib/supabase/client', async () => {
  const { supabaseMock } = await import('./mocks/supabase');
  return { supabase: supabaseMock };
});

// findBy*/waitFor default to 1s, which is too tight when the whole suite runs in parallel on a busy
// machine. 3s removes false failures without hiding real ones.
configure({ asyncUtilTimeout: 3000 });

// jsdom has no ResizeObserver (used by chart containers).
if (!('ResizeObserver' in globalThis)) {
  class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  (globalThis as unknown as { ResizeObserver: typeof ResizeObserverStub }).ResizeObserver =
    ResizeObserverStub;
}

beforeEach(() => {
  resetSupabaseMock();
});

afterEach(() => {
  cleanup();
});
