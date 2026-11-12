import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';
import { readSupabaseEnv } from './env';

const { url, anonKey } = readSupabaseEnv();

/**
 * Browser Supabase client (publishable key only). All authorization is enforced by Postgres RLS;
 * this client has no more power than the signed-in user.
 */
export const supabase = createClient<Database>(url, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: 'pkce',
  },
});
