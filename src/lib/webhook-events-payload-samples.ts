/**
 * webhook-events-payload-samples — Onda 13 #9
 * Payloads de exemplo para o playground de webhook outbound.
 * Reflete a forma do `data` enviado pelo dispatcher para cada evento do catálogo.
 */
import { ALL_KNOWN_EVENTS } from './webhook-events-catalog';

type SamplePayload = Record<string, unknown>;

const isoNow = () => new Date().toISOString();

const SAMPLES: Record<string, SamplePayload> = {
  // Quotes
  'quote.created': {
    quote_id: '9b0f3e4a-1c2d-4e5f-9a8b-1234567890ab',
    quote_number: 'ORC-25-0001',
    seller_id: '11111111-1111-1111-1111-111111111111',
    client: {
      name: 'Empresa Exemplo Ltda',
      email: 'compras@exemplo.com.br',
      company: 'Exemplo SA',
    },
    subtotal: 12500.0,
    discount: 500.0,
    total: 12000.0,
    items_count: 3,
    created_at: isoNow(),
  },
  'quote.updated': {
    quote_id: '9b0f3e4a-1c2d-4e5f-9a8b-1234567890ab',
    quote_number: 'ORC-25-0001',
    changed_fields: ['items', 'total'],
    new_total: 13200.0,
    updated_at: isoNow(),
  },
  'quote.sent': {
    quote_id: '9b0f3e4a-1c2d-4e5f-9a8b-1234567890ab',
    quote_number: 'ORC-25-0001',
    public_url: 'https://promogifts.com.br/orcamento/abc123',
    sent_to: 'compras@exemplo.com.br',
    sent_at: isoNow(),
  },
  'quote.approved': {
    quote_id: '9b0f3e4a-1c2d-4e5f-9a8b-1234567890ab',
    quote_number: 'ORC-25-0001',
    approved_by: 'compras@exemplo.com.br',
    signature: {
      cpf_cnpj: '12.345.678/0001-99',
      ip: '200.100.50.25',
      user_agent: 'Mozilla/5.0',
      hash: 'sha256:abcdef…',
    },
    approved_at: isoNow(),
  },
  'quote.rejected': {
    quote_id: '9b0f3e4a-1c2d-4e5f-9a8b-1234567890ab',
    quote_number: 'ORC-25-0001',
    reason: 'Preço acima do orçamento',
    rejected_at: isoNow(),
  },
  'quote.expired': {
    quote_id: '9b0f3e4a-1c2d-4e5f-9a8b-1234567890ab',
    quote_number: 'ORC-25-0001',
    expired_at: isoNow(),
  },
  // Orders
  'order.created': {
    order_id: '22222222-2222-2222-2222-222222222222',
    order_number: 'PED-25-0001',
    quote_id: '9b0f3e4a-1c2d-4e5f-9a8b-1234567890ab',
    total: 12000.0,
    seller_id: '11111111-1111-1111-1111-111111111111',
    created_at: isoNow(),
  },
  'order.approved': {
    order_id: '22222222-2222-2222-2222-222222222222',
    order_number: 'PED-25-0001',
    approved_by: '33333333-3333-3333-3333-333333333333',
    approved_at: isoNow(),
  },
  'order.fulfilled': {
    order_id: '22222222-2222-2222-2222-222222222222',
    order_number: 'PED-25-0001',
    tracking_number: 'BR123456789',
    fulfilled_at: isoNow(),
  },
  'order.cancelled': {
    order_id: '22222222-2222-2222-2222-222222222222',
    order_number: 'PED-25-0001',
    reason: 'Solicitação do cliente',
    cancelled_at: isoNow(),
  },
  // Discounts
  'discount.requested': {
    request_id: '44444444-4444-4444-4444-444444444444',
    quote_id: '9b0f3e4a-1c2d-4e5f-9a8b-1234567890ab',
    seller_id: '11111111-1111-1111-1111-111111111111',
    requested_percent: 18.5,
    max_allowed_percent: 12.0,
    requested_at: isoNow(),
  },
  'discount.approved': {
    request_id: '44444444-4444-4444-4444-444444444444',
    quote_id: '9b0f3e4a-1c2d-4e5f-9a8b-1234567890ab',
    admin_id: '33333333-3333-3333-3333-333333333333',
    approved_percent: 18.5,
    notes: 'Cliente recorrente',
    approved_at: isoNow(),
  },
  'discount.rejected': {
    request_id: '44444444-4444-4444-4444-444444444444',
    quote_id: '9b0f3e4a-1c2d-4e5f-9a8b-1234567890ab',
    admin_id: '33333333-3333-3333-3333-333333333333',
    notes: 'Margem insuficiente',
    rejected_at: isoNow(),
  },
  // Kits
  'kit.created': {
    kit_id: '55555555-5555-5555-5555-555555555555',
    name: 'Kit Boas-Vindas Premium',
    items_count: 4,
    total_price: 350.0,
    created_at: isoNow(),
  },
  'kit.shared': {
    kit_id: '55555555-5555-5555-5555-555555555555',
    share_token: 'abc123def456',
    public_url: 'https://promogifts.com.br/kit/abc123def456',
    client_email: 'rh@exemplo.com.br',
    shared_at: isoNow(),
  },
  'kit.viewed': {
    kit_id: '55555555-5555-5555-5555-555555555555',
    share_token: 'abc123def456',
    viewed_at: isoNow(),
    viewer_ip: '200.100.50.25',
  },
};

export function getEventSamplePayload(eventKey: string): SamplePayload {
  return (
    SAMPLES[eventKey] ?? {
      _note:
        'Evento sem payload de exemplo. O dispatcher entregará o `data` fornecido pelo trigger original.',
      event: eventKey,
      timestamp: isoNow(),
    }
  );
}

export function listSampledEvents(): string[] {
  return ALL_KNOWN_EVENTS.filter((e) => e in SAMPLES);
}
