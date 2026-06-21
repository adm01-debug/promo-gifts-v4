import { useState, useMemo, useEffect, useRef, useDeferredValue } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Package, Truck, ShoppingCart, Search, X, Copy, Building2, Tag } from 'lucide-react';
import { getSupplierColors, getSupplierBadgeClasses } from '@/lib/supplier-colors';
import { useStockSelection, buildQuoteParam } from './useStockSelection';
import { StockBulkActionBar } from './StockBulkActionBar';
import { BulkAddToCollectionModal, type BulkCollectionRow } from './BulkAddToCollectionModal';
import { useSelectionShortcut } from './useSelectionShortcut';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { type ProductStockSummary, type VariantStock, type StockStatus } from '@/types/stock';
import { VariantThumb, RichColorSwatch, StockStatusChip } from './VariantStockVisuals';
import { QuickViewThumb } from '@/components/products/QuickViewThumb';
import {
  computeRuptureRisk,
  DEFAULT_RUPTURE_HORIZON,
  RUPTURE_HORIZON_OPTIONS,
  type RuptureHorizonDays,
} from '@/lib/inventory/rupture-risk';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useRuptureAlerts, type RuptureAlertRow } from '@/hooks/stock/useRuptureAlerts';
import { RuptureLevelBadge } from './risk/RuptureLevelBadge';
import { isFeatureEnabled } from '@/lib/feature-flags';

/**
 * Modo de negócio: SEMPRE variação-first (1 linha = 1 SKU).
 * Não existe mais "agrupar por produto pai" — ver memo `flat-only` no inventário.
 */
const SEARCH_STORAGE_KEY = 'stock.inlineSearch';
const STATUS_FILTER_STORAGE_KEY = 'stock.statusFilter';
const RUPTURE_HORIZON_STORAGE_KEY = 'stock.ruptureHorizon';

/**
 * Chaves legadas (modo agrupar + paginação) a serem purgadas para evitar
 * estado obsoleto após a mudança de modelo de negócio (variação-first + scroll virtual).
 */
const LEGACY_STORAGE_KEYS = [
  'stock.groupBy',
  'stock.viewMode',
  'stock.groupingMode',
  'stock.currentPage', // paginação substituída por scroll virtual
] as const;

/** Filtro rápido por status — 'all' = sem filtro. */
type StatusFilter = StockStatus | 'all';
const STATUS_FILTER_VALUES: StatusFilter[] = [
  'all',
  'in_stock',
  'incoming',
  'low_stock',
  'critical',
  'out_of_stock',
];
// SSOT — labels alinhados aos cards do StockDashboard (KPI ↔ chip).
// NÃO ALTERAR sem atualizar o teste de regressão
// `VariantStockTable.kpi-consistency.test.tsx`.
const STATUS_FILTER_LABEL: Record<StatusFilter, string> = {
  all: 'Todos',
  in_stock: 'Em Estoque',
  low_stock: 'Estoque Baixo',
  critical: 'Crítico',
  out_of_stock: 'Sem Estoque',
  overstocked: 'Em Estoque',
  incoming: 'Chegando',
};

function readStored(key: string, fallback = ''): string {
  if (typeof window === 'undefined') return fallback;
  try {
    return window.sessionStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}
function writeStored(key: string, value: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(key, value);
  } catch {
    /* modo privado — ignora */
  }
}

// ============================================
// LINHA DE VARIANTE (COR/TAMANHO) — modo agrupado
// ============================================

/**
 * Helper para célula vazia limpa (sem `—` repetido em todas as colunas).
 * `aria-hidden` no span vazio mantém o tabular layout sem ruído de leitor de tela.
 */
function EmptyCell() {
  return (
    <span className="text-muted-foreground/30" aria-hidden="true">
      ·
    </span>
  );
}

// ============================================
// LINHA FLAT (modo "Listar variações" — 1 SKU = 1 linha)
// ============================================

function FlatVariantRow({
  variant,
  product,
  effectiveStatus,
  projection,
  selectionEnabled,
  isSelected,
  onToggleSelect,
  emaAlert,
  emaEnabled,
}: {
  variant: VariantStock;
  product: ProductStockSummary;
  effectiveStatus: StockStatus;
  projection?: {
    targetQty: number;
    avgDailyDepletion: number;
    horizonDays: number;
    projectedStock: number;
    daysToTarget: number | null;
  };
  selectionEnabled?: boolean;
  isSelected?: boolean;
  onToggleSelect?: () => void;
  emaAlert?: RuptureAlertRow;
  emaEnabled?: boolean;
}) {
  const navigate = useNavigate();
  const isOut = variant.status === 'out_of_stock' || variant.currentStock <= 0;

  // Ações single-row do QuickView no /estoque (paridade com o catálogo).
  const [collectionOpen, setCollectionOpen] = useState(false);
  const collectionRows = useMemo<BulkCollectionRow[]>(
    () => [
      {
        productId: product.productId,
        productName: product.productName,
        variant: {
          color_name: variant.colorName,
          color_hex: variant.colorHex,
          size_code: variant.sizeCode,
          variant_id: variant.variantId,
          thumbnail: variant.imageUrl ?? product.productImageUrl,
        },
      },
    ],
    [
      product.productId,
      product.productName,
      product.productImageUrl,
      variant.colorName,
      variant.colorHex,
      variant.sizeCode,
      variant.variantId,
      variant.imageUrl,
    ],
  );
  const handleAddToQuote = () => {
    try {
      navigate(`/orcamentos/novo?${buildQuoteParam({ product, variant })}`);
    } catch {
      /* noop — toast já é tratado no fluxo de cotação */
    }
  };
  return (
    <>
      <TableRow
        className={cn('group hover:bg-muted/40', isSelected && 'bg-primary/5')}
        data-testid="stock-row"
        data-selected={isSelected ? 'true' : 'false'}
      >
        {selectionEnabled && (
          <TableCell className="w-[40px] pr-0">
            <input
              type="checkbox"
              className="h-4 w-4 cursor-pointer accent-primary"
              checked={!!isSelected}
              onChange={onToggleSelect}
              aria-label={`Selecionar ${product.productName} ${variant.colorName ?? ''}`}
              data-testid="stock-row-select"
            />
          </TableCell>
        )}
        <TableCell>
          <div className="flex items-center gap-3">
            <QuickViewThumb
              productId={product.productId}
              productName={product.productName}
              testId="stock-table-row-thumb"
              onAddToQuote={handleAddToQuote}
              onAddToCollection={() => setCollectionOpen(true)}
            >
              <VariantThumb
                imageUrl={variant.imageUrl || product.productImageUrl}
                productName={product.productName}
                colorName={variant.colorName}
                colorHex={variant.colorHex}
                size="md"
              />
            </QuickViewThumb>
            <div className="min-w-0">
              <button
                type="button"
                onClick={() => navigate(`/produto/${product.productId}`)}
                className="block max-w-[260px] truncate text-left font-medium text-foreground hover:text-primary"
              >
                {product.productName}
              </button>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                <span className="font-mono">{variant.variantSku}</span>
                <span aria-hidden>·</span>
                <RichColorSwatch
                  hex={variant.colorHex}
                  name={variant.colorName}
                  isOutOfStock={isOut}
                />
              </div>
            </div>
          </div>
        </TableCell>
        <TableCell className="hidden md:table-cell">
          {product.supplierName || product.categoryName ? (
            <div className="flex flex-col items-start gap-1">
              {product.supplierName ? (
                <span
                  title={`Fornecedor: ${product.supplierName}`}
                  className={cn(
                    'inline-flex max-w-[180px] items-center gap-1 whitespace-nowrap rounded-md border px-2 py-0.5 text-[10px] font-semibold',
                    getSupplierBadgeClasses(product.supplierName),
                  )}
                >
                  <Building2
                    className={cn('h-3 w-3 shrink-0', getSupplierColors(product.supplierName).text)}
                    aria-hidden="true"
                  />
                  <span className="truncate">{product.supplierName}</span>
                </span>
              ) : null}
              {product.categoryName ? (
                <span
                  title={`Categoria: ${product.categoryName}`}
                  className="inline-flex max-w-[180px] items-center gap-1 whitespace-nowrap rounded-md border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary"
                >
                  <Tag className="h-3 w-3 shrink-0" aria-hidden="true" />
                  <span className="truncate">{product.categoryName}</span>
                </span>
              ) : null}
            </div>
          ) : (
            <EmptyCell />
          )}
        </TableCell>
        <TableCell>
          <div className="flex items-baseline gap-1.5">
            <span
              className={cn(
                'text-base font-semibold tabular-nums',
                isOut ? 'text-destructive' : 'text-foreground',
              )}
            >
              {variant.currentStock.toLocaleString('pt-BR')}
            </span>
            <span className="text-[10px] text-muted-foreground">un</span>
          </div>
        </TableCell>
        <TableCell className="hidden md:table-cell">
          {variant.inTransitStock > 0 ? (
            <span className="flex items-center gap-1 text-sm tabular-nums text-primary/80">
              <Truck className="h-3 w-3" />+{variant.inTransitStock}
            </span>
          ) : (
            <EmptyCell />
          )}
        </TableCell>
        <TableCell>
          <StockStatusChip
            status={effectiveStatus}
            current={variant.currentStock}
            min={variant.minStock}
            reserved={variant.reservedStock}
            inTransit={variant.inTransitStock}
            projection={projection}
          />
        </TableCell>
        {emaEnabled && (
          <TableCell
            className="hidden lg:table-cell"
            data-testid="stock-row-ema-coverage"
          >
            {emaAlert ? (
              <div className="flex flex-col items-start gap-0.5">
                <RuptureLevelBadge level={emaAlert.nivel_alerta} className="text-[10px]" />
                <span className="text-[10px] text-muted-foreground tabular-nums">
                  {emaAlert.cobertura_dias !== null && Number.isFinite(emaAlert.cobertura_dias)
                    ? `${emaAlert.cobertura_dias!.toFixed(1)} d`
                    : '—'}
                  {emaAlert.lead_time_efetivo !== null
                    ? ` · LT ${emaAlert.lead_time_efetivo}d`
                    : ''}
                </span>
              </div>
            ) : (
              <EmptyCell />
            )}
          </TableCell>
        )}
        <TableCell className="hidden sm:table-cell">
          <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => {
                void navigator.clipboard?.writeText(variant.variantSku).catch(() => {});
              }}
              aria-label={`Copiar SKU ${variant.variantSku}`}
            >
              <Copy className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() =>
                navigate(
                  `/orcamentos/novo?productId=${product.productId}&variantId=${variant.variantId}&productName=${encodeURIComponent(product.productName)}`,
                )
              }
              aria-label={`Criar orçamento para ${product.productName} ${variant.colorName ?? ''}`}
            >
              <ShoppingCart className="h-3 w-3" />
            </Button>
          </div>
        </TableCell>
      </TableRow>
      {collectionOpen && (
        <BulkAddToCollectionModal
          open={collectionOpen}
          onOpenChange={setCollectionOpen}
          rows={collectionRows}
          onApplied={() => setCollectionOpen(false)}
        />
      )}
    </>
  );
}

// ============================================
// TABELA PRINCIPAL
// ============================================

interface VariantStockTableProps {
  products: ProductStockSummary[];
  className?: string;
  isLoading?: boolean;
  /**
   * Quantidade-alvo (em unidades) que o vendedor precisa atender — alimenta a
   * fórmula preditiva de "Risco de Ruptura". Quando ausente/0, o status volta
   * ao comportamento estático (≤ mínimo do produto).
   */
  targetQuantity?: number;
}

/**
 * Wrapper público: decide se monta o hook `useRuptureAlerts` (que exige
 * QueryClientProvider) somente quando a flag `useEmaRupture` está ativa.
 * Mantém compat com testes legados que renderizam sem provider.
 */
export function VariantStockTable(props: VariantStockTableProps) {
  const emaEnabled = isFeatureEnabled('useEmaRupture');
  if (emaEnabled) {
    return <VariantStockTableWithEma {...props} />;
  }
  return <VariantStockTableInner {...props} emaEnabled={false} />;
}

function VariantStockTableWithEma(props: VariantStockTableProps) {
  const { byVariantId } = useRuptureAlerts();
  return <VariantStockTableInner {...props} emaEnabled emaByVariantId={byVariantId} />;
}

interface VariantStockTableInnerProps extends VariantStockTableProps {
  emaEnabled: boolean;
  emaByVariantId?: Map<string, RuptureAlertRow>;
}

/** Tabela de variações de estoque em modo flat (1 SKU = 1 linha) com scroll virtual. */
function VariantStockTableInner({
  products,
  className,
  isLoading,
  targetQuantity,
  emaEnabled,
  emaByVariantId,
}: VariantStockTableInnerProps) {
  // Scroll container ref para o useVirtualizer
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const deepLinkConsumedRef = useRef<string | null>(null);

  const [inlineSearch, setInlineSearch] = useState<string>(() =>
    readStored(SEARCH_STORAGE_KEY, ''),
  );
  // Defer the search computation so the controlled Input updates instantly while
  // the expensive filter (potentially thousands of SKUs) runs at lower priority.
  const deferredSearch = useDeferredValue(inlineSearch);
  const isSearchStale = inlineSearch !== deferredSearch;
  const [searchParams] = useSearchParams();

  // Persiste busca inline
  useEffect(() => {
    writeStored(SEARCH_STORAGE_KEY, inlineSearch);
  }, [inlineSearch]);

  // Cleanup one-shot: purga chaves legadas (modo agrupar + paginação).
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      for (const key of LEGACY_STORAGE_KEYS) window.localStorage.removeItem(key);
    } catch {
      /* localStorage indisponível — ignore */
    }
  }, []);

  // Filtro por status (persistido). Aplicado por variação individual.
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(() => {
    const stored = readStored(STATUS_FILTER_STORAGE_KEY, 'all') as StatusFilter;
    return STATUS_FILTER_VALUES.includes(stored) ? stored : 'all';
  });
  useEffect(() => {
    writeStored(STATUS_FILTER_STORAGE_KEY, statusFilter);
  }, [statusFilter]);

  // Horizonte de projeção do "Risco de Ruptura" — vendedor escolhe 3/7/15/30 dias.
  const [ruptureHorizon, setRuptureHorizon] = useState<RuptureHorizonDays>(() => {
    const raw = readStored(RUPTURE_HORIZON_STORAGE_KEY, String(DEFAULT_RUPTURE_HORIZON));
    const n = parseInt(raw, 10) as RuptureHorizonDays;
    return (RUPTURE_HORIZON_OPTIONS as readonly number[]).includes(n) ? n : DEFAULT_RUPTURE_HORIZON;
  });
  useEffect(() => {
    writeStored(RUPTURE_HORIZON_STORAGE_KEY, String(ruptureHorizon));
  }, [ruptureHorizon]);

  // Inline search filtering — runs against deferredSearch so keystrokes never
  // block the React render. The Input value (inlineSearch) updates immediately;
  // the filtered list updates once React has capacity (useDeferredValue).
  const searchedProducts = useMemo(() => {
    if (!deferredSearch.trim()) return products;
    const q = deferredSearch.toLowerCase();
    return products.filter(
      (p) =>
        p.productName.toLowerCase().includes(q) ||
        p.productSku.toLowerCase().includes(q) ||
        p.variants.some(
          (v) => v.colorName?.toLowerCase().includes(q) || v.variantSku?.toLowerCase().includes(q),
        ),
    );
  }, [products, deferredSearch]);

  /**
   * Contagem de variações (SKUs) por status — base para chips de filtro.
   * Indexa por status uma única vez por mudança de busca.
   */
  const statusCounts = useMemo(() => {
    const counts: Record<StatusFilter, number> = {
      all: 0,
      in_stock: 0,
      low_stock: 0,
      critical: 0,
      out_of_stock: 0,
      overstocked: 0,
      incoming: 0,
    };
    for (const p of searchedProducts) {
      for (const v of p.variants) {
        counts.all += 1;
        counts[v.status] = (counts[v.status] ?? 0) + 1;
      }
    }
    return counts;
  }, [searchedProducts]);

  /**
   * Modo variação-first: 1 linha = 1 SKU. Cada linha carrega seu `effectiveStatus`
   * — que pode ter sido reavaliado pela fórmula preditiva de Risco de Ruptura
   * (override apenas quando o status base era `in_stock` e a projeção indica
   * ruptura no horizonte selecionado). Estoque exibido é SEMPRE da variação.
   */
  const allFlatRows = useMemo(() => {
    type Row = {
      product: ProductStockSummary;
      variant: VariantStock;
      effectiveStatus: StockStatus;
      projection?: {
        targetQty: number;
        avgDailyDepletion: number;
        horizonDays: number;
        projectedStock: number;
        daysToTarget: number | null;
      };
    };
    const rows: Row[] = [];
    for (const product of searchedProducts) {
      for (const variant of product.variants) {
        let effectiveStatus: StockStatus = variant.status;
        let projection: Row['projection'];
        // Aplica fórmula preditiva apenas quando o status base é "saudável".
        // Crítico/Esgotado/Chegando têm precedência maior e permanecem.
        if (effectiveStatus === 'in_stock' || effectiveStatus === 'overstocked') {
          const risk = computeRuptureRisk({
            current: variant.currentStock,
            avgDailyDepletion: variant.avgDailySales,
            targetQty: targetQuantity,
            horizonDays: ruptureHorizon,
          });
          if (
            risk.atRisk &&
            risk.projectedStock !== null &&
            typeof targetQuantity === 'number' &&
            typeof variant.avgDailySales === 'number'
          ) {
            effectiveStatus = 'low_stock';
            projection = {
              // O guard acima garante que targetQuantity e avgDailySales são
              // numbers (não null/undefined) — ?? 0 seria dead code aqui.
              targetQty: targetQuantity,
              avgDailyDepletion: variant.avgDailySales,
              horizonDays: ruptureHorizon,
              projectedStock: risk.projectedStock,
              daysToTarget: risk.daysToTarget,
            };
          }
        }
        if (statusFilter !== 'all' && effectiveStatus !== statusFilter) continue;
        rows.push({ product, variant, effectiveStatus, projection });
      }
    }
    return rows;
  }, [searchedProducts, statusFilter, targetQuantity, ruptureHorizon]);

  const totalRows = allFlatRows.length;

  // Virtual scroll: renderiza apenas a janela visível — suporta 5k+ SKUs sem degradação.
  // estimateSize ≈ 56px/row medido em produção; suficiente para calibrar o scrollbar.
  const rowVirtualizer = useVirtualizer({
    count: totalRows,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: () => 56,
    overscan: 8,
  });

  // Deep link ?product=ID: scroll virtual até a 1a linha do produto.
  // Consome o ID uma única vez (ref) para NÃO re-arrastar o usuário a cada troca de filtro.
  useEffect(() => {
    const productId = searchParams.get('product');
    if (!productId || productId === deepLinkConsumedRef.current) return;
    const rowIdx = allFlatRows.findIndex((r) => r.product.productId === productId);
    if (rowIdx >= 0) {
      rowVirtualizer.scrollToIndex(rowIdx, { align: 'start' });
      deepLinkConsumedRef.current = productId;
    }
  }, [searchParams, allFlatRows, rowVirtualizer]);

  // ── Seleção em lote (paridade catálogo) ─────────────────────────────────
  // Com scroll virtual, TODAS as linhas do filtro são selecionáveis (não só a "página").
  const allSelectableRows = useMemo(
    () => allFlatRows.map((r) => ({ product: r.product, variant: r.variant })),
    [allFlatRows],
  );
  const selection = useStockSelection(allSelectableRows);
  const [bulkCollectionOpen, setBulkCollectionOpen] = useState(false);

  // Atalho de teclado "s" → alterna modo seleção (paridade catálogo).
  useSelectionShortcut(() => selection.setMode(!selection.enabled));

  if (isLoading) {
    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[300px]">Produto</TableHead>
            <TableHead className="hidden md:table-cell">Cores</TableHead>
            <TableHead>Estoque Total</TableHead>

            <TableHead className="hidden md:table-cell">Trânsito</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="hidden sm:table-cell">Previsão</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: 10 }, (_, i) => (
            <TableRow key={i}>
              <TableCell>
                <div className="flex items-center gap-2">
                  <div className="h-6 w-6 animate-pulse rounded-md bg-muted" />
                  <div className="space-y-2">
                    <div className="h-4 w-32 animate-pulse rounded bg-muted" />
                    <div className="h-3 w-20 animate-pulse rounded bg-muted" />
                  </div>
                </div>
              </TableCell>
              <TableCell className="hidden md:table-cell">
                <div className="flex gap-1">
                  {Array.from({ length: 3 }, (_b, j) => (
                    <div key={j} className="h-5 w-5 animate-pulse rounded-full bg-muted" />
                  ))}
                </div>
              </TableCell>
              <TableCell>
                <div className="h-4 w-12 animate-pulse rounded bg-muted" />
              </TableCell>
              <TableCell className="hidden md:table-cell">
                <div className="h-4 w-8 animate-pulse rounded bg-muted" />
              </TableCell>
              <TableCell>
                <div className="h-6 w-20 animate-pulse rounded-full bg-muted" />
              </TableCell>
              <TableCell className="hidden sm:table-cell">
                <div className="h-4 w-10 animate-pulse rounded bg-muted" />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  }

  const bulkCollectionRows: BulkCollectionRow[] = selection.selectedRows.map((r) => ({
    productId: r.product.productId,
    productName: r.product.productName,
    variant: {
      color_name: r.variant.colorName,
      color_hex: r.variant.colorHex,
      size_code: r.variant.sizeCode,
      variant_id: r.variant.variantId,
      thumbnail: r.variant.imageUrl ?? r.product.productImageUrl,
    },
  }));

  const colSpan = (selection.enabled ? 7 : 6) + (emaEnabled ? 1 : 0);
  const virtualItems = rowVirtualizer.getVirtualItems();
  // Spacers mantêm o scrollbar calibrado sem renderizar todas as linhas.
  const virtualTopPad = virtualItems.length > 0 ? (virtualItems[0]?.start ?? 0) : 0;
  const virtualBottomPad =
    virtualItems.length > 0
      ? Math.max(
          0,
          rowVirtualizer.getTotalSize() - (virtualItems[virtualItems.length - 1]?.end ?? 0),
        )
      : 0;

  return (
    <div className={cn('space-y-2', className)} data-testid="variant-stock-table">
      {/* Toolbar sticky — fica visível ao rolar a tabela */}
      <div
        data-testid="variant-stock-toolbar"
        className="sticky top-0 z-20 flex flex-col items-start justify-between gap-2 bg-background pb-2 sm:flex-row sm:items-center"
      >
        {/* Inline Search */}
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar na tabela..."
            value={inlineSearch}
            onChange={(e) => {
              setInlineSearch(e.target.value);
              rowVirtualizer.scrollToIndex(0);
            }}
            className="h-8 pl-8 text-sm"
          />
          {inlineSearch && (
            <button
              type="button"
              onClick={() => {
                setInlineSearch('');
                rowVirtualizer.scrollToIndex(0);
              }}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>

        {/* Horizonte de projeção do "Risco de Ruptura" — 3/7/15/30 dias.
            Independente do filtro "Estoque Futuro Nd" da toolbar (que decide
            se reposições futuras entram no cálculo da régua de quantidade). */}
        <div
          className="flex items-center gap-1.5 text-xs text-muted-foreground"
          data-testid="rupture-horizon-control"
          title="Janela usada apenas para o cálculo de Risco de Ruptura nesta tabela. Independente do filtro 'Estoque Futuro Nd' da toolbar."
        >
          <span className="hidden whitespace-nowrap md:inline">Projetar risco em:</span>
          <Select
            value={String(ruptureHorizon)}
            onValueChange={(v) => setRuptureHorizon(Number(v) as RuptureHorizonDays)}
          >
            <SelectTrigger
              className="h-8 w-[88px] text-xs"
              aria-label="Horizonte de projeção do risco de ruptura (independente do filtro Estoque Futuro da toolbar)"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {RUPTURE_HORIZON_OPTIONS.map((d) => (
                <SelectItem key={d} value={String(d)} className="text-xs">
                  {d} dias
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="hidden text-[10px] text-muted-foreground/70 lg:inline">
            (independente do Estoque Futuro)
          </span>
        </div>

        {/* Chips de status removidos — os StatCards do StockDashboard são a
            fonte única de filtro por status (Total / Em Estoque / Risco de
            Ruptura / Sem Estoque / Estoque Futuro). */}


        <div className="flex items-center gap-2">
          {/* Contagem total */}
          <span className="whitespace-nowrap text-xs text-muted-foreground">
            {totalRows} {totalRows === 1 ? 'variação' : 'variações'}
          </span>

          {/* Toggle de seleção em lote (paridade catálogo) */}
          <Button
            type="button"
            size="sm"
            variant={selection.enabled ? 'secondary' : 'ghost'}
            aria-pressed={selection.enabled}
            data-testid="stock-selection-toggle"
            onClick={() => selection.setMode(!selection.enabled)}
            className="h-8 gap-1 text-xs"
          >
            {selection.enabled ? 'Sair da seleção' : 'Selecionar'}
          </Button>
        </div>
      </div>

      {/* Container de scroll virtual — height limitado + overflow-y para o virtualizer operar.
          opacity-60 durante isSearchStale sinalizaa o usuário que o filtro ainda está processando. */}
      <div
        ref={scrollContainerRef}
        data-testid="variant-stock-scroll"
        className={cn(
          'overflow-x-auto overflow-y-auto rounded-lg border [-webkit-overflow-scrolling:touch] [overscroll-behavior-x:contain]',
          isSearchStale && 'opacity-60',
        )}
        style={{ maxHeight: 'calc(100vh - 14rem)' }}
      >
        <Table className="min-w-[700px]">
          <TableHeader
            data-testid="variant-stock-thead"
            className="sticky top-0 z-10 bg-background shadow-[0_1px_0_0_hsl(var(--border))]"
          >
            <TableRow className="bg-muted/50">
              {selection.enabled && <TableHead className="w-[40px] pr-0" />}
              <TableHead className="w-[280px]">Variação / Cor</TableHead>
              <TableHead className="hidden w-[120px] md:table-cell">Categoria</TableHead>
              <TableHead>Estoque</TableHead>

              <TableHead className="hidden md:table-cell">Em Trânsito</TableHead>
              <TableHead>Status</TableHead>
              {emaEnabled && (
                <TableHead
                  className="hidden lg:table-cell"
                  data-testid="stock-thead-ema-coverage"
                  title="Cobertura projetada via EMA α=0.3 — dados pré-computados em mv_stock_rupture_alert"
                >
                  Cobertura (EMA)
                </TableHead>
              )}
              <TableHead className="hidden sm:table-cell">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {totalRows === 0 ? (
              <TableRow>
                <TableCell colSpan={colSpan} className="py-16 text-center text-muted-foreground">
                  <div className="flex flex-col items-center">
                    <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted/50">
                      <Package className="h-8 w-8 opacity-30" />
                    </div>
                    <p className="mb-1 font-semibold text-foreground">
                      Nenhuma variação encontrada
                    </p>
                    <p className="max-w-xs text-sm">
                      {inlineSearch
                        ? `Nenhum resultado para "${inlineSearch}". Tente outro termo.`
                        : 'Ajuste os filtros para visualizar os SKUs.'}
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              <>
                {/* Spacer topo — mantém scrollbar calibrado sem renderizar linhas invisíveis */}
                {virtualTopPad > 0 && (
                  <tr>
                    <td
                      colSpan={colSpan}
                      style={{ height: virtualTopPad, padding: 0, border: 'none' }}
                    />
                  </tr>
                )}
                {virtualItems.map((virtualRow) => {
                  const { product, variant, effectiveStatus, projection } =
                    allFlatRows[virtualRow.index];
                  const k = `${product.productId}::${variant.variantId}`;
                  return (
                    <FlatVariantRow
                      key={k}
                      product={product}
                      variant={variant}
                      effectiveStatus={effectiveStatus}
                      projection={projection}
                      selectionEnabled={selection.enabled}
                      isSelected={selection.isSelected(k)}
                      onToggleSelect={() => selection.toggle(k)}
                      emaEnabled={emaEnabled}
                      emaAlert={emaEnabled ? emaByVariantId.get(variant.variantId) : undefined}
                    />
                  );
                })}
                {/* Spacer base — garante que scroll total = rowVirtualizer.getTotalSize() */}
                {virtualBottomPad > 0 && (
                  <tr>
                    <td
                      colSpan={colSpan}
                      style={{ height: virtualBottomPad, padding: 0, border: 'none' }}
                    />
                  </tr>
                )}
              </>
            )}
          </TableBody>
        </Table>
      </div>

      {selection.enabled && (
        <StockBulkActionBar
          selectedCount={selection.selectedCount}
          totalCount={totalRows}
          onSelectAll={() => selection.selectAllVisible(allSelectableRows)}
          onClear={() => selection.setMode(false)}
          onBulkFavorite={selection.bulkFavorite}
          onBulkCompare={selection.bulkCompare}
          onBulkQuote={selection.bulkQuote}
          onBulkCollection={() => {
            if (selection.selectedCount === 0) return;
            setBulkCollectionOpen(true);
          }}
        />
      )}

      {bulkCollectionOpen && (
        <BulkAddToCollectionModal
          open={bulkCollectionOpen}
          onOpenChange={setBulkCollectionOpen}
          rows={bulkCollectionRows}
          onApplied={() => selection.clear()}
        />
      )}
    </div>
  );
}

export default VariantStockTable;
