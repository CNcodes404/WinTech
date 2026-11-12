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
            referencedRelation: 'investment_cycles';
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
      profiles: {
        Row: {
          created_at: string;
          email: string;
          full_name: string;
          id: string;
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
          phone?: string | null;
          role?: Database['public']['Enums']['app_role'];
          status?: Database['public']['Enums']['profile_status'];
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
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
    };
    Enums: {
      app_role: 'admin' | 'client';
      cycle_status: 'draft' | 'open' | 'active' | 'closed' | 'settled';
      profile_status: 'active' | 'inactive';
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
      app_role: ['admin', 'client'],
      cycle_status: ['draft', 'open', 'active', 'closed', 'settled'],
      profile_status: ['active', 'inactive'],
    },
  },
} as const;
