import { describe, it, expect, beforeAll, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StockHelpTooltip } from '../StockHelpTooltip';

beforeAll(() => {
  const proto = Element.prototype as unknown as Record<string, unknown>;
  proto.hasPointerCapture = vi.fn(() => false);
  proto.setPointerCapture = vi.fn();
  proto.releasePointerCapture = vi.fn();
  proto.scrollIntoView = vi.fn();
});

describe('StockHelpTooltip', () => {
  it('renders the default help icon trigger with accessible label', () => {
    render(<StockHelpTooltip title="Busca" description="Procure por nome ou SKU" />);
    expect(screen.getByLabelText('Ajuda: Busca')).toBeInTheDocument();
  });

  it('renders provided children instead of default icon', () => {
    render(
      <StockHelpTooltip title="Cor" description="Filtra por grupo de cor">
        <button type="button">gatilho</button>
      </StockHelpTooltip>,
    );
    expect(screen.getByRole('button', { name: 'gatilho' })).toBeInTheDocument();
    expect(screen.getByLabelText('Ajuda: Cor')).toBeInTheDocument();
  });

  it('renders accessible label derived from the title prop', () => {
    render(<StockHelpTooltip title="Quantidade" description="Mínimo necessário" />);
    expect(screen.getByLabelText('Ajuda: Quantidade')).toBeInTheDocument();
  });

  it('renders without crashing when optional example and emptyHint are provided', () => {
    render(
      <StockHelpTooltip
        title="Status"
        description="Filtra por situação"
        example="Sem estoque"
        emptyHint="Tente limpar filtros"
      />,
    );
    expect(screen.getByLabelText('Ajuda: Status')).toBeInTheDocument();
  });
});
