import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/client';
import type { Json } from '@/lib/supabase/database.types';

/** Admin-only (RLS): history of one entity from the append-only audit log. */
export type AuditEntityType = 'profile' | 'cycle' | 'contribution' | 'valuation';

export interface AuditEntry {
  id: string;
  action: string;
  before_data: Json | null;
  after_data: Json | null;
  reason: string | null;
  created_at: string;
  actor: { full_name: string; email: string } | null;
}

export const auditKeys = {
  all: ['audit'] as const,
  entity: (type: AuditEntityType, id: string) => ['audit', type, id] as const,
};

export async function listEntityHistory(
  type: AuditEntityType,
  id: string,
  limit = 50,
): Promise<AuditEntry[]> {
  const { data, error } = await supabase
    .from('audit_logs')
    .select(
      'id, action, before_data, after_data, reason, created_at, actor:profiles!audit_logs_actor_id_fkey(full_name, email)',
    )
    .eq('entity_type', type)
    .eq('entity_id', id)
    .order('seq', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as unknown as AuditEntry[];
}

export function useEntityHistory(type: AuditEntityType, id: string) {
  return useQuery({ queryKey: auditKeys.entity(type, id), queryFn: () => listEntityHistory(type, id) });
}

/** Read a JSON audit payload as a plain object. */
export function jsonObject(j: Json | null): Record<string, Json | undefined> {
  return j && typeof j === 'object' && !Array.isArray(j) ? j : {};
}
