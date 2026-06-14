import { useState, useMemo, useCallback, useContext } from 'react';
import Fuse from 'fuse.js';
import { type Product } from '@/hooks/products';
import { CATEGORIES, SUPPLIERS } from '@/data/mockData';
import { ProductsContext } from '@/contexts/ProductsContext';
import {
  createProductFuseOptions,
  normalizeProductSearch,
  rankProductSearchResults,
} from '@/utils/product-search';
import { useSearchHistory } from '@/hooks/common/useSearchHistory';

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

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const availableProducts = products.length > 0 ? products : productsContext?.products || [];

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
      new Fuse(CATEGORIES, {
        keys: ['name'],
        threshold: 0.35,
        ignoreLocation: true,
      }),
    [],
  );

  // Criar instância Fuse.js para busca fuzzy de fornecedores
  const supplierFuse = useMemo(
    () =>
      new Fuse(SUPPLIERS, {
        keys: ['name'],
        threshold: 0.35,
        ignoreLocation: true,
      }),
    [],
  );

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
        sublabel: `SKU: ${exactSkuMatch.sku || ''} • ${exactSkuMatch.category_name || ''}`,
        icon: '📦',
        data: exactSkuMatch,
      });
    }

    const orderedProducts = rankProductSearchResults(
      availableProducts,
      searchTerm,
      productFuse,
    ).slice(0, 6);

    orderedProducts.forEach((product) => {
      // Skip if already added as exact SKU match
      if (results.some((r) => r.id === product.id)) return;
      results.push({
        type: 'product',
        id: product.id,
        label: product.name,
        sublabel: `${product.sku || ''} • ${product.category_name || ''}`,
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
      const productCount = availableProducts.filter(
        (p) => p.category_id != null && p.category_id === String(category.id),
      ).length;
      results.push({
        type: 'category',
        id: String(category.id),
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
      const supTokens = normalizeProductSearch(supplier.name)
        .split(/[\s|]+/)
        .filter((t) => t.length >= 3);
      const productCount = availableProducts.filter((p) => {
        if (!p.brand) return false;
        const b = normalizeProductSearch(p.brand);
        return supTokens.some((t) => b.includes(t));
      }).length;
      results.push({
        type: 'supplier',
        id: supplier.id,
        label: supplier.name,
        sublabel: `${productCount} produtos`,
        icon: '🏭',
      });
    });

    return results;
  }, [query, history, availableProducts, productFuse, categoryFuse, supplierFuse]);

  // Quick suggestions (popular/trending)
  const quickSuggestions = useMemo(() => {
    return [
      { label: 'Canetas', icon: '🖊️' },
      { label: 'Garrafas', icon: '🍶' },
      { label: 'Ecológico', icon: '🌱' },
      { label: 'Tecnologia', icon: '💻' },
      { label: 'Kits', icon: '🎁' },
    ];
  }, []);

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
  };
}
