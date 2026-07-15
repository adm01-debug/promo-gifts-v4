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
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useState } from 'react';
import { render, screen, act, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TooltipProvider } from '@/components/ui/tooltip';
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

function renderList(
  props: Partial<React.ComponentProps<typeof QuotesConfigurableList>> = {},
) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <TooltipProvider>
          <QuotesConfigurableList
            quotes={quotes}
            onDelete={vi.fn()}
            onBulkDelete={vi.fn()}
            onDuplicate={vi.fn()}
            {...props}
          />
        </TooltipProvider>
      </MemoryRouter>
    </QueryClientProvider>,
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

  it('ativar modo via evento mostra checkboxes sem marcar nada e sem dica', () => {
    renderList();
    act(() => {
      window.dispatchEvent(new CustomEvent('quotes:toggle-select-all'));
    });

    // checkboxes agora visíveis (header + 2 linhas)
    const boxes = screen.getAllByRole('checkbox');
    expect(boxes.length).toBeGreaterThanOrEqual(3);
    // nenhum marcado
    boxes.forEach((b) => expect(b).not.toBeChecked());
    // dica REMOVIDA — nunca deve aparecer
    expect(screen.queryByTestId('quotes-selection-hint')).toBeNull();
  });

  it('clique manual em uma linha emite count=1, mode=true', async () => {
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

  it('NÃO renderiza BulkActionsBar (ações ficam no topo, em rightSlot dos chips)', () => {
    renderList();
    act(() => {
      window.dispatchEvent(new CustomEvent('quotes:toggle-select-all'));
    });
    // Sem botão "Excluir" inferior — a única ação de exclusão em massa vive no
    // topo, dentro do QuotesListPage (quotes-bulk-delete-top).
    expect(screen.queryByRole('button', { name: /^Excluir$/i })).toBeNull();
  });

  it('evento quotes:bulk-delete-request dispara onBulkDelete com IDs selecionados e limpa seleção', async () => {
    const user = userEvent.setup();
    const onBulkDelete = vi.fn();
    renderList({ onBulkDelete });

    act(() => {
      window.dispatchEvent(new CustomEvent('quotes:toggle-select-all'));
    });

    const rowCheckbox = screen.getAllByRole('checkbox', { name: /selecionar orçamento/i })[0];
    await user.click(rowCheckbox);

    act(() => {
      window.dispatchEvent(new CustomEvent('quotes:bulk-delete-request'));
    });

    expect(onBulkDelete).toHaveBeenCalledTimes(1);
    expect(onBulkDelete).toHaveBeenCalledWith(['q-1']);
  });

  it('quotes:bulk-delete-request sem seleção é no-op', () => {
    const onBulkDelete = vi.fn();
    renderList({ onBulkDelete });
    act(() => {
      window.dispatchEvent(new CustomEvent('quotes:bulk-delete-request'));
    });
    expect(onBulkDelete).not.toHaveBeenCalled();
  });
});


describe('QuotesConfigurableList — infinite scroll', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  function makeQuotes(n: number): Quote[] {
    return Array.from({ length: n }, (_, i) => ({
      id: `q-${i + 1}`,
      quote_number: `ORC-${String(i + 1).padStart(3, '0')}`,
      client_name: `Cliente ${i + 1}`,
      client_company: `Empresa ${i + 1}`,
      status: 'pending',
      total: 100 + i,
      created_at: '2026-01-01T00:00:00Z',
    }) as Quote);
  }

  function renderWith(qs: Quote[]) {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 } },
    });
    return render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <TooltipProvider>
            <QuotesConfigurableList
              quotes={qs}
              onDelete={vi.fn()}
              onBulkDelete={vi.fn()}
              onDuplicate={vi.fn()}
            />
          </TooltipProvider>
        </MemoryRouter>
      </QueryClientProvider>,
    );
  }

  // ── IntersectionObserver mock — captura observers ativos para acionar manualmente ──
  type IOMockEntry = {
    observer: IntersectionObserver;
    callback: IntersectionObserverCallback;
    target: Element;
  };
  let ioEntries: IOMockEntry[] = [];

  beforeEach(() => {
    ioEntries = [];
    class MockIO {
      callback: IntersectionObserverCallback;
      constructor(cb: IntersectionObserverCallback) {
        this.callback = cb;
      }
      observe(target: Element) {
        ioEntries.push({ observer: this as unknown as IntersectionObserver, callback: this.callback, target });
      }
      disconnect() {
        ioEntries = ioEntries.filter((e) => e.observer !== (this as unknown as IntersectionObserver));
      }
      unobserve() { /* noop */ }
      takeRecords() { return []; }
      root: Element | null = null;
      rootMargin = '';
      thresholds: ReadonlyArray<number> = [];
    }
    (globalThis as unknown as { IntersectionObserver: typeof IntersectionObserver }).IntersectionObserver =
      MockIO as unknown as typeof IntersectionObserver;
  });

  afterEach(() => {
    ioEntries = [];
  });

  function triggerIntersection() {
    act(() => {
      ioEntries.forEach(({ callback, observer, target }) => {
        callback(
          [{ isIntersecting: true, target } as unknown as IntersectionObserverEntry],
          observer,
        );
      });
    });
  }

  it('mostra apenas 25 inicialmente e carrega mais quando o sentinel intersecta', () => {
    const qs = makeQuotes(60);
    renderWith(qs);

    expect(screen.getByTestId('quotes-footer-count').textContent).toMatch(
      /Exibindo 25 de 60/,
    );
    expect(screen.getByTestId('quotes-infinite-sentinel')).toBeInTheDocument();

    triggerIntersection();
    expect(screen.getByTestId('quotes-footer-count').textContent).toMatch(
      /Exibindo 50 de 60/,
    );

    triggerIntersection();
    // No fim da lista, o rodapé não exibe mais contagem ("X de Y — fim da lista" removido).
    expect(screen.getByTestId('quotes-footer-count').textContent?.trim()).toBe('');
    // Sentinel removido quando não há mais o que carregar
    expect(screen.queryByTestId('quotes-infinite-sentinel')).toBeNull();
  });

  it('renderiza estado vazio com botão de atualizar', () => {
    renderWith([]);
    expect(screen.getByTestId('quotes-empty-state')).toBeInTheDocument();

    const refreshSpy = vi.fn();
    window.addEventListener('quotes:refresh-request', refreshSpy);
    screen.getByTestId('quotes-empty-refresh').click();
    expect(refreshSpy).toHaveBeenCalledTimes(1);
    window.removeEventListener('quotes:refresh-request', refreshSpy);
  });

  it('deduplica orçamentos repetidos por id (combinação de páginas)', () => {
    const base = makeQuotes(5);
    // Duplica os 2 primeiros para simular concatenação repetida do backend
    const withDups = [...base, base[0], base[1]];
    renderWith(withDups);

    // Deve refletir 5 únicos (não 7) — sem chaves duplicadas no React.
    // Lista ≤25 já chega no fim → rodapé vazio; validamos pelas linhas renderizadas.
    expect(screen.getByTestId('quotes-footer-count').textContent?.trim()).toBe('');
    expect(screen.getAllByTestId(/^quote-row-more-/).length).toBe(5);
  });

  it('reseta para 25 ao alterar filtro/busca/ordenação sem repetir resultados', () => {
    // Wrapper que troca a lista externa (simula filtros/busca/sort do hook pai)
    function Harness() {
      const [filtered, setFiltered] = useState<Quote[]>(makeQuotes(60));
      return (
        <>
          <button
            data-testid="apply-filter"
            onClick={() => setFiltered(makeQuotes(40))}
          >
            filtrar
          </button>
          <button
            data-testid="apply-sort"
            onClick={() => setFiltered((prev) => [...prev].reverse())}
          >
            ordenar
          </button>
          <QuotesConfigurableList
            quotes={filtered}
            onDelete={vi.fn()}
            onBulkDelete={vi.fn()}
            onDuplicate={vi.fn()}
          />
        </>
      );
    }

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 } },
    });
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <TooltipProvider>
            <Harness />
          </TooltipProvider>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    // Estado inicial: Exibindo 25 de 60
    expect(screen.getByTestId('quotes-footer-count').textContent).toMatch(/Exibindo 25 de 60/);

    // Avança o infinite scroll até o fim → rodapé fica vazio.
    triggerIntersection();
    triggerIntersection();
    expect(screen.getByTestId('quotes-footer-count').textContent?.trim()).toBe('');

    // Troca de filtro → deve resetar para 25 do novo total (40)
    act(() => {
      screen.getByTestId('apply-filter').click();
    });
    expect(screen.getByTestId('quotes-footer-count').textContent).toMatch(/Exibindo 25 de 40/);

    // Avança até o fim novamente → rodapé vazio
    triggerIntersection();
    expect(screen.getByTestId('quotes-footer-count').textContent?.trim()).toBe('');
    // Nenhuma key duplicada: número de linhas renderizadas == 40
    expect(
      screen.getAllByTestId(/^quote-row-more-/).length,
    ).toBe(40);

    // Troca de ordenação → reseta para 25 sem repetir
    act(() => {
      screen.getByTestId('apply-sort').click();
    });
    expect(screen.getByTestId('quotes-footer-count').textContent).toMatch(/Exibindo 25 de 40/);
    expect(
      screen.getAllByTestId(/^quote-row-more-/).length,
    ).toBe(25);
  });

  it('exibe indicador de "Carregando mais…" quando isFetching=true e há itens', () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 } },
    });
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <TooltipProvider>
            <QuotesConfigurableList
              quotes={makeQuotes(30)}
              isFetching
              onDelete={vi.fn()}
              onBulkDelete={vi.fn()}
              onDuplicate={vi.fn()}
            />
          </TooltipProvider>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(screen.getByTestId('quotes-footer-loading-more')).toBeInTheDocument();
  });

  it('exibe erro com botão "Tentar novamente" e dispara onRetry', async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 } },
    });
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <TooltipProvider>
            <QuotesConfigurableList
              quotes={makeQuotes(3)}
              loadError="Falha de rede"
              onRetry={onRetry}
              onDelete={vi.fn()}
              onBulkDelete={vi.fn()}
              onDuplicate={vi.fn()}
            />
          </TooltipProvider>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(screen.getByTestId('quotes-footer-load-error')).toBeInTheDocument();
    await user.click(screen.getByTestId('quotes-footer-retry'));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});


// Suprimi warning sobre `within` não usado mantendo o import: removo se lint reclamar.
void within;

