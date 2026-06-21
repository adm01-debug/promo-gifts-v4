/**
 * StockFilterToolbar — visibilidade do badge "Nd" do botão Risco de Ruptura.
 *
 * Regra de UX (espelho do "Estoque Futuro"):
 *  - Badge `data-testid="rupture-risk-horizon-badge"` SÓ aparece quando:
 *      isRuptureRiskActive === true  &&  ruptureRiskCount > 0
 *  - Switch fica disabled quando ruptureRiskCount === 0 ou sem callback.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { StockFilterToolbar } from '@/components/inventory/StockFilterToolbar';
import { defaultStockFilters } from '@/types/stock';

const baseProps = {
  filters: { ...defaultStockFilters },
  onUpdateFilter: vi.fn(),
  onResetFilters: vi.fn(),
  categories: [],
  suppliers: [],
  colors: [],
  colorGroups: [],
  totalProducts: 100,
  filteredCount: 100,
};

function openRupturePopover() {
  fireEvent.click(screen.getByTestId('rupture-horizon-control'));
}

describe('StockFilterToolbar — badge de Risco de Ruptura', () => {
  it('OFF + count=0 → badge ausente, aria-pressed=false', () => {
    render(
      <StockFilterToolbar
        {...baseProps}
        isRuptureRiskActive={false}
        ruptureRiskCount={0}
        onToggleRuptureRisk={vi.fn()}
      />,
    );
    expect(screen.queryByTestId('rupture-risk-horizon-badge')).not.toBeInTheDocument();
    expect(screen.getByTestId('rupture-horizon-control')).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('OFF + count>0 → badge ainda ausente (precisa estar ON)', () => {
    render(
      <StockFilterToolbar
        {...baseProps}
        isRuptureRiskActive={false}
        ruptureRiskCount={42}
        onToggleRuptureRisk={vi.fn()}
      />,
    );
    expect(screen.queryByTestId('rupture-risk-horizon-badge')).not.toBeInTheDocument();
  });

  it('ON + count>0 → badge visível com "Nd"', () => {
    render(
      <StockFilterToolbar
        {...baseProps}
        isRuptureRiskActive
        ruptureRiskCount={5}
        onToggleRuptureRisk={vi.fn()}
      />,
    );
    const badge = screen.getByTestId('rupture-risk-horizon-badge');
    expect(badge).toBeInTheDocument();
    expect(badge.textContent).toMatch(/\d+d/);
    expect(screen.getByTestId('rupture-horizon-control')).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('ON + count=0 → badge não aparece (edge: filtro ativo sem alvos)', () => {
    render(
      <StockFilterToolbar
        {...baseProps}
        isRuptureRiskActive
        ruptureRiskCount={0}
        onToggleRuptureRisk={vi.fn()}
      />,
    );
    expect(screen.queryByTestId('rupture-risk-horizon-badge')).not.toBeInTheDocument();
  });

  it('Switch disabled quando count=0', () => {
    render(
      <StockFilterToolbar
        {...baseProps}
        isRuptureRiskActive={false}
        ruptureRiskCount={0}
        onToggleRuptureRisk={vi.fn()}
      />,
    );
    openRupturePopover();
    expect(screen.getByTestId('rupture-risk-switch')).toBeDisabled();
  });

  it('Switch dispara onToggleRuptureRisk(true) quando count>0', () => {
    const onToggle = vi.fn();
    render(
      <StockFilterToolbar
        {...baseProps}
        isRuptureRiskActive={false}
        ruptureRiskCount={3}
        onToggleRuptureRisk={onToggle}
      />,
    );
    openRupturePopover();
    fireEvent.click(screen.getByTestId('rupture-risk-switch'));
    expect(onToggle).toHaveBeenCalledWith(true);
  });
});
