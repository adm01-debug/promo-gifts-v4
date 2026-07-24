/**
 * CompareTableView — contrato do ring de hover na thumbnail de produto.
 *
 * A thumbnail principal de cada coluna (linha CompareTableView.tsx:167)
 * declara `hover:ring-2 hover:ring-primary` como CTA visual para
 * clicar-para-abrir o produto. Aqui validamos, via o helper SSOT
 * `hoverRingsOf` (`tests/utils/tailwindRings.ts`), que esse contrato:
 *
 *   1. Está presente em TODAS as thumbnails renderizadas.
 *   2. Usa exclusivamente ring-primary (nunca colide com âmbar, reservado
 *      para highlight de estado ativo em outros componentes).
 *   3. Base do <img> não pinta rings (o ring é 100% hover-driven).
 *
 * As dependências pesadas (framer-motion layouts, sparkline, badge de
 * estoque, IntersectionObserver, react-router) são mockadas para manter
 * o teste focado no contrato de classes utilitárias.
 */

import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { hoverRingsOf, ringsOf } from '../utils/tailwindRings';

// Framer-motion: render tags como elementos DOM puros (evita layout animations).
vi.mock('framer-motion', () => {
  const passthrough = new Proxy(
    {},
    {
      get: (_, tag: string) => {
        const Comp = ({ children, ...rest }: React.PropsWithChildren<Record<string, unknown>>) => {
          // Remove props exclusivas de motion antes de renderizar.
          const {
            layout: _l,
            initial: _i,
            animate: _a,
            exit: _e,
            transition: _t,
            whileHover: _wh,
            whileTap: _wt,
            ...domProps
          } = rest as Record<string, unknown>;
          return React.createElement(tag, domProps, children);
        };
        return Comp;
      },
    },
  );
  return {
    m: passthrough,
    motion: passthrough,
    AnimatePresence: ({ children }: React.PropsWithChildren) => children,
  };
});

// Componentes irmãos pesados — não são o objeto do teste.
vi.mock('@/components/compare/PriceSparkline', () => ({
  PriceSparkline: () => null,
}));
vi.mock('@/components/compare/StockRiskBadge', () => ({
  StockRiskBadge: () => null,
}));
vi.mock('@/components/compare/OtherSuppliersRow', () => ({
  OtherSuppliersRow: () => null,
}));

// IntersectionObserver não existe no jsdom.
beforeAll(() => {
  class IO {
    observe() {}
    disconnect() {}
    unobserve() {}
    takeRecords() {
      return [];
    }
    root = null;
    rootMargin = '';
    thresholds = [];
  }
  // @ts-expect-error — jsdom polyfill.
  globalThis.IntersectionObserver = IO;
});

import React from 'react';
import { CompareTableView } from '@/components/compare/CompareTableView';
import type { Product } from '@/types/product-catalog';

function makeProduct(idx: number): Product {
  return {
    id: `p-${idx}`,
    name: `Produto ${idx + 1}`,
    sku: `SKU-${idx}`,
    shortDescription: 'x',
    price: 100 + idx,
    sale_price: 100 + idx,
    images: [`https://example.com/${idx}.png`],
    image_url: `https://example.com/${idx}.png`,
    colors: [],
    materials: [],
    category: { id: `c-${idx}`, name: `Cat ${idx}` },
    supplier: { id: `s-${idx}`, name: `Fornecedor ${idx}` },
    stock: 10,
    stock_status: 'em-estoque',
    tags: {},
  } as unknown as Product;
}

describe('CompareTableView — rings via helper SSOT', () => {
  it('todas as thumbnails têm hover:ring-primary e nenhuma pinta ring na base', () => {
    const products = [makeProduct(0), makeProduct(1), makeProduct(2)];
    const entries = products.map((product, index) => ({ product, index }));

    const { container } = render(
      <MemoryRouter>
        <CompareTableView
          entries={entries}
          products={products}
          formatCurrency={(v) => `R$ ${v.toFixed(2)}`}
          getStockStatusLabel={() => ({ label: 'OK', color: 'green' })}
          onRemove={() => {}}
        />
      </MemoryRouter>,
    );

    const thumbs = Array.from(
      container.querySelectorAll<HTMLImageElement>('img.cursor-pointer.rounded-lg'),
    );
    expect(thumbs.length).toBe(products.length);

    for (const thumb of thumbs) {
      const hover = hoverRingsOf(thumb);
      expect(hover.primary).toBe(true);
      expect(hover.amber).toBe(false);

      // Base não deve pintar rings — comportamento 100% hover-driven.
      const base = ringsOf(thumb);
      expect(base.primary).toBe(false);
      expect(base.amber).toBe(false);
    }
  });
});
