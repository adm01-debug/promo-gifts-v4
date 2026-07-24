import { useEffect, useRef, useState } from 'react';
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
import { ZeroResultDiagnosisCallout } from '@/components/intelligence/ZeroResultDiagnosisCallout';
import { Brain, Clock } from 'lucide-react';
import { useDebouncedFilters } from '@/hooks/common';
import { useCommercialKPIs } from '@/hooks/intelligence';
import type { FilterKey } from '@/hooks/intelligence/useZeroResultDiagnosis';
import {
  trackZeroResultOutcome,
  type ZeroResultAction,
  type ZeroResultCulprit,
} from '@/lib/analytics/zeroResultAnalytics';

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

  // KPIs consumidos aqui p/ decidir se exibimos o diagnóstico de "resultado zero".
  // react-query dedupa a chamada com IntelligenceKPICards (mesma queryKey).
  const { data: kpis, isLoading: isLoadingKpis } = useCommercialKPIs(
    filters.days,
    filters.categoryId,
    filters.supplierId,
    filters.productId,
  );
  const hasActiveFilter = !!(filters.categoryId || filters.supplierId || filters.productId);
  const isEmptyResult =
    !isLoadingKpis && !!kpis && kpis.totalOrders === 0 && kpis.totalQuotes === 0;
  const showZeroDiagnosis = isEmptyResult && (hasActiveFilter || filters.days <= 30);

  // Rastreio da ação em curso — usado para emitir `bi.zero_result.outcome`
  // assim que a nova query de KPIs terminar. Mantido em ref para não causar
  // re-render extra.
  const pendingActionRef = useRef<{
    action: ZeroResultAction;
    culpritBefore: ZeroResultCulprit;
    daysBefore: number;
    startedAt: number;
  } | null>(null);

  // Snapshot dos filtros ANTES da última ação disparada pelo callout. Usado
  // pelo botão "Desfazer". Mantido em state para forçar re-render e alternar
  // a visibilidade do botão. Limpo assim que o usuário desfaz ou muda filtros
  // manualmente por outra via.
  const [undoSnapshot, setUndoSnapshot] = useState<IntelligenceFilters | null>(null);

  const beginPendingAction = (
    action: ZeroResultAction,
    culpritBefore: ZeroResultCulprit,
  ) => {
    pendingActionRef.current = {
      action,
      culpritBefore,
      daysBefore: filters.days,
      startedAt: performance.now(),
    };
  };

  const captureUndoSnapshot = () => {
    // Congela o estado ATUAL (pré-ação) para permitir reversão.
    setUndoSnapshot(rawFilters);
  };

  const clearFilter = (key: FilterKey) => {
    captureUndoSnapshot();
    beginPendingAction('clear_filter', key);
    setFilters((prev) => {
      if (key === 'category') return { ...prev, categoryId: null, categoryName: null };
      if (key === 'supplier') return { ...prev, supplierId: null, supplierName: null };
      return { ...prev, productId: null, productName: null };
    });
  };

  const widenWindow = () => {
    captureUndoSnapshot();
    beginPendingAction('widen_window', 'window');
    setFilters((prev) => {
      const ladder = [7, 30, 90, 180, 365];
      const next = ladder.find((d) => d > prev.days) ?? 365;
      return { ...prev, days: next };
    });
  };

  const applySubstitute = (
    key: FilterKey,
    value: { id: string; name: string },
  ) => {
    captureUndoSnapshot();
    beginPendingAction('apply_substitute', key);
    setFilters((prev) => {
      if (key === 'category') return { ...prev, categoryId: value.id, categoryName: value.name };
      if (key === 'supplier') return { ...prev, supplierId: value.id, supplierName: value.name };
      return { ...prev, productId: value.id, productName: value.name };
    });
  };

  const undoLastAction = () => {
    if (!undoSnapshot) return;
    beginPendingAction('undo', null);
    setFilters(undoSnapshot);
    setUndoSnapshot(null);
  };

  // Emite `bi.zero_result.outcome` quando os KPIs da nova consulta chegam
  // após uma ação do usuário no callout. Roda no máximo uma vez por ação
  // (o ref é limpo após emitir).
  useEffect(() => {
    const pending = pendingActionRef.current;
    if (!pending) return;
    if (isLoadingKpis || !kpis) return;
    const stillZero = kpis.totalOrders === 0 && kpis.totalQuotes === 0;
    trackZeroResultOutcome({
      action: pending.action,
      culpritBefore: pending.culpritBefore,
      culpritAfter: stillZero ? pending.culpritBefore : null,
      stillZero,
      daysBefore: pending.daysBefore,
      daysAfter: filters.days,
      resolvedInMs: Math.round(performance.now() - pending.startedAt),
    });
    pendingActionRef.current = null;
  }, [isLoadingKpis, kpis, filters.days]);


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

        {/* Diagnóstico automático quando o painel retorna zero */}
        {showZeroDiagnosis && (
          <div className="animate-fade-in" style={{ animationDelay: '75ms' }}>
            <ZeroResultDiagnosisCallout
              enabled={showZeroDiagnosis}
              days={filters.days}
              categoryId={filters.categoryId}
              supplierId={filters.supplierId}
              productId={filters.productId}
              categoryName={filters.categoryName}
              supplierName={filters.supplierName}
              productName={filters.productName}
              onClearFilter={clearFilter}
              onWidenWindow={widenWindow}
              onApplySubstitute={applySubstitute}
              canUndo={!!undoSnapshot}
              onUndo={undoLastAction}
            />
          </div>
        )}

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
