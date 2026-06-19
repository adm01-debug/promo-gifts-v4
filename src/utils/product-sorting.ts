import type { Product, SupplierSalesEntry } from '@/hooks/products';

/**
 * Collator pt-BR único e reutilizável para ordenação alfabética de nomes.
 *
 * - `numeric: true`  → "Caneta 2" antes de "Caneta 10" (ordenação natural).
 * - `sensitivity: 'base'` → ignora caixa e acento na comparação principal
 *   ("Água"/"agua" tratados de forma consistente), evitando ordem fora de
 *   lugar para acentuação típica do português.
 *
 * Sem isso, `String.localeCompare` sem locale usa o locale default do
 * ambiente (Node/SSR/test/browser) → ordem não-determinística.
 */
const PT_BR_COLLATOR = new Intl.Collator('pt-BR', {
  numeric: true,
  sensitivity: 'base',
});

/** Compara dois nomes usando o collator pt-BR (null/undefined viram ''). */
export function compareNamePtBR(a?: string | null, b?: string | null): number {
  return PT_BR_COLLATOR.compare(a ?? '', b ?? '');
}

/**
 * Comparador estável: ordena por nome (pt-BR) e desempata por `id`.
 * Garante ordem determinística entre páginas no infinite scroll.
 */
function byNameThenId(a: Product, b: Product): number {
  const byName = compareNamePtBR(a.name, b.name);
  if (byName !== 0) return byName;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/** Desempate final por id, preservando o comparador primário fornecido. */
function withIdTiebreak(
  primary: (a: Product, b: Product) => number,
): (a: Product, b: Product) => number {
  return (a, b) => {
    const result = primary(a, b);
    if (result !== 0) return result;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  };
}

/**
 * Centralized product sorting logic.
 * Used by both the Catalog (Index) and Super Filter (FiltersPage).
 */
export function sortProducts(
  products: Product[],
  sortBy: string,
  options?: {
    promoSalesMap?: Map<string, number>;
    supplierSalesMap?: Map<string, SupplierSalesEntry>;
    skipSort?: boolean;
  },
): Product[] {
  if (options?.skipSort) return products;

  switch (sortBy) {
    // BUG-SORT FIX: 'name-asc'/'name-desc' caíam no default (no-op) apesar de
    // serem valores válidos de ProductFilters.sortBy. Tratados aqui explicitamente.
    // ('name' e 'name-asc' compartilham o mesmo corpo via fall-through de case vazio.)
    case 'name':
    case 'name-asc':
      products.sort(byNameThenId);
      break;
    case 'name-desc':
      products.sort((a, b) => byNameThenId(b, a));
      break;

    case 'price-asc':
      products.sort(withIdTiebreak((a, b) => a.price - b.price));
      break;
    case 'price-desc':
      products.sort(withIdTiebreak((a, b) => b.price - a.price));
      break;
    case 'stock':
      products.sort(withIdTiebreak((a, b) => (b.stock ?? 0) - (a.stock ?? 0)));
      break;
    case 'newest':
      products.sort((a, b) => {
        const bTime = new Date(b.created_at || b.updated_at || 0).getTime();
        const aTime = new Date(a.created_at || a.updated_at || 0).getTime();
        if (bTime !== aTime) return bTime - aTime;
        // Se datas iguais, prioriza os que têm flag newArrival
        if (b.newArrival !== a.newArrival) return b.newArrival ? 1 : -1;
        return byNameThenId(a, b);
      });
      break;
    case 'best-seller-supplier': {
      const sMap = options?.supplierSalesMap;
      if (sMap?.size) {
        // Real data from external DB (mv_product_intelligence)
        products.sort((a, b) => {
          const aEntry = sMap.get(a.id);
          const bEntry = sMap.get(b.id);
          const aScore = aEntry?.turnoverScore ?? 0;
          const bScore = bEntry?.turnoverScore ?? 0;
          if (bScore !== aScore) return bScore - aScore;
          // Desempate: velocidade de saida 7d
          const aVel = aEntry?.velocity7d ?? 0;
          const bVel = bEntry?.velocity7d ?? 0;
          if (bVel !== aVel) return bVel - aVel;
          return byNameThenId(a, b);
        });
      } else {
        // Fallback: flags do produto (quando MV nao populada)
        // Prioriza featured, depois newArrival, depois stock como proxy de "giro"
        products.sort((a, b) => {
          const aScore = (a.featured ? 10 : 0) + (a.newArrival ? 5 : 0);
          const bScore = (b.featured ? 10 : 0) + (b.newArrival ? 5 : 0);
          if (bScore !== aScore) return bScore - aScore;
          const aStock = a.stock ?? 0;
          const bStock = b.stock ?? 0;
          if (bStock !== aStock) return bStock - aStock;
          return byNameThenId(a, b);
        });
      }
      break;
    }
    case 'color-match':
      // BUG-SORT-02 FIX: 'color-match' é gerenciado upstream pelo pipeline de
      // filtragem/enriquecimento de cor (useColorEnrichment + useCatalogFiltering).
      // Não aplicar sort adicional — preservar a ordem de scoring de entrada.
      // O case explícito evita que o valor caia no `default` (sort por nome A-Z),
      // que seria semanticamente incorreto para resultados filtrados por cor.
      break;
    // FIX-06+13: "popularity" era mapeado no voice agent mas nao tinha case aqui.
    // Adicionado alias para best-seller-promo (semanticamente equivalente).
    case 'best-seller-promo':
    case 'popularity':
      products.sort((a, b) => {
        const map = options?.promoSalesMap;
        const aCount = map?.get(a.id) || 0;
        const bCount = map?.get(b.id) || 0;
        if (bCount !== aCount) return bCount - aCount;
        return byNameThenId(a, b);
      });
      break;
    default:
      // BUG-SORT-03 FIX: sortBy desconhecido é no-op — preserva a ordem atual.
      // Motivo: reordenar silenciosamente para A-Z quando o caller passou um valor
      // não reconhecido é comportamento surpreendente (URL corrompida, localStorage
      // stale, etc.). Melhor manter a ordem que já estava do que trocar para A-Z
      // de forma inesperada. O test spec valida essa semântica.
      break;
  }

  return products;
}
