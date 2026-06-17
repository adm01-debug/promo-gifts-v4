import { useState, useMemo, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ChevronRight,
  Package,
  Truck,
  ChevronLeft,
  ShoppingCart,
  Search,
  X,
  Copy,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
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

/**
 * Modo de negócio: SEMPRE variação-first (1 linha = 1 SKU).
 * Não existe mais "agrupar por produto pai" — ver memo `flat-only` no inventário.
 */
const SEARCH_STORAGE_KEY = 'stock.inlineSearch';
const PAGE_STORAGE_KEY = 'stock.currentPage';
const STATUS_FILTER_STORAGE_KEY = 'stock.statusFilter';

/**
 * Chaves legadas (modo agrupar) que devem ser purgadas para evitar
 * estado obsoleto após a mudança de modelo de negócio (variação-first).
 */
const LEGACY_STORAGE_KEYS = ['stock.groupBy', 'stock.viewMode', 'stock.groupingMode'] as const;

/** Filtro rápido por status — 'all' = sem filtro. */
type StatusFilter = StockStatus | 'all';
const STATUS_FILTER_VALUES: StatusFilter[] = [
  'all',
  'in_stock',
  'low_stock',
  'critical',
  'out_of_stock',
  'overstocked',
  'incoming',
];
const STATUS_FILTER_LABEL: Record<StatusFilter, string> = {
  all: 'Todos',
  in_stock: 'Em estoque',
  low_stock: 'Baixo',
  critical: 'Crítico',
  out_of_stock: 'Esgotado',
  overstocked: 'Excesso',
  incoming: 'Chegando',
};


function readStored(key: string, fallback = ''): string {
  if (typeof window === 'undefined') return fallback;
  try {
    return window.localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}
function writeStored(key: string, value: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, value);
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
  return <span className="text-muted-foreground/30" aria-hidden="true">·</span>;
}

// ============================================
// LINHA FLAT (modo "Listar variações" — 1 SKU = 1 linha)
// ============================================

function FlatVariantRow({
  variant,
  product,
}: {
  variant: VariantStock;
  product: ProductStockSummary;
}) {
  const navigate = useNavigate();
  const isOut = variant.status === 'out_of_stock' || variant.currentStock <= 0;
  return (
    <TableRow className="group hover:bg-muted/40">
      <TableCell>
        <div className="flex items-center gap-3">
          <VariantThumb
            imageUrl={variant.imageUrl || product.productImageUrl}
            productName={product.productName}
            colorName={variant.colorName}
            colorHex={variant.colorHex}
            size="md"
          />
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
        {product.categoryName ? (
          <Badge variant="outline" className="text-[10px] font-normal">
            {product.categoryName}
          </Badge>
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
          status={variant.status}
          current={variant.currentStock}
          min={variant.minStock}
          reserved={variant.reservedStock}
          inTransit={variant.inTransitStock}
        />
      </TableCell>
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
  );
}


// ============================================
// PAGINAÇÃO
// ============================================

const PAGE_SIZE = 50;

// ============================================
// TABELA PRINCIPAL
// ============================================

interface VariantStockTableProps {
  products: ProductStockSummary[];
  className?: string;
  isLoading?: boolean;
}

export function VariantStockTable({ products, className, isLoading }: VariantStockTableProps) {
  // Modo flat-only (1 SKU = 1 linha): não há expansão de produto-pai, logo não existe
  // estado de "linhas expandidas". Toda a renderização opera sobre pagedRows (SKU-first).
  const [currentPage, setCurrentPage] = useState<number>(() => {
    const raw = readStored(PAGE_STORAGE_KEY, '0');
    const n = Number.parseInt(raw, 10);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  });
  const [inlineSearch, setInlineSearch] = useState<string>(() => readStored(SEARCH_STORAGE_KEY, ''));
  const [searchParams] = useSearchParams();
  const prevProductsLenRef = useRef(products.length);
  const deepLinkConsumedRef = useRef<string | null>(null);

  // Persiste busca inline (persistência simples no localStorage)
  useEffect(() => {
    writeStored(SEARCH_STORAGE_KEY, inlineSearch);
  }, [inlineSearch]);

  // Persiste página atual
  useEffect(() => {
    writeStored(PAGE_STORAGE_KEY, String(currentPage));
  }, [currentPage]);


  // Cleanup one-shot: purga chaves legadas do modo "Agrupar" (modelo antigo).
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

  // Reset page when product list changes (filter applied)
  useEffect(() => {
    if (prevProductsLenRef.current !== products.length) {
      setCurrentPage(0);
      prevProductsLenRef.current = products.length;
    }
  }, [products.length]);

  // Inline search filtering
  const searchedProducts = useMemo(() => {
    if (!inlineSearch.trim()) return products;
    const q = inlineSearch.toLowerCase();
    return products.filter(
      (p) =>
        p.productName.toLowerCase().includes(q) ||
        p.productSku.toLowerCase().includes(q) ||
        p.variants.some(
          (v) => v.colorName?.toLowerCase().includes(q) || v.variantSku?.toLowerCase().includes(q),
        ),
    );
  }, [products, inlineSearch]);

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
   * Modo variação-first: 1 linha = 1 SKU. A LISTA COMPLETA de linhas (todas as
   * variações de todos os produtos buscados, já filtradas por status) é a unidade
   * de paginação — assim chips, contador e linhas falam a MESMA unidade (SKU).
   * Estoque exibido é SEMPRE da variação, nunca do produto pai.
   */
  const allFlatRows = useMemo(() => {
    const rows: Array<{ product: ProductStockSummary; variant: VariantStock }> = [];
    for (const product of searchedProducts) {
      for (const variant of product.variants) {
        if (statusFilter !== 'all' && variant.status !== statusFilter) continue;
        rows.push({ product, variant });
      }
    }
    return rows;
  }, [searchedProducts, statusFilter]);

  const totalRows = allFlatRows.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / PAGE_SIZE));
  // safePage SEMPRE em [0, totalPages-1]. O Math.max(0, ...) e defense-in-depth contra
  // um currentPage negativo vindo de codigo futuro (NaN ja e barrado no init via
  // Number.isFinite; todos os setCurrentPage atuais passam valores >= 0).
  const safePage = Math.max(0, Math.min(currentPage, totalPages - 1));
  // Clamp da página fora de faixa via efeito — NUNCA setState durante o render
  // (evita warning "Cannot update a component while rendering" e re-render extra no React 18).
  useEffect(() => {
    if (currentPage > totalPages - 1) setCurrentPage(Math.max(0, totalPages - 1));
  }, [currentPage, totalPages]);

  const pagedRows = useMemo(() => {
    const start = safePage * PAGE_SIZE;
    return allFlatRows.slice(start, start + PAGE_SIZE);
  }, [allFlatRows, safePage]);

  // Deep link ?product=ID: posiciona na página que contém a 1a linha (SKU) do
  // produto, respeitando busca+filtro atuais. Consome o ID uma única vez (ref)
  // para NÃO re-arrastar o usuário a cada troca de filtro/busca.
  useEffect(() => {
    const productId = searchParams.get('product');
    if (!productId || productId === deepLinkConsumedRef.current) return;
    const rowIdx = allFlatRows.findIndex((r) => r.product.productId === productId);
    if (rowIdx >= 0) {
      setCurrentPage(Math.floor(rowIdx / PAGE_SIZE));
      deepLinkConsumedRef.current = productId;
    }
  }, [searchParams, allFlatRows]);

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
          {[...Array(10)].map((_, i) => (
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
                  {[...Array(3)].map((_, j) => (
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
              setCurrentPage(0);
            }}
            className="h-8 pl-8 text-sm"
          />
          {inlineSearch && (
            <button
              type="button"
              onClick={() => setInlineSearch('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>

        {/* Chips de filtro por status — sincroniza com grouped/flat e persiste. */}
        <div
          className="flex flex-wrap items-center gap-1"
          role="group"
          aria-label="Filtrar por status de estoque"
          data-testid="stock-status-filter"
        >
          {STATUS_FILTER_VALUES.map((value) => {
            const active = statusFilter === value;
            const count = statusCounts[value] ?? 0;
            const disabled = value !== 'all' && count === 0;
            return (
              <Button
                key={value}
                type="button"
                variant={active ? 'secondary' : 'ghost'}
                size="sm"
                disabled={disabled}
                aria-pressed={active}
                data-testid={`stock-status-chip-${value}`}
                onClick={() => {
                  setStatusFilter(value);
                  setCurrentPage(0);
                }}
                className="h-6 gap-1 px-2 text-[11px]"
              >
                <span>{STATUS_FILTER_LABEL[value]}</span>
                <span className="rounded-sm bg-muted px-1 text-[10px] text-muted-foreground">
                  {count}
                </span>
              </Button>
            );
          })}
        </div>


        <div className="flex items-center gap-2">
          {/* Pagination info */}
          <span className="whitespace-nowrap text-xs text-muted-foreground">
            {totalRows > PAGE_SIZE ? (
              <>
                {safePage * PAGE_SIZE + 1}–
                {Math.min((safePage + 1) * PAGE_SIZE, totalRows)} de {totalRows} variações
              </>
            ) : (
              <>
                {totalRows} {totalRows === 1 ? 'variação' : 'variações'}
              </>
            )}

          </span>

          {/* Modelo de negócio: variação-first. Toggle de "Agrupar" removido. */}
        </div>
      </div>


      <div
        data-testid="variant-stock-scroll"
        className="overflow-x-auto rounded-lg border [contain:content] [-webkit-overflow-scrolling:touch] [overscroll-behavior-x:contain]"
      >
        <Table className="min-w-[700px]">
          <TableHeader
            data-testid="variant-stock-thead"
            className="sticky top-[44px] z-10 bg-background shadow-[0_1px_0_0_hsl(var(--border))] sm:top-[40px]"
          >
            <TableRow className="bg-muted/50">
              <TableHead className="w-[280px]">Variação / Cor</TableHead>
              <TableHead className="hidden w-[120px] md:table-cell">Categoria</TableHead>
              <TableHead>Estoque</TableHead>
              

              
              
              <TableHead className="hidden md:table-cell">Em Trânsito</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="hidden sm:table-cell">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pagedRows.length > 0 ? (
              pagedRows.map(({ product, variant }) => (
                <FlatVariantRow
                  key={`${product.productId}::${variant.id}`}
                  product={product}
                  variant={variant}
                />
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={6} className="py-16 text-center text-muted-foreground">
                  <div className="flex flex-col items-center">
                    <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted/50">
                      <Package className="h-8 w-8 opacity-30" />
                    </div>
                    <p className="mb-1 font-semibold text-foreground">Nenhuma variação encontrada</p>
                    <p className="max-w-xs text-sm">
                      {inlineSearch
                        ? `Nenhum resultado para "${inlineSearch}". Tente outro termo.`
                        : 'Ajuste os filtros para visualizar os SKUs.'}
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
            disabled={safePage === 0}
            className="gap-1"
          >
            <ChevronLeft className="h-4 w-4" />
            Anterior
          </Button>
          <div className="flex items-center gap-1">
            {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
              let pageNum: number;
              if (totalPages <= 7) {
                pageNum = i;
              } else if (safePage < 3) {
                pageNum = i;
              } else if (safePage > totalPages - 4) {
                pageNum = totalPages - 7 + i;
              } else {
                pageNum = safePage - 3 + i;
              }
              return (
                <Button
                  key={pageNum}
                  variant={pageNum === safePage ? 'default' : 'ghost'}
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={() => setCurrentPage(pageNum)}
                >
                  {pageNum + 1}
                </Button>
              );
            })}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={safePage >= totalPages - 1}
            className="gap-1"
          >
            Próximo
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}

export default VariantStockTable;
