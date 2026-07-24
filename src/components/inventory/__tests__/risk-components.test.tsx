/**
 * Cobertura dos componentes de risco de ruptura e da lógica de deriveSeverity.
 * Cobre: RiskKpi, RiskTooltip (risk/), deriveSeverity + SEVERITY_ORDER (risk/types.ts).
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Flame, AlertTriangle } from 'lucide-react';

import { RiskKpi } from '@/components/inventory/risk/RiskKpi';
import { RiskTooltip } from '@/components/inventory/risk/RiskTooltip';
import { deriveSeverity, SEVERITY_ORDER } from '@/components/inventory/risk/types';
import type { ProductStockSummary } from '@/types/stock';

// ─── RiskKpi ──────────────────────────────────────────────────────────────────

describe('RiskKpi', () => {
  const baseProps = {
    icon: Flame,
    label: 'Ruptura',
    value: '3 dias',
    sub: 'horizonte',
  };

  it('renders label, value and sub', () => {
    render(<RiskKpi {...baseProps} />);
    expect(screen.getByText('Ruptura')).toBeInTheDocument();
    expect(screen.getByText('3 dias')).toBeInTheDocument();
    expect(screen.getByText('horizonte')).toBeInTheDocument();
  });

  it('renders with alert style when alert=true', () => {
    const { container } = render(<RiskKpi {...baseProps} alert />);
    const root = container.firstChild as HTMLElement;
    expect(root.className).toContain('destructive');
  });

  it('renders with warning style when warning=true', () => {
    const { container } = render(<RiskKpi {...baseProps} warning />);
    const root = container.firstChild as HTMLElement;
    expect(root.className).toContain('warning');
  });

  it('renders neutral style when neither alert nor warning', () => {
    const { container } = render(<RiskKpi {...baseProps} />);
    const root = container.firstChild as HTMLElement;
    // neither destructive nor warning class
    expect(root.className).not.toContain('destructive');
    expect(root.className).not.toContain('warning');
  });

  it('has role=status for accessibility', () => {
    render(<RiskKpi {...baseProps} />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('renders different icons', () => {
    const { container, rerender } = render(<RiskKpi {...baseProps} icon={Flame} />);
    const svgCount1 = container.querySelectorAll('svg').length;
    rerender(<RiskKpi {...baseProps} icon={AlertTriangle} />);
    const svgCount2 = container.querySelectorAll('svg').length;
    expect(svgCount1).toBe(svgCount2); // still renders icon
  });
});

// ─── RiskTooltip ─────────────────────────────────────────────────────────────

describe('RiskTooltip', () => {
  it('returns null when active=false', () => {
    const { container } = render(<RiskTooltip active={false} payload={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('returns null when payload is empty', () => {
    const { container } = render(<RiskTooltip active payload={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('returns null when payload[0].payload is falsy', () => {
    const { container } = render(<RiskTooltip active payload={[{ payload: null as never }]} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders tooltip content when active with full data', () => {
    const payload = [
      {
        payload: {
          fullDate: 'Quarta, 18 Jun',
          stockClose: 250,
          depleted: 15,
          restocked: 0,
          restockDetected: false,
        },
      },
    ];
    render(<RiskTooltip active payload={payload} />);
    expect(screen.getByText('Quarta, 18 Jun')).toBeInTheDocument();
    expect(screen.getByText('250')).toBeInTheDocument();
    expect(screen.getByText('-15')).toBeInTheDocument();
  });

  it('renders restock detected indicator', () => {
    const payload = [
      {
        payload: {
          fullDate: 'Quinta, 19 Jun',
          stockClose: 300,
          restocked: 50,
          restockDetected: true,
        },
      },
    ];
    render(<RiskTooltip active payload={payload} />);
    expect(screen.getByText(/Reposição Detectada/)).toBeInTheDocument();
    expect(screen.getByText('+50')).toBeInTheDocument();
  });

  it('renders dash when stockClose is null', () => {
    const payload = [{ payload: { fullDate: 'Hoje', stockClose: null } }];
    render(<RiskTooltip active payload={payload} />);
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('does not render depleted section when values are 0/null', () => {
    const payload = [
      {
        payload: {
          fullDate: 'Hoje',
          stockClose: 100,
          depleted: 0,
          restocked: null,
        },
      },
    ];
    const { queryByText } = render(<RiskTooltip active payload={payload} />);
    expect(queryByText('Saídas')).toBeNull();
    expect(queryByText('Entradas')).toBeNull();
  });
});

// ─── deriveSeverity (risk/types.ts) ──────────────────────────────────────────

function makeProduct(overrides: Partial<ProductStockSummary> = {}): ProductStockSummary {
  return {
    productId: 'p1',
    productName: 'Produto',
    productSku: 'P1',
    totalCurrentStock: 100,
    totalMinStock: 50,
    totalReservedStock: 0,
    totalInTransitStock: 0,
    totalAvailableStock: 100,
    overallStatus: 'in_stock',
    variantsInStock: 1,
    variantsLowStock: 0,
    variantsCritical: 0,
    variantsOutOfStock: 0,
    totalVariants: 1,
    variants: [],
    availableColors: [],
    ...overrides,
  };
}

describe('deriveSeverity', () => {
  it('incoming overallStatus → warning (mitigated)', () => {
    expect(deriveSeverity(makeProduct({ overallStatus: 'incoming' }))).toBe('warning');
  });

  it('out_of_stock → critical', () => {
    expect(
      deriveSeverity(makeProduct({ overallStatus: 'out_of_stock', totalCurrentStock: 0 })),
    ).toBe('critical');
  });

  it('critical overallStatus → critical', () => {
    expect(deriveSeverity(makeProduct({ overallStatus: 'critical' }))).toBe('critical');
  });

  it('daysUntilFullStockout < 7 (finite) → critical', () => {
    expect(
      deriveSeverity(makeProduct({ overallStatus: 'low_stock', daysUntilFullStockout: 5 })),
    ).toBe('critical');
  });

  it('daysUntilFullStockout = Infinity → NOT critical (fix #15)', () => {
    expect(
      deriveSeverity(makeProduct({ overallStatus: 'low_stock', daysUntilFullStockout: Infinity })),
    ).toBe('warning');
  });

  it('low_stock overallStatus → warning', () => {
    expect(deriveSeverity(makeProduct({ overallStatus: 'low_stock' }))).toBe('warning');
  });

  it('daysUntilFullStockout between 7 and 15 → warning', () => {
    expect(
      deriveSeverity(makeProduct({ overallStatus: 'in_stock', daysUntilFullStockout: 10 })),
    ).toBe('warning');
  });

  it('variantsOutOfStock > 0 → warning', () => {
    expect(deriveSeverity(makeProduct({ variantsOutOfStock: 1 }))).toBe('warning');
  });

  it('variantsCritical > 0 → warning', () => {
    expect(deriveSeverity(makeProduct({ variantsCritical: 1 }))).toBe('warning');
  });

  it('healthy product → ok', () => {
    expect(
      deriveSeverity(makeProduct({ daysUntilFullStockout: 30, overallStatus: 'in_stock' })),
    ).toBe('ok');
  });

  it('no velocity data (undefined daysUntilFullStockout) + in_stock → ok', () => {
    expect(deriveSeverity(makeProduct({ daysUntilFullStockout: undefined }))).toBe('ok');
  });
});

describe('SEVERITY_ORDER', () => {
  it('critical < warning < ok in numeric order', () => {
    expect(SEVERITY_ORDER.critical).toBeLessThan(SEVERITY_ORDER.warning);
    expect(SEVERITY_ORDER.warning).toBeLessThan(SEVERITY_ORDER.ok);
  });
});
