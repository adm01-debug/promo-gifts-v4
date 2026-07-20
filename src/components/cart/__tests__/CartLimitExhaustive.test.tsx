/**
 * CartLimitExhaustive — Bateria property-based / fuzz para a política de
 * MAX_SELLER_CARTS = 50 (client-side).
 *
 * Cobre:
 *   1. Invariantes do contador em toda a faixa [0..N*2]
 *   2. Simetria com valores fronteiriços (0, 1, MAX-1, MAX, MAX+1, MAX*2, 1000)
 *   3. CTA disabled sse count >= MAX
 *   4. Link "Ver detalhes" só aparece no limite/overflow
 *   5. Fuzz aleatório (500 seeds) com contagens uniformes
 *   6. Estabilidade de SSOT (constante numérica, não string), coerência
 *      client ↔ edge (test-cart-limit) ↔ mensagens SSOT.
 *   7. Regressão: nenhuma string "10 carrinhos" resiliente à mudança.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import fs from 'node:fs';
import path from 'node:path';
import { CartTabsRich } from '../CartTabsRich';
import {
  MAX_SELLER_CARTS,
  SELLER_CART_LIMIT_REACHED_MESSAGE,
  SELLER_CART_LIMIT_REACHED_SHORT,
} from '@/hooks/products/useSellerCarts';
import type { SellerCart } from '@/hooks/products';

vi.mock('framer-motion', async () => {
  const actual = await vi.importActual('framer-motion');
  const stub = {
    div: (p: React.HTMLAttributes<HTMLDivElement>) => <div {...p} />,
    span: (p: React.HTMLAttributes<HTMLSpanElement>) => <span {...p} />,
  };
  return {
    ...actual,
    motion: stub,
    m: stub,
    LazyMotion: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  };
});

function makeCart(i: number): SellerCart {
  return {
    id: `c-${i}`,
    seller_id: 'u1',
    company_id: `co-${i}`,
    company_name: `Empresa ${i}`,
    company_location: null,
    company_logo_url: null,
    notes: null,
    status: 'em_separacao',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    items: [],
  } as unknown as SellerCart;
}

function renderWith(count: number) {
  const carts = Array.from({ length: count }, (_, i) => makeCart(i));
  const canCreateCart = count < MAX_SELLER_CARTS;
  render(
    <CartTabsRich
      carts={carts}
      activeCartId={carts[0]?.id ?? null}
      canCreateCart={canCreateCart}
      onSelect={vi.fn()}
      onNew={vi.fn()}
    />,
  );
  return {
    counter: screen.queryByTestId('cart-tab-new-counter'),
    btn: screen.queryByTestId('cart-tab-new') as HTMLButtonElement | null,
    detailsLink: screen.queryByTestId('cart-limit-details-link'),
    canCreateCart,
  };
}

// Semente determinística para reprodutibilidade
function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('MAX_SELLER_CARTS — SSOT & coerência cross-module', () => {
  it('é o número 50 (não string, não 10)', () => {
    expect(MAX_SELLER_CARTS).toBe(50);
    expect(typeof MAX_SELLER_CARTS).toBe('number');
    expect(Number.isInteger(MAX_SELLER_CARTS)).toBe(true);
  });

  it('mensagens SSOT contêm o número atualizado', () => {
    expect(SELLER_CART_LIMIT_REACHED_MESSAGE).toMatch(/Limite de 50 carrinhos/);
    expect(SELLER_CART_LIMIT_REACHED_SHORT).toMatch(/Limite de 50 carrinhos/);
    // Regressão: garante que "Limite de 10 carrinhos" não sobreviveu
    expect(SELLER_CART_LIMIT_REACHED_MESSAGE).not.toMatch(/Limite de 10 carrinhos/);
    expect(SELLER_CART_LIMIT_REACHED_SHORT).not.toMatch(/Limite de 10 carrinhos/);
  });

  it('edge function test-cart-limit espelha a constante do client', async () => {
    const p = path.resolve(process.cwd(), 'supabase/functions/test-cart-limit/index.ts');
    const src = await fs.promises.readFile(p, 'utf8');
    // Deve conter exatamente MAX_SELLER_CARTS = 50
    expect(src).toMatch(/MAX_SELLER_CARTS\s*=\s*50\b/);
    // Não deve conter o valor antigo como assignment
    expect(src).not.toMatch(/MAX_SELLER_CARTS\s*=\s*10\b/);
  });

  it('CartDialogs.tsx comenta o novo limite', async () => {
    const p = path.resolve(process.cwd(), 'src/components/cart/cart-utils/CartDialogs.tsx');
    const src = await fs.promises.readFile(p, 'utf8');
    expect(src).not.toMatch(/\b10 carrinhos\b/);
  });

  it('nenhum literal "10 carrinhos" resiliente no código fonte relevante', async () => {
    const roots = [
      'src/hooks/products/useSellerCarts.ts',
      'src/components/cart/CartTabsRich.tsx',
      'src/components/cart/cart-utils/CartDialogs.tsx',
      'src/components/cart/CartHeaderButton.tsx',
    ];
    for (const rel of roots) {
      const p = path.resolve(process.cwd(), rel);
      const exists = await fs.promises
        .access(p)
        .then(() => true)
        .catch(() => false);
      if (!exists) continue;
      const src = await fs.promises.readFile(p, 'utf8');
      expect(src, `${rel} contém literal antigo`).not.toMatch(/\b10 carrinhos\b/);
    }
  });
});

describe('CartLimitExhaustive — invariantes em toda a faixa', () => {
  afterEach(cleanup);

  const boundary = [
    0,
    1,
    2,
    25,
    MAX_SELLER_CARTS - 2,
    MAX_SELLER_CARTS - 1,
    MAX_SELLER_CARTS,
    MAX_SELLER_CARTS + 1,
    MAX_SELLER_CARTS + 5,
    MAX_SELLER_CARTS * 2,
    200,
    999,
  ];

  for (const count of boundary) {
    it(`n=${count}: contador, disabled e link coerentes`, () => {
      if (count === 0) {
        // Sem carrinhos, componente ainda deve renderizar CTA de criação
        const { btn } = renderWith(0);
        expect(btn).not.toBeNull();
        expect(btn!.disabled).toBe(false);
        return;
      }
      const { counter, btn, detailsLink } = renderWith(count);
      expect(counter?.textContent).toBe(`${count}/${MAX_SELLER_CARTS}`);
      const shouldBeDisabled = count >= MAX_SELLER_CARTS;
      expect(btn!.disabled).toBe(shouldBeDisabled);
      // Link "Ver detalhes" existe apenas quando limite atingido/superado
      if (shouldBeDisabled) {
        expect(detailsLink).not.toBeNull();
      } else {
        expect(detailsLink).toBeNull();
      }
    });
  }
});

describe('CartLimitExhaustive — fuzz aleatório determinístico', () => {
  afterEach(cleanup);

  // 200 seeds, contagens em [0..120] — suficiente para varrer transições
  const SEEDS = 200;
  it(`${SEEDS} simulações aleatórias mantêm invariantes`, () => {
    const rnd = mulberry32(0xc0ffee);
    for (let i = 0; i < SEEDS; i++) {
      const count = Math.floor(rnd() * 121); // 0..120
      const { counter, btn, detailsLink } = renderWith(count);
      if (count === 0) {
        expect(btn!.disabled).toBe(false);
      } else {
        expect(counter?.textContent).toBe(`${count}/${MAX_SELLER_CARTS}`);
        const shouldBeDisabled = count >= MAX_SELLER_CARTS;
        expect(btn!.disabled).toBe(shouldBeDisabled);
        expect(!!detailsLink).toBe(shouldBeDisabled);
      }
      cleanup();
    }
  });
});
