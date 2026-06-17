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
        // SSOT: produtos com reposição em trânsito ainda estão saudáveis no
        // dashboard (estoque atual cobre a demanda); contar como "in stock"
        // garante que os 4 buckets fechem com `totalProducts` (bug #2 —
        // 305 produtos ficavam fora dos 4 cartões).
        case 'incoming':
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

  // Índices normalizados (cor → produtos, produtos com alerta) — reutilizados
  // entre mudanças de filtro/paginação para evitar varreduras O(N×M).
  const stockIndexes = useMemo(
    () => buildStockIndexes(productStocks, alerts),
    [productStocks, alerts],
  );

  const filteredProducts = useMemo(
    () => applyStockFilters(productStocks, filters, alerts, stockIndexes),
    [productStocks, filters, alerts, stockIndexes],
  );

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
