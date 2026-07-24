/**
 * Auditoria Novidades 2026-06-18 — testes da lógica pura do módulo.
 *
 * Cobre os dois consertos centrais:
 *  - P0: `toNovelty` deriva idade/expiração da PIPELINE DB
 *    (`novelty_detected_at` / `novelty_expires_at`), não de `created_at + 30d`.
 *  - P1: `sortNovelties` ordena pelos campos REAIS de NoveltyWithDetails
 *    (antes o grid fazia `sortProducts(... as Product[])` → no-op silencioso).
 */
import { describe, it, expect } from 'vitest';
import {
  toNovelty,
  sortNovelties,
  type RawProduct,
  type NoveltyWithDetails,
} from '../useNovelties';

const DAY = 86_400_000;
const iso = (msFromNow: number) => new Date(Date.now() + msFromNow).toISOString();

function raw(overrides: Partial<RawProduct> = {}): RawProduct {
  return {
    id: 'p1',
    name: 'Produto',
    sku: 'SKU1',
    primary_image_url: 'http://img/x.jpg',
    set_image_url: null,
    sale_price: 9.9,
    category_id: null,
    supplier_id: null,
    created_at: iso(-200 * DAY), // catálogo antigo de propósito
    stock_quantity: 100,
    min_quantity: 10,
    is_new: true,
    novelty_detected_at: iso(-3 * DAY),
    novelty_expires_at: iso(57 * DAY), // janela real ~60 dias
    ...overrides,
  };
}

describe('toNovelty — ancoragem na pipeline (P0)', () => {
  it('idade do badge vem da DETECÇÃO, não de created_at', () => {
    // created_at há 200 dias, detectado há 3 dias → badge = 3 dias, não 200.
    const n = toNovelty(raw());
    expect(n.days_as_novelty).toBe(3);
    expect(n.detected_at).not.toBe(n.expires_at);
  });

  it('days_remaining vem da expiração REAL (~janela de 60 dias)', () => {
    const n = toNovelty(raw());
    // expira em ~57 dias → arredonda para cima, > 30 (provaria que não é o
    // modelo antigo de 30 dias).
    expect(n.days_remaining).toBeGreaterThan(50);
    expect(n.is_active).toBe(true);
  });

  it('"recém-chegado" (is_highlighted) = detectado há ≤ 5 dias', () => {
    expect(toNovelty(raw({ novelty_detected_at: iso(-2 * DAY) })).is_highlighted).toBe(true);
    expect(toNovelty(raw({ novelty_detected_at: iso(-9 * DAY) })).is_highlighted).toBe(false);
  });

  it('status "expiring_soon" quando expira em ≤ 7 dias', () => {
    expect(toNovelty(raw({ novelty_expires_at: iso(3 * DAY) })).status).toBe('expiring_soon');
    expect(toNovelty(raw({ novelty_expires_at: iso(40 * DAY) })).status).toBe('active');
  });

  it('expiração no passado → expired / inativo (days_remaining clampa em 0)', () => {
    const n = toNovelty(raw({ novelty_expires_at: iso(-1 * DAY) }));
    expect(n.days_remaining).toBe(0);
    expect(n.status).toBe('expired');
    expect(n.is_active).toBe(false);
  });

  it('detecção no futuro não gera idade negativa', () => {
    expect(toNovelty(raw({ novelty_detected_at: iso(5 * DAY) })).days_as_novelty).toBe(0);
  });

  it('fallback gracioso quando a pipeline vem nula (usa created_at + janela display)', () => {
    const n = toNovelty(
      raw({ novelty_detected_at: null, novelty_expires_at: null, created_at: iso(-2 * DAY) }),
    );
    expect(n.detected_at).toBeTruthy();
    expect(n.days_as_novelty).toBe(2);
    expect(n.days_remaining).toBeGreaterThan(0); // detected + 30d
  });
});

describe('sortNovelties — ordena pelos campos reais (P1)', () => {
  const mk = (over: Partial<NoveltyWithDetails>): NoveltyWithDetails => ({
    ...toNovelty(raw()),
    ...over,
  });

  const a = mk({
    product_id: 'a',
    product_name: 'Bola',
    base_price: 30,
    stock_quantity: 5,
    detected_at: iso(-1 * DAY),
  });
  const b = mk({
    product_id: 'b',
    product_name: 'Abajur',
    base_price: 10,
    stock_quantity: 50,
    detected_at: iso(-9 * DAY),
  });
  const c = mk({
    product_id: 'c',
    product_name: 'Caneca',
    base_price: 20,
    stock_quantity: 20,
    detected_at: iso(-3 * DAY),
  });

  it('newest → por detected_at desc', () => {
    const out = sortNovelties([b, c, a], 'newest').map((n) => n.product_id);
    expect(out).toEqual(['a', 'c', 'b']);
  });

  it('price-asc / price-desc → por base_price', () => {
    expect(sortNovelties([a, b, c], 'price-asc').map((n) => n.product_id)).toEqual(['b', 'c', 'a']);
    expect(sortNovelties([a, b, c], 'price-desc').map((n) => n.product_id)).toEqual([
      'a',
      'c',
      'b',
    ]);
  });

  it('name-asc / name-desc → por product_name (pt-BR)', () => {
    expect(sortNovelties([a, b, c], 'name-asc').map((n) => n.product_name)).toEqual([
      'Abajur',
      'Bola',
      'Caneca',
    ]);
    expect(sortNovelties([a, b, c], 'name-desc').map((n) => n.product_name)).toEqual([
      'Caneca',
      'Bola',
      'Abajur',
    ]);
  });

  it('stock → por stock_quantity desc', () => {
    expect(sortNovelties([a, b, c], 'stock').map((n) => n.product_id)).toEqual(['b', 'c', 'a']);
  });

  it('valor desconhecido → no-op (preserva ordem)', () => {
    expect(sortNovelties([c, a, b], 'whatever').map((n) => n.product_id)).toEqual(['c', 'a', 'b']);
  });
});
