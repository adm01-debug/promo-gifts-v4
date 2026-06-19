import { useState, useMemo, useCallback, useContext } from 'react';
import Fuse from 'fuse.js';
import { useQuery } from '@tanstack/react-query';
import type { Product } from '@/hooks/products';
import { CATEGORIES, SUPPLIERS } from '@/data/mockData';
import { ProductsContext } from '@/contexts/ProductsContext';
import { dbInvoke } from '@/lib/db/postgrest';
import {
  createProductFuseOptions,
  normalizeProductSearch,
  rankProductSearchResults,
} from '@/utils/product-search';
import { useSearchHistory } from '@/hooks/common/useSearchHistory';

// FIX 2026-06-14 (#5-raiz): categorias/fornecedores REAIS do DB (ids = UUID).
interface RealCategory {
  id: string;
  name: string;
  icon?: string | null;
}
interface RealSupplier {
  id: string;
  name: string;
}

export interface SearchResult {
  type: 'product' | 'category' | 'supplier' | 'history';
  id: string;
  label: string;
  sublabel?: string;
  icon?: string;
  data?: Product;
}

export function useSearch(products: Product[] = []) {
  const productsContext = useContext(ProductsContext);
  const [query, setQuery] = useState('');
  const {
    history: searchHistory,
    addToHistory: addHistoryItem,
    removeFromHistory,
    clearHistory,
  } = useSearchHistory('general');

  const history = useMemo(() => searchHistory.map((h) => h.label), [searchHistory]);

  // FIX: wrap in useMemo to prevent new array reference on every render
  // when productsContext?.products is undefined (fallback to []) causing all
  // dependent useMemos (Fuse instances, suggestions) to recompute every keystroke.
  const availableProducts = useMemo(
    () => (products.length > 0 ? products : (productsContext?.products ?? [])),
    [products, productsContext?.products],
  );

  // FIX 2026-06-14 (#5-raiz): categorias e fornecedores REAIS (fallback p/ mock enquanto carrega).
  const { data: realCategories } = useQuery<RealCategory[]>({
    queryKey: ['search-autocomplete-categories'],
    queryFn: async () =>
      (
        await dbInvoke<RealCategory>({
          table: 'categories',
          operation: 'select',
          select: 'id, name, icon',
          filters: { is_active: true },
          orderBy: { column: 'name', ascending: true },
          limit: 1000,
          countMode: 'none',
        })
      ).records,
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
  const { data: realSuppliers } = useQuery<RealSupplier[]>({
    queryKey: ['search-autocomplete-suppliers'],
    queryFn: async () =>
      (
        await dbInvoke<RealSupplier>({
          table: 'suppliers',
          operation: 'select',
          select: 'id, name', // -> v_suppliers_public
          filters: { active: true },
          orderBy: { column: 'name', ascending: true },
          limit: 200,
          countMode: 'none',
        })
      ).records,
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
  const categorySource = useMemo<RealCategory[]>(
    () =>
      realCategories?.length
        ? realCategories
        : CATEGORIES.map((c) => ({ id: String(c.id), name: c.name, icon: c.icon })),
    [realCategories],
  );
  const supplierSource = useMemo<RealSupplier[]>(
    () =>
      realSuppliers?.length ? realSuppliers : SUPPLIERS.map((s) => ({ id: s.id, name: s.name })),
    [realSuppliers],
  );
  // Produtos referenciam categorias-FOLHA: pré-filtra fontes aos ids PRESENTES no catálogo
  // carregado -> Fuse só ranqueia categorias/fornecedores que TÊM produtos (evita ruído).
  const presentCategoryIds = useMemo(
    () => new Set(availableProducts.map((p) => p.category_id).filter(Boolean) as string[]),
    [availableProducts],
  );
  const presentSupplierIds = useMemo(
    () => new Set(availableProducts.map((p) => p.supplier?.id).filter(Boolean)),
    [availableProducts],
  );
  const effectiveCategorySource = useMemo<RealCategory[]>(
    () =>
      presentCategoryIds.size > 0
        ? categorySource.filter((c) => presentCategoryIds.has(String(c.id)))
        : categorySource,
    [categorySource, presentCategoryIds],
  );
  const effectiveSupplierSource = useMemo<RealSupplier[]>(
    () =>
      presentSupplierIds.size > 0
        ? supplierSource.filter((s) => presentSupplierIds.has(String(s.id)))
        : supplierSource,
    [supplierSource, presentSupplierIds],
  );

  const addToHistory = useCallback(
    (term: string) => {
      if (!term.trim()) return;
      addHistoryItem({
        id: `history-${term}`,
        label: term,
        type: 'general',
      });
    },
    [addHistoryItem],
  );

  // Criar instância Fuse.js para busca fuzzy de produtos
  const productFuse = useMemo(
    () =>
      new Fuse(
        availableProducts,
        createProductFuseOptions<Product>({
          threshold: 0.35,
        }),
      ),
    [availableProducts],
  );

  // Criar instância Fuse.js para busca fuzzy de categorias
  const categoryFuse = useMemo(
    () =>
      new Fuse(effectiveCategorySource, {
        keys: ['name'],
        threshold: 0.35,
        ignoreLocation: true,
      }),
    [effectiveCategorySource],
  );

  // Criar instância Fuse.js para busca fuzzy de fornecedores
  const supplierFuse = useMemo(
    () =>
      new Fuse(effectiveSupplierSource, {
        keys: ['name'],
        threshold: 0.35,
        ignoreLocation: true,
      }),
    [effectiveSupplierSource],
  );

  // BUG-E FIX (2026-06-15): lifted out to avoid calling rankProductSearchResults
  // twice per query change — once in suggestions, once in totalProductMatches.
  // Both memos had identical dependencies; now they share this single computation.
  const allProductMatches = useMemo(() => {
    const searchTerm = query.trim();
    if (!searchTerm || searchTerm.length < 2) return [] as Product[];
    return rankProductSearchResults(availableProducts, searchTerm, productFuse);
  }, [query, availableProducts, productFuse]);

  // Generate suggestions based on query - usando busca fuzzy
  const suggestions = useMemo((): SearchResult[] => {
    const results: SearchResult[] = [];
    const searchTerm = query.trim();

    // If no query, show recent history
    if (!searchTerm) {
      history.slice(0, 5).forEach((term) => {
        results.push({
          type: 'history',
          id: `history-${term}`,
          label: term,
          icon: '🕐',
        });
      });
      return results;
    }

    // Se termo muito curto, não buscar
    if (searchTerm.length < 2) {
      return results;
    }

    // Search products - busca fuzzy com priorização por relevância
    const searchLower = searchTerm.toLowerCase();

    // Priority 0: Exact SKU match (most precise)
    const exactSkuMatch = availableProducts.find(
      (p) =>
        p.sku?.toLowerCase() === searchLower || p.supplier_reference?.toLowerCase() === searchLower,
    );
    if (exactSkuMatch) {
      results.push({
        type: 'product',
        id: exactSkuMatch.id,
        label: exactSkuMatch.name,
        sublabel: `SKU: ${exactSkuMatch.sku ?? ''} • ${exactSkuMatch.category_name ?? ''}`,
        icon: '📦',
        data: exactSkuMatch,
      });
    }

    // allProductMatches provided by shared useMemo above (BUG-E fix — no double computation)
    const orderedProducts = allProductMatches.slice(0, 30);

    orderedProducts.forEach((product) => {
      // Skip if already added as exact SKU match
      if (results.some((r) => r.id === product.id)) return;
      results.push({
        type: 'product',
        id: product.id,
        label: product.name,
        sublabel: `${product.sku ?? ''} • ${product.category_name ?? ''}`,
        icon: '📦',
        data: product,
      });
    });

    // Search categories - busca fuzzy
    const matchingCategories = categoryFuse.search(searchTerm).slice(0, 3);

    matchingCategories.forEach((result) => {
      const category = result.item;
      // FIX 2026-06-14 (catalog-search-audit): removido o ramo parseInt(p.category_id) === category.id.
      // category_id é UUID; parseInt('192e45...') retornava 192 (falso-positivo) e ainda gerava NaN
      // para UUIDs não-numéricos. Mantém-se apenas a comparação estrita por id (string).
      const cid = String(category.id);
      const productCount = availableProducts.filter((p) => p.category_id === cid).length;
      if (productCount === 0 && availableProducts.length > 0) return;
      results.push({
        type: 'category',
        id: cid,
        label: category.name,
        sublabel: `${productCount} produtos`,
        icon: category.icon || '📁',
      });
    });

    // Search suppliers - busca fuzzy
    const matchingSuppliers = supplierFuse.search(searchTerm).slice(0, 3);

    matchingSuppliers.forEach((result) => {
      const supplier = result.item;
      // FIX 2026-06-14 (catalog-search-audit): o brand do produto é o NOME do fornecedor
      // (ex.: 'XBZ', 'Spot | Stricker', 'Asia Import', 'Só Marcas'), nunca o id mockado
      // ('xbz'|'stricker'|'asia'|'somarcas'). A comparação antiga (p.brand === supplier.id e
      // p.supplier_reference === supplier.id) jamais casava -> contagem sempre 0. Passamos a casar
      // por tokens normalizados (>=3 chars) do nome do fornecedor presentes no brand.
      const sid = supplier.id;
      const supTokens = normalizeProductSearch(supplier.name)
        .split(/[\s|]+/)
        .filter((t) => t.length >= 3);
      const productCount = availableProducts.filter((p) => {
        if (p.supplier?.id && p.supplier.id === sid) return true;
        if (!p.brand) return false;
        const normalizedBrand = normalizeProductSearch(p.brand); // const estreita o tipo antes do closure
        return supTokens.some((t) => normalizedBrand.includes(t));
      }).length;
      if (productCount === 0 && availableProducts.length > 0) return;
      results.push({
        type: 'supplier',
        id: sid,
        label: supplier.name,
        sublabel: `${productCount} produtos`,
        icon: '🏭',
      });
    });

    return results;
  }, [query, history, allProductMatches, availableProducts, categoryFuse, supplierFuse]);

  // Total count of products matching the search term (including those beyond
  // the 30-item display limit). Used by SmartSearchInput "Ver todos N resultados".
  // BUG-E FIX: reuses shared allProductMatches memo — O(1) lookup instead of recomputing.
  const totalProductMatches = useMemo(() => allProductMatches.length, [allProductMatches]);

  // FIX 2026-06-15 (quick-suggestions-real-categories): chips derivados das top-5
  // categorias REAIS do DB (por contagem de produtos no catálogo carregado).
  // Cada chip tem type:'category' + id UUID → click aplica filtro real via onSelect,
  // não busca textual. Enquanto carrega (availableProducts vazio) retorna [] (sem chips).
  const quickSuggestions = useMemo<SearchResult[]>(() => {
    if (!realCategories?.length || availableProducts.length === 0) return [];
    // Contagem O(n): Map de category_id → count
    const catCounts = new Map<string, number>();
    for (const p of availableProducts) {
      if (p.category_id) catCounts.set(p.category_id, (catCounts.get(p.category_id) ?? 0) + 1);
    }
    return effectiveCategorySource
      .map((c) => ({ c, count: catCounts.get(String(c.id)) ?? 0 }))
      .filter((x) => x.count > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
      .map(({ c, count }) => ({
        type: 'category' as const,
        id: String(c.id),
        label: c.name,
        sublabel: `${count} produtos`,
        icon: c.icon ?? '📁',
      }));
  }, [realCategories, availableProducts, effectiveCategorySource]);

  return {
    query,
    setQuery,
    suggestions,
    quickSuggestions,
    history,
    addToHistory,
    removeFromHistory: (term: string) => removeFromHistory(`history-${term}`),
    clearHistory,
    isLoaded: true,
    totalProductMatches,
  };
}
