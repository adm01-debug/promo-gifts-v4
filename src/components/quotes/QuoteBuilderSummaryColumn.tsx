/**
 * QuoteBuilderSummaryColumn — Coluna 3: Resumo com cards de itens, desconto e CTAs
 */

import { useState, useMemo, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CurrencyInput } from '@/components/ui/currency-input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Edit,
  GripVertical,
  Layers,
  Loader2,
  Package,
  Save,
  Send,
  Shield,
  ShoppingCart,
  Trash2,
  CheckCircle2,
  X,
} from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import type { QuoteItem } from '@/hooks/quotes';
import { NegotiationMarkupCard } from '@/components/quotes/NegotiationMarkupCard';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { getPriceFreshness } from '@/utils/price-freshness';
import { PriceFreshnessBadge } from '@/components/products/PriceFreshnessBadge';
import { formatColors, formatArea } from '@/lib/quotes/personalizationSummary';
import { toast } from 'sonner';
import { releaseScrollLockIfIdle } from '@/lib/dom/scroll-lock';
import { persistItemsOrder } from '@/services/quoteItemsReorder';
import { logger } from '@/lib/logger';
// BUG-C FIX: import SSOT round2 instead of duplicating it locally
import { round2 } from '@/hooks/quotes/quoteHelpers';

interface Props {
  items: QuoteItem[];
  activeItemIndex: number | null;
  setActiveItemIndex: (i: number | null) => void;
  removeItem: (i: number) => void;
  discountType: 'amount' | 'percent';
  setDiscountType: (v: 'amount' | 'percent') => void;
  discountValue: number;
  setDiscountValue: (v: number) => void;
  discountAmount: number;
  total: number;
  isFormValid: boolean;
  isDraftValid: boolean;
  validationErrors: string[];
  quotesLoading: boolean;
  isEditMode: boolean;
  formatCurrency: (v: number) => string;
  calculateItemPersonalizationTotal: (item: QuoteItem) => number;
  calculateItemTotal: (item: QuoteItem) => number;
  onSave: (status: 'draft' | 'pending_approval' | 'pending', sellerNotes?: string) => void;
  maxDiscountPercent?: number | null;
  isDiscountExceeded?: boolean;
  negotiationMarkup?: number;
  setNegotiationMarkup?: (v: number) => void;
  realSubtotal?: number;
  realDiscountPercent?: number;
  /** Marca um item como "preço confirmado com fornecedor" — suprime alerta stale. */
  confirmItemPrice?: (index: number) => void;
  /** Marca todos os itens com preço aging/stale como confirmados. */
  confirmAllStalePrices?: () => void;
  shippingType?: string;
  shippingCost?: number;
  /** Reordena os itens do orçamento (drag-and-drop ou agrupamento). Recebe o novo array completo. */
  onReorder?: (items: QuoteItem[]) => void;
  /** ID do orçamento já persistido — quando presente, ativa persistência granular
   * do `sort_order` via UPDATE direto em quote_items (sem disparar autosave global). */
  quoteId?: string | null;
  /** Liga/desliga supressão do `sort_order` no payload de autosave global enquanto
   * o reorder granular está em voo (drag-and-drop ou "Agrupar"). RACE-PROOF. */
  setSkipAutosaveSortOrder?: (v: boolean) => void;
}


/**
 * SortableSummaryCard — wrapper de drag-and-drop para um card do Resumo.
 *
 * Mantido FORA do render do componente pai para não recriar o hook em
 * cada ciclo (regra de hooks + perf). Expõe `dragAttributes`/`dragListeners`
 * via render-prop para que o handle (GripVertical) seja posicionado
 * inline pelo consumidor sem precisar de portais.
 */
type SortableRenderArgs = {
  dragAttributes: ReturnType<typeof useSortable>['attributes'];
  dragListeners: ReturnType<typeof useSortable>['listeners'];
  isDragging: boolean;
};
function SortableSummaryCard({
  id,
  dragDisabled,
  children,
}: {
  id: string;
  dragDisabled: boolean;
  children: (args: SortableRenderArgs) => React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled: dragDisabled,
  });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : undefined,
    zIndex: isDragging ? 10 : undefined,
  };
  return (
    <div ref={setNodeRef} style={style}>
      {children({ dragAttributes: attributes, dragListeners: listeners, isDragging })}
    </div>
  );
}

export function QuoteBuilderSummaryColumn({
  items,
  activeItemIndex,
  setActiveItemIndex,
  removeItem,
  discountType,
  setDiscountType,
  discountValue,
  setDiscountValue,
  discountAmount,
  total,
  isFormValid,
  isDraftValid,
  validationErrors,
  quotesLoading,
  isEditMode,
  formatCurrency,
  calculateItemPersonalizationTotal,
  calculateItemTotal: _calculateItemTotal,
  onSave,
  maxDiscountPercent,
  isDiscountExceeded,
  negotiationMarkup = 0,
  setNegotiationMarkup,
  realSubtotal = 0,
  realDiscountPercent = 0,
  confirmItemPrice,
  confirmAllStalePrices,
  shippingType,
  shippingCost = 0,
  onReorder,
  quoteId,
  setSkipAutosaveSortOrder,
}: Props) {
  const [approvalDialogOpen, setApprovalDialogOpen] = useState(false);
  const [sellerNotes, setSellerNotes] = useState('');
  const [confirmAllOpen, setConfirmAllOpen] = useState(false);

  const [showOnlyStale, setShowOnlyStale] = useState(false);
  const [groupedByProduct, setGroupedByProduct] = useState(false);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);

  // Sensors do dnd-kit — pointer (mouse/touch) + keyboard (acessibilidade).
  const dndSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  /** Persiste a nova ordem em background via UPDATE granular em quote_items.
   * Não bloqueia a UI (otimista) e mostra toast saneado em falha.
   * RACE-PROOF: ativa skipAutosaveSortOrder enquanto o UPDATE está em voo para
   * impedir o autosave global de gravar um `sort_order` intermediário no
   * LocalStorage entre o arrayMove em memória e o ACK do banco. */
  const persistOrderInBackground = (reordered: QuoteItem[]) => {
    if (!quoteId) return;
    const rows = reordered
      .map((it, i) => ({ id: it.id ?? '', sort_order: i }))
      .filter((r) => r.id);
    if (rows.length === 0) return;
    setSkipAutosaveSortOrder?.(true);
    persistItemsOrder(quoteId, rows)
      .catch((err) => {
        logger.error('[QuoteBuilderSummaryColumn] persistItemsOrder failed', err);
        toast.error('Não foi possível salvar a nova ordem. Tente novamente.');
      })
      .finally(() => {
        setSkipAutosaveSortOrder?.(false);
      });
  };


  const handleDragStart = (e: DragStartEvent) => {
    setActiveDragId(String(e.active.id));
  };

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    setActiveDragId(null);
    if (!over || active.id === over.id || !onReorder) return;
    const oldIndex = items.findIndex(
      (it, i) => (it.id ?? `__idx_${i}`) === String(active.id),
    );
    const newIndex = items.findIndex(
      (it, i) => (it.id ?? `__idx_${i}`) === String(over.id),
    );
    if (oldIndex < 0 || newIndex < 0) return;
    const reordered = arrayMove(items, oldIndex, newIndex).map((it, i) => ({
      ...it,
      sort_order: i,
    }));
    onReorder(reordered);
    persistOrderInBackground(reordered);
  };

  const groupByProductId = () => {
    if (!onReorder || items.length < 2) return;
    const seen = new Map<string, number>();
    items.forEach((it, i) => {
      const key = it.product_id || `__no_pid_${i}`;
      if (!seen.has(key)) seen.set(key, seen.size);
    });
    const grouped = [...items]
      .map((it, i) => ({ it, i }))
      .sort((a, b) => {
        const ka = a.it.product_id || `__no_pid_${a.i}`;
        const kb = b.it.product_id || `__no_pid_${b.i}`;
        const ga = seen.get(ka) ?? 0;
        const gb = seen.get(kb) ?? 0;
        if (ga !== gb) return ga - gb;
        return a.i - b.i;
      })
      .map(({ it }, i) => ({ ...it, sort_order: i }));
    onReorder(grouped);
    persistOrderInBackground(grouped);
    setGroupedByProduct(true);
    toast.success('Itens agrupados por produto');
  };

  const groupByCategory = () => {
    if (!onReorder || items.length < 2) return;
    const BUCKET_UNCAT = '__uncategorized__';
    const seen = new Map<string, number>();
    items.forEach((it) => {
      const key = it.product_category_id || BUCKET_UNCAT;
      if (!seen.has(key)) seen.set(key, seen.size);
    });
    // Garante bucket sem categoria por último.
    if (seen.has(BUCKET_UNCAT)) {
      seen.delete(BUCKET_UNCAT);
      seen.set(BUCKET_UNCAT, seen.size);
    }
    const uncategorized = items.filter((it) => !it.product_category_id).length;
    if (uncategorized > 0) {
      logger.info('[QuoteBuilderSummaryColumn] quote_summary_group_uncategorized', {
        count: uncategorized,
        total: items.length,
      });
    }
    const grouped = [...items]
      .map((it, i) => ({ it, i }))
      .sort((a, b) => {
        const ka = a.it.product_category_id || BUCKET_UNCAT;
        const kb = b.it.product_category_id || BUCKET_UNCAT;
        const ga = seen.get(ka) ?? 0;
        const gb = seen.get(kb) ?? 0;
        if (ga !== gb) return ga - gb;
        return a.i - b.i;
      })
      .map(({ it }, i) => ({ ...it, sort_order: i }));
    onReorder(grouped);
    persistOrderInBackground(grouped);
    setGroupedByProduct(true);
    toast.success('Itens agrupados por categoria');
  };

  // Snapshot do item arrastado para o DragOverlay.
  const activeItemForOverlay = useMemo(() => {
    if (!activeDragId) return null;
    return (
      items.find((it, i) => (it.id ?? `__idx_${i}`) === activeDragId) ?? null
    );
  }, [activeDragId, items]);

  // ── Base apresentada (subtotal + markup) — referência para converter desconto %/R$ ──
  // BUG-D FIX: clamp markup to [0,50] so this mirrors calculateQuoteTotals exactly
  const presentedSubtotal = useMemo(() => {
    const clampedMarkup = Math.max(0, Math.min(50, negotiationMarkup || 0));
    return round2((realSubtotal || 0) * (1 + clampedMarkup / 100));
  }, [realSubtotal, negotiationMarkup]);

  const handleDiscountTypeChange = (next: 'amount' | 'percent') => {
    if (next === discountType) return;
    if (presentedSubtotal > 0 && discountValue > 0) {
      if (next === 'amount') {
        setDiscountValue(
          round2(Math.min(presentedSubtotal, presentedSubtotal * (discountValue / 100))),
        );
      } else {
        const pct = (discountValue / presentedSubtotal) * 100;
        setDiscountValue(round2(Math.max(0, Math.min(100, pct))));
      }
    } else if (presentedSubtotal === 0 && discountValue > 0) {
      // BUG-DISCOUNT-ZERO FIX: with a 0 subtotal, any discount is meaningless.
      // The old code only reset when switching TO percent (X% of 0 = 0); it forgot
      // the reverse direction (R$ amount when subtotal is 0 also makes no sense).
      setDiscountValue(0);
    }
    setDiscountType(next);
  };

  const staleIndexes = useMemo(() => {
    const set = new Set<number>();
    items.forEach((item, idx) => {
      // BUG-STALE-CONFIRM FIX (summary): a confirmation is only valid when it
      // postdates the last price update. Without this check, a re-priced item
      // with an OLD price_confirmed_at would never show the badge in the summary
      // column, causing stale prices to reach the client silently.
      if (
        item.price_confirmed_at &&
        (!item.price_updated_at || item.price_confirmed_at >= item.price_updated_at)
      )
        return;
      const f = getPriceFreshness(item.price_updated_at, item.price_freshness_threshold_days);
      if (f.shouldWarn) set.add(idx);
    });
    return set;
  }, [items]);

  const staleCount = staleIndexes.size;
  const visibleItems = useMemo(
    () =>
      showOnlyStale
        ? items.map((it, idx) => ({ it, idx })).filter(({ idx }) => staleIndexes.has(idx))
        : items.map((it, idx) => ({ it, idx })),
    [items, showOnlyStale, staleIndexes],
  );

  useEffect(() => {
    if (showOnlyStale && staleCount === 0) setShowOnlyStale(false);
  }, [showOnlyStale, staleCount]);

  const handleRequestApproval = () => {
    onSave('pending_approval', sellerNotes);
    setApprovalDialogOpen(false);
    setSellerNotes('');
  };

  /**
   * SCROLL-FIX-03: Dialog close handler com scroll-lock release explícito.
   *
   * O Dialog de aprovação usa Radix UI, que aplica `overflow: hidden` no body
   * durante a abertura. Em condições de race (animação de fechamento + unmount
   * rápido), o Radix pode não liberar o lock — deixando a página inteira
   * sem scroll. O `releaseScrollLockIfIdle` do scroll-lock.ts já cuida disso
   * globalmente, mas disparar explicitamente aqui garante liberação imediata
   * sem depender da janela do MutationObserver ou do próximo pointerdown.
   */
  const handleApprovalDialogChange = (open: boolean) => {
    setApprovalDialogOpen(open);
    if (!open) {
      // Defer para depois do frame de fechamento do Radix
      requestAnimationFrame(() => releaseScrollLockIfIdle());
    }
  };

  const handleConfirmAllDialogChange = (open: boolean) => {
    setConfirmAllOpen(open);
    if (!open) {
      requestAnimationFrame(() => releaseScrollLockIfIdle());
    }
  };

  /**
   * SCROLL-FIX: altura da sticky column calculada via CSS var para garantir
   * que o INNER scroll container tenha altura EXPLÍCITA — sem depender de
   * `h-full` dentro de `overflow-hidden`, que falha em alguns contextos.
   *
   * Mudanças em relação à versão anterior:
   *   ANTES: outer `lg:overflow-hidden` + inner `lg:h-full lg:overflow-y-auto`
   *          → `overflow-hidden` no pai cria BFC; `h-full` pode resolver para
   *            `auto` dentro do BFC, fazendo o `overflow-y-auto` nunca scrollar.
   *   AGORA: outer SEM `overflow-hidden` (usa `overflow-clip` apenas para sombra)
   *          + inner com `lg:max-h-[calc(...)]` EXPLÍCITO + `overflow-y-auto`
   *          → scroll funciona em todos os browsers (Chrome, Firefox, Safari).
   */
  const STICKY_HEIGHT =
    'lg:max-h-[calc(100vh-var(--header-h,56px)-var(--breadcrumb-h,40px)-2rem)]';

  return (
    <div data-testid="quote-builder-summary-column" className="min-w-0 lg:col-span-4">
      {/*
       * SCROLL-FIX-01: Removido `lg:overflow-hidden` deste wrapper.
       *
       * PROBLEMA ORIGINAL: `overflow: hidden` criava um Block Formatting
       * Context (BFC). Dentro de um BFC, `height: 100%` no filho inner
       * resolvia de forma inconsistente entre browsers, desabilitando o
       * scroll interno.
       *
       * SOLUÇÃO: O `overflow-clip` substitui `overflow-hidden` SEM criar
       * scroll container, mantendo o clipping visual da sombra do inner div.
       * Browsers modernos (Chrome 90+, Firefox 102+, Safari 16+) suportam
       * `overflow: clip`; Tailwind expõe via `overflow-clip`.
       */}
      <div
        data-testid="quote-builder-summary-sticky"
        className="lg:sticky lg:top-[calc(var(--header-h,56px)+var(--breadcrumb-h,40px)+1rem)] lg:self-start"
      >
        {/*
         * SCROLL-FIX-02: `lg:h-full` substituído por `lg:max-h-[calc(...)]`.
         *
         * PROBLEMA ORIGINAL: `h-full` dentro de `overflow-hidden` (pai) é
         * ambíguo — o BFC do pai impedia o browser de resolver a altura corretamente,
         * fazendo o conteúdo crescer além da tela sem criar scrollbar.
         *
         * SOLUÇÃO: `max-h-[calc(100vh-header-breadcrumb-2rem)]` é aplicado
         * diretamente no scroll container, dando ao browser um limite EXPLÍCITO
         * para resolver o overflow-y-auto sem depender do pai.
         */}
        <div
          data-testid="quote-builder-summary-scroll"
          className={cn(
            'flex flex-col rounded-2xl border border-border/50 bg-card shadow-xl',
            `lg:overflow-y-auto ${STICKY_HEIGHT}`,
          )}
        >
          {/* Header */}
          <div className="flex shrink-0 items-center gap-2 p-4 pb-3">
            <div className="rounded-lg bg-primary/10 p-2">
              <ShoppingCart className="h-4 w-4 text-primary" />
            </div>
            <h3 className="font-display text-base font-semibold">Resumo</h3>
            {items.length >= 2 && onReorder && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    size="sm"
                    variant={groupedByProduct ? 'secondary' : 'outline'}
                    className="ml-auto h-7 gap-1.5 px-2.5 text-xs"
                    title="Agrupar itens"
                    data-testid="quote-summary-group-trigger"
                  >
                    <Layers className="h-3.5 w-3.5" />
                    Agrupar
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuItem
                    onClick={groupByProductId}
                    data-testid="quote-summary-group-by-product"
                  >
                    Por produto (SKU)
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={groupByCategory}
                    data-testid="quote-summary-group-by-category"
                  >
                    Por categoria
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>

          {/* Stale price filter */}
          {staleCount > 0 && (
            <div className="flex shrink-0 flex-wrap items-center gap-2 px-4 pb-3">
              <button
                type="button"
                onClick={() => setShowOnlyStale((v) => !v)}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-xl border-[1.5px] px-2.5 py-1 text-xs font-medium transition-all',
                  showOnlyStale
                    ? 'border-warning bg-warning/15 text-warning shadow-sm'
                    : 'border-warning/40 bg-warning/5 text-warning hover:bg-warning/10',
                )}
                aria-pressed={showOnlyStale}
                aria-label={`Mostrar apenas ${staleCount} item(ns) com preço a confirmar`}
              >
                <AlertTriangle className="h-3.5 w-3.5" />
                <span>Preços a confirmar</span>
                <Badge
                  variant="secondary"
                  className="h-4 border-0 bg-warning px-1.5 text-[10px] text-warning-foreground"
                >
                  {staleCount}
                </Badge>
                {showOnlyStale && <X className="ml-0.5 h-3 w-3" aria-hidden="true" />}
              </button>
              {confirmAllStalePrices && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 gap-1.5 border-warning/40 px-2.5 text-xs text-warning hover:bg-warning/10 hover:text-warning"
                  onClick={() => setConfirmAllOpen(true)}
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Confirmar todos
                </Button>
              )}
            </div>
          )}

          {/* Product Cards */}
          <div className="px-4">
            <div className="space-y-3 pr-1">
              {items.length === 0 ? (
                <div className="group flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-muted-foreground/20 bg-muted/5 p-8 transition-all duration-300 hover:border-primary/30">
                  <div className="mb-3 rounded-full bg-muted/30 p-3 transition-colors group-hover:bg-primary/10">
                    <Package className="h-6 w-6 text-muted-foreground/40 group-hover:text-primary/50" />
                  </div>
                  <p className="text-sm font-medium text-muted-foreground group-hover:text-primary/70">
                    Nenhum item adicionado
                  </p>
                  <p className="mt-1 max-w-[150px] text-center text-[11px] text-muted-foreground/60">
                    Busque produtos na coluna ao lado para começar
                  </p>
                </div>
              ) : visibleItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-warning/30 bg-warning/[0.03] p-6">
                  <CheckCircle2 className="mb-2 h-6 w-6 text-warning" />
                  <p className="text-sm font-medium text-warning">Preços Confirmados</p>
                  <button
                    type="button"
                    onClick={() => setShowOnlyStale(false)}
                    className="mt-2 text-xs text-muted-foreground underline transition-colors hover:text-foreground"
                  >
                    Ver todos os itens
                  </button>
                </div>
              ) : (
                <DndContext
                  sensors={dndSensors}
                  collisionDetection={closestCenter}
                  onDragStart={handleDragStart}
                  onDragEnd={handleDragEnd}
                  onDragCancel={() => setActiveDragId(null)}
                >
                  <SortableContext
                    items={visibleItems.map(
                      ({ it, idx }) => it.id ?? `__idx_${idx}`,
                    )}
                    strategy={verticalListSortingStrategy}
                  >
                    {visibleItems.map(({ it: item, idx }) => {
                      const persTotal = calculateItemPersonalizationTotal(item);
                      const isActive = activeItemIndex === idx;
                      const isStale = staleIndexes.has(idx);
                      const sortableId = item.id ?? `__idx_${idx}`;
                      // Drag desabilitado quando há filtro ativo (índices visíveis ≠ índices reais
                      // do array `items`, o que tornaria a reordenação inconsistente).
                      const dragDisabled = !onReorder || showOnlyStale;
                      return (
                        <SortableSummaryCard
                          key={sortableId}
                          id={sortableId}
                          dragDisabled={dragDisabled}
                        >
                          {({ dragAttributes, dragListeners }) => (
                            <div
                              data-testid={`quote-summary-item-${idx}`}
                              data-quote-item-id={item.id ?? ''}
                              className={cn(
                                'cursor-pointer rounded-xl border transition-all',
                                isActive
                                  ? 'border-primary/50 bg-primary/5 ring-1 ring-primary/20'
                                  : 'border-border/60 bg-muted/30 hover:border-border',
                                isStale && !isActive && 'border-warning/40 bg-warning/[0.04]',
                                isStale && isActive && 'ring-warning/30',
                              )}
                              onClick={() => setActiveItemIndex(idx)}
                            >
                              <div className="space-y-2 p-3">
                                <div className="flex items-start gap-2">
                                  {/* Handle de arrastar — antes da imagem do produto */}
                                  <button
                                    type="button"
                                    aria-label="Arrastar para reordenar"
                                    title="Arrastar para reordenar"
                                    data-testid={`quote-summary-drag-handle-${idx}`}
                                    className={cn(
                                      'mt-1 shrink-0 touch-none rounded p-1 text-muted-foreground/50 transition-colors',
                                      dragDisabled
                                        ? 'cursor-not-allowed opacity-30'
                                        : 'cursor-grab hover:bg-muted hover:text-foreground active:cursor-grabbing',
                                    )}
                                    onClick={(e) => e.stopPropagation()}
                                    {...(dragDisabled ? {} : dragAttributes)}
                                    {...(dragDisabled ? {} : dragListeners)}
                                  >
                                    <GripVertical className="h-4 w-4" />
                                  </button>
                                  <div className="shrink-0">
                                    {item.product_image_url ? (
                                      <img
                                        src={item.product_image_url}
                                        alt={item.product_name}
                                        className="h-12 w-12 rounded-lg bg-muted object-cover"
                                        loading="lazy"
                                        onError={(e) => {
                                          (e.currentTarget as HTMLImageElement).src =
                                            '/placeholder.svg';
                                        }}
                                      />
                                    ) : (
                                      <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-muted">
                                        <Package className="h-5 w-5 text-muted-foreground" />
                                      </div>
                                    )}
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm font-medium leading-tight">
                                      {item.product_name}
                                    </p>
                                    <div className="mt-0.5 flex items-center gap-1.5">
                                      <Badge
                                        variant="secondary"
                                        className="h-4 px-1.5 py-0 font-mono text-[10px]"
                                      >
                                        {item.product_sku}
                                      </Badge>
                                      {item.color_name && (
                                        <div className="flex items-center gap-1">
                                          <div
                                            className="h-2.5 w-2.5 rounded-full border border-border/50"
                                            style={{
                                              backgroundColor: item.color_hex || '#CCC',
                                            }}
                                          />
                                          <span className="text-[10px] text-muted-foreground">
                                            {item.color_name}
                                          </span>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                  <div className="flex shrink-0 items-center gap-1">
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      aria-label="Editar"
                                      className={cn(
                                        'h-6 w-6',
                                        isActive ? 'text-primary' : 'text-muted-foreground',
                                      )}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setActiveItemIndex(idx);
                                      }}
                                    >
                                      <Edit className="h-3.5 w-3.5" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      aria-label="Excluir"
                                      className="h-6 w-6 text-destructive hover:bg-destructive/10"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        removeItem(idx);
                                        if (activeItemIndex === idx) setActiveItemIndex(null);
                                        else if (
                                          activeItemIndex !== null &&
                                          activeItemIndex > idx
                                        )
                                          setActiveItemIndex(activeItemIndex - 1);
                                      }}
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 text-xs">
                                  <span className="text-muted-foreground">Qtd:</span>
                                  <span className="font-medium">{item.quantity}</span>
                                  <span className="text-muted-foreground">×</span>
                                  <span className="font-medium">
                                    {formatCurrency(item.unit_price)}
                                  </span>
                                  <span className="ml-auto font-semibold tabular-nums text-foreground">
                                    {formatCurrency(item.quantity * item.unit_price)}
                                  </span>
                                </div>
                                {(item.price_updated_at || item.price_confirmed_at) && (
                                  <div onClick={(e) => e.stopPropagation()} className="pt-0.5">
                                    <PriceFreshnessBadge
                                      priceUpdatedAt={item.price_updated_at}
                                      thresholdDays={item.price_freshness_threshold_days}
                                      confirmedAt={item.price_confirmed_at}
                                      variant="inline"
                                      onConfirm={
                                        confirmItemPrice
                                          ? () => {
                                              confirmItemPrice(idx);
                                              toast.success('Preço confirmado com fornecedor', {
                                                description: item.product_name,
                                              });
                                            }
                                          : undefined
                                      }
                                    />
                                  </div>
                                )}
                              </div>
                              {item.personalizations && item.personalizations.length > 0 && (
                                <div className="px-3 pb-3 pt-0">
                                  <div className="mb-1.5 flex items-center justify-between">
                                    <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                                      Gravações ({item.personalizations.length})
                                    </span>
                                    <span className="text-xs font-semibold tabular-nums text-primary">
                                      {formatCurrency(persTotal)}
                                    </span>
                                  </div>
                                  <div className="space-y-1">
                                    {item.personalizations.map((p, pIdx) => (
                                      <div
                                        key={`${p.technique_id || p.technique_name}-${pIdx}`}
                                        className="flex items-center justify-between gap-1 rounded-lg border border-border/40 bg-card px-2 py-1 text-xs"
                                      >
                                        <div className="flex min-w-0 flex-1 items-center gap-1.5">
                                          <Badge
                                            variant="secondary"
                                            className="h-4 shrink-0 px-1 py-0 text-[9px] font-bold"
                                          >
                                            {pIdx + 1}
                                          </Badge>
                                          <div className="min-w-0">
                                            <span className="block truncate text-[11px] font-medium text-primary">
                                              {p.location_name ? (
                                                <span className="mr-1 rounded bg-primary/15 px-1 py-px text-[9px] font-bold uppercase tracking-wide text-primary">
                                                  {p.location_name}
                                                </span>
                                              ) : null}
                                              {p.technique_name}
                                            </span>
                                            <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[9px] text-muted-foreground">
                                              {formatArea(p.width_cm, p.height_cm) && (
                                                <span>
                                                  Área {formatArea(p.width_cm, p.height_cm)}
                                                </span>
                                              )}
                                              <span>• {formatColors(p.colors_count)}</span>
                                              {p.personalized_quantity && (
                                                <span>• {p.personalized_quantity} pç(s)</span>
                                              )}
                                            </div>
                                          </div>
                                        </div>
                                        <span className="shrink-0 font-bold tabular-nums text-foreground">
                                          {formatCurrency(p.total_cost || 0)}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </SortableSummaryCard>
                      );
                    })}
                  </SortableContext>
                  <DragOverlay dropAnimation={{ duration: 180, easing: 'cubic-bezier(0.18,0.67,0.6,1.22)' }}>
                    {activeItemForOverlay ? (
                      <div
                        data-testid="quote-summary-drag-overlay"
                        className={cn(
                          'pointer-events-none rounded-xl border-[1.5px] border-primary/60 bg-card p-3',
                          'shadow-2xl ring-2 ring-primary/40 rotate-[0.5deg] scale-[1.02]',
                          'animate-fade-in',
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <GripVertical className="h-4 w-4 text-primary" />
                          {activeItemForOverlay.product_image_url ? (
                            <img
                              src={activeItemForOverlay.product_image_url}
                              alt=""
                              className="h-10 w-10 rounded-lg bg-muted object-cover"
                            />
                          ) : (
                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                              <Package className="h-4 w-4 text-muted-foreground" />
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">
                              {activeItemForOverlay.product_name}
                            </p>
                            <p className="text-[10px] text-muted-foreground">
                              {activeItemForOverlay.quantity} × {formatCurrency(activeItemForOverlay.unit_price)}
                            </p>
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </DragOverlay>
                </DndContext>
              )}
            </div>
          </div>

          {/* Discount */}
          {items.length > 0 && (
            <div className="space-y-2.5 px-4 pt-3">
              {maxDiscountPercent !== null && maxDiscountPercent !== undefined && (
                <div
                  className={cn(
                    'flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs transition-colors',
                    isDiscountExceeded
                      ? 'border border-amber-500/30 bg-amber-500/10'
                      : 'bg-muted/50',
                  )}
                >
                  <Shield
                    className={cn(
                      'h-3.5 w-3.5 shrink-0',
                      isDiscountExceeded ? 'text-amber-500' : 'text-muted-foreground',
                    )}
                  />
                  <span className="text-muted-foreground">
                    Seu limite:{' '}
                    <span
                      className={cn(
                        'font-bold',
                        isDiscountExceeded ? 'text-amber-500' : 'text-foreground',
                      )}
                    >
                      {maxDiscountPercent}%
                    </span>
                  </span>
                  {isDiscountExceeded && (
                    <Badge
                      variant="secondary"
                      className="ml-auto h-4 gap-0.5 border-amber-500/30 bg-amber-500/15 text-[9px] font-semibold text-amber-600"
                    >
                      <AlertTriangle className="h-2.5 w-2.5" /> Excedido
                    </Badge>
                  )}
                </div>
              )}
              <div className="flex items-center gap-2">
                <Select
                  value={discountType}
                  onValueChange={(v) => handleDiscountTypeChange(v as 'amount' | 'percent')}
                >
                  <SelectTrigger
                    data-testid="quote-discount-type-select"
                    className="h-8 w-16 text-xs"
                    aria-label="Tipo de desconto"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percent">%</SelectItem>
                    <SelectItem value="amount">R$</SelectItem>
                  </SelectContent>
                </Select>
                <div className="flex-1">
                  <CurrencyInput
                    data-testid="quote-discount-input"
                    value={discountValue}
                    onChange={setDiscountValue}
                    max={discountType === 'percent' ? 100 : presentedSubtotal}
                    className={cn(
                      'h-8 text-xs font-semibold tabular-nums',
                      isDiscountExceeded
                        ? 'border-amber-500/50 focus-visible:ring-amber-500/30'
                        : 'border-border/50',
                    )}
                  />
                </div>
              </div>
              {isDiscountExceeded && (
                <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                  <div>
                    <p className="text-xs font-semibold text-amber-600">
                      Desconto acima do autorizado
                    </p>
                    <p className="mt-0.5 text-[11px] text-amber-600/80">
                      O orçamento será enviado para aprovação do administrador antes de poder ser
                      finalizado.
                    </p>
                  </div>
                </div>
              )}
              {discountAmount > 0 && (
                <div
                  className={cn(
                    'flex flex-col gap-0.5 rounded-lg px-2.5 py-1.5 text-xs transition-colors',
                    isDiscountExceeded
                      ? 'border border-amber-500/30 bg-amber-500/10'
                      : 'border border-destructive/20 bg-destructive/5',
                  )}
                  aria-live="polite"
                  data-testid="discount-effective"
                >
                  <div className="flex justify-between text-destructive">
                    <span className="font-medium">Desconto aplicado</span>
                    <span
                      className="font-semibold tabular-nums"
                      data-testid="discount-effective-amount"
                    >
                      -{formatCurrency(discountAmount)}
                    </span>
                  </div>
                  {presentedSubtotal > 0 && (
                    <div className="flex justify-between text-[10px] text-muted-foreground">
                      <span>Equivalente</span>
                      <span className="tabular-nums" data-testid="discount-effective-equivalent">
                        {discountType === 'percent'
                          ? `${formatCurrency(discountAmount)} sobre ${formatCurrency(presentedSubtotal)}`
                          : `${((discountAmount / (presentedSubtotal || 1)) * 100).toFixed(2).replace('.', ',')}% sobre ${formatCurrency(presentedSubtotal)}`}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Negotiation Markup */}
          {items.length > 0 && setNegotiationMarkup && (
            <div className="px-4 pt-3">
              <NegotiationMarkupCard
                value={negotiationMarkup}
                onChange={setNegotiationMarkup}
                realSubtotal={realSubtotal}
                apparentDiscountPercent={
                  discountType === 'percent'
                    ? discountValue
                    : realSubtotal > 0
                      ? (discountAmount / (realSubtotal * (1 + (negotiationMarkup || 0) / 100))) *
                        100
                      : 0
                }
                realDiscountPercent={realDiscountPercent}
                maxDiscountPercent={maxDiscountPercent ?? null}
              />
            </div>
          )}

          {/* Footer — sticky bottom do scroll container */}
          <div
            data-testid="quote-builder-summary-footer"
            className="sticky bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-10 mt-3 shrink-0 space-y-2 border-t border-border/50 bg-card/95 px-4 pb-3 pt-3 shadow-[0_-16px_24px_-24px_hsl(var(--foreground)/0.55)] backdrop-blur supports-[backdrop-filter]:bg-card/85"
          >
            <div className="flex items-center justify-between text-[11px] uppercase tracking-tight text-muted-foreground">
              <span>Subtotal</span>
              <span className="font-medium tabular-nums">{formatCurrency(presentedSubtotal)}</span>
            </div>

            {discountAmount > 0 && (
              <div className="flex items-center justify-between text-[11px] text-destructive">
                <span>Desconto</span>
                <span className="font-medium tabular-nums">-{formatCurrency(discountAmount)}</span>
              </div>
            )}

            {shippingType === 'fob_pre' && shippingCost > 0 && (
              <div className="flex items-center justify-between text-[11px] font-medium text-primary">
                <span>Frete (FOB)</span>
                <span className="tabular-nums">+{formatCurrency(shippingCost)}</span>
              </div>
            )}

            <div className="flex items-baseline justify-between gap-2 border-t border-border/30 pt-1.5">
              <div>
                <span className="text-base font-bold">Total</span>
                {/* BUG-R FIX: only show per-unit price for single-product quotes;
                    dividing total by all units across different products is meaningless */}
                {items.length === 1 && items[0].quantity > 0 && (
                  <p className="text-[10px] text-muted-foreground">
                    ≈{formatCurrency(total / items[0].quantity)}/un.
                  </p>
                )}
              </div>
              <span
                data-testid="summary-total-value"
                className="text-2xl font-bold tabular-nums tracking-tight text-primary"
              >
                {formatCurrency(total)}
              </span>
            </div>

            {!isFormValid && (
              <div className="space-y-1 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2">
                <p className="flex items-center gap-1 text-xs font-semibold text-destructive">
                  <AlertTriangle className="h-3 w-3" /> Campos obrigatórios pendentes:
                </p>
                <ul className="list-inside list-disc space-y-0.5 text-xs text-destructive/80">
                  {validationErrors.includes('empresa') && <li>Empresa</li>}
                  {validationErrors.includes('contato') && <li>Contato</li>}
                  {validationErrors.includes('forma_pagamento') && <li>Forma de Pagamento</li>}
                  {validationErrors.includes('prazo_pagamento') && <li>Prazo de Pagamento</li>}
                  {validationErrors.includes('prazo_entrega') && <li>Prazo de Entrega</li>}
                  {validationErrors.includes('frete') && <li>Frete</li>}
                  {validationErrors.includes('valor_frete') && <li>Valor do Frete</li>}
                  {validationErrors.includes('itens') && <li>Itens do Orçamento</li>}
                </ul>
              </div>
            )}

            {isDiscountExceeded ? (
              <Button
                size="lg"
                data-testid="quote-request-approval-button"
                className="h-12 w-full gap-2 bg-amber-500 text-sm font-bold text-white shadow-lg shadow-amber-500/20 hover:bg-amber-600"
                onClick={() => setApprovalDialogOpen(true)}
                disabled={quotesLoading || !isFormValid}
              >
                {quotesLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Shield className="h-5 w-5" />
                )}
                Solicitar Aprovação
              </Button>
            ) : (
              <Button
                size="lg"
                className="h-12 w-full gap-2 bg-primary text-sm font-bold shadow-lg shadow-primary/20 hover:bg-primary/90"
                data-testid="quote-save-final"
                onClick={() => onSave('pending')}
                disabled={quotesLoading || !isFormValid}
              >
                {quotesLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Send className="h-5 w-5" />
                )}
                {isEditMode ? 'Salvar' : 'Criar'}
              </Button>
            )}
            <Button
              variant="outline"
              className="w-full"
              data-testid="quote-save-draft"
              onClick={() => onSave('draft')}
              disabled={quotesLoading || !isDraftValid}
            >
              {quotesLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              {isEditMode ? 'Salvar Alterações' : 'Salvar Rascunho'}
            </Button>
          </div>
        </div>
      </div>

      {/* Approval Request Dialog — SCROLL-FIX-03 via handleApprovalDialogChange */}
      <Dialog open={approvalDialogOpen} onOpenChange={handleApprovalDialogChange}>
        <DialogContent data-testid="quote-approval-dialog">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-amber-500" />
              Solicitar Aprovação de Desconto
            </DialogTitle>
            <DialogDescription>
              O desconto real de{' '}
              <span className="font-semibold text-foreground">
                {realDiscountPercent.toFixed(2).replace('.', ',')}%
              </span>{' '}
              excede seu limite de{' '}
              <span className="font-semibold text-foreground">{maxDiscountPercent}%</span>.
              Justifique o motivo para o administrador.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2 rounded-xl border border-border/40 bg-muted/50 p-3">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div data-testid="quote-approval-limit">
                  <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                    Seu Limite
                  </p>
                  <p className="mt-0.5 text-sm font-semibold">{maxDiscountPercent}%</p>
                </div>
                <div data-testid="quote-approval-requested">
                  <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                    Solicitado (real)
                  </p>
                  <p className="mt-0.5 text-sm font-bold text-amber-500">
                    {realDiscountPercent.toFixed(2).replace('.', ',')}%
                  </p>
                </div>
              </div>
              <div className="relative h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="absolute inset-y-0 left-0 rounded-full bg-emerald-500/40"
                  style={{ width: `${Math.min(maxDiscountPercent || 0, 100)}%` }}
                />
                <div
                  className="absolute inset-y-0 left-0 rounded-full bg-amber-500"
                  style={{ width: `${Math.min(realDiscountPercent, 100)}%` }}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>
                Justificativa <span className="font-normal text-muted-foreground">(opcional)</span>
              </Label>
              <Textarea
                data-testid="quote-approval-justification"
                value={sellerNotes}
                onChange={(e) => setSellerNotes(e.target.value.slice(0, 1000))}
                placeholder="Ex: Cliente estratégico, pedido de grande volume, negociação especial..."
                rows={3}
                autoFocus
                maxLength={1000}
              />
              <p className="text-right text-xs text-muted-foreground">
                {sellerNotes.length}/1000
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => handleApprovalDialogChange(false)}>
              Cancelar
            </Button>
            <Button
              data-testid="quote-approval-submit"
              className="gap-1.5 bg-amber-500 text-white hover:bg-amber-600"
              onClick={handleRequestApproval}
              disabled={quotesLoading}
            >
              {quotesLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Shield className="h-4 w-4" />
              )}
              Enviar para Aprovação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm All Stale Prices Dialog — SCROLL-FIX-03 via handleConfirmAllDialogChange */}
      <ConfirmDialog
        open={confirmAllOpen}
        onOpenChange={handleConfirmAllDialogChange}
        variant="warning"
        title="Confirmar preços com o fornecedor?"
        description={`Você está confirmando que validou ${staleCount} preço(s) diretamente com o(s) fornecedor(es). O alerta de preço defasado será removido destes itens neste orçamento.`}
        confirmText={`Confirmar ${staleCount} preço${staleCount === 1 ? '' : 's'}`}
        cancelText="Cancelar"
        onConfirm={() => {
          confirmAllStalePrices?.();
          setConfirmAllOpen(false);
          setShowOnlyStale(false);
          toast.success(`${staleCount} preço(s) confirmado(s) com fornecedor`);
        }}
      />
    </div>
  );
}
