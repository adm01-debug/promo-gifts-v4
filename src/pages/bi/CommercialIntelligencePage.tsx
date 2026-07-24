import { useState } from 'react';
import { PageSEO } from '@/components/seo/PageSEO';
import {
  IntelligenceFilterBar,
  type IntelligenceFilters,
} from '@/components/intelligence/IntelligenceFilterBar';
import { IntelligenceKPICards } from '@/components/intelligence/IntelligenceKPICards';
import { MarketIntelligenceInsightsCard } from '@/components/intelligence/MarketIntelligenceInsightsCard';
import { MarketIntelligenceChart } from '@/components/intelligence/MarketIntelligenceChart';
import { SalesOverviewChart } from '@/components/intelligence/SalesOverviewChart';
import { TrendingProducts } from '@/components/intelligence/TrendingProducts';
import { ProductRankingSearch } from '@/components/intelligence/ProductRankingSearch';
import { CategoryRanking } from '@/components/intelligence/CategoryRanking';
import { SupplierSales } from '@/components/intelligence/SupplierSales';
import { GoldSyncBadge } from '@/components/intelligence/GoldSyncBadge';
import { Brain, Clock } from 'lucide-react';
import { useDebouncedFilters } from '@/hooks/common';

export default function CommercialIntelligencePage() {
  const [lastRefresh] = useState<Date>(new Date());
  const [rawFilters, setRawFilters] = useState<IntelligenceFilters>({
    days: 30,
    categoryId: null,
    categoryName: null,
    supplierId: null,
    supplierName: null,
    productId: null,
    productName: null,
  });

  // Debounce 300ms — evita refetch em cascata ao trocar filtros rapidamente
  const filters = useDebouncedFilters(rawFilters, 300);
  const setFilters = setRawFilters;

  const formatRelative = (d: Date) => {
    const diff = Math.round((Date.now() - d.getTime()) / 1000);
    if (diff < 60) return 'agora';
    if (diff < 3600) return `há ${Math.floor(diff / 60)} min`;
    return `há ${Math.floor(diff / 3600)}h`;
  };

  return (
    <>
      <PageSEO
        title="Inteligência de Mercado"
        description="Painel estratégico com insights de mercado para decisões comerciais."
        path="/inteligencia-comercial"
        noIndex
      />
      <div className="mx-auto w-full max-w-[1920px] animate-fade-in space-y-3 px-3 py-3 pb-24 sm:space-y-4 sm:px-4 sm:py-4 md:pb-6 lg:px-6 xl:px-8">
        {/* Header */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-indigo-700 shadow-lg shadow-violet-500/20">
            <Brain className="h-5 w-5 text-primary-foreground" />
          </div>
          <div className="min-w-0 flex-1">
            <h1
              data-testid="page-title-inteligencia-mercado"
              className="font-display text-xl font-bold text-foreground"
            >
              Inteligência de Mercado
            </h1>
            <p className="text-sm text-muted-foreground">
              Produtos & Fornecedores · comportamento do mercado + vendas internas
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <GoldSyncBadge windowDays={filters.days} />
            <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="h-3.5 w-3.5" aria-hidden="true" />
              Atualizado {formatRelative(lastRefresh)}
            </span>
          </div>
        </div>

        {/* Filters — sticky no scroll · UI controlada por rawFilters (sem latência), refetch debounced */}
        <div className="sticky top-[calc(var(--header-h,56px)+var(--breadcrumb-h,0px))] z-20 -mx-3 border-b border-border/40 bg-background/85 px-3 py-2 backdrop-blur-md sm:-mx-4 sm:px-4 lg:-mx-6 lg:px-6 xl:-mx-8 xl:px-8">
          <IntelligenceFilterBar filters={rawFilters} onFiltersChange={setFilters} />
        </div>

        {/* KPI Summary */}
        <div className="animate-fade-in" style={{ animationDelay: '50ms' }}>
          <IntelligenceKPICards
            days={filters.days}
            categoryId={filters.categoryId}
            supplierId={filters.supplierId}
            productId={filters.productId}
            categoryName={filters.categoryName}
            supplierName={filters.supplierName}
          />
        </div>

        {/* AI Insights */}
        <div className="animate-fade-in" style={{ animationDelay: '100ms' }}>
          <MarketIntelligenceInsightsCard
            days={filters.days}
            categoryId={filters.categoryId}
            supplierId={filters.supplierId}
            productId={filters.productId}
            categoryName={filters.categoryName}
            supplierName={filters.supplierName}
            productName={filters.productName}
          />
        </div>

        {/* 1. Market Intelligence */}
        <div className="animate-fade-in" style={{ animationDelay: '150ms' }}>
          <MarketIntelligenceChart
            days={filters.days}
            supplierId={filters.supplierId}
            productId={filters.productId}
          />
        </div>

        {/* 2. Product Ranking Search — main feature */}
        <div className="animate-fade-in" style={{ animationDelay: '200ms' }}>
          <ProductRankingSearch />
        </div>

        {/* 3. Ranking de Categorias */}
        <div className="animate-fade-in" style={{ animationDelay: '250ms' }}>
          <CategoryRanking
            days={filters.days}
            categoryId={filters.categoryId}
            supplierId={filters.supplierId}
            productId={filters.productId}
            categoryName={filters.categoryName}
          />
        </div>

        {/* 4+5. Produtos em Alta + Vendas por Fornecedor */}
        <div
          className="grid animate-fade-in grid-cols-1 gap-6 lg:grid-cols-2"
          style={{ animationDelay: '300ms' }}
        >
          <TrendingProducts
            days={filters.days}
            categoryId={filters.categoryId}
            supplierId={filters.supplierId}
            productId={filters.productId}
            categoryName={filters.categoryName}
          />
          <SupplierSales
            days={filters.days}
            categoryId={filters.categoryId}
            supplierId={filters.supplierId}
            productId={filters.productId}
            categoryName={filters.categoryName}
          />
        </div>

        {/* 5. Vendas Internas */}
        <div className="animate-fade-in" style={{ animationDelay: '350ms' }}>
          <SalesOverviewChart days={filters.days} />
        </div>
      </div>
    </>
  );
}
