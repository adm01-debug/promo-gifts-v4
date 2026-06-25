/**
 * ColorSwatchInlineSelect.exhaustive.test.tsx — BATERIA EXAUSTIVA
 * Valida: seleção inline de cor sem abrir QuickView automaticamente.
 * Cobertura: ProductColorSwatches + BaseProductGridCard + auditoria estática dos 4 componentes.
 */
import type { ReactNode } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ProductColorSwatches } from '../ProductColorSwatches';
import type { ColorDotLike } from '../ProductColorSwatches';
import { BaseProductGridCard } from '../BaseProductGridCard';
import { readFileSync } from 'fs';

vi.mock('@/components/products/ProductQuickActionsFAB', () => ({ ProductQuickActionsFAB: () => null }));
vi.mock('@/components/products/ProductCategoryBadges', () => ({ ProductCategoryBadges: () => null }));
vi.mock('@/components/products/QuickViewThumb', () => ({
  QuickViewThumb: ({ children, testId }: { children?: ReactNode; testId?: string }) => (
    <div
      data-testid={testId ?? 'qv-thumb'}
      role="button"
      aria-label="QuickView"
      data-qv-opened="false"
      onClick={() => {
        const el = document.querySelector(`[data-testid="${testId ?? 'qv-thumb'}"]`);
        if (el) el.setAttribute('data-qv-opened', 'true');
      }}
    >
      {children}
    </div>
  ),
}));
vi.mock('@/components/products/HoverSetImage', () => ({
  HoverSetImage: ({ primary, alt }: { primary?: string | null; alt?: string }) => (
    <img data-testid="hsi-img" src={primary ?? ''} alt={alt ?? ''} />
  ),
}));

const COLORS: ColorDotLike[] = [
  { name: 'Azul',     hex: '#00f', image: 'img/azul.png',     stockQty: 3   },
  { name: 'Verde',    hex: '#0f0', image: 'img/verde.png',    stockQty: 0   },
  { name: 'Preto',    hex: '#000', image: 'img/preto.png',    stockQty: 500 },
  { name: 'Limiar',   hex: '#888', image: 'img/limiar.png',   stockQty: 10  },
  { name: 'Negativa', hex: '#111', image: 'img/neg.png',      stockQty: -5  },
  { name: 'Sem Img',  hex: '#222', image: null,               stockQty: 20  },
  { name: 'Sem Qty',  hex: '#333', image: 'img/sem-qty.png'                 },
];

function wrap(node: ReactNode) {
  return render(<MemoryRouter><TooltipProvider>{node}</TooltipProvider></MemoryRouter>);
}

function renderCard(ovr: { colors?: ColorDotLike[]; stockQuantity?: number; onClick?: () => void } = {}) {
  const onClick = ovr.onClick ?? vi.fn();
  const utils = wrap(
    <BaseProductGridCard
      productId="p1" productName="Produto" productImage="img/default.png"
      basePrice={99} minQuantity={1} stockQuantity={ovr.stockQuantity ?? 200}
      stockStatus={null} colors={ovr.colors ?? COLORS} onClick={onClick}
      testId="card" footerTestId="footer" thumbTestId="qv-thumb"
    />,
  );
  return { ...utils, onClick };
}

// ═══════════════════════════════════════════════════════════════════════════
// SUITE 1 — ProductColorSwatches engine
// ═══════════════════════════════════════════════════════════════════════════
describe('Suite 1 — ProductColorSwatches engine', () => {
  it('S1-01: renderiza todas as cores', () => {
    wrap(<ProductColorSwatches colors={COLORS} max={10} hideWhenEmpty={false} />);
    ['azul','verde','preto','limiar','negativa'].forEach(n =>
      expect(document.querySelector(`[data-testid="color-swatch-${n}"]`)).not.toBeNull()
    );
  });

  it('S1-02: sem seleção → aria-checked=false em todos', () => {
    const { getAllByRole } = wrap(<ProductColorSwatches colors={COLORS} max={10} />);
    getAllByRole('radio').forEach(r => expect(r.getAttribute('aria-checked')).toBe('false'));
  });

  it('S1-03: sem seleção → sem botão Todos', () => {
    const { queryByTestId } = wrap(<ProductColorSwatches colors={COLORS} max={10} onClear={vi.fn()} />);
    expect(queryByTestId('color-swatches-clear')).toBeNull();
  });

  it('S1-04: lista vazia hideWhenEmpty=true → sem botão radio', () => {
    const { queryByRole } = wrap(<ProductColorSwatches colors={[]} hideWhenEmpty={true} />);
    expect(queryByRole('radio')).toBeNull();
  });

  it('S1-05: lista vazia hideWhenEmpty=false → N/A', () => {
    const { getByTestId } = wrap(<ProductColorSwatches colors={[]} hideWhenEmpty={false} />);
    expect(getByTestId('colors-unavailable')).not.toBeNull();
  });

  it('S1-06: undefined → skeleton de loading', () => {
    const { getByTestId } = wrap(<ProductColorSwatches colors={undefined} />);
    expect(getByTestId('colors-loading-skeleton')).not.toBeNull();
  });

  it('S1-07: selectedName="Azul" → aria-checked=true em Azul', () => {
    const { getByTestId } = wrap(<ProductColorSwatches colors={COLORS} max={10} selectedName="Azul" />);
    expect(getByTestId('color-swatch-azul').getAttribute('aria-checked')).toBe('true');
    expect(getByTestId('color-swatch-verde').getAttribute('aria-checked')).toBe('false');
  });

  it('S1-08: selectedName case-insensitive "azul" ≡ "Azul"', () => {
    const { getByTestId } = wrap(<ProductColorSwatches colors={COLORS} max={10} selectedName="azul" />);
    expect(getByTestId('color-swatch-azul').getAttribute('aria-checked')).toBe('true');
  });

  it('S1-09: onSelect chamado com cor e índice corretos', () => {
    const onSelect = vi.fn();
    const { getByTestId } = wrap(<ProductColorSwatches colors={COLORS} max={10} onSelect={onSelect} />);
    fireEvent.click(getByTestId('color-swatch-preto'));
    expect(onSelect).toHaveBeenCalledWith(COLORS[2], 2);
  });

  it('S1-10: clique na cor não propaga para container pai', () => {
    const containerClick = vi.fn();
    const onSelect = vi.fn();
    const { getByTestId } = render(
      <div onClick={containerClick}>
        <MemoryRouter><TooltipProvider>
          <ProductColorSwatches colors={COLORS} max={10} onSelect={onSelect} />
        </TooltipProvider></MemoryRouter>
      </div>
    );
    fireEvent.click(getByTestId('color-swatch-azul'));
    expect(onSelect).toHaveBeenCalled();
    expect(containerClick).not.toHaveBeenCalled();
  });

  it('S1-11: selectedName + onClear → botão Todos visível', () => {
    const { getByTestId } = wrap(
      <ProductColorSwatches colors={COLORS} max={10} selectedName="Azul" onClear={vi.fn()} />
    );
    expect(getByTestId('color-swatches-clear')).not.toBeNull();
  });

  it('S1-12: selectedName sem onClear → sem botão Todos', () => {
    const { queryByTestId } = wrap(
      <ProductColorSwatches colors={COLORS} max={10} selectedName="Azul" />
    );
    expect(queryByTestId('color-swatches-clear')).toBeNull();
  });

  it('S1-13: onClear chamado ao clicar em Todos', () => {
    const onClear = vi.fn();
    const { getByTestId } = wrap(
      <ProductColorSwatches colors={COLORS} max={10} selectedName="Azul" onClear={onClear} />
    );
    fireEvent.click(getByTestId('color-swatches-clear'));
    expect(onClear).toHaveBeenCalledTimes(1);
  });

  it('S1-14: Todos não propaga para container', () => {
    const containerClick = vi.fn();
    const onClear = vi.fn();
    render(
      <div onClick={containerClick}>
        <MemoryRouter><TooltipProvider>
          <ProductColorSwatches colors={COLORS} max={10} selectedName="Azul" onClear={onClear} />
        </TooltipProvider></MemoryRouter>
      </div>
    );
    fireEvent.click(document.querySelector('[data-testid="color-swatches-clear"]')!);
    expect(onClear).toHaveBeenCalled();
    expect(containerClick).not.toHaveBeenCalled();
  });

  it('S1-15: Todos via teclado Enter', () => {
    const onClear = vi.fn();
    const { getByTestId } = wrap(
      <ProductColorSwatches colors={COLORS} max={10} selectedName="Azul" onClear={onClear} />
    );
    fireEvent.keyDown(getByTestId('color-swatches-clear'), { key: 'Enter' });
    expect(onClear).toHaveBeenCalledTimes(1);
  });

  it('S1-16: Todos via teclado Space', () => {
    const onClear = vi.fn();
    const { getByTestId } = wrap(
      <ProductColorSwatches colors={COLORS} max={10} selectedName="Azul" onClear={onClear} />
    );
    fireEvent.keyDown(getByTestId('color-swatches-clear'), { key: ' ' });
    expect(onClear).toHaveBeenCalledTimes(1);
  });

  it('S1-17: max=3 com 7 cores → chip +4', () => {
    const { getByTestId } = wrap(<ProductColorSwatches colors={COLORS} max={3} />);
    expect(getByTestId('color-swatches-overflow').textContent).toContain('+4');
  });

  it('S1-18: max=10 com 7 cores → sem chip', () => {
    const { queryByTestId } = wrap(<ProductColorSwatches colors={COLORS} max={10} />);
    expect(queryByTestId('color-swatches-overflow')).toBeNull();
  });

  it('S1-19: onSelect via teclado Enter', () => {
    const onSelect = vi.fn();
    const { getByTestId } = wrap(<ProductColorSwatches colors={COLORS} max={10} onSelect={onSelect} />);
    fireEvent.keyDown(getByTestId('color-swatch-verde'), { key: 'Enter' });
    expect(onSelect).toHaveBeenCalledWith(COLORS[1], 1);
  });

  it('S1-20: onSelect via teclado Space', () => {
    const onSelect = vi.fn();
    const { getByTestId } = wrap(<ProductColorSwatches colors={COLORS} max={10} onSelect={onSelect} />);
    fireEvent.keyDown(getByTestId('color-swatch-preto'), { key: ' ' });
    expect(onSelect).toHaveBeenCalledWith(COLORS[2], 2);
  });

  it('S1-21: container tem role=radiogroup', () => {
    const { getByRole } = wrap(<ProductColorSwatches colors={COLORS} max={10} />);
    expect(getByRole('radiogroup')).not.toBeNull();
  });

  it('S1-22: quantidade de radios = quantidade de cores visíveis', () => {
    const { getAllByRole } = wrap(<ProductColorSwatches colors={COLORS} max={10} />);
    expect(getAllByRole('radio').length).toBe(COLORS.length);
  });

  it('S1-23: cor esgotada sem restock → data-stock-state=out', () => {
    const c: ColorDotLike[] = [{ name: 'Coral', hex: '#f00', stockQty: 0, hasUpcomingRestock: false }];
    const { getByTestId } = wrap(<ProductColorSwatches colors={c} max={5} />);
    expect(getByTestId('color-swatch-coral').getAttribute('data-stock-state')).toBe('out');
  });

  it('S1-24: cor upcoming → data-stock-state=upcoming + dot badge', () => {
    const c: ColorDotLike[] = [{ name: 'Menta', hex: '#9f9', stockQty: 0, hasUpcomingRestock: true }];
    const { getByTestId } = wrap(<ProductColorSwatches colors={c} max={5} />);
    expect(getByTestId('color-swatch-menta').getAttribute('data-stock-state')).toBe('upcoming');
    expect(getByTestId('swatch-upcoming-dot')).not.toBeNull();
  });

  it('S1-25: cor in-stock → data-stock-state=in-stock', () => {
    const c: ColorDotLike[] = [{ name: 'Jade', hex: '#0a0', stockQty: 50 }];
    const { getByTestId } = wrap(<ProductColorSwatches colors={c} max={5} />);
    expect(getByTestId('color-swatch-jade').getAttribute('data-stock-state')).toBe('in-stock');
  });

  it('S1-26: cor sem stockQty → data-stock-state=null (sem info)', () => {
    const c: ColorDotLike[] = [{ name: 'Rubi', hex: '#800' }];
    const { getByTestId } = wrap(<ProductColorSwatches colors={c} max={5} />);
    expect(getByTestId('color-swatch-rubi').getAttribute('data-stock-state')).toBeNull();
  });

  it('S1-27: sem onSelect → clique não lança erro', () => {
    const { getByTestId } = wrap(<ProductColorSwatches colors={COLORS} max={10} />);
    expect(() => fireEvent.click(getByTestId('color-swatch-azul'))).not.toThrow();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SUITE 2 — BaseProductGridCard interação de cor
// ═══════════════════════════════════════════════════════════════════════════
describe('Suite 2 — BaseProductGridCard inline color selection', () => {
  it('S2-01: estado inicial → img default, 200 un., sem Todos', () => {
    const { getByTestId, queryByTestId } = renderCard();
    expect(getByTestId('hsi-img').getAttribute('src')).toBe('img/default.png');
    expect(within(getByTestId('footer')).getByText(/200 un\./)).not.toBeNull();
    expect(queryByTestId('color-swatches-clear')).toBeNull();
  });

  it('S2-02: estado inicial → nenhum swatch com aria-checked=true', () => {
    const { getAllByRole } = renderCard();
    getAllByRole('radio').forEach(r => expect(r.getAttribute('aria-checked')).toBe('false'));
  });

  // R1 — Clicar bolinha NÃO dispara onClick do card
  it('S2-03 [R1]: clicar Azul NÃO chama onClick', () => {
    const { getByTestId, onClick } = renderCard();
    fireEvent.click(getByTestId('color-swatch-azul'));
    expect(onClick).not.toHaveBeenCalled();
  });

  it('S2-04 [R1]: clicar Verde NÃO chama onClick', () => {
    const { getByTestId, onClick } = renderCard();
    fireEvent.click(getByTestId('color-swatch-verde'));
    expect(onClick).not.toHaveBeenCalled();
  });

  it('S2-05 [R1]: clicar Preto NÃO chama onClick', () => {
    const { getByTestId, onClick } = renderCard();
    fireEvent.click(getByTestId('color-swatch-preto'));
    expect(onClick).not.toHaveBeenCalled();
  });

  it('S2-06 [R1]: clicar Todos NÃO chama onClick', () => {
    const { getByTestId, onClick } = renderCard();
    fireEvent.click(getByTestId('color-swatch-azul'));
    fireEvent.click(getByTestId('color-swatches-clear'));
    expect(onClick).not.toHaveBeenCalled();
  });

  it('S2-07 [R1]: clicar no CORPO do card chama onClick', () => {
    const { getByTestId, onClick } = renderCard();
    fireEvent.click(getByTestId('card'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  // R2 — Ring visual + aria-checked
  it('S2-08 [R2]: selecionar Azul → aria-checked=true', () => {
    const { getByTestId } = renderCard();
    fireEvent.click(getByTestId('color-swatch-azul'));
    expect(getByTestId('color-swatch-azul').getAttribute('aria-checked')).toBe('true');
  });

  it('S2-09 [R2]: selecionar Azul → outros ficam false', () => {
    const { getByTestId } = renderCard();
    fireEvent.click(getByTestId('color-swatch-azul'));
    expect(getByTestId('color-swatch-verde').getAttribute('aria-checked')).toBe('false');
    expect(getByTestId('color-swatch-preto').getAttribute('aria-checked')).toBe('false');
  });

  it('S2-10 [R2]: trocar A→B → B ativo, A inativo', () => {
    const { getByTestId } = renderCard();
    fireEvent.click(getByTestId('color-swatch-azul'));
    fireEvent.click(getByTestId('color-swatch-verde'));
    expect(getByTestId('color-swatch-verde').getAttribute('aria-checked')).toBe('true');
    expect(getByTestId('color-swatch-azul').getAttribute('aria-checked')).toBe('false');
  });

  // R3 — Imagem muda
  it('S2-11 [R3]: Azul → img/azul.png', () => {
    const { getByTestId } = renderCard();
    fireEvent.click(getByTestId('color-swatch-azul'));
    expect(getByTestId('hsi-img').getAttribute('src')).toBe('img/azul.png');
  });

  it('S2-12 [R3]: Preto → img/preto.png', () => {
    const { getByTestId } = renderCard();
    fireEvent.click(getByTestId('color-swatch-preto'));
    expect(getByTestId('hsi-img').getAttribute('src')).toBe('img/preto.png');
  });

  it('S2-13 [R3]: cor sem imagem → fallback via ProductColorSwatches (max=5 oculta idx 5+)', () => {
    // NOTA: BaseProductGridCard usa max=5. Cores de idx>=5 ficam no chip "+N" (inacessíveis por click).
    // Testamos o fallback de imagem nula diretamente via ProductColorSwatches + BaseProductGridCard
    // com fixture de apenas 1 cor sem imagem.
    const { getByTestId } = wrap(
      <BaseProductGridCard
        productId="sem-img-test" productName="Sem Img" productImage="img/fallback.png"
        basePrice={1} stockQuantity={100} stockStatus={null}
        colors={[{ name: 'NullImg', hex: '#999', image: null, stockQty: 5 }]}
        onClick={vi.fn()} testId="card-si" footerTestId="footer-si" thumbTestId="qv-si"
      />
    );
    fireEvent.click(getByTestId('color-swatch-nullimg'));
    // Sem imagem na cor → fallback para productImage
    expect(getByTestId('hsi-img').getAttribute('src')).toBe('img/fallback.png');
  });

  it('S2-14 [R3+R16]: Azul→Preto → img/preto.png', () => {
    const { getByTestId } = renderCard();
    fireEvent.click(getByTestId('color-swatch-azul'));
    fireEvent.click(getByTestId('color-swatch-preto'));
    expect(getByTestId('hsi-img').getAttribute('src')).toBe('img/preto.png');
  });

  // R4 — Estoque muda
  it('S2-15 [R4]: Azul (3) → 3 un., low-stock', () => {
    const { getByTestId } = renderCard();
    fireEvent.click(getByTestId('color-swatch-azul'));
    expect(within(getByTestId('footer')).getByText(/3 un\./)).not.toBeNull();
    expect(getByTestId('footer').querySelector('[class*="warning"]')).not.toBeNull();
  });

  it('S2-16 [R10]: Verde (0) → 0 un., out-of-stock', () => {
    const { getByTestId } = renderCard();
    fireEvent.click(getByTestId('color-swatch-verde'));
    expect(getByTestId('footer').querySelector('[class*="destructive"]')).not.toBeNull();
  });

  it('S2-17 [R12]: Preto (500) → 500 un.', () => {
    const { getByTestId } = renderCard();
    fireEvent.click(getByTestId('color-swatch-preto'));
    expect(within(getByTestId('footer')).getByText(/500 un\./)).not.toBeNull();
  });

  it('S2-18 [R12]: Limiar (10) → in-stock (minQty=1)', () => {
    const { getByTestId } = renderCard();
    fireEvent.click(getByTestId('color-swatch-limiar'));
    expect(within(getByTestId('footer')).getByText(/10 un\./)).not.toBeNull();
    expect(getByTestId('footer').querySelector('[class*="destructive"]')).toBeNull();
  });

  it('S2-19 [R11]: Negativa (-5) → out-of-stock', () => {
    const { getByTestId } = renderCard();
    fireEvent.click(getByTestId('color-swatch-negativa'));
    expect(getByTestId('footer').querySelector('[class*="destructive"]')).not.toBeNull();
  });

  it('S2-20 [R9]: cor sem stockQty → usa estoque total do card', () => {
    // NOTA: "Sem Qty" está no chip "+N" (idx 6, max=5). Testamos com fixture dedicado.
    const { getByTestId } = wrap(
      <BaseProductGridCard
        productId="no-qty-test" productName="No Qty" productImage="img/default.png"
        basePrice={1} stockQuantity={333} stockStatus={null}
        colors={[{ name: 'SemQtyFixture', hex: '#777', image: 'img/sqf.png' }]}
        onClick={vi.fn()} testId="card-nq" footerTestId="footer-nq" thumbTestId="qv-nq"
      />
    );
    fireEvent.click(getByTestId('color-swatch-semqtyfixture'));
    // Cor sem stockQty → fallback para stockQuantity do card (333)
    expect(within(getByTestId('footer-nq')).getByText(/333 un\./)).not.toBeNull();
  });

  // R5+R6+R7 — Botão Todos
  it('S2-21 [R5]: após selecionar → botão Todos existe', () => {
    const { getByTestId } = renderCard();
    fireEvent.click(getByTestId('color-swatch-azul'));
    expect(getByTestId('color-swatches-clear')).not.toBeNull();
  });

  it('S2-22 [R7]: sem seleção → sem botão Todos', () => {
    const { queryByTestId } = renderCard();
    expect(queryByTestId('color-swatches-clear')).toBeNull();
  });

  it('S2-23 [R6]: Todos → imagem default', () => {
    const { getByTestId } = renderCard();
    fireEvent.click(getByTestId('color-swatch-azul'));
    fireEvent.click(getByTestId('color-swatches-clear'));
    expect(getByTestId('hsi-img').getAttribute('src')).toBe('img/default.png');
  });

  it('S2-24 [R6]: Todos → estoque total (200)', () => {
    const { getByTestId } = renderCard();
    fireEvent.click(getByTestId('color-swatch-azul'));
    fireEvent.click(getByTestId('color-swatches-clear'));
    expect(within(getByTestId('footer')).getByText(/200 un\./)).not.toBeNull();
  });

  it('S2-25 [R6]: Todos → todos aria-checked=false, sem botão Todos', () => {
    const { getByTestId, queryByTestId, getAllByRole } = renderCard();
    fireEvent.click(getByTestId('color-swatch-azul'));
    fireEvent.click(getByTestId('color-swatches-clear'));
    getAllByRole('radio').forEach(r => expect(r.getAttribute('aria-checked')).toBe('false'));
    expect(queryByTestId('color-swatches-clear')).toBeNull();
  });

  it('S2-26 [R6]: Todos NÃO chama onClick do card', () => {
    const { getByTestId, onClick } = renderCard();
    fireEvent.click(getByTestId('color-swatch-azul'));
    fireEvent.click(getByTestId('color-swatches-clear'));
    expect(onClick).not.toHaveBeenCalled();
  });

  // R8 — Produto sem cores
  it('S2-27 [R8]: cores=[] → N/A, card OK, onClick funciona', () => {
    const { getByTestId, onClick } = renderCard({ colors: [] });
    expect(getByTestId('colors-unavailable')).not.toBeNull();
    fireEvent.click(getByTestId('card'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  // QuickView NÃO abre ao selecionar (regra central do fix)
  it('S2-28 [FIX]: QuickView NÃO é ativado ao clicar em bolinha', () => {
    const { getByTestId } = renderCard();
    fireEvent.click(getByTestId('color-swatch-azul'));
    expect(getByTestId('qv-thumb').getAttribute('data-qv-opened')).toBe('false');
  });

  it('S2-29 [FIX]: QuickView NÃO é ativado ao clicar em Todos', () => {
    const { getByTestId } = renderCard();
    fireEvent.click(getByTestId('color-swatch-azul'));
    fireEvent.click(getByTestId('color-swatches-clear'));
    expect(getByTestId('qv-thumb').getAttribute('data-qv-opened')).toBe('false');
  });

  it('S2-30 [REGRESSAO]: clicar na FOTO ainda abre QuickView', () => {
    const { getByTestId } = renderCard();
    fireEvent.click(getByTestId('qv-thumb'));
    expect(getByTestId('qv-thumb').getAttribute('data-qv-opened')).toBe('true');
  });

  // Duplo clique + stress
  it('S2-31 [R15]: duplo clique na mesma cor → estável', () => {
    const { getByTestId } = renderCard();
    fireEvent.click(getByTestId('color-swatch-azul'));
    expect(() => fireEvent.click(getByTestId('color-swatch-azul'))).not.toThrow();
    expect(getByTestId('footer')).not.toBeNull();
  });

  it('S2-32: 50 trocas rápidas → sem crash', () => {
    const { getByTestId } = renderCard();
    const s = ['azul', 'verde', 'preto'];
    expect(() => { for (let i = 0; i < 50; i++) fireEvent.click(getByTestId(`color-swatch-${s[i % 3]}`)); }).not.toThrow();
  });

  it('S2-33: onClick após seleção ainda funciona', () => {
    const { getByTestId, onClick } = renderCard();
    fireEvent.click(getByTestId('color-swatch-azul'));
    fireEvent.click(getByTestId('card'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SUITE 3 — Auditoria estática dos 4 componentes modificados
// ═══════════════════════════════════════════════════════════════════════════
describe('Suite 3 — Auditoria estática de código (os 4 componentes)', () => {
  const BASE = '/workspace/repos/promo-gifts-v4/src/components/products';
  const PC   = `${BASE}/ProductCard.tsx`;
  const PLI  = `${BASE}/ProductListItem.tsx`;
  const PTR  = `${BASE}/table-view/ProductTableRow.tsx`;
  const BPC  = `${BASE}/BaseProductGridCard.tsx`;

  // ── Fix aplicado ─────────────────────────────────────────────────────────
  it('S3-01: ProductCard tem FIX-SWATCH-INLINE-V1 e V2', () => {
    const c = readFileSync(PC, 'utf8');
    expect(c).toContain('FIX-SWATCH-INLINE-V1');
    expect(c).toContain('FIX-SWATCH-INLINE-V2');
  });

  it('S3-02: ProductListItem tem FIX-SWATCH-INLINE-V1 e V2', () => {
    const c = readFileSync(PLI, 'utf8');
    expect(c).toContain('FIX-SWATCH-INLINE-V1');
    expect(c).toContain('FIX-SWATCH-INLINE-V2');
  });

  it('S3-03: ProductTableRow tem FIX-SWATCH-INLINE-V1 e V2', () => {
    const c = readFileSync(PTR, 'utf8');
    expect(c).toContain('FIX-SWATCH-INLINE-V1');
    expect(c).toContain('FIX-SWATCH-INLINE-V2');
  });

  it('S3-04: BaseProductGridCard tem FIX-SWATCH-INLINE', () => {
    const c = readFileSync(BPC, 'utf8');
    expect(c).toContain('FIX-SWATCH-INLINE');
  });

  // ── setQuickViewOpen fora dos onSelect de cor ────────────────────────────
  it('S3-05: ProductCard — 3 setQuickViewOpen legítimos (0 em onSelect de cor)', () => {
    const c = readFileSync(PC, 'utf8');
    const total = (c.match(/setQuickViewOpen\(true\)/g) || []).length;
    expect(total).toBe(3);
  });

  it('S3-06: ProductListItem — 3 setQuickViewOpen legítimos (0 em onSelect de cor)', () => {
    const c = readFileSync(PLI, 'utf8');
    const total = (c.match(/setQuickViewOpen\(true\)/g) || []).length;
    expect(total).toBe(3);
  });

  it('S3-07: ProductTableRow — 0 onOpenQuickView(product, null, ...)', () => {
    const c = readFileSync(PTR, 'utf8');
    expect(c).not.toContain('onOpenQuickView(product, null,');
  });

  it('S3-08: BaseProductGridCard — 0 quickViewRef.current?.open(c.name)', () => {
    const c = readFileSync(BPC, 'utf8');
    expect(c).not.toContain('quickViewRef.current?.open(c.name)');
  });

  // ── Guards removidos na tabela ────────────────────────────────────────────
  it('S3-09: ProductTableRow — guard obsoleto removido de onSelect V1', () => {
    const c = readFileSync(PTR, 'utf8');
    // O guard "if (variantPickerOpen || collectionModalOpen || shareDialogOpen || quickViewOpen) return;"
    // antes de onOpenQuickView foi removido junto com o onOpenQuickView
    // Verificar que não existe onOpenQuickView(product, null) após selectColorWithUrl
    expect(c.indexOf('selectColorWithUrl(product.id, c.name);\n              if (variantPickerOpen')).toBe(-1);
  });

  it('S3-10: ProductTableRow — guard obsoleto removido de onSelect V2', () => {
    const c = readFileSync(PTR, 'utf8');
    expect(c.indexOf('selectColorWithUrl(product.id, sw.color_name);\n              if (variantPickerOpen')).toBe(-1);
  });

  // ── Mecanismo de imagem por cor ainda presente ───────────────────────────
  it('S3-11: ProductCard — currentImageUrl e activeColorName presentes', () => {
    const c = readFileSync(PC, 'utf8');
    expect(c).toContain('currentImageUrl');
    expect(c).toContain('activeColorName');
  });

  it('S3-12: ProductListItem — thumbUrl e userSelectedColorName presentes', () => {
    const c = readFileSync(PLI, 'utf8');
    expect(c).toContain('thumbUrl');
    expect(c).toContain('userSelectedColorName');
  });

  it('S3-13: ProductTableRow — thumbUrl e userSelectedColorName presentes', () => {
    const c = readFileSync(PTR, 'utf8');
    expect(c).toContain('thumbUrl');
    expect(c).toContain('userSelectedColorName');
  });

  it('S3-14: BaseProductGridCard — activeImage e activeColorName presentes', () => {
    const c = readFileSync(BPC, 'utf8');
    expect(c).toContain('activeImage');
    expect(c).toContain('activeColorName');
  });

  // ── Mecanismo de estoque por cor ainda presente ──────────────────────────
  it('S3-15: ProductCard — resolveColorStock presente', () => {
    expect(readFileSync(PC, 'utf8')).toContain('resolveColorStock');
  });

  it('S3-16: ProductListItem — resolveColorStock presente', () => {
    expect(readFileSync(PLI, 'utf8')).toContain('resolveColorStock');
  });

  it('S3-17: ProductTableRow — displayStock e displayStatus presentes', () => {
    const c = readFileSync(PTR, 'utf8');
    expect(c).toContain('displayStock');
    expect(c).toContain('displayStatus');
  });

  it('S3-18: BaseProductGridCard — displayStockQty e getCatalogStockStatus presentes', () => {
    const c = readFileSync(BPC, 'utf8');
    expect(c).toContain('displayStockQty');
    expect(c).toContain('getCatalogStockStatus');
  });

  // ── onClear/onReset presente em TODOS ────────────────────────────────────
  it('S3-19: ProductCard — onClear (V1) e onReset (V2) presentes', () => {
    const c = readFileSync(PC, 'utf8');
    expect(c).toContain('onClear={() => {');
    expect(c).toContain('onReset={() => {');
  });

  it('S3-20: ProductListItem — onClear (V1) e onReset (V2) presentes', () => {
    const c = readFileSync(PLI, 'utf8');
    expect(c).toContain('onClear={() => {');
    expect(c).toContain('onReset={() => {');
  });

  it('S3-21: ProductTableRow — onClear (V1) e onReset (V2) presentes', () => {
    const c = readFileSync(PTR, 'utf8');
    expect(c).toContain('onClear={() => clearSelectedColor(product.id)');
    expect(c).toContain('onReset={() => {');  // V2: ColorSwatchPicker
  });

  it('S3-22: BaseProductGridCard — onClear presente', () => {
    expect(readFileSync(BPC, 'utf8')).toContain('onClear={() => setActiveColorName(null)');
  });

  // ── selectedName passado para o componente ───────────────────────────────
  it('S3-23: ProductCard — selectedName={activeColorName} passado', () => {
    expect(readFileSync(PC, 'utf8')).toContain('selectedName={activeColorName');
  });

  it('S3-24: ProductListItem — selectedName={userSelectedColorName} passado', () => {
    expect(readFileSync(PLI, 'utf8')).toContain('selectedName={userSelectedColorName}');
  });

  it('S3-25: ProductTableRow — selectedName={userSelectedColorName} passado', () => {
    expect(readFileSync(PTR, 'utf8')).toContain('selectedName={userSelectedColorName}');
  });

  it('S3-26: BaseProductGridCard — selectedName={activeColorName} passado', () => {
    expect(readFileSync(BPC, 'utf8')).toContain('selectedName={activeColorName}');
  });

  // ── QuickView ainda acessível por outros meios ──────────────────────────
  it('S3-27: ProductCard — openQuickView fn ainda existe', () => {
    expect(readFileSync(PC, 'utf8')).toContain('const openQuickView = useCallback');
  });

  it('S3-28: ProductCard — tecla Q ainda abre QuickView', () => {
    const c = readFileSync(PC, 'utf8');
    expect(c).toContain("e.key.toLowerCase() === 'q'");
  });

  it('S3-29: ProductTableRow — handleOpenQV ainda existe para thumb', () => {
    expect(readFileSync(PTR, 'utf8')).toContain('onOpenQuickView(product, e.currentTarget');
  });

  it('S3-30: BaseProductGridCard — QuickViewThumb ainda usado', () => {
    const c = readFileSync(BPC, 'utf8');
    expect(c).toContain('<QuickViewThumb');
    expect(c).toContain('</QuickViewThumb>');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SUITE 4 — Fluxos completos (integração)
// ═══════════════════════════════════════════════════════════════════════════
describe('Suite 4 — Fluxos completos integrados', () => {
  it('S4-01: fluxo Azul→Todos→Preto→Todos completo', () => {
    const { getByTestId, queryByTestId } = renderCard();
    // inicial
    expect(getByTestId('hsi-img').getAttribute('src')).toBe('img/default.png');
    expect(within(getByTestId('footer')).getByText(/200 un\./)).not.toBeNull();
    // Azul
    fireEvent.click(getByTestId('color-swatch-azul'));
    expect(getByTestId('hsi-img').getAttribute('src')).toBe('img/azul.png');
    expect(within(getByTestId('footer')).getByText(/3 un\./)).not.toBeNull();
    expect(getByTestId('color-swatch-azul').getAttribute('aria-checked')).toBe('true');
    expect(getByTestId('color-swatches-clear')).not.toBeNull();
    // Todos
    fireEvent.click(getByTestId('color-swatches-clear'));
    expect(getByTestId('hsi-img').getAttribute('src')).toBe('img/default.png');
    expect(within(getByTestId('footer')).getByText(/200 un\./)).not.toBeNull();
    expect(queryByTestId('color-swatches-clear')).toBeNull();
    // Preto
    fireEvent.click(getByTestId('color-swatch-preto'));
    expect(getByTestId('hsi-img').getAttribute('src')).toBe('img/preto.png');
    expect(within(getByTestId('footer')).getByText(/500 un\./)).not.toBeNull();
    // Todos novamente
    fireEvent.click(getByTestId('color-swatches-clear'));
    expect(getByTestId('hsi-img').getAttribute('src')).toBe('img/default.png');
    expect(within(getByTestId('footer')).getByText(/200 un\./)).not.toBeNull();
  });

  it('S4-02: Verde(out)→Preto(in)→Azul(low) sequência de status', () => {
    const { getByTestId } = renderCard();
    fireEvent.click(getByTestId('color-swatch-verde'));
    expect(getByTestId('footer').querySelector('[class*="destructive"]')).not.toBeNull();
    fireEvent.click(getByTestId('color-swatch-preto'));
    expect(getByTestId('footer').querySelector('[class*="destructive"]')).toBeNull();
    fireEvent.click(getByTestId('color-swatch-azul'));
    expect(getByTestId('footer').querySelector('[class*="warning"]')).not.toBeNull();
  });

  it('S4-03: 50 trocas consecutivas sem crash', () => {
    const { getByTestId } = renderCard();
    const s = ['azul','verde','preto'];
    expect(() => { for (let i = 0; i < 50; i++) fireEvent.click(getByTestId(`color-swatch-${s[i%3]}`)); }).not.toThrow();
    expect(getByTestId('footer')).not.toBeNull();
  });

  it('S4-04: onClick após seleção de cor ainda funciona', () => {
    const { getByTestId, onClick } = renderCard();
    fireEvent.click(getByTestId('color-swatch-azul'));
    fireEvent.click(getByTestId('card'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('S4-05: 2 cards independentes não interferem', () => {
    const ok1 = vi.fn(); const ok2 = vi.fn();
    const { getByTestId: g1 } = wrap(<BaseProductGridCard
      productId="p1" productName="P1" productImage="img/p1.png" basePrice={10} stockQuantity={100}
      colors={[{ name: 'Azul', hex: '#00f', image: 'img/p1-azul.png', stockQty: 5 }]}
      onClick={ok1} testId="c1" footerTestId="f1" thumbTestId="qv1" />);
    const { getByTestId: g2 } = wrap(<BaseProductGridCard
      productId="p2" productName="P2" productImage="img/p2.png" basePrice={20} stockQuantity={200}
      colors={[{ name: 'Verde', hex: '#0f0', image: 'img/p2-verde.png', stockQty: 50 }]}
      onClick={ok2} testId="c2" footerTestId="f2" thumbTestId="qv2" />);
    fireEvent.click(g1('color-swatch-azul'));
    expect(within(g1('f1')).getByText(/5 un\./)).not.toBeNull();
    expect(within(g2('f2')).getByText(/200 un\./)).not.toBeNull(); // P2 não afetado
    fireEvent.click(g2('color-swatch-verde'));
    expect(within(g2('f2')).getByText(/50 un\./)).not.toBeNull();
    expect(within(g1('f1')).getByText(/5 un\./)).not.toBeNull(); // P1 ainda Azul
    fireEvent.click(g1('c1'));
    expect(ok1).toHaveBeenCalledTimes(1);
    expect(ok2).not.toHaveBeenCalled();
  });

  it('S4-06: produto com 1 cor → ciclo selecionar/Todos', () => {
    const { getByTestId, queryByTestId } = renderCard({
      colors: [{ name: 'Laranja', hex: '#f60', image: 'img/laranja.png', stockQty: 15 }],
      stockQuantity: 999,
    });
    expect(queryByTestId('color-swatches-clear')).toBeNull();
    fireEvent.click(getByTestId('color-swatch-laranja'));
    expect(within(getByTestId('footer')).getByText(/15 un\./)).not.toBeNull();
    expect(getByTestId('color-swatches-clear')).not.toBeNull();
    fireEvent.click(getByTestId('color-swatches-clear'));
    expect(within(getByTestId('footer')).getByText(/999 un\./)).not.toBeNull();
    expect(queryByTestId('color-swatches-clear')).toBeNull();
  });

  it('S4-07: cor sem stockQty → fallback para stockQuantity personalizado', () => {
    // Usar fixture dedicado com 1 cor sem stockQty
    const { getByTestId } = wrap(
      <BaseProductGridCard
        productId="qty-777" productName="Qty777" productImage="img/x.png"
        basePrice={1} stockQuantity={777} stockStatus={null}
        colors={[{ name: 'SemQtyV2', hex: '#555', image: 'img/sqv2.png' }]}
        onClick={vi.fn()} testId="card-777" footerTestId="footer-777" thumbTestId="qv-777"
      />
    );
    fireEvent.click(getByTestId('color-swatch-semqtyv2'));
    expect(within(getByTestId('footer-777')).getByText(/777 un\./)).not.toBeNull();
  });

  it('S4-08: QuickView NÃO abre em NENHUMA das 5 cores visíveis (max=5)', () => {
    // max=5 → apenas as 5 primeiras cores são renderizadas como botões clickáveis.
    // "Sem Img" (idx 5) e "Sem Qty" (idx 6) ficam no chip "+2" — não têm testId individual.
    const { getByTestId } = renderCard();
    const cores = ['azul','verde','preto','limiar','negativa']; // primeiras 5
    cores.forEach(c => {
      fireEvent.click(getByTestId(`color-swatch-${c}`));
      expect(getByTestId('qv-thumb').getAttribute('data-qv-opened')).toBe('false');
    });
    // Verifica chip +2 existe (Sem Img + Sem Qty no overflow)
    expect(getByTestId('color-swatches-overflow')).not.toBeNull();
  });
});
