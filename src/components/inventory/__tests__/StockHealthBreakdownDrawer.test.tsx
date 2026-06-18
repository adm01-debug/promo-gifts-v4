import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { StockHealthBreakdownDrawer } from '../StockHealthBreakdownDrawer';
import type { ProductStockSummary, StockStatus } from '@/types/stock';

// Radix Sheet (Dialog) precisa destes stubs no jsdom.
beforeAll(() => {
  const proto = Element.prototype as unknown as Record<string, unknown>;
  proto.hasPointerCapture = vi.fn(() => false);
  proto.setPointerCapture = vi.fn();
  proto.releasePointerCapture = vi.fn();
  proto.scrollIntoView = vi.fn();
});

const product = (
  over: Partial<ProductStockSummary> & { overallStatus: StockStatus },
): ProductStockSummary => ({
  productId: over.productId ?? `p-${Math.random()}`,
  productName: over.productName ?? 'Produto',
  productSku: over.productSku ?? 'SKU',
  totalCurrentStock: over.totalCurrentStock ?? 100,
  totalMinStock: over.totalMinStock ?? 10,
  totalReservedStock: 0,
  totalInTransitStock: 0,
  totalAvailableStock: over.totalCurrentStock ?? 100,
  variantsInStock: 0,
  variantsLowStock: 0,
  variantsCritical: 0,
  variantsOutOfStock: 0,
  totalVariants: 1,
  variants: [],
  availableColors: [],
  ...over,
});

const renderDrawer = (
  props: Partial<React.ComponentProps<typeof StockHealthBreakdownDrawer>> = {},
) =>
  render(
    <BrowserRouter>
      <StockHealthBreakdownDrawer
        open
        onOpenChange={vi.fn()}
        products={props.products ?? []}
        {...props}
      />
    </BrowserRouter>,
  );

const mixedProducts: ProductStockSummary[] = [
  product({
    productId: 'h1',
    productName: 'Caneca Saudável',
    productSku: 'HEALTH-1',
    overallStatus: 'in_stock',
  }),
  product({
    productId: 'h2',
    productName: 'Mochila OK',
    productSku: 'HEALTH-2',
    overallStatus: 'in_stock',
  }),
  product({
    productId: 'o1',
    productName: 'Caneta Zerada',
    productSku: 'OUT-1',
    overallStatus: 'out_of_stock',
    totalCurrentStock: 0,
  }),
];

describe('StockHealthBreakdownDrawer', () => {
  beforeEach(() => vi.clearAllMocks());

  it('não renderiza o conteúdo quando open=false', () => {
    render(
      <BrowserRouter>
        <StockHealthBreakdownDrawer open={false} onOpenChange={vi.fn()} products={mixedProducts} />
      </BrowserRouter>,
    );
    expect(screen.queryByTestId('stock-breakdown-drawer')).not.toBeInTheDocument();
  });

  it('renderiza header, legenda e as 4 abas com contagens corretas', () => {
    renderDrawer({ products: mixedProducts });
    expect(screen.getByTestId('stock-breakdown-drawer')).toBeInTheDocument();
    expect(screen.getByText('Produtos por faixa de estoque')).toBeInTheDocument();
    expect(screen.getByTestId('stock-thresholds-legend')).toBeInTheDocument();

    const healthyTab = screen.getByTestId('tab-healthy');
    expect(within(healthyTab).getByText('2')).toBeInTheDocument();
    const outTab = screen.getByTestId('tab-out');
    expect(within(outTab).getByText('1')).toBeInTheDocument();
  });

  it('mostra os produtos da aba inicial (Adequado) como linhas com link', () => {
    renderDrawer({ products: mixedProducts });
    const rows = screen.getAllByTestId('stock-breakdown-row');
    expect(rows).toHaveLength(2);
    expect(screen.getByText('Caneca Saudável')).toBeInTheDocument();
    // o link aponta para a rota do produto
    expect(rows[0]).toHaveAttribute('href', '/produto/h1');
  });

  it('troca para a aba "Sem estoque" e mostra o produto zerado', async () => {
    const user = userEvent.setup();
    renderDrawer({ products: mixedProducts });
    await user.click(screen.getByTestId('tab-out'));
    expect(await screen.findByText('Caneta Zerada')).toBeInTheDocument();
  });

  it('filtra por busca (nome) e reduz as linhas exibidas', async () => {
    const user = userEvent.setup();
    renderDrawer({ products: mixedProducts });
    const search = screen.getByTestId('stock-breakdown-search');
    await user.type(search, 'Mochila');
    expect(screen.getByText('Mochila OK')).toBeInTheDocument();
    expect(screen.queryByText('Caneca Saudável')).not.toBeInTheDocument();
  });

  it('filtra por busca (SKU)', async () => {
    const user = userEvent.setup();
    renderDrawer({ products: mixedProducts });
    await user.type(screen.getByTestId('stock-breakdown-search'), 'HEALTH-1');
    expect(screen.getByText('Caneca Saudável')).toBeInTheDocument();
    expect(screen.queryByText('Mochila OK')).not.toBeInTheDocument();
  });

  it('mostra mensagem "Nenhum produto corresponde à busca" quando filtro não bate', async () => {
    const user = userEvent.setup();
    renderDrawer({ products: mixedProducts });
    await user.type(screen.getByTestId('stock-breakdown-search'), 'inexistente-zzz');
    const empty = screen.getByTestId('stock-breakdown-empty');
    expect(empty).toHaveTextContent('Nenhum produto corresponde à busca.');
  });

  it('mostra "Nenhum produto nesta faixa." numa aba vazia (sem busca)', async () => {
    const user = userEvent.setup();
    renderDrawer({ products: mixedProducts });
    await user.click(screen.getByTestId('tab-critical'));
    const empty = await screen.findByTestId('stock-breakdown-empty');
    expect(empty).toHaveTextContent('Nenhum produto nesta faixa.');
  });

  it('lida com lista de produtos vazia: todas as abas zeradas', () => {
    renderDrawer({ products: [] });
    expect(within(screen.getByTestId('tab-healthy')).getByText('0')).toBeInTheDocument();
    expect(screen.getByTestId('stock-breakdown-empty')).toHaveTextContent(
      'Nenhum produto nesta faixa.',
    );
  });
});
