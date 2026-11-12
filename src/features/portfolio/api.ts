import { supabase } from '@/lib/supabase/client';
import { toUserFacingDbError } from '@/lib/supabase/errors';
import type { Valuation, ValuationItem } from './types';

/** Admin-only (RLS). All totals are computed by Postgres; NUMERIC columns are selected as text. */

const VALUATION_COLUMNS = [
  'id',
  'cycle_id',
  'valuation_at',
  'source',
  'status',
  'cash_balance::text',
  'other_assets::text',
  'liabilities::text',
  'holdings_value::text',
  'gross_asset_value::text',
  'gross_net_asset_value::text',
  'notes',
  'corrects_valuation_id',
  'superseded_by',
  'approved_at',
  'superseded_at',
  'discarded_at',
  'created_at',
  'updated_at',
].join(', ');

const ITEM_COLUMNS =
  'id, line_no, symbol, instrument_name, exchange, quantity::text, valuation_price::text, market_value::text, average_cost::text, notes';

export async function listValuations(cycleId: string): Promise<Valuation[]> {
  const { data, error } = await supabase
    .from('portfolio_valuations')
    .select(`${VALUATION_COLUMNS}, items:portfolio_valuation_items(count)`)
    .eq('cycle_id', cycleId)
    .order('valuation_at', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) throw error;
  return ((data ?? []) as unknown as (Valuation & { items: { count: number }[] })[]).map(
    ({ items, ...v }) => ({
      ...v,
      item_count: items?.[0]?.count ?? 0,
    }),
  );
}

export async function getValuation(
  id: string,
): Promise<{ valuation: Valuation; items: ValuationItem[] } | null> {
  const { data, error } = await supabase
    .from('portfolio_valuations')
    .select(VALUATION_COLUMNS)
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const items = await supabase
    .from('portfolio_valuation_items')
    .select(ITEM_COLUMNS)
    .eq('valuation_id', id)
    .order('line_no');
  if (items.error) throw items.error;
  return { valuation: data as unknown as Valuation, items: (items.data ?? []) as unknown as ValuationItem[] };
}

export interface SaveDraftParams {
  valuationId: string | null;
  cycleId: string;
  valuationAt: string; // ISO timestamp
  cashBalance: string;
  otherAssets: string;
  liabilities: string;
  notes: string;
  correctsId: string | null;
  items: {
    symbol: string;
    instrument_name: string;
    exchange: string;
    quantity: string;
    valuation_price: string;
    average_cost: string;
    notes: string;
  }[];
}

export async function saveValuationDraft(p: SaveDraftParams): Promise<string> {
  const { data, error } = await supabase.rpc('admin_save_valuation_draft', {
    p_valuation_id: p.valuationId as string,
    p_cycle_id: p.cycleId,
    p_valuation_at: p.valuationAt,
    p_cash_balance: p.cashBalance,
    p_other_assets: p.otherAssets,
    p_liabilities: p.liabilities,
    p_notes: p.notes,
    p_items: p.items,
    p_corrects_id: (p.correctsId ?? undefined) as string | undefined,
  });
  if (error) throw toUserFacingDbError(error, 'The valuation could not be saved. Please try again.');
  return data as string;
}

export async function approveValuation(id: string, reason: string): Promise<void> {
  const { error } = await supabase.rpc('admin_approve_valuation', { p_valuation_id: id, p_reason: reason });
  if (error) throw toUserFacingDbError(error);
}

export async function discardValuationDraft(id: string, reason: string): Promise<void> {
  const { error } = await supabase.rpc('admin_discard_valuation_draft', {
    p_valuation_id: id,
    p_reason: reason,
  });
  if (error) throw toUserFacingDbError(error);
}
