import { type Product, type SupplierSalesEntry } from '@/hooks/products';

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
    case 'relevance':
      // In relevance mode, we preserve the search ranking order
      // (rankProductSearchResults already handles the hierarchy)
      break;
    case 'name':
      products.sort((a, b) => a.name.localeCompare(b.name));
      break;
    case 'price-asc':
      products.sort((a, b) => a.price - b.price);
      break;
    case 'price-desc':
      products.sort((a, b) => b.price - a.price);
      break;
    case 'stock':
      products.sort((a, b) => (b.stock || 0) - (a.stock || 0));
      break;
    case 'newest':
      products.sort(
        (a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime(),
      );
      break;
    case 'best-seller-supplier': {
      const sMap = options?.supplierSalesMap;
      if (sMap && sMap.size > 0) {
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
          return a.name.localeCompare(b.name);
        });
      } else {
        // Fallback: flags do produto (quando MV nao populada)
        products.sort((a, b) => {
          const aScore = (a.featured ? 2 : 0) + (a.newArrival ? 1 : 0);
          const bScore = (b.featured ? 2 : 0) + (b.newArrival ? 1 : 0);
          if (bScore !== aScore) return bScore - aScore;
          return (b.stock || 0) - (a.stock || 0);
        });
      }
      break;
    }
    // FIX-06+13: "popularity" era mapeado no voice agent mas nao tinha case aqui.
    // Adicionado alias para best-seller-promo (semanticamente equivalente).
    case 'best-seller-promo':
    case 'popularity':
      products.sort((a, b) => {
        const map = options?.promoSalesMap;
        const aCount = map?.get(a.id) || 0;
        const bCount = map?.get(b.id) || 0;
        if (bCount !== aCount) return bCount - aCount;
        return a.name.localeCompare(b.name);
      });
      break;
  }

  return products;
}
