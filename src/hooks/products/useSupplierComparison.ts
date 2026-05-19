import { useMemo } from "react";
import { type Product, useProducts } from "@/hooks/products";

interface SupplierProduct {
  product: Product;
  priceDiff: number;
  priceDiffPercent: number;
  stockAdvantage: boolean;
  isLowestPrice: boolean;
  isBestStock: boolean;
}

interface SupplierComparisonResult {
  baseProduct: Product;
  alternatives: SupplierProduct[];
  lowestPrice: number;
  highestStock: number;
  priceRange: { min: number; max: number };
}

/**
 * Compares a product with alternatives from other suppliers.
 * Uses server-side category search instead of loading all 6000+ products.
 */
export function useSupplierComparison(product: Product | null | undefined) {
  // Fetch products in the same category (server-side, lazy)
  const categoryName = product?.category?.name;
  const { data: categoryProducts = [] } = useProducts(
    categoryName ? { category: categoryName } : undefined,
    { enabled: !!product && !!categoryName, staleTime: 10 * 60 * 1000 }
  );

  const result = useMemo((): SupplierComparisonResult | null => {
    if (!product || categoryProducts.length === 0) return null;

    const baseProduct = product;

    // Find similar products from different suppliers
    const similarProducts = categoryProducts.filter((p) => {
      if (p.id === baseProduct.id) return false;
      if (p.supplier.id === baseProduct.supplier.id) return false;

      const nameSimilarity = calculateNameSimilarity(baseProduct.name, p.name);
      const sameCategory = p.category.id === baseProduct.category.id;

      return nameSimilarity > 0.4 && sameCategory;
    });

    if (similarProducts.length === 0) return null;

    const allProducts = [baseProduct, ...similarProducts];
    const lowestPrice = Math.min(...allProducts.map((p) => p.price));
    const highestStock = Math.max(...allProducts.map((p) => p.stock));
    const priceRange = {
      min: lowestPrice,
      max: Math.max(...allProducts.map((p) => p.price)),
    };

    const alternatives: SupplierProduct[] = similarProducts.map((product) => {
      const priceDiff = product.price - baseProduct.price;
      const priceDiffPercent = baseProduct.price > 0
        ? (priceDiff / baseProduct.price) * 100
        : 0;

      return {
        product,
        priceDiff,
        priceDiffPercent,
        stockAdvantage: product.stock > baseProduct.stock,
        isLowestPrice: product.price === lowestPrice,
        isBestStock: product.stock === highestStock,
      };
    });

    alternatives.sort((a, b) => a.product.price - b.product.price);

    return {
      baseProduct,
      alternatives,
      lowestPrice,
      highestStock,
      priceRange,
    };
  }, [product, categoryProducts]);

  return result;
}

const STOP_WORDS = new Set(['de', 'da', 'do', 'dos', 'das', 'a', 'o', 'e', 'em', 'com', 'para', 'por', 'um', 'uma', 'no', 'na']);

function calculateNameSimilarity(name1: string, name2: string): number {
  if (!name1?.trim() || !name2?.trim()) return 0;

  const words1 = name1.toLowerCase().split(/\s+/).filter(w => w.length >= 3 && !STOP_WORDS.has(w));
  const words2 = name2.toLowerCase().split(/\s+/).filter(w => w.length >= 3 && !STOP_WORDS.has(w));

  if (words1.length === 0 || words2.length === 0) return 0;

  const commonWords = words1.filter((word) =>
    words2.some((w) => w.includes(word) || word.includes(w))
  );

  return commonWords.length / Math.max(words1.length, words2.length);
}

export function getSupplierProductsInCategory(
  products: Product[],
  categoryId: string | number
): Map<string, Product[]> {
  const supplierMap = new Map<string, Product[]>();

  products.forEach((product) => {
    if (product.category.id !== categoryId) return;

    const supplierId = product.supplier.id;
    if (!supplierMap.has(supplierId)) {
      supplierMap.set(supplierId, []);
    }
    supplierMap.get(supplierId)!.push(product);
  });

  return supplierMap;
}
