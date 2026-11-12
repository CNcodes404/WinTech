import type { Database } from '@/lib/supabase/database.types';

export type AppRole = Database['public']['Enums']['app_role'];
export type ProfileStatus = Database['public']['Enums']['profile_status'];

export interface Profile {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  role: AppRole;
  status: ProfileStatus;
  /** True for admin-created accounts until the user sets their own password. */
  must_change_password?: boolean;
}

export const ROLE_LABEL: Record<AppRole, string> = {
  admin: 'Administrator',
  client: 'Client',
};

/** Landing page for each role after sign-in. */
export function homePathFor(role: AppRole): string {
  return role === 'admin' ? '/admin/overview' : '/client/overview';
}
