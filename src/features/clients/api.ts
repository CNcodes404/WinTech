import { UserFacingError } from '@/lib/errors';
import { supabase } from '@/lib/supabase/client';
import { sanitizeSearch } from './params';
import { CLIENTS_PAGE_SIZE, type ClientDetail, type ClientListParams, type ClientRow } from './types';

/**
 * Client (profile) data access for admins. RLS restricts these reads/writes to active admins;
 * a client calling them would only ever see or change their own row.
 */

const LIST_COLUMNS = 'id, full_name, email, phone, status, created_at';

export async function listClients(p: ClientListParams): Promise<{ rows: ClientRow[]; total: number }> {
  let query = supabase.from('profiles').select(LIST_COLUMNS, { count: 'exact' }).eq('role', 'client');

  if (p.status !== 'all') query = query.eq('status', p.status);

  const term = sanitizeSearch(p.q);
  if (term) {
    const like = `"%${term}%"`;
    query = query.or(`full_name.ilike.${like},email.ilike.${like},phone.ilike.${like}`);
  }

  const from = (p.page - 1) * CLIENTS_PAGE_SIZE;
  const { data, error, count } = await query
    .order(p.sort === 'created' ? 'created_at' : 'full_name', { ascending: p.dir === 'asc' })
    .order('id', { ascending: true })
    .range(from, from + CLIENTS_PAGE_SIZE - 1);

  if (error) throw error;
  return { rows: (data ?? []) as ClientRow[], total: count ?? 0 };
}

export async function getClient(id: string): Promise<ClientDetail | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select(`${LIST_COLUMNS}, updated_at`)
    .eq('id', id)
    .eq('role', 'client')
    .maybeSingle();
  if (error) throw error;
  return data as ClientDetail | null;
}

export async function updateClientContact(
  id: string,
  values: { fullName: string; phone: string },
): Promise<void> {
  const { data, error } = await supabase
    .from('profiles')
    .update({ full_name: values.fullName.trim(), phone: values.phone.trim() || null })
    .eq('id', id)
    .eq('role', 'client')
    .select('id');
  if (error) {
    if (error.code === '23514') throw new UserFacingError('The phone number is not in a valid format.');
    throw new Error('The contact details could not be saved. Please try again.');
  }
  if (!data || data.length === 0) {
    throw new UserFacingError(
      'This client could not be updated. They may have been removed or you lack access.',
    );
  }
}
