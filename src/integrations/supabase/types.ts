export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      payment_effect_outbox: {
        Row: {
          attempts: number
          available_at: string
          created_at: string
          effect_type: string
          id: string
          last_error: string | null
          locked_at: string | null
          locked_by: string | null
          locked_until: string | null
          payload: Json
          payment_transaction_id: string
          processed_at: string | null
          restaurant_id: string
          status: string
          updated_at: string
        }
        Insert: {
          attempts?: number
          available_at?: string
          created_at?: string
          effect_type: string
          id?: string
          last_error?: string | null
          locked_at?: string | null
          locked_by?: string | null
          locked_until?: string | null
          payload?: Json
          payment_transaction_id: string
          processed_at?: string | null
          restaurant_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          attempts?: number
          available_at?: string
          created_at?: string
          effect_type?: string
          id?: string
          last_error?: string | null
          locked_at?: string | null
          locked_by?: string | null
          locked_until?: string | null
          payload?: Json
          payment_transaction_id?: string
          processed_at?: string | null
          restaurant_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_effect_outbox_transaction_tenant_fkey"
            columns: ["payment_transaction_id", "restaurant_id"]
            isOneToOne: false
            referencedRelation: "payment_transactions"
            referencedColumns: ["id", "restaurant_id"]
          },
        ]
      }
      payment_oauth_states: {
        Row: {
          code_verifier_encrypted: string
          consumed_at: string | null
          created_at: string
          credential_key_id: string
          environment: string
          expires_at: string
          id: string
          provider: string
          redirect_uri: string
          restaurant_id: string
          state_hash: string
        }
        Insert: {
          code_verifier_encrypted: string
          consumed_at?: string | null
          created_at?: string
          credential_key_id: string
          environment?: string
          expires_at: string
          id?: string
          provider: string
          redirect_uri: string
          restaurant_id: string
          state_hash: string
        }
        Update: {
          code_verifier_encrypted?: string
          consumed_at?: string | null
          created_at?: string
          credential_key_id?: string
          environment?: string
          expires_at?: string
          id?: string
          provider?: string
          redirect_uri?: string
          restaurant_id?: string
          state_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_oauth_states_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_provider_accounts: {
        Row: {
          access_token_encrypted: string | null
          capabilities: Json
          connected_at: string | null
          created_at: string
          credential_key_id: string | null
          disconnected_at: string | null
          environment: string
          external_account_id: string | null
          id: string
          last_error: string | null
          provider: string
          refresh_token_encrypted: string | null
          restaurant_id: string
          status: string
          token_expires_at: string | null
          updated_at: string
          version: number
        }
        Insert: {
          access_token_encrypted?: string | null
          capabilities?: Json
          connected_at?: string | null
          created_at?: string
          credential_key_id?: string | null
          disconnected_at?: string | null
          environment?: string
          external_account_id?: string | null
          id?: string
          last_error?: string | null
          provider: string
          refresh_token_encrypted?: string | null
          restaurant_id: string
          status?: string
          token_expires_at?: string | null
          updated_at?: string
          version?: number
        }
        Update: {
          access_token_encrypted?: string | null
          capabilities?: Json
          connected_at?: string | null
          created_at?: string
          credential_key_id?: string | null
          disconnected_at?: string | null
          environment?: string
          external_account_id?: string | null
          id?: string
          last_error?: string | null
          provider?: string
          refresh_token_encrypted?: string | null
          restaurant_id?: string
          status?: string
          token_expires_at?: string | null
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "payment_provider_accounts_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_transactions: {
        Row: {
          amount: number
          cancelled_at: string | null
          checkout_url: string | null
          created_at: string
          currency: string
          expires_at: string | null
          external_payment_id: string | null
          failure_code: string | null
          failure_message: string | null
          id: string
          idempotency_key: string
          order_id: string
          paid_at: string | null
          manually_confirmed_by: string | null
          payment_method: string | null
          processing_mode: string
          provider: string
          provider_account_id: string | null
          provider_payload: Json
          provider_status: string | null
          refunded_at: string | null
          request_fingerprint: string
          restaurant_id: string
          status: string
          updated_at: string
          version: number
        }
        Insert: {
          amount: number
          cancelled_at?: string | null
          checkout_url?: string | null
          created_at?: string
          currency?: string
          expires_at?: string | null
          external_payment_id?: string | null
          failure_code?: string | null
          failure_message?: string | null
          id?: string
          idempotency_key: string
          order_id: string
          paid_at?: string | null
          manually_confirmed_by?: string | null
          payment_method?: string | null
          processing_mode: string
          provider: string
          provider_account_id?: string | null
          provider_payload?: Json
          provider_status?: string | null
          refunded_at?: string | null
          request_fingerprint: string
          restaurant_id: string
          status?: string
          updated_at?: string
          version?: number
        }
        Update: {
          amount?: number
          cancelled_at?: string | null
          checkout_url?: string | null
          created_at?: string
          currency?: string
          expires_at?: string | null
          external_payment_id?: string | null
          failure_code?: string | null
          failure_message?: string | null
          id?: string
          idempotency_key?: string
          order_id?: string
          paid_at?: string | null
          manually_confirmed_by?: string | null
          payment_method?: string | null
          processing_mode?: string
          provider?: string
          provider_account_id?: string | null
          provider_payload?: Json
          provider_status?: string | null
          refunded_at?: string | null
          request_fingerprint?: string
          restaurant_id?: string
          status?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "payment_transactions_order_tenant_fkey"
            columns: ["order_id", "restaurant_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id", "restaurant_id"]
          },
          {
            foreignKeyName: "payment_transactions_provider_account_tenant_fkey"
            columns: ["provider_account_id", "restaurant_id"]
            isOneToOne: false
            referencedRelation: "payment_provider_accounts"
            referencedColumns: ["id", "restaurant_id"]
          },
        ]
      }
      payment_webhook_events: {
        Row: {
          attempts: number
          created_at: string
          event_type: string
          external_event_id: string
          id: string
          last_error: string | null
          payload: Json
          payment_transaction_id: string | null
          processed_at: string | null
          provider: string
          provider_account_id: string | null
          received_at: string
          restaurant_id: string | null
          signature_valid: boolean | null
          status: string
          updated_at: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          event_type: string
          external_event_id: string
          id?: string
          last_error?: string | null
          payload?: Json
          payment_transaction_id?: string | null
          processed_at?: string | null
          provider: string
          provider_account_id?: string | null
          received_at?: string
          restaurant_id?: string | null
          signature_valid?: boolean | null
          status?: string
          updated_at?: string
        }
        Update: {
          attempts?: number
          created_at?: string
          event_type?: string
          external_event_id?: string
          id?: string
          last_error?: string | null
          payload?: Json
          payment_transaction_id?: string | null
          processed_at?: string | null
          provider?: string
          provider_account_id?: string | null
          received_at?: string
          restaurant_id?: string | null
          signature_valid?: boolean | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_webhook_events_provider_account_tenant_fkey"
            columns: ["provider_account_id", "restaurant_id"]
            isOneToOne: false
            referencedRelation: "payment_provider_accounts"
            referencedColumns: ["id", "restaurant_id"]
          },
          {
            foreignKeyName: "payment_webhook_events_transaction_tenant_fkey"
            columns: ["payment_transaction_id", "restaurant_id"]
            isOneToOne: false
            referencedRelation: "payment_transactions"
            referencedColumns: ["id", "restaurant_id"]
          },
        ]
      }
      menu_item_variations: {
        Row: {
          created_at: string
          id: string
          menu_item_id: string
          name: string
          options: string[]
          required: boolean
        }
        Insert: {
          created_at?: string
          id?: string
          menu_item_id: string
          name: string
          options?: string[]
          required?: boolean
        }
        Update: {
          created_at?: string
          id?: string
          menu_item_id?: string
          name?: string
          options?: string[]
          required?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "menu_item_variations_menu_item_id_fkey"
            columns: ["menu_item_id"]
            isOneToOne: false
            referencedRelation: "menu_items"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_items: {
        Row: {
          available: boolean
          available_from: string | null
          available_until: string | null
          badge: string | null
          category: string
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          is_chef_suggestion: boolean
          name: string
          prep_time_minutes: number | null
          price: number
          restaurant_id: string
          updated_at: string
        }
        Insert: {
          available?: boolean
          available_from?: string | null
          available_until?: string | null
          badge?: string | null
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_chef_suggestion?: boolean
          name: string
          prep_time_minutes?: number | null
          price: number
          restaurant_id: string
          updated_at?: string
        }
        Update: {
          available?: boolean
          available_from?: string | null
          available_until?: string | null
          badge?: string | null
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_chef_suggestion?: boolean
          name?: string
          prep_time_minutes?: number | null
          price?: number
          restaurant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "menu_items_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      order_feedback: {
        Row: {
          comment: string | null
          created_at: string
          id: string
          order_id: string
          rating: number
          reasons: string[] | null
          restaurant_id: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          id?: string
          order_id: string
          rating: number
          reasons?: string[] | null
          restaurant_id: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          id?: string
          order_id?: string
          rating?: number
          reasons?: string[] | null
          restaurant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_feedback_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          order_id: string
          product_id: string
          product_name: string
          quantity: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          order_id: string
          product_id: string
          product_name: string
          quantity?: number
          unit_price: number
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          order_id?: string
          product_id?: string
          product_name?: string
          quantity?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          created_at: string
          display_id: number | null
          id: string
          order_channel: string
          payment_confirmed_at: string | null
          payment_method: string | null
          payment_processing_mode: string | null
          payment_status: string | null
          payment_transaction_id: string | null
          restaurant_id: string
          status: string
          table_number: string | null
          table_session_id: string | null
          total_price: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_id?: number | null
          id?: string
          order_channel?: string
          payment_confirmed_at?: string | null
          payment_method?: string | null
          payment_processing_mode?: string | null
          payment_status?: string | null
          payment_transaction_id?: string | null
          restaurant_id: string
          status?: string
          table_number?: string | null
          table_session_id?: string | null
          total_price?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_id?: number | null
          id?: string
          order_channel?: string
          payment_confirmed_at?: string | null
          payment_method?: string | null
          payment_processing_mode?: string | null
          payment_status?: string | null
          payment_transaction_id?: string | null
          restaurant_id?: string
          status?: string
          table_number?: string | null
          table_session_id?: string | null
          total_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_table_session_id_fkey"
            columns: ["table_session_id"]
            isOneToOne: false
            referencedRelation: "table_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_payment_transaction_tenant_fkey"
            columns: ["payment_transaction_id", "restaurant_id"]
            isOneToOne: false
            referencedRelation: "payment_transactions"
            referencedColumns: ["id", "restaurant_id"]
          },
        ]
      }
      restaurants: {
        Row: {
          address: string | null
          asaas_api_key: string | null
          created_at: string
          delivery_enabled: boolean
          description: string | null
          font_family: string
          hours: string | null
          id: string
          local_enabled: boolean
          logo_url: string | null
          max_pending_orders: number
          max_tables: number
          name: string
          onboarding_completed: boolean
          onboarding_completed_at: string | null
          onboarding_status: string
          onboarding_step: number
          onboarding_updated_at: string
          organization_id: string
          owner_id: string
          payment_mode: string
          phone: string | null
          plan_status: string
          plan_type: string
          primary_color: string
          secondary_color: string
          slug: string
          total_tables: number
          trial_ends_at: string | null
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          address?: string | null
          asaas_api_key?: string | null
          created_at?: string
          delivery_enabled?: boolean
          description?: string | null
          font_family?: string
          hours?: string | null
          id?: string
          local_enabled?: boolean
          logo_url?: string | null
          max_pending_orders?: number
          max_tables?: number
          name: string
          onboarding_completed?: boolean
          onboarding_completed_at?: string | null
          onboarding_status?: string
          onboarding_step?: number
          onboarding_updated_at?: string
          organization_id: string
          owner_id: string
          payment_mode?: string
          phone?: string | null
          plan_status?: string
          plan_type?: string
          primary_color?: string
          secondary_color?: string
          slug: string
          total_tables?: number
          trial_ends_at?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          address?: string | null
          asaas_api_key?: string | null
          created_at?: string
          delivery_enabled?: boolean
          description?: string | null
          font_family?: string
          hours?: string | null
          id?: string
          local_enabled?: boolean
          logo_url?: string | null
          max_pending_orders?: number
          max_tables?: number
          name?: string
          onboarding_completed?: boolean
          onboarding_completed_at?: string | null
          onboarding_status?: string
          onboarding_step?: number
          onboarding_updated_at?: string
          organization_id?: string
          owner_id?: string
          payment_mode?: string
          phone?: string | null
          plan_status?: string
          plan_type?: string
          primary_color?: string
          secondary_color?: string
          slug?: string
          total_tables?: number
          trial_ends_at?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: []
      }
      table_sessions: {
        Row: {
          closed_at: string | null
          created_at: string
          id: string
          restaurant_id: string
          status: string
          table_number: string
        }
        Insert: {
          closed_at?: string | null
          created_at?: string
          id?: string
          restaurant_id: string
          status?: string
          table_number: string
        }
        Update: {
          closed_at?: string | null
          created_at?: string
          id?: string
          restaurant_id?: string
          status?: string
          table_number?: string
        }
        Relationships: [
          {
            foreignKeyName: "table_sessions_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      apply_payment_transition: {
        Args: {
          p_effect_types?: string[] | null
          p_expected_version: number
          p_external_payment_id?: string | null
          p_new_status: string
          p_provider_status?: string | null
          p_transaction_id: string
          p_transitioned_at?: string
        }
        Returns: {
          amount: number
          cancelled_at: string | null
          checkout_url: string | null
          created_at: string
          currency: string
          expires_at: string | null
          external_payment_id: string | null
          failure_code: string | null
          failure_message: string | null
          id: string
          idempotency_key: string
          order_id: string
          paid_at: string | null
          manually_confirmed_by: string | null
          payment_method: string | null
          processing_mode: string
          provider: string
          provider_account_id: string | null
          provider_payload: Json
          provider_status: string | null
          refunded_at: string | null
          request_fingerprint: string
          restaurant_id: string
          status: string
          updated_at: string
          version: number
        }
      }
      get_public_restaurant_by_slug: {
        Args: { p_slug: string }
        Returns: {
          delivery_enabled: boolean
          font_family: string
          id: string
          local_enabled: boolean
          logo_url: string | null
          max_pending_orders: number
          name: string
          payment_mode: string
          primary_color: string
          secondary_color: string
          slug: string
        }[]
      }
      finalize_onboarding: {
        Args: { p_restaurant_id: string }
        Returns: {
          id: string
          organization_id: string
          onboarding_status: string
          onboarding_completed: boolean
          onboarding_completed_at: string | null
        }[]
      }
      save_onboarding_draft: {
        Args: {
          p_name: string
          p_slug: string
          p_onboarding_step: number
          p_restaurant_id?: string | null
          p_organization_id?: string | null
          p_whatsapp?: string | null
          p_primary_color?: string
          p_secondary_color?: string
          p_total_tables?: number
          p_local_enabled?: boolean
          p_delivery_enabled?: boolean
        }
        Returns: {
          id: string
          organization_id: string
          name: string
          slug: string
          whatsapp: string | null
          primary_color: string
          secondary_color: string
          total_tables: number
          onboarding_status: string
          onboarding_step: number
          onboarding_updated_at: string
          local_enabled: boolean
          delivery_enabled: boolean
        }[]
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
