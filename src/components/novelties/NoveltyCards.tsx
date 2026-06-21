/**
 * NoveltyCards — Grid, List, Table, and Skeleton card components for novelties.
 * Follows the same info pattern as ProductCard (catalog).
 */

import { memo, useState, useMemo, useEffect } from 'react';
import { cn } from '@/lib/utils';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Package, Building2, Clock } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { NoveltyBadge } from '@/components/products/NoveltyBadge';
import { ProductStatusBadge } from '@/components/products/ProductStatusBadge';
import {
  ProductColorSwatches,
  type ColorDotLike,
} from '@/components/products/ProductColorSwatches';
import type { NoveltyWithDetails } from '@/hooks/products/useNovelties';
import { ProductQuickActionsFAB } from '@/components/products/ProductQuickActionsFAB';
import { HoverSetImage } from '@/components/products/HoverSetImage';
import { ProductCategoryBadges } from '@/components/products/ProductCategoryBadges';
import { getSupplierColors } from '@/lib/supplier-colors';
import { getRecencyVariant } from '@/lib/novelty-dates';
import { QuickViewThumb } from '@/components/products/QuickViewThumb';
import { StockBadge } from '@/components/inventory/StockBadge';

const BRL_FORMATTER = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

interface NoveltyCardProps {
  product: NoveltyWithDetails;
  selectionMode?: boolean;
  isSelected?: boolean;
  onSelect?: (id: string) => void;
  onStatusClick?: (type: 'novelty' | 'promotion' | 'featured' | 'kit') => void;
  colors?: readonly ColorDotLike[];
  /**
   * Quando true, renderiza placeholders no lugar do preço e do estoque.
   * Útil enquanto os dados de pricing/estoque ainda estão sendo carregados
   * (ex.: hidratação assíncrona após o primeiro paint do card).
   */
  isPriceStockLoading?: boolean;
  /** Carrega imagem com alta prioridade (LCP) — true para cards above-the-fold */
  priority?: boolean;
}

// ── Skeleton ─────────────────────────────────────────────────────────────────
export function NoveltyGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex flex-col gap-2 rounded-xl border bg-card p-3">
          <Skeleton className="aspect-square w-full rounded-lg" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      ))}
    </div>
  );
}

// ── Grid Card ────────────────────────────────────────────────────────────────
export const NoveltyGridCard = memo(
  ({
    product,
    selectionMode = false,
    isSelected = false,
    onSelect,
    onStatusClick,
    colors,
    isPriceStockLoading = false,
    priority = false,
  }: NoveltyCardProps) => {
    // ISSUE-5 FIX: computar freshness ao renderizar (não do cache) — evita badge
    // "recém-chegado" exibido com dado stale por até 2 min após cruzar 5 dias.
    const fresh = getRecencyVariant(product.detected_at) === 'hot';

    // Mini-carrossel de variantes (paridade com ProductCard do catálogo): clicar
    // num swatch troca a foto principal pela imagem da variante selecionada.
    const [activeColorName, setActiveColorName] = useState<string | null>(null);
    // Reset swatch selection when a different product is rendered into the same
    // component slot (can happen in non-virtualised list views after filter change).
    useEffect(() => {
      setActiveColorName(null);
    }, [product.product_id]);
    const activeImage = useMemo(() => {
      if (!activeColorName || !colors?.length) return product.product_image;
      const match = colors.find((c) => c.name?.toLowerCase() === activeColorName.toLowerCase());
      return match?.image || product.product_image;
    }, [activeColorName, colors, product.product_image]);

    return (
      <article
        data-testid="novelty-grid-card"
        tabIndex={0}
        aria-label={`Novidade: ${product.product_name ?? 'Produto'}`}
        data-selected={isSelected}
        className={cn(
          'group relative flex cursor-pointer flex-col gap-2 rounded-xl border bg-card p-3 transition-all',
          'hover:border-primary/40 hover:shadow-md',
          // Altura FIXA por breakpoint — alinha com BaseProductGridCard/Reposição
          // (400px mobile / 430px ≥sm). Garante uniformidade entre Novidades e
          // Reposição em todos os viewports.
          'h-[400px] max-h-[400px] overflow-hidden sm:h-[430px] sm:max-h-[430px]',
          isSelected && 'border-primary ring-2 ring-primary/20',
        )}
        onClick={() => onSelect?.(product.product_id)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onSelect?.(product.product_id);
          }
        }}
      >
        {/* Selection indicator */}
        {selectionMode && (
          <div
            className={cn(
              'absolute left-2 top-2 z-20 flex h-5 w-5 items-center justify-center rounded-full border-2 transition-all',
              isSelected
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-muted-foreground bg-card',
            )}
          >
            {isSelected && (
              <svg viewBox="0 0 12 12" className="h-3 w-3" fill="none">
                <path
                  d="M2 6L5 9L10 3"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            )}
          </div>
        )}

        {/* FAB "+" — paridade total com ProductCard (Carrinho/Orçamento/Coleção/Favoritar/Comparar/QuickView/Compartilhar) */}
        {!selectionMode && (
          <ProductQuickActionsFAB
            productId={product.product_id}
            productName={product.product_name}
            productSku={product.product_sku}
            productImageUrl={activeImage}
            productPrice={product.base_price ?? 0}
            productMinQuantity={product.min_quantity || 1}
            isOutOfStock={product.stock_status === 'out-of-stock'}
          />
        )}

        {/* Image */}
        <div className="relative aspect-square overflow-hidden rounded-lg bg-muted/20">
          <QuickViewThumb
            productId={product.product_id}
            productName={product.product_name ?? 'Produto'}
            testId="novelty-grid-card-thumb"
            className="h-full w-full"
          >
            <HoverSetImage
              key={activeImage ?? product.product_image ?? 'placeholder'}
              primary={activeImage}
              // Desativa o crossfade "todas as cores" quando o usuário está navegando
              // pelas variantes — a foto da cor selecionada tem prioridade.
              set={activeColorName ? null : product.product_set_image}
              alt={product.product_name}
              fallbackIconClassName="h-8 w-8 text-muted-foreground/30"
              priority={priority}
            />
          </QuickViewThumb>
          <div className="absolute left-2 top-2 flex flex-col gap-1">
            <NoveltyBadge
              daysRemaining={product.days_remaining}
              daysElapsed={product.days_as_novelty}
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onStatusClick?.('novelty');
              }}
            />
          </div>
          {fresh && !selectionMode && (
            <div className="absolute right-2 top-2">
              <ProductStatusBadge
                type="novelty"
                value="NEW"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onStatusClick?.('novelty');
                }}
              />
            </div>
          )}
          {/* Urgência: novidade saindo da janela (≤7 dias). Mutuamente exclusiva
            com "NEW" (fresh = detectado há ≤5d). */}
          {product.status === 'expiring_soon' && !fresh && !selectionMode && (
            <div className="absolute right-2 top-2">
              <span
                data-testid="novelty-expiring-badge"
                className="inline-flex items-center gap-0.5 rounded-full bg-warning px-1.5 py-0.5 text-[9px] font-bold text-warning-foreground shadow-md"
              >
                <Clock className="h-2.5 w-2.5" />
                {product.days_remaining <= 1 ? 'Último dia' : `Últimos ${product.days_remaining}d`}
              </span>
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex flex-1 flex-col gap-1">
          {/* 1 — Categoria */}
          {product.category_id && product.category_name && (
            <ProductCategoryBadges
              category={{ id: product.category_id, name: product.category_name }}
              categoryUuid={product.category_id}
              className="flex-wrap"
            />
          )}

          {/* 2 — Fornecedor + 3 — SKU (mesma linha) */}
          {(product.supplier_name || product.product_sku) && (
            <div className="flex min-w-0 items-center justify-between gap-2">
              {product.supplier_name ? (
                <span
                  className="flex min-w-0 items-center gap-1.5 truncate rounded-lg border border-border/20 bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground sm:text-xs"
                  title={`Fornecedor: ${product.supplier_name}`}
                >
                  <Building2
                    className={cn(
                      'h-3 w-3 shrink-0',
                      getSupplierColors(product.supplier_name).text,
                    )}
                    aria-hidden="true"
                  />
                  <span className="truncate">{product.supplier_name}</span>
                </span>
              ) : (
                <span />
              )}
              {product.product_sku && (
                <span
                  className="shrink-0 truncate font-mono text-[10px] text-muted-foreground sm:text-xs"
                  aria-label={`Código do produto: ${product.product_sku}`}
                >
                  {product.product_sku}
                </span>
              )}
            </div>
          )}

          {/* 4 — Nome do produto (altura reservada para 2 linhas evita CLS no rodapé) */}
          <p
            data-testid="product-card-name"
            className="line-clamp-2 max-h-[2.4rem] min-h-[2.4rem] break-words font-display text-[11.2px] font-bold leading-tight tracking-tight sm:max-h-[2.8rem] sm:min-h-[2.8rem] sm:text-[12.8px]"
            title={product.product_name ?? undefined}
          >
            {product.product_name ?? '—'}
          </p>

          <div className="mt-0.5">
            <ProductColorSwatches
              colors={colors}
              max={5}
              size="sm"
              wrap
              hideWhenEmpty={false}
              selectedName={activeColorName}
              onSelect={(c) => setActiveColorName(c.name)}
            />
          </div>

          {/* Preço + Estoque — ancorados ao final do card; altura mínima reservada
            para não colapsar enquanto carrega ou quando os valores faltam. */}
          <div
            data-testid="novelty-card-footer"
            className="mt-auto flex min-h-[2.75rem] items-end justify-between gap-2 pt-2"
          >
            {isPriceStockLoading ? (
              <>
                <div
                  data-testid="novelty-card-price-skeleton"
                  aria-busy="true"
                  aria-label="Carregando preço"
                  className="h-4 w-20 animate-pulse rounded bg-muted"
                />
                <div
                  data-testid="novelty-card-stock-skeleton"
                  aria-label="Carregando estoque"
                  className="h-4 w-16 animate-pulse rounded bg-muted"
                />
              </>
            ) : (
              <>
                {typeof product.base_price === 'number' &&
                Number.isFinite(product.base_price) &&
                product.base_price > 0 ? (
                  <div
                    data-testid="novelty-card-price"
                    className="flex min-w-0 flex-col leading-tight"
                  >
                    <span
                      data-testid="novelty-card-price-prefix"
                      className="text-[10px] font-medium text-muted-foreground"
                    >
                      A partir de
                    </span>
                    <p className="truncate text-sm font-semibold text-primary">
                      {BRL_FORMATTER.format(product.base_price)}
                    </p>
                  </div>
                ) : (
                  <span
                    data-testid="novelty-card-price-unavailable"
                    className="text-xs italic text-muted-foreground"
                  >
                    Sob consulta
                  </span>
                )}
                <StockBadge
                  status={product.stock_status}
                  quantity={product.stock_quantity}
                  showQuantity
                  size="sm"
                />
              </>
            )}
          </div>
        </div>
      </article>
    );
  },
);

// ── Table View ───────────────────────────────────────────────────────────────
export function NoveltyTableView({
  products,
  selectionMode = false,
  selectedIds = [],
  onSelect,
  onStatusClick,
  colorsByProduct,
}: {
  products: NoveltyWithDetails[];
  selectionMode?: boolean;
  /** Aceita Set<string> (preferencial) ou string[] para retro-compatibilidade. */
  selectedIds?: Set<string> | string[];
  onSelect?: (id: string) => void;
  onStatusClick?: (type: 'novelty' | 'promotion' | 'featured' | 'kit') => void;
  colorsByProduct?: ReadonlyMap<string, readonly ColorDotLike[]>;
}) {
  // ISSUE-23 FIX: normaliza para Set uma única vez — evita O(n²) via Array.includes()
  // quando há muitos produtos selecionados. NoveltyProductGrid.tsx já tem sel.selectedIds
  // como Set; o spread [...] anterior causava Set→Array→includes() por linha.
  const selectedSet: Set<string> = selectedIds instanceof Set ? selectedIds : new Set(selectedIds);

  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            {selectionMode && <TableHead className="w-10" />}
            <TableHead className="min-w-[200px]">Produto</TableHead>
            <TableHead>SKU</TableHead>
            <TableHead>Novidade</TableHead>
            <TableHead>Preço</TableHead>
            <TableHead>Cores</TableHead>
            <TableHead>Categoria</TableHead>
            <TableHead>Fornecedor</TableHead>
            <TableHead className="text-right">Estoque</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {products.map((product) => {
            const isSelected = selectedSet.has(product.product_id);
            // ISSUE-38 FIX: tabIndex + onKeyDown — TableRow com onClick mas sem teclado
            // viola WCAG 2.1 SC 2.1.1. tr não é natively focusable/activatable.
            return (
              <TableRow
                key={product.novelty_id}
                tabIndex={0}
                aria-label={`Produto: ${product.product_name ?? 'Sem nome'}`}
                className={cn(
                  'cursor-pointer transition-colors hover:bg-muted/50',
                  isSelected && 'bg-primary/5',
                )}
                onClick={() => onSelect?.(product.product_id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelect?.(product.product_id);
                  }
                }}
              >
                {selectionMode && (
                  <TableCell className="px-2 py-1.5">
                    <div
                      className={cn(
                        'flex h-4 w-4 items-center justify-center rounded border-2',
                        isSelected ? 'border-primary bg-primary' : 'border-muted-foreground',
                      )}
                    >
                      {isSelected && (
                        <svg viewBox="0 0 12 12" className="h-2.5 w-2.5" fill="none">
                          <path
                            d="M2 6L5 9L10 3"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      )}
                    </div>
                  </TableCell>
                )}
                <TableCell className="px-2 py-1.5">
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 flex-shrink-0 overflow-hidden rounded bg-muted/20">
                      <QuickViewThumb
                        productId={product.product_id}
                        productName={product.product_name ?? 'Produto'}
                        testId="novelty-table-row-thumb"
                        className="h-full w-full"
                      >
                        {product.product_image ? (
                          <img
                            src={product.product_image}
                            alt={product.product_name}
                            onError={(e) => {
                              (e.currentTarget as HTMLImageElement).src = '/placeholder.svg';
                            }}
                            className="h-full w-full object-contain"
                            loading="lazy"
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center">
                            <Package className="h-4 w-4 text-muted-foreground/30" />
                          </div>
                        )}
                      </QuickViewThumb>
                    </div>
                    <span
                      className="line-clamp-1 text-sm font-medium"
                      title={product.product_name ?? undefined}
                    >
                      {product.product_name ?? '—'}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="px-2 py-1.5 text-xs text-muted-foreground">
                  {product.product_sku ?? '—'}
                </TableCell>
                <TableCell className="px-2 py-1.5 text-center">
                  <NoveltyBadge
                    daysRemaining={product.days_remaining}
                    daysElapsed={product.days_as_novelty}
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      onStatusClick?.('novelty');
                    }}
                  />
                </TableCell>
                <TableCell className="px-2 py-1.5 text-sm font-medium">
                  {typeof product.base_price === 'number' &&
                  Number.isFinite(product.base_price) &&
                  product.base_price > 0
                    ? BRL_FORMATTER.format(product.base_price)
                    : '—'}
                </TableCell>
                <TableCell className="px-2 py-1.5">
                  <ProductColorSwatches
                    colors={colorsByProduct?.get(product.product_id)}
                    max={5}
                    size="sm"
                    hideWhenEmpty={false}
                  />
                </TableCell>
                <TableCell className="px-2 py-1.5 text-xs text-muted-foreground">
                  {product.category_name ?? '—'}
                </TableCell>
                <TableCell className="px-2 py-1.5 text-xs text-muted-foreground">
                  {product.supplier_name ?? '—'}
                </TableCell>
                {/* ISSUE-15 FIX: usa StockBadge consistente com ProductListItem */}
                <TableCell className="px-2 py-1.5 text-right">
                  <StockBadge
                    status={product.stock_status}
                    quantity={product.stock_quantity ?? 0}
                    showQuantity
                    size="sm"
                  />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
