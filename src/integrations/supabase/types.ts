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
      access_security_settings: {
        Row: {
          block_unknown_locations: boolean | null
          city_whitelist_enabled: boolean | null
          created_at: string | null
          id: string
          ip_whitelist_enabled: boolean | null
          lockout_duration_minutes: number | null
          max_failed_attempts: number | null
          strict_access_mode: boolean | null
          updated_at: string | null
        }
        Insert: {
          block_unknown_locations?: boolean | null
          city_whitelist_enabled?: boolean | null
          created_at?: string | null
          id?: string
          ip_whitelist_enabled?: boolean | null
          lockout_duration_minutes?: number | null
          max_failed_attempts?: number | null
          strict_access_mode?: boolean | null
          updated_at?: string | null
        }
        Update: {
          block_unknown_locations?: boolean | null
          city_whitelist_enabled?: boolean | null
          created_at?: string | null
          id?: string
          ip_whitelist_enabled?: boolean | null
          lockout_duration_minutes?: number | null
          max_failed_attempts?: number | null
          strict_access_mode?: boolean | null
          updated_at?: string | null
        }
        Relationships: []
      }
      admin_audit_log: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          duration_ms: number | null
          finished_at: string | null
          id: string
          ip_address: string | null
          payload_summary: Json | null
          request_id: string | null
          resource_id: string | null
          resource_type: string
          source: string | null
          started_at: string | null
          status: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          duration_ms?: number | null
          finished_at?: string | null
          id?: string
          ip_address?: string | null
          payload_summary?: Json | null
          request_id?: string | null
          resource_id?: string | null
          resource_type: string
          source?: string | null
          started_at?: string | null
          status?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          duration_ms?: number | null
          finished_at?: string | null
          id?: string
          ip_address?: string | null
          payload_summary?: Json | null
          request_id?: string | null
          resource_id?: string | null
          resource_type?: string
          source?: string | null
          started_at?: string | null
          status?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      admin_audit_log_y2025m12: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          duration_ms: number | null
          finished_at: string | null
          id: string
          ip_address: string | null
          payload_summary: Json | null
          request_id: string | null
          resource_id: string | null
          resource_type: string
          source: string | null
          started_at: string | null
          status: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          duration_ms?: number | null
          finished_at?: string | null
          id?: string
          ip_address?: string | null
          payload_summary?: Json | null
          request_id?: string | null
          resource_id?: string | null
          resource_type: string
          source?: string | null
          started_at?: string | null
          status?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          duration_ms?: number | null
          finished_at?: string | null
          id?: string
          ip_address?: string | null
          payload_summary?: Json | null
          request_id?: string | null
          resource_id?: string | null
          resource_type?: string
          source?: string | null
          started_at?: string | null
          status?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      admin_audit_log_y2026m01: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          duration_ms: number | null
          finished_at: string | null
          id: string
          ip_address: string | null
          payload_summary: Json | null
          request_id: string | null
          resource_id: string | null
          resource_type: string
          source: string | null
          started_at: string | null
          status: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          duration_ms?: number | null
          finished_at?: string | null
          id?: string
          ip_address?: string | null
          payload_summary?: Json | null
          request_id?: string | null
          resource_id?: string | null
          resource_type: string
          source?: string | null
          started_at?: string | null
          status?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          duration_ms?: number | null
          finished_at?: string | null
          id?: string
          ip_address?: string | null
          payload_summary?: Json | null
          request_id?: string | null
          resource_id?: string | null
          resource_type?: string
          source?: string | null
          started_at?: string | null
          status?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      admin_audit_log_y2026m02: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          duration_ms: number | null
          finished_at: string | null
          id: string
          ip_address: string | null
          payload_summary: Json | null
          request_id: string | null
          resource_id: string | null
          resource_type: string
          source: string | null
          started_at: string | null
          status: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          duration_ms?: number | null
          finished_at?: string | null
          id?: string
          ip_address?: string | null
          payload_summary?: Json | null
          request_id?: string | null
          resource_id?: string | null
          resource_type: string
          source?: string | null
          started_at?: string | null
          status?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          duration_ms?: number | null
          finished_at?: string | null
          id?: string
          ip_address?: string | null
          payload_summary?: Json | null
          request_id?: string | null
          resource_id?: string | null
          resource_type?: string
          source?: string | null
          started_at?: string | null
          status?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      admin_audit_log_y2026m03: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          duration_ms: number | null
          finished_at: string | null
          id: string
          ip_address: string | null
          payload_summary: Json | null
          request_id: string | null
          resource_id: string | null
          resource_type: string
          source: string | null
          started_at: string | null
          status: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          duration_ms?: number | null
          finished_at?: string | null
          id?: string
          ip_address?: string | null
          payload_summary?: Json | null
          request_id?: string | null
          resource_id?: string | null
          resource_type: string
          source?: string | null
          started_at?: string | null
          status?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          duration_ms?: number | null
          finished_at?: string | null
          id?: string
          ip_address?: string | null
          payload_summary?: Json | null
          request_id?: string | null
          resource_id?: string | null
          resource_type?: string
          source?: string | null
          started_at?: string | null
          status?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      admin_audit_log_y2026m04: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          duration_ms: number | null
          finished_at: string | null
          id: string
          ip_address: string | null
          payload_summary: Json | null
          request_id: string | null
          resource_id: string | null
          resource_type: string
          source: string | null
          started_at: string | null
          status: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          duration_ms?: number | null
          finished_at?: string | null
          id?: string
          ip_address?: string | null
          payload_summary?: Json | null
          request_id?: string | null
          resource_id?: string | null
          resource_type: string
          source?: string | null
          started_at?: string | null
          status?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          duration_ms?: number | null
          finished_at?: string | null
          id?: string
          ip_address?: string | null
          payload_summary?: Json | null
          request_id?: string | null
          resource_id?: string | null
          resource_type?: string
          source?: string | null
          started_at?: string | null
          status?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      admin_audit_log_y2026m05: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          duration_ms: number | null
          finished_at: string | null
          id: string
          ip_address: string | null
          payload_summary: Json | null
          request_id: string | null
          resource_id: string | null
          resource_type: string
          source: string | null
          started_at: string | null
          status: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          duration_ms?: number | null
          finished_at?: string | null
          id?: string
          ip_address?: string | null
          payload_summary?: Json | null
          request_id?: string | null
          resource_id?: string | null
          resource_type: string
          source?: string | null
          started_at?: string | null
          status?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          duration_ms?: number | null
          finished_at?: string | null
          id?: string
          ip_address?: string | null
          payload_summary?: Json | null
          request_id?: string | null
          resource_id?: string | null
          resource_type?: string
          source?: string | null
          started_at?: string | null
          status?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      admin_audit_log_y2026m06: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          duration_ms: number | null
          finished_at: string | null
          id: string
          ip_address: string | null
          payload_summary: Json | null
          request_id: string | null
          resource_id: string | null
          resource_type: string
          source: string | null
          started_at: string | null
          status: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          duration_ms?: number | null
          finished_at?: string | null
          id?: string
          ip_address?: string | null
          payload_summary?: Json | null
          request_id?: string | null
          resource_id?: string | null
          resource_type: string
          source?: string | null
          started_at?: string | null
          status?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          duration_ms?: number | null
          finished_at?: string | null
          id?: string
          ip_address?: string | null
          payload_summary?: Json | null
          request_id?: string | null
          resource_id?: string | null
          resource_type?: string
          source?: string | null
          started_at?: string | null
          status?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      admin_settings: {
        Row: {
          created_at: string
          id: string
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          created_at?: string
          id?: string
          key: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Update: {
          created_at?: string
          id?: string
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      ai_insights_cache: {
        Row: {
          cache_key: string
          created_at: string
          duration_ms: number | null
          expires_at: string
          function_name: string
          id: string
          model: string | null
          payload: Json
          tokens_input: number | null
          tokens_output: number | null
          user_id: string
        }
        Insert: {
          cache_key: string
          created_at?: string
          duration_ms?: number | null
          expires_at?: string
          function_name: string
          id?: string
          model?: string | null
          payload: Json
          tokens_input?: number | null
          tokens_output?: number | null
          user_id: string
        }
        Update: {
          cache_key?: string
          created_at?: string
          duration_ms?: number | null
          expires_at?: string
          function_name?: string
          id?: string
          model?: string | null
          payload?: Json
          tokens_input?: number | null
          tokens_output?: number | null
          user_id?: string
        }
        Relationships: []
      }
      ai_usage_events: {
        Row: {
          created_at: string
          event_type: string
          function_name: string
          id: string
          metadata: Json | null
          user_id: string
        }
        Insert: {
          created_at?: string
          event_type: string
          function_name: string
          id?: string
          metadata?: Json | null
          user_id: string
        }
        Update: {
          created_at?: string
          event_type?: string
          function_name?: string
          id?: string
          metadata?: Json | null
          user_id?: string
        }
        Relationships: []
      }
      ai_usage_logs: {
        Row: {
          created_at: string
          duration_ms: number | null
          error_message: string | null
          estimated_cost_usd: number | null
          function_name: string
          id: string
          input_tokens: number | null
          metadata: Json | null
          model: string | null
          output_tokens: number | null
          status: string
          total_tokens: number | null
          user_id: string
        }
        Insert: {
          created_at?: string
          duration_ms?: number | null
          error_message?: string | null
          estimated_cost_usd?: number | null
          function_name: string
          id?: string
          input_tokens?: number | null
          metadata?: Json | null
          model?: string | null
          output_tokens?: number | null
          status?: string
          total_tokens?: number | null
          user_id: string
        }
        Update: {
          created_at?: string
          duration_ms?: number | null
          error_message?: string | null
          estimated_cost_usd?: number | null
          function_name?: string
          id?: string
          input_tokens?: number | null
          metadata?: Json | null
          model?: string | null
          output_tokens?: number | null
          status?: string
          total_tokens?: number | null
          user_id?: string
        }
        Relationships: []
      }
      ai_usage_quotas: {
        Row: {
          created_at: string
          id: string
          is_unlimited: boolean
          monthly_limit: number
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_unlimited?: boolean
          monthly_limit?: number
          role: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_unlimited?: boolean
          monthly_limit?: number
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Relationships: []
      }
      app_vitals: {
        Row: {
          created_at: string
          id: string
          metric_name: string
          metric_value: number
          page_url: string | null
          rating: string | null
          request_id: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          metric_name: string
          metric_value: number
          page_url?: string | null
          rating?: string | null
          request_id?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          metric_name?: string
          metric_value?: number
          page_url?: string | null
          rating?: string | null
          request_id?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      art_file_attachments: {
        Row: {
          created_at: string
          file_extension: string | null
          file_path: string
          file_size_bytes: number | null
          file_url: string
          id: string
          mime_type: string | null
          mockup_id: string | null
          notes: string | null
          original_name: string
          quote_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          file_extension?: string | null
          file_path: string
          file_size_bytes?: number | null
          file_url: string
          id?: string
          mime_type?: string | null
          mockup_id?: string | null
          notes?: string | null
          original_name: string
          quote_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          file_extension?: string | null
          file_path?: string
          file_size_bytes?: number | null
          file_url?: string
          id?: string
          mime_type?: string | null
          mockup_id?: string | null
          notes?: string | null
          original_name?: string
          quote_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          created_at: string | null
          endpoint: string
          event_type: string
          id: string
          identifier: string
          metadata: Json | null
        }
        Insert: {
          created_at?: string | null
          endpoint: string
          event_type: string
          id?: string
          identifier: string
          metadata?: Json | null
        }
        Update: {
          created_at?: string | null
          endpoint?: string
          event_type?: string
          id?: string
          identifier?: string
          metadata?: Json | null
        }
        Relationships: []
      }
      auth_login_attempts: {
        Row: {
          created_at: string
          email: string
          failure_reason: string | null
          id: string
          ip_address: string | null
          success: boolean
          user_agent: string | null
        }
        Insert: {
          created_at?: string
          email: string
          failure_reason?: string | null
          id?: string
          ip_address?: string | null
          success?: boolean
          user_agent?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          failure_reason?: string | null
          id?: string
          ip_address?: string | null
          success?: boolean
          user_agent?: string | null
        }
        Relationships: []
      }
      bot_detection_log: {
        Row: {
          blocked: boolean
          created_at: string
          detection_reason: string
          endpoint: string
          id: string
          ip_address: string
          metadata: Json | null
          request_count: number | null
          user_agent: string | null
        }
        Insert: {
          blocked?: boolean
          created_at?: string
          detection_reason: string
          endpoint: string
          id?: string
          ip_address: string
          metadata?: Json | null
          request_count?: number | null
          user_agent?: string | null
        }
        Update: {
          blocked?: boolean
          created_at?: string
          detection_reason?: string
          endpoint?: string
          id?: string
          ip_address?: string
          metadata?: Json | null
          request_count?: number | null
          user_agent?: string | null
        }
        Relationships: []
      }
      cart_templates: {
        Row: {
          created_at: string
          description: string | null
          id: string
          items: Json
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          items?: Json
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          items?: Json
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      catalog_analytics: {
        Row: {
          created_at: string
          event_data: Json | null
          event_type: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          event_data?: Json | null
          event_type: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          event_data?: Json | null
          event_type?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      categories: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          name: string
          parent_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          parent_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          parent_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      category_icons: {
        Row: {
          category_name: string
          created_at: string
          description: string | null
          icon: string
          id: string
          is_active: boolean
          updated_at: string
        }
        Insert: {
          category_name: string
          created_at?: string
          description?: string | null
          icon: string
          id?: string
          is_active?: boolean
          updated_at?: string
        }
        Update: {
          category_name?: string
          created_at?: string
          description?: string | null
          icon?: string
          id?: string
          is_active?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      collection_item_reactions: {
        Row: {
          anon_id: string
          collection_id: string
          created_at: string
          emoji: string
          id: string
          ip_hash: string | null
          item_id: string
          user_agent: string | null
        }
        Insert: {
          anon_id: string
          collection_id: string
          created_at?: string
          emoji: string
          id?: string
          ip_hash?: string | null
          item_id: string
          user_agent?: string | null
        }
        Update: {
          anon_id?: string
          collection_id?: string
          created_at?: string
          emoji?: string
          id?: string
          ip_hash?: string | null
          item_id?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      collection_items: {
        Row: {
          added_at: string
          collection_id: string
          color_hex: string | null
          color_name: string | null
          created_at: string
          id: string
          notes: string | null
          price_at_save: number | null
          product_id: string
          sort_order: number | null
          thumbnail_url: string | null
        }
        Insert: {
          added_at?: string
          collection_id: string
          color_hex?: string | null
          color_name?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          price_at_save?: number | null
          product_id: string
          sort_order?: number | null
          thumbnail_url?: string | null
        }
        Update: {
          added_at?: string
          collection_id?: string
          color_hex?: string | null
          color_name?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          price_at_save?: number | null
          product_id?: string
          sort_order?: number | null
          thumbnail_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "collection_items_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "collections"
            referencedColumns: ["id"]
          },
        ]
      }
      collection_items_trash: {
        Row: {
          collection_id: string
          color_hex: string | null
          color_name: string | null
          deleted_at: string
          expires_at: string
          id: string
          notes: string | null
          original_id: string
          price_at_save: number | null
          product_id: string
          sort_order: number | null
          thumbnail_url: string | null
          user_id: string
        }
        Insert: {
          collection_id: string
          color_hex?: string | null
          color_name?: string | null
          deleted_at?: string
          expires_at?: string
          id?: string
          notes?: string | null
          original_id: string
          price_at_save?: number | null
          product_id: string
          sort_order?: number | null
          thumbnail_url?: string | null
          user_id: string
        }
        Update: {
          collection_id?: string
          color_hex?: string | null
          color_name?: string | null
          deleted_at?: string
          expires_at?: string
          id?: string
          notes?: string | null
          original_id?: string
          price_at_save?: number | null
          product_id?: string
          sort_order?: number | null
          thumbnail_url?: string | null
          user_id?: string
        }
        Relationships: []
      }
      collections: {
        Row: {
          client_id: string | null
          client_name: string | null
          created_at: string
          description: string | null
          icon: string | null
          icon_color: string | null
          id: string
          is_deleted: boolean
          is_featured: boolean
          is_public: boolean
          name: string
          share_expires_at: string | null
          share_token: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          client_id?: string | null
          client_name?: string | null
          created_at?: string
          description?: string | null
          icon?: string | null
          icon_color?: string | null
          id?: string
          is_deleted?: boolean
          is_featured?: boolean
          is_public?: boolean
          name: string
          share_expires_at?: string | null
          share_token?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          client_id?: string | null
          client_name?: string | null
          created_at?: string
          description?: string | null
          icon?: string | null
          icon_color?: string | null
          id?: string
          is_deleted?: boolean
          is_featured?: boolean
          is_public?: boolean
          name?: string
          share_expires_at?: string | null
          share_token?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      comparison_reactions: {
        Row: {
          anon_id: string
          comparison_id: string
          created_at: string
          emoji: string
          id: string
          ip_hash: string | null
          item_index: number
          user_agent: string | null
        }
        Insert: {
          anon_id: string
          comparison_id: string
          created_at?: string
          emoji: string
          id?: string
          ip_hash?: string | null
          item_index?: number
          user_agent?: string | null
        }
        Update: {
          anon_id?: string
          comparison_id?: string
          created_at?: string
          emoji?: string
          id?: string
          ip_hash?: string | null
          item_index?: number
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "comparison_reactions_comparison_id_fkey"
            columns: ["comparison_id"]
            isOneToOne: false
            referencedRelation: "user_comparisons"
            referencedColumns: ["id"]
          },
        ]
      }
      component_media: {
        Row: {
          component_id: string
          created_at: string
          id: string
          is_cover: boolean | null
          media_type: string
          product_id: string
          sort_order: number | null
          title: string | null
          updated_at: string
          url: string
        }
        Insert: {
          component_id: string
          created_at?: string
          id?: string
          is_cover?: boolean | null
          media_type?: string
          product_id: string
          sort_order?: number | null
          title?: string | null
          updated_at?: string
          url: string
        }
        Update: {
          component_id?: string
          created_at?: string
          id?: string
          is_cover?: boolean | null
          media_type?: string
          product_id?: string
          sort_order?: number | null
          title?: string | null
          updated_at?: string
          url?: string
        }
        Relationships: []
      }
      connection_test_history: {
        Row: {
          attempts: number
          connection_id: string
          created_at: string
          dns_ms: number | null
          download_ms: number | null
          error_kind: string | null
          error_message: string | null
          id: string
          latency_ms: number | null
          request_method: string | null
          request_url: string | null
          response_body: string | null
          response_headers: Json | null
          status_code: number | null
          success: boolean
          tcp_ms: number | null
          tested_at: string
          tls_ms: number | null
          triggered_by: string
          triggered_by_user_id: string | null
          ttfb_ms: number | null
        }
        Insert: {
          attempts?: number
          connection_id: string
          created_at?: string
          dns_ms?: number | null
          download_ms?: number | null
          error_kind?: string | null
          error_message?: string | null
          id?: string
          latency_ms?: number | null
          request_method?: string | null
          request_url?: string | null
          response_body?: string | null
          response_headers?: Json | null
          status_code?: number | null
          success?: boolean
          tcp_ms?: number | null
          tested_at?: string
          tls_ms?: number | null
          triggered_by?: string
          triggered_by_user_id?: string | null
          ttfb_ms?: number | null
        }
        Update: {
          attempts?: number
          connection_id?: string
          created_at?: string
          dns_ms?: number | null
          download_ms?: number | null
          error_kind?: string | null
          error_message?: string | null
          id?: string
          latency_ms?: number | null
          request_method?: string | null
          request_url?: string | null
          response_body?: string | null
          response_headers?: Json | null
          status_code?: number | null
          success?: boolean
          tcp_ms?: number | null
          tested_at?: string
          tls_ms?: number | null
          triggered_by?: string
          triggered_by_user_id?: string | null
          ttfb_ms?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "connection_test_history_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "external_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_audit_logs: {
        Row: {
          client_info: Json | null
          ended_at: string | null
          id: string
          metadata: Json | null
          session_id: string
          started_at: string
          status: string
          total_tokens_estimated: number | null
          user_id: string
        }
        Insert: {
          client_info?: Json | null
          ended_at?: string | null
          id?: string
          metadata?: Json | null
          session_id: string
          started_at?: string
          status?: string
          total_tokens_estimated?: number | null
          user_id: string
        }
        Update: {
          client_info?: Json | null
          ended_at?: string | null
          id?: string
          metadata?: Json | null
          session_id?: string
          started_at?: string
          status?: string
          total_tokens_estimated?: number | null
          user_id?: string
        }
        Relationships: []
      }
      conversation_delivery_status: {
        Row: {
          error_details: string | null
          event_id: string
          id: string
          status: string
          updated_at: string
        }
        Insert: {
          error_details?: string | null
          event_id: string
          id?: string
          status?: string
          updated_at?: string
        }
        Update: {
          error_details?: string | null
          event_id?: string
          id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_delivery_status_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "conversation_event_history"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_event_history: {
        Row: {
          content: string | null
          conversation_id: string
          created_at: string
          event_type: Database["public"]["Enums"]["conversation_event_type"]
          id: string
          media_metadata: Json | null
          media_url: string | null
          request_id: string | null
          role: string
          tokens_estimated: number | null
        }
        Insert: {
          content?: string | null
          conversation_id: string
          created_at?: string
          event_type?: Database["public"]["Enums"]["conversation_event_type"]
          id?: string
          media_metadata?: Json | null
          media_url?: string | null
          request_id?: string | null
          role: string
          tokens_estimated?: number | null
        }
        Update: {
          content?: string | null
          conversation_id?: string
          created_at?: string
          event_type?: Database["public"]["Enums"]["conversation_event_type"]
          id?: string
          media_metadata?: Json | null
          media_url?: string | null
          request_id?: string | null
          role?: string
          tokens_estimated?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "conversation_event_history_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversation_audit_logs"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_kits: {
        Row: {
          box_data: Json | null
          box_price: number
          color: string
          created_at: string
          description: string | null
          icon: string
          id: string
          is_favorite: boolean
          is_pinned: boolean
          items_data: Json
          items_price: number
          kit_quantity: number
          kit_type: string
          last_used_at: string | null
          name: string
          organization_id: string | null
          personalization_data: Json
          personalization_price: number
          status: string
          tag: string | null
          total_price: number
          updated_at: string
          user_id: string
          volume_usage_percent: number
        }
        Insert: {
          box_data?: Json | null
          box_price?: number
          color?: string
          created_at?: string
          description?: string | null
          icon?: string
          id?: string
          is_favorite?: boolean
          is_pinned?: boolean
          items_data?: Json
          items_price?: number
          kit_quantity?: number
          kit_type?: string
          last_used_at?: string | null
          name?: string
          organization_id?: string | null
          personalization_data?: Json
          personalization_price?: number
          status?: string
          tag?: string | null
          total_price?: number
          updated_at?: string
          user_id: string
          volume_usage_percent?: number
        }
        Update: {
          box_data?: Json | null
          box_price?: number
          color?: string
          created_at?: string
          description?: string | null
          icon?: string
          id?: string
          is_favorite?: boolean
          is_pinned?: boolean
          items_data?: Json
          items_price?: number
          kit_quantity?: number
          kit_type?: string
          last_used_at?: string | null
          name?: string
          organization_id?: string | null
          personalization_data?: Json
          personalization_price?: number
          status?: string
          tag?: string | null
          total_price?: number
          updated_at?: string
          user_id?: string
          volume_usage_percent?: number
        }
        Relationships: []
      }
      discount_approval_requests: {
        Row: {
          admin_id: string | null
          admin_notes: string | null
          created_at: string
          id: string
          max_allowed_percent: number
          quote_id: string
          quote_snapshot_hash: string | null
          requested_discount_percent: number
          responded_at: string | null
          seller_id: string
          seller_notes: string | null
          status: string
          updated_at: string
          valid_until: string | null
        }
        Insert: {
          admin_id?: string | null
          admin_notes?: string | null
          created_at?: string
          id?: string
          max_allowed_percent: number
          quote_id: string
          quote_snapshot_hash?: string | null
          requested_discount_percent: number
          responded_at?: string | null
          seller_id: string
          seller_notes?: string | null
          status?: string
          updated_at?: string
          valid_until?: string | null
        }
        Update: {
          admin_id?: string | null
          admin_notes?: string | null
          created_at?: string
          id?: string
          max_allowed_percent?: number
          quote_id?: string
          quote_snapshot_hash?: string | null
          requested_discount_percent?: number
          responded_at?: string | null
          seller_id?: string
          seller_notes?: string | null
          status?: string
          updated_at?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "discount_approval_requests_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      e2e_cleanup_audit: {
        Row: {
          created_at: string
          deleted_by_table: Json
          dry_run: boolean
          duration_ms: number
          email: string
          errors: Json
          id: string
          ip: string | null
          name_filter_prefix: string | null
          reason: string | null
          seller_id: string | null
          seller_scope: string | null
          status: string
          total_deleted: number
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          deleted_by_table?: Json
          dry_run?: boolean
          duration_ms?: number
          email: string
          errors?: Json
          id?: string
          ip?: string | null
          name_filter_prefix?: string | null
          reason?: string | null
          seller_id?: string | null
          seller_scope?: string | null
          status: string
          total_deleted?: number
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          deleted_by_table?: Json
          dry_run?: boolean
          duration_ms?: number
          email?: string
          errors?: Json
          id?: string
          ip?: string | null
          name_filter_prefix?: string | null
          reason?: string | null
          seller_id?: string | null
          seller_scope?: string | null
          status?: string
          total_deleted?: number
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      e2e_cleanup_rate_limit: {
        Row: {
          count: number
          key: string
          updated_at: string
          window_start: string
        }
        Insert: {
          count?: number
          key: string
          updated_at?: string
          window_start?: string
        }
        Update: {
          count?: number
          key?: string
          updated_at?: string
          window_start?: string
        }
        Relationships: []
      }
      edge_rate_limits: {
        Row: {
          count: number
          created_at: string | null
          key: string
          reset_at: string
          updated_at: string | null
        }
        Insert: {
          count?: number
          created_at?: string | null
          key: string
          reset_at: string
          updated_at?: string | null
        }
        Update: {
          count?: number
          created_at?: string | null
          key?: string
          reset_at?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      expert_conversations: {
        Row: {
          client_id: string | null
          created_at: string
          id: string
          seller_id: string
          title: string
          updated_at: string
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          id?: string
          seller_id: string
          title?: string
          updated_at?: string
        }
        Update: {
          client_id?: string | null
          created_at?: string
          id?: string
          seller_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      expert_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          role: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          role?: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "expert_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "expert_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      external_connections: {
        Row: {
          auto_test_enabled: boolean
          config: Json
          created_at: string
          created_by: string
          env_key: string | null
          id: string
          last_latency_ms: number | null
          last_test_at: string | null
          last_test_message: string | null
          last_test_ok: boolean | null
          name: string
          secret_refs: string[]
          status: string
          type: string
          updated_at: string
        }
        Insert: {
          auto_test_enabled?: boolean
          config?: Json
          created_at?: string
          created_by: string
          env_key?: string | null
          id?: string
          last_latency_ms?: number | null
          last_test_at?: string | null
          last_test_message?: string | null
          last_test_ok?: boolean | null
          name: string
          secret_refs?: string[]
          status?: string
          type: string
          updated_at?: string
        }
        Update: {
          auto_test_enabled?: boolean
          config?: Json
          created_at?: string
          created_by?: string
          env_key?: string | null
          id?: string
          last_latency_ms?: number | null
          last_test_at?: string | null
          last_test_message?: string | null
          last_test_ok?: boolean | null
          name?: string
          secret_refs?: string[]
          status?: string
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      external_connections_sync_log: {
        Row: {
          completed_at: string | null
          connection_id: string | null
          connection_name: string
          duration_ms: number | null
          error_message: string | null
          id: string
          metadata: Json | null
          records_failed: number | null
          records_processed: number | null
          started_at: string
          status: string
          sync_type: string
        }
        Insert: {
          completed_at?: string | null
          connection_id?: string | null
          connection_name: string
          duration_ms?: number | null
          error_message?: string | null
          id?: string
          metadata?: Json | null
          records_failed?: number | null
          records_processed?: number | null
          started_at?: string
          status?: string
          sync_type?: string
        }
        Update: {
          completed_at?: string | null
          connection_id?: string | null
          connection_name?: string
          duration_ms?: number | null
          error_message?: string | null
          id?: string
          metadata?: Json | null
          records_failed?: number | null
          records_processed?: number | null
          started_at?: string
          status?: string
          sync_type?: string
        }
        Relationships: []
      }
      favorite_item_reactions: {
        Row: {
          anon_id: string
          created_at: string
          emoji: string
          id: string
          ip_hash: string | null
          item_id: string
          list_id: string
          user_agent: string | null
        }
        Insert: {
          anon_id: string
          created_at?: string
          emoji: string
          id?: string
          ip_hash?: string | null
          item_id: string
          list_id: string
          user_agent?: string | null
        }
        Update: {
          anon_id?: string
          created_at?: string
          emoji?: string
          id?: string
          ip_hash?: string | null
          item_id?: string
          list_id?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "favorite_item_reactions_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "favorite_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "favorite_item_reactions_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "favorite_lists"
            referencedColumns: ["id"]
          },
        ]
      }
      favorite_items: {
        Row: {
          added_at: string
          id: string
          list_id: string
          note: string | null
          position: number
          price_at_save: number | null
          product_id: string
          updated_at: string
          user_id: string
          variant_id: string | null
          variant_info: Json | null
        }
        Insert: {
          added_at?: string
          id?: string
          list_id: string
          note?: string | null
          position?: number
          price_at_save?: number | null
          product_id: string
          updated_at?: string
          user_id: string
          variant_id?: string | null
          variant_info?: Json | null
        }
        Update: {
          added_at?: string
          id?: string
          list_id?: string
          note?: string | null
          position?: number
          price_at_save?: number | null
          product_id?: string
          updated_at?: string
          user_id?: string
          variant_id?: string | null
          variant_info?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "favorite_items_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "favorite_lists"
            referencedColumns: ["id"]
          },
        ]
      }
      favorite_items_trash: {
        Row: {
          added_at: string | null
          deleted_at: string
          expires_at: string
          id: string
          list_id: string
          note: string | null
          original_id: string
          position: number | null
          price_at_save: number | null
          product_id: string
          user_id: string
          variant_id: string | null
          variant_info: Json | null
        }
        Insert: {
          added_at?: string | null
          deleted_at?: string
          expires_at?: string
          id?: string
          list_id: string
          note?: string | null
          original_id: string
          position?: number | null
          price_at_save?: number | null
          product_id: string
          user_id: string
          variant_id?: string | null
          variant_info?: Json | null
        }
        Update: {
          added_at?: string | null
          deleted_at?: string
          expires_at?: string
          id?: string
          list_id?: string
          note?: string | null
          original_id?: string
          position?: number | null
          price_at_save?: number | null
          product_id?: string
          user_id?: string
          variant_id?: string | null
          variant_info?: Json | null
        }
        Relationships: []
      }
      favorite_lists: {
        Row: {
          client_id: string | null
          client_name: string | null
          color: string
          created_at: string
          description: string | null
          icon: string
          id: string
          is_archived: boolean
          is_default: boolean
          name: string
          position: number
          shared_expires_at: string | null
          shared_token: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          client_id?: string | null
          client_name?: string | null
          color?: string
          created_at?: string
          description?: string | null
          icon?: string
          id?: string
          is_archived?: boolean
          is_default?: boolean
          name?: string
          position?: number
          shared_expires_at?: string | null
          shared_token?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          client_id?: string | null
          client_name?: string | null
          color?: string
          created_at?: string
          description?: string | null
          icon?: string
          id?: string
          is_archived?: boolean
          is_default?: boolean
          name?: string
          position?: number
          shared_expires_at?: string | null
          shared_token?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      file_scan_logs: {
        Row: {
          created_at: string
          file_hash: string | null
          file_name: string
          file_size: number | null
          id: string
          mime_type: string | null
          scan_provider: string
          scan_response: Json | null
          scan_result: string
          storage_path: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          file_hash?: string | null
          file_name: string
          file_size?: number | null
          id?: string
          mime_type?: string | null
          scan_provider?: string
          scan_response?: Json | null
          scan_result?: string
          storage_path?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          file_hash?: string | null
          file_name?: string
          file_size?: number | null
          id?: string
          mime_type?: string | null
          scan_provider?: string
          scan_response?: Json | null
          scan_result?: string
          storage_path?: string | null
          user_id?: string
        }
        Relationships: []
      }
      follow_up_reminders: {
        Row: {
          completed_at: string | null
          created_at: string
          id: string
          is_completed: boolean
          is_sent: boolean
          notes: string | null
          quote_id: string
          reminder_type: string
          scheduled_for: string
          seller_id: string
          sent_at: string | null
          title: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          id?: string
          is_completed?: boolean
          is_sent?: boolean
          notes?: string | null
          quote_id: string
          reminder_type?: string
          scheduled_for: string
          seller_id: string
          sent_at?: string | null
          title?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          id?: string
          is_completed?: boolean
          is_sent?: boolean
          notes?: string | null
          quote_id?: string
          reminder_type?: string
          scheduled_for?: string
          seller_id?: string
          sent_at?: string | null
          title?: string | null
        }
        Relationships: []
      }
      frontend_telemetry: {
        Row: {
          created_at: string
          duration_ms: number | null
          event_type: string
          id: string
          metadata: Json | null
          name: string
          session_id: string | null
          url: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          duration_ms?: number | null
          event_type: string
          id?: string
          metadata?: Json | null
          name: string
          session_id?: string | null
          url?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          duration_ms?: number | null
          event_type?: string
          id?: string
          metadata?: Json | null
          name?: string
          session_id?: string | null
          url?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      generated_mockups: {
        Row: {
          ai_model_used: string
          approval_status: string | null
          approved_at: string | null
          approved_by_user_id: string | null
          area_config: Json
          area_name: string
          client_feedback: string | null
          created_at: string
          error_details: string | null
          generation_cost: number | null
          generation_time_seconds: number | null
          has_errors: boolean | null
          id: string
          job_id: string
          logo_url: string
          mockup_url: string
          product_color_hex: string
          product_color_name: string | null
          product_id: string | null
          product_name: string
          product_sku: string | null
          prompt_used: string | null
          quality_score: number | null
          seed_used: number | null
          technique_id: string | null
          technique_name: string
          thumbnail_url: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          ai_model_used: string
          approval_status?: string | null
          approved_at?: string | null
          approved_by_user_id?: string | null
          area_config: Json
          area_name: string
          client_feedback?: string | null
          created_at?: string
          error_details?: string | null
          generation_cost?: number | null
          generation_time_seconds?: number | null
          has_errors?: boolean | null
          id?: string
          job_id: string
          logo_url: string
          mockup_url: string
          product_color_hex: string
          product_color_name?: string | null
          product_id?: string | null
          product_name: string
          product_sku?: string | null
          prompt_used?: string | null
          quality_score?: number | null
          seed_used?: number | null
          technique_id?: string | null
          technique_name: string
          thumbnail_url?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          ai_model_used?: string
          approval_status?: string | null
          approved_at?: string | null
          approved_by_user_id?: string | null
          area_config?: Json
          area_name?: string
          client_feedback?: string | null
          created_at?: string
          error_details?: string | null
          generation_cost?: number | null
          generation_time_seconds?: number | null
          has_errors?: boolean | null
          id?: string
          job_id?: string
          logo_url?: string
          mockup_url?: string
          product_color_hex?: string
          product_color_name?: string | null
          product_id?: string | null
          product_name?: string
          product_sku?: string | null
          prompt_used?: string | null
          quality_score?: number | null
          seed_used?: number | null
          technique_id?: string | null
          technique_name?: string
          thumbnail_url?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      geo_allowed_countries: {
        Row: {
          country_code: string
          country_name: string
          created_at: string | null
          created_by: string | null
          id: string
          is_active: boolean | null
        }
        Insert: {
          country_code: string
          country_name: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean | null
        }
        Update: {
          country_code?: string
          country_name?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean | null
        }
        Relationships: []
      }
      hardening_health_snapshots: {
        Row: {
          created_at: string
          details: Json
          failures: string[]
          id: string
          max_score: number
          score: number
          snapshot_at: string
        }
        Insert: {
          created_at?: string
          details?: Json
          failures?: string[]
          id?: string
          max_score?: number
          score: number
          snapshot_at?: string
        }
        Update: {
          created_at?: string
          details?: Json
          failures?: string[]
          id?: string
          max_score?: number
          score?: number
          snapshot_at?: string
        }
        Relationships: []
      }
      inbound_webhook_endpoints: {
        Row: {
          allowed_events: string[]
          allowed_ips: string[] | null
          created_at: string
          created_by: string
          description: string | null
          hmac_secret_ref: string
          id: string
          is_active: boolean
          last_received_at: string | null
          metadata: Json | null
          name: string
          secret_key: string | null
          slug: string
          source_system: string
          total_invalid: number
          total_received: number
          updated_at: string
        }
        Insert: {
          allowed_events?: string[]
          allowed_ips?: string[] | null
          created_at?: string
          created_by: string
          description?: string | null
          hmac_secret_ref: string
          id?: string
          is_active?: boolean
          last_received_at?: string | null
          metadata?: Json | null
          name: string
          secret_key?: string | null
          slug: string
          source_system: string
          total_invalid?: number
          total_received?: number
          updated_at?: string
        }
        Update: {
          allowed_events?: string[]
          allowed_ips?: string[] | null
          created_at?: string
          created_by?: string
          description?: string | null
          hmac_secret_ref?: string
          id?: string
          is_active?: boolean
          last_received_at?: string | null
          metadata?: Json | null
          name?: string
          secret_key?: string | null
          slug?: string
          source_system?: string
          total_invalid?: number
          total_received?: number
          updated_at?: string
        }
        Relationships: []
      }
      inbound_webhook_events: {
        Row: {
          contract_version: string | null
          created_at: string
          endpoint_id: string
          error_message: string | null
          event_type: string | null
          headers: Json | null
          id: string
          idempotency_key: string | null
          ip_address: string | null
          payload: Json | null
          processed: boolean
          processed_at: string | null
          signature_valid: boolean
        }
        Insert: {
          contract_version?: string | null
          created_at?: string
          endpoint_id: string
          error_message?: string | null
          event_type?: string | null
          headers?: Json | null
          id?: string
          idempotency_key?: string | null
          ip_address?: string | null
          payload?: Json | null
          processed?: boolean
          processed_at?: string | null
          signature_valid?: boolean
        }
        Update: {
          contract_version?: string | null
          created_at?: string
          endpoint_id?: string
          error_message?: string | null
          event_type?: string | null
          headers?: Json | null
          id?: string
          idempotency_key?: string | null
          ip_address?: string | null
          payload?: Json | null
          processed?: boolean
          processed_at?: string | null
          signature_valid?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "inbound_webhook_events_endpoint_id_fkey"
            columns: ["endpoint_id"]
            isOneToOne: false
            referencedRelation: "inbound_webhook_endpoints"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_credentials: {
        Row: {
          created_at: string
          created_by: string | null
          credential_type: string | null
          description: string | null
          expires_at: string | null
          id: string
          is_active: boolean | null
          length: number | null
          masked_suffix: string | null
          metadata: Json | null
          notes: string | null
          provider: string | null
          secret_name: string
          secret_value: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          credential_type?: string | null
          description?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          length?: number | null
          masked_suffix?: string | null
          metadata?: Json | null
          notes?: string | null
          provider?: string | null
          secret_name: string
          secret_value: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          credential_type?: string | null
          description?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          length?: number | null
          masked_suffix?: string | null
          metadata?: Json | null
          notes?: string | null
          provider?: string | null
          secret_name?: string
          secret_value?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      ip_access_control: {
        Row: {
          created_at: string
          created_by: string
          expires_at: string | null
          id: string
          ip_address: string
          list_type: string
          metadata: Json | null
          reason: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          expires_at?: string | null
          id?: string
          ip_address: string
          list_type: string
          metadata?: Json | null
          reason?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          expires_at?: string | null
          id?: string
          ip_address?: string
          list_type?: string
          metadata?: Json | null
          reason?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      kit_collaborators: {
        Row: {
          created_at: string
          id: string
          invited_by: string | null
          invited_email: string | null
          kit_id: string
          permission: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          invited_by?: string | null
          invited_email?: string | null
          kit_id: string
          permission?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          invited_by?: string | null
          invited_email?: string | null
          kit_id?: string
          permission?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "kit_collaborators_kit_id_fkey"
            columns: ["kit_id"]
            isOneToOne: false
            referencedRelation: "custom_kits"
            referencedColumns: ["id"]
          },
        ]
      }
      kit_comments: {
        Row: {
          author_id: string
          body: string
          created_at: string
          id: string
          item_anchor: string | null
          kit_id: string
          parent_id: string | null
          resolved: boolean
          updated_at: string
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string
          id?: string
          item_anchor?: string | null
          kit_id: string
          parent_id?: string | null
          resolved?: boolean
          updated_at?: string
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          id?: string
          item_anchor?: string | null
          kit_id?: string
          parent_id?: string | null
          resolved?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "kit_comments_kit_id_fkey"
            columns: ["kit_id"]
            isOneToOne: false
            referencedRelation: "custom_kits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kit_comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "kit_comments"
            referencedColumns: ["id"]
          },
        ]
      }
      kit_share_tokens: {
        Row: {
          client_email: string | null
          client_name: string | null
          created_at: string
          expires_at: string | null
          id: string
          kit_id: string
          seller_id: string
          status: string
          token: string
          updated_at: string
          viewed_at: string | null
        }
        Insert: {
          client_email?: string | null
          client_name?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          kit_id: string
          seller_id: string
          status?: string
          token?: string
          updated_at?: string
          viewed_at?: string | null
        }
        Update: {
          client_email?: string | null
          client_name?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          kit_id?: string
          seller_id?: string
          status?: string
          token?: string
          updated_at?: string
          viewed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "kit_share_tokens_kit_id_fkey"
            columns: ["kit_id"]
            isOneToOne: false
            referencedRelation: "custom_kits"
            referencedColumns: ["id"]
          },
        ]
      }
      kit_templates: {
        Row: {
          box_data: Json | null
          category: string
          color: string
          cover_image_url: string | null
          created_at: string
          created_by: string | null
          description: string | null
          icon: string
          id: string
          is_active: boolean
          items_data: Json
          name: string
          personalization_data: Json
          tag: string | null
          total_price: number
          updated_at: string
          usage_count: number
          volume_usage_percent: number
        }
        Insert: {
          box_data?: Json | null
          category?: string
          color?: string
          cover_image_url?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          icon?: string
          id?: string
          is_active?: boolean
          items_data?: Json
          name: string
          personalization_data?: Json
          tag?: string | null
          total_price?: number
          updated_at?: string
          usage_count?: number
          volume_usage_percent?: number
        }
        Update: {
          box_data?: Json | null
          category?: string
          color?: string
          cover_image_url?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          icon?: string
          id?: string
          is_active?: boolean
          items_data?: Json
          name?: string
          personalization_data?: Json
          tag?: string | null
          total_price?: number
          updated_at?: string
          usage_count?: number
          volume_usage_percent?: number
        }
        Relationships: []
      }
      kit_variants: {
        Row: {
          box_data: Json | null
          created_at: string
          id: string
          items_data: Json
          kit_master_id: string
          kit_quantity: number
          label: string
          personalization_data: Json
          sort_order: number
          total_price: number
          updated_at: string
        }
        Insert: {
          box_data?: Json | null
          created_at?: string
          id?: string
          items_data?: Json
          kit_master_id: string
          kit_quantity?: number
          label: string
          personalization_data?: Json
          sort_order?: number
          total_price?: number
          updated_at?: string
        }
        Update: {
          box_data?: Json | null
          created_at?: string
          id?: string
          items_data?: Json
          kit_master_id?: string
          kit_quantity?: number
          label?: string
          personalization_data?: Json
          sort_order?: number
          total_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "kit_variants_kit_master_id_fkey"
            columns: ["kit_master_id"]
            isOneToOne: false
            referencedRelation: "custom_kits"
            referencedColumns: ["id"]
          },
        ]
      }
      login_attempts: {
        Row: {
          created_at: string
          email: string
          failure_reason: string | null
          id: string
          ip_address: string
          metadata: Json | null
          success: boolean
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email: string
          failure_reason?: string | null
          id?: string
          ip_address?: string
          metadata?: Json | null
          success?: boolean
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          failure_reason?: string | null
          id?: string
          ip_address?: string
          metadata?: Json | null
          success?: boolean
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      magic_up_brand_kits: {
        Row: {
          client_id: string | null
          client_name: string | null
          created_at: string
          forbidden_words: string[]
          id: string
          logo_urls: Json
          metadata: Json
          notes: string | null
          primary_color: string | null
          required_words: string[]
          secondary_color: string | null
          tone_of_voice: string | null
          updated_at: string
          user_id: string
          visual_style: string | null
        }
        Insert: {
          client_id?: string | null
          client_name?: string | null
          created_at?: string
          forbidden_words?: string[]
          id?: string
          logo_urls?: Json
          metadata?: Json
          notes?: string | null
          primary_color?: string | null
          required_words?: string[]
          secondary_color?: string | null
          tone_of_voice?: string | null
          updated_at?: string
          user_id: string
          visual_style?: string | null
        }
        Update: {
          client_id?: string | null
          client_name?: string | null
          created_at?: string
          forbidden_words?: string[]
          id?: string
          logo_urls?: Json
          metadata?: Json
          notes?: string | null
          primary_color?: string | null
          required_words?: string[]
          secondary_color?: string | null
          tone_of_voice?: string | null
          updated_at?: string
          user_id?: string
          visual_style?: string | null
        }
        Relationships: []
      }
      magic_up_campaigns: {
        Row: {
          audience: string | null
          channel: string | null
          client_id: string | null
          client_name: string | null
          created_at: string
          cta: string | null
          id: string
          metadata: Json
          objective: string | null
          occasion: string | null
          status: string
          title: string
          tone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          audience?: string | null
          channel?: string | null
          client_id?: string | null
          client_name?: string | null
          created_at?: string
          cta?: string | null
          id?: string
          metadata?: Json
          objective?: string | null
          occasion?: string | null
          status?: string
          title?: string
          tone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          audience?: string | null
          channel?: string | null
          client_id?: string | null
          client_name?: string | null
          created_at?: string
          cta?: string | null
          id?: string
          metadata?: Json
          objective?: string | null
          occasion?: string | null
          status?: string
          title?: string
          tone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      magic_up_comments: {
        Row: {
          author_name: string
          comment: string
          created_at: string
          generation_id: string
          id: string
          is_public: boolean
          user_id: string
        }
        Insert: {
          author_name?: string
          comment: string
          created_at?: string
          generation_id: string
          id?: string
          is_public?: boolean
          user_id: string
        }
        Update: {
          author_name?: string
          comment?: string
          created_at?: string
          generation_id?: string
          id?: string
          is_public?: boolean
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "magic_up_comments_generation_id_fkey"
            columns: ["generation_id"]
            isOneToOne: false
            referencedRelation: "magic_up_generations"
            referencedColumns: ["id"]
          },
        ]
      }
      magic_up_generations: {
        Row: {
          aspect_ratio: string | null
          campaign_id: string | null
          channel: string | null
          client_name: string | null
          copy_pack: Json
          created_at: string
          export_presets: Json
          generated_image_url: string | null
          id: string
          is_favorite: boolean | null
          metadata: Json
          model: string | null
          product_id: string | null
          product_name: string | null
          product_sku: string | null
          prompt_text: string | null
          quality_score: number | null
          scene_category: string | null
          scene_title: string | null
          status: string
          tags: string[]
          user_id: string
        }
        Insert: {
          aspect_ratio?: string | null
          campaign_id?: string | null
          channel?: string | null
          client_name?: string | null
          copy_pack?: Json
          created_at?: string
          export_presets?: Json
          generated_image_url?: string | null
          id?: string
          is_favorite?: boolean | null
          metadata?: Json
          model?: string | null
          product_id?: string | null
          product_name?: string | null
          product_sku?: string | null
          prompt_text?: string | null
          quality_score?: number | null
          scene_category?: string | null
          scene_title?: string | null
          status?: string
          tags?: string[]
          user_id: string
        }
        Update: {
          aspect_ratio?: string | null
          campaign_id?: string | null
          channel?: string | null
          client_name?: string | null
          copy_pack?: Json
          created_at?: string
          export_presets?: Json
          generated_image_url?: string | null
          id?: string
          is_favorite?: boolean | null
          metadata?: Json
          model?: string | null
          product_id?: string | null
          product_name?: string | null
          product_sku?: string | null
          prompt_text?: string | null
          quality_score?: number | null
          scene_category?: string | null
          scene_title?: string | null
          status?: string
          tags?: string[]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "magic_up_generations_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "magic_up_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      magic_up_public_shares: {
        Row: {
          allow_comments: boolean
          allow_download: boolean
          campaign_id: string | null
          created_at: string
          expires_at: string | null
          generation_id: string | null
          id: string
          metadata: Json
          share_token: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          allow_comments?: boolean
          allow_download?: boolean
          campaign_id?: string | null
          created_at?: string
          expires_at?: string | null
          generation_id?: string | null
          id?: string
          metadata?: Json
          share_token?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          allow_comments?: boolean
          allow_download?: boolean
          campaign_id?: string | null
          created_at?: string
          expires_at?: string | null
          generation_id?: string | null
          id?: string
          metadata?: Json
          share_token?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "magic_up_public_shares_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "magic_up_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "magic_up_public_shares_generation_id_fkey"
            columns: ["generation_id"]
            isOneToOne: false
            referencedRelation: "magic_up_generations"
            referencedColumns: ["id"]
          },
        ]
      }
      magic_up_reactions: {
        Row: {
          created_at: string
          generation_id: string
          id: string
          ip_hash: string | null
          reaction_type: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          generation_id: string
          id?: string
          ip_hash?: string | null
          reaction_type: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          generation_id?: string
          id?: string
          ip_hash?: string | null
          reaction_type?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "magic_up_reactions_generation_id_fkey"
            columns: ["generation_id"]
            isOneToOne: false
            referencedRelation: "magic_up_generations"
            referencedColumns: ["id"]
          },
        ]
      }
      mcp_access_violations: {
        Row: {
          created_at: string
          details: Json
          id: string
          ip_address: string | null
          operation: string | null
          reason: string
          request_id: string | null
          source: string
          target_key_id: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          details?: Json
          id?: string
          ip_address?: string | null
          operation?: string | null
          reason: string
          request_id?: string | null
          source: string
          target_key_id?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          details?: Json
          id?: string
          ip_address?: string | null
          operation?: string | null
          reason?: string
          request_id?: string | null
          source?: string
          target_key_id?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      mcp_api_keys: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          expires_at: string | null
          id: string
          key_hash: string
          key_prefix: string
          last_used_at: string | null
          name: string
          revoked_at: string | null
          rotated_from: string | null
          scopes: string[]
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          expires_at?: string | null
          id?: string
          key_hash: string
          key_prefix: string
          last_used_at?: string | null
          name: string
          revoked_at?: string | null
          rotated_from?: string | null
          scopes?: string[]
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          expires_at?: string | null
          id?: string
          key_hash?: string
          key_prefix?: string
          last_used_at?: string | null
          name?: string
          revoked_at?: string | null
          rotated_from?: string | null
          scopes?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mcp_api_keys_rotated_from_fkey"
            columns: ["rotated_from"]
            isOneToOne: false
            referencedRelation: "mcp_api_keys"
            referencedColumns: ["id"]
          },
        ]
      }
      mcp_full_grantors: {
        Row: {
          granted_at: string
          granted_by: string | null
          reason: string | null
          user_id: string
        }
        Insert: {
          granted_at?: string
          granted_by?: string | null
          reason?: string | null
          user_id: string
        }
        Update: {
          granted_at?: string
          granted_by?: string | null
          reason?: string | null
          user_id?: string
        }
        Relationships: []
      }
      mcp_key_auto_revocations: {
        Row: {
          created_at: string
          created_by: string
          id: string
          key_id: string
          reason: string
          revoked_at: string
          source: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          key_id: string
          reason?: string
          revoked_at?: string
          source: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          key_id?: string
          reason?: string
          revoked_at?: string
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "mcp_key_auto_revocations_key_id_fkey"
            columns: ["key_id"]
            isOneToOne: false
            referencedRelation: "mcp_api_keys"
            referencedColumns: ["id"]
          },
        ]
      }
      mockup_drafts: {
        Row: {
          client_id: string | null
          client_name: string | null
          created_at: string
          draft_key: string
          id: string
          logo_data: string | null
          personalization_areas: Json | null
          product_id: string | null
          product_name: string | null
          technique_id: string | null
          technique_name: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          client_id?: string | null
          client_name?: string | null
          created_at?: string
          draft_key?: string
          id?: string
          logo_data?: string | null
          personalization_areas?: Json | null
          product_id?: string | null
          product_name?: string | null
          technique_id?: string | null
          technique_name?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          client_id?: string | null
          client_name?: string | null
          created_at?: string
          draft_key?: string
          id?: string
          logo_data?: string | null
          personalization_areas?: Json | null
          product_id?: string | null
          product_name?: string | null
          technique_id?: string | null
          technique_name?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      mockup_prompt_configs: {
        Row: {
          ai_model: string
          config_key: string
          created_at: string
          id: string
          is_active: boolean
          label: string
          prompt_text: string
          technique_id: string | null
          updated_at: string
          version: number
        }
        Insert: {
          ai_model?: string
          config_key: string
          created_at?: string
          id?: string
          is_active?: boolean
          label: string
          prompt_text: string
          technique_id?: string | null
          updated_at?: string
          version?: number
        }
        Update: {
          ai_model?: string
          config_key?: string
          created_at?: string
          id?: string
          is_active?: boolean
          label?: string
          prompt_text?: string
          technique_id?: string | null
          updated_at?: string
          version?: number
        }
        Relationships: []
      }
      mockup_prompt_history: {
        Row: {
          ai_model: string
          change_notes: string | null
          changed_at: string
          changed_by: string | null
          config_id: string
          config_key: string
          id: string
          new_prompt: string
          old_prompt: string | null
          version: number
        }
        Insert: {
          ai_model: string
          change_notes?: string | null
          changed_at?: string
          changed_by?: string | null
          config_id: string
          config_key: string
          id?: string
          new_prompt: string
          old_prompt?: string | null
          version: number
        }
        Update: {
          ai_model?: string
          change_notes?: string | null
          changed_at?: string
          changed_by?: string | null
          config_id?: string
          config_key?: string
          id?: string
          new_prompt?: string
          old_prompt?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "mockup_prompt_history_config_id_fkey"
            columns: ["config_id"]
            isOneToOne: false
            referencedRelation: "mockup_prompt_configs"
            referencedColumns: ["id"]
          },
        ]
      }
      mockup_templates: {
        Row: {
          available_colors: Json | null
          created_at: string
          default_technique_id: string | null
          description: string | null
          id: string
          is_active: boolean | null
          is_featured: boolean | null
          name: string
          predefined_areas: Json
          product_id: string | null
          template_image_url: string
          updated_at: string
          usage_count: number | null
        }
        Insert: {
          available_colors?: Json | null
          created_at?: string
          default_technique_id?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_featured?: boolean | null
          name: string
          predefined_areas?: Json
          product_id?: string | null
          template_image_url: string
          updated_at?: string
          usage_count?: number | null
        }
        Update: {
          available_colors?: Json | null
          created_at?: string
          default_technique_id?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_featured?: boolean | null
          name?: string
          predefined_areas?: Json
          product_id?: string | null
          template_image_url?: string
          updated_at?: string
          usage_count?: number | null
        }
        Relationships: []
      }
      navigation_analytics: {
        Row: {
          button_name: string
          created_at: string
          destination_path: string | null
          id: string
          source_path: string
          timestamp: string
          user_id: string
        }
        Insert: {
          button_name: string
          created_at?: string
          destination_path?: string | null
          id?: string
          source_path: string
          timestamp?: string
          user_id: string
        }
        Update: {
          button_name?: string
          created_at?: string
          destination_path?: string | null
          id?: string
          source_path?: string
          timestamp?: string
          user_id?: string
        }
        Relationships: []
      }
      optimization_queue: {
        Row: {
          category: string
          created_at: string
          created_by: string | null
          description: string | null
          error: string | null
          finished_at: string | null
          guardrail_status: string | null
          id: string
          priority: number
          result: Json | null
          started_at: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          category?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          error?: string | null
          finished_at?: string | null
          guardrail_status?: string | null
          id?: string
          priority?: number
          result?: Json | null
          started_at?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          error?: string | null
          finished_at?: string | null
          guardrail_status?: string | null
          id?: string
          priority?: number
          result?: Json | null
          started_at?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      optimization_queue_runs: {
        Row: {
          created_at: string
          duration_ms: number | null
          executed_by: string | null
          guardrail_status: string | null
          id: string
          notes: string | null
          queue_id: string
          status: string
        }
        Insert: {
          created_at?: string
          duration_ms?: number | null
          executed_by?: string | null
          guardrail_status?: string | null
          id?: string
          notes?: string | null
          queue_id: string
          status: string
        }
        Update: {
          created_at?: string
          duration_ms?: number | null
          executed_by?: string | null
          guardrail_status?: string | null
          id?: string
          notes?: string | null
          queue_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "optimization_queue_runs_queue_id_fkey"
            columns: ["queue_id"]
            isOneToOne: false
            referencedRelation: "optimization_queue"
            referencedColumns: ["id"]
          },
        ]
      }
      order_item_personalizations: {
        Row: {
          created_at: string | null
          id: string
          image_url: string | null
          location_id: string | null
          location_name: string | null
          order_item_id: string
          personalization_text: string | null
          price_adjustment: number | null
          technique_id: string | null
          technique_name: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          image_url?: string | null
          location_id?: string | null
          location_name?: string | null
          order_item_id: string
          personalization_text?: string | null
          price_adjustment?: number | null
          technique_id?: string | null
          technique_name?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          image_url?: string | null
          location_id?: string | null
          location_name?: string | null
          order_item_id?: string
          personalization_text?: string | null
          price_adjustment?: number | null
          technique_id?: string | null
          technique_name?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_item_personalizations_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          created_at: string
          discount_amount: number | null
          id: string
          order_id: string | null
          personalization_config: Json | null
          personalization_cost: number | null
          product_description: string | null
          product_id: string | null
          product_image_url: string | null
          product_name: string | null
          product_sku: string | null
          production_notes: string | null
          production_status: string | null
          quantity: number | null
          quote_item_id: string | null
          subtotal: number
          unit_price: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string
          discount_amount?: number | null
          id?: string
          order_id?: string | null
          personalization_config?: Json | null
          personalization_cost?: number | null
          product_description?: string | null
          product_id?: string | null
          product_image_url?: string | null
          product_name?: string | null
          product_sku?: string | null
          production_notes?: string | null
          production_status?: string | null
          quantity?: number | null
          quote_item_id?: string | null
          subtotal?: number
          unit_price?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string
          discount_amount?: number | null
          id?: string
          order_id?: string | null
          personalization_config?: Json | null
          personalization_cost?: number | null
          product_description?: string | null
          product_id?: string | null
          product_image_url?: string | null
          product_name?: string | null
          product_sku?: string | null
          production_notes?: string | null
          production_status?: string | null
          quantity?: number | null
          quote_item_id?: string | null
          subtotal?: number
          unit_price?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      orders: {
        Row: {
          assigned_to: string | null
          client_company: string | null
          client_email: string | null
          client_id: string | null
          client_name: string | null
          client_phone: string | null
          created_at: string
          created_by: string | null
          delivered_at: string | null
          delivery_address: string | null
          delivery_time: string | null
          discount_amount: number | null
          estimated_delivery_date: string | null
          fulfillment_status: string
          id: string
          internal_notes: string | null
          notes: string | null
          order_number: string
          organization_id: string | null
          paid_amount: number | null
          payment_due_date: string | null
          payment_method: string | null
          payment_status: string | null
          payment_terms: string | null
          quote_id: string | null
          seller_id: string
          shipping_address: Json | null
          shipping_cost: number | null
          shipping_method: string | null
          shipping_type: string | null
          status: string
          subtotal: number | null
          tax_amount: number | null
          total: number | null
          tracking_number: string | null
          updated_at: string
          version: number
        }
        Insert: {
          assigned_to?: string | null
          client_company?: string | null
          client_email?: string | null
          client_id?: string | null
          client_name?: string | null
          client_phone?: string | null
          created_at?: string
          created_by?: string | null
          delivered_at?: string | null
          delivery_address?: string | null
          delivery_time?: string | null
          discount_amount?: number | null
          estimated_delivery_date?: string | null
          fulfillment_status?: string
          id?: string
          internal_notes?: string | null
          notes?: string | null
          order_number?: string
          organization_id?: string | null
          paid_amount?: number | null
          payment_due_date?: string | null
          payment_method?: string | null
          payment_status?: string | null
          payment_terms?: string | null
          quote_id?: string | null
          seller_id: string
          shipping_address?: Json | null
          shipping_cost?: number | null
          shipping_method?: string | null
          shipping_type?: string | null
          status?: string
          subtotal?: number | null
          tax_amount?: number | null
          total?: number | null
          tracking_number?: string | null
          updated_at?: string
          version?: number
        }
        Update: {
          assigned_to?: string | null
          client_company?: string | null
          client_email?: string | null
          client_id?: string | null
          client_name?: string | null
          client_phone?: string | null
          created_at?: string
          created_by?: string | null
          delivered_at?: string | null
          delivery_address?: string | null
          delivery_time?: string | null
          discount_amount?: number | null
          estimated_delivery_date?: string | null
          fulfillment_status?: string
          id?: string
          internal_notes?: string | null
          notes?: string | null
          order_number?: string
          organization_id?: string | null
          paid_amount?: number | null
          payment_due_date?: string | null
          payment_method?: string | null
          payment_status?: string | null
          payment_terms?: string | null
          quote_id?: string | null
          seller_id?: string
          shipping_address?: Json | null
          shipping_cost?: number | null
          shipping_method?: string | null
          shipping_type?: string | null
          status?: string
          subtotal?: number | null
          tax_amount?: number | null
          total?: number | null
          tracking_number?: string | null
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "orders_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_members: {
        Row: {
          created_at: string
          id: string
          invited_by: string | null
          joined_at: string
          organization_id: string
          role: Database["public"]["Enums"]["org_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          invited_by?: string | null
          joined_at?: string
          organization_id: string
          role?: Database["public"]["Enums"]["org_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          invited_by?: string | null
          joined_at?: string
          organization_id?: string
          role?: Database["public"]["Enums"]["org_role"]
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
      organizations: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          logo_url: string | null
          name: string
          settings: Json | null
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          logo_url?: string | null
          name: string
          settings?: Json | null
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          logo_url?: string | null
          name?: string
          settings?: Json | null
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      outbound_webhooks: {
        Row: {
          active: boolean
          auto_disabled_at: string | null
          auto_disabled_reason: string | null
          consecutive_failures: number
          created_at: string
          created_by: string
          description: string | null
          events: string[]
          id: string
          last_triggered_at: string | null
          name: string
          retry_policy: Json
          secret_ref: string | null
          total_failure: number
          total_success: number
          updated_at: string
          url: string
        }
        Insert: {
          active?: boolean
          auto_disabled_at?: string | null
          auto_disabled_reason?: string | null
          consecutive_failures?: number
          created_at?: string
          created_by: string
          description?: string | null
          events?: string[]
          id?: string
          last_triggered_at?: string | null
          name: string
          retry_policy?: Json
          secret_ref?: string | null
          total_failure?: number
          total_success?: number
          updated_at?: string
          url: string
        }
        Update: {
          active?: boolean
          auto_disabled_at?: string | null
          auto_disabled_reason?: string | null
          consecutive_failures?: number
          created_at?: string
          created_by?: string
          description?: string | null
          events?: string[]
          id?: string
          last_triggered_at?: string | null
          name?: string
          retry_policy?: Json
          secret_ref?: string | null
          total_failure?: number
          total_success?: number
          updated_at?: string
          url?: string
        }
        Relationships: []
      }
      ownership_audit_reports: {
        Row: {
          details: Json
          duration_ms: number | null
          generated_at: string
          id: string
          missing_user_count: number
          null_owner_count: number
          rls_coverage: Json
          rls_gaps_count: number
          total_issues_found: number
          total_tables_scanned: number
          triggered_by: string
        }
        Insert: {
          details?: Json
          duration_ms?: number | null
          generated_at?: string
          id?: string
          missing_user_count?: number
          null_owner_count?: number
          rls_coverage?: Json
          rls_gaps_count?: number
          total_issues_found?: number
          total_tables_scanned?: number
          triggered_by?: string
        }
        Update: {
          details?: Json
          duration_ms?: number | null
          generated_at?: string
          id?: string
          missing_user_count?: number
          null_owner_count?: number
          rls_coverage?: Json
          rls_gaps_count?: number
          total_issues_found?: number
          total_tables_scanned?: number
          triggered_by?: string
        }
        Relationships: []
      }
      ownership_repair_logs: {
        Row: {
          action: string
          created_at: string
          dry_run: boolean
          error_message: string | null
          id: string
          issue_type: string
          notes: string | null
          owner_column: string
          report_id: string | null
          rows_affected: number
          table_name: string
          triggered_by: string | null
          triggered_by_label: string | null
        }
        Insert: {
          action: string
          created_at?: string
          dry_run?: boolean
          error_message?: string | null
          id?: string
          issue_type: string
          notes?: string | null
          owner_column: string
          report_id?: string | null
          rows_affected?: number
          table_name: string
          triggered_by?: string | null
          triggered_by_label?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          dry_run?: boolean
          error_message?: string | null
          id?: string
          issue_type?: string
          notes?: string | null
          owner_column?: string
          report_id?: string | null
          rows_affected?: number
          table_name?: string
          triggered_by?: string | null
          triggered_by_label?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ownership_repair_logs_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "ownership_audit_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      password_reset_requests: {
        Row: {
          email: string
          id: string
          requested_at: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          reviewer_notes: string | null
          status: string
          user_id: string | null
        }
        Insert: {
          email: string
          id?: string
          requested_at?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          reviewer_notes?: string | null
          status?: string
          user_id?: string | null
        }
        Update: {
          email?: string
          id?: string
          requested_at?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          reviewer_notes?: string | null
          status?: string
          user_id?: string | null
        }
        Relationships: []
      }
      permissions: {
        Row: {
          category: string
          code: string
          created_at: string
          description: string | null
          label: string
        }
        Insert: {
          category?: string
          code: string
          created_at?: string
          description?: string | null
          label: string
        }
        Update: {
          category?: string
          code?: string
          created_at?: string
          description?: string | null
          label?: string
        }
        Relationships: []
      }
      price_history: {
        Row: {
          change_reason: string | null
          change_type: string
          changed_at: string | null
          changed_by: string | null
          id: string
          new_values: Json | null
          old_values: Json | null
          source: string | null
          variant_id: string
        }
        Insert: {
          change_reason?: string | null
          change_type: string
          changed_at?: string | null
          changed_by?: string | null
          id?: string
          new_values?: Json | null
          old_values?: Json | null
          source?: string | null
          variant_id: string
        }
        Update: {
          change_reason?: string | null
          change_type?: string
          changed_at?: string | null
          changed_by?: string | null
          id?: string
          new_values?: Json | null
          old_values?: Json | null
          source?: string | null
          variant_id?: string
        }
        Relationships: []
      }
      product_component_locations: {
        Row: {
          component_id: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          location_code: string
          location_name: string
          max_height_cm: number | null
          max_width_cm: number | null
          sort_order: number | null
          updated_at: string
        }
        Insert: {
          component_id: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          location_code: string
          location_name: string
          max_height_cm?: number | null
          max_width_cm?: number | null
          sort_order?: number | null
          updated_at?: string
        }
        Update: {
          component_id?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          location_code?: string
          location_name?: string
          max_height_cm?: number | null
          max_width_cm?: number | null
          sort_order?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_component_locations_component_id_fkey"
            columns: ["component_id"]
            isOneToOne: false
            referencedRelation: "product_components"
            referencedColumns: ["id"]
          },
        ]
      }
      product_components: {
        Row: {
          component_code: string
          component_name: string
          created_at: string
          id: string
          is_active: boolean
          is_personalizable: boolean
          product_id: string
          sort_order: number | null
          updated_at: string
        }
        Insert: {
          component_code: string
          component_name: string
          created_at?: string
          id?: string
          is_active?: boolean
          is_personalizable?: boolean
          product_id: string
          sort_order?: number | null
          updated_at?: string
        }
        Update: {
          component_code?: string
          component_name?: string
          created_at?: string
          id?: string
          is_active?: boolean
          is_personalizable?: boolean
          product_id?: string
          sort_order?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      product_group_members: {
        Row: {
          created_at: string
          id: string
          product_group_id: string
          product_id: string
          updated_at: string
          use_group_rules: boolean
        }
        Insert: {
          created_at?: string
          id?: string
          product_group_id: string
          product_id: string
          updated_at?: string
          use_group_rules?: boolean
        }
        Update: {
          created_at?: string
          id?: string
          product_group_id?: string
          product_id?: string
          updated_at?: string
          use_group_rules?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "product_group_members_product_group_id_fkey"
            columns: ["product_group_id"]
            isOneToOne: false
            referencedRelation: "product_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      product_groups: {
        Row: {
          created_at: string
          description: string | null
          group_code: string
          group_name: string
          id: string
          is_active: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          group_code: string
          group_name: string
          id?: string
          is_active?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          group_code?: string
          group_name?: string
          id?: string
          is_active?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      product_price_freshness_overrides: {
        Row: {
          created_at: string
          id: string
          product_id: string
          threshold_days: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          product_id: string
          threshold_days: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string
          threshold_days?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      product_sync_logs: {
        Row: {
          completed_at: string | null
          created_at: string
          duration_ms: number | null
          error_message: string | null
          id: string
          payload: Json | null
          products_created: number | null
          products_failed: number | null
          products_received: number | null
          products_updated: number | null
          records_failed: number
          records_inserted: number
          records_processed: number
          records_updated: number
          source: string
          status: string
          triggered_by: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          duration_ms?: number | null
          error_message?: string | null
          id?: string
          payload?: Json | null
          products_created?: number | null
          products_failed?: number | null
          products_received?: number | null
          products_updated?: number | null
          records_failed?: number
          records_inserted?: number
          records_processed?: number
          records_updated?: number
          source: string
          status?: string
          triggered_by?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          duration_ms?: number | null
          error_message?: string | null
          id?: string
          payload?: Json | null
          products_created?: number | null
          products_failed?: number | null
          products_received?: number | null
          products_updated?: number | null
          records_failed?: number
          records_inserted?: number
          records_processed?: number
          records_updated?: number
          source?: string
          status?: string
          triggered_by?: string | null
        }
        Relationships: []
      }
      product_variants: {
        Row: {
          color_code: string | null
          color_hex: string | null
          color_id: string | null
          color_name: string | null
          created_at: string | null
          id: string
          is_active: boolean | null
          name: string | null
          product_id: string | null
          sku: string | null
          stock_quantity: number | null
          updated_at: string | null
        }
        Insert: {
          color_code?: string | null
          color_hex?: string | null
          color_id?: string | null
          color_name?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name?: string | null
          product_id?: string | null
          sku?: string | null
          stock_quantity?: number | null
          updated_at?: string | null
        }
        Update: {
          color_code?: string | null
          color_hex?: string | null
          color_id?: string | null
          color_name?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name?: string | null
          product_id?: string | null
          sku?: string | null
          stock_quantity?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_products_public"
            referencedColumns: ["id"]
          },
        ]
      }
      product_views: {
        Row: {
          created_at: string
          id: string
          product_id: string | null
          product_name: string | null
          product_sku: string | null
          seller_id: string | null
          view_type: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          product_id?: string | null
          product_name?: string | null
          product_sku?: string | null
          seller_id?: string | null
          view_type?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string | null
          product_name?: string | null
          product_sku?: string | null
          seller_id?: string | null
          view_type?: string | null
        }
        Relationships: []
      }
      products: {
        Row: {
          category_id: string | null
          category_name: string | null
          colors: Json | null
          created_at: string | null
          description: string | null
          external_id: string | null
          featured: boolean | null
          id: string
          images: string[] | null
          is_active: boolean | null
          is_kit: boolean | null
          is_stockout: boolean | null
          kit_items: Json | null
          last_stock_update_at: string | null
          materials: string[] | null
          metadata: Json | null
          min_quantity: number | null
          name: string
          new_arrival: boolean | null
          on_sale: boolean | null
          price: number | null
          price_freshness_threshold_days: number | null
          price_updated_at: string | null
          price_verified_at: string | null
          sku: string | null
          stock: number | null
          stock_quantity: number | null
          stock_status: string | null
          subcategory: string | null
          supplier_id: string | null
          supplier_name: string | null
          synced_at: string | null
          tags: Json | null
          updated_at: string | null
          variations: Json | null
          video_url: string | null
        }
        Insert: {
          category_id?: string | null
          category_name?: string | null
          colors?: Json | null
          created_at?: string | null
          description?: string | null
          external_id?: string | null
          featured?: boolean | null
          id?: string
          images?: string[] | null
          is_active?: boolean | null
          is_kit?: boolean | null
          is_stockout?: boolean | null
          kit_items?: Json | null
          last_stock_update_at?: string | null
          materials?: string[] | null
          metadata?: Json | null
          min_quantity?: number | null
          name: string
          new_arrival?: boolean | null
          on_sale?: boolean | null
          price?: number | null
          price_freshness_threshold_days?: number | null
          price_updated_at?: string | null
          price_verified_at?: string | null
          sku?: string | null
          stock?: number | null
          stock_quantity?: number | null
          stock_status?: string | null
          subcategory?: string | null
          supplier_id?: string | null
          supplier_name?: string | null
          synced_at?: string | null
          tags?: Json | null
          updated_at?: string | null
          variations?: Json | null
          video_url?: string | null
        }
        Update: {
          category_id?: string | null
          category_name?: string | null
          colors?: Json | null
          created_at?: string | null
          description?: string | null
          external_id?: string | null
          featured?: boolean | null
          id?: string
          images?: string[] | null
          is_active?: boolean | null
          is_kit?: boolean | null
          is_stockout?: boolean | null
          kit_items?: Json | null
          last_stock_update_at?: string | null
          materials?: string[] | null
          metadata?: Json | null
          min_quantity?: number | null
          name?: string
          new_arrival?: boolean | null
          on_sale?: boolean | null
          price?: number | null
          price_freshness_threshold_days?: number | null
          price_updated_at?: string | null
          price_verified_at?: string | null
          sku?: string | null
          stock?: number | null
          stock_quantity?: number | null
          stock_status?: string | null
          subcategory?: string | null
          supplier_id?: string | null
          supplier_name?: string | null
          synced_at?: string | null
          tags?: Json | null
          updated_at?: string | null
          variations?: Json | null
          video_url?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bitrix_id: number | null
          created_at: string
          department: string | null
          email: string | null
          full_name: string | null
          id: string
          is_active: boolean | null
          last_login_at: string | null
          phone: string | null
          preferences: Json | null
          role: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          bitrix_id?: number | null
          created_at?: string
          department?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          is_active?: boolean | null
          last_login_at?: string | null
          phone?: string | null
          preferences?: Json | null
          role?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          bitrix_id?: number | null
          created_at?: string
          department?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          is_active?: boolean | null
          last_login_at?: string | null
          phone?: string | null
          preferences?: Json | null
          role?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      public_token_failures: {
        Row: {
          attempted_token: string | null
          created_at: string
          id: string
          ip_address: string | null
          reason: string | null
          resource_id: string | null
          resource_type: string
          user_agent: string | null
        }
        Insert: {
          attempted_token?: string | null
          created_at?: string
          id?: string
          ip_address?: string | null
          reason?: string | null
          resource_id?: string | null
          resource_type: string
          user_agent?: string | null
        }
        Update: {
          attempted_token?: string | null
          created_at?: string
          id?: string
          ip_address?: string | null
          reason?: string | null
          resource_id?: string | null
          resource_type?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      query_telemetry: {
        Row: {
          cache_hit: boolean
          count_mode: string | null
          created_at: string
          duration_ms: number
          error_kind: string | null
          error_message: string | null
          id: string
          is_503: boolean
          is_cold_start: boolean
          operation: string
          query_limit: number | null
          query_offset: number | null
          record_count: number | null
          retry_count: number
          rpc_name: string | null
          severity: string
          table_name: string | null
          user_id: string | null
        }
        Insert: {
          cache_hit?: boolean
          count_mode?: string | null
          created_at?: string
          duration_ms: number
          error_kind?: string | null
          error_message?: string | null
          id?: string
          is_503?: boolean
          is_cold_start?: boolean
          operation: string
          query_limit?: number | null
          query_offset?: number | null
          record_count?: number | null
          retry_count?: number
          rpc_name?: string | null
          severity?: string
          table_name?: string | null
          user_id?: string | null
        }
        Update: {
          cache_hit?: boolean
          count_mode?: string | null
          created_at?: string
          duration_ms?: number
          error_kind?: string | null
          error_message?: string | null
          id?: string
          is_503?: boolean
          is_cold_start?: boolean
          operation?: string
          query_limit?: number | null
          query_offset?: number | null
          record_count?: number | null
          retry_count?: number
          rpc_name?: string | null
          severity?: string
          table_name?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      quote_approval_tokens: {
        Row: {
          client_email: string | null
          client_name: string | null
          created_at: string
          expires_at: string | null
          id: string
          quote_id: string
          responded_at: string | null
          response: string | null
          response_notes: string | null
          seller_id: string
          signature_hash: string | null
          signed_at: string | null
          signer_document: string | null
          signer_ip: string | null
          signer_name: string | null
          signer_user_agent: string | null
          status: string
          token: string
          updated_at: string
          viewed_at: string | null
        }
        Insert: {
          client_email?: string | null
          client_name?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          quote_id: string
          responded_at?: string | null
          response?: string | null
          response_notes?: string | null
          seller_id: string
          signature_hash?: string | null
          signed_at?: string | null
          signer_document?: string | null
          signer_ip?: string | null
          signer_name?: string | null
          signer_user_agent?: string | null
          status?: string
          token?: string
          updated_at?: string
          viewed_at?: string | null
        }
        Update: {
          client_email?: string | null
          client_name?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          quote_id?: string
          responded_at?: string | null
          response?: string | null
          response_notes?: string | null
          seller_id?: string
          signature_hash?: string | null
          signed_at?: string | null
          signer_document?: string | null
          signer_ip?: string | null
          signer_name?: string | null
          signer_user_agent?: string | null
          status?: string
          token?: string
          updated_at?: string
          viewed_at?: string | null
        }
        Relationships: []
      }
      quote_comments: {
        Row: {
          comment: string
          created_at: string
          id: string
          is_internal: boolean
          quote_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          comment: string
          created_at?: string
          id?: string
          is_internal?: boolean
          quote_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          comment?: string
          created_at?: string
          id?: string
          is_internal?: boolean
          quote_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      quote_drafts: {
        Row: {
          data: Json
          id: string
          last_saved_at: string | null
          user_id: string
        }
        Insert: {
          data: Json
          id?: string
          last_saved_at?: string | null
          user_id: string
        }
        Update: {
          data?: Json
          id?: string
          last_saved_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      quote_history: {
        Row: {
          action: string
          created_at: string
          description: string | null
          field_changed: string | null
          id: string
          metadata: Json | null
          new_value: string | null
          old_value: string | null
          quote_id: string
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          description?: string | null
          field_changed?: string | null
          id?: string
          metadata?: Json | null
          new_value?: string | null
          old_value?: string | null
          quote_id: string
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          description?: string | null
          field_changed?: string | null
          id?: string
          metadata?: Json | null
          new_value?: string | null
          old_value?: string | null
          quote_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quote_history_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_item_personalizations: {
        Row: {
          area_cm2: number | null
          colors_count: number | null
          created_at: string
          height_cm: number | null
          id: string
          location_code: string | null
          location_name: string | null
          notes: string | null
          personalized_quantity: number | null
          positions_count: number | null
          quote_item_id: string
          setup_cost: number | null
          technique_id: string | null
          technique_name: string | null
          total_cost: number | null
          unit_cost: number | null
          updated_at: string
          width_cm: number | null
        }
        Insert: {
          area_cm2?: number | null
          colors_count?: number | null
          created_at?: string
          height_cm?: number | null
          id?: string
          location_code?: string | null
          location_name?: string | null
          notes?: string | null
          personalized_quantity?: number | null
          positions_count?: number | null
          quote_item_id: string
          setup_cost?: number | null
          technique_id?: string | null
          technique_name?: string | null
          total_cost?: number | null
          unit_cost?: number | null
          updated_at?: string
          width_cm?: number | null
        }
        Update: {
          area_cm2?: number | null
          colors_count?: number | null
          created_at?: string
          height_cm?: number | null
          id?: string
          location_code?: string | null
          location_name?: string | null
          notes?: string | null
          personalized_quantity?: number | null
          positions_count?: number | null
          quote_item_id?: string
          setup_cost?: number | null
          technique_id?: string | null
          technique_name?: string | null
          total_cost?: number | null
          unit_cost?: number | null
          updated_at?: string
          width_cm?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "quote_item_personalizations_quote_item_id_fkey"
            columns: ["quote_item_id"]
            isOneToOne: false
            referencedRelation: "quote_items"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_items: {
        Row: {
          artwork_urls: Json | null
          bitrix_product_id: string | null
          color_hex: string | null
          color_name: string | null
          created_at: string
          discount_amount: number | null
          discount_percentage: number | null
          gender: string | null
          has_personalization: boolean | null
          id: string
          kit_group_id: string | null
          kit_name: string | null
          mockup_urls: Json | null
          notes: string | null
          personalization_config: Json | null
          personalization_cost: number | null
          price_confirmed_at: string | null
          price_freshness_threshold_days: number | null
          price_updated_at: string | null
          product_description: string | null
          product_id: string | null
          product_image_url: string | null
          product_name: string
          product_sku: string | null
          quantity: number
          quote_id: string
          size_code: string | null
          sort_order: number | null
          subtotal: number | null
          unit_price: number
          updated_at: string
        }
        Insert: {
          artwork_urls?: Json | null
          bitrix_product_id?: string | null
          color_hex?: string | null
          color_name?: string | null
          created_at?: string
          discount_amount?: number | null
          discount_percentage?: number | null
          gender?: string | null
          has_personalization?: boolean | null
          id?: string
          kit_group_id?: string | null
          kit_name?: string | null
          mockup_urls?: Json | null
          notes?: string | null
          personalization_config?: Json | null
          personalization_cost?: number | null
          price_confirmed_at?: string | null
          price_freshness_threshold_days?: number | null
          price_updated_at?: string | null
          product_description?: string | null
          product_id?: string | null
          product_image_url?: string | null
          product_name: string
          product_sku?: string | null
          quantity?: number
          quote_id: string
          size_code?: string | null
          sort_order?: number | null
          subtotal?: number | null
          unit_price?: number
          updated_at?: string
        }
        Update: {
          artwork_urls?: Json | null
          bitrix_product_id?: string | null
          color_hex?: string | null
          color_name?: string | null
          created_at?: string
          discount_amount?: number | null
          discount_percentage?: number | null
          gender?: string | null
          has_personalization?: boolean | null
          id?: string
          kit_group_id?: string | null
          kit_name?: string | null
          mockup_urls?: Json | null
          notes?: string | null
          personalization_config?: Json | null
          personalization_cost?: number | null
          price_confirmed_at?: string | null
          price_freshness_threshold_days?: number | null
          price_updated_at?: string | null
          product_description?: string | null
          product_id?: string | null
          product_image_url?: string | null
          product_name?: string
          product_sku?: string | null
          quantity?: number
          quote_id?: string
          size_code?: string | null
          sort_order?: number | null
          subtotal?: number | null
          unit_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quote_items_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_templates: {
        Row: {
          category: string | null
          created_at: string
          created_by: string | null
          delivery_time: string | null
          description: string | null
          discount_amount: number | null
          discount_percent: number | null
          id: string
          internal_notes: string | null
          is_active: boolean
          is_default: boolean | null
          items: Json | null
          name: string
          notes: string | null
          payment_terms: string | null
          seller_id: string
          template_data: Json | null
          updated_at: string
          usage_count: number
          validity_days: number | null
        }
        Insert: {
          category?: string | null
          created_at?: string
          created_by?: string | null
          delivery_time?: string | null
          description?: string | null
          discount_amount?: number | null
          discount_percent?: number | null
          id?: string
          internal_notes?: string | null
          is_active?: boolean
          is_default?: boolean | null
          items?: Json | null
          name: string
          notes?: string | null
          payment_terms?: string | null
          seller_id: string
          template_data?: Json | null
          updated_at?: string
          usage_count?: number
          validity_days?: number | null
        }
        Update: {
          category?: string | null
          created_at?: string
          created_by?: string | null
          delivery_time?: string | null
          description?: string | null
          discount_amount?: number | null
          discount_percent?: number | null
          id?: string
          internal_notes?: string | null
          is_active?: boolean
          is_default?: boolean | null
          items?: Json | null
          name?: string
          notes?: string | null
          payment_terms?: string | null
          seller_id?: string
          template_data?: Json | null
          updated_at?: string
          usage_count?: number
          validity_days?: number | null
        }
        Relationships: []
      }
      quotes: {
        Row: {
          approval_token: string | null
          approved_at: string | null
          approved_by_client_name: string | null
          assigned_to: string | null
          bitrix_deal_id: string | null
          bitrix_quote_id: string | null
          client_cnpj: string | null
          client_company: string | null
          client_email: string | null
          client_feedback: string | null
          client_id: string | null
          client_name: string | null
          client_phone: string | null
          client_response: string | null
          client_response_at: string | null
          client_response_notes: string | null
          conversion_notes: string | null
          converted_at: string | null
          converted_to_order_id: string | null
          created_at: string
          created_by: string | null
          delivery_time: string | null
          discount_amount: number
          discount_percent: number
          estimated_delivery_days: number | null
          id: string
          internal_notes: string | null
          is_latest_version: boolean
          last_sent_at: string | null
          negotiation_markup_percent: number
          notes: string | null
          organization_id: string | null
          parent_quote_id: string | null
          payment_method: string | null
          payment_terms: string | null
          priority: string | null
          quote_number: string
          real_discount_percent: number | null
          real_subtotal: number | null
          seller_id: string
          sent_at: string | null
          shipping_cost: number | null
          shipping_method: string | null
          shipping_type: string | null
          stage: string | null
          status: string
          subtotal: number
          synced_at: string | null
          synced_to_bitrix: boolean | null
          tags: Json | null
          tax_amount: number | null
          total: number
          updated_at: string
          valid_until: string | null
          version: number
          view_count: number | null
          viewed_at: string | null
        }
        Insert: {
          approval_token?: string | null
          approved_at?: string | null
          approved_by_client_name?: string | null
          assigned_to?: string | null
          bitrix_deal_id?: string | null
          bitrix_quote_id?: string | null
          client_cnpj?: string | null
          client_company?: string | null
          client_email?: string | null
          client_feedback?: string | null
          client_id?: string | null
          client_name?: string | null
          client_phone?: string | null
          client_response?: string | null
          client_response_at?: string | null
          client_response_notes?: string | null
          conversion_notes?: string | null
          converted_at?: string | null
          converted_to_order_id?: string | null
          created_at?: string
          created_by?: string | null
          delivery_time?: string | null
          discount_amount?: number
          discount_percent?: number
          estimated_delivery_days?: number | null
          id?: string
          internal_notes?: string | null
          is_latest_version?: boolean
          last_sent_at?: string | null
          negotiation_markup_percent?: number
          notes?: string | null
          organization_id?: string | null
          parent_quote_id?: string | null
          payment_method?: string | null
          payment_terms?: string | null
          priority?: string | null
          quote_number?: string
          real_discount_percent?: number | null
          real_subtotal?: number | null
          seller_id: string
          sent_at?: string | null
          shipping_cost?: number | null
          shipping_method?: string | null
          shipping_type?: string | null
          stage?: string | null
          status?: string
          subtotal?: number
          synced_at?: string | null
          synced_to_bitrix?: boolean | null
          tags?: Json | null
          tax_amount?: number | null
          total?: number
          updated_at?: string
          valid_until?: string | null
          version?: number
          view_count?: number | null
          viewed_at?: string | null
        }
        Update: {
          approval_token?: string | null
          approved_at?: string | null
          approved_by_client_name?: string | null
          assigned_to?: string | null
          bitrix_deal_id?: string | null
          bitrix_quote_id?: string | null
          client_cnpj?: string | null
          client_company?: string | null
          client_email?: string | null
          client_feedback?: string | null
          client_id?: string | null
          client_name?: string | null
          client_phone?: string | null
          client_response?: string | null
          client_response_at?: string | null
          client_response_notes?: string | null
          conversion_notes?: string | null
          converted_at?: string | null
          converted_to_order_id?: string | null
          created_at?: string
          created_by?: string | null
          delivery_time?: string | null
          discount_amount?: number
          discount_percent?: number
          estimated_delivery_days?: number | null
          id?: string
          internal_notes?: string | null
          is_latest_version?: boolean
          last_sent_at?: string | null
          negotiation_markup_percent?: number
          notes?: string | null
          organization_id?: string | null
          parent_quote_id?: string | null
          payment_method?: string | null
          payment_terms?: string | null
          priority?: string | null
          quote_number?: string
          real_discount_percent?: number | null
          real_subtotal?: number | null
          seller_id?: string
          sent_at?: string | null
          shipping_cost?: number | null
          shipping_method?: string | null
          shipping_type?: string | null
          stage?: string | null
          status?: string
          subtotal?: number
          synced_at?: string | null
          synced_to_bitrix?: boolean | null
          tags?: Json | null
          tax_amount?: number | null
          total?: number
          updated_at?: string
          valid_until?: string | null
          version?: number
          view_count?: number | null
          viewed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quotes_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_parent_quote_id_fkey"
            columns: ["parent_quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      recently_viewed_products: {
        Row: {
          id: string
          product_id: string
          user_id: string
          viewed_at: string
        }
        Insert: {
          id?: string
          product_id: string
          user_id: string
          viewed_at?: string
        }
        Update: {
          id?: string
          product_id?: string
          user_id?: string
          viewed_at?: string
        }
        Relationships: []
      }
      request_rate_limits: {
        Row: {
          blocked_until: string | null
          created_at: string
          endpoint: string
          id: string
          identifier: string
          request_count: number
          updated_at: string
          window_start: string
        }
        Insert: {
          blocked_until?: string | null
          created_at?: string
          endpoint: string
          id?: string
          identifier: string
          request_count?: number
          updated_at?: string
          window_start?: string
        }
        Update: {
          blocked_until?: string | null
          created_at?: string
          endpoint?: string
          id?: string
          identifier?: string
          request_count?: number
          updated_at?: string
          window_start?: string
        }
        Relationships: []
      }
      rls_denial_log: {
        Row: {
          created_at: string
          endpoint: string | null
          error_code: string | null
          error_message: string | null
          id: string
          ip_address: unknown
          operation: string
          policy_hint: string | null
          query_summary: string | null
          table_name: string
          target_id: string | null
          target_seller_id: string | null
          user_agent: string | null
          user_email: string | null
          user_id: string
          user_role: string | null
        }
        Insert: {
          created_at?: string
          endpoint?: string | null
          error_code?: string | null
          error_message?: string | null
          id?: string
          ip_address?: unknown
          operation: string
          policy_hint?: string | null
          query_summary?: string | null
          table_name: string
          target_id?: string | null
          target_seller_id?: string | null
          user_agent?: string | null
          user_email?: string | null
          user_id: string
          user_role?: string | null
        }
        Update: {
          created_at?: string
          endpoint?: string | null
          error_code?: string | null
          error_message?: string | null
          id?: string
          ip_address?: unknown
          operation?: string
          policy_hint?: string | null
          query_summary?: string | null
          table_name?: string
          target_id?: string | null
          target_seller_id?: string | null
          user_agent?: string | null
          user_email?: string | null
          user_id?: string
          user_role?: string | null
        }
        Relationships: []
      }
      role_migration_batches: {
        Row: {
          created_at: string
          dry_run: boolean
          duration_ms: number | null
          failed_count: number
          finished_at: string | null
          id: string
          initiated_by: string
          label: string
          reason: string
          skipped_count: number
          started_at: string | null
          status: Database["public"]["Enums"]["role_migration_status"]
          success_count: number
          total_items: number
        }
        Insert: {
          created_at?: string
          dry_run?: boolean
          duration_ms?: number | null
          failed_count?: number
          finished_at?: string | null
          id?: string
          initiated_by: string
          label: string
          reason: string
          skipped_count?: number
          started_at?: string | null
          status?: Database["public"]["Enums"]["role_migration_status"]
          success_count?: number
          total_items?: number
        }
        Update: {
          created_at?: string
          dry_run?: boolean
          duration_ms?: number | null
          failed_count?: number
          finished_at?: string | null
          id?: string
          initiated_by?: string
          label?: string
          reason?: string
          skipped_count?: number
          started_at?: string | null
          status?: Database["public"]["Enums"]["role_migration_status"]
          success_count?: number
          total_items?: number
        }
        Relationships: []
      }
      role_migration_items: {
        Row: {
          batch_id: string
          created_at: string
          duration_ms: number | null
          error_message: string | null
          from_role: Database["public"]["Enums"]["app_role"] | null
          id: string
          operation: string
          processed_at: string | null
          status: Database["public"]["Enums"]["role_migration_item_status"]
          to_role: Database["public"]["Enums"]["app_role"]
          user_email: string | null
          user_id: string
        }
        Insert: {
          batch_id: string
          created_at?: string
          duration_ms?: number | null
          error_message?: string | null
          from_role?: Database["public"]["Enums"]["app_role"] | null
          id?: string
          operation: string
          processed_at?: string | null
          status?: Database["public"]["Enums"]["role_migration_item_status"]
          to_role: Database["public"]["Enums"]["app_role"]
          user_email?: string | null
          user_id: string
        }
        Update: {
          batch_id?: string
          created_at?: string
          duration_ms?: number | null
          error_message?: string | null
          from_role?: Database["public"]["Enums"]["app_role"] | null
          id?: string
          operation?: string
          processed_at?: string | null
          status?: Database["public"]["Enums"]["role_migration_item_status"]
          to_role?: Database["public"]["Enums"]["app_role"]
          user_email?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_migration_items_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "role_migration_batches"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          created_at: string
          id: string
          permission_code: string
          role: Database["public"]["Enums"]["app_role"]
        }
        Insert: {
          created_at?: string
          id?: string
          permission_code: string
          role: Database["public"]["Enums"]["app_role"]
        }
        Update: {
          created_at?: string
          id?: string
          permission_code?: string
          role?: Database["public"]["Enums"]["app_role"]
        }
        Relationships: []
      }
      saved_filters: {
        Row: {
          category: string
          color: string | null
          created_at: string
          description: string | null
          filter_config: Json
          icon: string | null
          id: string
          is_default: boolean
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: string
          color?: string | null
          created_at?: string
          description?: string | null
          filter_config?: Json
          icon?: string | null
          id?: string
          is_default?: boolean
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string
          color?: string | null
          created_at?: string
          description?: string | null
          filter_config?: Json
          icon?: string | null
          id?: string
          is_default?: boolean
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      saved_trends_views: {
        Row: {
          created_at: string
          filters: Json
          id: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          filters?: Json
          id?: string
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          filters?: Json
          id?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      scheduled_reports: {
        Row: {
          created_at: string
          email_to: string
          filters: Json | null
          frequency: string
          id: string
          is_active: boolean
          last_sent_at: string | null
          next_run_at: string
          report_name: string
          report_type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email_to: string
          filters?: Json | null
          frequency?: string
          id?: string
          is_active?: boolean
          last_sent_at?: string | null
          next_run_at?: string
          report_name?: string
          report_type?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email_to?: string
          filters?: Json | null
          frequency?: string
          id?: string
          is_active?: boolean
          last_sent_at?: string | null
          next_run_at?: string
          report_name?: string
          report_type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      search_analytics: {
        Row: {
          created_at: string
          id: string
          results_count: number
          search_context: string | null
          search_term: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          results_count?: number
          search_context?: string | null
          search_term: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          results_count?: number
          search_context?: string | null
          search_term?: string
          user_id?: string | null
        }
        Relationships: []
      }
      secret_rotation_log: {
        Row: {
          action_type: string
          id: string
          new_suffix: string | null
          notes: string | null
          previous_suffix: string | null
          rotated_at: string
          rotated_by: string
          secret_name: string
        }
        Insert: {
          action_type?: string
          id?: string
          new_suffix?: string | null
          notes?: string | null
          previous_suffix?: string | null
          rotated_at?: string
          rotated_by: string
          secret_name: string
        }
        Update: {
          action_type?: string
          id?: string
          new_suffix?: string | null
          notes?: string | null
          previous_suffix?: string | null
          rotated_at?: string
          rotated_by?: string
          secret_name?: string
        }
        Relationships: []
      }
      seller_cart_items: {
        Row: {
          cart_id: string
          color_hex: string | null
          color_name: string | null
          created_at: string
          id: string
          notes: string | null
          product_id: string
          product_image_url: string | null
          product_name: string
          product_price: number
          product_sku: string | null
          quantity: number
          sort_order: number | null
          updated_at: string
        }
        Insert: {
          cart_id: string
          color_hex?: string | null
          color_name?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          product_id: string
          product_image_url?: string | null
          product_name: string
          product_price?: number
          product_sku?: string | null
          quantity?: number
          sort_order?: number | null
          updated_at?: string
        }
        Update: {
          cart_id?: string
          color_hex?: string | null
          color_name?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          product_id?: string
          product_image_url?: string | null
          product_name?: string
          product_price?: number
          product_sku?: string | null
          quantity?: number
          sort_order?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "seller_cart_items_cart_id_fkey"
            columns: ["cart_id"]
            isOneToOne: false
            referencedRelation: "seller_carts"
            referencedColumns: ["id"]
          },
        ]
      }
      seller_carts: {
        Row: {
          company_id: string
          company_location: string | null
          company_logo_url: string | null
          company_name: string
          created_at: string
          id: string
          notes: string | null
          seller_id: string
          status: string
          updated_at: string
        }
        Insert: {
          company_id: string
          company_location?: string | null
          company_logo_url?: string | null
          company_name: string
          created_at?: string
          id?: string
          notes?: string | null
          seller_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          company_location?: string | null
          company_logo_url?: string | null
          company_name?: string
          created_at?: string
          id?: string
          notes?: string | null
          seller_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      seller_discount_limits: {
        Row: {
          approval_required_above: number | null
          created_at: string
          id: string
          max_discount_percent: number
          notes: string | null
          set_by: string
          updated_at: string
          user_id: string
        }
        Insert: {
          approval_required_above?: number | null
          created_at?: string
          id?: string
          max_discount_percent?: number
          notes?: string | null
          set_by: string
          updated_at?: string
          user_id: string
        }
        Update: {
          approval_required_above?: number | null
          created_at?: string
          id?: string
          max_discount_percent?: number
          notes?: string | null
          set_by?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      simulation_logs: {
        Row: {
          created_at: string | null
          error_message: string | null
          fn_name: string
          id: string
          latency_ms: number | null
          payload: Json | null
          run_id: string | null
          status_code: number | null
        }
        Insert: {
          created_at?: string | null
          error_message?: string | null
          fn_name: string
          id?: string
          latency_ms?: number | null
          payload?: Json | null
          run_id?: string | null
          status_code?: number | null
        }
        Update: {
          created_at?: string | null
          error_message?: string | null
          fn_name?: string
          id?: string
          latency_ms?: number | null
          payload?: Json | null
          run_id?: string | null
          status_code?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "simulation_logs_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "simulation_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      simulation_runs: {
        Row: {
          avg_latency_ms: number | null
          created_at: string | null
          failures: number | null
          id: string
          metadata: Json | null
          mode: string
          p50_latency_ms: number | null
          p90_latency_ms: number | null
          p99_latency_ms: number | null
          status: string
          successes: number | null
          total_scenarios: number | null
        }
        Insert: {
          avg_latency_ms?: number | null
          created_at?: string | null
          failures?: number | null
          id?: string
          metadata?: Json | null
          mode: string
          p50_latency_ms?: number | null
          p90_latency_ms?: number | null
          p99_latency_ms?: number | null
          status?: string
          successes?: number | null
          total_scenarios?: number | null
        }
        Update: {
          avg_latency_ms?: number | null
          created_at?: string | null
          failures?: number | null
          id?: string
          metadata?: Json | null
          mode?: string
          p50_latency_ms?: number | null
          p90_latency_ms?: number | null
          p99_latency_ms?: number | null
          status?: string
          successes?: number | null
          total_scenarios?: number | null
        }
        Relationships: []
      }
      simulator_wizard_drafts: {
        Row: {
          created_at: string
          id: string
          personalizations: Json
          product_data: Json
          quantity: number
          title: string
          updated_at: string
          user_id: string
          wizard_step: string
        }
        Insert: {
          created_at?: string
          id?: string
          personalizations?: Json
          product_data?: Json
          quantity?: number
          title?: string
          updated_at?: string
          user_id: string
          wizard_step?: string
        }
        Update: {
          created_at?: string
          id?: string
          personalizations?: Json
          product_data?: Json
          quantity?: number
          title?: string
          updated_at?: string
          user_id?: string
          wizard_step?: string
        }
        Relationships: []
      }
      step_up_audit_log: {
        Row: {
          action: Database["public"]["Enums"]["step_up_action"] | null
          challenge_id: string | null
          created_at: string
          event_type: string
          id: string
          ip_address: unknown
          metadata: Json | null
          target_ref: string | null
          token_id: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action?: Database["public"]["Enums"]["step_up_action"] | null
          challenge_id?: string | null
          created_at?: string
          event_type: string
          id?: string
          ip_address?: unknown
          metadata?: Json | null
          target_ref?: string | null
          token_id?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: Database["public"]["Enums"]["step_up_action"] | null
          challenge_id?: string | null
          created_at?: string
          event_type?: string
          id?: string
          ip_address?: unknown
          metadata?: Json | null
          target_ref?: string | null
          token_id?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      step_up_challenges: {
        Row: {
          action: Database["public"]["Enums"]["step_up_action"]
          attempts: number
          consumed: boolean
          created_at: string
          expires_at: string
          id: string
          ip_address: unknown
          max_attempts: number
          otp_hash: string
          otp_verified: boolean
          password_verified: boolean
          target_ref: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          action: Database["public"]["Enums"]["step_up_action"]
          attempts?: number
          consumed?: boolean
          created_at?: string
          expires_at?: string
          id?: string
          ip_address?: unknown
          max_attempts?: number
          otp_hash: string
          otp_verified?: boolean
          password_verified?: boolean
          target_ref?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          action?: Database["public"]["Enums"]["step_up_action"]
          attempts?: number
          consumed?: boolean
          created_at?: string
          expires_at?: string
          id?: string
          ip_address?: unknown
          max_attempts?: number
          otp_hash?: string
          otp_verified?: boolean
          password_verified?: boolean
          target_ref?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      step_up_tokens: {
        Row: {
          action: Database["public"]["Enums"]["step_up_action"]
          challenge_id: string
          consumed: boolean
          consumed_at: string | null
          created_at: string
          expires_at: string
          id: string
          target_ref: string | null
          token_hash: string
          user_id: string
        }
        Insert: {
          action: Database["public"]["Enums"]["step_up_action"]
          challenge_id: string
          consumed?: boolean
          consumed_at?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          target_ref?: string | null
          token_hash: string
          user_id: string
        }
        Update: {
          action?: Database["public"]["Enums"]["step_up_action"]
          challenge_id?: string
          consumed?: boolean
          consumed_at?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          target_ref?: string | null
          token_hash?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "step_up_tokens_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "step_up_challenges"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          active: boolean | null
          code: string | null
          created_at: string | null
          id: string
          is_engraving_supplier: boolean | null
          is_product_supplier: boolean | null
          logo_url: string | null
          name: string
          state_uf: string | null
          trading_name: string | null
          updated_at: string | null
          website: string | null
        }
        Insert: {
          active?: boolean | null
          code?: string | null
          created_at?: string | null
          id?: string
          is_engraving_supplier?: boolean | null
          is_product_supplier?: boolean | null
          logo_url?: string | null
          name: string
          state_uf?: string | null
          trading_name?: string | null
          updated_at?: string | null
          website?: string | null
        }
        Update: {
          active?: boolean | null
          code?: string | null
          created_at?: string | null
          id?: string
          is_engraving_supplier?: boolean | null
          is_product_supplier?: boolean | null
          logo_url?: string | null
          name?: string
          state_uf?: string | null
          trading_name?: string | null
          updated_at?: string | null
          website?: string | null
        }
        Relationships: []
      }
      system_error_logs: {
        Row: {
          created_at: string
          error_message: string
          function_name: string
          id: string
          metadata: Json | null
          severity: string | null
          stack_trace: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          error_message: string
          function_name: string
          id?: string
          metadata?: Json | null
          severity?: string | null
          stack_trace?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          error_message?: string
          function_name?: string
          id?: string
          metadata?: Json | null
          severity?: string | null
          stack_trace?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      system_kill_switches: {
        Row: {
          created_at: string | null
          enabled: boolean | null
          id: string
          legacy_message: string | null
          rollout_percentage: number | null
          switch_name: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          enabled?: boolean | null
          id?: string
          legacy_message?: string | null
          rollout_percentage?: number | null
          switch_name: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          enabled?: boolean | null
          id?: string
          legacy_message?: string | null
          rollout_percentage?: number | null
          switch_name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      system_settings: {
        Row: {
          description: string | null
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          description?: string | null
          key: string
          updated_at?: string
          updated_by?: string | null
          value: Json
        }
        Update: {
          description?: string | null
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      user_comparisons: {
        Row: {
          client_id: string | null
          client_name: string | null
          created_at: string
          id: string
          is_public: boolean
          items: Json
          name: string | null
          share_expires_at: string | null
          share_token: string | null
          updated_at: string
          user_id: string
          view_count: number
        }
        Insert: {
          client_id?: string | null
          client_name?: string | null
          created_at?: string
          id?: string
          is_public?: boolean
          items?: Json
          name?: string | null
          share_expires_at?: string | null
          share_token?: string | null
          updated_at?: string
          user_id: string
          view_count?: number
        }
        Update: {
          client_id?: string | null
          client_name?: string | null
          created_at?: string
          id?: string
          is_public?: boolean
          items?: Json
          name?: string | null
          share_expires_at?: string | null
          share_token?: string | null
          updated_at?: string
          user_id?: string
          view_count?: number
        }
        Relationships: []
      }
      user_known_devices: {
        Row: {
          created_at: string
          device_name: string | null
          fingerprint: string
          id: string
          last_seen_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          device_name?: string | null
          fingerprint: string
          id?: string
          last_seen_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          device_name?: string | null
          fingerprint?: string
          id?: string
          last_seen_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_notification_preferences: {
        Row: {
          category: string
          created_at: string
          id: string
          in_app_enabled: boolean
          push_enabled: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          category: string
          created_at?: string
          id?: string
          in_app_enabled?: boolean
          push_enabled?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          in_app_enabled?: boolean
          push_enabled?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_onboarding: {
        Row: {
          completed_at: string | null
          completed_steps: Json | null
          created_at: string
          current_step: number
          has_completed_tour: boolean
          id: string
          started_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          completed_steps?: Json | null
          created_at?: string
          current_step?: number
          has_completed_tour?: boolean
          id?: string
          started_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          completed_steps?: Json | null
          created_at?: string
          current_step?: number
          has_completed_tour?: boolean
          id?: string
          started_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_preferences: {
        Row: {
          comparison_column_order: Json
          comparison_weights: Json
          created_at: string
          filter_states: Json
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          comparison_column_order?: Json
          comparison_weights?: Json
          created_at?: string
          filter_states?: Json
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          comparison_column_order?: Json
          comparison_weights?: Json
          created_at?: string
          filter_states?: Json
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          granted_by: string | null
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          granted_by?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          granted_by?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_search_history: {
        Row: {
          created_at: string | null
          history_type: string
          id: string
          is_pinned: boolean | null
          metadata: Json | null
          query_text: string
          result_count: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          history_type?: string
          id?: string
          is_pinned?: boolean | null
          metadata?: Json | null
          query_text: string
          result_count?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          history_type?: string
          id?: string
          is_pinned?: boolean | null
          metadata?: Json | null
          query_text?: string
          result_count?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_token_revocations: {
        Row: {
          revoked_at: string
          user_id: string
        }
        Insert: {
          revoked_at?: string
          user_id: string
        }
        Update: {
          revoked_at?: string
          user_id?: string
        }
        Relationships: []
      }
      variant_supplier_sources: {
        Row: {
          id: string
          is_active: boolean | null
          next_date_1: string | null
          next_date_2: string | null
          next_date_3: string | null
          next_quantity_1: number | null
          next_quantity_2: number | null
          next_quantity_3: number | null
          quantity: number | null
          reserved_quantity: number | null
          supplier_id: string | null
          supplier_sku: string | null
          updated_at: string | null
          variant_id: string | null
        }
        Insert: {
          id?: string
          is_active?: boolean | null
          next_date_1?: string | null
          next_date_2?: string | null
          next_date_3?: string | null
          next_quantity_1?: number | null
          next_quantity_2?: number | null
          next_quantity_3?: number | null
          quantity?: number | null
          reserved_quantity?: number | null
          supplier_id?: string | null
          supplier_sku?: string | null
          updated_at?: string | null
          variant_id?: string | null
        }
        Update: {
          id?: string
          is_active?: boolean | null
          next_date_1?: string | null
          next_date_2?: string | null
          next_date_3?: string | null
          next_quantity_1?: number | null
          next_quantity_2?: number | null
          next_quantity_3?: number | null
          quantity?: number | null
          reserved_quantity?: number | null
          supplier_id?: string | null
          supplier_sku?: string | null
          updated_at?: string | null
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "variant_supplier_sources_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "variant_supplier_sources_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "v_suppliers_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "variant_supplier_sources_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      video_variant_links: {
        Row: {
          created_at: string
          id: string
          product_id: string
          supplier_code: string | null
          variant_color_hex: string | null
          variant_id: string
          variant_name: string | null
          video_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          product_id: string
          supplier_code?: string | null
          variant_color_hex?: string | null
          variant_id: string
          variant_name?: string | null
          video_id: string
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string
          supplier_code?: string | null
          variant_color_hex?: string | null
          variant_id?: string
          variant_name?: string | null
          video_id?: string
        }
        Relationships: []
      }
      visual_search_feedback: {
        Row: {
          corrected_analysis: Json | null
          created_at: string
          feedback_notes: string | null
          id: string
          image_url: string | null
          is_correct: boolean | null
          match_relevance: number | null
          original_analysis: Json
          product_id: string | null
          search_terms: string | null
          user_id: string
        }
        Insert: {
          corrected_analysis?: Json | null
          created_at?: string
          feedback_notes?: string | null
          id?: string
          image_url?: string | null
          is_correct?: boolean | null
          match_relevance?: number | null
          original_analysis: Json
          product_id?: string | null
          search_terms?: string | null
          user_id?: string
        }
        Update: {
          corrected_analysis?: Json | null
          created_at?: string
          feedback_notes?: string | null
          id?: string
          image_url?: string | null
          is_correct?: boolean | null
          match_relevance?: number | null
          original_analysis?: Json
          product_id?: string | null
          search_terms?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "visual_search_feedback_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visual_search_feedback_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_products_public"
            referencedColumns: ["id"]
          },
        ]
      }
      voice_command_logs: {
        Row: {
          action: string
          created_at: string
          data: Json | null
          duration_ms: number | null
          id: string
          response: string | null
          success: boolean | null
          transcript: string
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          data?: Json | null
          duration_ms?: number | null
          id?: string
          response?: string | null
          success?: boolean | null
          transcript: string
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          data?: Json | null
          duration_ms?: number | null
          id?: string
          response?: string | null
          success?: boolean | null
          transcript?: string
          user_id?: string
        }
        Relationships: []
      }
      webhook_deliveries: {
        Row: {
          attempt: number
          delivered_at: string
          error_message: string | null
          event: string
          id: string
          payload: Json | null
          payload_hash: string | null
          response_body_truncated: string | null
          status_code: number | null
          success: boolean
          webhook_id: string
        }
        Insert: {
          attempt?: number
          delivered_at?: string
          error_message?: string | null
          event: string
          id?: string
          payload?: Json | null
          payload_hash?: string | null
          response_body_truncated?: string | null
          status_code?: number | null
          success?: boolean
          webhook_id: string
        }
        Update: {
          attempt?: number
          delivered_at?: string
          error_message?: string | null
          event?: string
          id?: string
          payload?: Json | null
          payload_hash?: string | null
          response_body_truncated?: string | null
          status_code?: number | null
          success?: boolean
          webhook_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "webhook_deliveries_webhook_id_fkey"
            columns: ["webhook_id"]
            isOneToOne: false
            referencedRelation: "outbound_webhooks"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_delivery_metrics: {
        Row: {
          attempt: number | null
          direction: string | null
          duration_ms: number | null
          endpoint: string | null
          error_class: string | null
          error_message: string | null
          event_type: string | null
          http_status: number | null
          id: string
          metadata: Json | null
          occurred_at: string
          payload_bytes: number | null
          request_id: string | null
          source: string | null
          success: boolean | null
        }
        Insert: {
          attempt?: number | null
          direction?: string | null
          duration_ms?: number | null
          endpoint?: string | null
          error_class?: string | null
          error_message?: string | null
          event_type?: string | null
          http_status?: number | null
          id?: string
          metadata?: Json | null
          occurred_at?: string
          payload_bytes?: number | null
          request_id?: string | null
          source?: string | null
          success?: boolean | null
        }
        Update: {
          attempt?: number | null
          direction?: string | null
          duration_ms?: number | null
          endpoint?: string | null
          error_class?: string | null
          error_message?: string | null
          event_type?: string | null
          http_status?: number | null
          id?: string
          metadata?: Json | null
          occurred_at?: string
          payload_bytes?: number | null
          request_id?: string | null
          source?: string | null
          success?: boolean | null
        }
        Relationships: []
      }
      webhook_delivery_metrics_y2026m05: {
        Row: {
          attempt: number | null
          direction: string | null
          duration_ms: number | null
          endpoint: string | null
          error_class: string | null
          error_message: string | null
          event_type: string | null
          http_status: number | null
          id: string
          metadata: Json | null
          occurred_at: string
          payload_bytes: number | null
          request_id: string | null
          source: string | null
          success: boolean | null
        }
        Insert: {
          attempt?: number | null
          direction?: string | null
          duration_ms?: number | null
          endpoint?: string | null
          error_class?: string | null
          error_message?: string | null
          event_type?: string | null
          http_status?: number | null
          id?: string
          metadata?: Json | null
          occurred_at?: string
          payload_bytes?: number | null
          request_id?: string | null
          source?: string | null
          success?: boolean | null
        }
        Update: {
          attempt?: number | null
          direction?: string | null
          duration_ms?: number | null
          endpoint?: string | null
          error_class?: string | null
          error_message?: string | null
          event_type?: string | null
          http_status?: number | null
          id?: string
          metadata?: Json | null
          occurred_at?: string
          payload_bytes?: number | null
          request_id?: string | null
          source?: string | null
          success?: boolean | null
        }
        Relationships: []
      }
      webhook_delivery_metrics_y2026m06: {
        Row: {
          attempt: number | null
          direction: string | null
          duration_ms: number | null
          endpoint: string | null
          error_class: string | null
          error_message: string | null
          event_type: string | null
          http_status: number | null
          id: string
          metadata: Json | null
          occurred_at: string
          payload_bytes: number | null
          request_id: string | null
          source: string | null
          success: boolean | null
        }
        Insert: {
          attempt?: number | null
          direction?: string | null
          duration_ms?: number | null
          endpoint?: string | null
          error_class?: string | null
          error_message?: string | null
          event_type?: string | null
          http_status?: number | null
          id?: string
          metadata?: Json | null
          occurred_at?: string
          payload_bytes?: number | null
          request_id?: string | null
          source?: string | null
          success?: boolean | null
        }
        Update: {
          attempt?: number | null
          direction?: string | null
          duration_ms?: number | null
          endpoint?: string | null
          error_class?: string | null
          error_message?: string | null
          event_type?: string | null
          http_status?: number | null
          id?: string
          metadata?: Json | null
          occurred_at?: string
          payload_bytes?: number | null
          request_id?: string | null
          source?: string | null
          success?: boolean | null
        }
        Relationships: []
      }
      workspace_notifications: {
        Row: {
          action_url: string | null
          category: string
          created_at: string
          id: string
          is_read: boolean
          message: string
          metadata: Json | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          action_url?: string | null
          category?: string
          created_at?: string
          id?: string
          is_read?: boolean
          message: string
          metadata?: Json | null
          title: string
          type?: string
          user_id: string
        }
        Update: {
          action_url?: string | null
          category?: string
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string
          metadata?: Json | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      product_popularity_30d: {
        Row: {
          category_name: string | null
          id: string | null
          image_url: string | null
          name: string | null
          sku: string | null
          view_count: number | null
        }
        Relationships: []
      }
      v_full_scope_grants: {
        Row: {
          audit_id: string | null
          challenge_id: string | null
          extra: Json | null
          granted_at: string | null
          granted_to_email: string | null
          granted_to_name: string | null
          granted_to_user_id: string | null
          ip_address: unknown
          justification: string | null
          key_expires_at: string | null
          key_id: string | null
          key_prefix: string | null
          operation: string | null
          request_id: string | null
          step_up_action: Database["public"]["Enums"]["step_up_action"] | null
          token_id: string | null
          user_agent: string | null
          verifications_applied: Json | null
        }
        Relationships: []
      }
      v_products_public: {
        Row: {
          category_id: string | null
          category_name: string | null
          colors: Json | null
          created_at: string | null
          description: string | null
          external_id: string | null
          featured: boolean | null
          id: string | null
          images: string[] | null
          is_active: boolean | null
          is_kit: boolean | null
          is_stockout: boolean | null
          kit_items: Json | null
          last_stock_update_at: string | null
          materials: string[] | null
          metadata: Json | null
          min_quantity: number | null
          name: string | null
          new_arrival: boolean | null
          on_sale: boolean | null
          price: number | null
          price_freshness_threshold_days: number | null
          price_updated_at: string | null
          price_verified_at: string | null
          sku: string | null
          stock: number | null
          stock_quantity: number | null
          stock_status: string | null
          subcategory: string | null
          supplier_id: string | null
          supplier_name: string | null
          synced_at: string | null
          tags: Json | null
          updated_at: string | null
          variations: Json | null
          video_url: string | null
        }
        Insert: {
          category_id?: string | null
          category_name?: string | null
          colors?: Json | null
          created_at?: string | null
          description?: string | null
          external_id?: string | null
          featured?: boolean | null
          id?: string | null
          images?: string[] | null
          is_active?: boolean | null
          is_kit?: boolean | null
          is_stockout?: boolean | null
          kit_items?: Json | null
          last_stock_update_at?: string | null
          materials?: string[] | null
          metadata?: Json | null
          min_quantity?: number | null
          name?: string | null
          new_arrival?: boolean | null
          on_sale?: boolean | null
          price?: number | null
          price_freshness_threshold_days?: number | null
          price_updated_at?: string | null
          price_verified_at?: string | null
          sku?: string | null
          stock?: number | null
          stock_quantity?: number | null
          stock_status?: string | null
          subcategory?: string | null
          supplier_id?: string | null
          supplier_name?: string | null
          synced_at?: string | null
          tags?: Json | null
          updated_at?: string | null
          variations?: Json | null
          video_url?: string | null
        }
        Update: {
          category_id?: string | null
          category_name?: string | null
          colors?: Json | null
          created_at?: string | null
          description?: string | null
          external_id?: string | null
          featured?: boolean | null
          id?: string | null
          images?: string[] | null
          is_active?: boolean | null
          is_kit?: boolean | null
          is_stockout?: boolean | null
          kit_items?: Json | null
          last_stock_update_at?: string | null
          materials?: string[] | null
          metadata?: Json | null
          min_quantity?: number | null
          name?: string | null
          new_arrival?: boolean | null
          on_sale?: boolean | null
          price?: number | null
          price_freshness_threshold_days?: number | null
          price_updated_at?: string | null
          price_verified_at?: string | null
          sku?: string | null
          stock?: number | null
          stock_quantity?: number | null
          stock_status?: string | null
          subcategory?: string | null
          supplier_id?: string | null
          supplier_name?: string | null
          synced_at?: string | null
          tags?: Json | null
          updated_at?: string | null
          variations?: Json | null
          video_url?: string | null
        }
        Relationships: []
      }
      v_suppliers_public: {
        Row: {
          active: boolean | null
          code: string | null
          created_at: string | null
          id: string | null
          is_engraving_supplier: boolean | null
          is_product_supplier: boolean | null
          logo_url: string | null
          name: string | null
          state_uf: string | null
          trading_name: string | null
          updated_at: string | null
          website: string | null
        }
        Insert: {
          active?: boolean | null
          code?: string | null
          created_at?: string | null
          id?: string | null
          is_engraving_supplier?: boolean | null
          is_product_supplier?: boolean | null
          logo_url?: string | null
          name?: string | null
          state_uf?: string | null
          trading_name?: string | null
          updated_at?: string | null
          website?: string | null
        }
        Update: {
          active?: boolean | null
          code?: string | null
          created_at?: string | null
          id?: string | null
          is_engraving_supplier?: boolean | null
          is_product_supplier?: boolean | null
          logo_url?: string | null
          name?: string | null
          state_uf?: string | null
          trading_name?: string | null
          updated_at?: string | null
          website?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      _can_act_on_behalf_of_others: { Args: never; Returns: boolean }
      acquire_ai_quota: {
        Args: { _function_name: string; _model: string; _user_id: string }
        Returns: Json
      }
      audit_ownership_orphans: {
        Args: { _triggered_by?: string }
        Returns: string
      }
      audit_rls_coverage: { Args: never; Returns: Json }
      audit_rls_matrix: { Args: never; Returns: Json }
      audit_security_definer_acl: {
        Args: never
        Returns: {
          arguments: string
          function_name: string
          granted_to: string
          problem: string
        }[]
      }
      auto_block_extreme_offenders: { Args: never; Returns: Json }
      auto_revoke_orphan_full_keys: {
        Args: { _source?: string }
        Returns: {
          created_by: string
          key_id: string
          revoked_at: string
        }[]
      }
      can_approve_discount: { Args: { _user_id?: string }; Returns: boolean }
      can_grant_mcp_full: { Args: { _user_id: string }; Returns: boolean }
      can_manage_connections: { Args: { _user_id?: string }; Returns: boolean }
      can_manage_quotes: { Args: { _user_id?: string }; Returns: boolean }
      can_view_all_sales: { Args: { _user_id?: string }; Returns: boolean }
      can_view_audit_logs: { Args: { _user_id?: string }; Returns: boolean }
      can_view_connections: { Args: { _user_id?: string }; Returns: boolean }
      can_view_telemetry: { Args: { _user_id?: string }; Returns: boolean }
      check_ai_quota: { Args: { _user_id: string }; Returns: Json }
      check_auth_config_status: { Args: never; Returns: Json }
      check_auth_throttling: {
        Args: { _email: string; _ip: string }
        Returns: {
          allowed: boolean
          remaining_seconds: number
        }[]
      }
      check_edge_rate_limit: {
        Args: { p_key: string; p_max_requests: number; p_window_ms: number }
        Returns: {
          allowed: boolean
          remaining: number
          reset_at: string
        }[]
      }
      check_hardening_status: { Args: never; Returns: Json }
      check_ip_access: { Args: { _ip: string }; Returns: string }
      check_mcp_abuse_threshold: {
        Args: { _ip: string; _user_id: string }
        Returns: undefined
      }
      check_rate_limit: {
        Args: {
          _block_duration_seconds?: number
          _endpoint: string
          _identifier: string
          _max_requests?: number
          _window_seconds?: number
        }
        Returns: Json
      }
      check_telemetry_regression: { Args: never; Returns: Json }
      claim_next_optimization: {
        Args: never
        Returns: {
          category: string
          created_at: string
          created_by: string | null
          description: string | null
          error: string | null
          finished_at: string | null
          guardrail_status: string | null
          id: string
          priority: number
          result: Json | null
          started_at: string | null
          status: string
          title: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "optimization_queue"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      cleanup_discount_test_data: { Args: never; Returns: Json }
      cleanup_expired_collection_trash: { Args: never; Returns: number }
      cleanup_expired_edge_rate_limits: { Args: never; Returns: undefined }
      cleanup_expired_favorite_trash: { Args: never; Returns: number }
      cleanup_expired_public_comparisons: { Args: never; Returns: number }
      cleanup_expired_step_up: { Args: never; Returns: undefined }
      cleanup_inbound_webhook_events: { Args: never; Returns: Json }
      cleanup_old_notifications: { Args: never; Returns: undefined }
      cleanup_rate_limits: { Args: never; Returns: undefined }
      cleanup_security_logs: { Args: never; Returns: Json }
      cleanup_simulation_telemetry: { Args: never; Returns: Json }
      cleanup_webhook_logs: { Args: never; Returns: Json }
      clear_auth_attempts: { Args: { _email: string }; Returns: undefined }
      complete_optimization: {
        Args: {
          _error?: string
          _guardrail_status?: string
          _id: string
          _notes?: string
          _result?: Json
          _status: string
        }
        Returns: {
          category: string
          created_at: string
          created_by: string | null
          description: string | null
          error: string | null
          finished_at: string | null
          guardrail_status: string | null
          id: string
          priority: number
          result: Json | null
          started_at: string | null
          status: string
          title: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "optimization_queue"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      consume_step_up_token:
        | {
            Args: { _challenge_id: string; _token_hash: string }
            Returns: boolean
          }
        | {
            Args: {
              _expected_action: Database["public"]["Enums"]["step_up_action"]
              _expected_target?: string
              _token: string
            }
            Returns: boolean
          }
      convert_quote_to_order: {
        Args: {
          p_organization_id?: string
          p_quote_id: string
          p_seller_id: string
        }
        Returns: Json
      }
      create_organization_with_owner: {
        Args: { _name: string; _slug: string }
        Returns: string
      }
      cron_invoke_edge: {
        Args: {
          p_body?: Json
          p_timeout_ms?: number
          p_url_secret_name: string
        }
        Returns: number
      }
      e2e_cleanup_check_rate_limit: {
        Args: { p_key: string; p_max: number; p_window_seconds: number }
        Returns: {
          allowed: boolean
          current_count: number
          reset_in_seconds: number
        }[]
      }
      enqueue_optimization: {
        Args: {
          _category?: string
          _description?: string
          _priority?: number
          _title: string
        }
        Returns: string
      }
      ensure_default_favorite_list: {
        Args: { _user_id: string }
        Returns: string
      }
      execute_role_migration_batch: {
        Args: {
          _dry_run?: boolean
          _items: Json
          _label: string
          _reason: string
        }
        Returns: string
      }
      fn_check_geo_access: {
        Args: { p_country_code: string }
        Returns: boolean
      }
      fn_create_quote_v3: {
        Args: { p_items_data: Json; p_quote_data: Json }
        Returns: Json
      }
      fn_save_quote_draft: { Args: { p_data: Json }; Returns: string }
      fn_should_apply_kill_switch: {
        Args: { p_bucket_key: string; p_switch_name: string }
        Returns: boolean
      }
      get_app_health_summary: { Args: { _minutes?: number }; Returns: Json }
      get_auto_test_job_status: {
        Args: { _limit?: number }
        Returns: {
          avg_latency_ms: number
          duration_ms: number
          fail_count: number
          ok_count: number
          retried_count: number
          run_ended_at: string
          run_started_at: string
          total_tested: number
        }[]
      }
      get_bundle_suggestions: {
        Args: { _product_id: string }
        Returns: {
          cooccurrence_count: number
          frequency_percent: number
          product_id: string
          product_image_url: string
          product_name: string
        }[]
      }
      get_client_seasonality: {
        Args: { _client_id: string; _months?: number }
        Returns: {
          avg_ticket: number
          month: number
          quotes_count: number
          total_revenue: number
          year: number
        }[]
      }
      get_client_top_products: {
        Args: { _client_id: string; _limit?: number }
        Returns: {
          avg_unit_price: number
          last_quoted_at: string
          occurrences: number
          product_id: string
          product_image_url: string
          product_name: string
          total_quantity: number
          total_revenue: number
        }[]
      }
      get_collections_weekly_count: {
        Args: { _weeks?: number }
        Returns: {
          item_count: number
          week_start: string
        }[]
      }
      get_connection_failure_window_minutes: { Args: never; Returns: number }
      get_connections_auto_test_interval: { Args: never; Returns: number }
      get_edge_function_secret: { Args: { _name: string }; Returns: string }
      get_favorites_weekly_count: {
        Args: { _weeks?: number }
        Returns: {
          item_count: number
          week_start: string
        }[]
      }
      get_industry_benchmark_stats: {
        Args: { _company_ids: string[]; _days?: number }
        Returns: {
          avg_items_per_quote: number
          avg_ltv: number
          avg_quotes_per_client: number
          avg_ticket: number
          top_product_name: string
          total_clients_sampled: number
          total_revenue: number
        }[]
      }
      get_industry_seasonality: {
        Args: { _company_ids: string[]; _months?: number }
        Returns: {
          avg_quotes_per_company: number
          avg_revenue_per_company: number
          companies_active: number
          month: number
          year: number
        }[]
      }
      get_industry_top_products: {
        Args: { _company_ids: string[]; _days?: number; _limit?: number }
        Returns: {
          avg_unit_price: number
          product_id: string
          product_image_url: string
          product_name: string
          total_quantity: number
          total_revenue: number
          unique_clients: number
          unique_sellers: number
        }[]
      }
      get_platform_failure_metrics: {
        Args: { window_minutes?: number }
        Returns: Json
      }
      get_public_schema_signatures: { Args: never; Returns: Json }
      get_quote_token_by_value: {
        Args: { _token: string }
        Returns: {
          client_email: string | null
          client_name: string | null
          created_at: string
          expires_at: string | null
          id: string
          quote_id: string
          responded_at: string | null
          response: string | null
          response_notes: string | null
          seller_id: string
          signature_hash: string | null
          signed_at: string | null
          signer_document: string | null
          signer_ip: string | null
          signer_name: string | null
          signer_user_agent: string | null
          status: string
          token: string
          updated_at: string
          viewed_at: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "quote_approval_tokens"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_top_collected_products: {
        Args: { _days?: number; _limit?: number }
        Returns: {
          col_count: number
          product_id: string
        }[]
      }
      get_top_compared_products: {
        Args: { p_limit?: number }
        Returns: {
          comparison_count: number
          product_id: string
        }[]
      }
      get_top_favorited_products: {
        Args: { _days?: number; _limit?: number }
        Returns: {
          fav_count: number
          product_id: string
        }[]
      }
      get_unread_count: { Args: never; Returns: number }
      get_user_org_ids: {
        Args: { _user_id: string }
        Returns: {
          organization_id: string
        }[]
      }
      get_user_recent_comparisons: {
        Args: { p_limit?: number }
        Returns: {
          client_name: string
          id: string
          item_count: number
          items: Json
          name: string
          updated_at: string
        }[]
      }
      get_webhook_delivery_summary: {
        Args: { _minutes?: number }
        Returns: {
          direction: string
          failures: number
          last_failure_at: string
          p95_ms: number
          source: string
          status_class: string
          total: number
        }[]
      }
      has_org_role: {
        Args: {
          _org_id: string
          _role: Database["public"]["Enums"]["org_role"]
          _user_id: string
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_kit_template_usage: {
        Args: { _template_id: string }
        Returns: undefined
      }
      increment_webhook_stats: {
        Args: { p_endpoint_id: string; p_is_invalid: boolean }
        Returns: undefined
      }
      is_admin:
        | { Args: never; Returns: boolean }
        | { Args: { _user_id?: string }; Returns: boolean }
      is_admin_strict: { Args: { _user_id?: string }; Returns: boolean }
      is_dev: { Args: { _user_id?: string }; Returns: boolean }
      is_dnd_active:
        | { Args: never; Returns: boolean }
        | { Args: { p_user_id: string }; Returns: boolean }
      is_kit_collaborator: {
        Args: { _kit_id: string; _user_id: string }
        Returns: boolean
      }
      is_kit_owner: {
        Args: { _kit_id: string; _user_id: string }
        Returns: boolean
      }
      is_manager_or_admin: { Args: never; Returns: boolean }
      is_org_member: {
        Args: { _org_id: string; _user_id: string }
        Returns: boolean
      }
      is_seller_only: { Args: { _user_id?: string }; Returns: boolean }
      is_supervisor_or_above: { Args: { _user_id?: string }; Returns: boolean }
      log_access_denied: {
        Args: {
          _blocked_path: string
          _reason?: string
          _required_role: string
          _user_role?: string
        }
        Returns: undefined
      }
      log_full_scope_grant: {
        Args: {
          _challenge_id?: string
          _confirmation_phrase_ok?: boolean
          _expires_at?: string
          _extra?: Json
          _ip?: unknown
          _justification?: string
          _key_id: string
          _key_prefix: string
          _operation: string
          _request_id?: string
          _token_id?: string
          _user_agent?: string
        }
        Returns: string
      }
      log_rls_denial: {
        Args: {
          p_endpoint?: string
          p_error_code?: string
          p_error_message?: string
          p_operation: string
          p_policy_hint?: string
          p_query_summary?: string
          p_table_name: string
          p_target_id?: string
          p_target_seller_id?: string
          p_user_agent?: string
        }
        Returns: string
      }
      log_user_logout: { Args: never; Returns: undefined }
      lookup_request_id: { Args: { _request_id: string }; Returns: Json }
      maintain_webhook_metrics: { Args: never; Returns: undefined }
      mark_all_notifications_read: { Args: never; Returns: undefined }
      mark_notification_read: {
        Args: { p_notification_id: string }
        Returns: undefined
      }
      mark_step_up_password_verified: {
        Args: { _challenge_id: string }
        Returns: boolean
      }
      mcp_audit_actor: { Args: { _fallback: string }; Returns: string }
      notify_hardening_regression: { Args: never; Returns: Json }
      purge_expired_security_data: { Args: never; Returns: undefined }
      purge_expired_step_up_artifacts: {
        Args: {
          _challenge_grace_minutes?: number
          _token_grace_minutes?: number
        }
        Returns: {
          challenges_deleted: number
          tokens_deleted: number
        }[]
      }
      purge_old_audit_logs: { Args: never; Returns: undefined }
      record_app_vital:
        | {
            Args: {
              _name: string
              _rating?: string
              _req_id?: string
              _ua?: string
              _uid?: string
              _url?: string
              _value: number
            }
            Returns: undefined
          }
        | {
            Args: {
              _name: string
              _rating: string
              _req_id: string
              _ua: string
              _uid?: string
              _url: string
              _value: number
            }
            Returns: undefined
          }
      record_auth_attempt: {
        Args: {
          _email: string
          _ip: string
          _reason?: string
          _success: boolean
          _ua?: string
        }
        Returns: undefined
      }
      record_dev_route_telemetry: {
        Args: {
          _blocked_path: string
          _duration_ms?: number
          _event_type: string
          _user_role?: string
        }
        Returns: undefined
      }
      record_mcp_access_violation: {
        Args: {
          _details?: Json
          _ip?: string
          _operation?: string
          _reason: string
          _request_id?: string
          _source: string
          _target_key_id?: string
          _user_agent?: string
          _user_id: string
        }
        Returns: string
      }
      record_platform_failure: {
        Args: {
          p_duration_ms?: number
          p_error_message?: string
          p_is_503?: boolean
          p_is_cold_start?: boolean
          p_operation: string
          p_retry_count?: number
          p_rpc_name?: string
          p_table?: string
        }
        Returns: string
      }
      record_public_token_failure: {
        Args: {
          _attempted_token: string
          _ip: string
          _reason: string
          _resource_id: string
          _resource_type: string
          _ua: string
        }
        Returns: undefined
      }
      refresh_product_popularity: { Args: never; Returns: undefined }
      repair_ownership_orphans: {
        Args: {
          _dry_run?: boolean
          _report_id?: string
          _triggered_by_label?: string
        }
        Returns: Json
      }
      request_step_up_challenge: {
        Args: {
          _action: Database["public"]["Enums"]["step_up_action"]
          _ip?: unknown
          _target_ref?: string
          _user_agent?: string
        }
        Returns: {
          challenge_id: string
          expires_at: string
          otp_plain: string
        }[]
      }
      reset_optimization_queue: {
        Args: { _only_running?: boolean }
        Returns: number
      }
      retry_failed_webhook_deliveries: { Args: never; Returns: Json }
      revoke_all_user_tokens: { Args: { _user_id: string }; Returns: undefined }
      search_products_semantic: {
        Args: { _limit?: number; _products: Json; _query: string }
        Returns: {
          matched_field: string
          product_id: string
          score: number
        }[]
      }
      search_records_rerank: {
        Args: { _candidates: Json; _query: string }
        Returns: {
          id: string
          matched_field: string
          score: number
        }[]
      }
      seed_discount_test_users: { Args: never; Returns: Json }
      set_connection_failure_window_minutes: {
        Args: { minutes: number }
        Returns: number
      }
      set_connections_auto_test_interval: {
        Args: { minutes: number }
        Returns: number
      }
      snapshot_hardening_status: { Args: never; Returns: Json }
      start_step_up_challenge: {
        Args: { _action: string; _target_ref?: string }
        Returns: string
      }
      submit_quote_response: {
        Args: { _response: string; _response_notes?: string; _token: string }
        Returns: boolean
      }
      sync_external_connections_from_credentials:
        | { Args: never; Returns: Json }
        | {
            Args: {
              _trigger_op?: string
              _trigger_secret_name?: string
              _trigger_user_id?: string
            }
            Returns: Json
          }
      validate_mcp_key: {
        Args: { _key_plain: string }
        Returns: {
          block_reason: string
          created_by: string
          key_id: string
          scopes: string[]
        }[]
      }
      verify_step_up_otp: {
        Args: { _challenge_id: string; _otp_attempt: string }
        Returns: boolean
      }
      verify_step_up_password: {
        Args: { _challenge_id: string; _password_attempt: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role:
        | "admin"
        | "manager"
        | "vendedor"
        | "supervisor"
        | "dev"
        | "agente"
        | "coordenador"
      conversation_event_type:
        | "text"
        | "image"
        | "file"
        | "system"
        | "tool_call"
        | "tool_result"
      org_role: "owner" | "admin" | "member"
      role_migration_item_status:
        | "pending"
        | "success"
        | "failed"
        | "skipped"
        | "dry_run"
      role_migration_status:
        | "pending"
        | "running"
        | "completed"
        | "failed"
        | "partial"
        | "dry_run"
      step_up_action:
        | "promote_dev"
        | "demote_dev"
        | "mcp_full_issue"
        | "mcp_full_escalate"
        | "secret_rotation"
        | "secret_revoke"
        | "mcp_key_revoke"
        | "mcp_key_rotate"
    }
    CompositeTypes: Record<never, never>
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
    Enums: {
      app_role: [
        "admin",
        "manager",
        "vendedor",
        "supervisor",
        "dev",
        "agente",
        "coordenador",
      ],
      conversation_event_type: [
        "text",
        "image",
        "file",
        "system",
        "tool_call",
        "tool_result",
      ],
      org_role: ["owner", "admin", "member"],
      role_migration_item_status: [
        "pending",
        "success",
        "failed",
        "skipped",
        "dry_run",
      ],
      role_migration_status: [
        "pending",
        "running",
        "completed",
        "failed",
        "partial",
        "dry_run",
      ],
      step_up_action: [
        "promote_dev",
        "demote_dev",
        "mcp_full_issue",
        "mcp_full_escalate",
        "secret_rotation",
        "secret_revoke",
        "mcp_key_revoke",
        "mcp_key_rotate",
      ],
    },
  },
} as const
