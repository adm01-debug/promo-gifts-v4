import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { NegotiationMarkupCard } from '@/components/quotes/NegotiationMarkupCard';

/**
 * Regressão estrutural: quando o markup está ativo, os cards de preço
 * (REAL e CLIENTE VÊ) devem aparecer logo após o header "Margem de Negociação",
 * empilhados em coluna única (grid-cols-1) — REAL primeiro, CLIENTE VÊ depois —
 * em todas as larguras de tela.
 */
describe('NegotiationMarkupCard — ordem dos cards de preço', () => {
  const props = {
    value: 10, // ativa o preview
    onChange: () => {},
    realSubtotal: 1000,
    apparentDiscountPercent: 10,
    realDiscountPercent: 5,
    maxDiscountPercent: 20,
  };

  it('renderiza REAL antes de CLIENTE VÊ na ordem do DOM', () => {
    render(<NegotiationMarkupCard {...props} />);
    const real = screen.getByText(/Real \(interno\)/i);
    const cliente = screen.getByText(/Cliente vê/i);
    expect(real).toBeInTheDocument();
    expect(cliente).toBeInTheDocument();
    // Node.DOCUMENT_POSITION_FOLLOWING = 4
    expect(real.compareDocumentPosition(cliente) & 4).toBeTruthy();
  });

  it('usa grid-cols-1 (empilhamento vertical em qualquer viewport)', () => {
    const { container } = render(<NegotiationMarkupCard {...props} />);
    const grid = container.querySelector('.grid.grid-cols-1');
    expect(grid).not.toBeNull();
    // Sem variante responsiva sm:/md:/lg: que quebre em 2 colunas
    expect(grid?.className).not.toMatch(/grid-cols-2/);
  });

  it('os dois cards são filhos diretos do mesmo grid (mesmo alinhamento)', () => {
    const { container } = render(<NegotiationMarkupCard {...props} />);
    const grid = container.querySelector('.grid.grid-cols-1') as HTMLElement;
    const real = screen.getByText(/Real \(interno\)/i).closest('div.rounded-lg');
    const cliente = screen.getByText(/Cliente vê/i).closest('div.rounded-lg');
    expect(real?.parentElement).toBe(grid);
    expect(cliente?.parentElement).toBe(grid);
    expect(grid.children[0]).toBe(real);
    expect(grid.children[1]).toBe(cliente);
  });
});
