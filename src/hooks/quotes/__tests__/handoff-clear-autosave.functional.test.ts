/**
 * Regressão BUG-CART-HANDOFF (2026-07)
 *
 * Cenário reproduzido:
 *   1) Existe um rascunho antigo em localStorage['quote_builder_autosave']
 *      (cliente "Sicoob", itens antigos).
 *   2) Usuário clica em "Orçamento" num carrinho → o QuoteBuilder aplica
 *      setClientId+setItems vindos do carrinho ("123 Solar").
 *   3) O useAutoSaveQuote fica enabled=true e restaura o rascunho antigo,
 *      sobrescrevendo o cliente vindo do carrinho.
 *
 * Fix garantido aqui: se o handoff chamar `clearAutoSave()` ANTES de o
 * `useAutoSaveQuote` habilitar, o onRestore não encontra dados e o
 * cliente/itens do carrinho permanecem.
 *
 * Este teste opera diretamente sobre `useAutoSaveQuote` (o SSOT do
 * autosave) porque montar o `useQuoteBuilderState` completo puxa dezenas
 * de hooks e queries — o comportamento crítico está isolado aqui.
 */
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useAutoSaveQuote } from '../useAutoSaveQuote';

vi.mock('@/lib/logger', () => ({
  logger: { debug: vi.fn(), warn: vi.fn(), error: vi.fn(), info: vi.fn(), log: vi.fn() },
}));

const store: Record<string, string> = {};
const localStorageMock = {
  getItem: vi.fn((k: string) => store[k] ?? null),
  setItem: vi.fn((k: string, v: string) => {
    store[k] = v;
  }),
  removeItem: vi.fn((k: string) => {
    delete store[k];
  }),
  clear: vi.fn(() => {
    Object.keys(store).forEach((k) => delete store[k]);
  }),
};
Object.defineProperty(globalThis, 'localStorage', {
  value: localStorageMock,
  writable: true,
});

beforeEach(() => {
  vi.clearAllMocks();
  localStorageMock.clear();
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('BUG-CART-HANDOFF — autosave NÃO sobrescreve dados do carrinho', () => {
  it('handoff que chama clearAutoSave() antes de habilitar → onRestore não roda', () => {
    // Rascunho antigo: cliente "Sicoob" com 5 itens.
    const staleDraft = {
      clientId: 'sicoob-uuid',
      items: [{ product_id: 'p-old', quantity: 5 }],
    };
    store.quote_builder_autosave = JSON.stringify({
      version: 2,
      data: staleDraft,
      savedAt: '2026-06-01T00:00:00.000Z',
    });

    const onRestore = vi.fn();

    // Fase 1: hook monta com enabled=false (clientId vazio, items=[]).
    // Nenhum restore acontece.
    const { rerender } = renderHook(
      ({ enabled }: { enabled: boolean }) =>
        useAutoSaveQuote({ enabled, data: {}, onRestore }),
      { initialProps: { enabled: false } },
    );
    expect(onRestore).not.toHaveBeenCalled();

    // Fase 2: handoff do carrinho chama clearAutoSave() ANTES do setClientId/setItems.
    // Simulamos removendo a chave diretamente (o que clearAutoSave() faz).
    localStorageMock.removeItem('quote_builder_autosave');
    expect(store.quote_builder_autosave).toBeUndefined();

    // Fase 3: setClientId+setItems fazem o autosave habilitar. O efeito
    // de restore roda AGORA, mas o localStorage já está vazio.
    rerender({ enabled: true });

    expect(onRestore).not.toHaveBeenCalled();
  });

  it('SEM clearAutoSave() no handoff, o rascunho antigo é restaurado (comportamento do bug)', () => {
    // Regressão inversa: garante que o teste acima é significativo.
    // Se este passa, é porque a proteção realmente importa.
    const staleDraft = { clientId: 'sicoob-uuid', items: [{ product_id: 'p-old' }] };
    store.quote_builder_autosave = JSON.stringify({
      version: 2,
      data: staleDraft,
      savedAt: '2026-06-01T00:00:00.000Z',
    });

    const onRestore = vi.fn();
    const { rerender } = renderHook(
      ({ enabled }: { enabled: boolean }) =>
        useAutoSaveQuote({ enabled, data: {}, onRestore }),
      { initialProps: { enabled: false } },
    );
    expect(onRestore).not.toHaveBeenCalled();

    // Handoff "quebrado": não limpa o autosave antes de habilitar.
    rerender({ enabled: true });

    // Rascunho antigo é aplicado → é EXATAMENTE o bug que corrigimos.
    expect(onRestore).toHaveBeenCalledTimes(1);
    expect(onRestore).toHaveBeenCalledWith(staleDraft);
  });

  it('clearAutoSave retornado pelo hook remove a chave correta do localStorage', () => {
    store.quote_builder_autosave = JSON.stringify({ version: 2, data: {}, savedAt: '' });

    const { result } = renderHook(() =>
      useAutoSaveQuote({ enabled: false, data: {} }),
    );

    expect(store.quote_builder_autosave).toBeDefined();
    act(() => {
      result.current.clearAutoSave();
    });
    expect(store.quote_builder_autosave).toBeUndefined();
    expect(localStorageMock.removeItem).toHaveBeenCalledWith('quote_builder_autosave');
  });
});
