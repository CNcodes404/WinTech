import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { useSearchParams } from 'react-router';
import { UserFacingError } from '@/lib/errors';
import { supabase } from '@/lib/supabase/client';
import { isUuid } from '@/lib/utils/uuid';

/**
 * Client portal data. Every call goes through a SECURITY DEFINER function that returns only the
 * signed-in client's own rows and only client-safe columns (no admin notes or reasons, and never any
 * performance-fee data: clients see the NAV after the performance fee, the admin fee and final profit).
 */

export interface ClientCycle {
  cycle_id: string;
  cycle_name: string;
  cycle_status: string;
  start_date: string;
  end_date: string;
  base_nav: string;
  units: string;
  net_contributed: string;
  latest_nav_date: string | null;
  /** NAV per unit clients see (after performance fee); null until a NAV is published. */
  latest_nav: string | null;
  /** units × latest NAV (or base NAV before the first NAV). */
  current_value: string;
  profit: string;
  admin_fee: string;
  final_profit: string;
  final_value: string;
}

export interface ClientContribution {
  id: string;
  cycle_id: string;
  cycle_name: string;
  amount: string;
  received_at: string;
  method: 'upi' | 'bank_transfer' | 'cheque' | 'other';
  reference_number: string | null;
  status: 'pending' | 'verified' | 'rejected' | 'reversed';
  applicable_nav: string | null;
  units_issued: string | null;
  verified_at: string | null;
  rejected_at: string | null;
  reversed_at: string | null;
}

export interface ClientNavPoint {
  nav_date: string;
  nav_per_unit: string;
}

export type ActivityKind =
  | 'contribution_recorded'
  | 'units_issued'
  | 'contribution_rejected'
  | 'contribution_reversed'
  | 'nav_published';

export interface ClientActivity {
  occurred_at: string;
  kind: ActivityKind;
  cycle_name: string;
  amount: string | null;
  units: string | null;
  nav: string | null;
}

async function rpc<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(fn as never, args as never);
  if (error) {
    if (error.code === '42501') throw new UserFacingError('Your account cannot view this information.');
    throw new Error('Your information could not be loaded. Please try again.');
  }
  return data as unknown as T;
}

export const portalKeys = {
  all: ['portal'] as const,
  cycles: () => ['portal', 'cycles'] as const,
  contributions: () => ['portal', 'contributions'] as const,
  nav: (cycleId: string) => ['portal', 'nav', cycleId] as const,
  activity: () => ['portal', 'activity'] as const,
};

export function useMyCycles() {
  return useQuery({ queryKey: portalKeys.cycles(), queryFn: () => rpc<ClientCycle[]>('client_my_cycles') });
}

export function useMyContributions() {
  return useQuery({
    queryKey: portalKeys.contributions(),
    queryFn: () => rpc<ClientContribution[]>('client_my_contributions'),
  });
}

export function useMyNavHistory(cycleId: string) {
  return useQuery({
    queryKey: portalKeys.nav(cycleId),
    queryFn: () => rpc<ClientNavPoint[]>('client_nav_history', { p_cycle_id: cycleId }),
    enabled: isUuid(cycleId),
  });
}

export function useMyActivity() {
  return useQuery({
    queryKey: portalKeys.activity(),
    queryFn: () => rpc<ClientActivity[]>('client_my_activity', { p_limit: 100 }),
  });
}

/** Selected cycle from the URL (?cycle=), defaulting to the client's most recent cycle. */
export function useSelectedClientCycle() {
  const cycles = useMyCycles();
  const [sp, setSp] = useSearchParams();
  const requested = sp.get('cycle');
  const cycle = cycles.data?.find((c) => c.cycle_id === requested) ?? cycles.data?.[0];
  const select = useCallback((id: string) => setSp({ cycle: id }, { replace: true }), [setSp]);
  return { cycles, cycle, select };
}

/** Clients may edit their own name and phone (column grants + RLS; audited by trigger). */
export function useUpdateMyContact(userId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { fullName: string; phone: string }) => {
      const { data, error } = await supabase
        .from('profiles')
        .update({ full_name: v.fullName.trim(), phone: v.phone.trim() || null })
        .eq('id', userId)
        .select('id');
      if (error) {
        if (error.code === '23514') throw new UserFacingError('The phone number is not in a valid format.');
        throw new Error('Your details could not be saved. Please try again.');
      }
      if (!data || data.length === 0) throw new UserFacingError('Your details could not be saved.');
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['auth', 'profile'] }),
  });
}
