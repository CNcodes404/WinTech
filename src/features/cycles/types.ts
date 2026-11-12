import type { Database } from '@/lib/supabase/database.types';

export type CycleStatus = Database['public']['Enums']['cycle_status'];

/** NUMERIC columns are selected as text (`col::text`) so they never pass through JS floats. */
export interface CycleOverview {
  id: string;
  name: string;
  description: string | null;
  start_date: string;
  end_date: string;
  status: CycleStatus;
  base_nav: string;
  currency: string;
  created_at: string;
  updated_at: string;
  current_fee_rate: string | null;
  current_fee_version: number | null;
  current_fee_effective_from: string | null;
  pending_fee_rate: string | null;
  pending_fee_version: number | null;
  pending_fee_effective_from: string | null;
}

export interface FeeTerms {
  id: string;
  version: number;
  performance_fee_rate: string;
  fee_policy: string;
  effective_from: string;
  reason: string;
  created_at: string;
  cancelled_at: string | null;
  cancel_reason: string | null;
  creator: { full_name: string; email: string } | null;
}

export type FeeTermsState = 'current' | 'scheduled' | 'superseded' | 'cancelled';

export interface StatusStep {
  next: CycleStatus;
  action: string;
  title: string;
  description: string;
  tone: 'primary' | 'danger';
}

/** Forward-only lifecycle (mirrors the database guard trigger). */
export const NEXT_STATUS: Record<CycleStatus, StatusStep | null> = {
  draft: {
    next: 'open',
    action: 'Open for contributions',
    title: 'Open this cycle for contributions?',
    description: 'Contributions can then be recorded against this cycle. The base NAV becomes locked.',
    tone: 'primary',
  },
  open: {
    next: 'active',
    action: 'Mark as active',
    title: 'Mark this cycle as active?',
    description: 'Use this when capital has been deployed. The start and end dates become locked.',
    tone: 'primary',
  },
  active: {
    next: 'closed',
    action: 'Close cycle',
    title: 'Close this cycle?',
    description:
      'A closed cycle cannot be reopened, edited or have its fee rate changed. This cannot be undone.',
    tone: 'danger',
  },
  closed: {
    next: 'settled',
    action: 'Mark as settled',
    title: 'Mark this cycle as settled?',
    description: 'Informational only in V1. No payouts or withdrawals are processed by the app.',
    tone: 'primary',
  },
  settled: null,
};

export const STATUS_LABEL: Record<CycleStatus, string> = {
  draft: 'Draft',
  open: 'Open',
  active: 'Active',
  closed: 'Closed',
  settled: 'Settled',
};
