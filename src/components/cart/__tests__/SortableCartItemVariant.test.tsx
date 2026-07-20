/**
 * SortableCartItem — variantes 'card' (grid) vs 'row' (lista).
 *
 * Cobre exaustivamente o contrato do novo prop `variant`:
 *  - default = 'card' (retrocompatibilidade).
 *  - 'card': Card SEM flex-row; container de imagem quadrado aspect-square.
 *  - 'row': Card COM flex-row a partir de sm; imagem compacta (aspect-auto + largura fixa),
 *          padding da img reduzido, corpo flex-1 min-w-0.
 *  - N linhas simultâneas (stress 100+) preservam o contrato individual.
 *  - Toggle entre variants não vaza classes stale (rerender coerente).
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { SortableCartItem } from '../SortableCartItem';
import { type SellerCartItem } from '@/hooks/products';

vi.mock('framer-motion', async () => {
  const actual = await vi.importActual('framer-motion');
  const motionStub = {
    div: ({ children, ...p }: React.HTMLAttributes<HTMLDivElement>) => <div {...p}>{children}</div>,
    img: (p: React.ImgHTMLAttributes<HTMLImageElement>) => (
      // eslint-disable-next-line jsx-a11y/alt-text
      <img {...p} />
    ),
  };
  return {
    ...actual,
    motion: motionStub,
    m: motionStub,
    LazyMotion: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  };
});
vi.mock('@dnd-kit/sortable', () => ({
  useSortable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
    transition: null,
    isDragging: false,
  }),
}));

const makeItem = (i: number): SellerCartItem => ({
  id: `it-${i}`,
  cart_id: 'c1',
  product_id: `p-${i}`,
  product_name: `Produto ${i}`,
  product_sku: `SKU-${i}`,
  product_price: 100 + i,
  quantity: (i % 5) + 1,
  product_image_url: `https://cdn.test/${i}.jpg`,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  sort_order: i,
  color_name: null,
  color_hex: null,
  notes: null,
});

const renderOne = (variant: 'card' | 'row' | undefined, item = makeItem(0)) =>
  render(
    <BrowserRouter>
      <SortableCartItem
        item={item}
        index={0}
        variant={variant}
        otherCarts={[]}
        stockMap={new Map()}
        onRemove={vi.fn()}
        onUpdateQuantity={vi.fn()}
        onUpdateNotes={vi.fn()}
        onMoveToCart={vi.fn()}
        onDuplicateToCart={vi.fn()}
        onNavigate={vi.fn()}
      />
    </BrowserRouter>,
  );

afterEach(() => cleanup());

const findCard = (root: HTMLElement) => root.querySelector<HTMLElement>('[data-variant]')!;
const findImgContainer = (root: HTMLElement) =>
  root.querySelector<HTMLElement>('.group\\/img-container')!;
const findProductImg = (root: HTMLElement) =>
  root.querySelector<HTMLImageElement>('img[alt^="Produto"]')!;

describe("SortableCartItem · variant 'card' (grid)", () => {
  it("default === 'card' (retrocompat)", () => {
    const { container } = renderOne(undefined);
    expect(findCard(container).dataset.variant).toBe('card');
  });

  it('NÃO aplica flex-row no Card', () => {
    const { container } = renderOne('card');
    const card = findCard(container);
    expect(card.className).not.toMatch(/\bflex-row\b/);
    expect(card.className).not.toMatch(/sm:flex-row/);
  });

  it('mantém aspect-square na imagem', () => {
    const { container } = renderOne('card');
    const img = findImgContainer(container);
    expect(img.className).toMatch(/\baspect-square\b/);
    expect(img.className).not.toMatch(/\baspect-auto\b/);
    expect(img.className).not.toMatch(/w-40|w-48|w-56/);
  });

  it('padding pesado (p-6) na <img> — sem override p-3', () => {
    const { container } = renderOne('card');
    const img = findProductImg(container);
    expect(img.className).toMatch(/\bp-6\b/);
    expect(img.className).not.toMatch(/\bp-3\b/);
  });
});

describe("SortableCartItem · variant 'row' (lista)", () => {
  it("marca data-variant='row' no Card", () => {
    const { container } = renderOne('row');
    expect(findCard(container).dataset.variant).toBe('row');
  });

  it('Card usa flex + sm:flex-row (empilha em mobile, linha em ≥sm)', () => {
    const { container } = renderOne('row');
    const cls = findCard(container).className;
    expect(cls).toMatch(/\bflex\b/);
    expect(cls).toMatch(/flex-col/);
    expect(cls).toMatch(/sm:flex-row/);
    expect(cls).toMatch(/sm:items-stretch/);
  });

  it('imagem: aspect-auto + largura fixa responsiva + shrink-0', () => {
    const { container } = renderOne('row');
    const img = findImgContainer(container);
    expect(img.className).toMatch(/\baspect-auto\b/);
    expect(img.className).toMatch(/\bh-40\b/); // altura fixa no mobile
    expect(img.className).toMatch(/\bshrink-0\b/); // não deixa espremer
    expect(img.className).toMatch(/sm:w-40/); // largura fixa em ≥sm
    expect(img.className).toMatch(/md:w-48/);
    expect(img.className).toMatch(/lg:w-56/);
  });

  it('aplica p-3 (padding leve) na <img>', () => {
    const { container } = renderOne('row');
    const img = findProductImg(container);
    expect(img.className).toMatch(/\bp-3\b/);
  });

  it('corpo com flex-1 + min-w-0 (não vaza texto longo)', () => {
    const { container } = renderOne('row');
    // container do corpo é o div irmão da imagem, com "space-y-2.5 p-3.5"
    const body = container.querySelector<HTMLElement>('.space-y-2\\.5.p-3\\.5')!;
    expect(body).toBeTruthy();
    expect(body.className).toMatch(/\bflex-1\b/);
    expect(body.className).toMatch(/\bmin-w-0\b/);
  });

  it('preserva os handles funcionais (quantidade, nome, foto)', () => {
    const { container } = renderOne('row');
    expect(container.querySelector('[data-testid="cart-item-name"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="cart-item-image"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="cart-qty-input"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="cart-qty-decrement"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="cart-qty-increment"]')).toBeTruthy();
  });
});

describe('SortableCartItem · stress (múltiplas linhas)', () => {
  const CASES = 120;
  it(`renderiza ${CASES} variant='row' sem regredir o contrato individual`, () => {
    const { container } = render(
      <BrowserRouter>
        {Array.from({ length: CASES }, (_, i) => (
          <SortableCartItem
            key={i}
            item={makeItem(i)}
            index={i}
            variant="row"
            otherCarts={[]}
            stockMap={new Map()}
            onRemove={vi.fn()}
            onUpdateQuantity={vi.fn()}
            onUpdateNotes={vi.fn()}
            onMoveToCart={vi.fn()}
            onDuplicateToCart={vi.fn()}
            onNavigate={vi.fn()}
          />
        ))}
      </BrowserRouter>,
    );
    const cards = container.querySelectorAll<HTMLElement>('[data-variant="row"]');
    expect(cards.length).toBe(CASES);
    for (const c of Array.from(cards)) {
      expect(c.className).toMatch(/sm:flex-row/);
    }
    const imgs = container.querySelectorAll<HTMLElement>('.group\\/img-container');
    expect(imgs.length).toBe(CASES);
    for (const el of Array.from(imgs)) {
      expect(el.className).toMatch(/\baspect-auto\b/);
      expect(el.className).toMatch(/\bshrink-0\b/);
    }
  });

  it("alterna 50× entre 'card' e 'row' sem vazar classes stale", () => {
    for (let i = 0; i < 50; i++) {
      const variant = i % 2 === 0 ? 'card' : 'row';
      const { container, unmount } = renderOne(variant, makeItem(i));
      const card = findCard(container);
      if (variant === 'card') {
        expect(card.className).not.toMatch(/sm:flex-row/);
        expect(findImgContainer(container).className).toMatch(/aspect-square/);
      } else {
        expect(card.className).toMatch(/sm:flex-row/);
        expect(findImgContainer(container).className).toMatch(/aspect-auto/);
      }
      unmount();
    }
  });
});
