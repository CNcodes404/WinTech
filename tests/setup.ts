import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach, vi } from 'vitest';
import { resetSupabaseMock } from './mocks/supabase';

// Tests never talk to the real Supabase project.
vi.mock('@/lib/supabase/client', async () => {
  const { supabaseMock } = await import('./mocks/supabase');
  return { supabase: supabaseMock };
});

beforeEach(() => {
  resetSupabaseMock();
});

afterEach(() => {
  cleanup();
});
