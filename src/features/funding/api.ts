import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { UserFacingError } from '@/lib/errors';
import { supabase } from '@/lib/supabase/client';
import { numericParam, toUserFacingDbError } from '@/lib/supabase/errors';

export type PaymentMethod = 'upi' | 'bank_transfer';
export type PaymentRequestStatus = 'submitted' | 'approved' | 'rejected';

export const METHOD_TEXT: Record<PaymentMethod, string> = { upi: 'UPI', bank_transfer: 'Bank transfer' };

// ------------------------------------------------------------------------------------------------
// Client (own data only, via SECURITY DEFINER functions)

export interface OpenCycle {
  cycle_id: string;
  cycle_name: string;
  cycle_status: string;
  start_date: string;
  end_date: string;
  base_nav: string;
}

export interface MyPaymentRequest {
  id: string;
  cycle_id: string;
  cycle_name: string;
  amount: string;
  paid_at: string;
  method: PaymentMethod;
  payer_upi_id: string | null;
  transaction_ref: string;
  status: PaymentRequestStatus;
  review_reason: string | null;
  reviewed_at: string | null;
  created_at: string;
}

export interface PaymentRequestInput {
  cycleId: string;
  amount: string;
  paidAt: string;
  method: PaymentMethod;
  payerUpiId: string;
  payerName: string;
  transactionRef: string;
  note: string;
}

async function clientRpc<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(fn as never, args as never);
  if (error) {
    if (error.code === '42501') throw new UserFacingError('Your account cannot do this.');
    throw new Error('This information could not be loaded. Please try again.');
  }
  return data as unknown as T;
}

export const fundingKeys = {
  all: ['funding'] as const,
  openCycles: () => ['funding', 'open-cycles'] as const,
  mine: () => ['funding', 'mine'] as const,
  register: (status: string) => ['funding', 'register', status] as const,
};

export function useOpenCycles() {
  return useQuery({
    queryKey: fundingKeys.openCycles(),
    queryFn: () => clientRpc<OpenCycle[]>('client_open_cycles'),
  });
}

export function useMyPaymentRequests() {
  return useQuery({
    queryKey: fundingKeys.mine(),
    queryFn: () => clientRpc<MyPaymentRequest[]>('client_my_payment_requests'),
  });
}

export function useSubmitPaymentRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: PaymentRequestInput) => {
      const { error } = await supabase.rpc('client_submit_payment_request', {
        p_cycle_id: v.cycleId,
        p_amount: numericParam(v.amount),
        p_paid_at: v.paidAt,
        p_method: v.method,
        p_payer_upi_id: v.payerUpiId,
        p_payer_name: v.payerName,
        p_transaction_ref: v.transactionRef,
        p_note: v.note,
      });
      if (error)
        throw toUserFacingDbError(error, 'Your payment details could not be sent. Please try again.');
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: fundingKeys.mine() }),
  });
}

// ------------------------------------------------------------------------------------------------
// Admin (RLS: admins only)

export interface PaymentRequestRow {
  id: string;
  client_id: string;
  client_name: string;
  client_email: string;
  cycle_id: string;
  cycle_name: string;
  cycle_status: string;
  amount: string;
  paid_at: string;
  method: PaymentMethod;
  payer_upi_id: string | null;
  payer_name: string | null;
  transaction_ref: string;
  note: string | null;
  status: PaymentRequestStatus;
  contribution_id: string | null;
  reviewed_at: string | null;
  review_reason: string | null;
  reviewer_name: string | null;
  created_at: string;
}

const REGISTER_COLUMNS =
  'id, client_id, client_name, client_email, cycle_id, cycle_name, cycle_status, amount::text, paid_at, method, payer_upi_id, payer_name, transaction_ref, note, status, contribution_id, reviewed_at, review_reason, reviewer_name, created_at';

export async function listPaymentRequests(status: PaymentRequestStatus | ''): Promise<PaymentRequestRow[]> {
  let q = supabase
    .from('payment_request_register')
    .select(REGISTER_COLUMNS)
    .order('created_at', { ascending: false })
    .limit(500);
  if (status) q = q.eq('status', status);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as unknown as PaymentRequestRow[];
}

export function usePaymentRequests(status: PaymentRequestStatus | '') {
  return useQuery({ queryKey: fundingKeys.register(status), queryFn: () => listPaymentRequests(status) });
}

export function useReviewPaymentRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { id: string; action: 'approve' | 'reject'; reason: string }) => {
      const fn = v.action === 'approve' ? 'admin_approve_payment_request' : 'admin_reject_payment_request';
      const { data, error } = await supabase.rpc(fn, { p_request_id: v.id, p_reason: v.reason });
      if (error) throw toUserFacingDbError(error);
      return v.action === 'approve' ? String(data as unknown) : null;
    },
    onSuccess: () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: fundingKeys.all }),
        qc.invalidateQueries({ queryKey: ['contributions'] }),
        qc.invalidateQueries({ queryKey: ['audit'] }),
      ]),
  });
}
