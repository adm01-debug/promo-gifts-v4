import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PriceFreshnessBadge } from './PriceFreshnessBadge';
import { TooltipProvider } from '@/components/ui/tooltip';

describe('PriceFreshnessBadge Component', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-03T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const renderWithProvider = (ui: React.ReactElement) => {
    return render(<TooltipProvider>{ui}</TooltipProvider>);
  };

  it("renders 'Atualizado hoje' for fresh updates in inline variant", () => {
    const today = new Date('2026-05-03T09:00:00Z').toISOString();
    renderWithProvider(<PriceFreshnessBadge priceUpdatedAt={today} variant="inline" />);

    expect(screen.getByText(/Atualizado hoje/i)).toBeInTheDocument();
  });

  it('renders nothing for fresh updates in compact variant (unless alwaysShow is true)', () => {
    const today = new Date('2026-05-03T09:00:00Z').toISOString();
    const { container } = renderWithProvider(
      <PriceFreshnessBadge priceUpdatedAt={today} variant="compact" />,
    );

    expect(container.firstChild).toBeNull();
  });

  it('renders badge in compact variant for stale updates', () => {
    // 2026-05-03 - 4 months ago (~120 days)
    const monthsAgo = new Date('2026-01-03T12:00:00Z').toISOString();
    renderWithProvider(<PriceFreshnessBadge priceUpdatedAt={monthsAgo} variant="compact" />);

    // 120 days / 30 = 4 months (há 4m)
    expect(screen.getByText(/há 4m/i)).toBeInTheDocument();
  });

  it('renders PDP variant with warning box for stale updates', () => {
    const monthsAgo = new Date('2026-01-03T12:00:00Z').toISOString();
    renderWithProvider(<PriceFreshnessBadge priceUpdatedAt={monthsAgo} variant="pdp" />);

    expect(screen.getByText(/Preço pode estar defasado/i)).toBeInTheDocument();
    expect(screen.getByText(/Confirme com o fornecedor/i)).toBeInTheDocument();
  });

  it("shows 'Confirmado' state when confirmedAt is provided", () => {
    const monthsAgo = new Date('2026-01-03T12:00:00Z').toISOString();
    const now = new Date('2026-05-03T12:00:00Z').toISOString();

    renderWithProvider(
      <PriceFreshnessBadge priceUpdatedAt={monthsAgo} confirmedAt={now} variant="inline" />,
    );

    expect(screen.getByText(/Confirmado com fornecedor/i)).toBeInTheDocument();
  });

  it('handles unknown status (missing date)', () => {
    renderWithProvider(<PriceFreshnessBadge priceUpdatedAt={null} variant="inline" />);

    expect(screen.getByText(/Data de atualização não informada/i)).toBeInTheDocument();
  });

  it('includes explicit threshold in compact label if provided', () => {
    const thirtyDaysAgo = new Date('2026-04-03T12:00:00Z').toISOString();
    renderWithProvider(
      <PriceFreshnessBadge priceUpdatedAt={thirtyDaysAgo} thresholdDays={20} variant="compact" />,
    );

    expect(screen.getByText(/limite 20d/i)).toBeInTheDocument();
  });

  it('applies correct accessible labels (aria-label)', () => {
    const today = new Date('2026-05-03T12:00:00Z').toISOString();
    renderWithProvider(
      <PriceFreshnessBadge priceUpdatedAt={today} variant="icon-only" alwaysShow />,
    );

    const status = screen.getByRole('status');
    expect(status).toHaveAttribute(
      'aria-label',
      expect.stringContaining('Preço atualizado pelo fornecedor'),
    );
  });
});
