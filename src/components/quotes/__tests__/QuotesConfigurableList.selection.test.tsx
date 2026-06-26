/**
 * Integração: seleção manual em QuotesConfigurableList.
 *
 * Garante o contrato exigido pelo PO:
 *  - Checkboxes (círculos de seleção) NÃO aparecem antes de ligar o modo.
 *  - Disparar `quotes:toggle-select-all` ativa o modo SEM marcar nada.
 *  - Marcar uma linha individual incrementa count e dispara
 *    `quotes:selection-changed` com { count: 1, mode: true }.
 *  - A dica orientativa some quando há ao menos 1 selecionado.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QuotesConfigurableList } from '@/components/quotes/QuotesConfigurableList';
import type { Quote } from '@/hooks/quotes';

const quotes: Quote[] = [
  {
    id: 'q-1',
    quote_number: 'ORC-001',
    client_name: 'Cliente Um',
    client_company: 'Empresa A',
    status: 'pending',
    total: 100,
    created_at: '2026-01-01T00:00:00Z',
  } as Quote,
  {
    id: 'q-2',
    quote_number: 'ORC-002',
    client_name: 'Cliente Dois',
    client_company: 'Empresa B',
    status: 'pending',
    total: 200,
    created_at: '2026-01-02T00:00:00Z',
  } as Quote,
];

function renderList() {
  return render(
    <MemoryRouter>
      <QuotesConfigurableList
        quotes={quotes}
        onDelete={vi.fn()}
        onBulkDelete={vi.fn()}
        onDuplicate={vi.fn()}
      />
    </MemoryRouter>,
  );
}

describe('QuotesConfigurableList — seleção manual', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('não renderiza checkboxes antes do modo Selecionar', () => {
    renderList();
    expect(screen.queryByRole('checkbox', { name: /selecionar/i })).toBeNull();
    expect(screen.queryByTestId('quotes-selection-hint')).toBeNull();
  });

  it('ativar modo via evento mostra checkboxes + dica, sem marcar nada', () => {
    renderList();
    act(() => {
      window.dispatchEvent(new CustomEvent('quotes:toggle-select-all'));
    });

    // checkboxes agora visíveis (header + 2 linhas)
    const boxes = screen.getAllByRole('checkbox');
    expect(boxes.length).toBeGreaterThanOrEqual(3);
    // nenhum marcado
    boxes.forEach((b) => expect(b).not.toBeChecked());
    // dica visível
    expect(screen.getByTestId('quotes-selection-hint')).toBeInTheDocument();
  });

  it('clique manual em uma linha emite count=1, mode=true e esconde a dica', async () => {
    const user = userEvent.setup();
    const events: Array<{ count?: number; mode?: boolean }> = [];
    const listener = (e: Event) => {
      events.push((e as CustomEvent<{ count?: number; mode?: boolean }>).detail);
    };
    window.addEventListener('quotes:selection-changed', listener);

    renderList();
    act(() => {
      window.dispatchEvent(new CustomEvent('quotes:toggle-select-all'));
    });

    // pega o checkbox da PRIMEIRA linha (header é o índice 0)
    const rowCheckbox = screen.getAllByRole('checkbox', { name: /selecionar orçamento/i })[0];
    await user.click(rowCheckbox);

    const last = events[events.length - 1];
    expect(last).toEqual({ count: 1, mode: true });

    // dica some quando há seleção
    expect(screen.queryByTestId('quotes-selection-hint')).toBeNull();

    window.removeEventListener('quotes:selection-changed', listener);
  });

  it('persiste selectionMode em sessionStorage', () => {
    const { unmount } = renderList();
    act(() => {
      window.dispatchEvent(new CustomEvent('quotes:toggle-select-all'));
    });
    unmount();

    const raw = sessionStorage.getItem('quotes:selection-state:v1');
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw!);
    expect(parsed.mode).toBe(true);

    // re-monta: modo continua ativo (checkboxes visíveis sem novo evento)
    renderList();
    expect(screen.getAllByRole('checkbox').length).toBeGreaterThanOrEqual(3);
  });
});

// Suprimi warning sobre `within` não usado mantendo o import: removo se lint reclamar.
void within;
