/**
 * ProductTableView — Tabela compacta para análise comparativa rápida.
 * Mostra SKU, nome, fornecedor, preço, estoque e cores em colunas.
 *
 * ✅ PARIDADE COM GRID: Todas as ações rápidas do ProductCard (Grid)
 *    estão implementadas aqui com a mesma arquitetura de variante/cor:
 *    Favoritar, Comparar, Coleção, Share, Orçamento, Carrinho, QuickView
 * ✅ PERFORMANCE 10/10: Virtualização implementada para suportar 15.000+ itens.
 */
import { memo, useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown, Loader2 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useVirtualizer } from '@tanstack/react-virtual';
import { TableRowActions } from './table-view/TableRowActions';
import {
  resolveColorImage,
  resolveColorStock,
  getActiveColorName,
  type ActiveColorFilter,
} from '@/utils/color-image-resolver';
import { useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';

import { cn } from '@/lib/utils';
// FIX: import direto em vez do barrel @/hooks/products — evita dependência circular (TDZ)
import type { ExternalVariantStock } from '@/hooks/products/useExternalVariantStock';
import type { Product } from '@/types/product-catalog';
// Collator pt-BR compartilhado: mesma ordenação natural/acento-insensível do grid/lista
// (apenas type-imports em runtime → sem ciclo). Evita localeCompare sem locale e null-throw.
import { compareNamePtBR } from '@/utils/product-sorting';
import { getCdnUrl } from '@/utils/image-utils';
import { SelectionCheckbox } from '@/components/common/SelectionCheckbox';
import { ProductColorSwatches } from './ProductColorSwatches';
import { useProductSelectionStore } from '@/stores/useProductSelectionStore';

type SkeletonRow = { id: string; isSkeleton: true };
function isSkeletonRow(row: Product | SkeletonRow): row is SkeletonRow {
  return 'isSkeleton' in row;
}
import { VariantPickerDialog, type VariantActionMode } from './VariantPickerDialog';
import { AddToCollectionModal } from '@/components/collections/AddToCollectionModal';
import { ProductQuickView } from './ProductQuickView';
import { SharePreviewDialog } from './share/SharePreviewDialog';
import { useFavoritesStore } from '@/stores/useFavoritesStore';
import { useComparisonStore } from '@/stores/useComparisonStore';
import { PriceFreshnessBadge } from './PriceFreshnessBadge';
import { toast } from 'sonner';
import { showErrorToast } from '@/utils/undoToast';
// FIX(catalog-table-cores): hidratacao de cores client-side — mesmo SSOT do grid/lista.
import { useProductsColorsBatch } from '@/hooks/products/useProductsColorsBatch';

interface ProductTableViewProps {
  products: Product[];
  isLoading?: boolean;
  onProductClick?: (productId: string) => void;
  isFavorite?: (id: string) => boolean;
  onToggleFavorite?: (id: string) => void;
  isInCompare?: (id: string) => boolean;
  onToggleCompare?: (id: string) => { added: boolean; isFull: boolean };
  canAddToCompare?: boolean;
  onShareProduct?: (product: Product) => void;
  highlightColors?: string[];
  activeColorFilter?: ActiveColorFilter | null;
  selectionMode?: boolean;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
  // Infinite scroll support
  hasMore?: boolean;
  isLoadingMore?: boolean;
  totalEstimate?: number | null;
  filteredCount?: number;
  loadMoreRef?: React.RefObject<HTMLDivElement>;
  itemsPerPage?: number;
  onLoadMore?: () => void;
  // GAP-20 FIX: chave de reset de scroll (mesma de useCatalogState/VirtualizedProductGrid).
  // Quando muda (filtro/sort/view), reseta o scrollTop do container interno da tabela ao topo.
  scrollResetKey?: string;
}

type SortCol = 'name' | 'price' | 'sku' | 'stock' | 'supplier';
type SortDir = 'asc' | 'desc';

// BUG-TVW-01 FIX (2026-06-21): Intl.NumberFormat era recriado em cada chamada de formatPrice
// (potencialmente centenas de vezes por render em tabelas virtualizadas). Mover para módulo.
const tablePriceFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const formatPrice = (price: number) => {
  const formatted = tablePriceFormatter.format(price);

  const parts = formatted.split(/\s/);
  if (parts.length >= 2) {
    return (
      <span className="flex items-baseline justify-end gap-1">
        <span className="text-[9px] font-medium text-muted-foreground/50">R$</span>
        <span>{parts[parts.length - 1]}</span>
      </span>
    );
  }
  return formatted;
};

const stockColor = (status: string) => {
  if (status === 'in-stock') return 'text-success';
  if (status === 'low-stock') return 'text-warning';
  return 'text-destructive';
};

const CONTAINER_CLASS =
  'h-[calc(100vh-200px)] min-h-[550px] overflow-y-auto rounded-xl border border-border/40 bg-background scrollbar-products shadow-sm';

function SortHeader({
  label,
  col,
  activeCol,
  activeDir,
  onSort,
  className,
}: {
  label: string;
  col: SortCol;
  activeCol: SortCol;
  activeDir: SortDir;
  onSort: (col: SortCol) => void;
  className?: string;
}) {
  const isActive = activeCol === col;
  return (
    <button
      className={cn(
        'flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground transition-colors hover:text-foreground',
        isActive && 'text-primary',
        className,
      )}
      onClick={() => onSort(col)}
    >
      {label}
      {isActive ? (
        activeDir === 'asc' ? (
          <ArrowUp className="h-3 w-3" />
        ) : (
          <ArrowDown className="h-3 w-3" />
        )
      ) : (
        <ArrowUpDown className="h-3 w-3 opacity-40" />
      )}
    </button>
  );
}

export const ProductTableView = memo(
  ({
    products,
    isLoading = false,
    onProductClick,
    isFavorite,
    onToggleFavorite,
    isInCompare,
    onToggleCompare,
    canAddToCompare = true,
    onShareProduct,
    highlightColors: _highlightColors = [],
    activeColorFilter,
    selectionMode,
    selectedIds,
    onToggleSelect,
    hasMore,
    isLoadingMore,
    totalEstimate,
    filteredCount,
    loadMoreRef,
    itemsPerPage: _itemsPerPage,
    onLoadMore,
    scrollResetKey,
  }: ProductTableViewProps) => {
    const navigate = useNavigate();
    const parentRef = useRef<HTMLDivElement>(null);

    // GAP-20 FIX: a tabela usa um virtualizer ELEMENT-scoped (container overflow-y-auto
    // de altura fixa), então é imune ao snap-back de carga progressiva — mas, ao contrário
    // do grid/list (que rolam a window ao topo via scrollResetKey), seu scrollTop interno
    // NÃO era resetado ao trocar filtro/sort/view: o usuário rolado para baixo permanecia
    // numa posição arbitrária (ou no fim, pelo clamp do browser) do novo conjunto. Resetamos
    // o scrollTop ao topo SOMENTE quando scrollResetKey muda — nunca durante a carga
    // progressiva (load-more não altera scrollResetKey), preservando o scroll do usuário.
    useEffect(() => {
      if (parentRef.current) parentRef.current.scrollTop = 0;
    }, [scrollResetKey]);
    const [sortCol, setSortCol] = useState<SortCol>('name');
    const [sortDir, setSortDir] = useState<SortDir>('asc');

    // Shared variant picker state
    const [variantPickerOpen, setVariantPickerOpen] = useState(false);
    const [variantPickerMode, setVariantPickerMode] = useState<VariantActionMode>('favorite');
    const [variantPickerProduct, setVariantPickerProduct] = useState<Product | null>(null);

    // Modal states
    const [collectionModalOpen, setCollectionModalOpen] = useState(false);
    const [collectionProduct, setCollectionProduct] = useState<Product | null>(null);
    const [collectionVariant, setCollectionVariant] = useState<
      | {
          color_name?: string | null;
          color_hex?: string | null;
          variant_id?: string | null;
          thumbnail?: string | null;
        }
      | undefined
    >(undefined);
    const [quickViewOpen, setQuickViewOpen] = useState(false);
    const [quickViewProduct, setQuickViewProduct] = useState<Product | null>(null);
    const quickViewTriggerRef = useRef<HTMLElement | null>(null);
    const [shareDialogOpen, setShareDialogOpen] = useState(false);
    const [shareProduct, setShareProduct] = useState<Product | null>(null);
    const [shareVariant, setShareVariant] = useState<{
      variantName?: string | null;
      colorHex?: string | null;
      thumbnailUrl?: string | null;
    } | null>(null);

    const favStore = useFavoritesStore();
    const compStore = useComparisonStore();
    // SSOT por-produto: mapa de cor selecionada (zustand global), idêntico ao Card/Lista.
    const selectedColorsMap = useProductSelectionStore((s) => s.selectedColors);
    const setSelectedColor = useProductSelectionStore((s) => s.setSelectedColor);
    // Persiste a cor selecionada na URL (mesma estratégia do ProductCard) e atualiza o store.
    const selectColorWithUrl = useCallback(
      (productId: string, colorName: string) => {
        setSelectedColor(productId, colorName);
        if (typeof window === 'undefined') return;
        const url = new URL(window.location.href);
        url.searchParams.set('cor', colorName);
        url.searchParams.set('pid', productId);
        window.history.replaceState({}, '', url.toString());
      },
      [setSelectedColor],
    );
    const clearSelectedColor = useCallback((productId: string) => {
      useProductSelectionStore.setState((state) => {
        const next = { ...state.selectedColors };
        delete next[productId];
        return { selectedColors: next };
      });
      if (typeof window === 'undefined') return;
      const url = new URL(window.location.href);
      if (url.searchParams.get('pid') === productId) {
        url.searchParams.delete('cor');
        url.searchParams.delete('pid');
        window.history.replaceState({}, '', url.toString());
      }
    }, []);

    // FIX(catalog-table-cores): o fetch lightweight do catalogo NAO traz `colors`
    // (chega `[]`), entao a tabela caia no placeholder "–". Grid/Lista ja hidratam
    // via useProductsColorsBatch (SSOT, cache global compartilhado). Replicamos o
    // MESMO padrao aqui para exibir os swatches na coluna CORES — sem alterar o
    // restante da UI nem o caminho de filtro por cor.
    const idsNeedingColors = useMemo(
      () => products.filter((p) => !p.colors || p.colors.length === 0).map((p) => p.id),
      [products],
    );
    const { data: colorsByProduct } = useProductsColorsBatch(idsNeedingColors);
    const hydratedProducts = useMemo(() => {
      if (colorsByProduct.size === 0) return products;
      return products.map((p) => {
        if (p.colors && p.colors.length > 0) return p;
        const batch = colorsByProduct.get(p.id);
        if (!batch || batch.length === 0) return p;
        return {
          ...p,
          // FIX-COLOR-SEL-01 (tabela): idem VirtualizedProductGrid — image e stock incluídos.
          colors: batch.map((c) => ({
            name: c.name,
            hex: c.hex || '',
            group: '',
            image: c.image || undefined,
            stock: c.stockQty,
          })),
        };
      });
    }, [products, colorsByProduct]);

    const handleSort = useCallback(
      (col: SortCol) => {
        if (sortCol === col) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
        else {
          setSortCol(col);
          setSortDir('asc');
        }
      },
      [sortCol],
    );

    const sorted = useMemo(() => {
      if (isLoading && products.length === 0) {
        return Array.from({ length: 12 }).map(
          (_, i): SkeletonRow => ({ id: `skeleton-${i}`, isSkeleton: true }),
        );
      }
      return [...hydratedProducts].sort((a, b) => {
        const dir = sortDir === 'asc' ? 1 : -1;
        // Desempate determinístico por id (independente de dir) → ordem estável
        // entre renders com virtualização + carregamento progressivo.
        const idTie = a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
        let primary = 0;
        switch (sortCol) {
          case 'name':
            primary = compareNamePtBR(a.name, b.name);
            break;
          case 'sku':
            primary = compareNamePtBR(a.sku, b.sku);
            break;
          case 'price':
            primary = (a.price || 0) - (b.price || 0);
            break;
          case 'stock':
            primary = (a.stock || 0) - (b.stock || 0);
            break;
          case 'supplier':
            primary = compareNamePtBR(a.supplier?.name, b.supplier?.name);
            break;
          default:
            return idTie;
        }
        return primary !== 0 ? dir * primary : idTie;
      });
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [hydratedProducts, sortCol, sortDir]);

    const virtualizer = useVirtualizer({
      count: sorted.length + (hasMore ? 1 : 0),
      getScrollElement: () => parentRef.current,
      estimateSize: () => 56,
      overscan: 10,
    });

    // Infinite scroll
    useEffect(() => {
      const el = parentRef.current;
      if (!el || !hasMore || isLoadingMore || !onLoadMore) return;
      const handleScroll = () => {
        if (el.scrollHeight - el.scrollTop - el.clientHeight < 400) onLoadMore();
      };
      el.addEventListener('scroll', handleScroll, { passive: true });
      return () => el.removeEventListener('scroll', handleScroll);
    }, [hasMore, isLoadingMore, onLoadMore]);

    const openVariantPicker = useCallback((product: Product, mode: VariantActionMode) => {
      setVariantPickerProduct(product);
      setVariantPickerMode(mode);
      setVariantPickerOpen(true);
    }, []);

    const handleVariantComplete = useCallback(
      (variant: ExternalVariantStock | null) => {
        if (!variantPickerProduct) return;
        const variantInfo = variant
          ? {
              color_name: variant.color_name,
              color_hex: variant.color_hex,
              size_code: variant.size_code,
              variant_id: variant.id,
              thumbnail: variant.selected_thumbnail,
            }
          : undefined;

        if (variantPickerMode === 'favorite') {
          favStore.addFavorite(variantPickerProduct.id, variantInfo);
          toast.success(
            `"${variantPickerProduct.name}" favoritado${variant?.color_name ? ` — ${variant.color_name}` : ''}`,
          );
        } else if (variantPickerMode === 'compare') {
          const result = compStore.addToCompare(variantPickerProduct.id, variantInfo);
          if (!result) showErrorToast({ title: 'Limite de 4 produtos para comparação atingido' });
          else
            toast.success(
              `"${variantPickerProduct.name}" adicionado à comparação${variant?.color_name ? ` — ${variant.color_name}` : ''}`,
            );
        } else if (variantPickerMode === 'collection') {
          setCollectionProduct(variantPickerProduct);
          setCollectionVariant(variantInfo);
          setCollectionModalOpen(true);
        } else if (variantPickerMode === 'quote') {
          const params = new URLSearchParams({
            product_id: variantPickerProduct.id,
            product_name: variantPickerProduct.name,
            product_sku: variantPickerProduct.sku || '',
            product_price: String(variantPickerProduct.price ?? 0),
          });
          if (variant?.color_name) params.set('color_name', variant.color_name);
          if (variant?.color_hex) params.set('color_hex', variant.color_hex);
          if (variant?.selected_thumbnail) params.set('product_image', variant.selected_thumbnail);
          setTimeout(() => navigate(`/orcamentos/novo?${params.toString()}`), 0);
        } else if (variantPickerMode === 'share') {
          setShareProduct(variantPickerProduct);
          setShareVariant(
            variant
              ? {
                  variantName: variant.color_name,
                  colorHex: variant.color_hex,
                  thumbnailUrl: variant.selected_thumbnail,
                }
              : null,
          );
          setShareDialogOpen(true);
        }
      },
      [variantPickerMode, variantPickerProduct, favStore, compStore, navigate],
    );

    return (
      <div ref={parentRef} className={CONTAINER_CLASS}>
        <div className="min-w-0">
          {/* Sticky Header */}
          <div className="sticky top-0 z-20 flex items-center border-b border-border/50 bg-muted/90 px-4 py-2.5 shadow-sm backdrop-blur-md">
            {selectionMode && <div className="w-10 px-2" />}
            <div className="hidden w-40 px-3 lg:block">
              <SortHeader
                label="Fornecedor"
                col="supplier"
                activeCol={sortCol}
                activeDir={sortDir}
                onSort={handleSort}
              />
            </div>
            <div className="w-12 px-2" />
            <div className="flex-1 px-3">
              <SortHeader
                label="Produto"
                col="name"
                activeCol={sortCol}
                activeDir={sortDir}
                onSort={handleSort}
              />
            </div>
            <div className="hidden w-32 px-3 md:block">
              <SortHeader
                label="SKU"
                col="sku"
                activeCol={sortCol}
                activeDir={sortDir}
                onSort={handleSort}
              />
            </div>
            <div className="hidden w-32 px-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground sm:block">
              Cores
            </div>
            <div className="w-32 px-3 text-right">
              <SortHeader
                label="Estoque"
                col="stock"
                activeCol={sortCol}
                activeDir={sortDir}
                onSort={handleSort}
                className="justify-end"
              />
            </div>
            <div className="w-32 px-3 text-right">
              <SortHeader
                label="Preço"
                col="price"
                activeCol={sortCol}
                activeDir={sortDir}
                onSort={handleSort}
                className="justify-end"
              />
            </div>
            <div className="w-48 shrink-0 px-1 text-center text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Ações
            </div>
          </div>

          {/* Virtual Body */}
          <div style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative' }}>
            {virtualizer.getVirtualItems().map((vr) => {
              const product = sorted[vr.index];
              if (!product) {
                return (
                  <div
                    key="loader"
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      transform: `translateY(${vr.start}px)`,
                    }}
                    className="flex flex-col items-center gap-2 py-8"
                  >
                    <p className="text-xs text-muted-foreground">
                      Mostrando {sorted.length} de{' '}
                      {(totalEstimate ?? filteredCount ?? sorted.length).toLocaleString('pt-BR')}{' '}
                      produtos
                    </p>
                    {isLoadingMore && <Loader2 className="h-5 w-5 animate-spin text-primary" />}
                    <div ref={loadMoreRef} className="h-1" />
                  </div>
                );
              }

              if (isSkeletonRow(product)) {
                return (
                  <div
                    key={vr.key}
                    data-index={vr.index}
                    ref={virtualizer.measureElement}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      transform: `translateY(${vr.start}px)`,
                    }}
                    className="flex h-14 items-center border-b border-border/30 px-4"
                  >
                    {selectionMode && (
                      <div className="flex w-10 justify-center px-2">
                        <Skeleton className="h-4 w-4 rounded" />
                      </div>
                    )}
                    <div className="hidden w-40 px-3 lg:block">
                      <Skeleton className="h-3 w-24" />
                    </div>
                    <div className="w-12 px-2">
                      <Skeleton className="h-10 w-10 rounded-md" />
                    </div>
                    <div className="flex-1 space-y-2 px-3">
                      <Skeleton className="h-4 w-48" />
                      <Skeleton className="h-3 w-32" />
                    </div>
                    <div className="hidden w-32 px-3 md:block">
                      <Skeleton className="h-3 w-20" />
                    </div>
                    <div className="hidden w-32 gap-1 px-3 sm:flex">
                      {[1, 2, 3].map((i) => (
                        <Skeleton key={i} className="h-3.5 w-3.5 rounded-full" />
                      ))}
                    </div>
                    <div className="w-32 px-3 text-right">
                      <Skeleton className="ml-auto h-4 w-12" />
                    </div>
                    <div className="w-32 px-3 text-right">
                      <Skeleton className="ml-auto h-4 w-16" />
                    </div>
                    <div className="flex w-48 justify-center gap-2 px-3">
                      {[1, 2, 3].map((i) => (
                        <Skeleton key={i} className="h-8 w-8 rounded-full" />
                      ))}
                    </div>
                  </div>
                );
              }

              // Cor selecionada manualmente pelo usuário nesta linha (store global, SSOT).
              const userSelectedColorName = selectedColorsMap[product.id] || null;
              const userSelectedColor =
                userSelectedColorName && product.colors?.length
                  ? product.colors.find(
                      (c) => c.name.toLowerCase() === userSelectedColorName.toLowerCase(),
                    ) || null
                  : null;
              // primary_image_url (é a imagem com is_primary=true, campo canônico) — exibida primeiro
              const colorSpecificImage = resolveColorImage(product, activeColorFilter);
              const rawImg =
                (userSelectedColor as { image?: string | null } | null)?.image ||
                colorSpecificImage ||
                product.primary_image_url ||
                product.og_image_url ||
                product.images[0] ||
                null;
              const thumbUrl = rawImg ? getCdnUrl(rawImg, 'card') : '/placeholder.svg';
              const colorStock = resolveColorStock(
                product,
                activeColorFilter,
                userSelectedColorName,
              );
              const displayStock = colorStock?.stock ?? product.stock;
              const displayStatus = colorStock?.stockStatus ?? product.stockStatus;
              const activeColorName =
                userSelectedColorName || getActiveColorName(product, activeColorFilter);
              const isSelected = selectionMode && selectedIds?.has(product.id);

              return (
                <div
                  key={vr.key}
                  data-index={vr.index}
                  ref={virtualizer.measureElement}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    transform: `translateY(${vr.start}px)`,
                  }}
                  className={cn(
                    'group flex h-14 cursor-pointer items-center border-b border-border/30 px-4 transition-colors hover:bg-accent/30',
                    isSelected && 'bg-primary/5',
                  )}
                  onClick={() =>
                    selectionMode
                      ? onToggleSelect?.(product.id)
                      : onProductClick
                        ? onProductClick(product.id)
                        : navigate(`/produto/${product.id}`)
                  }
                >
                  {selectionMode && (
                    <div className="flex w-10 justify-center px-2">
                      <SelectionCheckbox
                        checked={!!isSelected}
                        onChange={() => onToggleSelect?.(product.id)}
                        size="sm"
                      />
                    </div>
                  )}

                  <div className="hidden w-40 truncate px-3 text-xs text-muted-foreground lg:block">
                    {product.supplier?.name}
                  </div>

                  <div className="w-12 px-2">
                    <div
                      role="button"
                      tabIndex={0}
                      aria-label={`Visualização rápida de ${product.name}`}
                      aria-haspopup="dialog"
                      aria-expanded={quickViewOpen && quickViewProduct?.id === product.id}
                      data-testid="product-table-row-thumb"
                      data-product-id={product.id}
                      className="group/thumb h-10 w-10 cursor-zoom-in overflow-hidden rounded-md border border-border/30 bg-muted/30 outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      style={{ touchAction: 'manipulation' }}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (
                          variantPickerOpen ||
                          collectionModalOpen ||
                          shareDialogOpen ||
                          quickViewOpen
                        ) {
                          return;
                        }
                        quickViewTriggerRef.current = e.currentTarget;
                        setQuickViewProduct(product);
                        setQuickViewOpen(true);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          e.stopPropagation();
                          if (
                            variantPickerOpen ||
                            collectionModalOpen ||
                            shareDialogOpen ||
                            quickViewOpen
                          ) {
                            return;
                          }
                          quickViewTriggerRef.current = e.currentTarget;
                          setQuickViewProduct(product);
                          setQuickViewOpen(true);
                        }
                      }}
                    >
                      <img
                        src={thumbUrl}
                        alt=""
                        className="h-full w-full object-contain transition-transform duration-300 group-hover/thumb:scale-105"
                        loading="lazy"
                      />
                    </div>
                  </div>

                  <div className="min-w-0 flex-1 px-3">
                    <p className="truncate text-[13px] font-medium text-foreground transition-colors group-hover:text-primary">
                      {product.name}
                    </p>
                    <div className="flex items-center gap-2">
                      <p className="text-[10px] text-muted-foreground md:hidden">{product.sku}</p>
                      {activeColorName && (
                        <Badge
                          variant="outline"
                          className="h-4 border-primary/30 px-1.5 py-0 text-[9px] text-primary/80"
                        >
                          {activeColorName}
                        </Badge>
                      )}
                    </div>
                  </div>

                  <div className="hidden w-32 truncate px-3 font-mono text-xs text-muted-foreground md:block">
                    {product.sku}
                  </div>

                  <div
                    className="hidden w-44 items-center gap-1.5 px-3 sm:flex"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {product.colors.length > 0 ? (
                      <ProductColorSwatches
                        colors={product.colors.map((c) => ({
                          name: c.name,
                          hex: c.hex ?? null,
                          image: (c as { image?: string | null }).image ?? null,
                        }))}
                        max={5}
                        size="sm"
                        hideWhenEmpty={false}
                        selectedName={userSelectedColorName}
                        onSelect={(c) => selectColorWithUrl(product.id, c.name)}
                        onClear={() => clearSelectedColor(product.id)}
                      />
                    ) : (
                      <div className="h-1 w-2 rounded-full bg-muted-foreground/20" />
                    )}
                  </div>

                  <div
                    className={cn(
                      'flex w-32 items-center justify-end gap-1.5 px-3 text-right text-[11px] font-bold tracking-tight',
                      stockColor(displayStatus),
                    )}
                    data-testid="product-stock-value"
                    data-stock-qty={displayStock ?? 0}
                  >
                    <div
                      className={cn(
                        'h-1.5 w-1.5 rounded-full',
                        displayStatus === 'in-stock'
                          ? 'animate-pulse bg-success'
                          : displayStatus === 'low-stock'
                            ? 'bg-warning'
                            : 'bg-destructive',
                      )}
                    />
                    {(displayStock || 0).toLocaleString('pt-BR')}
                  </div>

                  <div className="inline-flex w-32 items-center justify-end gap-1 px-3 text-right text-[13px] font-bold">
                    {formatPrice(product.price)}
                    <PriceFreshnessBadge
                      priceUpdatedAt={product.priceUpdatedAt}
                      variant="icon-only"
                    />
                  </div>

                  <div className="w-48 shrink-0 px-1">
                    <TableRowActions
                      product={product}
                      isFavorite={isFavorite?.(product.id) || false}
                      isInCompare={isInCompare?.(product.id) || false}
                      canAddToCompare={canAddToCompare}
                      onToggleFavorite={onToggleFavorite}
                      onToggleCompare={onToggleCompare}
                      onOpenVariantPicker={openVariantPicker}
                      onOpenQuickView={(p) => {
                        setQuickViewProduct(p);
                        setQuickViewOpen(true);
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Global Dialogs */}
        {variantPickerProduct && (
          <VariantPickerDialog
            open={variantPickerOpen}
            onOpenChange={setVariantPickerOpen}
            productId={variantPickerProduct.id}
            productName={variantPickerProduct.name}
            mode={variantPickerMode}
            onComplete={handleVariantComplete}
          />
        )}
        {collectionProduct && (
          <AddToCollectionModal
            open={collectionModalOpen}
            onOpenChange={setCollectionModalOpen}
            productId={collectionProduct.id}
            productName={collectionProduct.name}
            variant={collectionVariant}
          />
        )}
        {quickViewProduct && (
          <ProductQuickView
            product={quickViewProduct}
            open={quickViewOpen}
            onOpenChange={(open) => {
              setQuickViewOpen(open);
              if (!open) {
                requestAnimationFrame(() => {
                  quickViewTriggerRef.current?.focus({ preventScroll: true });
                });
              }
            }}
            isFavorited={isFavorite?.(quickViewProduct.id) || false}
            onToggleFavorite={onToggleFavorite}
            isInCompare={isInCompare?.(quickViewProduct.id) || false}
            onToggleCompare={onToggleCompare}
            onShare={onShareProduct}
            onAddToQuote={(p) => {
              setVariantPickerProduct(p);
              setVariantPickerMode('quote');
              setVariantPickerOpen(true);
            }}
            onAddToCollection={(p) => {
              setVariantPickerProduct(p);
              setVariantPickerMode('collection');
              setVariantPickerOpen(true);
            }}
          />
        )}
        {shareProduct && (
          <SharePreviewDialog
            open={shareDialogOpen}
            onOpenChange={setShareDialogOpen}
            product={shareProduct}
            selectedVariant={shareVariant}
          />
        )}
      </div>
    );
  },
);

ProductTableView.displayName = 'ProductTableView';
