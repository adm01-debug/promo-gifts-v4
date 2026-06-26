/**
 * Integração do botão "Selecionar" na barra de chips de /orcamentos.
 *
 * Cobertura:
 * 1. Clique dispara `quotes:toggle-select-all` (sem payload).
 * 2. Quando `quotes:selection-changed` chega com mode=true (sem itens),
 *    o botão já vai para "Cancelar seleção" (sem N) — nada é auto-selecionado.
 * 3. Quando o usuário marca manualmente N itens (count>0 + mode=true), o
 *    label vira "Cancelar seleção (N)" e o estado visual fica ativo.
 * 4. Voltando para mode=false, o label volta para "Selecionar".
 *
 * Harness mínimo: replica os handlers de QuotesListPage sem montar a página
 * inteira (que depende de Supabase, react-router e react-query).
 */
import { describe, it, expect, vi } from 'vitest';
import { useEffect, useState } from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { Button } from '@/components/ui/button';
import { QuotesStatusChips } from '@/components/quotes/QuotesStatusChips';

function Harness() {
  const [selectedCount, setSelectedCount] = useState(0);
  const [selectionMode, setSelectionMode] = useState(false);
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ count?: number; mode?: boolean }>).detail;
      setSelectedCount(detail?.count ?? 0);
      if (typeof detail?.mode === 'boolean') setSelectionMode(detail.mode);
    };
    window.addEventListener('quotes:selection-changed', handler);
    return () => window.removeEventListener('quotes:selection-changed', handler);
  }, []);
  const hasSelection = selectionMode;
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
          onClick={() => window.dispatchEvent(new CustomEvent('quotes:toggle-select-all'))}
        >
          {hasSelection
            ? selectedCount > 0
              ? `Cancelar seleção (${selectedCount})`
              : 'Cancelar seleção'
            : 'Selecionar'}
        </Button>
      }
    />
  );
}

describe('Botão "Selecionar" — payload { count, mode } + alternância sem seleção automática', () => {
  it('clique dispara o evento global quotes:toggle-select-all sem payload', () => {
    const listener = vi.fn();
    window.addEventListener('quotes:toggle-select-all', listener);
    render(<Harness />);
    fireEvent.click(screen.getByTestId('quotes-select-toggle'));
    expect(listener).toHaveBeenCalledTimes(1);
    const ev = listener.mock.calls[0][0] as CustomEvent;
    // Não envia payload — quem decide o próximo modo é o List (toggle).
    expect(ev.detail ?? null).toBeNull();
    window.removeEventListener('quotes:toggle-select-all', listener);
  });

  it('mode=true SEM seleção → label "Cancelar seleção" e estado ativo (não auto-seleciona)', () => {
    render(<Harness />);
    const btn = screen.getByTestId('quotes-select-toggle');

    expect(btn).toHaveTextContent('Selecionar');
    expect(btn).toHaveAttribute('aria-pressed', 'false');

    act(() => {
      window.dispatchEvent(
        new CustomEvent('quotes:selection-changed', { detail: { count: 0, mode: true } }),
      );
    });

    expect(btn).toHaveTextContent('Cancelar seleção');
    expect(btn).not.toHaveTextContent('(0)');
    expect(btn).toHaveAttribute('aria-pressed', 'true');
    expect(btn).toHaveAttribute('data-selected', 'true');
  });

  it('seleção manual de N itens → label "Cancelar seleção (N)"', () => {
    render(<Harness />);
    const btn = screen.getByTestId('quotes-select-toggle');

    // usuário liga o modo
    act(() => {
      window.dispatchEvent(
        new CustomEvent('quotes:selection-changed', { detail: { count: 0, mode: true } }),
      );
    });
    expect(btn).toHaveTextContent('Cancelar seleção');

    // usuário marca 2 itens manualmente
    act(() => {
      window.dispatchEvent(
        new CustomEvent('quotes:selection-changed', { detail: { count: 2, mode: true } }),
      );
    });
    expect(btn).toHaveTextContent('Cancelar seleção (2)');
    expect(btn).toHaveAttribute('aria-pressed', 'true');
  });

  it('desligar modo → label volta para "Selecionar"', () => {
    render(<Harness />);
    const btn = screen.getByTestId('quotes-select-toggle');

    act(() => {
      window.dispatchEvent(
        new CustomEvent('quotes:selection-changed', { detail: { count: 3, mode: true } }),
      );
    });
    expect(btn).toHaveTextContent('Cancelar seleção (3)');

    act(() => {
      window.dispatchEvent(
        new CustomEvent('quotes:selection-changed', { detail: { count: 0, mode: false } }),
      );
    });
    expect(btn).toHaveTextContent('Selecionar');
    expect(btn).toHaveAttribute('aria-pressed', 'false');
    expect(btn).toHaveAttribute('data-selected', 'false');
  });
});
