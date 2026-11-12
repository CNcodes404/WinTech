import type { Database } from '@/lib/supabase/database.types';

export type NavStatus = Database['public']['Enums']['nav_snapshot_status'];

/** NUMERIC columns arrive as strings (`::text`). */
export interface NavSnapshot {
  id: string;
  cycle_id: string;
  valuation_id: string;
  nav_date: string;
  total_outstanding_units: string;
  gross_net_asset_value: string;
  gross_nav_per_unit: string;
  net_nav_per_unit: string | null;
  performance_fee_amount: string | null;
  calculation_version: string;
  status: NavStatus;
  corrects_snapshot_id: string | null;
  corrected_by_snapshot_id: string | null;
  calculated_at: string;
  published_at: string | null;
  publish_reason: string | null;
  corrected_at: string | null;
}

export const NAV_STATUS_LABEL: Record<NavStatus, string> = {
  draft: 'Draft',
  published: 'Published',
  corrected: 'Corrected',
  discarded: 'Discarded',
};
