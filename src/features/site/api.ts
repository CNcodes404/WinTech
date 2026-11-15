import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/client';
import { toUserFacingDbError } from '@/lib/supabase/errors';

export interface EnquiryInput {
  fullName: string;
  email: string;
  phone: string;
  city: string;
  interest: string;
  message: string;
  consent: boolean;
  /** Honeypot; real visitors leave it empty. */
  website: string;
}

/** Public: anyone (signed in or not) may submit. Validation and rate limits are enforced server-side. */
export async function submitEnquiry(v: EnquiryInput): Promise<void> {
  const { error } = await supabase.rpc('submit_enquiry', {
    p_full_name: v.fullName,
    p_email: v.email,
    p_phone: v.phone,
    p_city: v.city,
    p_interest: v.interest,
    p_message: v.message,
    p_consent: v.consent,
    p_website: v.website,
  });
  if (error) throw toUserFacingDbError(error, 'Your enquiry could not be sent. Please try again.');
}

export function useSubmitEnquiry() {
  return useMutation({ mutationFn: submitEnquiry });
}

// ------------------------------------------------------------------------------------------------
// Admin (RLS: admins only)

export type EnquiryStatus = 'new' | 'contacted' | 'closed';

export interface Enquiry {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  city: string | null;
  interest: string;
  message: string;
  status: EnquiryStatus;
  admin_note: string | null;
  created_at: string;
  updated_at: string;
}

export async function listEnquiries(status: EnquiryStatus | ''): Promise<Enquiry[]> {
  let q = supabase
    .from('enquiries')
    .select(
      'id, full_name, email, phone, city, interest, message, status, admin_note, created_at, updated_at',
    )
    .order('created_at', { ascending: false })
    .limit(500);
  if (status) q = q.eq('status', status);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as Enquiry[];
}

export async function setEnquiryStatus(id: string, status: EnquiryStatus, note: string): Promise<void> {
  const { error } = await supabase.rpc('admin_set_enquiry_status', {
    p_enquiry_id: id,
    p_status: status,
    p_note: note,
  });
  if (error) throw toUserFacingDbError(error);
}

export const enquiryKeys = {
  all: ['enquiries'] as const,
  list: (status: string) => ['enquiries', 'list', status] as const,
};

export function useEnquiries(status: EnquiryStatus | '') {
  return useQuery({ queryKey: enquiryKeys.list(status), queryFn: () => listEnquiries(status) });
}

export function useSetEnquiryStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: string; status: EnquiryStatus; note: string }) =>
      setEnquiryStatus(v.id, v.status, v.note),
    onSuccess: () => qc.invalidateQueries({ queryKey: enquiryKeys.all }),
  });
}
