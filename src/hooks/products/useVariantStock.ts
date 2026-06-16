/**
 * useVariantStock — Hook de estoque por variante (refatorado)
 * Fetcher em stock/stockFetcher.ts, alertas em stock/stockAlerts.ts
 */
import { useState, useMemo, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  type ProductStockSummary,
  type StockFilters,
  type StockDashboardSummary,
  type VariantStock,
  defaultStockFilters,
} from '@/types/stock';
import { fetchAndProcessStockData } from '@/hooks/stock/stockFetcher';
import { applyStockFilters, buildStockIndexes } from '@/lib/inventory/stock-filter';

export function useVariantStock() {
  const [filters, setFilters] = useState<StockFilters>(defaultStockFilters);
  const [dismissedAlerts, setDismissedAlerts] = useState<Set<string>>(new Set());
  const queryClient = useQueryClient();

  const { data, isLoading, isFetching, error } = useQuery({
    queryKey: ['variant-stock-data'],
    queryFn: fetchAndProcessStockData,
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    retry: 3,
    retryDelay: (attempt) => Math.min(1000 * Math.pow(2, attempt), 10000),
  });

  const productStocks = useMemo(() => data?.productStocks ?? [], [data?.productStocks]);
  const rawAlerts = useMemo(() => data?.alerts ?? [], [data?.alerts]);
  const futureStock = useMemo(() => data?.futureStock ?? [], [data?.futureStock]);

  const alerts = useMemo(() => {
    if (dismissedAlerts.size === 0) return rawAlerts;
    return rawAlerts.filter((a) => !dismissedAlerts.has(a.id));
  }, [rawAlerts, dismissedAlerts]);

  const loadingProgress = useMemo(() => {
    if (isLoading) return { step: 'Carregando dados em paralelo...', current: 0, total: 3 };
    return { step: '', current: 3, total: 3 };
  }, [isLoading]);

  const fetchStockData = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['variant-stock-data'] });
  }, [queryClient]);

  const summary = useMemo((): StockDashboardSummary => {
    // Single-loop aggregation for O(n) instead of O(8n)
    let totalVariants = 0;
    let productsInStock = 0,
      productsLowStock = 0,
      productsCritical = 0,
      productsOutOfStock = 0;
    let variantsInStock = 0,
      variantsLowStock = 0,
      variantsCritical = 0,
      variantsOutOfStock = 0;
    let daysSum = 0;
    const colorSet = new Set<string>();

    for (const p of productStocks) {
      switch (p.overallStatus) {
        case 'in_stock':
          productsInStock++;
          break;
        case 'low_stock':
          productsLowStock++;
          break;
        case 'critical':
          productsCritical++;
          break;
        case 'out_of_stock':
          productsOutOfStock++;
          break;
      }
      for (const v of p.variants) {
        totalVariants++;
        if (v.colorName) colorSet.add(v.colorName);
        daysSum += v.daysUntilStockout || 0;
        switch (v.status) {
          case 'in_stock':
            variantsInStock++;
            break;
          case 'low_stock':
            variantsLowStock++;
            break;
          case 'critical':
            variantsCritical++;
            break;
          case 'out_of_stock':
            variantsOutOfStock++;
            break;
        }
      }
    }

    let criticalAlerts = 0;
    for (const a of alerts) {
      if (a.severity === 'error') criticalAlerts++;
    }

    return {
      totalProducts: productStocks.length,
      totalVariants,
      totalColors: colorSet.size,
      productsInStock,
      productsLowStock,
      productsCritical,
      productsOutOfStock,
      variantsInStock,
      variantsLowStock,
      variantsCritical,
      variantsOutOfStock,
      totalStockValue: 0,
      totalAvailableValue: 0,
      averageDaysOfStock: daysSum / Math.max(1, totalVariants),
      stockTurnoverRate: 0,
      totalAlerts: alerts.length,
      criticalAlerts,
      incomingStockValue: 0,
    };
  }, [productStocks, alerts]);

  // Extract unique categories and suppliers for filter dropdowns
  const availableCategories = useMemo(() => {
    const map = new Map<string, number>();
    productStocks.forEach((p) => {
      const cat = p.categoryName || 'Sem categoria';
      map.set(cat, (map.get(cat) || 0) + 1);
    });
    return Array.from(map.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [productStocks]);

  const availableSuppliers = useMemo(() => {
    const map = new Map<string, number>();
    productStocks.forEach((p) => {
      const sup = p.supplierName || 'Sem fornecedor';
      map.set(sup, (map.get(sup) || 0) + 1);
    });
    return Array.from(map.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [productStocks]);

  const availableColorGroups = useMemo(() => {
    const map = new Map<string, number>();
    productStocks.forEach((p) => {
      p.variants.forEach((v) => {
        if (v.colorName && v.colorName !== 'Padrão') {
          map.set(v.colorName, (map.get(v.colorName) || 0) + 1);
        }
      });
    });
    return Array.from(map.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [productStocks]);

  const filteredProducts = useMemo(() => {
    const searchLower = filters.search?.toLowerCase().trim();
    const colorName = filters.colorName;
    const colorGroupLower = filters.colorGroup?.toLowerCase();
    const minQuantityNeeded = filters.minQuantityNeeded ?? 0;

    // Variant-level matcher: projeta apenas variações que casam com cor/grupo.
    const matchVariant = (v: (typeof productStocks)[number]['variants'][number]) => {
      if (colorName && v.colorName !== colorName) return false;
      if (colorGroupLower && !v.colorName?.toLowerCase().includes(colorGroupLower)) return false;
      return true;
    };

    const hasVariantFilter = Boolean(colorName) || Boolean(colorGroupLower);

    let items = productStocks
      .map((p) => ({
        product: p,
        variantsForFilter: hasVariantFilter ? p.variants.filter(matchVariant) : p.variants,
      }))
      // Drop produtos sem variação compatível quando filtro de cor está ativo
      .filter(({ variantsForFilter }) => (hasVariantFilter ? variantsForFilter.length > 0 : true));

    if (filters.status !== 'all') {
      items = items.filter(({ product: p, variantsForFilter }) => {
        if (filters.status === 'incoming') {
          return (
            p.totalInTransitStock > 0 ||
            variantsForFilter.some((v) => v.status === 'incoming' || v.inTransitStock > 0)
          );
        }
        if (hasVariantFilter) {
          return variantsForFilter.some(
            (v) =>
              v.status === filters.status ||
              (filters.status === 'low_stock' && v.status === 'critical'),
          );
        }
        if (p.overallStatus === filters.status) return true;
        if (filters.status === 'low_stock' && p.overallStatus === 'critical') return true;
        return p.variants.some((v) => v.status === filters.status);
      });
    }

    if (searchLower) {
      items = items.filter(({ product: p, variantsForFilter }) => {
        if (
          p.productName.toLowerCase().includes(searchLower) ||
          p.productSku.toLowerCase().includes(searchLower)
        )
          return true;
        return variantsForFilter.some(
          (v) =>
            v.colorName?.toLowerCase().includes(searchLower) ||
            v.variantSku.toLowerCase().includes(searchLower),
        );
      });
    }

    if (filters.categoryId) {
      items = items.filter(({ product: p }) => p.categoryName === filters.categoryId);
    }

    if (filters.supplierId) {
      items = items.filter(({ product: p }) => p.supplierName === filters.supplierId);
    }

    // minQuantityNeeded avaliado sobre o pool das variações compatíveis quando há filtro de cor.
    if (minQuantityNeeded > 0) {
      items = items.filter(({ product: p, variantsForFilter }) => {
        const pool = hasVariantFilter
          ? variantsForFilter.reduce((sum, v) => sum + v.availableStock, 0)
          : p.totalAvailableStock;
        return pool >= minQuantityNeeded;
      });
    }

    if (filters.showOnlyWithAlerts) {
      const ids = new Set(alerts.map((a) => a.productId));
      items = items.filter(({ product: p }) => ids.has(p.productId));
    }

    // Projeta produto com somente as variações filtradas e totais recalculados.
    const projected = items.map(({ product: p, variantsForFilter }) => {
      if (!hasVariantFilter || variantsForFilter.length === p.variants.length) return p;
      return {
        ...p,
        variants: variantsForFilter,
        totalVariants: variantsForFilter.length,
        totalCurrentStock: variantsForFilter.reduce((s, v) => s + v.currentStock, 0),
        totalMinStock: variantsForFilter.reduce((s, v) => s + v.minStock, 0),
        totalReservedStock: variantsForFilter.reduce((s, v) => s + v.reservedStock, 0),
        totalInTransitStock: variantsForFilter.reduce((s, v) => s + v.inTransitStock, 0),
        totalAvailableStock: variantsForFilter.reduce((s, v) => s + v.availableStock, 0),
      };
    });

    const dir = filters.sortDirection === 'asc' ? 1 : -1;
    switch (filters.sortBy) {
      case 'name':
        projected.sort((a, b) => a.productName.localeCompare(b.productName) * dir);
        break;
      case 'sku':
        projected.sort((a, b) => a.productSku.localeCompare(b.productSku) * dir);
        break;
      case 'stock_quantity':
        projected.sort((a, b) => (a.totalCurrentStock - b.totalCurrentStock) * dir);
        break;
      case 'available_stock':
        projected.sort((a, b) => (a.totalAvailableStock - b.totalAvailableStock) * dir);
        break;
      case 'days_remaining':
        projected.sort(
          (a, b) => ((a.daysUntilFullStockout ?? 999) - (b.daysUntilFullStockout ?? 999)) * dir,
        );
        break;
    }

    return projected;
  }, [productStocks, filters, alerts]);

  const allColors = useMemo(() => {
    const s = new Set<string>();
    productStocks.forEach((p) =>
      p.variants.forEach((v) => {
        if (v.colorName) s.add(v.colorName);
      }),
    );
    return Array.from(s).sort();
  }, [productStocks]);

  const criticalAlerts = useMemo(() => alerts.filter((a) => a.severity === 'error'), [alerts]);

  const updateFilter = useCallback(
    <K extends keyof StockFilters>(key: K, value: StockFilters[K]) => {
      setFilters((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const resetFilters = useCallback(() => setFilters(defaultStockFilters), []);

  const dismissAlert = useCallback((alertId: string) => {
    setDismissedAlerts((prev) => new Set(prev).add(alertId));
  }, []);

  const dismissAllAlerts = useCallback(() => {
    setDismissedAlerts(new Set(rawAlerts.map((a) => a.id)));
  }, [rawAlerts]);

  const dismissAlertsBySeverity = useCallback(
    (severity: 'error' | 'warning' | 'info') => {
      setDismissedAlerts((prev) => {
        const next = new Set(prev);
        rawAlerts.filter((a) => a.severity === severity).forEach((a) => next.add(a.id));
        return next;
      });
    },
    [rawAlerts],
  );

  const getProductStock = useCallback(
    (productId: string): ProductStockSummary | undefined => {
      return productStocks.find((p) => p.productId === productId);
    },
    [productStocks],
  );

  const getColorStock = useCallback(
    (productId: string, colorName: string): VariantStock[] => {
      const product = productStocks.find((p) => p.productId === productId);
      return product?.variants.filter((v) => v.colorName === colorName) || [];
    },
    [productStocks],
  );

  return {
    isLoading,
    isFetching,
    loadingProgress,
    productStocks: filteredProducts,
    allProductStocks: productStocks,
    summary,
    alerts,
    criticalAlerts,
    futureStock,
    filters,
    allColors,
    availableCategories,
    availableSuppliers,
    availableColorGroups,
    fetchStockData,
    updateFilter,
    resetFilters,
    dismissAlert,
    dismissAllAlerts,
    dismissAlertsBySeverity,
    error,
    setFilters,
    getProductStock,
    getColorStock,
  };
}

export function useProductVariantStock(productId: string) {
  const {
    productStocks: _productStocks,
    alerts,
    isLoading,
    fetchStockData,
    allProductStocks,
  } = useVariantStock();

  const productStock = useMemo(
    () => allProductStocks.find((p) => p.productId === productId),
    [allProductStocks, productId],
  );
  const productAlerts = useMemo(
    () => alerts.filter((a) => a.productId === productId),
    [alerts, productId],
  );

  return {
    isLoading,
    productStock,
    variants: productStock?.variants || [],
    colors: productStock?.availableColors || [],
    alerts: productAlerts,
    refresh: fetchStockData,
  };
}
