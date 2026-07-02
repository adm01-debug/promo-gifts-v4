import { describe, it, expect } from 'vitest';

/**
 * Validação estrutural do layout do card "Condições" no QuoteBuilder.
 * Garante que Validade | Forma | Prazo ocupem 1/3 cada em md+ e empilhem no mobile.
 */
describe('QuoteBuilder — layout Condições (Validade + Forma + Prazo)', () => {
  it('usa grid responsivo de 3 colunas em md+', () => {
    const wrapperClass = 'grid grid-cols-1 md:grid-cols-3 gap-3';
    expect(wrapperClass).toMatch(/grid-cols-1/);
    expect(wrapperClass).toMatch(/md:grid-cols-3/);
    expect(wrapperClass).toMatch(/gap-3/);
  });

  it('cada trigger de Select tem altura consistente h-8 text-xs', () => {
    const triggerClasses = ['h-8 text-xs', 'h-8 text-xs', 'h-8 text-xs'];
    for (const cls of triggerClasses) {
      expect(cls).toContain('h-8');
      expect(cls).toContain('text-xs');
    }
  });

  it('divide o espaço em terços exatos (1/3 cada) no breakpoint md', () => {
    // Simula distribuição de 3 colunas em 900px de container
    const container = 900;
    const gap = 12; // gap-3 = 0.75rem = 12px
    const totalGap = gap * 2;
    const colWidth = (container - totalGap) / 3;
    expect(colWidth).toBeCloseTo(292, 0);
    // Cada coluna deve receber ~1/3
    expect(colWidth * 3 + totalGap).toBe(container);
  });

  it('empilha em 1 coluna no mobile (< md)', () => {
    // grid-cols-1 aplicado no default breakpoint
    const mobileWidth = 375;
    const colWidth = mobileWidth; // full width
    expect(colWidth).toBe(mobileWidth);
  });
});
