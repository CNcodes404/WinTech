import type { Database } from '@/lib/supabase/database.types';

export type ValuationStatus = Database['public']['Enums']['valuation_status'];

/** NUMERIC columns arrive as strings (`::text`). */
export interface Valuation {
  id: string;
  cycle_id: string;
  valuation_at: string;
  source: string;
  status: ValuationStatus;
  cash_balance: string;
  other_assets: string;
  liabilities: string;
  holdings_value: string;
  gross_asset_value: string;
  gross_net_asset_value: string;
  notes: string | null;
  corrects_valuation_id: string | null;
  superseded_by: string | null;
  approved_at: string | null;
  superseded_at: string | null;
  discarded_at: string | null;
  created_at: string;
  updated_at: string;
  item_count?: number;
}

export interface ValuationItem {
  id: string;
  line_no: number;
  symbol: string;
  instrument_name: string | null;
  exchange: Exchange | null;
  quantity: string;
  valuation_price: string;
  market_value: string;
  average_cost: string | null;
  notes: string | null;
}

export type Exchange = 'NSE' | 'BSE' | 'OTHER';

export const EXCHANGE_LABEL: Record<Exchange, string> = { NSE: 'NSE', BSE: 'BSE', OTHER: 'Other' };

export const VALUATION_STATUS_LABEL: Record<ValuationStatus, string> = {
  draft: 'Draft',
  approved: 'Approved',
  superseded: 'Superseded',
  discarded: 'Discarded',
};
