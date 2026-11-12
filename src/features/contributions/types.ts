import type { CycleStatus } from '@/features/cycles/types';
import type { Database } from '@/lib/supabase/database.types';

export type ContributionStatus = Database['public']['Enums']['contribution_status'];
export type ContributionMethod = Database['public']['Enums']['contribution_method'];

/** Row of the contribution_register view. NUMERIC columns arrive as strings (`::text`). */
export interface ContributionRow {
  id: string;
  cycle_id: string;
  cycle_name: string;
  cycle_status: CycleStatus;
  client_id: string;
  client_name: string;
  client_email: string;
  amount: string;
  received_at: string;
  method: ContributionMethod;
  reference_number: string | null;
  notes: string | null;
  status: ContributionStatus;
  applicable_nav: string | null;
  units_issued: string | null;
  verified_at: string | null;
  rejected_at: string | null;
  rejection_reason: string | null;
  reversed_at: string | null;
  reversal_reason: string | null;
  locked_fee_rate: string | null;
  reference_hwm: string | null;
  created_at: string;
}

export type ContributionStatusFilter = 'all' | ContributionStatus;

export interface ContributionListParams {
  q: string;
  status: ContributionStatusFilter;
  cycle: string; // '' = all cycles
  page: number;
}

export const CONTRIBUTIONS_PAGE_SIZE = 20;

export const METHOD_LABEL: Record<ContributionMethod, string> = {
  upi: 'UPI',
  bank_transfer: 'Bank transfer',
  cheque: 'Cheque',
  other: 'Other',
};

export const REFERENCE_HINT: Record<ContributionMethod, string> = {
  upi: 'UPI transaction ID',
  bank_transfer: 'UTR number',
  cheque: 'Cheque number',
  other: 'Any reference',
};

export interface VerificationPreview {
  applicable_nav: string;
  units: string;
  fee_rate: string;
  fee_version: number;
}

export interface CycleUnitSummary {
  cycle_id: string;
  outstanding_units: string;
  net_contributed: string;
  pending_count: number;
  pending_amount: string;
  investor_count: number;
}

export interface ClientHolding {
  cycle_id: string;
  cycle_name: string;
  cycle_status: CycleStatus;
  units: string;
  net_contributed: string;
  lots_issued: number;
  lots_reversed: number;
}
