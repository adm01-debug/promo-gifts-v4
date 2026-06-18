import { fetchPromobrindProducts, fetchPromobrindProductById } from '@/lib/external-db';
import { mapPromobrindToProduct } from '@/utils/product-mapper';
import { type Product, type ProductFilters } from '@/types/product-catalog';

const getFiniteNumber = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;

export const productService = {
  async fetchProducts(filters?: ProductFilters) {
    const externalFilters: Record<string, unknown> = {};
    if (filters?.categoryId) externalFilters.main_category_id = filters.categoryId;
    if (filters?.inStock) externalFilters.stock_quantity = { op: 'gt', value: 0 };

    // Mapeamento de ordenação para o backend
    let orderBy: { column: string; ascending?: boolean } = { column: 'name', ascending: true };

    if (filters?.sortBy) {
      switch (filters.sortBy) {
        case 'price-asc':
          orderBy = { column: 'sale_price', ascending: true };
          break;
        case 'price-desc':
          orderBy = { column: 'sale_price', ascending: false };
          break;
        case 'newest':
          orderBy = { column: 'created_at', ascending: false };
          break;
        case 'stock':
          orderBy = { column: 'stock_quantity', ascending: false };
          break;
        case 'best-seller-supplier':
          orderBy = { column: 'is_bestseller', ascending: false };
          break;
        case 'best-seller-promo':
          orderBy = { column: 'is_featured', ascending: false };
          break;
        case 'name-desc':
          orderBy = { column: 'name', ascending: false };
          break;
        case 'name':
        case 'name-asc':
        default:
          orderBy = { column: 'name', ascending: true };
          break;
      }
    }

    const products = await fetchPromobrindProducts({
      search: filters?.search,
      limit: filters?.limit,
      orderBy,
      filters: Object.keys(externalFilters).length > 0 ? externalFilters : undefined,
    });

    let result = products.map(mapPromobrindToProduct);

    const category = filters?.category;
    if (category) {
      const normalizedCategory = category.toLowerCase();
      result = result.filter(
        (p) =>
          p.category_name?.toLowerCase().includes(normalizedCategory) ||
          (p.category_id !== null && String(p.category_id) === category),
      );
    }

    const minPrice = getFiniteNumber(filters?.minPrice);
    if (minPrice !== null) {
      result = result.filter((p) => {
        const price = getFiniteNumber(p.price);
        return price !== null && price >= minPrice;
      });
    }

    const maxPrice = getFiniteNumber(filters?.maxPrice);
    if (maxPrice !== null) {
      result = result.filter((p) => {
        const price = getFiniteNumber(p.price);
        return price !== null && price <= maxPrice;
      });
    }

    // Belt+suspenders: client-side filter kept as safety net for bridge fallback
    if (filters?.inStock) {
      result = result.filter((p) => (p.stock ?? 0) > 0);
    }

    return result;
  },

  async fetchProductById(id: string) {
    const product = await fetchPromobrindProductById(id);
    if (!product) return null;

    const mapped = mapPromobrindToProduct(product);

    return mapped;
  },

  async fetchRelatedProducts(product: Product, limit = 20) {
    const supplierId = product?.supplier?.id;
    const categoryId = product?.category_id;
    const productId = product?.id;

    const filters: Record<string, unknown> = {};
    if (supplierId && supplierId !== 'unknown') {
      filters.supplier_id = supplierId;
    } else if (categoryId) {
      filters.main_category_id = categoryId;
    }

    const raw = await fetchPromobrindProducts({
      filters: Object.keys(filters).length > 0 ? filters : undefined,
      limit: limit + 1,
      orderBy: { column: 'name', ascending: true },
    });

    return raw
      .map(mapPromobrindToProduct)
      .filter((p) => p.id !== productId)
      .slice(0, limit);
  },
};
