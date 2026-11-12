import type { Database } from '@/lib/supabase/database.types';

export type AppRole = Database['public']['Enums']['app_role'];
export type ProfileStatus = Database['public']['Enums']['profile_status'];

export type Profile = Pick<
  Database['public']['Tables']['profiles']['Row'],
  'id' | 'full_name' | 'email' | 'phone' | 'role' | 'status'
>;

export const ROLE_LABEL: Record<AppRole, string> = {
  admin: 'Administrator',
  client: 'Client',
};

/** Landing page for each role after sign-in. */
export function homePathFor(role: AppRole): string {
  return role === 'admin' ? '/admin/overview' : '/client/overview';
}
