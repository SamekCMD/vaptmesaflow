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
      account_preferences: {
        Row: {
          current_organization_id: string | null
          current_restaurant_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          current_organization_id?: string | null
          current_restaurant_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          current_organization_id?: string | null
          current_restaurant_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "account_preferences_current_organization_id_fkey"
            columns: ["current_organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "account_preferences_current_restaurant_id_fkey"
            columns: ["current_restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurant_public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "account_preferences_current_restaurant_id_fkey"
            columns: ["current_restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
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
            referencedRelation: "restaurant_public_profiles"
            referencedColumns: ["id"]
          },
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
          reasons: string[]
          restaurant_id: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          id?: string
          order_id: string
          rating: number
          reasons?: string[]
          restaurant_id: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          id?: string
          order_id?: string
          rating?: number
          reasons?: string[]
          restaurant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_feedback_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_feedback_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurant_public_profiles"
            referencedColumns: ["id"]
          },
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
          creation_idempotency_key: string | null
          creation_request_fingerprint: string | null
          delivery_customer_name: string | null
          delivery_neighborhood: string | null
          delivery_number: string | null
          delivery_phone: string | null
          delivery_street: string | null
          display_id: number | null
          id: string
          order_channel: string
          payment_confirmed_at: string | null
          payment_method: string | null
          payment_processing_mode: string | null
          payment_status: string | null
          payment_transaction_id: string | null
          public_access_token_hash: string | null
          restaurant_id: string
          status: string
          table_number: string | null
          table_session_id: string | null
          total_price: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          creation_idempotency_key?: string | null
          creation_request_fingerprint?: string | null
          delivery_customer_name?: string | null
          delivery_neighborhood?: string | null
          delivery_number?: string | null
          delivery_phone?: string | null
          delivery_street?: string | null
          display_id?: number | null
          id?: string
          order_channel?: string
          payment_confirmed_at?: string | null
          payment_method?: string | null
          payment_processing_mode?: string | null
          payment_status?: string | null
          payment_transaction_id?: string | null
          public_access_token_hash?: string | null
          restaurant_id: string
          status?: string
          table_number?: string | null
          table_session_id?: string | null
          total_price?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          creation_idempotency_key?: string | null
          creation_request_fingerprint?: string | null
          delivery_customer_name?: string | null
          delivery_neighborhood?: string | null
          delivery_number?: string | null
          delivery_phone?: string | null
          delivery_street?: string | null
          display_id?: number | null
          id?: string
          order_channel?: string
          payment_confirmed_at?: string | null
          payment_method?: string | null
          payment_processing_mode?: string | null
          payment_status?: string | null
          payment_transaction_id?: string | null
          public_access_token_hash?: string | null
          restaurant_id?: string
          status?: string
          table_number?: string | null
          table_session_id?: string | null
          total_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_payment_transaction_tenant_fkey"
            columns: ["payment_transaction_id", "restaurant_id"]
            isOneToOne: false
            referencedRelation: "payment_transactions"
            referencedColumns: ["id", "restaurant_id"]
          },
          {
            foreignKeyName: "orders_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurant_public_profiles"
            referencedColumns: ["id"]
          },
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
        ]
      }
      organization_members: {
        Row: {
          created_at: string
          organization_id: string
          role: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          organization_id: string
          role: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          organization_id?: string
          role?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_subscriptions: {
        Row: {
          created_at: string
          organization_id: string
          plan_status: string
          plan_type: string
          subscription_canceled_at: string | null
          trial_ends_at: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          organization_id: string
          plan_status?: string
          plan_type?: string
          subscription_canceled_at?: string | null
          trial_ends_at?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          organization_id?: string
          plan_status?: string
          plan_type?: string
          subscription_canceled_at?: string | null
          trial_ends_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_subscriptions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          created_by: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
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
          payload: NonNullable<Json>
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
          payload?: NonNullable<Json>
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
          payload?: NonNullable<Json>
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
            referencedRelation: "restaurant_public_profiles"
            referencedColumns: ["id"]
          },
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
          capabilities: NonNullable<Json>
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
          capabilities?: NonNullable<Json>
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
          capabilities?: NonNullable<Json>
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
            referencedRelation: "restaurant_public_profiles"
            referencedColumns: ["id"]
          },
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
          manually_confirmed_by: string | null
          order_id: string
          paid_at: string | null
          payment_method: string | null
          processing_mode: string
          provider: string
          provider_account_id: string | null
          provider_payload: NonNullable<Json>
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
          manually_confirmed_by?: string | null
          order_id: string
          paid_at?: string | null
          payment_method?: string | null
          processing_mode: string
          provider: string
          provider_account_id?: string | null
          provider_payload?: NonNullable<Json>
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
          manually_confirmed_by?: string | null
          order_id?: string
          paid_at?: string | null
          payment_method?: string | null
          processing_mode?: string
          provider?: string
          provider_account_id?: string | null
          provider_payload?: NonNullable<Json>
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
          payload: NonNullable<Json>
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
          payload?: NonNullable<Json>
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
          payload?: NonNullable<Json>
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
      push_subscriptions: {
        Row: {
          created_at: string
          endpoint: string
          id: string
          origin: string | null
          restaurant_id: string
          subscription: NonNullable<Json>
          updated_at: string
          user_agent: string | null
        }
        Insert: {
          created_at?: string
          endpoint: string
          id?: string
          origin?: string | null
          restaurant_id: string
          subscription: NonNullable<Json>
          updated_at?: string
          user_agent?: string | null
        }
        Update: {
          created_at?: string
          endpoint?: string
          id?: string
          origin?: string | null
          restaurant_id?: string
          subscription?: NonNullable<Json>
          updated_at?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurant_public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "push_subscriptions_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurant_activation_progress: {
        Row: {
          completed_at: string
          completed_by: string | null
          module_key: string
          restaurant_id: string
        }
        Insert: {
          completed_at?: string
          completed_by?: string | null
          module_key: string
          restaurant_id: string
        }
        Update: {
          completed_at?: string
          completed_by?: string | null
          module_key?: string
          restaurant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_activation_progress_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurant_public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "restaurant_activation_progress_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurants: {
        Row: {
          address: string | null
          cnpj: string | null
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
          cnpj?: string | null
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
          cnpj?: string | null
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
        Relationships: [
          {
            foreignKeyName: "restaurants_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
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
            referencedRelation: "restaurant_public_profiles"
            referencedColumns: ["id"]
          },
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
      restaurant_public_profiles: {
        Row: {
          delivery_enabled: boolean | null
          font_family: string | null
          id: string | null
          local_enabled: boolean | null
          logo_url: string | null
          max_pending_orders: number | null
          name: string | null
          organization_id: string | null
          payment_mode: string | null
          phone: string | null
          primary_color: string | null
          secondary_color: string | null
          slug: string | null
          whatsapp: string | null
        }
        Insert: {
          delivery_enabled?: boolean | null
          font_family?: string | null
          id?: string | null
          local_enabled?: boolean | null
          logo_url?: string | null
          max_pending_orders?: number | null
          name?: string | null
          organization_id?: string | null
          payment_mode?: string | null
          phone?: string | null
          primary_color?: string | null
          secondary_color?: string | null
          slug?: string | null
          whatsapp?: string | null
        }
        Update: {
          delivery_enabled?: boolean | null
          font_family?: string | null
          id?: string | null
          local_enabled?: boolean | null
          logo_url?: string | null
          max_pending_orders?: number | null
          name?: string | null
          organization_id?: string | null
          payment_mode?: string | null
          phone?: string | null
          primary_color?: string | null
          secondary_color?: string | null
          slug?: string | null
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "restaurants_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      apply_payment_transition_v2: {
        Args: {
          p_checkout_url: string
          p_effect_types: string[]
          p_expected_version: number
          p_expires_at: string
          p_external_payment_id: string
          p_new_status: string
          p_provider_payload: Json
          p_provider_status: string
          p_transaction_id: string
          p_transitioned_at: string
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
          manually_confirmed_by: string | null
          order_id: string
          paid_at: string | null
          payment_method: string | null
          processing_mode: string
          provider: string
          provider_account_id: string | null
          provider_payload: NonNullable<Json>
          provider_status: string | null
          refunded_at: string | null
          request_fingerprint: string
          restaurant_id: string
          status: string
          updated_at: string
          version: number
        }
        SetofOptions: {
          from: "*"
          to: "payment_transactions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      can_manage_restaurant_storage_object: {
        Args: { p_bucket_id: string; p_object_name: string; p_user_id?: string }
        Returns: boolean
      }
      claim_payment_effects: {
        Args: {
          p_limit: number
          p_locked_at: string
          p_locked_until: string
          p_worker_id: string
        }
        Returns: {
          attempts: number
          available_at: string
          created_at: string
          effect_type: string
          id: string
          last_error: string | null
          locked_at: string | null
          locked_by: string | null
          locked_until: string | null
          payload: NonNullable<Json>
          payment_transaction_id: string
          processed_at: string | null
          restaurant_id: string
          status: string
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "payment_effect_outbox"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      complete_payment_effect: {
        Args: {
          p_effect_id: string
          p_processed_at: string
          p_worker_id: string
        }
        Returns: undefined
      }
      count_pending_payment_effects: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      create_public_order_v2: {
        Args: {
          p_channel: string
          p_delivery: Json
          p_idempotency_key: string
          p_items: Json
          p_public_token_hash: string
          p_request_fingerprint: string
          p_restaurant_slug: string
          p_table_number: number
        }
        Returns: {
          display_id: number
          idempotent_replay: boolean
          order_id: string
          payment_status: string
          restaurant_id: string
          status: string
          table_session_id: string
          total_price: number
        }[]
      }
      create_public_order_v3: {
        Args: {
          p_channel: string
          p_delivery: Json
          p_idempotency_key: string
          p_items: Json
          p_public_token_hash: string
          p_request_fingerprint: string
          p_restaurant_slug: string
          p_table_number: number
        }
        Returns: {
          display_id: number
          idempotent_replay: boolean
          order_id: string
          payment_status: string
          restaurant_id: string
          status: string
          table_session_id: string
          total_price: number
        }[]
      }
      fail_payment_effect: {
        Args: {
          p_attempts: number
          p_available_at: string
          p_effect_id: string
          p_last_error: string
          p_status: string
          p_worker_id: string
        }
        Returns: undefined
      }
      finalize_onboarding: {
        Args: { p_restaurant_id: string }
        Returns: {
          id: string
          onboarding_completed: boolean
          onboarding_completed_at: string
          onboarding_status: string
          organization_id: string
        }[]
      }
      get_or_create_default_owner_organization: {
        Args: {
          p_created_at?: string
          p_owner_id: string
          p_restaurant_name?: string
        }
        Returns: string
      }
      get_plan_max_restaurants: {
        Args: { p_plan_type: string }
        Returns: number
      }
      get_public_restaurant_by_slug: {
        Args: { p_slug: string }
        Returns: {
          delivery_enabled: boolean
          font_family: string
          id: string
          local_enabled: boolean
          logo_url: string
          max_pending_orders: number
          name: string
          payment_mode: string
          primary_color: string
          secondary_color: string
          slug: string
        }[]
      }
      get_restaurant_creation_entitlement: {
        Args: { p_organization_id: string }
        Returns: {
          can_create: boolean
          current_restaurants: number
          max_restaurants: number
          plan_type: string
          reason: string
          role: string
        }[]
      }
      has_organization_role: {
        Args: {
          p_organization_id: string
          p_roles: string[]
          p_user_id?: string
        }
        Returns: boolean
      }
      is_delivered_order_for_feedback: {
        Args: {
          p_order_id: string
          p_public_access_token: string
          p_restaurant_id: string
        }
        Returns: boolean
      }
      is_organization_member: {
        Args: { p_organization_id: string; p_user_id?: string }
        Returns: boolean
      }
      is_restaurant_member: {
        Args: { p_restaurant_id: string; p_user_id?: string }
        Returns: boolean
      }
      release_paid_order_to_production: {
        Args: { p_payment_transaction_id: string; p_restaurant_id: string }
        Returns: undefined
      }
      save_onboarding_draft:
        | {
            Args: {
              p_name: string
              p_onboarding_step: number
              p_organization_id?: string
              p_primary_color?: string
              p_restaurant_id?: string
              p_secondary_color?: string
              p_slug: string
              p_total_tables?: number
              p_whatsapp?: string
            }
            Returns: {
              id: string
              name: string
              onboarding_status: string
              onboarding_step: number
              onboarding_updated_at: string
              organization_id: string
              primary_color: string
              secondary_color: string
              slug: string
              total_tables: number
              whatsapp: string
            }[]
          }
        | {
            Args: {
              p_delivery_enabled: boolean
              p_local_enabled: boolean
              p_name: string
              p_onboarding_step: number
              p_organization_id: string
              p_primary_color: string
              p_restaurant_id: string
              p_secondary_color: string
              p_slug: string
              p_total_tables: number
              p_whatsapp: string
            }
            Returns: {
              delivery_enabled: boolean
              id: string
              local_enabled: boolean
              name: string
              onboarding_status: string
              onboarding_step: number
              onboarding_updated_at: string
              organization_id: string
              primary_color: string
              secondary_color: string
              slug: string
              total_tables: number
              whatsapp: string
            }[]
          }
      submit_order_feedback: {
        Args: {
          p_comment: string
          p_order_id: string
          p_public_access_token: string
          p_rating: number
          p_reasons: string[]
          p_restaurant_id: string
        }
        Returns: undefined
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
