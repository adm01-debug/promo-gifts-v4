export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      _backup_stock_daily_summary: {
        Row: {
          backup_date: string | null
          created_at: string | null
          id: string
          stock_data: Json | null
          supplier_id: string | null
        }
        Insert: {
          backup_date?: string | null
          created_at?: string | null
          id?: string
          stock_data?: Json | null
          supplier_id?: string | null
        }
        Update: {
          backup_date?: string | null
          created_at?: string | null
          id?: string
          stock_data?: Json | null
          supplier_id?: string | null
        }
        Relationships: []
      }
      categories: {
        Row: {
          ai_summary: string | null
          bitrix_id: number | null
          bitrix_modified_at: string | null
          children_count: number | null
          color_hex: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          descendants_count: number | null
          description: string | null
          display_order: number | null
          full_path_readable: string | null
          icon: string | null
          id: string
          image_url: string | null
          is_active: boolean | null
          is_visible: boolean | null
          level: number
          meta_description: string | null
          meta_keywords: string[] | null
          meta_title: string | null
          min_order_quantity: number | null
          name: string
          organization_id: string | null
          parent_id: string | null
          path: string | null
          products_count: number | null
          schema_json: Json | null
          seo_priority: number | null
          slug: string | null
          sync_status: string | null
          synced_at: string | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          ai_summary?: string | null
          bitrix_id?: number | null
          bitrix_modified_at?: string | null
          children_count?: number | null
          color_hex?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          descendants_count?: number | null
          description?: string | null
          display_order?: number | null
          full_path_readable?: string | null
          icon?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          is_visible?: boolean | null
          level?: number
          meta_description?: string | null
          meta_keywords?: string[] | null
          meta_title?: string | null
          min_order_quantity?: number | null
          name: string
          organization_id?: string | null
          parent_id?: string | null
          path?: string | null
          products_count?: number | null
          schema_json?: Json | null
          seo_priority?: number | null
          slug?: string | null
          sync_status?: string | null
          synced_at?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          ai_summary?: string | null
          bitrix_id?: number | null
          bitrix_modified_at?: string | null
          children_count?: number | null
          color_hex?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          descendants_count?: number | null
          description?: string | null
          display_order?: number | null
          full_path_readable?: string | null
          icon?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          is_visible?: boolean | null
          level?: number
          meta_description?: string | null
          meta_keywords?: string[] | null
          meta_title?: string | null
          min_order_quantity?: number | null
          name?: string
          organization_id?: string | null
          parent_id?: string | null
          path?: string | null
          products_count?: number | null
          schema_json?: Json | null
          seo_priority?: number | null
          slug?: string | null
          sync_status?: string | null
          synced_at?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "categories_tree_visual"
            referencedColumns: ["id"]
          },
        ]
      }