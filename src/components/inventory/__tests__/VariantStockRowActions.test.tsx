/**
 * Testes de interação para VariantStockRowActions (paridade catálogo no /estoque).
 * Cobre as 8 ações + estados/erros: copiar SKU, carrinho, orçamento, coleção,
 * favoritar, comparar, visualizar, compartilhar.
 */
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

import { TooltipProvider } from '@/components/ui/tooltip';
import { VariantStockRowActions } from '../VariantStockRowActions';
import { useFavoritesStore } from '@/stores/useFavoritesStore';
import { useComparisonStore } from '@/stores/useComparisonStore';
import type { ProductStockSummary, VariantStock } from '@/types/stock';

// ── Mocks de dependências pesadas ───────────────────────────────────────────
vi.mock('@/components/products/QuickAddToQuote', () => ({
  QuickAddToQuote: (props: { productSku?: string }) => (
    <button data-testid="mock-quick-add-to-quote" data-sku={props.productSku}>
      Carrinho
    </button>
  ),
}));

vi.mock('@/components/collections/AddToCollectionModal', () => ({
  AddToCollectionModal: ({
    open,
    productName,
  }: {
    open: boolean;
    productName: string;
    onOpenChange: (v: boolean) => void;
    productId: string;
  }) =>
    open ? (
      <div role="dialog" data-testid="mock-collection-modal">
        Coleção · {productName}
      </div>
    ) : null,
}));

const toastSuccess = vi.fn();
const toastError = vi.fn();
vi.mock('sonner', () => ({
  toast: {
    success: (...a: unknown[]) => toastSuccess(...a),
    error: (...a: unknown[]) => toastError(...a),
  },
}));

// ── Factories ───────────────────────────────────────────────────────────────
const product: ProductStockSummary = {
  productId: 'p-1',
  productName: 'Caneca Personalizada',
  productSku: 'CAN-001',
  productImageUrl: 'https://cdn.test/p-1.jpg',
  totalCurrentStock: 100,
  totalMinStock: 10,
  totalReservedStock: 0,
  totalInTransitStock: 0,
  totalAvailableStock: 100,
  overallStatus: 'in_stock',
  variantsInStock: 1,
  variantsLowStock: 0,
  variantsCritical: 0,
  variantsOutOfStock: 0,
  totalVariants: 1,
  variants: [],
  availableColors: [],
};

const variant: VariantStock = {
  id: 'v-1',
  productId: 'p-1',
  variantId: 'v-1',
  variantSku: 'CAN-001-AZUL-M',
  imageUrl: 'https://cdn.test/v-1.jpg',
  colorName: 'Azul',
  colorHex: '#0000ff',
  sizeCode: 'M',
  currentStock: 50,
  minStock: 5,
  reservedStock: 0,
  inTransitStock: 0,
  availableStock: 50,
  status: 'in_stock',
  updatedAt: new Date().toISOString(),
};

// ── Helpers de render ───────────────────────────────────────────────────────
function renderActions(overrides?: { variant?: Partial<VariantStock> }) {
  const v = { ...variant, ...overrides?.variant };
  return render(
    <TooltipProvider>
      <MemoryRouter initialEntries={['/estoque']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          <Route
            path="/estoque"
            element={<VariantStockRowActions product={product} variant={v} />}
          />
          <Route path="/orcamentos/novo" element={<div data-testid="quote-page">Orçamento</div>} />
          <Route path="/produto/:id" element={<div data-testid="product-page">Produto</div>} />
        </Routes>
      </MemoryRouter>
    </TooltipProvider>,
  );
}

// ── Setup ───────────────────────────────────────────────────────────────────
const origClipboard = Object.getOwnPropertyDescriptor(Navigator.prototype, 'clipboard');
const origShare = (navigator as Navigator & { share?: unknown }).share;

function setClipboard(writeText: (s: string) => Promise<void> | void) {
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText },
  });
}
function setShare(share: ((d: ShareData) => Promise<void>) | undefined) {
  Object.defineProperty(navigator, 'share', { configurable: true, value: share });
}

beforeEach(() => {
  useFavoritesStore.setState({ favorites: [], favoriteCount: 0 });
  useComparisonStore.setState({ compareItems: [], compareCount: 0 });
  toastSuccess.mockClear();
  toastError.mockClear();
});

afterEach(() => {
  if (origClipboard) Object.defineProperty(Navigator.prototype, 'clipboard', origClipboard);
  Object.defineProperty(navigator, 'share', { configurable: true, value: origShare });
});

// ════════════════════════════════════════════════════════════════════════════
// 1. COPIAR SKU
// ════════════════════════════════════════════════════════════════════════════
describe('VariantStockRowActions · Copiar SKU', () => {
  it('copia o SKU da variação no clipboard e emite toast de sucesso', async () => {
    const user = userEvent.setup({ writeToClipboard: false });
    const writeText = vi.fn().mockResolvedValue(undefined);
    setClipboard(writeText);

    renderActions();

    await user.click(screen.getByTestId('stock-row-copy-sku'));

    await waitFor(() => expect(writeText).toHaveBeenCalledWith('CAN-001-AZUL-M'));
    expect(toastSuccess).toHaveBeenCalledWith('SKU CAN-001-AZUL-M copiado');
  });

  it('mostra erro profissional se clipboard falhar (sem fallback disponível)', async () => {
    const user = userEvent.setup({ writeToClipboard: false });
    const writeText = vi.fn().mockRejectedValue(new Error('blocked'));
    setClipboard(writeText);
    const orig = document.execCommand;
    document.execCommand = vi.fn(() => false);

    renderActions();
    await user.click(screen.getByTestId('stock-row-copy-sku'));

    await waitFor(() => expect(toastError).toHaveBeenCalled());
    expect(toastError.mock.calls[0][0]).toMatch(/não foi possível copiar/i);

    document.execCommand = orig;
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 2. CARRINHO (smoke — fluxo real coberto pelos testes do QuickAddToQuote)
// ════════════════════════════════════════════════════════════════════════════
describe('VariantStockRowActions · Carrinho', () => {
  it('renderiza o QuickAddToQuote com o SKU da variação', () => {
    renderActions();
    const cart = screen.getByTestId('mock-quick-add-to-quote');
    expect(cart).toBeInTheDocument();
    expect(cart).toHaveAttribute('data-sku', 'CAN-001-AZUL-M');
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 3. ORÇAMENTO
// ════════════════════════════════════════════════════════════════════════════
describe('VariantStockRowActions · Orçamento', () => {
  it('navega para /orcamentos/novo com os parâmetros da variação', async () => {
    const user = userEvent.setup({ writeToClipboard: false });
    renderActions();
    await user.click(screen.getByTestId('stock-row-quote'));
    await waitFor(() => expect(screen.getByTestId('quote-page')).toBeInTheDocument());
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 4. COLEÇÃO
// ════════════════════════════════════════════════════════════════════════════
describe('VariantStockRowActions · Coleção', () => {
  it('abre o modal de coleção ao clicar', async () => {
    const user = userEvent.setup({ writeToClipboard: false });
    renderActions();
    expect(screen.queryByTestId('mock-collection-modal')).not.toBeInTheDocument();
    await user.click(screen.getByTestId('stock-row-collection'));
    expect(screen.getByTestId('mock-collection-modal')).toBeInTheDocument();
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 5. FAVORITAR
// ════════════════════════════════════════════════════════════════════════════
describe('VariantStockRowActions · Favoritar', () => {
  it('adiciona aos favoritos com info de variação e alterna estado', async () => {
    const user = userEvent.setup({ writeToClipboard: false });
    renderActions();
    const btn = screen.getByTestId('stock-row-favorite');
    expect(btn).toHaveAttribute('aria-pressed', 'false');

    await user.click(btn);
    expect(useFavoritesStore.getState().favorites).toHaveLength(1);
    expect(useFavoritesStore.getState().favorites[0].variant?.color_name).toBe('Azul');
    expect(toastSuccess).toHaveBeenCalled();

    // toggle off
    await user.click(screen.getByTestId('stock-row-favorite'));
    expect(useFavoritesStore.getState().favorites).toHaveLength(0);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 6. COMPARAR
// ════════════════════════════════════════════════════════════════════════════
describe('VariantStockRowActions · Comparar', () => {
  it('adiciona à comparação e remove no segundo clique', async () => {
    const user = userEvent.setup({ writeToClipboard: false });
    renderActions();
    const btn = screen.getByTestId('stock-row-compare');
    await user.click(btn);
    expect(useComparisonStore.getState().compareItems.length).toBe(1);

    await user.click(screen.getByTestId('stock-row-compare'));
    expect(useComparisonStore.getState().compareItems.length).toBe(0);
  });

  it('mostra erro se exceder o limite de 4 itens', async () => {
    const store = useComparisonStore.getState();
    ['a', 'b', 'c', 'd'].forEach((id) => store.addToCompare(id));

    const user = userEvent.setup({ writeToClipboard: false });
    renderActions();
    await user.click(screen.getByTestId('stock-row-compare'));
    expect(toastError).toHaveBeenCalledWith(expect.stringMatching(/limite de 4/i));
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 7. VISUALIZAR
// ════════════════════════════════════════════════════════════════════════════
describe('VariantStockRowActions · Visualizar', () => {
  it('navega para /produto/:id', async () => {
    const user = userEvent.setup({ writeToClipboard: false });
    renderActions();
    await user.click(screen.getByTestId('stock-row-view'));
    await waitFor(() => expect(screen.getByTestId('product-page')).toBeInTheDocument());
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 8. COMPARTILHAR
// ════════════════════════════════════════════════════════════════════════════
describe('VariantStockRowActions · Compartilhar', () => {
  it('usa navigator.share quando disponível', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    setShare(share);
    const user = userEvent.setup({ writeToClipboard: false });
    renderActions();
    await user.click(screen.getByTestId('stock-row-share'));
    await waitFor(() => expect(share).toHaveBeenCalled());
    expect(toastError).not.toHaveBeenCalled();
  });

  it('faz fallback para clipboard quando share não existe', async () => {
    const user = userEvent.setup({ writeToClipboard: false });
    setShare(undefined);
    const writeText = vi.fn().mockResolvedValue(undefined);
    setClipboard(writeText);
    renderActions();
    await user.click(screen.getByTestId('stock-row-share'));
    await waitFor(() => expect(writeText).toHaveBeenCalled());
    expect(toastSuccess).toHaveBeenCalledWith('Link do produto copiado');
  });

  it('não exibe erro quando o usuário cancela o share (AbortError)', async () => {
    const abort = Object.assign(new Error('cancel'), { name: 'AbortError' });
    const share = vi.fn().mockRejectedValue(abort);
    setShare(share);
    const user = userEvent.setup({ writeToClipboard: false });
    renderActions();
    await user.click(screen.getByTestId('stock-row-share'));
    await waitFor(() => expect(share).toHaveBeenCalled());
    expect(toastError).not.toHaveBeenCalled();
    expect(toastSuccess).not.toHaveBeenCalled();
  });
});
