import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { SupplierRiskPanel } from '../SupplierRiskPanel';
import type { ProductStockSummary, VariantStock } from '@/types/stock';

// ── Mock the heavy detail child — keeps the panel under test isolated. ──
vi.mock('../risk/ProductRiskDetail', () => ({
  ProductRiskDetail: ({ productId, productName }: { productId: string; productName?: string }) => (
    <div data-testid="product-risk-detail">detail:{productName ?? productId}</div>
  ),
}));

// ── Mock the virtualizer so rows render in jsdom (zero-height container). ──
vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: ({ count }: { count: number }) => ({
    getTotalSize: () => count * 52,
    getVirtualItems: () =>
      Array.from({ length: count }, (_, index) => ({
        index,
        key: index,
        size: 52,
        start: index * 52,
      })),
  }),
}));

// ── Factory ─────────────────────────────────────────────────────
let seq = 0;
const variant = (over: Partial<VariantStock> = {}): VariantStock => {
  seq += 1;
  return {
    id: over.id ?? `v-${seq}`,
    productId: over.productId ?? `p-${seq}`,
    variantId: over.variantId ?? `vid-${seq}`,
    variantSku: over.variantSku ?? `VSKU-${seq}`,
    currentStock: over.currentStock ?? 10,
    minStock: over.minStock ?? 5,
    reservedStock: over.reservedStock ?? 0,
    inTransitStock: over.inTransitStock ?? 0,
    availableStock: over.availableStock ?? 10,
    status: over.status ?? 'in_stock',
    updatedAt: over.updatedAt ?? '2026-06-15T10:00:00.000Z',
    ...over,
  };
};

const product = (over: Partial<ProductStockSummary> = {}): ProductStockSummary => {
  seq += 1;
  return {
    productId: over.productId ?? `prod-${seq}`,
    productName: over.productName ?? `Produto ${seq}`,
    productSku: over.productSku ?? `SKU-${seq}`,
    totalCurrentStock: over.totalCurrentStock ?? 100,
    totalMinStock: over.totalMinStock ?? 20,
    totalReservedStock: over.totalReservedStock ?? 0,
    totalInTransitStock: over.totalInTransitStock ?? 0,
    totalAvailableStock: over.totalAvailableStock ?? 100,
    overallStatus: over.overallStatus ?? 'in_stock',
    variantsInStock: over.variantsInStock ?? 1,
    variantsLowStock: over.variantsLowStock ?? 0,
    variantsCritical: over.variantsCritical ?? 0,
    variantsOutOfStock: over.variantsOutOfStock ?? 0,
    totalVariants: over.totalVariants ?? 1,
    variants: over.variants ?? [variant()],
    availableColors: over.availableColors ?? [],
    ...over,
  };
};

beforeEach(() => {
  vi.clearAllMocks();
  seq = 0;
});

describe('SupplierRiskPanel — empty state', () => {
  it('mostra estado vazio quando não há produtos', () => {
    render(<SupplierRiskPanel products={[]} />);
    expect(screen.getByText('Sem dados disponíveis')).toBeInTheDocument();
    expect(screen.getByText(/Carregue os dados de estoque/)).toBeInTheDocument();
  });
});

describe('SupplierRiskPanel — populated', () => {
  it('renderiza título, descrição e lista de produtos', () => {
    render(
      <SupplierRiskPanel
        products={[
          product({ productName: 'Caneca OK', overallStatus: 'in_stock' }),
          product({
            productName: 'Mochila Crítica',
            overallStatus: 'out_of_stock',
            variantsOutOfStock: 1,
          }),
        ]}
      />,
    );
    expect(screen.getByText('Risco de Ruptura no Fornecedor')).toBeInTheDocument();
    expect(screen.getByText('Caneca OK')).toBeInTheDocument();
    expect(screen.getByText('Mochila Crítica')).toBeInTheDocument();
  });

  it('exibe badge de críticos no cabeçalho quando há produtos críticos', () => {
    render(
      <SupplierRiskPanel
        products={[
          product({ productName: 'Crit1', overallStatus: 'critical', variantsCritical: 1 }),
          product({ productName: 'Crit2', overallStatus: 'out_of_stock', variantsOutOfStock: 1 }),
        ]}
      />,
    );
    expect(screen.getByText(/2 crítico/)).toBeInTheDocument();
  });

  it('exibe data da última atualização quando há variants com updatedAt', () => {
    render(
      <SupplierRiskPanel
        products={[
          product({
            productName: 'Com Data',
            variants: [variant({ updatedAt: '2026-06-15T13:45:00.000Z' })],
          }),
        ]}
      />,
    );
    // dd/MM HH:mm formatted (TZ America/Sao_Paulo)
    expect(screen.getByText(/15\/06/)).toBeInTheDocument();
  });

  it('auto-seleciona o primeiro produto e mostra o detalhe', async () => {
    render(
      <SupplierRiskPanel
        products={[
          product({ productName: 'Primeiro', overallStatus: 'critical', variantsCritical: 1 }),
        ]}
      />,
    );
    await waitFor(() =>
      expect(screen.getByTestId('product-risk-detail')).toHaveTextContent('detail:Primeiro'),
    );
  });

  it('renderiza os 4 botões de filtro de severidade com contagens', () => {
    render(
      <SupplierRiskPanel
        products={[
          product({ overallStatus: 'critical', variantsCritical: 1 }),
          product({ overallStatus: 'low_stock', variantsLowStock: 1 }),
          product({ overallStatus: 'in_stock' }),
        ]}
      />,
    );
    expect(screen.getByRole('radio', { name: /Todos \(3\)/ })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Críticos \(1\)/ })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Atenção \(1\)/ })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /OK \(1\)/ })).toBeInTheDocument();
  });
});

describe('SupplierRiskPanel — interactions', () => {
  it('filtra por severidade crítica ao clicar no botão', async () => {
    const user = userEvent.setup();
    render(
      <SupplierRiskPanel
        products={[
          product({ productName: 'CriticoX', overallStatus: 'critical', variantsCritical: 1 }),
          product({ productName: 'SaudavelY', overallStatus: 'in_stock' }),
        ]}
      />,
    );
    await user.click(screen.getByRole('radio', { name: /Críticos/ }));
    expect(screen.getByText('CriticoX')).toBeInTheDocument();
    expect(screen.queryByText('SaudavelY')).not.toBeInTheDocument();
  });

  it('filtro sem correspondência mostra "Nenhum produto nesta categoria"', async () => {
    const user = userEvent.setup();
    render(
      <SupplierRiskPanel
        products={[product({ productName: 'SoOK', overallStatus: 'in_stock' })]}
      />,
    );
    await user.click(screen.getByRole('radio', { name: /Críticos/ }));
    expect(screen.getByText('Nenhum produto nesta categoria')).toBeInTheDocument();
  });

  it('busca por nome filtra a lista (com debounce) e mostra vazio quando não acha', async () => {
    const user = userEvent.setup();
    render(
      <SupplierRiskPanel
        products={[
          product({ productName: 'Caneca Térmica', productSku: 'CAN-1' }),
          product({ productName: 'Mochila', productSku: 'MOC-1' }),
        ]}
      />,
    );
    const input = screen.getByLabelText('Buscar produto no painel de risco');
    await user.type(input, 'Caneca');
    await waitFor(() => expect(screen.queryByText('Mochila')).not.toBeInTheDocument());
    expect(screen.getByText('Caneca Térmica')).toBeInTheDocument();

    await user.clear(input);
    await user.type(input, 'inexistente-xyz');
    await waitFor(() => expect(screen.getByText('Nenhum produto encontrado')).toBeInTheDocument());
  });

  it('seleciona produto da lista ao clicar e atualiza o detalhe', async () => {
    const user = userEvent.setup();
    render(
      <SupplierRiskPanel
        products={[
          product({ productName: 'Alpha', overallStatus: 'critical', variantsCritical: 1 }),
          product({ productName: 'Beta', overallStatus: 'critical', variantsCritical: 1 }),
        ]}
      />,
    );
    const list = screen.getByRole('listbox');
    await user.click(within(list).getByRole('option', { name: /Beta/ }));
    await waitFor(() =>
      expect(screen.getByTestId('product-risk-detail')).toHaveTextContent('detail:Beta'),
    );
  });

  it('atualiza os contadores do rodapé conforme o filtro aplicado', async () => {
    const user = userEvent.setup();
    render(
      <SupplierRiskPanel
        products={[
          product({ productName: 'C1', overallStatus: 'critical', variantsCritical: 1 }),
          product({ productName: 'W1', overallStatus: 'low_stock', variantsLowStock: 1 }),
          product({ productName: 'O1', overallStatus: 'in_stock' }),
        ]}
      />,
    );
    // footer status regions
    expect(screen.getByRole('status', { name: /1 produtos críticos/ })).toBeInTheDocument();
    await user.click(screen.getByRole('radio', { name: /OK/ }));
    // after filtering to OK only, critical footer drops to 0
    expect(screen.getByRole('status', { name: /0 produtos críticos/ })).toBeInTheDocument();
    expect(screen.getByRole('status', { name: /1 produtos OK/ })).toBeInTheDocument();
  });
});
