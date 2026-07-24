import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AlertCard } from '../StockAlertCard';
import type { StockAlert } from '@/types/stock';

const makeAlert = (over: Partial<StockAlert> = {}): StockAlert => ({
  id: over.id ?? 'a1',
  type: over.type ?? 'out_of_stock',
  severity: over.severity ?? 'error',
  productId: over.productId ?? 'p1',
  productName: over.productName ?? 'Caneca Premium',
  productSku: over.productSku ?? 'SKU-123',
  variantId: over.variantId,
  colorName: over.colorName,
  title: over.title ?? 'Sem estoque',
  message: over.message ?? 'Produto esgotado',
  currentStock: over.currentStock ?? 0,
  threshold: over.threshold ?? 10,
  suggestedAction: over.suggestedAction,
  actionUrl: over.actionUrl,
  createdAt: over.createdAt ?? '2026-06-15T00:00:00.000Z',
  ...over,
});

describe('AlertCard', () => {
  it('renders product name, message and SKU', () => {
    render(<AlertCard alert={makeAlert()} onDismiss={vi.fn()} />);
    expect(screen.getByText('Caneca Premium')).toBeInTheDocument();
    expect(screen.getByText('Produto esgotado')).toBeInTheDocument();
    expect(screen.getByText('SKU-123')).toBeInTheDocument();
  });

  it('has role alert', () => {
    render(<AlertCard alert={makeAlert()} onDismiss={vi.fn()} />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('renders suggestedAction when present', () => {
    render(
      <AlertCard alert={makeAlert({ suggestedAction: 'Repor estoque' })} onDismiss={vi.fn()} />,
    );
    expect(screen.getByText(/Repor estoque/)).toBeInTheDocument();
  });

  it('omits suggestedAction block when absent', () => {
    render(<AlertCard alert={makeAlert({ suggestedAction: undefined })} onDismiss={vi.fn()} />);
    expect(screen.queryByText(/→/)).not.toBeInTheDocument();
  });

  it('calls onDismiss when the dismiss button is clicked', () => {
    const onDismiss = vi.fn();
    render(<AlertCard alert={makeAlert()} onDismiss={onDismiss} />);
    fireEvent.click(screen.getByLabelText('Dispensar alerta de Caneca Premium'));
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it('applies error severity styling', () => {
    render(<AlertCard alert={makeAlert({ severity: 'error' })} onDismiss={vi.fn()} />);
    expect(screen.getByRole('alert').className).toContain('bg-destructive/5');
  });

  it('applies warning severity styling', () => {
    render(<AlertCard alert={makeAlert({ severity: 'warning' })} onDismiss={vi.fn()} />);
    expect(screen.getByRole('alert').className).toContain('bg-warning/5');
  });

  it('applies info severity styling', () => {
    render(<AlertCard alert={makeAlert({ severity: 'info' })} onDismiss={vi.fn()} />);
    expect(screen.getByRole('alert').className).toContain('bg-primary/5');
  });
});
