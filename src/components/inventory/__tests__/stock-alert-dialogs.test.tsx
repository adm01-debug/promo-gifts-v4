/**
 * Tests for StockAlertDialogs — OutOfStockDialog and LowStockDialog.
 * Covers: empty state, summary bar stats, dismiss callbacks, render with alerts.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { OutOfStockDialog, LowStockDialog } from '@/components/inventory/StockAlertDialogs';
import type { StockAlert } from '@/types/stock';

vi.mock('@/components/inventory/StockAlertCard', () => ({
  AlertCard: ({ alert, onDismiss }: { alert: StockAlert; onDismiss: () => void }) => (
    <div data-testid={`alert-card-${alert.id}`}>
      <button onClick={onDismiss} data-testid={`dismiss-${alert.id}`}>
        dismiss
      </button>
      {alert.productName}
    </div>
  ),
}));

function makeAlert(overrides: Partial<StockAlert> = {}): StockAlert {
  return {
    id: 'a1',
    type: 'out_of_stock',
    severity: 'error',
    productId: 'p1',
    productName: 'Produto A',
    productSku: 'SKU-A',
    title: 'Sem estoque',
    message: 'Estoque zerado',
    currentStock: 0,
    threshold: 10,
    createdAt: '2026-06-18T00:00:00Z',
    ...overrides,
  };
}

// ─── OutOfStockDialog ────────────────────────────────────────────────────────

describe('OutOfStockDialog', () => {
  const baseProps = {
    open: true,
    onOpenChange: vi.fn(),
    onDismiss: vi.fn(),
    onDismissAll: vi.fn(),
  };

  it('renders title "Alertas Críticos"', () => {
    render(<OutOfStockDialog {...baseProps} alerts={[]} />);
    expect(screen.getByText('Alertas Críticos')).toBeInTheDocument();
  });

  it('renders empty state when alerts=[]', () => {
    render(<OutOfStockDialog {...baseProps} alerts={[]} />);
    expect(screen.getByText('Nenhum alerta crítico')).toBeInTheDocument();
  });

  it('renders alert count badge', () => {
    const alerts = [makeAlert({ id: 'a1' }), makeAlert({ id: 'a2', productId: 'p2' })];
    render(<OutOfStockDialog {...baseProps} alerts={alerts} />);
    // Badge shows count — two alerts (may appear in badge + summary bar)
    const matches = screen.getAllByText('2');
    expect(matches.length).toBeGreaterThan(0);
  });

  it('renders AlertCard for each alert', () => {
    const alerts = [makeAlert({ id: 'a1' }), makeAlert({ id: 'a2', productId: 'p2' })];
    render(<OutOfStockDialog {...baseProps} alerts={alerts} />);
    expect(screen.getByTestId('alert-card-a1')).toBeInTheDocument();
    expect(screen.getByTestId('alert-card-a2')).toBeInTheDocument();
  });

  it('calls onDismiss when AlertCard dismiss is clicked', () => {
    const onDismiss = vi.fn();
    const alerts = [makeAlert({ id: 'x1' })];
    render(<OutOfStockDialog {...baseProps} onDismiss={onDismiss} alerts={alerts} />);
    fireEvent.click(screen.getByTestId('dismiss-x1'));
    expect(onDismiss).toHaveBeenCalledWith('x1');
  });

  it('calls onDismissAll when "Limpar Todos" clicked', () => {
    const onDismissAll = vi.fn();
    const alerts = [makeAlert()];
    render(<OutOfStockDialog {...baseProps} onDismissAll={onDismissAll} alerts={alerts} />);
    fireEvent.click(screen.getByRole('button', { name: /Dispensar todos os alertas críticos/i }));
    expect(onDismissAll).toHaveBeenCalled();
  });

  it('"Limpar Todos" is disabled when alerts=[]', () => {
    render(<OutOfStockDialog {...baseProps} alerts={[]} />);
    const btn = screen.getByRole('button', { name: /Dispensar todos os alertas críticos/i });
    expect(btn).toBeDisabled();
  });

  it('shows summary bar stat: esgotados count for out_of_stock', () => {
    const alerts = [
      makeAlert({ id: 'a1', type: 'out_of_stock', productId: 'p1' }),
      makeAlert({ id: 'a2', type: 'out_of_stock', productId: 'p2' }),
    ];
    render(<OutOfStockDialog {...baseProps} alerts={alerts} />);
    // Summary bar shows "Esgotados" stat
    expect(screen.getByText('Esgotados')).toBeInTheDocument();
    const esgotadosStat = screen.getAllByText('2');
    expect(esgotadosStat.length).toBeGreaterThan(0);
  });

  it('shows summary bar "Baixo" stat for critical/low_stock alerts', () => {
    const alerts = [
      makeAlert({ id: 'a1', type: 'critical', currentStock: 5, threshold: 20 }),
      makeAlert({ id: 'a2', type: 'low_stock', currentStock: 8, threshold: 20, productId: 'p2' }),
    ];
    render(<OutOfStockDialog {...baseProps} alerts={alerts} />);
    expect(screen.getByText('Baixo')).toBeInTheDocument();
  });

  it('shows correct "Produtos" count for distinct productIds', () => {
    const alerts = [
      makeAlert({ id: 'a1', productId: 'p1' }),
      makeAlert({ id: 'a2', productId: 'p1' }), // same product
      makeAlert({ id: 'a3', productId: 'p2' }),
    ];
    render(<OutOfStockDialog {...baseProps} alerts={alerts} />);
    expect(screen.getByText('Produtos')).toBeInTheDocument();
    // 2 distinct products
    const twos = screen.getAllByText('2');
    expect(twos.length).toBeGreaterThan(0);
  });
});

// ─── LowStockDialog ──────────────────────────────────────────────────────────

describe('LowStockDialog', () => {
  const baseProps = {
    open: true,
    onOpenChange: vi.fn(),
    onDismiss: vi.fn(),
    onDismissAll: vi.fn(),
  };

  it('renders title "Alertas de Estoque Baixo"', () => {
    render(<LowStockDialog {...baseProps} alerts={[]} />);
    expect(screen.getByText('Alertas de Estoque Baixo')).toBeInTheDocument();
  });

  it('renders empty state "Nenhum alerta de estoque baixo"', () => {
    render(<LowStockDialog {...baseProps} alerts={[]} />);
    expect(screen.getByText('Nenhum alerta de estoque baixo')).toBeInTheDocument();
  });

  it('renders alert count badge', () => {
    const alerts = [makeAlert({ id: 'a1', type: 'low_stock' })];
    render(<LowStockDialog {...baseProps} alerts={alerts} />);
    // Badge + summary may both show '1'
    expect(screen.getAllByText('1').length).toBeGreaterThan(0);
  });

  it('renders AlertCards when alerts present', () => {
    const alerts = [makeAlert({ id: 'b1', type: 'low_stock' })];
    render(<LowStockDialog {...baseProps} alerts={alerts} />);
    expect(screen.getByTestId('alert-card-b1')).toBeInTheDocument();
  });

  it('calls onDismiss when AlertCard dismiss clicked', () => {
    const onDismiss = vi.fn();
    const alerts = [makeAlert({ id: 'y1', type: 'low_stock' })];
    render(<LowStockDialog {...baseProps} onDismiss={onDismiss} alerts={alerts} />);
    fireEvent.click(screen.getByTestId('dismiss-y1'));
    expect(onDismiss).toHaveBeenCalledWith('y1');
  });

  it('calls onDismissAll when dismiss-all clicked', () => {
    const onDismissAll = vi.fn();
    const alerts = [makeAlert({ id: 'a1', type: 'low_stock' })];
    render(<LowStockDialog {...baseProps} onDismissAll={onDismissAll} alerts={alerts} />);
    fireEvent.click(
      screen.getByRole('button', { name: /Dispensar todos os alertas de estoque baixo/i }),
    );
    expect(onDismissAll).toHaveBeenCalled();
  });

  it('"Limpar Todos" is disabled when alerts=[]', () => {
    render(<LowStockDialog {...baseProps} alerts={[]} />);
    const btn = screen.getByRole('button', {
      name: /Dispensar todos os alertas de estoque baixo/i,
    });
    expect(btn).toBeDisabled();
  });

  it('summary bar hidden when alerts=[]', () => {
    render(<LowStockDialog {...baseProps} alerts={[]} />);
    expect(screen.queryByText('Alertas')).toBeNull();
  });

  it('summary bar shows Alertas and Produtos when alerts present', () => {
    const alerts = [
      makeAlert({ id: 'a1', type: 'low_stock' }),
      makeAlert({ id: 'a2', type: 'low_stock', productId: 'p2' }),
    ];
    render(<LowStockDialog {...baseProps} alerts={alerts} />);
    expect(screen.getByText('Alertas')).toBeInTheDocument();
    expect(screen.getByText('Produtos')).toBeInTheDocument();
  });
});
