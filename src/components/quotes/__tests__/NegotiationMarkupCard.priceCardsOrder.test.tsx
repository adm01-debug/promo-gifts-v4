import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { NegotiationMarkupCard } from '@/components/quotes/NegotiationMarkupCard';

/**
 * Regressão estrutural do trio (Margem de Negociação + REAL + CLIENTE VÊ):
 *
 * - Presença e ordem dos cards de preço (REAL → CLIENTE VÊ)
 * - Layout vertical empilhado (`flex flex-col`) preservado em qualquer viewport
 *   (JSDOM não aplica media queries — a fixação do token garante que
 *   variantes `sm:`/`md:`/`lg:`/`xl:` não introduzam quebra de coluna)
 * - Espaçamento consistente (`gap-2`, `pt-2`, borda superior de separação)
 * - Alinhamento vertical do trio via `space-y-3` no container do card
 * - data-testids estáveis (`negotiation-markup-card`, `price-card-real`,
 *   `price-card-client`, `negotiation-price-grid`)
 */

const baseProps = {
  value: 10, // ativa o preview de preços
  onChange: () => {},
  realSubtotal: 1000,
  apparentDiscountPercent: 10,
  realDiscountPercent: 5,
  maxDiscountPercent: 20,
};

const VIEWPORT_WRAPPERS: Array<{ label: string; width: string }> = [
  { label: 'mobile (320px)', width: '320px' },
  { label: 'sm (640px)', width: '640px' },
  { label: 'md (768px)', width: '768px' },
  { label: 'lg (1024px)', width: '1024px' },
  { label: 'xl (1440px)', width: '1440px' },
];

describe('NegotiationMarkupCard — trio (margem + REAL + CLIENTE VÊ)', () => {
  it('expõe data-testid nos três alvos (card raiz + REAL + CLIENTE VÊ)', () => {
    render(<NegotiationMarkupCard {...baseProps} />);
    expect(screen.getByTestId('negotiation-markup-card')).toBeInTheDocument();
    expect(screen.getByTestId('negotiation-price-grid')).toBeInTheDocument();
    expect(screen.getByTestId('price-card-real')).toBeInTheDocument();
    expect(screen.getByTestId('price-card-client')).toBeInTheDocument();
  });

  it('renderiza REAL antes de CLIENTE VÊ na ordem do DOM', () => {
    render(<NegotiationMarkupCard {...baseProps} />);
    const real = screen.getByTestId('price-card-real');
    const cliente = screen.getByTestId('price-card-client');
    // Node.DOCUMENT_POSITION_FOLLOWING = 4
    expect(real.compareDocumentPosition(cliente) & 4).toBeTruthy();
  });

  it('trio compartilha o mesmo container do card (alinhamento visual)', () => {
    render(<NegotiationMarkupCard {...baseProps} />);
    const card = screen.getByTestId('negotiation-markup-card');
    const grid = screen.getByTestId('negotiation-price-grid');
    // Header "Margem de Negociação" é filho direto do card
    const header = card.querySelector('h4');
    expect(header?.textContent).toMatch(/Margem de Negociação/i);
    expect(card).toContainElement(header as HTMLElement);
    // Grid dos preços também está dentro do mesmo card
    expect(card).toContainElement(grid);
    // Espaçamento vertical uniforme entre header/slider/grid/preço final
    expect(card.className).toMatch(/\bspace-y-1\.5\b/);
  });

  it('grid empilha REAL sobre CLIENTE com flex-col + gap-1.5 + borda superior', () => {
    render(<NegotiationMarkupCard {...baseProps} />);
    const grid = screen.getByTestId('negotiation-price-grid');
    expect(grid.className).toMatch(/\bflex-col\b/);
    expect(grid.className).toMatch(/\bgap-1\.5\b/);
    expect(grid.className).toMatch(/\bpt-2\b/);
    expect(grid.className).toMatch(/border-t/);
  });

  it('REAL e CLIENTE VÊ são filhos DIRETOS do grid (mesma linha, mesmo alinhamento)', () => {
    render(<NegotiationMarkupCard {...baseProps} />);
    const grid = screen.getByTestId('negotiation-price-grid');
    const real = screen.getByTestId('price-card-real');
    const cliente = screen.getByTestId('price-card-client');
    expect(real.parentElement).toBe(grid);
    expect(cliente.parentElement).toBe(grid);
    expect(grid.children).toHaveLength(2);
    expect(grid.children[0]).toBe(real);
    expect(grid.children[1]).toBe(cliente);
  });

  it.each(VIEWPORT_WRAPPERS)(
    'mantém ordem, presença e horizontalidade do trio em $label',
    ({ width }) => {
      const { unmount } = render(
        <div style={{ width }} data-testid="viewport-wrapper">
          <NegotiationMarkupCard {...baseProps} />
        </div>,
      );
      const card = screen.getByTestId('negotiation-markup-card');
      const grid = screen.getByTestId('negotiation-price-grid');
      const real = screen.getByTestId('price-card-real');
      const cliente = screen.getByTestId('price-card-client');

      // Presença
      expect(card).toBeInTheDocument();
      expect(real).toBeInTheDocument();
      expect(cliente).toBeInTheDocument();

      // Ordem (REAL → CLIENTE VÊ)
      expect(grid.children[0]).toBe(real);
      expect(grid.children[1]).toBe(cliente);

      // Layout vertical empilhado preservado
      expect(grid.className).toMatch(/\bflex-col\b/);
      expect(grid.className).not.toMatch(/\bgrid-cols-2\b/);

      // Bloco "Preço final" removido — informação vive no rodapé do resumo
      expect(card.textContent ?? '').not.toMatch(/preço final/i);
      expect(card.textContent ?? '').not.toMatch(/cliente paga/i);

      unmount();
    },
  );

  it('não renderiza nenhum rótulo ou seção de "Preço final" no card', () => {
    render(<NegotiationMarkupCard {...baseProps} />);
    const card = screen.getByTestId('negotiation-markup-card');
    expect(card.textContent ?? '').not.toMatch(/preço final/i);
    expect(card.textContent ?? '').not.toMatch(/cliente paga/i);
    expect(screen.queryByText(/preço final/i)).toBeNull();
    expect(screen.queryByText(/cliente paga/i)).toBeNull();
  });

  it('bloco do slider mantém pt-4 (mobile) e sm:pt-3 (desktop) para respiro', () => {
    render(<NegotiationMarkupCard {...baseProps} />);
    const label = screen.getByText('Acréscimo no preço apresentado');
    const sliderBlock = label.closest('div')?.parentElement;
    expect(sliderBlock).not.toBeNull();
    expect(sliderBlock!.className).toMatch(/\bpt-4\b/);
    expect(sliderBlock!.className).toMatch(/\bsm:pt-3\b/);
    expect(sliderBlock!.className).toMatch(/\bspace-y-1\.5\b/);
    expect(sliderBlock!.className).toMatch(/\bsm:space-y-1\b/);
  });

  it('a11y: slider expõe aria-label e aria-valuenow; ruler é aria-hidden', () => {
    render(<NegotiationMarkupCard {...baseProps} />);
    const slider = screen.getByRole('slider');
    expect(slider).toHaveAttribute('aria-valuenow', '10');
    const ruler = screen.getByText('0%').parentElement;
    expect(ruler).toHaveAttribute('aria-hidden', 'true');
    // aria-label vai no root do Slider (irmão do thumb)
    expect(
      document.querySelector('[aria-label="Margem de negociação em porcentagem"]'),
    ).not.toBeNull();
  });
});
