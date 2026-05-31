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

  it("renders 'Atualizado em DD/MM/AAAA' for fresh updates in inline variant", () => {
    const today = new Date('2026-05-03T09:00:00Z').toISOString();
    renderWithProvider(<PriceFreshnessBadge priceUpdatedAt={today} variant="inline" />);

    // Agora padronizado para exibir apenas a data curta
    expect(screen.getByText(/Atualizado em 03\/05\/2026/i)).toBeInTheDocument();
  });

  it('renders nothing for fresh updates in compact variant (unless alwaysShow is true)', () => {
    const today = new Date('2026-05-03T09:00:00Z').toISOString();
    const { container } = renderWithProvider(
      <PriceFreshnessBadge priceUpdatedAt={today} variant="compact" />,
    );

    expect(container.firstChild).toBeNull();
  });

  it('renders badge in compact variant for stale updates', () => {
    // 2026-05-03 - 120 days ago
    const monthsAgo = new Date('2026-01-03T12:00:00Z').toISOString();
    renderWithProvider(<PriceFreshnessBadge priceUpdatedAt={monthsAgo} variant="compact" />);

    // compact uses formatCompactRelative which is different
    expect(screen.getByText(/há 4m/i)).toBeInTheDocument();
  });

  it("renders 'Atualizado em 19/03/2026' for aging updates in inline variant", () => {
    // 2026-05-03 - 45 days ago
    const fortyFiveDaysAgo = new Date('2026-03-19T12:00:00Z').toISOString();
    renderWithProvider(<PriceFreshnessBadge priceUpdatedAt={fortyFiveDaysAgo} variant="inline" />);

    // Antes era "Atualizado há 45 dias", agora é padronizado
    expect(screen.getByText(/Atualizado em 19\/03\/2026/i)).toBeInTheDocument();
  });

  it('renders PDP variant with simple date for stale updates', () => {
    const monthsAgo = new Date('2026-01-03T12:00:00Z').toISOString();
    renderWithProvider(<PriceFreshnessBadge priceUpdatedAt={monthsAgo} variant="pdp" />);

    // No PDP agora mostramos apenas a data curta
    expect(screen.getByText(/Atualizado em 03\/01\/2026/i)).toBeInTheDocument();
    
    // Detalhes como "há 120 dias" ou recomendações não devem estar no badge (vão para o tooltip)
    expect(screen.queryByText(/\(há 120 dias\)/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Confirme com o fornecedor/i)).not.toBeInTheDocument();
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
      expect.stringContaining('Atualizado hoje'),
    );
  });
});
