import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { AuditEntry } from '@/features/audit/api';
import type { ContributionRow, ContributionStatusFilter } from '@/features/contributions/types';
import { addDaysIso, startOfDayIST } from '@/lib/format';
import { supabase } from '@/lib/supabase/client';
import { isUuid } from '@/lib/utils/uuid';

/** Admin-only reporting reads (RLS). Exports are capped to keep the browser responsive. */
export const EXPORT_LIMIT = 5000;
export const AUDIT_PAGE_SIZE = 50;

export interface DateRange {
  /** YYYY-MM-DD (IST), inclusive; '' = open. */
  from: string;
  to: string;
}

const REGISTER_COLUMNS =
  'id, cycle_id, cycle_name, cycle_status, client_id, client_name, client_email, amount::text, received_at, method, reference_number, notes, status, applicable_nav::text, units_issued::text, verified_at, rejected_at, rejection_reason, reversed_at, reversal_reason, locked_fee_rate::text, reference_hwm::text, created_at';

export async function fetchContributionRegister(p: {
  cycleId: string;
  status: ContributionStatusFilter;
  range: DateRange;
  clientId?: string;
}): Promise<{ rows: ContributionRow[]; total: number }> {
  let q = supabase.from('contribution_register').select(REGISTER_COLUMNS, { count: 'exact' });
  if (isUuid(p.cycleId)) q = q.eq('cycle_id', p.cycleId);
  if (p.clientId && isUuid(p.clientId)) q = q.eq('client_id', p.clientId);
  if (p.status !== 'all') q = q.eq('status', p.status);
  if (p.range.from) q = q.gte('received_at', startOfDayIST(p.range.from));
  if (p.range.to) q = q.lt('received_at', startOfDayIST(addDaysIso(p.range.to, 1)));
  const { data, error, count } = await q
    .order('received_at', { ascending: true })
    .order('id')
    .range(0, EXPORT_LIMIT - 1);
  if (error) throw error;
  return { rows: (data ?? []) as unknown as ContributionRow[], total: count ?? 0 };
}

export function useContributionRegister(p: Parameters<typeof fetchContributionRegister>[0], enabled = true) {
  return useQuery({
    queryKey: ['reports', 'register', p],
    queryFn: () => fetchContributionRegister(p),
    placeholderData: keepPreviousData,
    enabled,
  });
}

// ------------------------------------------------------------------------------------------------
// Audit log
// ------------------------------------------------------------------------------------------------
export interface AuditRow extends AuditEntry {
  seq: number;
  entity_type: string;
  entity_id: string | null;
  actor_id: string | null;
}

export interface AuditFilters {
  entityType: string; // '' = all
  action: string; // '' = all, exact action
  actorId: string; // '' = all, 'system' = no actor
  range: DateRange;
}

const AUDIT_COLUMNS =
  'id, seq, action, entity_type, entity_id, actor_id, before_data, after_data, reason, created_at, actor:profiles!audit_logs_actor_id_fkey(full_name, email)';

function auditQuery(f: AuditFilters) {
  let q = supabase.from('audit_logs').select(AUDIT_COLUMNS, { count: 'exact' });
  if (f.entityType) q = q.eq('entity_type', f.entityType);
  if (f.action) q = q.eq('action', f.action);
  if (f.actorId === 'system') q = q.is('actor_id', null);
  else if (isUuid(f.actorId)) q = q.eq('actor_id', f.actorId);
  if (f.range.from) q = q.gte('created_at', startOfDayIST(f.range.from));
  if (f.range.to) q = q.lt('created_at', startOfDayIST(addDaysIso(f.range.to, 1)));
  return q.order('seq', { ascending: false });
}

export async function fetchAuditPage(f: AuditFilters, page: number) {
  const from = (page - 1) * AUDIT_PAGE_SIZE;
  const { data, error, count } = await auditQuery(f).range(from, from + AUDIT_PAGE_SIZE - 1);
  if (error) throw error;
  return { rows: (data ?? []) as unknown as AuditRow[], total: count ?? 0 };
}

export async function fetchAuditExport(f: AuditFilters) {
  const { data, error, count } = await auditQuery(f).range(0, EXPORT_LIMIT - 1);
  if (error) throw error;
  return { rows: (data ?? []) as unknown as AuditRow[], total: count ?? 0 };
}

export function useAuditPage(f: AuditFilters, page: number) {
  return useQuery({
    queryKey: ['audit', 'log', f, page],
    queryFn: () => fetchAuditPage(f, page),
    placeholderData: keepPreviousData,
  });
}

// ------------------------------------------------------------------------------------------------
// People
// ------------------------------------------------------------------------------------------------
export interface PersonOption {
  id: string;
  full_name: string;
  email: string;
  role: 'admin' | 'client';
  status: 'active' | 'inactive';
}

export async function listPeople(): Promise<PersonOption[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, email, role, status')
    .order('full_name')
    .limit(2000);
  if (error) throw error;
  return (data ?? []) as PersonOption[];
}

export function usePeople() {
  return useQuery({ queryKey: ['clients', 'people'], queryFn: listPeople });
}
