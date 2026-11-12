import type { Json } from '@/lib/supabase/database.types';
import type { ClientHistoryEntry } from './types';

const FIELD_LABEL: Record<string, string> = {
  full_name: 'name',
  phone: 'phone',
  email: 'email',
  status: 'status',
  role: 'role',
};

function obj(j: Json | null): Record<string, Json | undefined> {
  return j && typeof j === 'object' && !Array.isArray(j) ? j : {};
}

function display(v: Json | undefined): string {
  if (v === null || v === undefined || v === '') return '—';
  return String(v);
}

/** Plain-language description of an audit entry for the client's history list. */
export function describeEntry(e: Pick<ClientHistoryEntry, 'action' | 'before_data' | 'after_data'>): string {
  const before = obj(e.before_data);
  const after = obj(e.after_data);
  switch (e.action) {
    case 'profile.created':
      return 'Account created';
    case 'profile.status_changed':
      return after.status === 'active' ? 'Account activated' : 'Account deactivated';
    case 'profile.role_changed':
      return `Role changed from ${display(before.role)} to ${display(after.role)}`;
    case 'profile.updated': {
      const changes = Object.keys(after).map(
        (k) => `${FIELD_LABEL[k] ?? k} “${display(before[k])}” → “${display(after[k])}”`,
      );
      return changes.length ? `Updated ${changes.join(', ')}` : 'Profile updated';
    }
    default:
      return e.action;
  }
}
