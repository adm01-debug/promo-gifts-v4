/**
 * Suíte EXAUSTIVA do SSOT de swatch (getColorSwatchClasses) + matriz de render.
 *
 * Foco da correção validada aqui (fix/swatch-out-of-stock-keep-color):
 *   Bolinha SEM ESTOQUE deve MANTER a cor (sem grayscale/opacity-40) e exibir
 *   APENAS o risco diagonal (::before). Estas asserções travam o comportamento
 *   contra regressões (defesa anti-Lovable bot).
 */
import { render, screen, cleanup } from '@testing-library/react';
import { describe, it, expect, afterEach } from 'vitest';
import { ProductColorSwatches } from '@/components/products/ProductColorSwatches';
import { getColorSwatchClasses } from '@/components/shared/ColorSwatch';
import { TooltipProvider } from '@/components/ui/tooltip';

afterEach(cleanup);

function hexToRgb(hex: string): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgb(${r}, ${g}, ${b})`;
}

// ─────────────────────────────────────────────────────────────────────────────
// 1) SSOT — getColorSwatchClasses: todas as 8 combinações booleanas
// ─────────────────────────────────────────────────────────────────────────────
describe('getColorSwatchClasses (SSOT) — invariantes por estado', () => {
  const bools = [false, true];
  const combos: Array<{ isActive: boolean; isOutOfStock: boolean; hasBg: boolean }> = [];
  for (const isActive of bools)
    for (const isOutOfStock of bools)
      for (const hasBg of bools) combos.push({ isActive, isOutOfStock, hasBg });

  it.each(combos)(
    'isActive=$isActive isOutOfStock=$isOutOfStock hasBg=$hasBg',
    ({ isActive, isOutOfStock, hasBg }) => {
      const cls = getColorSwatchClasses({ isActive, isOutOfStock, hasBg });

      // Base sempre presente
      expect(cls).toContain('relative');
      expect(cls).toContain('rounded-full');
      expect(cls).toContain('border');

      // Ativo ⇒ ring; inativo ⇒ sem ring-primary
      if (isActive) expect(cls).toContain('ring-primary');
      else expect(cls).not.toContain('ring-primary');

      // Sem bg ⇒ borda tracejada
      if (hasBg) expect(cls).not.toContain('border-dashed');
      else expect(cls).toContain('border-dashed');

      // ESGOTADO ⇒ risco diagonal, e NUNCA dessaturação
      if (isOutOfStock) {
        expect(cls).toContain('before:rounded-full');
        expect(cls).toContain('before:bg-[linear-gradient(45deg');
        expect(cls).toContain('before:content-[""]');
        expect(cls).not.toContain('grayscale'); // CORE: cor preservada
        expect(cls).not.toContain('opacity-40'); // CORE: cor preservada
      } else {
        // Em estoque NÃO tem o risco
        expect(cls).not.toContain('before:bg-[linear-gradient');
      }
    },
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// 2) MATRIZ DE RENDER — centenas de simulações no DOM
// ─────────────────────────────────────────────────────────────────────────────
const COLORS: Array<{ name: string; hex: string }> = [
  { name: 'Branco', hex: '#FFFFFF' },
  { name: 'Amarelo', hex: '#FFFF00' },
  { name: 'Preto', hex: '#000000' },
  { name: 'Vermelho', hex: '#FF0000' },
  { name: 'Azul', hex: '#0000FF' },
  { name: 'Verde', hex: '#00FF00' },
  { name: 'Quase-Branco', hex: '#FAFAFA' },
  { name: 'Quase-Preto', hex: '#0A0A0A' },
  { name: 'Laranja', hex: '#FF8800' },
  { name: 'Roxo', hex: '#8800FF' },
  { name: 'Ciano', hex: '#00FFFF' },
  { name: 'Magenta', hex: '#FF00FF' },
  { name: 'Cinza', hex: '#808080' },
  { name: 'Marrom', hex: '#8B4513' },
  { name: 'Bege', hex: '#F5F5DC' },
  { name: 'Navy', hex: '#000080' },
];
const SIZES = ['xs', 'sm', 'md'] as const;
const STOCK = ['in', 'out', 'upcoming'] as const;

function buildColor(c: { name: string; hex: string }, stock: (typeof STOCK)[number]) {
  if (stock === 'in') return { ...c, stockQty: 10 };
  if (stock === 'out') return { ...c, stockQty: 0 };
  return { ...c, stockQty: 0, hasUpcomingRestock: true, nextRestockDate: '2026-12-01' };
}

function renderOne(
  c: { name: string; hex: string },
  stock: (typeof STOCK)[number],
  selected: boolean,
  size: (typeof SIZES)[number],
) {
  render(
    <TooltipProvider>
      <ProductColorSwatches
        colors={[buildColor(c, stock)]}
        selectedName={selected ? c.name : null}
        size={size}
        hideWhenEmpty={false}
        wrap
      />
    </TooltipProvider>,
  );
  return screen.getByRole('radio');
}

function assertInvariants(
  btn: HTMLElement,
  c: { name: string; hex: string },
  stock: (typeof STOCK)[number],
  selected: boolean,
) {
  // COR PRESERVADA em TODOS os estados (a falha original era perder a cor)
  expect(btn.style.backgroundColor).toBe(hexToRgb(c.hex));
  expect(btn.className).not.toContain('grayscale');
  expect(btn.className).not.toContain('opacity-40');

  if (selected) expect(btn.className).toContain('ring-primary');

  if (stock === 'out') {
    expect(btn.getAttribute('data-stock-state')).toBe('out');
    expect(btn.getAttribute('aria-label')).toMatch(/esgotada/);
    expect(btn.className).toContain('before:rounded-full'); // risco presente
  } else if (stock === 'in') {
    expect(btn.getAttribute('data-stock-state')).toBe('in-stock');
    expect(btn.className).not.toContain('before:rounded-full'); // sem risco
  } else {
    expect(btn.getAttribute('data-stock-state')).toBe('upcoming');
    expect(btn.className).not.toContain('before:rounded-full'); // previsto ≠ esgotado
    expect(btn.querySelector('[data-testid="swatch-upcoming-dot"]')).not.toBeNull();
  }
}

describe('ProductColorSwatches — matriz exaustiva (cor preservada + risco)', () => {
  it('valida 288 combinações (16 cores × 3 estoques × 2 seleção × 3 tamanhos)', () => {
    let n = 0;
    for (const c of COLORS)
      for (const stock of STOCK)
        for (const selected of [false, true])
          for (const size of SIZES) {
            const btn = renderOne(c, stock, selected, size);
            assertInvariants(btn, c, stock, selected);
            cleanup();
            n++;
          }
    expect(n).toBe(16 * 3 * 2 * 3);
    // eslint-disable-next-line no-console
    console.log(`✓ matriz: ${n} simulações de DOM aprovadas`);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3) FUZZ — 200 casos aleatórios
// ─────────────────────────────────────────────────────────────────────────────
describe('ProductColorSwatches — fuzz aleatório', () => {
  it('200 casos aleatórios mantêm invariantes', () => {
    let seed = 0xC0FFEE;
    const rng = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
    const randHex = () => {
      const v = Math.floor(rng() * 0xffffff);
      return `#${v.toString(16).padStart(6, '0').toUpperCase()}`;
    };
    let n = 0;
    for (let i = 0; i < 200; i++) {
      const hex = randHex();
      const c = { name: `Cor${i}`, hex };
      const stock = STOCK[Math.floor(rng() * 3)];
      const selected = rng() > 0.5;
      const size = SIZES[Math.floor(rng() * 3)];
      const btn = renderOne(c, stock, selected, size);
      assertInvariants(btn, c, stock, selected);
      cleanup();
      n++;
    }
    expect(n).toBe(200);
    // eslint-disable-next-line no-console
    console.log(`✓ fuzz: ${n} casos aleatórios aprovados`);
  });
});
