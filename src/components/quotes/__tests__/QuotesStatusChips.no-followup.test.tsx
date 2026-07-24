/**
 * Regressão: garante que nenhum chip/label/aria do QuotesStatusChips
 * contém termos relacionados a "follow-up". A feature backend
 * `quote-followup-reminders` continua viva, mas o termo está banido da UI.
 *
 * Guard complementar ao `scripts/check-no-followup-frontend.mjs` (estático),
 * cobrindo o resultado renderizado pelo React.
 */
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { QuotesStatusChips } from '@/components/quotes/QuotesStatusChips';
import type { Quote } from '@/hooks/quotes';

const FORBIDDEN = /follow[-_ ]?up|followup|needsFollowUp/i;

function q(overrides: Partial<Quote> = {}): Quote {
  return {
    id: Math.random().toString(36).slice(2),
    quote_number: 'ORC-2026-0001',
    client_id: null,
    contact_id: null,
    client_name: 'X',
    client_email: null,
    client_phone: null,
    client_company: null,
    seller_id: null,
    status: 'pending',
    payment_method: null,
    subtotal: null,
    discount_percent: null,
    discount_amount: null,
    total: 100,
    valid_until: null,
    payment_terms: null,
    delivery_time: null,
    shipping_type: null,
    shipping_cost: null,
    notes: null,
    internal_notes: null,
    bitrix_deal_id: null,
    bitrix_quote_id: null,
    synced_to_bitrix: true,
    synced_at: null,
    client_response: null,
    client_response_at: null,
    client_response_notes: null,
    created_at: '2026-06-01T00:00:00Z',
    updated_at: '2026-06-01T00:00:00Z',
    sent_at: null,
    ...overrides,
  } as Quote;
}

describe('QuotesStatusChips — guard de follow-up na UI', () => {
  it('nenhum chip renderiza rótulo, aria-label ou title com follow-up', () => {
    const sample: Quote[] = [
      q({ status: 'draft' }),
      q({ status: 'pending', synced_to_bitrix: false }),
      q({ status: 'pending', synced_to_bitrix: true }),
      q({ status: 'expired' }),
    ];
    const { container } = render(
      <QuotesStatusChips quotes={sample} value="all" onChange={() => {}} />,
    );

    const buttons = container.querySelectorAll('button');
    expect(buttons.length).toBeGreaterThan(0);

    for (const btn of Array.from(buttons)) {
      expect(btn.textContent || '').not.toMatch(FORBIDDEN);
      expect(btn.getAttribute('aria-label') || '').not.toMatch(FORBIDDEN);
      expect(btn.getAttribute('title') || '').not.toMatch(FORBIDDEN);
    }
  });

  it('rótulo canônico "Criado/Sincronizado" continua presente', () => {
    const { container } = render(
      <QuotesStatusChips
        quotes={[q({ status: 'pending', synced_to_bitrix: true })]}
        value="all"
        onChange={() => {}}
      />,
    );
    expect(container.textContent).toContain('Criado/Sincronizado');
  });
});
