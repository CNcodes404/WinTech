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
  performance_fee_rate: string | null;
  /** fund_level_v2: money invested as of the NAV time, and profit before the performance fee. */
  net_contributed: string | null;
  profit_before_fee: string | null;
  calculation_version: string;
  status: NavStatus;
  corrects_snapshot_id: string | null;
  corrected_by_snapshot_id: string | null;
  calculated_at: string;
  published_at: string | null;
  publish_reason: string | null;
  corrected_at: string | null;
}

export const FUND_LEVEL = 'fund_level_v2';

/** The NAV clients see: after the performance fee (fund_level_v2), else gross. */
export function clientNav(s: Pick<NavSnapshot, 'net_nav_per_unit' | 'gross_nav_per_unit'>): string {
  return s.net_nav_per_unit ?? s.gross_nav_per_unit;
}

export const NAV_STATUS_LABEL: Record<NavStatus, string> = {
  draft: 'Draft',
  published: 'Published',
  corrected: 'Corrected',
  discarded: 'Discarded',
};
