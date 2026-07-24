/**
 * SF-F — Sentinela de preço "sem limite" (9999) não deve excluir produtos caros.
 *
 * Bug latente: com priceRange=[min>0, 9999] ("sem limite superior"), o filtro
 * aplicava `price <= 9999` e removia produtos acima de R$9.999. Inócuo enquanto
 * o preço máximo real é R$5.175, mas incorreto por construção. A correção trata
 * priceRange[1] >= 9999 como ilimitado.
 *
 * Estes testes replicam exatamente a expressão usada em useFiltersPageState e
 * useCatalogFiltering para travar a semântica.
 */
import { describe, it, expect } from 'vitest';

type P = { id: string; price: number };

/** Espelha a lógica de useFiltersPageState (FIX-SF-F). */
function applyPriceFilter(products: P[], min: number, max: number): P[] {
  const priceFilterActive = min > 0 || max < 9999;
  if (!priceFilterActive) return products;
  return products.filter((product) => {
    if (product.price < min) return false;
    if (max < 9999 && product.price > max) return false;
    return true;
  });
}

const catalog: P[] = [
  { id: 'a', price: 10 },
  { id: 'b', price: 49.9 },
  { id: 'c', price: 500 },
  { id: 'd', price: 5175 },
  { id: 'e', price: 12000 }, // acima do sentinela 9999 (produto caro futuro)
];

describe('SF-F — sentinela de preço sem limite', () => {
  it('min definido + max "sem limite" (9999) inclui produtos acima de 9999', () => {
    const out = applyPriceFilter(catalog, 50, 9999).map((p) => p.id);
    // b(49.9) sai por estar abaixo do min; e(12000) DEVE permanecer.
    expect(out).toEqual(['c', 'd', 'e']);
  });

  it('com bug antigo (price <= 9999) o produto caro seria removido — regressão', () => {
    const buggy = catalog.filter((p) => p.price >= 50 && p.price <= 9999).map((p) => p.id);
    expect(buggy).toEqual(['c', 'd']); // demonstra a exclusão indevida do 'e'
  });

  it('max real (< 9999) ainda limita normalmente', () => {
    expect(applyPriceFilter(catalog, 0, 600).map((p) => p.id)).toEqual(['a', 'b', 'c']);
  });

  it('faixa padrão [0, 9999] não ativa o filtro (todos passam, inclusive caros)', () => {
    expect(applyPriceFilter(catalog, 0, 9999)).toHaveLength(catalog.length);
  });

  it('min e max ambos definidos filtram a faixa fechada', () => {
    expect(applyPriceFilter(catalog, 100, 6000).map((p) => p.id)).toEqual(['c', 'd']);
  });
});
