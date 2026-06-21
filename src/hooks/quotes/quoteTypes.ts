/**
 * quoteTypes — Tipos de domínio para orçamentos
 */
import type { QuoteStatus } from '@/types/quote';

export interface QuoteItemPersonalization {
  id?: string;
  quote_item_id?: string;
  technique_id: string;
  technique_name?: string;
  location_code?: string;
  location_name?: string;
  colors_count?: number;
  positions_count?: number;
  area_cm2?: number;
  width_cm?: number;
  height_cm?: number;
  personalized_quantity?: number;
  setup_cost?: number;
  unit_cost?: number;
  total_cost?: number;
  notes?: string;
}

export interface QuoteItem {
  id?: string;
  quote_id?: string;
  product_id: string;
  product_name: string;
  product_sku?: string;
  product_image_url?: string;
  quantity: number;
  unit_price: number;
  subtotal?: number;
  color_name?: string;
  color_hex?: string;
  notes?: string;
  sort_order?: number;
  bitrix_product_id?: number | string | null;
  kit_group_id?: string | null;
  kit_name?: string | null;
  size_code?: string | null;
  gender?: string | null;
  /** ISO timestamp da última atualização do preço no catálogo externo (SSOT). Usado pelo badge "preço pode estar defasado". */
  price_updated_at?: string | null;
  /** Janela (em dias) configurada por produto para alertar preço defasado. Default 60. */
  price_freshness_threshold_days?: number | null;
  /** Timestamp em que o vendedor confirmou o preço com o fornecedor durante a montagem do orçamento. Quando preenchido, o badge de preço defasado é suprimido neste item. */
  price_confirmed_at?: string | null;
  personalizations?: QuoteItemPersonalization[];
}

export interface Quote {
  id?: string;
  quote_number?: string;
  client_id?: string;
  contact_id?: string;
  client_name?: string;
  client_email?: string;
  client_phone?: string;
  client_company?: string;
  client_cnpj?: string;
  seller_id?: string;
  status: QuoteStatus;
  subtotal: number;
  discount_percent: number;
  discount_amount: number;
  total: number;
  notes?: string;
  payment_method?: string;
  payment_terms?: string;
  delivery_time?: string;
  shipping_method?: string;
  shipping_type?: string;
  shipping_cost?: number;
  /** Margem de negociação interna 0–50% (default 0). Infla o subtotal apresentado para criar margem psicológica de desconto. NUNCA exposto ao cliente. */
  negotiation_markup_percent?: number;
  /** Subtotal real (sem markup). Calculado pelo trigger; somente leitura. */
  real_subtotal?: number;
  /** Desconto efetivo real vs real_subtotal (validado contra alçada). Somente leitura. */
  real_discount_percent?: number;
  internal_notes?: string;
  valid_until?: string;
  bitrix_deal_id?: string;
  bitrix_quote_id?: string;
  synced_to_bitrix?: boolean;
  synced_at?: string;
  client_response?: string;
  client_response_at?: string;
  client_response_notes?: string;
  created_at?: string;
  updated_at?: string;
  items?: QuoteItem[];
}

export interface PersonalizationTechnique {
  id: string;
  name: string;
  description?: string;
  code?: string;
  min_quantity?: number;
  setup_cost?: number;
  unit_cost?: number;
  estimated_days?: number;
  is_active?: boolean;
}
