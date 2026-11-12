export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: '14.18';
  };
  public: {
    Tables: {
      audit_logs: {
        Row: {
          action: string;
          actor_id: string | null;
          after_data: Json | null;
          before_data: Json | null;
          created_at: string;
          entity_id: string | null;
          entity_type: string;
          id: string;
          reason: string | null;
          seq: number;
        };
        Insert: {
          action: string;
          actor_id?: string | null;
          after_data?: Json | null;
          before_data?: Json | null;
          created_at?: string;
          entity_id?: string | null;
          entity_type: string;
          id?: string;
          reason?: string | null;
          seq?: never;
        };
        Update: {
          action?: string;
          actor_id?: string | null;
          after_data?: Json | null;
          before_data?: Json | null;
          created_at?: string;
          entity_id?: string | null;
          entity_type?: string;
          id?: string;
          reason?: string | null;
          seq?: never;
        };
        Relationships: [
          {
            foreignKeyName: 'audit_logs_actor_id_fkey';
            columns: ['actor_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      client_unit_allocations: {
        Row: {
          amount: number;
          client_id: string;
          contribution_id: string;
          created_at: string;
          created_by: string;
          cycle_id: string;
          entry_nav: number;
          entry_type: Database['public']['Enums']['allocation_entry_type'];
          fee_rate: number;
          fee_terms_id: string;
          id: string;
          loss_carry_forward: number;
          reference_hwm: number;
          units: number;
        };
        Insert: {
          amount: number;
          client_id: string;
          contribution_id: string;
          created_at?: string;
          created_by: string;
          cycle_id: string;
          entry_nav: number;
          entry_type: Database['public']['Enums']['allocation_entry_type'];
          fee_rate: number;
          fee_terms_id: string;
          id?: string;
          loss_carry_forward?: number;
          reference_hwm: number;
          units: number;
        };
        Update: {
          amount?: number;
          client_id?: string;
          contribution_id?: string;
          created_at?: string;
          created_by?: string;
          cycle_id?: string;
          entry_nav?: number;
          entry_type?: Database['public']['Enums']['allocation_entry_type'];
          fee_rate?: number;
          fee_terms_id?: string;
          id?: string;
          loss_carry_forward?: number;
          reference_hwm?: number;
          units?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'client_unit_allocations_client_id_fkey';
            columns: ['client_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'client_unit_allocations_contribution_id_fkey';
            columns: ['contribution_id'];
            isOneToOne: false;
            referencedRelation: 'contribution_register';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'client_unit_allocations_contribution_id_fkey';
            columns: ['contribution_id'];
            isOneToOne: false;
            referencedRelation: 'contributions';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'client_unit_allocations_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'client_unit_allocations_cycle_id_fkey';
            columns: ['cycle_id'];
            isOneToOne: false;
            referencedRelation: 'cycle_overview';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'client_unit_allocations_cycle_id_fkey';
            columns: ['cycle_id'];
            isOneToOne: false;
            referencedRelation: 'cycle_unit_summary';
            referencedColumns: ['cycle_id'];
          },
          {
            foreignKeyName: 'client_unit_allocations_cycle_id_fkey';
            columns: ['cycle_id'];
            isOneToOne: false;
            referencedRelation: 'investment_cycles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'client_unit_allocations_fee_terms_id_fkey';
            columns: ['fee_terms_id'];
            isOneToOne: false;
            referencedRelation: 'cycle_fee_terms';
            referencedColumns: ['id'];
          },
        ];
      };
      contributions: {
        Row: {
          amount: number;
          applicable_nav: number | null;
          client_id: string;
          created_at: string;
          cycle_id: string;
          id: string;
          method: Database['public']['Enums']['contribution_method'];
          notes: string | null;
          proof_storage_path: string | null;
          received_at: string;
          recorded_by: string;
          reference_number: string | null;
          rejected_at: string | null;
          rejected_by: string | null;
          rejection_reason: string | null;
          reversal_reason: string | null;
          reversed_at: string | null;
          reversed_by: string | null;
          status: Database['public']['Enums']['contribution_status'];
          units_issued: number | null;
          updated_at: string;
          verified_at: string | null;
          verified_by: string | null;
        };
        Insert: {
          amount: number;
          applicable_nav?: number | null;
          client_id: string;
          created_at?: string;
          cycle_id: string;
          id?: string;
          method: Database['public']['Enums']['contribution_method'];
          notes?: string | null;
          proof_storage_path?: string | null;
          received_at: string;
          recorded_by: string;
          reference_number?: string | null;
          rejected_at?: string | null;
          rejected_by?: string | null;
          rejection_reason?: string | null;
          reversal_reason?: string | null;
          reversed_at?: string | null;
          reversed_by?: string | null;
          status?: Database['public']['Enums']['contribution_status'];
          units_issued?: number | null;
          updated_at?: string;
          verified_at?: string | null;
          verified_by?: string | null;
        };
        Update: {
          amount?: number;
          applicable_nav?: number | null;
          client_id?: string;
          created_at?: string;
          cycle_id?: string;
          id?: string;
          method?: Database['public']['Enums']['contribution_method'];
          notes?: string | null;
          proof_storage_path?: string | null;
          received_at?: string;
          recorded_by?: string;
          reference_number?: string | null;
          rejected_at?: string | null;
          rejected_by?: string | null;
          rejection_reason?: string | null;
          reversal_reason?: string | null;
          reversed_at?: string | null;
          reversed_by?: string | null;
          status?: Database['public']['Enums']['contribution_status'];
          units_issued?: number | null;
          updated_at?: string;
          verified_at?: string | null;
          verified_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'contributions_client_id_fkey';
            columns: ['client_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'contributions_cycle_id_fkey';
            columns: ['cycle_id'];
            isOneToOne: false;
            referencedRelation: 'cycle_overview';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'contributions_cycle_id_fkey';
            columns: ['cycle_id'];
            isOneToOne: false;
            referencedRelation: 'cycle_unit_summary';
            referencedColumns: ['cycle_id'];
          },
          {
            foreignKeyName: 'contributions_cycle_id_fkey';
            columns: ['cycle_id'];
            isOneToOne: false;
            referencedRelation: 'investment_cycles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'contributions_recorded_by_fkey';
            columns: ['recorded_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'contributions_rejected_by_fkey';
            columns: ['rejected_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'contributions_reversed_by_fkey';
            columns: ['reversed_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'contributions_verified_by_fkey';
            columns: ['verified_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      cycle_fee_terms: {
        Row: {
          cancel_reason: string | null;
          cancelled_at: string | null;
          cancelled_by: string | null;
          created_at: string;
          created_by: string;
          cycle_id: string;
          effective_from: string;
          fee_policy: string;
          id: string;
          performance_fee_rate: number;
          reason: string;
          version: number;
        };
        Insert: {
          cancel_reason?: string | null;
          cancelled_at?: string | null;
          cancelled_by?: string | null;
          created_at?: string;
          created_by: string;
          cycle_id: string;
          effective_from: string;
          fee_policy?: string;
          id?: string;
          performance_fee_rate: number;
          reason: string;
          version: number;
        };
        Update: {
          cancel_reason?: string | null;
          cancelled_at?: string | null;
          cancelled_by?: string | null;
          created_at?: string;
          created_by?: string;
          cycle_id?: string;
          effective_from?: string;
          fee_policy?: string;
          id?: string;
          performance_fee_rate?: number;
          reason?: string;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'cycle_fee_terms_cancelled_by_fkey';
            columns: ['cancelled_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'cycle_fee_terms_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'cycle_fee_terms_cycle_id_fkey';
            columns: ['cycle_id'];
            isOneToOne: false;
            referencedRelation: 'cycle_overview';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'cycle_fee_terms_cycle_id_fkey';
            columns: ['cycle_id'];
            isOneToOne: false;
            referencedRelation: 'cycle_unit_summary';
            referencedColumns: ['cycle_id'];
          },
          {
            foreignKeyName: 'cycle_fee_terms_cycle_id_fkey';
            columns: ['cycle_id'];
            isOneToOne: false;
            referencedRelation: 'investment_cycles';
            referencedColumns: ['id'];
          },
        ];
      };
      fee_crystallisations: {
        Row: {
          cycle_id: string;
          id: string;
          net_nav_per_unit: number;
          note: string;
          recorded_at: string;
          recorded_by: string;
          snapshot_id: string;
          total_fee_amount: number;
        };
        Insert: {
          cycle_id: string;
          id?: string;
          net_nav_per_unit: number;
          note: string;
          recorded_at?: string;
          recorded_by: string;
          snapshot_id: string;
          total_fee_amount: number;
        };
        Update: {
          cycle_id?: string;
          id?: string;
          net_nav_per_unit?: number;
          note?: string;
          recorded_at?: string;
          recorded_by?: string;
          snapshot_id?: string;
          total_fee_amount?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'fee_crystallisations_cycle_id_fkey';
            columns: ['cycle_id'];
            isOneToOne: true;
            referencedRelation: 'cycle_overview';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'fee_crystallisations_cycle_id_fkey';
            columns: ['cycle_id'];
            isOneToOne: true;
            referencedRelation: 'cycle_unit_summary';
            referencedColumns: ['cycle_id'];
          },
          {
            foreignKeyName: 'fee_crystallisations_cycle_id_fkey';
            columns: ['cycle_id'];
            isOneToOne: true;
            referencedRelation: 'investment_cycles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'fee_crystallisations_recorded_by_fkey';
            columns: ['recorded_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'fee_crystallisations_snapshot_id_fkey';
            columns: ['snapshot_id'];
            isOneToOne: false;
            referencedRelation: 'nav_snapshots';
            referencedColumns: ['id'];
          },
        ];
      };
      investment_cycles: {
        Row: {
          base_nav: number;
          created_at: string;
          created_by: string;
          currency: string;
          description: string | null;
          end_date: string;
          id: string;
          name: string;
          start_date: string;
          status: Database['public']['Enums']['cycle_status'];
          updated_at: string;
        };
        Insert: {
          base_nav?: number;
          created_at?: string;
          created_by: string;
          currency?: string;
          description?: string | null;
          end_date: string;
          id?: string;
          name: string;
          start_date: string;
          status?: Database['public']['Enums']['cycle_status'];
          updated_at?: string;
        };
        Update: {
          base_nav?: number;
          created_at?: string;
          created_by?: string;
          currency?: string;
          description?: string | null;
          end_date?: string;
          id?: string;
          name?: string;
          start_date?: string;
          status?: Database['public']['Enums']['cycle_status'];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'investment_cycles_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      lot_fee_accruals: {
        Row: {
          client_id: string;
          contribution_id: string;
          created_at: string;
          cycle_id: string;
          eligible_profit_per_unit: number;
          entry_nav: number;
          fee_amount: number;
          fee_rate: number;
          gross_nav_per_unit: number;
          gross_value: number;
          id: string;
          loss_to_recover: number;
          method: string;
          net_value: number;
          reference_hwm: number;
          snapshot_id: string;
          units: number;
        };
        Insert: {
          client_id: string;
          contribution_id: string;
          created_at?: string;
          cycle_id: string;
          eligible_profit_per_unit: number;
          entry_nav: number;
          fee_amount: number;
          fee_rate: number;
          gross_nav_per_unit: number;
          gross_value: number;
          id?: string;
          loss_to_recover: number;
          method?: string;
          net_value: number;
          reference_hwm: number;
          snapshot_id: string;
          units: number;
        };
        Update: {
          client_id?: string;
          contribution_id?: string;
          created_at?: string;
          cycle_id?: string;
          eligible_profit_per_unit?: number;
          entry_nav?: number;
          fee_amount?: number;
          fee_rate?: number;
          gross_nav_per_unit?: number;
          gross_value?: number;
          id?: string;
          loss_to_recover?: number;
          method?: string;
          net_value?: number;
          reference_hwm?: number;
          snapshot_id?: string;
          units?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'lot_fee_accruals_client_id_fkey';
            columns: ['client_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'lot_fee_accruals_contribution_id_fkey';
            columns: ['contribution_id'];
            isOneToOne: false;
            referencedRelation: 'contribution_register';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'lot_fee_accruals_contribution_id_fkey';
            columns: ['contribution_id'];
            isOneToOne: false;
            referencedRelation: 'contributions';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'lot_fee_accruals_cycle_id_fkey';
            columns: ['cycle_id'];
            isOneToOne: false;
            referencedRelation: 'cycle_overview';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'lot_fee_accruals_cycle_id_fkey';
            columns: ['cycle_id'];
            isOneToOne: false;
            referencedRelation: 'cycle_unit_summary';
            referencedColumns: ['cycle_id'];
          },
          {
            foreignKeyName: 'lot_fee_accruals_cycle_id_fkey';
            columns: ['cycle_id'];
            isOneToOne: false;
            referencedRelation: 'investment_cycles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'lot_fee_accruals_snapshot_id_fkey';
            columns: ['snapshot_id'];
            isOneToOne: false;
            referencedRelation: 'nav_snapshots';
            referencedColumns: ['id'];
          },
        ];
      };
      nav_snapshots: {
        Row: {
          calculated_at: string;
          calculation_version: string;
          corrected_at: string | null;
          corrected_by_snapshot_id: string | null;
          corrects_snapshot_id: string | null;
          created_at: string;
          created_by: string;
          cycle_id: string;
          discarded_at: string | null;
          gross_nav_per_unit: number;
          gross_net_asset_value: number;
          id: string;
          nav_date: string;
          net_nav_per_unit: number | null;
          performance_fee_amount: number | null;
          performance_fee_rate: number | null;
          publish_reason: string | null;
          published_at: string | null;
          published_by: string | null;
          status: Database['public']['Enums']['nav_snapshot_status'];
          total_outstanding_units: number;
          updated_at: string;
          valuation_id: string;
        };
        Insert: {
          calculated_at?: string;
          calculation_version?: string;
          corrected_at?: string | null;
          corrected_by_snapshot_id?: string | null;
          corrects_snapshot_id?: string | null;
          created_at?: string;
          created_by: string;
          cycle_id: string;
          discarded_at?: string | null;
          gross_nav_per_unit: number;
          gross_net_asset_value: number;
          id?: string;
          nav_date: string;
          net_nav_per_unit?: number | null;
          performance_fee_amount?: number | null;
          performance_fee_rate?: number | null;
          publish_reason?: string | null;
          published_at?: string | null;
          published_by?: string | null;
          status?: Database['public']['Enums']['nav_snapshot_status'];
          total_outstanding_units: number;
          updated_at?: string;
          valuation_id: string;
        };
        Update: {
          calculated_at?: string;
          calculation_version?: string;
          corrected_at?: string | null;
          corrected_by_snapshot_id?: string | null;
          corrects_snapshot_id?: string | null;
          created_at?: string;
          created_by?: string;
          cycle_id?: string;
          discarded_at?: string | null;
          gross_nav_per_unit?: number;
          gross_net_asset_value?: number;
          id?: string;
          nav_date?: string;
          net_nav_per_unit?: number | null;
          performance_fee_amount?: number | null;
          performance_fee_rate?: number | null;
          publish_reason?: string | null;
          published_at?: string | null;
          published_by?: string | null;
          status?: Database['public']['Enums']['nav_snapshot_status'];
          total_outstanding_units?: number;
          updated_at?: string;
          valuation_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'nav_snapshots_corrected_by_snapshot_id_fkey';
            columns: ['corrected_by_snapshot_id'];
            isOneToOne: false;
            referencedRelation: 'nav_snapshots';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'nav_snapshots_corrects_snapshot_id_fkey';
            columns: ['corrects_snapshot_id'];
            isOneToOne: false;
            referencedRelation: 'nav_snapshots';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'nav_snapshots_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'nav_snapshots_cycle_id_fkey';
            columns: ['cycle_id'];
            isOneToOne: false;
            referencedRelation: 'cycle_overview';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'nav_snapshots_cycle_id_fkey';
            columns: ['cycle_id'];
            isOneToOne: false;
            referencedRelation: 'cycle_unit_summary';
            referencedColumns: ['cycle_id'];
          },
          {
            foreignKeyName: 'nav_snapshots_cycle_id_fkey';
            columns: ['cycle_id'];
            isOneToOne: false;
            referencedRelation: 'investment_cycles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'nav_snapshots_published_by_fkey';
            columns: ['published_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'nav_snapshots_valuation_id_fkey';
            columns: ['valuation_id'];
            isOneToOne: false;
            referencedRelation: 'portfolio_valuations';
            referencedColumns: ['id'];
          },
        ];
      };
      portfolio_valuation_items: {
        Row: {
          average_cost: number | null;
          exchange: string | null;
          id: string;
          instrument_name: string | null;
          line_no: number;
          market_value: number;
          notes: string | null;
          quantity: number;
          symbol: string;
          valuation_id: string;
          valuation_price: number;
        };
        Insert: {
          average_cost?: number | null;
          exchange?: string | null;
          id?: string;
          instrument_name?: string | null;
          line_no: number;
          market_value: number;
          notes?: string | null;
          quantity: number;
          symbol: string;
          valuation_id: string;
          valuation_price: number;
        };
        Update: {
          average_cost?: number | null;
          exchange?: string | null;
          id?: string;
          instrument_name?: string | null;
          line_no?: number;
          market_value?: number;
          notes?: string | null;
          quantity?: number;
          symbol?: string;
          valuation_id?: string;
          valuation_price?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'portfolio_valuation_items_valuation_id_fkey';
            columns: ['valuation_id'];
            isOneToOne: false;
            referencedRelation: 'portfolio_valuations';
            referencedColumns: ['id'];
          },
        ];
      };
      portfolio_valuations: {
        Row: {
          approved_at: string | null;
          approved_by: string | null;
          cash_balance: number;
          corrects_valuation_id: string | null;
          created_at: string;
          cycle_id: string;
          discarded_at: string | null;
          entered_by: string;
          gross_asset_value: number;
          gross_net_asset_value: number;
          holdings_value: number;
          id: string;
          liabilities: number;
          notes: string | null;
          other_assets: number;
          source: string;
          status: Database['public']['Enums']['valuation_status'];
          superseded_at: string | null;
          superseded_by: string | null;
          updated_at: string;
          valuation_at: string;
        };
        Insert: {
          approved_at?: string | null;
          approved_by?: string | null;
          cash_balance?: number;
          corrects_valuation_id?: string | null;
          created_at?: string;
          cycle_id: string;
          discarded_at?: string | null;
          entered_by: string;
          gross_asset_value?: number;
          gross_net_asset_value?: number;
          holdings_value?: number;
          id?: string;
          liabilities?: number;
          notes?: string | null;
          other_assets?: number;
          source?: string;
          status?: Database['public']['Enums']['valuation_status'];
          superseded_at?: string | null;
          superseded_by?: string | null;
          updated_at?: string;
          valuation_at: string;
        };
        Update: {
          approved_at?: string | null;
          approved_by?: string | null;
          cash_balance?: number;
          corrects_valuation_id?: string | null;
          created_at?: string;
          cycle_id?: string;
          discarded_at?: string | null;
          entered_by?: string;
          gross_asset_value?: number;
          gross_net_asset_value?: number;
          holdings_value?: number;
          id?: string;
          liabilities?: number;
          notes?: string | null;
          other_assets?: number;
          source?: string;
          status?: Database['public']['Enums']['valuation_status'];
          superseded_at?: string | null;
          superseded_by?: string | null;
          updated_at?: string;
          valuation_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'portfolio_valuations_approved_by_fkey';
            columns: ['approved_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'portfolio_valuations_corrects_valuation_id_fkey';
            columns: ['corrects_valuation_id'];
            isOneToOne: false;
            referencedRelation: 'portfolio_valuations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'portfolio_valuations_cycle_id_fkey';
            columns: ['cycle_id'];
            isOneToOne: false;
            referencedRelation: 'cycle_overview';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'portfolio_valuations_cycle_id_fkey';
            columns: ['cycle_id'];
            isOneToOne: false;
            referencedRelation: 'cycle_unit_summary';
            referencedColumns: ['cycle_id'];
          },
          {
            foreignKeyName: 'portfolio_valuations_cycle_id_fkey';
            columns: ['cycle_id'];
            isOneToOne: false;
            referencedRelation: 'investment_cycles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'portfolio_valuations_entered_by_fkey';
            columns: ['entered_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'portfolio_valuations_superseded_by_fkey';
            columns: ['superseded_by'];
            isOneToOne: false;
            referencedRelation: 'portfolio_valuations';
            referencedColumns: ['id'];
          },
        ];
      };
      profiles: {
        Row: {
          created_at: string;
          email: string;
          full_name: string;
          id: string;
          must_change_password: boolean;
          phone: string | null;
          role: Database['public']['Enums']['app_role'];
          status: Database['public']['Enums']['profile_status'];
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          email: string;
          full_name?: string;
          id: string;
          must_change_password?: boolean;
          phone?: string | null;
          role?: Database['public']['Enums']['app_role'];
          status?: Database['public']['Enums']['profile_status'];
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          email?: string;
          full_name?: string;
          id?: string;
          must_change_password?: boolean;
          phone?: string | null;
          role?: Database['public']['Enums']['app_role'];
          status?: Database['public']['Enums']['profile_status'];
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      client_cycle_holdings: {
        Row: {
          client_id: string | null;
          cycle_id: string | null;
          cycle_name: string | null;
          cycle_status: Database['public']['Enums']['cycle_status'] | null;
          lots_issued: number | null;
          lots_reversed: number | null;
          net_contributed: number | null;
          units: number | null;
        };
        Relationships: [
          {
            foreignKeyName: 'client_unit_allocations_client_id_fkey';
            columns: ['client_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'client_unit_allocations_cycle_id_fkey';
            columns: ['cycle_id'];
            isOneToOne: false;
            referencedRelation: 'cycle_overview';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'client_unit_allocations_cycle_id_fkey';
            columns: ['cycle_id'];
            isOneToOne: false;
            referencedRelation: 'cycle_unit_summary';
            referencedColumns: ['cycle_id'];
          },
          {
            foreignKeyName: 'client_unit_allocations_cycle_id_fkey';
            columns: ['cycle_id'];
            isOneToOne: false;
            referencedRelation: 'investment_cycles';
            referencedColumns: ['id'];
          },
        ];
      };
      contribution_register: {
        Row: {
          amount: number | null;
          applicable_nav: number | null;
          client_email: string | null;
          client_id: string | null;
          client_name: string | null;
          created_at: string | null;
          cycle_id: string | null;
          cycle_name: string | null;
          cycle_status: Database['public']['Enums']['cycle_status'] | null;
          id: string | null;
          locked_fee_rate: number | null;
          method: Database['public']['Enums']['contribution_method'] | null;
          notes: string | null;
          received_at: string | null;
          recorded_by: string | null;
          reference_hwm: number | null;
          reference_number: string | null;
          rejected_at: string | null;
          rejection_reason: string | null;
          reversal_reason: string | null;
          reversed_at: string | null;
          status: Database['public']['Enums']['contribution_status'] | null;
          units_issued: number | null;
          updated_at: string | null;
          verified_at: string | null;
          verified_by: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'contributions_client_id_fkey';
            columns: ['client_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'contributions_cycle_id_fkey';
            columns: ['cycle_id'];
            isOneToOne: false;
            referencedRelation: 'cycle_overview';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'contributions_cycle_id_fkey';
            columns: ['cycle_id'];
            isOneToOne: false;
            referencedRelation: 'cycle_unit_summary';
            referencedColumns: ['cycle_id'];
          },
          {
            foreignKeyName: 'contributions_cycle_id_fkey';
            columns: ['cycle_id'];
            isOneToOne: false;
            referencedRelation: 'investment_cycles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'contributions_recorded_by_fkey';
            columns: ['recorded_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'contributions_verified_by_fkey';
            columns: ['verified_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      cycle_overview: {
        Row: {
          base_nav: number | null;
          created_at: string | null;
          created_by: string | null;
          currency: string | null;
          current_fee_effective_from: string | null;
          current_fee_rate: number | null;
          current_fee_version: number | null;
          description: string | null;
          end_date: string | null;
          id: string | null;
          name: string | null;
          pending_fee_effective_from: string | null;
          pending_fee_rate: number | null;
          pending_fee_version: number | null;
          start_date: string | null;
          status: Database['public']['Enums']['cycle_status'] | null;
          updated_at: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'investment_cycles_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      cycle_unit_summary: {
        Row: {
          cycle_id: string | null;
          investor_count: number | null;
          net_contributed: number | null;
          outstanding_units: number | null;
          pending_amount: number | null;
          pending_count: number | null;
        };
        Insert: {
          cycle_id?: string | null;
          investor_count?: never;
          net_contributed?: never;
          outstanding_units?: never;
          pending_amount?: never;
          pending_count?: never;
        };
        Update: {
          cycle_id?: string | null;
          investor_count?: never;
          net_contributed?: never;
          outstanding_units?: never;
          pending_amount?: never;
          pending_count?: never;
        };
        Relationships: [];
      };
      lot_fee_accrual_report: {
        Row: {
          client_email: string | null;
          client_id: string | null;
          client_name: string | null;
          contributed_amount: number | null;
          contribution_id: string | null;
          cycle_id: string | null;
          eligible_profit_per_unit: number | null;
          entry_nav: number | null;
          fee_amount: number | null;
          fee_rate: number | null;
          gross_nav_per_unit: number | null;
          gross_value: number | null;
          id: string | null;
          loss_to_recover: number | null;
          method: string | null;
          net_value: number | null;
          received_at: string | null;
          reference_hwm: number | null;
          snapshot_id: string | null;
          units: number | null;
        };
        Relationships: [
          {
            foreignKeyName: 'lot_fee_accruals_client_id_fkey';
            columns: ['client_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'lot_fee_accruals_contribution_id_fkey';
            columns: ['contribution_id'];
            isOneToOne: false;
            referencedRelation: 'contribution_register';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'lot_fee_accruals_contribution_id_fkey';
            columns: ['contribution_id'];
            isOneToOne: false;
            referencedRelation: 'contributions';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'lot_fee_accruals_cycle_id_fkey';
            columns: ['cycle_id'];
            isOneToOne: false;
            referencedRelation: 'cycle_overview';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'lot_fee_accruals_cycle_id_fkey';
            columns: ['cycle_id'];
            isOneToOne: false;
            referencedRelation: 'cycle_unit_summary';
            referencedColumns: ['cycle_id'];
          },
          {
            foreignKeyName: 'lot_fee_accruals_cycle_id_fkey';
            columns: ['cycle_id'];
            isOneToOne: false;
            referencedRelation: 'investment_cycles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'lot_fee_accruals_snapshot_id_fkey';
            columns: ['snapshot_id'];
            isOneToOne: false;
            referencedRelation: 'nav_snapshots';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Functions: {
      admin_add_fee_terms: {
        Args: {
          p_cycle_id: string;
          p_effective_from: string;
          p_fee_rate: number;
          p_reason: string;
        };
        Returns: string;
      };
      admin_approve_valuation: {
        Args: { p_reason: string; p_valuation_id: string };
        Returns: undefined;
      };
      admin_calculate_nav: {
        Args: { p_corrects_snapshot_id?: string; p_valuation_id: string };
        Returns: string;
      };
      admin_cancel_fee_terms: {
        Args: { p_reason: string; p_terms_id: string };
        Returns: undefined;
      };
      admin_create_cycle: {
        Args: {
          p_base_nav: number;
          p_description: string;
          p_end_date: string;
          p_fee_rate: number;
          p_name: string;
          p_start_date: string;
        };
        Returns: string;
      };
      admin_discard_nav_draft: {
        Args: { p_reason: string; p_snapshot_id: string };
        Returns: undefined;
      };
      admin_discard_valuation_draft: {
        Args: { p_reason: string; p_valuation_id: string };
        Returns: undefined;
      };
      admin_preview_verification: {
        Args: { p_contribution_id: string };
        Returns: {
          applicable_nav: string;
          fee_rate: string;
          fee_version: number;
          units: string;
        }[];
      };
      admin_publish_nav: {
        Args: { p_reason: string; p_snapshot_id: string };
        Returns: undefined;
      };
      admin_record_contribution: {
        Args: {
          p_amount: number;
          p_client_id: string;
          p_cycle_id: string;
          p_method: Database['public']['Enums']['contribution_method'];
          p_notes: string;
          p_received_at: string;
          p_reference: string;
        };
        Returns: string;
      };
      admin_record_fee_crystallisation: {
        Args: { p_cycle_id: string; p_note: string };
        Returns: string;
      };
      admin_reject_contribution: {
        Args: { p_contribution_id: string; p_reason: string };
        Returns: undefined;
      };
      admin_reverse_contribution: {
        Args: { p_contribution_id: string; p_reason: string };
        Returns: undefined;
      };
      admin_save_valuation_draft: {
        Args: {
          p_cash_balance: string;
          p_corrects_id?: string;
          p_cycle_id: string;
          p_items: Json;
          p_liabilities: string;
          p_notes: string;
          p_other_assets: string;
          p_valuation_at: string;
          p_valuation_id: string;
        };
        Returns: string;
      };
      admin_set_cycle_status: {
        Args: {
          p_cycle_id: string;
          p_reason: string;
          p_status: Database['public']['Enums']['cycle_status'];
        };
        Returns: undefined;
      };
      admin_set_user_role: {
        Args: {
          p_reason: string;
          p_role: Database['public']['Enums']['app_role'];
          p_user_id: string;
        };
        Returns: undefined;
      };
      admin_set_user_status: {
        Args: {
          p_reason: string;
          p_status: Database['public']['Enums']['profile_status'];
          p_user_id: string;
        };
        Returns: undefined;
      };
      admin_update_cycle: {
        Args: {
          p_base_nav: number;
          p_cycle_id: string;
          p_description: string;
          p_end_date: string;
          p_name: string;
          p_reason: string;
          p_start_date: string;
        };
        Returns: undefined;
      };
      admin_verify_contribution: {
        Args: { p_contribution_id: string; p_reason: string };
        Returns: {
          applicable_nav: string;
          fee_rate: string;
          units: string;
        }[];
      };
      client_my_activity: {
        Args: { p_limit?: number };
        Returns: {
          amount: string;
          cycle_name: string;
          kind: string;
          nav: string;
          occurred_at: string;
          units: string;
        }[];
      };
      client_my_contributions: {
        Args: never;
        Returns: {
          amount: string;
          applicable_nav: string;
          cycle_id: string;
          cycle_name: string;
          id: string;
          locked_fee_rate: string;
          method: string;
          received_at: string;
          reference_number: string;
          rejected_at: string;
          reversed_at: string;
          status: string;
          units_issued: string;
          verified_at: string;
        }[];
      };
      client_my_cycles: {
        Args: never;
        Returns: {
          base_nav: string;
          current_fee_rate: string;
          cycle_id: string;
          cycle_name: string;
          cycle_status: string;
          end_date: string;
          fee_amount: string;
          gross_value: string;
          latest_gross_nav: string;
          latest_nav_date: string;
          loss_to_recover: string;
          lots_contributed: string;
          net_contributed: string;
          net_value: string;
          start_date: string;
          units: string;
        }[];
      };
      client_my_lot_values: {
        Args: { p_cycle_id: string };
        Returns: {
          amount: string;
          contribution_id: string;
          eligible_profit_per_unit: string;
          entry_nav: string;
          fee_amount: string;
          fee_rate: string;
          gross_nav_per_unit: string;
          gross_value: string;
          loss_to_recover: string;
          nav_date: string;
          net_value: string;
          received_at: string;
          reference_hwm: string;
          units: string;
        }[];
      };
      client_nav_history: {
        Args: { p_cycle_id: string };
        Returns: {
          gross_nav_per_unit: string;
          nav_date: string;
        }[];
      };
      complete_password_change: { Args: never; Returns: undefined };
    };
    Enums: {
      allocation_entry_type: 'issue' | 'reversal';
      app_role: 'admin' | 'client';
      contribution_method: 'upi' | 'bank_transfer' | 'cheque' | 'other';
      contribution_status: 'pending' | 'verified' | 'rejected' | 'reversed';
      cycle_status: 'draft' | 'open' | 'active' | 'closed' | 'settled';
      nav_snapshot_status: 'draft' | 'published' | 'corrected' | 'discarded';
      profile_status: 'active' | 'inactive';
      valuation_status: 'draft' | 'approved' | 'superseded' | 'discarded';
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    keyof (DefaultSchema['Tables'] & DefaultSchema['Views']) | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema['Enums'] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema['CompositeTypes'] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      allocation_entry_type: ['issue', 'reversal'],
      app_role: ['admin', 'client'],
      contribution_method: ['upi', 'bank_transfer', 'cheque', 'other'],
      contribution_status: ['pending', 'verified', 'rejected', 'reversed'],
      cycle_status: ['draft', 'open', 'active', 'closed', 'settled'],
      nav_snapshot_status: ['draft', 'published', 'corrected', 'discarded'],
      profile_status: ['active', 'inactive'],
      valuation_status: ['draft', 'approved', 'superseded', 'discarded'],
    },
  },
} as const;
