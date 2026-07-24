import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { NegotiationMarkupCard } from '@/components/quotes/NegotiationMarkupCard';

/**
 * Cobertura complementar do NegotiationMarkupCard:
 *  - Snapshots por viewport (desktop / mobile) garantindo ausência de rótulos
 *    de "preço final" e preservação do bloco do slider.
 *  - Paridade de escala de spacing (px-3/px-2.5) com QuoteBuilderSummaryColumn.
 *  - A11y de teclado: foco visível, aria-valuenow atualizado e aria-live no %.
 */

const baseProps = {
  value: 10,
  onChange: () => {},
  realSubtotal: 1000,
  apparentDiscountPercent: 10,
  realDiscountPercent: 5,
  maxDiscountPercent: 20,
};

const VIEWPORTS = [
  { label: 'mobile', width: 375 },
  { label: 'desktop', width: 1440 },
];

describe('NegotiationMarkupCard — snapshots visuais por viewport', () => {
  it.each(VIEWPORTS)('snapshot em $label ($width px) sem rótulo de preço final', ({ width }) => {
    const originalInnerWidth = window.innerWidth;
    Object.defineProperty(window, 'innerWidth', { value: width, configurable: true });

    const { container, unmount } = render(<NegotiationMarkupCard {...baseProps} />);
    const card = screen.getByTestId('negotiation-markup-card');

    // Nenhum rótulo de preço final
    expect(card.textContent ?? '').not.toMatch(/preço final/i);
    expect(card.textContent ?? '').not.toMatch(/cliente paga/i);

    // Bloco do slider preserva alinhamento e respiro
    const label = screen.getByText('Acréscimo no preço apresentado');
    const block = label.closest('div')?.parentElement;
    expect(block?.className).toMatch(/pt-4/);
    expect(block?.className).toMatch(/sm:pt-3/);

    expect(container.firstChild).toMatchSnapshot();

    unmount();
    Object.defineProperty(window, 'innerWidth', { value: originalInnerWidth, configurable: true });
  });
});

describe('NegotiationMarkupCard — paridade de spacing com QuoteBuilderSummaryColumn', () => {
  it('usa escala responsiva px-3/py-2.5 (mobile) → sm:px-2.5/sm:py-2 (desktop)', () => {
    render(<NegotiationMarkupCard {...baseProps} />);
    const card = screen.getByTestId('negotiation-markup-card');
    expect(card.className).toMatch(/\bpx-3\b/);
    expect(card.className).toMatch(/\bpy-2\.5\b/);
    expect(card.className).toMatch(/\bsm:px-2\.5\b/);
    expect(card.className).toMatch(/\bsm:py-2\b/);
  });

  it('linha de desconto (grid REAL/CLIENTE) mantém padding-top consistente com separador', () => {
    render(<NegotiationMarkupCard {...baseProps} />);
    const grid = screen.getByTestId('negotiation-price-grid');
    expect(grid.className).toMatch(/\bpt-2\b/);
    expect(grid.className).toMatch(/border-t/);
  });
});

describe('NegotiationMarkupCard — a11y de teclado no slider', () => {
  it('slider é focável e responde a ArrowRight/ArrowLeft/Home/End atualizando aria-valuenow', () => {
    const onChange = vi.fn();
    render(<NegotiationMarkupCard {...baseProps} value={10} onChange={onChange} />);
    const slider = screen.getByRole('slider');

    slider.focus();
    expect(slider).toHaveFocus();

    fireEvent.keyDown(slider, { key: 'ArrowRight' });
    expect(onChange).toHaveBeenLastCalledWith(11);

    fireEvent.keyDown(slider, { key: 'ArrowLeft' });
    fireEvent.keyDown(slider, { key: 'ArrowLeft' });
    expect(onChange).toHaveBeenLastCalledWith(9);

    fireEvent.keyDown(slider, { key: 'Home' });
    expect(onChange).toHaveBeenLastCalledWith(0);

    fireEvent.keyDown(slider, { key: 'End' });
    expect(onChange).toHaveBeenLastCalledWith(50);
  });

  it('label do slider e aria-live do % permitem leitura correta ao ajustar', () => {
    const { rerender } = render(<NegotiationMarkupCard {...baseProps} value={10} />);
    const label = screen.getByText('Acréscimo no preço apresentado');
    expect(label).toHaveAttribute('for', 'negotiation-markup-slider');

    const percent = screen.getByText('+10%');
    expect(percent).toHaveAttribute('aria-live', 'polite');
    expect(percent).toHaveAttribute('aria-atomic', 'true');

    rerender(<NegotiationMarkupCard {...baseProps} value={25} />);
    const updated = screen.getByText('+25%');
    expect(updated).toHaveAttribute('aria-live', 'polite');
    expect(screen.getByRole('slider')).toHaveAttribute('aria-valuenow', '25');
  });

  it('slider expõe aria-label descritivo no root do Radix', () => {
    render(<NegotiationMarkupCard {...baseProps} />);
    expect(
      document.querySelector('[aria-label="Margem de negociação em porcentagem"]'),
    ).not.toBeNull();
  });
});
