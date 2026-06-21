/**
 * Snapshot visual de regressão — botão + popover de Risco de Ruptura.
 *
 * Captura a estrutura DOM relevante (atributos ARIA, classes, badge,
 * estado do Switch) nos 4 estados canônicos. Qualquer refactor que
 * altere layout/atributos sem intenção fará o snapshot falhar — o
 * mantenedor deve revisar e atualizar via `vitest -u`.
 *
 * Snapshots ficam em __snapshots__/ ao lado deste arquivo.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
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

/** Extrai apenas o subtree do botão Risco para isolar o snapshot. */
function ruptureSubtree(container: HTMLElement): Element {
  const btn = container.querySelector('[data-testid="rupture-horizon-control"]');
  if (!btn) throw new Error('rupture-horizon-control not found');
  return btn;
}

describe('StockFilterToolbar — snapshot visual do Risco de Ruptura', () => {
  it('estado OFF + count=0 (Switch indisponível)', () => {
    const { container } = render(
      <StockFilterToolbar
        {...baseProps}
        isRuptureRiskActive={false}
        ruptureRiskCount={0}
        onToggleRuptureRisk={vi.fn()}
      />,
    );
    expect(ruptureSubtree(container)).toMatchSnapshot();
  });

  it('estado OFF + count>0 (Switch habilitado, sem badge)', () => {
    const { container } = render(
      <StockFilterToolbar
        {...baseProps}
        isRuptureRiskActive={false}
        ruptureRiskCount={12}
        onToggleRuptureRisk={vi.fn()}
      />,
    );
    expect(ruptureSubtree(container)).toMatchSnapshot();
  });

  it('estado ON + count>0 (badge visível com "Nd")', () => {
    const { container } = render(
      <StockFilterToolbar
        {...baseProps}
        isRuptureRiskActive
        ruptureRiskCount={12}
        onToggleRuptureRisk={vi.fn()}
      />,
    );
    expect(ruptureSubtree(container)).toMatchSnapshot();
  });

  it('popover aberto + ON — Switch checked + radiogroup de horizonte', () => {
    const { container } = render(
      <StockFilterToolbar
        {...baseProps}
        isRuptureRiskActive
        ruptureRiskCount={7}
        onToggleRuptureRisk={vi.fn()}
      />,
    );
    fireEvent.click(container.querySelector('[data-testid="rupture-horizon-control"]')!);
    // Inclui o portal do Popover na captura.
    expect(document.body).toMatchSnapshot();
  });
});
