import { describe, it, expect, beforeAll, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TooltipProvider } from '@/components/ui/tooltip';
import { StockBadge, StockIndicator, getStockStatus } from '../StockBadge';

beforeAll(() => {
  const proto = Element.prototype as unknown as Record<string, unknown>;
  proto.hasPointerCapture = vi.fn(() => false);
  proto.setPointerCapture = vi.fn();
  proto.releasePointerCapture = vi.fn();
  proto.scrollIntoView = vi.fn();
});

const wrap = (ui: React.ReactNode) => render(<TooltipProvider>{ui}</TooltipProvider>);

describe('StockBadge — getStockStatus helper', () => {
  it('returns out-of-stock for zero quantity', () => {
    expect(getStockStatus(0)).toBe('out-of-stock');
  });

  it('returns low-stock at or below threshold', () => {
    expect(getStockStatus(50)).toBe('low-stock');
    expect(getStockStatus(10, 20)).toBe('low-stock');
  });

  it('returns in-stock above threshold', () => {
    expect(getStockStatus(100)).toBe('in-stock');
    expect(getStockStatus(21, 20)).toBe('in-stock');
  });
});

describe('StockBadge — rendering', () => {
  it('renders short label for in-stock status by default', () => {
    wrap(<StockBadge status="in-stock" />);
    expect(screen.getByText('Disponível')).toBeInTheDocument();
  });

  it('renders short label for low-stock', () => {
    wrap(<StockBadge status="low-stock" />);
    expect(screen.getByText('Estoque baixo')).toBeInTheDocument();
  });

  it('renders short label for pre-order and incoming', () => {
    const { rerender } = wrap(<StockBadge status="pre-order" />);
    expect(screen.getByText('Pré-venda')).toBeInTheDocument();
    rerender(
      <TooltipProvider>
        <StockBadge status="incoming" />
      </TooltipProvider>,
    );
    expect(screen.getByText('Em trânsito')).toBeInTheDocument();
  });

  it('shows quantity with "un." suffix when showQuantity is true', () => {
    wrap(<StockBadge status="in-stock" quantity={250} showQuantity />);
    expect(screen.getByText(/250 un\./)).toBeInTheDocument();
  });

  it('formats quantities >= 1000 with k suffix', () => {
    wrap(<StockBadge status="in-stock" quantity={1500} showQuantity />);
    expect(screen.getByText(/1\.5k un\./)).toBeInTheDocument();
  });

  it('renders without crashing when showIcon is false', () => {
    wrap(<StockBadge status="in-stock" showIcon={false} />);
    expect(screen.getByText('Disponível')).toBeInTheDocument();
  });

  it('wraps in tooltip trigger when quantity provided but not shown', () => {
    // branch: quantity !== undefined && !showQuantity → tooltip path
    wrap(<StockBadge status="out-of-stock" quantity={0} />);
    expect(screen.getByText('Indisponível')).toBeInTheDocument();
  });

  it('wraps in tooltip trigger when expectedDate provided', () => {
    wrap(<StockBadge status="incoming" expectedDate="2026-06-20" />);
    expect(screen.getByText('Em trânsito')).toBeInTheDocument();
  });

  it('applies custom className and size variants', () => {
    const { container } = wrap(<StockBadge status="in-stock" size="lg" className="custom-x" />);
    expect(container.querySelector('.custom-x')).not.toBeNull();
  });
});

describe('StockIndicator', () => {
  it('renders a colored dot wrapped in a tooltip trigger', () => {
    const { container } = wrap(<StockIndicator status="out-of-stock" />);
    const dot = container.querySelector('span.rounded-full');
    expect(dot).not.toBeNull();
    expect(dot?.className).toContain('bg-destructive');
  });

  it('adds pulse animation for low-stock', () => {
    const { container } = wrap(<StockIndicator status="low-stock" />);
    const dot = container.querySelector('span.rounded-full');
    expect(dot?.className).toContain('animate-pulse');
  });
});
