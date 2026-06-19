import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
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
  Shield,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { useVariantStock } from '@/hooks/products';
import { VariantStockTable } from './VariantStockTable';
import { SupplierRiskPanel } from './SupplierRiskPanel';
import { StatCard } from './StockStatCard';
import { AlertCard } from './StockAlertCard';
import { OutOfStockDialog, LowStockDialog } from './StockAlertDialogs';
import { StockFilterToolbar } from './StockFilterToolbar';
import { FutureStockDialog } from './FutureStockDialog';
import { HealthScoreInfoDialog } from './HealthScoreInfoDialog';
import { StockHealthBreakdownDrawer } from './StockHealthBreakdownDrawer';
import { calcHealthScore } from '@/lib/inventory/health-score';

export function StockDashboard() {
  const [outOfStockDialogOpen, setOutOfStockDialogOpen] = useState(false);
  const [lowStockDialogOpen, setLowStockDialogOpen] = useState(false);
  const [futureStockDialogOpen, setFutureStockDialogOpen] = useState(false);
  const [healthDrawerOpen, setHealthDrawerOpen] = useState(false);
  const [riskPanelOpen, setRiskPanelOpen] = useState(true);
  const { toast } = useToast();
  const prevCriticalCountRef = useRef<number | null>(null);
  const lastRefreshRef = useRef<Date>(new Date());
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

  // Track last refresh time
  useEffect(() => {
    if (!isFetching) lastRefreshRef.current = new Date();
  }, [isFetching]);

  // Keyboard shortcut: Ctrl+Shift+R to refresh stock data
  const handleRefresh = useCallback(() => {
    if (!isFetching && !isLoading) fetchStockData();
  }, [isFetching, isLoading, fetchStockData]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'R') {
        e.preventDefault();
        handleRefresh();
        toast({ title: '🔄 Atualizando Estoque...', description: 'Atalho: Ctrl+Shift+R' });
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
      case 'all':
      case 'overstocked':
      default:
        return null;
    }
  }, [filters.status]);

  const isFiltered = filters.status !== 'all';

  // Health score calculation (SSOT em src/lib/inventory/health-score.ts)
  const healthScore = useMemo(
    () =>
      calcHealthScore({
        productsInStock: summary.productsInStock,
        totalProducts: summary.totalProducts,
      }),
    [summary.productsInStock, summary.totalProducts],
  );

  // Future stock total
  const futureStockTotal = useMemo(
    () => futureStock.reduce((sum, f) => sum + (f.expectedQuantity ?? 0), 0),
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
      <StockHealthBreakdownDrawer
        open={healthDrawerOpen}
        onOpenChange={setHealthDrawerOpen}
        products={allProductStocks ?? productStocks}
      />

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
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold">Visão Geral</h2>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    data-testid="health-score-badge"
                    aria-label={`Saúde do estoque: ${healthScore}%. Clique para detalhar.`}
                    onClick={() => setHealthDrawerOpen(true)}
                    className={cn(
                      'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      healthScore >= 80 && 'border-success/20 bg-success/10 text-success',
                      healthScore >= 50 &&
                        healthScore < 80 &&
                        'border-warning/20 bg-warning/10 text-warning',
                      healthScore < 50 &&
                        'border-destructive/20 bg-destructive/10 text-destructive',
                    )}
                  >
                    <Shield className="h-3 w-3" />
                    Saúde: {healthScore}%
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="max-w-[220px] text-xs">
                    {summary.productsInStock} de {summary.totalProducts} produtos com estoque
                    adequado. Clique para ver a lista por faixa.
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            {criticalAlerts.length > 0 && (
              <Badge
                variant="destructive"
                data-testid="critical-alerts-badge"
                className="animate-pulse cursor-pointer gap-1 text-xs"
                onClick={() => setOutOfStockDialogOpen(true)}
              >
                <AlertCircle className="h-3 w-3" />
                {criticalAlerts.length} alertas
              </Badge>
            )}
            <HealthScoreInfoDialog
              productsInStock={summary.productsInStock}
              totalProducts={summary.totalProducts}
              criticalAlerts={criticalAlerts.length}
            />
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Clock className="h-3.5 w-3.5" />
          {lastRefreshRef.current.toLocaleString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
          })}
          {isFetching && <Loader2 className="h-3 w-3 animate-spin text-primary" />}
        </div>
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
          title="Estoque Baixo"
          value={(summary.productsLowStock + summary.productsCritical).toLocaleString('pt-BR')}
          icon={<TrendingDown className="h-6 w-6 text-warning" />}
          variant="warning"
          isActive={filters.status === 'low_stock' || filters.status === 'critical'}
          onClick={() => {
            updateFilter('status', filters.status === 'low_stock' ? 'all' : 'low_stock');
            if (warningAlerts.length > 0) setLowStockDialogOpen(true);
          }}
          clickHint="Filtrar produtos com estoque baixo"
          trend={
            summary.productsCritical > 0
              ? { value: -1, label: `${summary.productsCritical} críticos` }
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
            summary.criticalAlerts > 0
              ? { value: -1, label: `${summary.criticalAlerts} alertas ativos` }
              : undefined
          }
        />
        <StatCard
          title="Estoque Futuro"
          value={futureStockTotal}
          icon={<Truck className="h-6 w-6 text-primary" />}
          isActive={filters.status === 'incoming'}
          onClick={() => {
            updateFilter('status', filters.status === 'incoming' ? 'all' : 'incoming');
            if (futureStock.length > 0) setFutureStockDialogOpen(true);
          }}
          clickHint="Ver previsões de reposição"
          trend={
            futureStock.length > 0
              ? { value: 1, label: `${futureStock.length} reposições previstas` }
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
        {riskPanelOpen && <SupplierRiskPanel products={allProductStocks} />}
      </div>

      {/* Info Alerts */}
      {infoAlerts.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-lg">
                <AlertCircle className="h-5 w-5" />
                Outros Alertas ({infoAlerts.length})
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
