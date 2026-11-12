import { useQuery } from '@tanstack/react-query';
import type { AuditEntry } from '@/features/audit/api';
import { supabase } from '@/lib/supabase/client';

/** Admin-only (RLS). */

export interface ActivityEntry extends AuditEntry {
  entity_type: string;
  entity_id: string | null;
}

export async function listRecentActivity(limit = 12): Promise<ActivityEntry[]> {
  const { data, error } = await supabase
    .from('audit_logs')
    .select(
      'id, action, entity_type, entity_id, before_data, after_data, reason, created_at, actor:profiles!audit_logs_actor_id_fkey(full_name, email)',
    )
    .order('seq', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as unknown as ActivityEntry[];
}

export async function countActiveClients(): Promise<number> {
  const { count, error } = await supabase
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('role', 'client')
    .eq('status', 'active');
  if (error) throw error;
  return count ?? 0;
}

export function useRecentActivity() {
  return useQuery({ queryKey: ['audit', 'recent'], queryFn: () => listRecentActivity() });
}

export function useActiveClientCount() {
  return useQuery({ queryKey: ['clients', 'active-count'], queryFn: countActiveClients });
}
