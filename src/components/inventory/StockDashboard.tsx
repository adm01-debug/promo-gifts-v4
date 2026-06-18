import { useState, useMemo, useEffect, useRef, useCallback, Suspense, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { lazyWithRetry } from '@/lib/lazyWithRetry';
import { useToast } from '@/hooks/ui';
import {
  Package,
  TrendingDown,
  RefreshCw,
  Truck,
  CheckCircle2,
  XCircle,
  Palette,
  Loader2,
  AlertCircle,
  X,
  ChevronDown,
  ChevronRight,
  Clock,
  BarChart3,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useVariantStock } from '@/hooks/products';
import { VariantStockTable } from './VariantStockTable';
// #15 — Lazy: painéis pesados (recebem array completo de 22k+ variações).
const SupplierRiskPanel = lazyWithRetry(() =>
  import('./SupplierRiskPanel').then((m) => ({ default: m.SupplierRiskPanel })),
);
import { StatCard } from './StockStatCard';
import { AlertCard } from './StockAlertCard';
import { OutOfStockDialog, LowStockDialog } from './StockAlertDialogs';
import { StockFilterToolbar } from './StockFilterToolbar';
import { FutureStockDialog } from './FutureStockDialog';
const StockHealthBreakdownDrawer = lazyWithRetry(() =>
  import('./StockHealthBreakdownDrawer').then((m) => ({ default: m.StockHealthBreakdownDrawer })),
);
import { StockEmptyFiltersHint } from './StockEmptyFiltersHint';

const RISK_PANEL_STORAGE_KEY = 'stock-dashboard:risk-panel-open:v1';

function readRiskPanelPref(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    const raw = window.localStorage.getItem(RISK_PANEL_STORAGE_KEY);
    if (raw === null) return true;
    return raw === '1';
  } catch {
    return true;
  }
}

/** Formata tempo relativo em PT-BR: "agora", "há 2 min", "há 1 h", "há 2 dias". */
function formatRelativeTime(date: Date, now: number): string {
  const diffSec = Math.max(0, Math.floor((now - date.getTime()) / 1000));
  if (diffSec < 30) return 'agora';
  if (diffSec < 60) return `há ${diffSec} s`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `há ${diffMin} min`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `há ${diffH} h`;
  const diffD = Math.floor(diffH / 24);
  return `há ${diffD} dia${diffD > 1 ? 's' : ''}`;
}

function HeaderSlotPortal({ children }: { children: ReactNode }) {
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  useEffect(() => {
    setSlot(document.getElementById('stock-header-slot'));
  }, []);
  if (!slot) return null;
  return createPortal(children, slot);
}

export function StockDashboard() {
  const [outOfStockDialogOpen, setOutOfStockDialogOpen] = useState(false);
  const [lowStockDialogOpen, setLowStockDialogOpen] = useState(false);
  const [futureStockDialogOpen, setFutureStockDialogOpen] = useState(false);
  const [healthDrawerOpen, setHealthDrawerOpen] = useState(false);
  // #14 — persiste preferência do painel de risco entre sessões.
  const [riskPanelOpen, setRiskPanelOpen] = useState<boolean>(readRiskPanelPref);
  const { toast } = useToast();
  const prevCriticalCountRef = useRef<number | null>(null);
  // #11/#19 — lastRefresh como estado força re-render quando o tempo relativo
  // muda; tick periódico atualiza "há X min" sem precisar de novo fetch.
  const [lastRefresh, setLastRefresh] = useState<Date>(() => new Date());
  const [nowTick, setNowTick] = useState<number>(() => Date.now());
  const {
    isLoading,
    isFetching,
    loadingProgress,
    productStocks,
    allProductStocks,
    summary,
    alerts,
    criticalAlerts,
    filters,
    futureStock,
    allColors,
    availableCategories,
    availableSuppliers,
    availableColorGroups,
    error,
    fetchStockData,
    updateFilter,
    resetFilters,
    dismissAlert,
    dismissAlertsBySeverity,
  } = useVariantStock();

  // #19 — quando o fetch termina (transição isFetching true→false), marcamos
  // o instante da última atualização. Mantido em useEffect porque o
  // invalidateQueries é assíncrono e o estado real só estabiliza aqui.
  useEffect(() => {
    if (!isFetching) setLastRefresh(new Date());
  }, [isFetching]);

  // #11 — re-render a cada 30s para o label "há X min" ficar fresco.
  useEffect(() => {
    const id = window.setInterval(() => setNowTick(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  // #14 — persiste preferência sem bloquear render.
  useEffect(() => {
    try {
      window.localStorage.setItem(RISK_PANEL_STORAGE_KEY, riskPanelOpen ? '1' : '0');
    } catch {
      /* quota/private mode — silencioso */
    }
  }, [riskPanelOpen]);

  const handleRefresh = useCallback(() => {
    if (!isFetching && !isLoading) fetchStockData();
  }, [isFetching, isLoading, fetchStockData]);

  // #12 — atalho Ctrl/⌘+Shift+S (Sync). Ctrl+Shift+R colidia com o
  // hard-reload reservado do Chrome/Firefox.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'S' || e.key === 's')) {
        e.preventDefault();
        handleRefresh();
        toast({ title: '🔄 Atualizando Estoque...', description: 'Atalho: Ctrl+Shift+S' });
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleRefresh, toast]);

  // Toast when new critical alerts appear after refresh
  useEffect(() => {
    if (isLoading) return;
    const count = criticalAlerts.length;
    if (prevCriticalCountRef.current !== null && count > prevCriticalCountRef.current) {
      const newCount = count - prevCriticalCountRef.current;
      toast({
        title: `⚠️ ${newCount} novo${newCount > 1 ? 's' : ''} alerta${newCount > 1 ? 's' : ''} crítico${newCount > 1 ? 's' : ''}`,
        description: 'Produtos sem estoque ou em nível crítico detectados.',
        variant: 'destructive',
      });
    }
    prevCriticalCountRef.current = count;
  }, [criticalAlerts.length, isLoading, toast]);

  const warningAlerts = useMemo(() => alerts.filter((a) => a.severity === 'warning'), [alerts]);
  const infoAlerts = useMemo(() => alerts.filter((a) => a.severity === 'info'), [alerts]);

  const activeFilterLabel = useMemo(() => {
    switch (filters.status) {
      case 'in_stock':
        return 'Em Estoque';
      case 'low_stock':
        return 'Estoque Baixo';
      case 'critical':
        return 'Estoque Crítico';
      case 'out_of_stock':
        return 'Sem Estoque';
      case 'incoming':
        return 'Estoque Futuro';
      default:
        return null;
    }
  }, [filters.status]);

  const isFiltered = filters.status !== 'all';

  // Future stock total
  const futureStockTotal = useMemo(
    () => futureStock.reduce((sum, f) => sum + (f.expectedQuantity || 0), 0),
    [futureStock],
  );

  if (isLoading) {
    const pct = loadingProgress
      ? Math.round((loadingProgress.current / loadingProgress.total) * 100)
      : 0;
    return (
      <div className="space-y-5" aria-live="polite" aria-busy="true">
        <div className="flex items-center gap-3 rounded-xl border border-border/40 bg-card px-4 py-3">
          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10">
            <Package className="h-4 w-4 animate-pulse text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-3">
              <p className="truncate text-sm font-medium">Sincronizando estoque</p>
              {loadingProgress && (
                <p className="flex-shrink-0 text-xs font-medium tabular-nums text-primary">
                  {pct}%
                </p>
              )}
            </div>
            <div className="mt-1.5 flex items-center gap-2">
              <div className="h-1 flex-1 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-primary to-primary/60 transition-all duration-500 ease-out"
                  style={{ width: `${pct || 8}%` }}
                />
              </div>
              <p className="max-w-[40%] truncate text-xs text-muted-foreground">
                {loadingProgress?.step || 'Conectando ao fornecedor...'}
              </p>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-5">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-12 rounded-xl" />
        <Skeleton className="h-96 rounded-xl" />
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-destructive/20 bg-destructive/5">
        <CardContent className="flex flex-col items-center justify-center space-y-4 p-12 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
            <AlertCircle className="h-8 w-8 text-destructive" />
          </div>
          <div className="space-y-2">
            <h3 className="text-xl font-bold text-destructive">Falha ao carregar estoque</h3>
            <p className="max-w-md text-muted-foreground">
              {error instanceof Error
                ? error.message
                : 'Não foi possível conectar ao banco de dados externo.'}
            </p>
          </div>
          <Button onClick={fetchStockData} variant="outline" className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Tentar novamente
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      {/* Alert Dialogs */}
      <OutOfStockDialog
        open={outOfStockDialogOpen}
        onOpenChange={setOutOfStockDialogOpen}
        alerts={criticalAlerts}
        onDismiss={dismissAlert}
        onDismissAll={() => dismissAlertsBySeverity('error')}
      />
      <LowStockDialog
        open={lowStockDialogOpen}
        onOpenChange={setLowStockDialogOpen}
        alerts={warningAlerts}
        onDismiss={dismissAlert}
        onDismissAll={() => dismissAlertsBySeverity('warning')}
      />
      <FutureStockDialog
        open={futureStockDialogOpen}
        onOpenChange={setFutureStockDialogOpen}
        entries={futureStock}
      />
      {healthDrawerOpen && (
        <Suspense fallback={null}>
          <StockHealthBreakdownDrawer
            open={healthDrawerOpen}
            onOpenChange={setHealthDrawerOpen}
            products={allProductStocks ?? productStocks}
          />
        </Suspense>
      )}

      {/* Advanced Filters (topo, logo após o título "Estoque") */}
      <Card>
        <CardContent className="p-4">
          <StockFilterToolbar
            filters={filters}
            onUpdateFilter={updateFilter}
            onResetFilters={resetFilters}
            categories={availableCategories}
            suppliers={availableSuppliers}
            colors={allColors}
            colorGroups={availableColorGroups}
            totalProducts={allProductStocks.length}
            filteredCount={productStocks.length}
          />
        </CardContent>
      </Card>

      {/* Header with Health Score */}

      <div className="flex flex-col items-start justify-between gap-2 sm:flex-row sm:items-center">
        <div className="flex flex-col gap-2">
          {warningAlerts.length > 0 && (
            <Badge
              variant="secondary"
              data-testid="warning-alerts-badge"
              className="cursor-pointer gap-1 text-xs"
              onClick={() => setLowStockDialogOpen(true)}
            >
              <AlertCircle className="h-3 w-3" />
              {warningAlerts.length} aviso{warningAlerts.length > 1 ? 's' : ''} de esgotamento
            </Badge>
          )}
        </div>

        <HeaderSlotPortal>
          <div
            className="flex items-center gap-2 text-xs text-muted-foreground"
            title={lastRefresh.toLocaleString('pt-BR', {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            })}
            aria-live="polite"
          >
            <Clock className="h-3.5 w-3.5" />
            <span>Atualizado {formatRelativeTime(lastRefresh, nowTick)}</span>
            <span className="text-muted-foreground/60">
              ·{' '}
              {lastRefresh.toLocaleTimeString('pt-BR', {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
            {isFetching && <Loader2 className="h-3 w-3 animate-spin text-primary" />}
          </div>
        </HeaderSlotPortal>
      </div>

      {/* Summary Cards — clickable filters */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-5">
        <StatCard
          title="Total de Produtos"
          value={summary.totalProducts.toLocaleString('pt-BR')}
          icon={<Package className="h-6 w-6 text-primary" />}
          isActive={filters.status === 'all'}
          onClick={() => updateFilter('status', 'all')}
          clickHint="Mostrar todos os produtos"
          trend={{
            value: summary.totalVariants,
            label: `${summary.totalVariants.toLocaleString('pt-BR')} variações`,
          }}
        />
        <StatCard
          title="Em Estoque"
          value={summary.productsInStock.toLocaleString('pt-BR')}
          icon={<CheckCircle2 className="h-6 w-6 text-success" />}
          variant="success"
          isActive={filters.status === 'in_stock'}
          onClick={() => updateFilter('status', filters.status === 'in_stock' ? 'all' : 'in_stock')}
          clickHint="Filtrar produtos em estoque"
          trend={
            summary.totalProducts > 0
              ? {
                  value: 1,
                  label: `${Math.round((summary.productsInStock / summary.totalProducts) * 100)}% do total`,
                }
              : undefined
          }
        />
        <StatCard
          title="Crítico"
          // SSOT KPI ↔ filtro: o valor bate 1:1 com `filters.status ===
          // 'critical'` (o que o clique aplica). "Crítico" = produtos
          // parcialmente sem estoque (overallStatus==='critical'). A régua
          // por `min` (low_stock) foi descontinuada e o KPI ficava sempre 0;
          // este card agora expõe um número real e clicável.
          // Testado em VariantStockTable.kpi-consistency.test.tsx.
          value={summary.productsCritical.toLocaleString('pt-BR')}
          icon={<TrendingDown className="h-6 w-6 text-warning" />}
          variant="warning"
          isActive={filters.status === 'critical'}
          onClick={() => {
            updateFilter('status', filters.status === 'critical' ? 'all' : 'critical');
          }}
          clickHint="Filtrar produtos em estado crítico (parcialmente sem estoque)"
          trend={
            summary.totalProducts > 0 && summary.productsCritical > 0
              ? {
                  value: -1,
                  label: `${Math.round((summary.productsCritical / summary.totalProducts) * 100)}% do catálogo`,
                }
              : undefined
          }
        />

        <StatCard
          title="Sem Estoque"
          value={summary.productsOutOfStock.toLocaleString('pt-BR')}
          icon={<XCircle className="h-6 w-6 text-destructive" />}
          variant="error"
          isActive={filters.status === 'out_of_stock'}
          onClick={() => {
            updateFilter('status', filters.status === 'out_of_stock' ? 'all' : 'out_of_stock');
            if (criticalAlerts.length > 0) setOutOfStockDialogOpen(true);
          }}
          clickHint="Filtrar produtos sem estoque"
          trend={
            summary.productsOutOfStock > 0
              ? {
                  value: -1,
                  label: `${summary.productsOutOfStock.toLocaleString('pt-BR')} produtos sem estoque`,
                }
              : undefined
          }
        />
        <StatCard
          title="Estoque Futuro"
          // SSOT: o valor primário é a contagem de reposições previstas (entidades
          // contáveis). O total de unidades vinha da soma de next_quantity_{1..3}
          // por variant_supplier_source — número correto pela schema, mas
          // visualmente alarmante (dezenas de milhões) e incompatível com a
          // narrativa "reposições". Unidades viram trend secundário.
          value={futureStock.length}
          icon={<Truck className="h-6 w-6 text-primary" />}
          isActive={filters.status === 'incoming'}
          onClick={() => {
            updateFilter('status', filters.status === 'incoming' ? 'all' : 'incoming');
            if (futureStock.length > 0) setFutureStockDialogOpen(true);
          }}
          clickHint="Ver previsões de reposição"
          trend={
            futureStockTotal > 0
              ? {
                  value: 1,
                  label: `${futureStockTotal.toLocaleString('pt-BR')} un. previstas`,
                }
              : undefined
          }
        />
      </div>

      {/* Active Filter Badge */}
      {isFiltered && (
        <div className="flex animate-fade-in items-center gap-2">
          <span className="text-sm text-muted-foreground">Filtro ativo:</span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
            {activeFilterLabel}
            <button
              type="button"
              onClick={() => updateFilter('status', 'all')}
              className="ml-0.5 rounded-full p-0.5 transition-colors hover:bg-primary/20"
              aria-label="Remover filtro"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </span>
          <span className="text-xs text-muted-foreground">
            ({productStocks.length} de {allProductStocks.length} produtos)
          </span>
        </div>
      )}

      {/* Stock Table */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <Palette className="h-5 w-5" />
                Estoque por Cor/Variação
                <Badge variant="secondary" className="ml-1 text-xs font-normal">
                  {isFiltered
                    ? `${productStocks.length} de ${allProductStocks.length}`
                    : `${productStocks.length} produtos`}
                </Badge>
              </CardTitle>
              <CardDescription className="mt-1">
                Visualização detalhada do estoque segmentado por cores e variações
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {productStocks.length === 0 && allProductStocks.length > 0 && (
            <div className="mb-4">
              <StockEmptyFiltersHint
                filters={filters}
                totalProducts={allProductStocks.length}
                onResetFilters={resetFilters}
                onUpdateFilter={updateFilter}
              />
            </div>
          )}
          {/* Scroll é gerenciado internamente pela tabela para preservar o sticky
              do toolbar (busca + paginação) e do <thead>. */}
          <VariantStockTable
            products={productStocks}
            isLoading={isFetching}
            targetQuantity={filters.minQuantityNeeded}
          />
        </CardContent>
      </Card>

      {/* Collapsible Risk Panel */}
      <div className="space-y-0">
        <button
          type="button"
          onClick={() => setRiskPanelOpen((prev) => !prev)}
          className="mb-2 flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          {riskPanelOpen ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
          <BarChart3 className="h-4 w-4" />
          Painel de Risco do Fornecedor
        </button>
        {riskPanelOpen && (
          <Suspense fallback={<Skeleton className="h-48 w-full" />}>
            <SupplierRiskPanel products={allProductStocks} />
          </Suspense>
        )}
      </div>

      {/* Info Alerts */}
      {infoAlerts.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-lg">
                <AlertCircle className="h-5 w-5" />
                Outros Alertas
                <Badge variant="secondary" className="ml-1 text-xs font-normal">
                  {infoAlerts.length > 10
                    ? `exibindo 10 de ${infoAlerts.length.toLocaleString('pt-BR')}`
                    : `${infoAlerts.length}`}
                </Badge>
              </CardTitle>

              <Button
                variant="ghost"
                size="sm"
                className="gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                onClick={() => dismissAlertsBySeverity('info')}
              >
                <XCircle className="h-3.5 w-3.5" />
                Limpar Todos
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <ScrollArea className="max-h-60">
              <div className="space-y-2">
                {infoAlerts.slice(0, 10).map((alert) => (
                  <AlertCard
                    key={alert.id}
                    alert={alert}
                    onDismiss={() => dismissAlert(alert.id)}
                  />
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default StockDashboard;
