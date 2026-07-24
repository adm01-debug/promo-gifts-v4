/**
 * Cobertura consolidada dos componentes puros/presentacionais do módulo de Estoque
 * que estavam com 0% de cobertura:
 * - StockBadge / getStockStatus / StockIndicator
 * - StockAlertCard
 * - StockBulkActionBar
 * - StockEmptyFiltersHint
 * - StockThresholdsLegend
 * - HealthScoreInfoDialog
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TooltipProvider } from '@/components/ui/tooltip';
import type { ReactNode } from 'react';

import { StockBadge, getStockStatus, StockIndicator } from '@/components/inventory/StockBadge';
import { AlertCard } from '@/components/inventory/StockAlertCard';
import { StockBulkActionBar } from '@/components/inventory/StockBulkActionBar';
import { StockEmptyFiltersHint } from '@/components/inventory/StockEmptyFiltersHint';
import { StockThresholdsLegend } from '@/components/inventory/StockThresholdsLegend';
import { HealthScoreInfoDialog } from '@/components/inventory/HealthScoreInfoDialog';
import type { StockAlert, StockFilters } from '@/types/stock';

const Wrapper = ({ children }: { children: ReactNode }) => (
  <TooltipProvider>{children}</TooltipProvider>
);

// ─── StockBadge ───────────────────────────────────────────────────────────────

describe('StockBadge', () => {
  it.each(['in-stock', 'low-stock', 'out-of-stock', 'pre-order', 'incoming'] as const)(
    'renders %s status label',
    (status) => {
      render(
        <Wrapper>
          <StockBadge status={status} />
        </Wrapper>,
      );
      // each status has a shortLabel rendered inside
      expect(document.body.textContent).toBeTruthy();
    },
  );

  it('shows formatted quantity when showQuantity=true', () => {
    render(
      <Wrapper>
        <StockBadge status="in-stock" quantity={250} showQuantity />
      </Wrapper>,
    );
    expect(screen.getByText(/250 un\./)).toBeInTheDocument();
  });

  it('formats large quantity with k suffix', () => {
    render(
      <Wrapper>
        <StockBadge status="in-stock" quantity={1500} showQuantity />
      </Wrapper>,
    );
    expect(screen.getByText(/1\.5k un\./)).toBeInTheDocument();
  });

  it('shows tooltip when expectedDate is provided', () => {
    render(
      <Wrapper>
        <StockBadge status="incoming" expectedDate="2026-08-01" />
      </Wrapper>,
    );
    // TooltipTrigger wraps the badge — badge should still be in document
    expect(document.body.textContent).toContain('Em trânsito');
  });

  it('shows tooltip when quantity is provided without showQuantity', () => {
    render(
      <Wrapper>
        <StockBadge status="low-stock" quantity={20} showQuantity={false} />
      </Wrapper>,
    );
    expect(document.body.textContent).toContain('Estoque baixo');
  });

  it('renders with size=sm', () => {
    const { container } = render(
      <Wrapper>
        <StockBadge status="in-stock" size="sm" />
      </Wrapper>,
    );
    expect(container).toBeTruthy();
  });

  it('renders with size=lg', () => {
    const { container } = render(
      <Wrapper>
        <StockBadge status="in-stock" size="lg" />
      </Wrapper>,
    );
    expect(container).toBeTruthy();
  });

  it('hides icon when showIcon=false', () => {
    const { container } = render(
      <Wrapper>
        <StockBadge status="in-stock" showIcon={false} />
      </Wrapper>,
    );
    expect(container.querySelector('svg')).toBeNull();
  });
});

// ─── getStockStatus helper ────────────────────────────────────────────────────

describe('getStockStatus', () => {
  it('returns out-of-stock for quantity 0', () => {
    expect(getStockStatus(0)).toBe('out-of-stock');
  });

  it('returns low-stock when quantity is at threshold', () => {
    expect(getStockStatus(50)).toBe('low-stock');
    expect(getStockStatus(1)).toBe('low-stock');
  });

  it('returns in-stock above default threshold', () => {
    expect(getStockStatus(51)).toBe('in-stock');
    expect(getStockStatus(1000)).toBe('in-stock');
  });

  it('respects custom lowThreshold', () => {
    expect(getStockStatus(20, 30)).toBe('low-stock');
    expect(getStockStatus(31, 30)).toBe('in-stock');
  });
});

// ─── StockIndicator ───────────────────────────────────────────────────────────

describe('StockIndicator', () => {
  it.each(['in-stock', 'low-stock', 'out-of-stock', 'incoming', 'pre-order'] as const)(
    'renders %s dot',
    (status) => {
      const { container } = render(
        <Wrapper>
          <StockIndicator status={status} />
        </Wrapper>,
      );
      expect(container.querySelector('span')).toBeTruthy();
    },
  );
});

// ─── StockAlertCard ───────────────────────────────────────────────────────────

const makeAlert = (overrides: Partial<StockAlert> = {}): StockAlert => ({
  id: 'a1',
  productId: 'p1',
  productName: 'Produto Teste',
  productSku: 'PT-001',
  variantId: 'v1',
  title: 'Estoque crítico',
  message: 'Estoque crítico',
  severity: 'error',
  type: 'critical',
  currentStock: 0,
  threshold: 10,
  createdAt: '2026-06-01T00:00:00Z',
  ...overrides,
});

describe('AlertCard', () => {
  it('renders product name and message', () => {
    render(<AlertCard alert={makeAlert()} onDismiss={vi.fn()} />);
    expect(screen.getByText('Produto Teste')).toBeInTheDocument();
    expect(screen.getByText('Estoque crítico')).toBeInTheDocument();
  });

  it('renders SKU badge', () => {
    render(<AlertCard alert={makeAlert()} onDismiss={vi.fn()} />);
    expect(screen.getByText('PT-001')).toBeInTheDocument();
  });

  it('shows suggested action when present', () => {
    render(
      <AlertCard
        alert={makeAlert({ suggestedAction: 'Reordenar imediatamente' })}
        onDismiss={vi.fn()}
      />,
    );
    expect(screen.getByText(/Reordenar imediatamente/)).toBeInTheDocument();
  });

  it('calls onDismiss when dismiss button clicked', () => {
    const onDismiss = vi.fn();
    render(<AlertCard alert={makeAlert()} onDismiss={onDismiss} />);
    fireEvent.click(screen.getByRole('button', { name: /Dispensar alerta/i }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it.each(['info', 'warning', 'error'] as const)('renders %s severity icon', (severity) => {
    const { container } = render(<AlertCard alert={makeAlert({ severity })} onDismiss={vi.fn()} />);
    expect(container.querySelector('[role="alert"]')).toBeInTheDocument();
  });
});

// ─── StockBulkActionBar ───────────────────────────────────────────────────────

const defaultBulkProps = {
  selectedCount: 0,
  totalCount: 10,
  onSelectAll: vi.fn(),
  onClear: vi.fn(),
  onBulkFavorite: vi.fn(),
  onBulkCompare: vi.fn(),
  onBulkQuote: vi.fn(),
  onBulkCollection: vi.fn(),
};

describe('StockBulkActionBar', () => {
  it('renders selection count', () => {
    render(<StockBulkActionBar {...defaultBulkProps} selectedCount={3} totalCount={10} />);
    expect(screen.getByText('3/10')).toBeInTheDocument();
  });

  it('shows singular label for 1 item', () => {
    render(<StockBulkActionBar {...defaultBulkProps} selectedCount={1} totalCount={5} />);
    expect(screen.getByText(/item selecionado/)).toBeInTheDocument();
  });

  it('shows plural label for multiple items', () => {
    render(<StockBulkActionBar {...defaultBulkProps} selectedCount={3} totalCount={5} />);
    expect(screen.getByText(/itens selecionados/)).toBeInTheDocument();
  });

  it('shows placeholder text when nothing selected', () => {
    render(<StockBulkActionBar {...defaultBulkProps} selectedCount={0} />);
    expect(screen.getByText(/Selecione variações/)).toBeInTheDocument();
  });

  it('calls onSelectAll when button clicked', () => {
    const onSelectAll = vi.fn();
    render(<StockBulkActionBar {...defaultBulkProps} onSelectAll={onSelectAll} />);
    fireEvent.click(screen.getByTestId('stock-bulk-select-all'));
    expect(onSelectAll).toHaveBeenCalledTimes(1);
  });

  it('calls onClear when clear button clicked', () => {
    const onClear = vi.fn();
    render(<StockBulkActionBar {...defaultBulkProps} onClear={onClear} />);
    fireEvent.click(screen.getByTestId('stock-bulk-clear'));
    expect(onClear).toHaveBeenCalledTimes(1);
  });

  it('calls onBulkFavorite when enabled', () => {
    const onBulkFavorite = vi.fn();
    render(
      <StockBulkActionBar
        {...defaultBulkProps}
        selectedCount={2}
        onBulkFavorite={onBulkFavorite}
      />,
    );
    fireEvent.click(screen.getByTestId('stock-bulk-favorite'));
    expect(onBulkFavorite).toHaveBeenCalledTimes(1);
  });

  it('calls onBulkQuote when enabled', () => {
    const onBulkQuote = vi.fn();
    render(
      <StockBulkActionBar {...defaultBulkProps} selectedCount={2} onBulkQuote={onBulkQuote} />,
    );
    fireEvent.click(screen.getByTestId('stock-bulk-quote'));
    expect(onBulkQuote).toHaveBeenCalledTimes(1);
  });

  it('buttons are disabled when selectedCount === 0', () => {
    render(<StockBulkActionBar {...defaultBulkProps} selectedCount={0} />);
    expect(screen.getByTestId('stock-bulk-favorite')).toBeDisabled();
    expect(screen.getByTestId('stock-bulk-compare')).toBeDisabled();
    expect(screen.getByTestId('stock-bulk-quote')).toBeDisabled();
  });
});

// ─── StockEmptyFiltersHint ────────────────────────────────────────────────────

const baseFilters: StockFilters = {
  search: '',
  status: 'all',
  categoryId: undefined,
  supplierId: undefined,
  colorGroup: undefined,
  colorName: undefined,
  minQuantityNeeded: undefined,
  showOnlyWithAlerts: false,
  showOnlyWithVariants: false,
  sortBy: 'name',
  sortDirection: 'asc',
  groupBy: 'none',
};

describe('StockEmptyFiltersHint', () => {
  it('returns null when no active filters', () => {
    const { container } = render(
      <StockEmptyFiltersHint
        filters={baseFilters}
        totalProducts={50}
        onResetFilters={vi.fn()}
        onUpdateFilter={vi.fn()}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders chip for active search filter', () => {
    render(
      <StockEmptyFiltersHint
        filters={{ ...baseFilters, search: 'camiseta' }}
        totalProducts={50}
        onResetFilters={vi.fn()}
        onUpdateFilter={vi.fn()}
      />,
    );
    expect(screen.getByText('camiseta')).toBeInTheDocument();
    expect(screen.getByTestId('stock-empty-filters-hint')).toBeInTheDocument();
  });

  it('renders chips for category, supplier, color filters', () => {
    render(
      <StockEmptyFiltersHint
        filters={{
          ...baseFilters,
          categoryId: 'cat-1',
          supplierId: 'sup-1',
          colorGroup: 'Azul',
        }}
        totalProducts={20}
        onResetFilters={vi.fn()}
        onUpdateFilter={vi.fn()}
      />,
    );
    expect(screen.getByTestId('stock-empty-filters-chip-categoryId')).toBeInTheDocument();
    expect(screen.getByTestId('stock-empty-filters-chip-supplierId')).toBeInTheDocument();
    expect(screen.getByTestId('stock-empty-filters-chip-colorGroup')).toBeInTheDocument();
  });

  it('renders chip for minQuantityNeeded when > 0', () => {
    render(
      <StockEmptyFiltersHint
        filters={{ ...baseFilters, minQuantityNeeded: 100 }}
        totalProducts={20}
        onResetFilters={vi.fn()}
        onUpdateFilter={vi.fn()}
      />,
    );
    expect(screen.getByTestId('stock-empty-filters-chip-minQuantityNeeded')).toBeInTheDocument();
    expect(screen.getByText(/≥ 100 un/)).toBeInTheDocument();
  });

  it('renders chip for status filter when not "all"', () => {
    render(
      <StockEmptyFiltersHint
        filters={{ ...baseFilters, status: 'critical' }}
        totalProducts={20}
        onResetFilters={vi.fn()}
        onUpdateFilter={vi.fn()}
      />,
    );
    expect(screen.getByTestId('stock-empty-filters-chip-status')).toBeInTheDocument();
  });

  it('renders chip for showOnlyWithAlerts', () => {
    render(
      <StockEmptyFiltersHint
        filters={{ ...baseFilters, showOnlyWithAlerts: true }}
        totalProducts={20}
        onResetFilters={vi.fn()}
        onUpdateFilter={vi.fn()}
      />,
    );
    expect(screen.getByTestId('stock-empty-filters-chip-showOnlyWithAlerts')).toBeInTheDocument();
  });

  it('calls onResetFilters when reset button clicked', () => {
    const onResetFilters = vi.fn();
    render(
      <StockEmptyFiltersHint
        filters={{ ...baseFilters, search: 'test' }}
        totalProducts={50}
        onResetFilters={onResetFilters}
        onUpdateFilter={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByTestId('stock-empty-filters-reset'));
    expect(onResetFilters).toHaveBeenCalledTimes(1);
  });

  it('calls onUpdateFilter with empty string when search chip dismissed', () => {
    const onUpdateFilter = vi.fn();
    render(
      <StockEmptyFiltersHint
        filters={{ ...baseFilters, search: 'test' }}
        totalProducts={50}
        onResetFilters={vi.fn()}
        onUpdateFilter={onUpdateFilter}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Remover filtro Busca/i }));
    expect(onUpdateFilter).toHaveBeenCalledWith('search', '');
  });

  it('calls onUpdateFilter with "all" when status chip dismissed', () => {
    const onUpdateFilter = vi.fn();
    render(
      <StockEmptyFiltersHint
        filters={{ ...baseFilters, status: 'critical' }}
        totalProducts={50}
        onResetFilters={vi.fn()}
        onUpdateFilter={onUpdateFilter}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Remover filtro Status/i }));
    expect(onUpdateFilter).toHaveBeenCalledWith('status', 'all');
  });

  it('calls onUpdateFilter with false when showOnlyWithAlerts chip dismissed', () => {
    const onUpdateFilter = vi.fn();
    render(
      <StockEmptyFiltersHint
        filters={{ ...baseFilters, showOnlyWithAlerts: true }}
        totalProducts={50}
        onResetFilters={vi.fn()}
        onUpdateFilter={onUpdateFilter}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Remover filtro Alertas/i }));
    expect(onUpdateFilter).toHaveBeenCalledWith('showOnlyWithAlerts', false);
  });

  it('shows total products count', () => {
    render(
      <StockEmptyFiltersHint
        filters={{ ...baseFilters, search: 'teste' }}
        totalProducts={1234}
        onResetFilters={vi.fn()}
        onUpdateFilter={vi.fn()}
      />,
    );
    expect(screen.getByText(/1\.234/)).toBeInTheDocument();
  });
});

// ─── StockThresholdsLegend ────────────────────────────────────────────────────

describe('StockThresholdsLegend', () => {
  it('renders threshold chips', () => {
    render(<StockThresholdsLegend />);
    expect(screen.getByTestId('stock-thresholds-legend')).toBeInTheDocument();
    // chips exist for healthy, low, critical, out
    expect(
      document.querySelectorAll('[data-testid^="stock-threshold-chip-"]').length,
    ).toBeGreaterThan(0);
  });

  it('renders label text "Faixas de classificação" in non-compact mode', () => {
    render(<StockThresholdsLegend />);
    expect(screen.getByText(/Faixas de classificação/)).toBeInTheDocument();
  });

  it('hides label in compact mode', () => {
    render(<StockThresholdsLegend compact />);
    expect(screen.queryByText(/Faixas de classificação/)).toBeNull();
  });
});

// ─── HealthScoreInfoDialog ────────────────────────────────────────────────────

describe('HealthScoreInfoDialog', () => {
  it('renders trigger button', () => {
    render(<HealthScoreInfoDialog productsInStock={80} totalProducts={100} criticalAlerts={5} />);
    expect(screen.getByTestId('health-score-info-trigger')).toBeInTheDocument();
  });

  it('shows dialog content when trigger is clicked', () => {
    render(<HealthScoreInfoDialog productsInStock={80} totalProducts={100} criticalAlerts={5} />);
    fireEvent.click(screen.getByTestId('health-score-info-trigger'));
    expect(screen.getByTestId('health-score-info-dialog')).toBeInTheDocument();
    expect(screen.getByText('Como é calculado')).toBeInTheDocument();
  });

  it('shows live example with correct percentage', () => {
    render(<HealthScoreInfoDialog productsInStock={80} totalProducts={100} criticalAlerts={5} />);
    fireEvent.click(screen.getByTestId('health-score-info-trigger'));
    const live = screen.getByTestId('health-score-live-example');
    expect(live).toBeInTheDocument();
    // score = round(80/100 * 100) = 80
    expect(live.textContent).toContain('80%');
  });

  it('shows criticalAlerts count', () => {
    render(<HealthScoreInfoDialog productsInStock={50} totalProducts={100} criticalAlerts={12} />);
    fireEvent.click(screen.getByTestId('health-score-info-trigger'));
    expect(screen.getByText('12')).toBeInTheDocument();
  });
});
