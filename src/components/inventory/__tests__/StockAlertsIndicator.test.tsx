import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { TooltipProvider } from '@/components/ui/tooltip';
import { StockAlertsIndicator } from '../StockAlertsIndicator';
import type {
  StockNotificationItem,
  StockNotificationCounts,
} from '@/hooks/products/useStockNotifications';

// ── Mock dos hooks dedicados ────────────────────────────────────
const mockCounts = vi.fn();
const mockStockout = vi.fn();
const mockLow = vi.fn();
const mockNovelty = vi.fn();
const mockRestocks = vi.fn();

vi.mock('@/hooks/products/useStockNotifications', () => ({
  useStockNotificationCounts: () => mockCounts(),
  useStockoutAlerts: () => mockStockout(),
  useLowStockAlerts: () => mockLow(),
  useNoveltyAlerts: () => mockNovelty(),
  useRecentRestocks: () => mockRestocks(),
}));

beforeAll(() => {
  const proto = Element.prototype as unknown as Record<string, unknown>;
  proto.hasPointerCapture = vi.fn(() => false);
  proto.setPointerCapture = vi.fn();
  proto.releasePointerCapture = vi.fn();
  proto.scrollIntoView = vi.fn();
});

// ── Factories ───────────────────────────────────────────────────

const item = (over: Partial<StockNotificationItem>): StockNotificationItem => ({
  id: over.id ?? `x-${Math.random()}`,
  productId: over.productId ?? '00000000-0000-0000-0000-000000000000',
  productName: over.productName ?? 'Produto Teste',
  sku: over.sku ?? 'SKU1',
  imageUrl: over.imageUrl ?? null,
  supplier: over.supplier ?? 'XBZ Brindes',
  kind: over.kind ?? 'stockout',
  stockQuantity: over.stockQuantity ?? 0,
  eventDate: over.eventDate ?? null, // novo campo obrigatorio
  ...over,
});

const counts = (c: Partial<StockNotificationCounts>): StockNotificationCounts => {
  const stockout = c.stockout ?? 0;
  const low_stock = c.low_stock ?? 0;
  const novelties = c.novelties ?? 0;
  const restocks = c.restocks ?? 0;
  return {
    stockout,
    low_stock,
    novelties,
    restocks,
    total: c.total ?? stockout + low_stock + novelties + restocks,
  };
};

const setLists = (over?: {
  stockout?: StockNotificationItem[];
  low?: StockNotificationItem[];
  novelty?: StockNotificationItem[];
  restocked?: StockNotificationItem[];
}) => {
  mockStockout.mockReturnValue({ data: over?.stockout ?? [], isLoading: false });
  mockLow.mockReturnValue({ data: over?.low ?? [], isLoading: false });
  mockNovelty.mockReturnValue({ data: over?.novelty ?? [], isLoading: false });
  mockRestocks.mockReturnValue({ data: over?.restocked ?? [], isLoading: false });
};

const renderIndicator = () =>
  render(
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>

      <TooltipProvider>
        <StockAlertsIndicator />
      </TooltipProvider>
    </BrowserRouter>,
  );

beforeEach(() => {
  vi.clearAllMocks();
  mockCounts.mockReturnValue({ data: counts({}), isLoading: false });
  setLists();
});

// ── Testes: trigger ─────────────────────────────────────────────

describe('StockAlertsIndicator — trigger', () => {
  it('mostra o sino com aria-label dedicado (distinto do sino de workspace)', () => {
    renderIndicator();
    expect(screen.getByRole('button', { name: 'Alertas de estoque' })).toBeInTheDocument();
  });

  it('exibe o total exato vindo dos contadores server-side', () => {
    mockCounts.mockReturnValue({
      data: counts({ stockout: 3, low_stock: 2, novelties: 5, restocks: 4 }),
      isLoading: false,
    });
    renderIndicator();
    expect(screen.getByText('14')).toBeInTheDocument();
  });

  it('cap visual 99+ quando total > 99', () => {
    mockCounts.mockReturnValue({
      data: counts({ stockout: 1350, low_stock: 295, novelties: 654, restocks: 138 }),
      isLoading: false,
    });
    renderIndicator();
    expect(screen.getByText('99+')).toBeInTheDocument();
  });

  it('cor dominante = vermelho quando há esgotados', () => {
    mockCounts.mockReturnValue({ data: counts({ stockout: 1, novelties: 9 }), isLoading: false });
    renderIndicator();
    const badge = screen.getByText('10');
    expect(badge.className).toContain('bg-destructive');
  });

  it('cor dominante = âmbar quando só há baixo+novidade', () => {
    mockCounts.mockReturnValue({
      data: counts({ low_stock: 2, novelties: 3 }),
      isLoading: false,
    });
    renderIndicator();
    const badge = screen.getByText('5');
    expect(badge.className).toContain('bg-warning');
  });

  it('NÃO some quando total=0 — sino continua visível (fix do return null)', () => {
    mockCounts.mockReturnValue({ data: counts({}), isLoading: false });
    renderIndicator();
    expect(screen.getByRole('button', { name: 'Alertas de estoque' })).toBeInTheDocument();
    expect(screen.queryByText('0')).not.toBeInTheDocument();
  });

  it('durante carregamento marca aria-busy e não mostra badge', () => {
    mockCounts.mockReturnValue({ data: undefined, isLoading: true });
    renderIndicator();
    const btn = screen.getByRole('button', { name: 'Alertas de estoque' });
    expect(btn).toHaveAttribute('aria-busy', 'true');
  });
});

// ── Testes: painel, abas e período ─────────────────────────────

describe('StockAlertsIndicator — painel, abas e período', () => {
  it('renderiza as 4 abas e a barra de período', async () => {
    const user = userEvent.setup();
    mockCounts.mockReturnValue({
      data: counts({ stockout: 3, low_stock: 2, novelties: 5, restocks: 4 }),
      isLoading: false,
    });
    renderIndicator();
    await user.click(screen.getByRole('button', { name: 'Alertas de estoque' }));

    for (const label of ['Zerou', 'Baixo', 'Novidade', 'Chegou']) {
      expect(screen.getByRole('button', { name: new RegExp(label) })).toBeInTheDocument();
    }
    // barra de período
    for (const label of ['Hoje', '7 dias', '30 dias', 'Tudo']) {
      expect(screen.getByRole('button', { name: label })).toBeInTheDocument();
    }
  });

  it('aba Chegou: itens "Reposto" e NENHUM com "0 un."', async () => {
    const user = userEvent.setup();
    mockCounts.mockReturnValue({ data: counts({ restocks: 2 }), isLoading: false });
    setLists({
      restocked: [
        item({ id: 'r1', kind: 'restocked', productName: 'Caneca X', stockQuantity: 500 }),
        item({ id: 'r2', kind: 'restocked', productName: 'Caneta Y', stockQuantity: 12 }),
      ],
    });
    renderIndicator();
    await user.click(screen.getByRole('button', { name: 'Alertas de estoque' }));
    await user.click(screen.getByRole('button', { name: /Chegou/ }));

    expect(screen.getAllByText('Reposto').length).toBe(2);
    expect(screen.getByText('500 un.')).toBeInTheDocument();
    expect(screen.queryByText('0 un.')).not.toBeInTheDocument();
  });

  it('aba Baixo: badge "Baixo" e mostra "X un. / threshold"', async () => {
    const user = userEvent.setup();
    mockCounts.mockReturnValue({ data: counts({ low_stock: 1 }), isLoading: false });
    setLists({
      low: [
        item({ id: 'l1', kind: 'low', productName: 'Mochila Z', stockQuantity: 7, lowStockThreshold: 10 }),
      ],
    });
    renderIndicator();
    await user.click(screen.getByRole('button', { name: 'Alertas de estoque' }));
    await user.click(screen.getByRole('button', { name: /Baixo/ }));

    expect(screen.getAllByText(/Baixo/).length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText(/7 un\./)).toBeInTheDocument();
    expect(screen.getByText(/\/ 10/)).toBeInTheDocument();
  });

  it('eventDate = "2026-06-15" formata como "15/06/2026" no card', async () => {
    const user = userEvent.setup();
    mockCounts.mockReturnValue({ data: counts({ stockout: 1 }), isLoading: false });
    setLists({
      stockout: [
        item({
          id: 's1',
          kind: 'stockout',
          productName: 'Produto Data',
          stockQuantity: 0,
          eventDate: '2026-06-15T07:30:00.000Z',
        }),
      ],
    });
    renderIndicator();
    await user.click(screen.getByRole('button', { name: 'Alertas de estoque' }));
    expect(screen.getByText('15/06/2026')).toBeInTheDocument();
  });

  it('eventDate = null → não exibe data no card', async () => {
    const user = userEvent.setup();
    mockCounts.mockReturnValue({ data: counts({ stockout: 1 }), isLoading: false });
    setLists({
      stockout: [item({ id: 's1', kind: 'stockout', stockQuantity: 0, eventDate: null })],
    });
    renderIndicator();
    await user.click(screen.getByRole('button', { name: 'Alertas de estoque' }));
    // não deve aparecer nenhuma string de data no painel
    expect(screen.queryByText(/\d{2}\/\d{2}\/\d{4}/)).not.toBeInTheDocument();
  });

  it('estado vazio com itens dispensados: "Tudo visto nesta categoria"', async () => {
    const user = userEvent.setup();
    mockCounts.mockReturnValue({ data: counts({ stockout: 5 }), isLoading: false });
    setLists({ stockout: [] });
    renderIndicator();
    await user.click(screen.getByRole('button', { name: 'Alertas de estoque' }));
    expect(screen.getByText('Tudo visto nesta categoria')).toBeInTheDocument();
  });

  it('estado vazio sem contagem: "Nenhuma notificação nesta categoria"', async () => {
    const user = userEvent.setup();
    mockCounts.mockReturnValue({ data: counts({}), isLoading: false });
    setLists();
    renderIndicator();
    await user.click(screen.getByRole('button', { name: 'Alertas de estoque' }));
    expect(screen.getByText('Nenhuma notificação nesta categoria')).toBeInTheDocument();
  });

  it('footer "Ver todos os N" aparece quando há mais no servidor do que na lista', async () => {
    const user = userEvent.setup();
    mockCounts.mockReturnValue({ data: counts({ stockout: 50 }), isLoading: false });
    setLists({ stockout: [item({ id: 's1', kind: 'stockout', stockQuantity: 0 })] });
    renderIndicator();
    await user.click(screen.getByRole('button', { name: 'Alertas de estoque' }));
    expect(screen.getByText(/Ver todos os 50/)).toBeInTheDocument();
  });

  it('itens da aba Zerou exibem badge "Esgotado"', async () => {
    const user = userEvent.setup();
    mockCounts.mockReturnValue({ data: counts({ stockout: 1 }), isLoading: false });
    setLists({
      stockout: [item({ id: 's1', kind: 'stockout', productName: 'Kit Office', stockQuantity: 0 })],
    });
    renderIndicator();
    await user.click(screen.getByRole('button', { name: 'Alertas de estoque' }));
    expect(screen.getByText('Esgotado')).toBeInTheDocument();
  });
});
