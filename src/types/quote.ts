// src/types/quote.ts
// Orçamentos

export type QuoteStatus =
  | 'approved'
  | 'cancelled'
  | 'converted'
  | 'draft'
  | 'expired'
  | 'pending_approval'
  | 'pending'
  | 'rejected'
  | 'sent'
  | 'viewed';
export type ClientResponse = 'approved' | 'changes_requested' | 'rejected';

export interface Quote {
  id: string;
  quote_number: string; // "ORC-2026-0001"
  client_id: string | null;
  contact_id: string | null; // CRM contact ID (external DB, no FK)
  client_name: string | null;
  client_email: string | null;
  client_phone: string | null;
  client_company: string | null;
  seller_id: string | null; // FK profiles.id
  status: QuoteStatus;
  payment_method: string | null;
  subtotal: number | null;
  discount_percent: number | null;
  discount_amount: number | null;
  total: number | null;
  valid_until: string | null; // ISO date
  payment_terms: string | null;
  delivery_time: string | null;
  shipping_type: string | null; // 'cif' (cortesia) | 'fob' (cliente paga) | 'fob_pre' (pré-negociado com cost)
  shipping_cost: number | null;
  notes: string | null; // Notas para cliente
  internal_notes: string | null; // Notas internas
  bitrix_deal_id: string | null;
  bitrix_quote_id: string | null;
  synced_to_bitrix: boolean | null;
  synced_at: string | null;
  client_response: ClientResponse | null;
  client_response_at: string | null;
  client_response_notes: string | null;
  created_at: string;
  updated_at: string;
  sent_at: string | null;
}

export interface QuoteItem {
  id: string;
  quote_id: string;
  product_id: string | null;
  product_name: string;
  product_sku: string | null;
  product_image_url: string | null;
  quantity: number;
  unit_price: number;
  subtotal: number | null;
  color_name: string | null;
  color_hex: string | null;
  personalization_type: string | null;
  personalization_colors: number | null;
  personalization_price: number | null;
  personalization_notes: string | null;
  notes: string | null;
  display_order: number | null;
  sort_order: number | null;
  created_at: string;
  updated_at: string;
}

// Quote com itens (para exibição)
export interface QuoteWithItems extends Quote {
  items: QuoteItem[];
}

// Input para criar quote
export interface QuoteInput {
  client_id?: string;
  client_name: string;
  client_email?: string;
  client_phone?: string;
  client_company?: string;
  payment_terms?: string;
  delivery_time?: string;
  shipping_type?: string;
  shipping_cost?: number;
  notes?: string;
  internal_notes?: string;
  valid_until?: string;
  discount_percent?: number;
  discount_amount?: number;
}

// Input para criar item
export interface QuoteItemInput {
  quote_id: string;
  product_id?: string;
  product_name: string;
  product_sku?: string;
  product_image_url?: string;
  quantity: number;
  unit_price: number;
  color_name?: string;
  color_hex?: string;
  personalization_type?: string;
  personalization_colors?: number;
  personalization_price?: number;
  personalization_notes?: string;
  notes?: string;
  display_order?: number;
}
