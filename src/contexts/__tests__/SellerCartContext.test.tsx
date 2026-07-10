/**
 * SellerCartContext — contrato pós-faxina de action history
 *
 * Garante que:
 *  1) O módulo NÃO importa mais nenhum helper de action history
 *     (`clearActionHistory` / `recordAction` / `getActionHistory`)
 *     nem nenhum painel removido (`SmartSuggestions`, `ActionHistoryPanel`,
 *     `CartHealthChecklist`). Se algum for reintroduzido por engano —
 *     ex.: regen do Lovable ou merge ruim — este teste quebra antes do
 *     CartSidebar voltar a renderizar UI morta.
 *
 *  2) O `SellerCartProvider` monta e expõe o contexto SEM expor handlers
 *     de histórico de ações no shape público — assim o CartSidebar
 *     continua compilando mesmo sem aqueles handlers.
 *
 *  3) `useSellerCartContextSafe()` retorna `null` fora do provider
 *     (comportamento usado por consumidores que renderizam em Suspense
 *     fallback / HMR) — sanity de que o módulo carrega sem side effects.
 */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Stub leve de useSellerCarts pra não pagar custo de subir TanStack Query +
// supabase real só para validar o shape do contexto.
vi.mock('@/hooks/products/useSellerCarts', () => ({
  useSellerCarts: () => ({
    carts: [],
    isLoading: false,
    totalItems: 0,
    canCreateCart: true,
    createCart: { mutateAsync: vi.fn() },
    deleteCart: { mutate: vi.fn() },
    addItem: { mutateAsync: vi.fn() },
    removeItem: { mutate: vi.fn() },
    updateItemQuantity: { mutate: vi.fn() },
    updateItemNotes: { mutate: vi.fn() },
    updateItemSortOrder: { mutate: vi.fn() },
    updateCartNotes: { mutate: vi.fn() },
    updateCartStatus: { mutate: vi.fn() },
    duplicateCart: { mutate: vi.fn() },
    moveItemToCart: { mutate: vi.fn() },
    duplicateItemToCart: { mutate: vi.fn() },
    clearCart: { mutateAsync: vi.fn() },
    restoreItems: { mutate: vi.fn() },
  }),
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: null }),
}));

const __dirname = dirname(fileURLToPath(import.meta.url));
const SOURCE = readFileSync(
  resolve(__dirname, '../SellerCartContext.tsx'),
  'utf-8',
);

describe('SellerCartContext — contrato sem action history', () => {
  it('NÃO importa nem chama nenhum helper de action history removido', () => {
    const forbidden = [
      'clearActionHistory',
      'recordAction',
      'getActionHistory',
      'SmartSuggestions',
      'ActionHistoryPanel',
      'CartHealthChecklist',
      'SuggestionSkeleton',
    ];
    for (const sym of forbidden) {
      expect(SOURCE).not.toMatch(new RegExp(`\\b${sym}\\b`));
    }
  });

  it('expõe o contrato esperado SEM membros de action history', async () => {
    const { SellerCartProvider, useSellerCartContext } = await import(
      '../SellerCartContext'
    );

    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { result } = renderHook(() => useSellerCartContext(), {
      wrapper: ({ children }) => (
        <QueryClientProvider client={qc}>
          <SellerCartProvider>{children}</SellerCartProvider>
        </QueryClientProvider>
      ),
    });

    // Membros que o CartSidebar e o useSellerCartsPage consomem hoje:
    const required = [
      'carts',
      'activeCart',
      'activeCartId',
      'isLoading',
      'totalItems',
      'canCreateCart',
      'setActiveCartId',
      'createCart',
      'deleteCart',
      'addToActiveCart',
      'removeItem',
      'updateItemQuantity',
      'updateItemNotes',
      'clearCart',
    ] as const;
    for (const key of required) {
      expect(result.current).toHaveProperty(key);
    }

    // Garante que nenhum handler de action history vazou para o shape público.
    // Se reaparecerem, o CartSidebar pode voltar a depender deles indevidamente.
    const ctx = result.current as unknown as Record<string, unknown>;
    expect(ctx.recordAction).toBeUndefined();
    expect(ctx.clearActionHistory).toBeUndefined();
    expect(ctx.getActionHistory).toBeUndefined();
  });

  it('useSellerCartContextSafe() retorna null fora do provider', async () => {
    const { useSellerCartContextSafe } = await import('../SellerCartContext');
    const { result } = renderHook(() => useSellerCartContextSafe());
    expect(result.current).toBeNull();
  });
});
