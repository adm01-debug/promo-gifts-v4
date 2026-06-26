/**
 * Integração do botão "Selecionar" na barra de chips de /orcamentos.
 *
 * Cobertura:
 * 1. Clique dispara `quotes:toggle-select-all`.
 * 2. Quando `quotes:selection-changed` chega com count > 0, o botão
 *    troca para "Cancelar seleção (N)" e ganha estado visual ativo
 *    (`aria-pressed="true"` + `data-selected="true"`).
 * 3. Voltando para count=0, restaura o label e o estado.
 *
 * Estratégia: renderizamos um harness mínimo com os mesmos handlers
 * que a página usa, evitando montar toda a QuotesListPage (que depende
 * de Supabase, react-router e react-query).
 */
import { describe, it, expect, vi } from 'vitest';
import { useEffect, useState } from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { Button } from '@/components/ui/button';
import { QuotesStatusChips } from '@/components/quotes/QuotesStatusChips';

function Harness() {
  const [selectedCount, setSelectedCount] = useState(0);
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ count?: number }>).detail;
      setSelectedCount(detail?.count ?? 0);
    };
    window.addEventListener('quotes:selection-changed', handler);
    return () => window.removeEventListener('quotes:selection-changed', handler);
  }, []);
  const hasSelection = selectedCount > 0;
  return (
    <QuotesStatusChips
      quotes={[]}
      value="all"
      onChange={() => {}}
      rightSlot={
        <Button
          type="button"
          variant={hasSelection ? 'default' : 'outline'}
          size="sm"
          data-testid="quotes-select-toggle"
          data-selected={hasSelection ? 'true' : 'false'}
          aria-pressed={hasSelection}
          onClick={() =>
            window.dispatchEvent(new CustomEvent('quotes:toggle-select-all'))
          }
        >
          {hasSelection ? `Cancelar seleção (${selectedCount})` : 'Selecionar'}
        </Button>
      }
    />
  );
}

describe('Botão "Selecionar" — integração com QuotesConfigurableList via eventos', () => {
  it('clique dispara o evento global quotes:toggle-select-all', () => {
    const listener = vi.fn();
    window.addEventListener('quotes:toggle-select-all', listener);
    render(<Harness />);
    fireEvent.click(screen.getByTestId('quotes-select-toggle'));
    expect(listener).toHaveBeenCalledTimes(1);
    window.removeEventListener('quotes:toggle-select-all', listener);
  });

  it('troca para "Cancelar seleção (N)" e ativa estado quando há itens selecionados', () => {
    render(<Harness />);
    const btn = screen.getByTestId('quotes-select-toggle');

    // estado inicial: sem seleção
    expect(btn).toHaveTextContent('Selecionar');
    expect(btn).toHaveAttribute('aria-pressed', 'false');
    expect(btn).toHaveAttribute('data-selected', 'false');

    // QuotesConfigurableList emitiu selection-changed com 3 itens
    act(() => {
      window.dispatchEvent(
        new CustomEvent('quotes:selection-changed', { detail: { count: 3 } }),
      );
    });

    expect(btn).toHaveTextContent('Cancelar seleção (3)');
    expect(btn).toHaveAttribute('aria-pressed', 'true');
    expect(btn).toHaveAttribute('data-selected', 'true');

    // ao limpar, volta ao estado inicial
    act(() => {
      window.dispatchEvent(
        new CustomEvent('quotes:selection-changed', { detail: { count: 0 } }),
      );
    });
    expect(btn).toHaveTextContent('Selecionar');
    expect(btn).toHaveAttribute('aria-pressed', 'false');
    expect(btn).toHaveAttribute('data-selected', 'false');
  });
});
