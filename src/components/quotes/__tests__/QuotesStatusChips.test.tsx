/**
 * Integração do componente QuotesStatusChips:
 * - Clique em cada chip dispara onChange com a key correta.
 * - "Todos" permanece sempre visível, mesmo com lista vazia.
 * - Chips com contagem 0 ficam ocultos quando inativos, mas reaparecem
 *   quando ativos (para o usuário poder voltar para "all" sem perder estado).
 * - Contagens refletem o fallback de synced_to_bitrix null/undefined.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QuotesStatusChips } from '@/components/quotes/QuotesStatusChips';
import type { Quote } from '@/hooks/quotes';

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
    synced_to_bitrix: false,
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

describe('QuotesStatusChips', () => {
  const sample: Quote[] = [
    q({ id: 'a', status: 'draft' }),
    q({ id: 'b', status: 'pending', synced_to_bitrix: false }),
    q({ id: 'c', status: 'pending', synced_to_bitrix: true }),
    q({ id: 'd', status: 'expired' }),
    // legado: null deve cair em "não sincronizado"
    q({ id: 'e', status: 'pending', synced_to_bitrix: null }),
  ];

  it('renderiza chips esperados com contagem correta (com fallback null)', () => {
    render(<QuotesStatusChips quotes={sample} value="all" onChange={() => {}} />);
    expect(screen.getByRole('button', { name: /Todos/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Rascunho/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Criado \(Não Sincronizado\)/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Criado\/Sincronizado/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Expirado/ })).toBeInTheDocument();
  });

  it('clicar em cada chip dispara onChange com a key correta', () => {
    const onChange = vi.fn();
    render(<QuotesStatusChips quotes={sample} value="all" onChange={onChange} />);

    fireEvent.click(screen.getByRole('button', { name: /Rascunho/ }));
    fireEvent.click(screen.getByRole('button', { name: /Criado \(Não Sincronizado\)/ }));
    fireEvent.click(screen.getByRole('button', { name: /Criado\/Sincronizado/ }));
    fireEvent.click(screen.getByRole('button', { name: /Expirado/ }));
    fireEvent.click(screen.getByRole('button', { name: /Todos/ }));

    expect(onChange.mock.calls.map((c) => c[0])).toEqual([
      'draft',
      'unsynced',
      'created_synced',
      'expired',
      'all',
    ]);
  });

  it('"Todos" continua visível mesmo com lista vazia', () => {
    render(<QuotesStatusChips quotes={[]} value="all" onChange={() => {}} />);
    expect(screen.getByRole('button', { name: /Todos/ })).toBeInTheDocument();
    // chips com count 0 ficam ocultos quando não ativos
    expect(screen.queryByRole('button', { name: /Rascunho/ })).not.toBeInTheDocument();
  });

  it('chip com count 0 fica oculto quando inativo, mas visível quando ativo (permite reset)', () => {
    const noDrafts = sample.filter((s) => s.status !== 'draft');
    const { rerender } = render(
      <QuotesStatusChips quotes={noDrafts} value="all" onChange={() => {}} />,
    );
    expect(screen.queryByRole('button', { name: /Rascunho/ })).not.toBeInTheDocument();

    // se por algum motivo o filtro estiver em 'draft' com 0 resultados,
    // o chip deve permanecer visível para o usuário poder clicar em "Todos"
    rerender(<QuotesStatusChips quotes={noDrafts} value="draft" onChange={() => {}} />);
    expect(screen.getByRole('button', { name: /Rascunho/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Todos/ })).toBeInTheDocument();
  });

  it('contagem de "Criado/Sincronizado" ignora null/undefined (fallback de dados legados)', () => {
    render(<QuotesStatusChips quotes={sample} value="all" onChange={() => {}} />);
    // Apenas 'c' tem synced_to_bitrix === true e status pending
    const createdSyncedBtn = screen.getByRole('button', { name: /Criado\/Sincronizado/ });
    expect(createdSyncedBtn.textContent).toBe('Criado/Sincronizado1');

    // 'Criado (Não Sincronizado)' = pending && !synced → b + e = 2
    const unsyncedBtn = screen.getByRole('button', { name: /Criado \(Não Sincronizado\)/ });
    expect(unsyncedBtn.textContent).toBe('Criado (Não Sincronizado)2');

    // ARIA label inclui contagem pluralizada
    expect(createdSyncedBtn).toHaveAttribute('aria-label', 'Criado/Sincronizado, 1 orçamento');
  });


  it('renderiza rightSlot à direita da barra (fora do toolbar de chips)', () => {
    render(
      <QuotesStatusChips
        quotes={sample}
        value="all"
        onChange={() => {}}
        rightSlot={<button data-testid="my-right-slot">Selecionar</button>}
      />,
    );
    const slot = screen.getByTestId('my-right-slot');
    expect(slot).toBeInTheDocument();
    const toolbar = screen.getByRole('toolbar', {
      name: /Filtrar orçamentos por status/i,
    });
    expect(toolbar.contains(slot)).toBe(false);
  });

  it('não renderiza container do rightSlot quando prop não é passada', () => {
    const { container } = render(
      <QuotesStatusChips quotes={sample} value="all" onChange={() => {}} />,
    );
    const flexRow = container.querySelector('.flex.items-center.gap-2');
    expect(flexRow?.children.length).toBe(1);
  });
});
