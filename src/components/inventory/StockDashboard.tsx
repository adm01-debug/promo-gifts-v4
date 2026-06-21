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
import { buildStockKpiCards } from './stockKpiCards';
import { useRuptureAlerts } from '@/hooks/stock/useRuptureAlerts';
import { useRuptureHorizon } from '@/hooks/stock/useRuptureHorizon';
import {
  useRuptureRiskHydration,
  writeRuptureRiskActivePref,
} from '@/hooks/stock/useRuptureRiskHydration';


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

/** Lê do localStorage se o painel de risco estava aberto na última sessão. */
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

/**
 * Portal que projeta controles no slot à direita da toolbar de Estoque
 * (`#stock-toolbar-slot`). Se o slot da toolbar ainda não existir no DOM,
 * faz fallback para o `#stock-header-slot` (compat com layouts antigos).
 * Reavalia o alvo quando a árvore muda (toolbar é remontada em filtros).
 */
function HeaderSlotPortal({ children }: { children: ReactNode }) {
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  useEffect(() => {
    const resolve = () =>
      document.getElementById('stock-toolbar-slot') ??
      document.getElementById('stock-header-slot');
    setSlot(resolve());
    const mo = new MutationObserver(() => {
      const next = resolve();
      setSlot((prev) => (prev === next ? prev : next));
    });
    mo.observe(document.body, { childList: true, subtree: true });
    return () => mo.disconnect();
  }, []);
  if (!slot) return null;
  return createPortal(children, slot);
}

/** Dashboard completo de gestão de estoque: cards de KPI, tabela de variações e painel de risco. */
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

  // Risco de Ruptura: variações com cobertura projetada (EMA) ≤ 30 dias.
  // Quando o feature flag `useEmaRupture` estiver off, `alerts` vem vazio e
  // passamos `null` para o helper cair no fallback `variantsCritical`.
  const { alerts: ruptureAlerts, byVariantId: ruptureByVariantId } = useRuptureAlerts();

  // SSOT do "Risco de Ruptura": set de variantId únicos com cobertura ≤ 30d.
  // O MESMO set alimenta o número do card E o filtro da tabela, garantindo
  // invariante card-count === linhas-filtradas (deduplica fornecedores por
  // variante via `byVariantId`).
  const [ruptureHorizon] = useRuptureHorizon();

  // SSOT do "Risco de Ruptura": IDs únicos com cobertura ≤ horizonte ativo.
  // Parametrizado pelo `ruptureHorizon` (3/7/15/30) — mudar a janela na
  // toolbar recomputa o set, e o efeito de sincronização abaixo atualiza
  // `filters.ruptureRiskVariantIds` quando o filtro está ativo, fazendo
  // grid + badge + Switch reagirem em conjunto a uma única fonte da verdade.
  const ruptureRiskVariantIds = useMemo<ReadonlySet<string> | null>(() => {
    if (ruptureByVariantId.size === 0) return null;
    const ids = new Set<string>();
    for (const a of ruptureByVariantId.values()) {
      if (
        typeof a.cobertura_dias === 'number' &&
        Number.isFinite(a.cobertura_dias) &&
        a.cobertura_dias <= ruptureHorizon
      ) {
        ids.add(a.variant_id);
      }
    }
    return ids.size > 0 ? ids : null;
  }, [ruptureByVariantId, ruptureHorizon]);

  const ruptureRiskCount = ruptureRiskVariantIds ? ruptureRiskVariantIds.size : 0;
  const ruptureRisk30dCount = ruptureRiskCount > 0 ? ruptureRiskCount : null;
  const isRuptureRiskActive = Boolean(filters.ruptureRiskVariantIds);
  void ruptureAlerts; // mantido para upstream subscribers (cache warm)

  // Toggle on/off do filtro de Risco de Ruptura — espelha o Estoque Futuro.
  const toggleRuptureRisk = useCallback(
    (active: boolean) => {
      if (active && ruptureRiskVariantIds && ruptureRiskVariantIds.size > 0) {
        updateFilter('status', 'all');
        updateFilter('ruptureRiskVariantIds', ruptureRiskVariantIds);
      } else {
        updateFilter('ruptureRiskVariantIds', undefined);
      }
      writeRuptureRiskActivePref(active);
    },
    [ruptureRiskVariantIds, updateFilter],
  );

  // Re-hidratação após reload: aplica filtro quando alertas EMA chegam.
  useRuptureRiskHydration({
    variantIds: ruptureRiskVariantIds,
    isActive: isRuptureRiskActive,
    applyFilter: (ids) => {
      updateFilter('status', 'all');
      updateFilter('ruptureRiskVariantIds', ids);
    },
  });

  // Mudança de horizonte enquanto o filtro está ativo → re-sincroniza o
  // conjunto aplicado para que grid e badge atualizem juntos.
  useEffect(() => {
    if (!isRuptureRiskActive) return;
    if (!ruptureRiskVariantIds || ruptureRiskVariantIds.size === 0) {
      updateFilter('ruptureRiskVariantIds', undefined);
      return;
    }
    updateFilter('ruptureRiskVariantIds', ruptureRiskVariantIds);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ruptureHorizon, ruptureRiskVariantIds]);

  const activeFilterLabel = useMemo(() => {
    if (isRuptureRiskActive) return 'Risco de Ruptura (≤30d)';
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
      case 'overstocked':
        return 'Excesso de Estoque';
      default:
        return null;
    }
  }, [filters.status, isRuptureRiskActive]);

  const isFiltered = filters.status !== 'all' || isRuptureRiskActive;

  // Estoque futuro — janela de 30 dias (regra de negócio).
  // Contamos variações distintas com pelo menos uma reposição prevista nos
  // próximos 30 dias; o total de unidades vira contexto secundário (trend).
  const FUTURE_STOCK_WINDOW_DAYS = 30;
  const { futureStock30dVariantCount, futureStock30dUnits } = useMemo(() => {
    const now = Date.now();
    const horizon = now + FUTURE_STOCK_WINDOW_DAYS * 24 * 60 * 60 * 1000;
    const variantSet = new Set<string>();
    let units = 0;
    for (const f of futureStock) {
      const t = f.expectedDate ? Date.parse(f.expectedDate) : NaN;
      if (!Number.isFinite(t)) continue;
      if (t < now || t > horizon) continue;
      if (f.variantId) variantSet.add(f.variantId);
      units += f.expectedQuantity || 0;
    }
    return { futureStock30dVariantCount: variantSet.size, futureStock30dUnits: units };
  }, [futureStock]);


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


      {/* Título "Estoque" + Toolbar de filtros na mesma linha (padrão Super Filtro) */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:gap-4">
            <h1
              data-testid="page-title-estoque"
              className="shrink-0 font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl lg:pt-1"
            >
              Estoque
            </h1>
            <div className="min-w-0 flex-1">
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
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Header with Health Score */}

      <div className="flex flex-col items-start justify-between gap-2 sm:flex-row sm:items-center">
        <div className="flex flex-col gap-2" />

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
            data-testid="stock-last-refresh"
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
        {buildStockKpiCards(summary, ruptureRisk30dCount).map((card) => {
          const ICONS: Record<typeof card.slug, React.ReactNode> = {
            'total-de-variacoes': <Package className="h-6 w-6 text-primary" />,
            'em-estoque': <CheckCircle2 className="h-6 w-6 text-success" />,
            'risco-de-ruptura': <TrendingDown className="h-6 w-6 text-warning" />,
            'sem-estoque': <XCircle className="h-6 w-6 text-destructive" />,
          };

          // "Risco de Ruptura" usa o filtro dimensional ruptureRiskVariantIds
          // (set EMA ≤ 30d) ao invés de filters.status='critical' — assim a
          // tabela mostra EXATAMENTE as variações sinalizadas, sem mistura.
          const isRuptureCard = card.slug === 'risco-de-ruptura';
          const isActive = isRuptureCard
            ? isRuptureRiskActive
            : !isRuptureRiskActive &&
              (card.filter === 'all' ? filters.status === 'all' : filters.status === card.filter);
          return (
            <StatCard
              key={card.slug}
              title={card.title}
              value={card.value.toLocaleString('pt-BR')}
              icon={ICONS[card.slug]}
              variant={card.variant}
              subtitle={card.subtitle}
              tooltip={card.tooltip}
              isActive={isActive}
              onClick={() => {
                if (isRuptureCard) {
                  // toggle do filtro dimensional + zera status pra não competir
                  if (isRuptureRiskActive) {
                    updateFilter('ruptureRiskVariantIds', undefined);
                  } else if (ruptureRiskVariantIds && ruptureRiskVariantIds.size > 0) {
                    updateFilter('status', 'all');
                    updateFilter('ruptureRiskVariantIds', ruptureRiskVariantIds);
                  } else {
                    // Sem dados EMA (flag off ou sem alertas) → fallback antigo
                    updateFilter('status', filters.status === 'critical' ? 'all' : 'critical');
                  }
                  updateFilter('sortBy', 'name');
                  updateFilter('sortDirection', 'asc');
                  return;
                }
                if (!card.filter) return;
                const next =
                  card.filter === 'all'
                    ? 'all'
                    : filters.status === card.filter
                      ? 'all'
                      : card.filter;
                // Qualquer outro card sai do modo "risco de ruptura"
                if (isRuptureRiskActive) updateFilter('ruptureRiskVariantIds', undefined);
                updateFilter('status', next);
                updateFilter('sortBy', 'name');
                updateFilter('sortDirection', 'asc');
              }}
            />
          );
        })}


        <StatCard
          title="Estoque Futuro (30 dias)"
          // SSOT: valor primário = variações distintas com reposição prevista
          // nos próximos 30 dias. Total de unidades vira trend secundário.
          value={futureStock30dVariantCount}
          icon={<Truck className="h-6 w-6 text-primary" />}
          isActive={filters.status === 'incoming'}
          onClick={() => {
            updateFilter('status', filters.status === 'incoming' ? 'all' : 'incoming');
            updateFilter('sortBy', 'name');
            updateFilter('sortDirection', 'asc');
          }}
          tooltip="Variações com reposição prevista nos próximos 30 dias."
          trend={
            futureStock30dUnits > 0
              ? {
                  value: 1,
                  label: `${futureStock30dUnits.toLocaleString('pt-BR')} un. previstas`,
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
            ruptureFilterActive={isRuptureRiskActive}
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
