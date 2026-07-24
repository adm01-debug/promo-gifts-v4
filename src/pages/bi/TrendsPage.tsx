import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { untypedFrom } from '@/lib/supabase-untyped';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { TrendingUp, Search, Package, Calendar, RefreshCw, Download } from 'lucide-react';
import { format, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { PageSEO } from '@/components/seo/PageSEO';
import { ProductsTabContent, SearchesTabContent } from '@/pages/trends/TrendsCharts';
import { TrendsKpiCards } from '@/pages/trends/TrendsKpiCards';
import { UnmetDemandCard } from '@/components/intelligence/UnmetDemandCard';
import { HotSearchesCard } from '@/components/intelligence/HotSearchesCard';
import { ConversionFunnel } from '@/components/intelligence/ConversionFunnel';
import { TrendsHeatmap } from '@/components/intelligence/TrendsHeatmap';
import { TopCategoriesCard } from '@/components/intelligence/TopCategoriesCard';
import { TrendsInsightsCard } from '@/components/intelligence/TrendsInsightsCard';
import { TrendsForecastChart } from '@/components/intelligence/TrendsForecastChart';
import { SavedViewsManager } from '@/components/intelligence/SavedViewsManager';
import { RealtimeBadge } from '@/components/intelligence/RealtimeBadge';
import { TrendsTour } from '@/components/intelligence/TrendsTour';
import { calculateTrendingScore } from '@/lib/trending-score';
import { useUrlState, useUrlBoolean } from '@/hooks/common';
import { exportTrendsCsv } from '@/lib/trends-export';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/ui';
import {
  isDemoMode,
  MOCK_KPI_CURRENT,
  MOCK_KPI_PREVIOUS,
  MOCK_PRODUCTS,
  MOCK_SEARCHES,
  buildMockDaily,
} from '@/pages/trends/trends-mock';
import { Badge } from '@/components/ui/badge';

type DateRange = '7d' | '30d' | '90d';

const RANGE_TO_DAYS: Record<DateRange, number> = { '7d': 7, '30d': 30, '90d': 90 };

interface ProductView {
  product_id: string | null;
  product_name: string | null;
  product_sku: string | null;
  view_type: string | null;
  created_at: string;
}

interface SearchRow {
  search_term: string;
  results_count: number;
  created_at: string;
}

interface AggregatedProduct {
  id: string;
  name: string;
  sku?: string;
  views: number;
  details: number;
  compares: number;
  favorites: number;
  recentViews: number;
  baselineViews: number;
  trendingScore: number;
  classification: 'falling' | 'new' | 'rising' | 'stable';
}

interface AggregatedSearch {
  term: string;
  count: number;
  totalResults: number;
  avgResults: number;
}

export default function TrendsPage() {
  const { canManage } = useAuth();
  const { toast } = useToast();
  const [dateRange, setDateRange] = useUrlState<DateRange>('range', '30d');
  const [activeTab, setActiveTab] = useUrlState<string>('tab', 'products');
  const [showCompare, setShowCompare] = useUrlBoolean('cmp', false);
  const [showForecast, setShowForecast] = useUrlBoolean('fc', false);
  const days = RANGE_TO_DAYS[dateRange] ?? 30;

  // MÓDULO ABERTO: Todos os usuários agora veem a visão macro de tendências.
  // O filtro sellerScope foi desativado para permitir que vendedores vejam dados agregados de mercado.
  const sellerScope = null;
  const scopeKey = 'all';
  const demo = isDemoMode();

  const { sinceCurrent, sincePrevious, recentCutoff } = useMemo(() => {
    const now = new Date();
    return {
      sinceCurrent: subDays(now, days).toISOString(),
      sincePrevious: subDays(now, days * 2).toISOString(),
      recentCutoff: subDays(now, Math.max(Math.floor(days / 3), 1)).toISOString(),
    };
  }, [days]);

  // ============================================
  // Top Products
  // ============================================
  const {
    data: topProducts,
    isLoading: loadingProducts,
    refetch: refetchProducts,
  } = useQuery({
    queryKey: ['trends-products', dateRange, scopeKey],
    queryFn: async (): Promise<AggregatedProduct[]> => {
      let q = untypedFrom('product_views')
        .select('product_id, product_name, product_sku, view_type, created_at, seller_id')
        .gte('created_at', sincePrevious)
        .order('created_at', { ascending: false });
      if (sellerScope) q = q.eq('seller_id', sellerScope);
      const { data, error } = await q;
      if (error) throw error;

      const productMap = new Map<string, AggregatedProduct>();
      const recentDays = Math.max(Math.floor(days / 3), 1);
      const baselineDays = days - recentDays;

      (data ?? []).forEach((view: ProductView) => {
        const key = view.product_id || view.product_name;
        if (!key) return;
        const isInCurrentWindow = view.created_at >= sinceCurrent;
        const isRecent = view.created_at >= recentCutoff;

        const existing = productMap.get(key) ?? {
          id: key,
          name: view.product_name ?? 'Produto',
          sku: view.product_sku ?? undefined,
          views: 0,
          details: 0,
          compares: 0,
          favorites: 0,
          recentViews: 0,
          baselineViews: 0,
          trendingScore: 0,
          classification: 'stable' as const,
        };

        if (isInCurrentWindow) {
          existing.views += 1;
          if (view.view_type === 'detail') existing.details += 1;
          if (view.view_type === 'compare') existing.compares += 1;
          if (view.view_type === 'favorite') existing.favorites += 1;
          if (isRecent) existing.recentViews += 1;
        } else {
          existing.baselineViews += 1;
        }
        productMap.set(key, existing);
      });

      const enriched = Array.from(productMap.values()).map((p) => {
        const score = calculateTrendingScore({
          recentCount: p.recentViews,
          baselineCount: p.baselineViews,
          recentDays,
          baselineDays,
          totalVolume: p.views,
        });
        return { ...p, trendingScore: score.score, classification: score.classification };
      });

      return enriched
        .filter((p) => p.views > 0)
        .sort(
          (a, b) =>
            b.trendingScore * Math.log(b.views + 1) - a.trendingScore * Math.log(a.views + 1),
        )
        .slice(0, 10);
    },
  });

  // ============================================
  // Top Searches
  // ============================================
  const {
    data: searchesData,
    isLoading: loadingSearches,
    refetch: refetchSearches,
  } = useQuery({
    queryKey: ['trends-searches', dateRange, scopeKey],
    queryFn: async () => {
      let q = untypedFrom('search_analytics')
        .select('search_term, results_count, created_at, seller_id')
        .gte('created_at', sincePrevious)
        .order('created_at', { ascending: false });
      if (sellerScope) q = q.eq('seller_id', sellerScope);
      const { data, error } = await q;
      if (error) throw error;

      const current = new Map<string, { count: number; totalResults: number }>();
      const previous = new Map<string, { count: number }>();

      (data ?? []).forEach((s: SearchRow) => {
        const term = (s.search_term ?? '').toLowerCase().trim();
        if (!term) return;
        if (s.created_at >= sinceCurrent) {
          const e = current.get(term) ?? { count: 0, totalResults: 0 };
          e.count += 1;
          e.totalResults += s.results_count ?? 0;
          current.set(term, e);
        } else {
          const e = previous.get(term) ?? { count: 0 };
          e.count += 1;
          previous.set(term, e);
        }
      });

      const currentArr: AggregatedSearch[] = Array.from(current.entries())
        .map(([term, d]) => ({
          term,
          count: d.count,
          totalResults: d.totalResults,
          avgResults: d.count > 0 ? Math.round(d.totalResults / d.count) : 0,
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      return { current: currentArr };
    },
  });

  const topSearches = searchesData?.current;

  // ============================================
  // Daily activity (atual + anterior para comparação)
  // ============================================
  const { data: dailyData, isLoading: loadingDaily } = useQuery({
    queryKey: ['trends-daily', dateRange, scopeKey],
    queryFn: async () => {
      const buildQ = (table: string, since: string) => {
        let q = untypedFrom(table).select('created_at, seller_id').gte('created_at', since);
        if (sellerScope) q = q.eq('seller_id', sellerScope);
        return q;
      };
      const [{ data: views, error: ve }, { data: searches, error: se }] = await Promise.all([
        buildQ('product_views', sincePrevious),
        buildQ('search_analytics', sincePrevious),
      ]);
      const trendErr = ve || se;
      if (trendErr) throw new Error(trendErr.message ?? String(trendErr));

      // Buckets atual + anterior (mesmo número de dias)
      const cur = new Map<string, { date: string; views: number; searches: number }>();
      const prev = new Map<string, { views: number; searches: number }>();
      for (let i = days - 1; i >= 0; i--) {
        const d = format(subDays(new Date(), i), 'yyyy-MM-dd');
        cur.set(d, { date: d, views: 0, searches: 0 });
      }
      for (let i = days - 1; i >= 0; i--) {
        const d = format(subDays(new Date(), days + i), 'yyyy-MM-dd');
        prev.set(d, { views: 0, searches: 0 });
      }
      views?.forEach((v: { created_at: string }) => {
        const d = format(new Date(v.created_at), 'yyyy-MM-dd');
        const c = cur.get(d);
        if (c) {
          c.views += 1;
          return;
        }
        const p = prev.get(d);
        if (p) p.views += 1;
      });
      searches?.forEach((s: { created_at: string }) => {
        const d = format(new Date(s.created_at), 'yyyy-MM-dd');
        const c = cur.get(d);
        if (c) {
          c.searches += 1;
          return;
        }
        const p = prev.get(d);
        if (p) p.searches += 1;
      });
      const current = Array.from(cur.values()).map((d) => ({
        ...d,
        dateLabel: format(new Date(d.date), 'dd/MM', { locale: ptBR }),
      }));
      const previous = Array.from(prev.values()).map((p) => ({
        date: '',
        views: p.views,
        searches: p.searches,
      }));
      return { current, previous };
    },
  });

  // ============================================
  // KPIs (atuais + anteriores)
  // ============================================
  const { data: kpiSnapshot } = useQuery({
    queryKey: ['trends-kpi-snapshot', dateRange, scopeKey],
    queryFn: async () => {
      const buildQ = (table: string, fields: string) => {
        let q = untypedFrom(table).select(fields).gte('created_at', sincePrevious);
        if (sellerScope) q = q.eq('seller_id', sellerScope);
        return q;
      };
      const [{ data: vAllRaw }, { data: sAllRaw }] = await Promise.all([
        buildQ('product_views', 'product_id, product_name, created_at, seller_id'),
        buildQ('search_analytics', 'search_term, created_at, seller_id'),
      ]);
      // untypedFrom is the escape hatch for tables outside the generated schema;
      // the select() rows come back loosely typed, so narrow to the shape we read.
      const vAll = (vAllRaw ?? []) as unknown as Array<
        Record<string, unknown> & { created_at: string }
      >;
      const sAll = (sAllRaw ?? []) as unknown as Array<
        Record<string, unknown> & { created_at: string }
      >;
      const split = (
        rows: Array<{ created_at: string }>,
        keyFn: (r: Record<string, unknown>) => string | null,
      ) => {
        let curTotal = 0,
          prevTotal = 0;
        const curUnique = new Set<string>(),
          prevUnique = new Set<string>();
        rows?.forEach((r) => {
          const k = keyFn(r);
          if (r.created_at >= sinceCurrent) {
            curTotal += 1;
            if (k) curUnique.add(k);
          } else {
            prevTotal += 1;
            if (k) prevUnique.add(k);
          }
        });
        return { curTotal, prevTotal, curUnique: curUnique.size, prevUnique: prevUnique.size };
      };
      const v = split(vAll, (r) => (r.product_id ?? r.product_name ?? null) as string | null);
      const s = split(sAll, (r) => String(r.search_term ?? '').toLowerCase());
      return {
        current: {
          totalViews: v.curTotal,
          totalSearches: s.curTotal,
          uniqueProducts: v.curUnique,
          uniqueSearches: s.curUnique,
        },
        previous: {
          totalViews: v.prevTotal,
          totalSearches: s.prevTotal,
          uniqueProducts: v.prevUnique,
          uniqueSearches: s.prevUnique,
        },
      };
    },
  });

  const kpiCurrent = demo
    ? MOCK_KPI_CURRENT
    : (kpiSnapshot?.current ?? {
        totalViews: 0,
        totalSearches: 0,
        uniqueProducts: 0,
        uniqueSearches: 0,
      });
  const kpiPrevious = demo
    ? MOCK_KPI_PREVIOUS
    : (kpiSnapshot?.previous ?? {
        totalViews: 0,
        totalSearches: 0,
        uniqueProducts: 0,
        uniqueSearches: 0,
      });

  // Override de demo para ranking, buscas e série diária
  const mockDaily = useMemo(() => (demo ? buildMockDaily(days) : null), [demo, days]);
  const displayProducts = demo ? MOCK_PRODUCTS : topProducts;
  const displaySearches = demo ? MOCK_SEARCHES : topSearches;
  const displayDaily = demo ? mockDaily : dailyData;
  const displayLoadingProducts = demo ? false : loadingProducts;
  const displayLoadingSearches = demo ? false : loadingSearches;
  const displayLoadingDaily = demo ? false : loadingDaily;

  const handleRefresh = () => {
    refetchProducts();
    refetchSearches();
  };

  const handleExportProducts = () => {
    if (!displayProducts?.length) {
      toast({
        title: 'Sem dados',
        description: 'Nada para exportar ainda.',
        variant: 'destructive',
      });
      return;
    }
    exportTrendsCsv(
      'tendencias_produtos',
      displayProducts.map((p) => ({
        Produto: p.name,
        SKU: p.sku ?? '',
        Visualizações: p.views,
        Detalhes: p.details,
        Comparações: p.compares,
        'Crescimento %':
          p.classification === 'new' ? 'NOVO' : Math.round((p.trendingScore - 1) * 100),
        Classificação: p.classification,
      })),
    );
    toast({ title: 'Exportado', description: 'Arquivo CSV baixado.' });
  };

  const handleExportSearches = () => {
    if (!displaySearches?.length) {
      toast({
        title: 'Sem dados',
        description: 'Nada para exportar ainda.',
        variant: 'destructive',
      });
      return;
    }
    exportTrendsCsv(
      'tendencias_buscas',
      displaySearches.map((s) => ({
        Termo: s.term,
        Buscas: s.count,
        'Resultados médios': s.avgResults,
      })),
    );
    toast({ title: 'Exportado', description: 'Arquivo CSV baixado.' });
  };

  return (
    <>
      <PageSEO
        title="Tendências"
        description="Analise tendências de produtos e buscas."
        path="/tendencias"
        noIndex
      />
      <div className="mx-auto w-full max-w-[1920px] animate-fade-in space-y-3 px-3 py-3 pb-24 sm:space-y-4 sm:px-4 sm:py-4 md:pb-6 lg:px-6 xl:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1
                data-testid="page-title-tendencias"
                className="flex items-center gap-2 font-display text-2xl font-bold text-foreground lg:text-3xl"
              >
                <TrendingUp className="h-7 w-7 text-primary" />
                Análise de Tendências
              </h1>
              <RealtimeBadge />
              {demo && (
                <Badge
                  variant="outline"
                  className="gap-1 border-chart-4/40 bg-chart-4/10 text-chart-4"
                >
                  <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-chart-4" />
                  MODO DEMO — dados fictícios para avaliação
                </Badge>
              )}
            </div>
            <p className="mt-1 text-muted-foreground">
              {canManage
                ? 'Crescimento, conversão e demanda reprimida em tempo real'
                : 'Suas vendas, suas buscas, sua atividade'}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <SavedViewsManager />
            <Select value={dateRange} onValueChange={(v) => setDateRange(v as DateRange)}>
              <SelectTrigger className="w-[140px]">
                <Calendar className="mr-2 h-4 w-4" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7d">Últimos 7 dias</SelectItem>
                <SelectItem value="30d">Últimos 30 dias</SelectItem>
                <SelectItem value="90d">Últimos 90 dias</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" onClick={handleRefresh} aria-label="Atualizar">
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* IA — só para managers */}
        {canManage && <TrendsInsightsCard days={days} />}

        {/* KPIs */}
        <TrendsKpiCards current={kpiCurrent} previous={kpiPrevious} />

        {/* Funil + Demanda Reprimida */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <ConversionFunnel days={days} />
          <UnmetDemandCard days={days} />
        </div>

        {/* Buscas Quentes — interesse real do mercado */}
        <HotSearchesCard days={days} />

        {/* Forecast Chart com toggles vs anterior + previsão + anomalias */}
        <TrendsForecastChart
          dailyTrends={displayDaily?.current}
          previousTrends={displayDaily?.previous}
          isLoading={displayLoadingDaily}
          showForecast={showForecast}
          onToggleForecast={setShowForecast}
          showCompare={showCompare}
          onToggleCompare={setShowCompare}
        />

        {/* Heatmap + Top Categorias */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <TrendsHeatmap days={days} />
          <TopCategoriesCard days={days} />
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <TabsList>
              <TabsTrigger value="products" className="gap-2">
                <Package className="h-4 w-4" />
                Produtos em alta
              </TabsTrigger>
              <TabsTrigger value="searches" className="gap-2">
                <Search className="h-4 w-4" />
                Termos mais buscados
              </TabsTrigger>
            </TabsList>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={activeTab === 'products' ? handleExportProducts : handleExportSearches}
            >
              <Download className="h-3.5 w-3.5" />
              Exportar CSV
            </Button>
          </div>
          <TabsContent value="products" className="space-y-4">
            <ProductsTabContent topProducts={displayProducts} isLoading={displayLoadingProducts} />
          </TabsContent>
          <TabsContent value="searches" className="space-y-4">
            <SearchesTabContent topSearches={displaySearches} isLoading={displayLoadingSearches} />
          </TabsContent>
        </Tabs>
      </div>
      <TrendsTour />
    </>
  );
}
