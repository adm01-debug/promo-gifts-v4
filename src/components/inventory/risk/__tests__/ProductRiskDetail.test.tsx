import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeAll, beforeEach } from 'vitest';
import type { ProductIntelligenceData, StockVelocity } from '@/hooks/intelligence';
import type * as IntelligenceModule from '@/hooks/intelligence';

// ── Mock the data hooks ─────────────────────────────────────────
const mockSummary = vi.fn();
const mockVelocity = vi.fn();
const mockIntelligence = vi.fn();
const refetchSummary = vi.fn();
const refetchVelocity = vi.fn();
const refetchIntelligence = vi.fn();

vi.mock('@/hooks/intelligence', async (importOriginal) => {
  const actual = await importOriginal<typeof IntelligenceModule>();
  return {
    ...actual,
    useStockDailySummary: (...args: unknown[]) => mockSummary(...args),
    useStockVelocity: (...args: unknown[]) => mockVelocity(...args),
    useProductIntelligenceData: (...args: unknown[]) => mockIntelligence(...args),
  };
});

// ── Mock react-router navigate ──────────────────────────────────
const navigate = vi.fn();
vi.mock('react-router-dom', () => ({
  useNavigate: () => navigate,
}));

// ── Mock recharts (avoids ResponsiveContainer 0-size churn in jsdom) ──
vi.mock('recharts', () => {
  const Pass = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>;
  return {
    ResponsiveContainer: Pass,
    ComposedChart: Pass,
    CartesianGrid: () => null,
    XAxis: () => null,
    YAxis: () => null,
    Tooltip: () => null,
    Legend: () => null,
    Area: () => null,
    Bar: () => null,
  };
});

import { ProductRiskDetail } from '../ProductRiskDetail';

beforeAll(() => {
  const proto = Element.prototype as unknown as Record<string, unknown>;
  proto.hasPointerCapture = vi.fn(() => false);
  proto.setPointerCapture = vi.fn();
  proto.releasePointerCapture = vi.fn();
  proto.scrollIntoView = vi.fn();
});

// ── Helpers ─────────────────────────────────────────────────────
const query = (over: Record<string, unknown> = {}) => ({
  data: undefined,
  isLoading: false,
  error: null,
  refetch: vi.fn(),
  ...over,
});

const realIntel = (over: Partial<ProductIntelligenceData> = {}): ProductIntelligenceData => ({
  product_id: 'prod-1',
  supplier_count: 2,
  total_current_stock: 1234,
  total_depleted_7d: 10,
  total_depleted_30d: 40,
  total_depleted_90d: 100,
  total_restocked_30d: 50,
  avg_velocity_7d: 1.4,
  avg_velocity_30d: 1.2,
  max_velocity_trend: 1.5,
  min_days_to_stockout: 5,
  turnover_score: 80,
  abc_classification: 'A',
  is_hot_product: true,
  is_stockout_risk: true,
  is_stagnant: false,
  is_negotiation_opportunity: false,
  has_frequent_restock: true,
  ...over,
});

const velocityRow = (over: Partial<StockVelocity> = {}): StockVelocity => ({
  variant_supplier_source_id: 'vss-1',
  supplier_id: 's-1',
  product_id: 'prod-1',
  variant_id: 'v-1',
  current_stock: 500,
  avg_daily_depletion_7d: 12.5,
  avg_daily_depletion_30d: 10,
  avg_daily_depletion_90d: 8,
  velocity_trend: 1.6,
  days_to_stockout: 5,
  total_depleted_7d: 80,
  total_depleted_30d: 300,
  total_depleted_90d: 720,
  total_restocked_30d: 100,
  restock_events_30d: 3,
  avg_days_between_restocks: 10,
  price_changes_30d: 2,
  active_days_7d: 7,
  active_days_30d: 28,
  active_days_90d: 80,
  ...over,
});

const summaryRow = (date: string, stockClose: number) => ({
  id: 1,
  variant_supplier_source_id: 'vss-1',
  supplier_id: 's-1',
  supplier_branch_id: null,
  variant_id: 'v-1',
  product_id: 'prod-1',
  summary_date: date,
  stock_open: stockClose,
  stock_close: stockClose,
  stock_min: 0,
  stock_max: stockClose,
  net_change: 0,
  units_depleted: 5,
  units_restocked: 0,
  restock_detected: false,
  restock_quantity: 0,
  restock_count: 0,
  cost_price_open: 10,
  cost_price_close: 10,
  price_changed: false,
  sync_count: 1,
});

const renderDetail = (productId = 'prod-1', productName?: string) =>
  render(<ProductRiskDetail productId={productId} productName={productName} />);

beforeEach(() => {
  vi.clearAllMocks();
  // default: demo mode (no data, no error)
  mockSummary.mockReturnValue(query({ refetch: refetchSummary }));
  mockVelocity.mockReturnValue(query({ refetch: refetchVelocity }));
  mockIntelligence.mockReturnValue(query({ refetch: refetchIntelligence }));
});

describe('ProductRiskDetail — loading & error', () => {
  it('mostra spinner de carregamento', () => {
    mockSummary.mockReturnValue(query({ isLoading: true, refetch: refetchSummary }));
    renderDetail();
    expect(
      screen.getByRole('status', { name: 'Carregando detalhes do produto' }),
    ).toBeInTheDocument();
  });

  it('mostra erro com botão "Tentar novamente" e dispara refetch', async () => {
    const user = userEvent.setup();
    mockSummary.mockReturnValue(query({ error: new Error('boom'), refetch: refetchSummary }));
    mockVelocity.mockReturnValue(query({ error: new Error('boom'), refetch: refetchVelocity }));
    mockIntelligence.mockReturnValue(
      query({ error: new Error('boom'), refetch: refetchIntelligence }),
    );
    renderDetail();
    expect(screen.getByText('Erro ao carregar dados')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Tentar novamente/ }));
    expect(refetchSummary).toHaveBeenCalled();
    expect(refetchVelocity).toHaveBeenCalled();
    expect(refetchIntelligence).toHaveBeenCalled();
  });
});

describe('ProductRiskDetail — demo mode', () => {
  it('renderiza badge demo e KPIs quando não há dados nem erro', () => {
    renderDetail('prod-demo', 'Produto Demo');
    expect(screen.getByText('Produto Demo')).toBeInTheDocument();
    expect(screen.getByText('demo')).toBeInTheDocument();
    expect(screen.getByText('Saída/dia (7d)')).toBeInTheDocument();
    expect(screen.getByText('Dias até acabar')).toBeInTheDocument();
    expect(screen.getByText('Estoque atual')).toBeInTheDocument();
    expect(screen.getByText('Tendência')).toBeInTheDocument();
  });

  it('usa productId como título quando productName ausente', () => {
    renderDetail('prod-xyz');
    expect(screen.getByText('prod-xyz')).toBeInTheDocument();
  });
});

describe('ProductRiskDetail — real data', () => {
  it('renderiza dados reais: classe ABC, KPIs e flags', () => {
    mockSummary.mockReturnValue(
      query({
        data: [summaryRow('2026-06-10', 500), summaryRow('2026-06-11', 480)],
        refetch: refetchSummary,
      }),
    );
    mockVelocity.mockReturnValue(query({ data: [velocityRow()], refetch: refetchVelocity }));
    mockIntelligence.mockReturnValue(query({ data: realIntel(), refetch: refetchIntelligence }));
    renderDetail('prod-1', 'Caneca Térmica');

    expect(screen.getByText('Caneca Térmica')).toBeInTheDocument();
    // "Classe A" appears as the ABC badge and as the class-a flag chip.
    expect(screen.getAllByText('Classe A').length).toBeGreaterThanOrEqual(1);
    // total_current_stock formatted pt-BR
    expect(screen.getByText('1.234')).toBeInTheDocument();
    // flags derived from real intelligence
    expect(screen.getByText('Produto Quente')).toBeInTheDocument();
    expect(screen.getByText('Risco de Ruptura')).toBeInTheDocument();
    // days_to_stockout = 5 -> urgent
    expect(screen.getByText('URGENTE!')).toBeInTheDocument();
  });

  it('mostra badge "parcial" quando há dados E erro simultaneamente', () => {
    mockSummary.mockReturnValue(
      query({ data: [summaryRow('2026-06-10', 500)], refetch: refetchSummary }),
    );
    mockVelocity.mockReturnValue(
      query({ data: [velocityRow()], error: new Error('partial'), refetch: refetchVelocity }),
    );
    mockIntelligence.mockReturnValue(query({ data: realIntel(), refetch: refetchIntelligence }));
    renderDetail('prod-1', 'Produto Parcial');
    expect(screen.getByText('parcial')).toBeInTheDocument();
  });

  it('exibe alterações de preço quando price_changes_30d > 0', () => {
    mockSummary.mockReturnValue(
      query({ data: [summaryRow('2026-06-10', 500)], refetch: refetchSummary }),
    );
    mockVelocity.mockReturnValue(
      query({ data: [velocityRow({ price_changes_30d: 2 })], refetch: refetchVelocity }),
    );
    mockIntelligence.mockReturnValue(query({ data: realIntel(), refetch: refetchIntelligence }));
    renderDetail('prod-1', 'Produto Preço');
    expect(screen.getByText(/2 alterações de preço/)).toBeInTheDocument();
  });
});

describe('ProductRiskDetail — interactions', () => {
  it('navega para a página do produto ao clicar "Ver produto"', async () => {
    const user = userEvent.setup();
    renderDetail('prod-nav', 'NavProd');
    await user.click(screen.getByRole('button', { name: /Ver produto/ }));
    expect(navigate).toHaveBeenCalledWith('/produto/prod-nav');
  });

  it('alterna o período via Tabs (chama hook com novos dias)', async () => {
    const user = userEvent.setup();
    renderDetail('prod-1', 'PeriodProd');
    // default period is 30; pick 90
    await user.click(screen.getByRole('tab', { name: '90d' }));
    // summary hook re-invoked with days=90
    expect(mockSummary).toHaveBeenCalledWith('prod-1', 90);
  });

  it('expande/minimiza o gráfico via botão', async () => {
    const user = userEvent.setup();
    renderDetail('prod-1', 'ChartProd');
    const expandBtn = screen.getByRole('button', { name: 'Expandir gráfico' });
    await user.click(expandBtn);
    expect(screen.getByRole('button', { name: 'Minimizar gráfico' })).toBeInTheDocument();
  });
});
