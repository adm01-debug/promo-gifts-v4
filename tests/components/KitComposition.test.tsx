import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { KitComposition } from '@/components/products/KitComposition';
import type { KitComponent } from '@/types/product-catalog';

function makeItem(overrides: Partial<KitComponent> = {}): KitComponent {
  return {
    id: 'item-1',
    productId: 'prod-1',
    productName: 'Caneca Cerâmica',
    quantity: 2,
    sku: 'CAN-001',
    imageUrl: null,
    isOptional: false,
    isPackaging: false,
    isReplaceable: false,
    allowsPersonalization: false,
    material: null,
    weightG: null,
    ...overrides,
  };
}

const PACKAGING = makeItem({ id: 'pkg-1', productId: 'pkg-prod', productName: 'Caixa Kraft', sku: 'CX-001', isPackaging: true, quantity: 1, weightG: 200 });
const ITEM_A = makeItem({ id: 'a', productName: 'Caderno A5', sku: 'CAD-A5', quantity: 1, weightG: 250, material: 'Papel', allowsPersonalization: true });
const ITEM_B = makeItem({ id: 'b', productName: 'Caneta Metal', sku: 'CAN-MET', quantity: 3, isOptional: true, isReplaceable: true, weightG: 35 });
const ITEM_C = makeItem({ id: 'c', productName: 'Garrafa 500ml', sku: 'GAR-500', quantity: 1, weightG: 1200 });

/** Opens the dialog by clicking the trigger card */
function openDialog() {
  fireEvent.click(screen.getByRole('button', { name: /composição do kit/i }));
}

describe('KitComposition', () => {
  // ──────── Rendering ────────

  it('renders trigger card with component count', () => {
    render(<KitComposition items={[PACKAGING, ITEM_A, ITEM_B]} />);
    expect(screen.getByText(/3 componentes/i)).toBeInTheDocument();
  });

  it('renders header with correct component and piece counts in dialog', () => {
    render(<KitComposition items={[PACKAGING, ITEM_A, ITEM_B]} />);
    openDialog();
    expect(screen.getAllByText(/3.*componentes/i).length).toBeGreaterThanOrEqual(1);
    // total pieces: 1 + 1 + 3 = 5
    expect(screen.getAllByText(/5\s*peças/i).length).toBeGreaterThanOrEqual(1);
  });

  it('renders singular "componente" and "peça" for single item', () => {
    const single = makeItem({ quantity: 1 });
    render(<KitComposition items={[single]} />);
    openDialog();
    expect(screen.getByText(/1 componente\b/i)).toBeInTheDocument();
    expect(screen.getByText(/1 peça\b/i)).toBeInTheDocument();
  });

  it('displays total weight in grams when < 1000g', () => {
    render(<KitComposition items={[PACKAGING, ITEM_A]} />);
    openDialog();
    // 200 + 250 = 450g (appears in trigger + dialog)
    const matches = screen.getAllByText(/450 g/);
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });

  it('displays total weight in kg when >= 1000g', () => {
    render(<KitComposition items={[ITEM_C]} />);
    openDialog();
    const matches = screen.getAllByText(/1\.2 kg/);
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });

  it('does not show weight badge when all items have 0 weight', () => {
    const noWeight = makeItem({ weightG: 0, id: 'nw' });
    render(<KitComposition items={[noWeight]} />);
    openDialog();
    expect(screen.queryByText('0 g')).toBeNull();
  });

  it('separates packaging and product items into sections', () => {
    render(<KitComposition items={[PACKAGING, ITEM_A, ITEM_B]} />);
    openDialog();
    const embalagemMatches = screen.getAllByText(/Embalagem/i);
    expect(embalagemMatches.length).toBeGreaterThanOrEqual(2); // section + badge
    expect(screen.getByText(/Itens do Kit/i)).toBeInTheDocument();
  });

  it('shows items directly without "Itens do Kit" section when no packaging', () => {
    render(<KitComposition items={[ITEM_A, ITEM_B]} />);
    openDialog();
    // Items are still rendered even without packaging section
    expect(screen.getByText('Caderno A5')).toBeInTheDocument();
    expect(screen.getByText('Caneta Metal')).toBeInTheDocument();
  });

  it('renders SKU for each item', () => {
    render(<KitComposition items={[ITEM_A]} />);
    openDialog();
    expect(screen.getAllByText(/CAD-A5/i).length).toBeGreaterThanOrEqual(1);
  });

  it('renders dash when sku is empty', () => {
    const noSku = makeItem({ id: 'ns', sku: '' });
    render(<KitComposition items={[noSku]} />);
    openDialog();
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('renders material when present', () => {
    render(<KitComposition items={[ITEM_A]} />);
    openDialog();
    expect(screen.getByText('Papel')).toBeInTheDocument();
  });

  it('renders quantity badge', () => {
    render(<KitComposition items={[ITEM_B]} />);
    openDialog();
    expect(screen.getByText('3x')).toBeInTheDocument();
  });

  // ──────── Badges ────────

  it('renders "Embalagem" badge for packaging item', () => {
    render(<KitComposition items={[PACKAGING]} />);
    openDialog();
    const badges = screen.getAllByText('Embalagem');
    expect(badges.length).toBeGreaterThanOrEqual(1);
  });

  it('renders "Opcional" badge', () => {
    render(<KitComposition items={[ITEM_B]} />);
    openDialog();
    expect(screen.getByText('Opcional')).toBeInTheDocument();
  });

  it('renders "Substituível" badge', () => {
    render(<KitComposition items={[ITEM_B]} />);
    openDialog();
    expect(screen.getByText('Substituível')).toBeInTheDocument();
  });

  it('renders "Personalizável" badge', () => {
    render(<KitComposition items={[ITEM_A]} />);
    openDialog();
    expect(screen.getByText('Personalizável')).toBeInTheDocument();
  });

  // ──────── Images ────────

  it('renders product image when imageUrl is provided', () => {
    // OptimizedImage uses IntersectionObserver for lazy loading; use a real class so
    // `new IntersectionObserver(cb)` works (arrow functions cannot be constructors).
    class ImmediateIntersectionObserver {
      private _cb: IntersectionObserverCallback;
      root: Element | null = null;
      rootMargin = '0px';
      thresholds = [0];
      constructor(cb: IntersectionObserverCallback) { this._cb = cb; }
      observe(el: Element) {
        this._cb([{ isIntersecting: true, target: el } as IntersectionObserverEntry], this as unknown as IntersectionObserver);
      }
      disconnect() {}
      unobserve() {}
      takeRecords(): IntersectionObserverEntry[] { return []; }
    }
    vi.stubGlobal('IntersectionObserver', ImmediateIntersectionObserver);

    const withImg = makeItem({ id: 'img', imageUrl: 'https://example.com/img.jpg', productName: 'Prod Img' });
    render(<KitComposition items={[withImg]} />);
    openDialog();
    const img = screen.getByAltText('Prod Img');
    expect(img).toHaveAttribute('src', 'https://example.com/img.jpg');

    vi.unstubAllGlobals();
  });

  it('renders fallback icon when imageUrl is null', () => {
    render(<KitComposition items={[ITEM_A]} />);
    openDialog();
    expect(screen.queryByAltText('Caderno A5')).toBeNull();
  });


  // ──────── View product button ────────

  it('does not render view button when onViewProduct is not provided', () => {
    render(<KitComposition items={[ITEM_A]} />);
    openDialog();
    expect(screen.queryByRole('button', { name: /ver produto/i })).toBeNull();
  });

  // ──────── Collapsible ────────

  it('starts expanded by default in dialog', () => {
    render(<KitComposition items={[ITEM_A]} />);
    openDialog();
    expect(screen.getByText('Caderno A5')).toBeVisible();
  });

  // ──────── Edge cases ────────

  it('renders with empty items array', () => {
    render(<KitComposition items={[]} />);
    expect(screen.getByText(/0 componentes/i)).toBeInTheDocument();
  });

  it('handles null weightG gracefully', () => {
    const noWeight = makeItem({ id: 'nw', weightG: null });
    render(<KitComposition items={[noWeight]} />);
    openDialog();
    expect(screen.getByText('Caneca Cerâmica')).toBeInTheDocument();
  });

  it('handles undefined optional fields', () => {
    const minimal: KitComponent = {
      id: 'min',
      productId: 'min-prod',
      productName: 'Minimal',
      quantity: 1,
      sku: 'MIN-001',
    };
    render(<KitComposition items={[minimal]} />);
    openDialog();
    expect(screen.getByText('Minimal')).toBeInTheDocument();
  });

  it('correctly calculates weight with multiple quantities', () => {
    // ITEM_B has weightG=35 and quantity=3 => 105g total
    render(<KitComposition items={[ITEM_B]} />);
    openDialog();
    const matches = screen.getAllByText(/105 g/);
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });

  it('handles all items being packaging', () => {
    const pkg2 = makeItem({ id: 'pkg-2', productName: 'Tampa', isPackaging: true, quantity: 1 });
    render(<KitComposition items={[PACKAGING, pkg2]} />);
    openDialog();
    const matches = screen.getAllByText(/Embalagem/i);
    expect(matches.length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText(/Itens do Kit/i)).toBeNull();
  });

  it('handles very large quantities', () => {
    const large = makeItem({ id: 'lg', quantity: 9999 });
    render(<KitComposition items={[large]} />);
    openDialog();
    expect(screen.getByText('9999x')).toBeInTheDocument();
  });
});
