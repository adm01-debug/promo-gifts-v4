import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { NegotiationMarkupCard } from '@/components/quotes/NegotiationMarkupCard';

/**
 * Regressão visual estrutural:
 *  - Header em UMA ÚNICA LINHA: ícone + título + info + badge "Uso interno" + switch
 *  - SEM o parágrafo descritivo de baixo no estado desativado (o tooltip já cobre)
 */
describe('NegotiationMarkupCard — header em linha única', () => {
  const baseProps = {
    value: 0,
    onChange: () => {},
    realSubtotal: 1000,
    apparentDiscountPercent: 0,
    realDiscountPercent: 0,
    maxDiscountPercent: 100,
  };

  it('renderiza header sem o texto descritivo "Ative para inflar..."', () => {
    render(<NegotiationMarkupCard {...baseProps} />);
    expect(screen.getByText('Margem de Negociação')).toBeInTheDocument();
    expect(screen.getByText('Uso interno')).toBeInTheDocument();
    expect(screen.queryByText(/Ative para inflar o subtotal/i)).not.toBeInTheDocument();
  });

  it('coloca título, badge e switch como irmãos diretos (uma linha)', () => {
    const { container } = render(<NegotiationMarkupCard {...baseProps} />);
    const title = screen.getByText('Margem de Negociação');
    const badge = screen.getByText('Uso interno');
    const switchEl = container.querySelector('[role="switch"]');

    // Todos devem compartilhar o MESMO contêiner header (flex items-center justify-between)
    const header = title.closest('.flex.items-center.justify-between');
    expect(header).not.toBeNull();
    expect(header).toContainElement(badge);
    expect(header).toContainElement(switchEl as HTMLElement);
  });

  it('não renderiza nenhum <p> descritivo no estado desativado', () => {
    const { container } = render(<NegotiationMarkupCard {...baseProps} />);
    // O switch está desligado (value=0) -> não deve haver paragraph longo abaixo
    const paragraphs = Array.from(container.querySelectorAll('p'));
    const longText = paragraphs.find((p) => (p.textContent ?? '').length > 60);
    expect(longText).toBeUndefined();
  });
});
