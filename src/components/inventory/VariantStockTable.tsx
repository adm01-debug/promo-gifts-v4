import { useState, useMemo, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ChevronDown,
  ChevronRight,
  Package,
  Clock,
  Truck,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  TrendingDown,
  TrendingUp,
  ChevronLeft,
  ExternalLink,
  ShoppingCart,
  Search,
  X,
  Copy,
  LayoutList,
  Rows3,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { type ProductStockSummary, type VariantStock, type StockStatus, calculateStockStatus } from '@/types/stock';
import { ProductColorSwatches } from '@/components/products/ProductColorSwatches';
import { VariantThumb, RichColorSwatch, StockStatusChip } from './VariantStockVisuals';

/** Modos de agrupamento da tabela. Persistido em localStorage. */
type GroupingMode = 'grouped' | 'flat';
const GROUPING_STORAGE_KEY = 'stock.groupBy';
const SEARCH_STORAGE_KEY = 'stock.inlineSearch';
const PAGE_STORAGE_KEY = 'stock.currentPage';
const STATUS_FILTER_STORAGE_KEY = 'stock.statusFilter';

/** Filtro rápido por status — 'all' = sem filtro. */
type StatusFilter = StockStatus | 'all';
const STATUS_FILTER_VALUES: StatusFilter[] = [
  'all',
  'in_stock',
  'low_stock',
  'critical',
  'out_of_stock',
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
// CONFIGURAÇÕES DE STATUS
// ============================================

const STATUS_CONFIG: Record<
  StockStatus,
  {
    label: string;
    color: string;
    bgColor: string;
    icon: React.ReactNode;
  }
> = {
  in_stock: {
    label: 'Em Estoque',
    color: 'text-success',
    bgColor: 'bg-success/10 border-success/20',
    icon: <CheckCircle2 className="h-4 w-4" />,
  },
  low_stock: {
    label: 'Estoque baixo',
    color: 'text-warning',
    bgColor: 'bg-warning/10 border-warning/20',
    icon: <TrendingDown className="h-4 w-4" />,
  },
  critical: {
    label: 'Crítico',
    color: 'text-destructive',
    bgColor: 'bg-destructive/10 border-destructive/20',
    icon: <AlertTriangle className="h-4 w-4" />,
  },
  out_of_stock: {
    label: 'Esgotado',
    color: 'text-destructive',
    bgColor: 'bg-destructive/10 border-destructive/20',
    icon: <XCircle className="h-4 w-4" />,
  },
  overstocked: {
    label: 'Excesso',
    color: 'text-primary',
    bgColor: 'bg-primary/10 border-primary/20',
    icon: <TrendingUp className="h-4 w-4" />,
  },
  incoming: {
    label: 'Chegando',
    color: 'text-primary/80',
    bgColor: 'bg-primary/10 border-primary/15',
    icon: <Truck className="h-4 w-4" />,
  },
};

// ============================================
// COMPONENTES AUXILIARES
// ============================================

function StockStatusBadge({ status }: { status: StockStatus }) {
  const config = STATUS_CONFIG[status];
  return (
    <Badge variant="outline" className={cn('gap-1', config.bgColor, config.color)}>
      {config.icon}
      <span className="hidden sm:inline">{config.label}</span>
    </Badge>
  );
}

function ColorSwatch({ hex, name }: { hex?: string; name?: string }) {
  return (
    <div className="flex items-center gap-2">
      {hex ? (
        <div
          className="h-5 w-5 rounded-full border border-border shadow-sm"
          style={{ backgroundColor: hex }}
          title={name}
        />
      ) : (
        <div className="h-5 w-5 rounded-full border border-dashed border-muted-foreground/50" />
      )}
      <span className="text-sm">{name || 'Sem cor'}</span>
    </div>
  );
}

function StockProgressBar({ current, min }: { current: number; min: number; max?: number }) {
  const percentage = min > 0 ? Math.min((current / min) * 100, 100) : current > 0 ? 100 : 0;

  // Derivação via fonte única (calculateStockStatus em '@/types/stock'); rótulo+cor
  // co-localizados a esta tabela de inventário (admin).
  const PROGRESS_PRESENTATION: Record<string, { label: string; color: string }> = {
    out_of_stock: { label: 'Esgotado', color: 'bg-destructive' },
    critical: { label: 'Crítico', color: 'bg-destructive' },
    low_stock: { label: 'Estoque baixo', color: 'bg-warning' },
    in_stock: { label: 'OK', color: 'bg-success' },
    incoming: { label: 'Chegando', color: 'bg-warning' },
    overstocked: { label: 'OK', color: 'bg-success' },
  };
  const { label: statusLabel, color: progressColor } =
    PROGRESS_PRESENTATION[calculateStockStatus(current, min)] ?? PROGRESS_PRESENTATION.in_stock;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="w-28 cursor-help space-y-0.5">
            <Progress value={percentage} className={cn('h-2', progressColor)} />
            <div className="flex justify-between">
              <span
                className={cn(
                  'text-[9px] tabular-nums',
                  percentage <= 25
                    ? 'text-destructive'
                    : percentage <= 100
                      ? 'text-warning'
                      : 'text-success',
                )}
              >
                {Math.round(percentage)}%
              </span>
              <span className="text-[9px] text-muted-foreground">{statusLabel}</span>
            </div>
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <div className="space-y-1 text-xs">
            <p>
              <span className="font-semibold">{Math.round(percentage)}%</span> do estoque mínimo
            </p>
            <p className="text-muted-foreground">
              Atual: <strong>{current.toLocaleString('pt-BR')}</strong> / Mínimo:{' '}
              <strong>{min.toLocaleString('pt-BR')}</strong> un.
            </p>
            {current <= min && current > 0 && (
              <p className="text-warning">⚠️ Abaixo do nível mínimo — considere reabastecer</p>
            )}
            {current <= 0 && (
              <p className="text-destructive">🚨 Estoque zerado — reposição urgente necessária</p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
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

function VariantRow({
  variant,
  isNested = false,
  parentImageUrl,
  parentName,
}: {
  variant: VariantStock;
  isNested?: boolean;
  parentImageUrl?: string;
  parentName?: string;
}) {
  const isOut = variant.status === 'out_of_stock' || variant.currentStock <= 0;
  return (
    <TableRow className={cn(isNested && 'bg-muted/30')}>
      <TableCell className={cn(isNested && 'pl-12')}>
        <div className="flex items-center gap-3">
          <VariantThumb
            imageUrl={variant.imageUrl || parentImageUrl}
            productName={parentName || variant.colorName || variant.variantSku}
            colorName={variant.colorName}
            colorHex={variant.colorHex}
            size="sm"
          />
          <RichColorSwatch
            hex={variant.colorHex}
            name={variant.colorName}
            isOutOfStock={isOut}
          />
        </div>
      </TableCell>
      <TableCell className="hidden md:table-cell">
        <span className="font-mono text-xs text-muted-foreground">{variant.variantSku}</span>
      </TableCell>
      <TableCell>
        <div className="flex items-baseline gap-1.5">
          <span
            className={cn(
              'text-base font-semibold tabular-nums',
              isOut
                ? 'text-destructive'
                : variant.currentStock <= variant.minStock * 0.25
                  ? 'text-destructive'
                  : variant.currentStock <= variant.minStock
                    ? 'text-warning'
                    : 'text-foreground',
            )}
          >
            {variant.currentStock.toLocaleString('pt-BR')}
          </span>
          <span className="text-[10px] text-muted-foreground">/ {variant.minStock} mín</span>
        </div>
      </TableCell>
      <TableCell className="hidden sm:table-cell">
        <StockProgressBar
          current={variant.currentStock}
          min={variant.minStock}
          max={variant.maxStock}
        />
      </TableCell>
      <TableCell className="hidden lg:table-cell">
        {variant.reservedStock > 0 ? (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <span className="text-sm tabular-nums text-warning">
                  -{variant.reservedStock}
                </span>
              </TooltipTrigger>
              <TooltipContent>
                <p>{variant.reservedStock} unidades reservadas em pedidos</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ) : (
          <EmptyCell />
        )}
      </TableCell>
      <TableCell>
        <span
          className={cn(
            'font-medium tabular-nums',
            variant.availableStock <= 0 ? 'text-destructive' : 'text-foreground',
          )}
        >
          {variant.availableStock.toLocaleString('pt-BR')}
        </span>
      </TableCell>
      <TableCell className="hidden md:table-cell">
        {variant.inTransitStock > 0 ? (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <span className="flex items-center gap-1 text-sm tabular-nums text-primary/80">
                  <Truck className="h-3 w-3" />+{variant.inTransitStock}
                </span>
              </TooltipTrigger>
              <TooltipContent>
                <p>{variant.inTransitStock} unidades em trânsito</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
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
        {variant.daysUntilStockout !== undefined ? (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <div
                  className={cn(
                    'flex items-center gap-1 text-sm tabular-nums',
                    variant.daysUntilStockout <= 7
                      ? 'text-destructive'
                      : variant.daysUntilStockout <= 14
                        ? 'text-warning'
                        : 'text-muted-foreground',
                  )}
                >
                  <Clock className="h-3 w-3" />
                  {variant.daysUntilStockout}d
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>Previsão de esgotamento em {variant.daysUntilStockout} dias</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ) : (
          <EmptyCell />
        )}
      </TableCell>
    </TableRow>
  );
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
          <span className="text-[10px] text-muted-foreground">/ {variant.minStock} mín</span>
        </div>
      </TableCell>
      <TableCell className="hidden sm:table-cell">
        <StockProgressBar current={variant.currentStock} min={variant.minStock} />
      </TableCell>
      <TableCell className="hidden lg:table-cell">
        {variant.reservedStock > 0 ? (
          <span className="text-sm tabular-nums text-warning">-{variant.reservedStock}</span>
        ) : (
          <EmptyCell />
        )}
      </TableCell>
      <TableCell>
        <span
          className={cn(
            'font-medium tabular-nums',
            variant.availableStock <= 0 ? 'text-destructive' : 'text-foreground',
          )}
        >
          {variant.availableStock.toLocaleString('pt-BR')}
        </span>
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
            onClick={() => navigator.clipboard.writeText(variant.variantSku)}
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
// LINHA DO PRODUTO (EXPANSÍVEL)
// ============================================

function ProductRow({
  product,
  isExpanded,
  onToggle,
}: {
  product: ProductStockSummary;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const navigate = useNavigate();

  return (
    <>
      <TableRow
        className={cn(
          'group cursor-pointer transition-colors hover:bg-muted/50',
          isExpanded && 'bg-muted/30',
        )}
        onClick={onToggle}
      >
        <TableCell>
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              aria-label={
                isExpanded ? `Recolher ${product.productName}` : `Expandir ${product.productName}`
              }
              className="h-6 w-6 shrink-0"
            >
              {isExpanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </Button>
            <VariantThumb
              imageUrl={product.productImageUrl}
              productName={product.productName}
              size="sm"
              showColorRing={false}
            />
            <div className="flex min-w-0 flex-col">
              <span className="max-w-[220px] truncate font-medium">{product.productName}</span>
              <span className="text-xs text-muted-foreground">
                {product.productSku} • {product.totalVariants}{' '}
                {product.totalVariants === 1 ? 'variação' : 'variações'}
              </span>
            </div>
          </div>
        </TableCell>

        <TableCell className="hidden md:table-cell">
          <ProductColorSwatches
            colors={product.availableColors.map((c) => ({ name: c.colorName, hex: c.colorHex || null }))}
            max={5}
            size="sm"
            hideWhenEmpty={false}
          />
        </TableCell>
        <TableCell>
          <div className="flex items-center gap-2">
            <span className="font-semibold">{product.totalCurrentStock}</span>
            <span className="text-xs text-muted-foreground">/ {product.totalMinStock} mín</span>
          </div>
        </TableCell>
        <TableCell className="hidden sm:table-cell">
          <StockProgressBar current={product.totalCurrentStock} min={product.totalMinStock} />
        </TableCell>
        <TableCell className="hidden lg:table-cell">
          {product.totalReservedStock > 0 ? (
            <span className="text-sm text-warning">-{product.totalReservedStock}</span>
          ) : (
            '-'
          )}
        </TableCell>
        <TableCell>
          <span className="font-medium">{product.totalAvailableStock}</span>
        </TableCell>
        <TableCell className="hidden md:table-cell">
          {product.totalInTransitStock > 0 ? (
            <span className="flex items-center gap-1 text-sm text-primary/80">
              <Truck className="h-3 w-3" />+{product.totalInTransitStock}
            </span>
          ) : (
            '-'
          )}
        </TableCell>
        <TableCell>
          <StockStatusChip
            status={product.overallStatus}
            current={product.totalCurrentStock}
            min={product.totalMinStock}
            reserved={product.totalReservedStock}
            inTransit={product.totalInTransitStock}
          />
        </TableCell>

        <TableCell className="hidden sm:table-cell">
          <div className="flex items-center gap-1">
            {product.variantsCritical > 0 && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <Badge
                      variant="outline"
                      className="gap-0.5 border-destructive/20 bg-destructive/10 text-xs text-destructive"
                    >
                      <AlertTriangle className="h-2.5 w-2.5" />
                      {product.variantsCritical} crítico
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-xs">
                      {product.variantsCritical} variante(s) em nível crítico — considere solicitar
                      reposição urgente
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            {product.variantsOutOfStock > 0 && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <Badge
                      variant="outline"
                      className="gap-0.5 border-destructive/20 bg-destructive/10 text-xs text-destructive"
                    >
                      <XCircle className="h-2.5 w-2.5" />
                      {product.variantsOutOfStock} esgotado
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-xs">
                      {product.variantsOutOfStock} variante(s) sem estoque — produto indisponível
                      nestas cores
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            {product.totalInTransitStock > 0 && product.variantsOutOfStock > 0 && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <Badge
                      variant="outline"
                      className="gap-0.5 border-primary/20 bg-primary/10 text-[10px] text-primary"
                    >
                      <Truck className="h-2.5 w-2.5" />
                      reposição
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-xs">
                      +{product.totalInTransitStock} un. em trânsito — reposição a caminho
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            {/* Quick Actions on Hover */}
            <div className="ml-auto flex gap-0.5 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 hover:bg-muted"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigator.clipboard.writeText(product.productSku);
                      }}
                      aria-label={`Copiar SKU ${product.productSku}`}
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-xs">Copiar SKU</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/produto/${product.productId}`);
                      }}
                      aria-label={`Ver produto ${product.productName}`}
                    >
                      <ExternalLink className="h-3 w-3" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Ver produto</TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(
                          `/orcamentos/novo?productId=${product.productId}&productName=${encodeURIComponent(product.productName)}`,
                        );
                      }}
                      aria-label={`Criar orçamento para ${product.productName}`}
                    >
                      <ShoppingCart className="h-3 w-3" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Criar orçamento</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>
        </TableCell>
      </TableRow>

      {isExpanded &&
        product.variants.map((variant) => (
          <VariantRow
            key={variant.id}
            variant={variant}
            isNested
            parentImageUrl={product.productImageUrl}
            parentName={product.productName}
          />

        ))}
    </>
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
  const [expandedProducts, setExpandedProducts] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState<number>(() => {
    const raw = readStored(PAGE_STORAGE_KEY, '0');
    const n = Number.parseInt(raw, 10);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  });
  const [inlineSearch, setInlineSearch] = useState<string>(() => readStored(SEARCH_STORAGE_KEY, ''));
  const [searchParams] = useSearchParams();
  const prevProductsLenRef = useRef(products.length);

  // Persiste busca inline (debounce simples via efeito)
  useEffect(() => {
    writeStored(SEARCH_STORAGE_KEY, inlineSearch);
  }, [inlineSearch]);

  // Persiste página atual
  useEffect(() => {
    writeStored(PAGE_STORAGE_KEY, String(currentPage));
  }, [currentPage]);


  // Modo de visualização persistido — cada vendedor tem sua preferência.
  // Default = 'grouped' (não muda comportamento atual ao subir).
  const [groupingMode, setGroupingMode] = useState<GroupingMode>(() => {
    if (typeof window === 'undefined') return 'grouped';
    const stored = window.localStorage.getItem(GROUPING_STORAGE_KEY);
    return stored === 'flat' ? 'flat' : 'grouped';
  });
  useEffect(() => {
    try {
      window.localStorage.setItem(GROUPING_STORAGE_KEY, groupingMode);
    } catch {
      /* localStorage indisponível (modo privado) — segue só em memória. */
    }
  }, [groupingMode]);

  // Filtro por status (persistido). Sincroniza com ambos os modos grouped/flat.
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(() => {
    const stored = readStored(STATUS_FILTER_STORAGE_KEY, 'all') as StatusFilter;
    return STATUS_FILTER_VALUES.includes(stored) ? stored : 'all';
  });
  useEffect(() => {
    writeStored(STATUS_FILTER_STORAGE_KEY, statusFilter);
  }, [statusFilter]);




  // Deep link: auto-expand product from URL ?product=ID
  useEffect(() => {
    const productId = searchParams.get('product');
    if (productId) {
      const idx = products.findIndex((p) => p.productId === productId);
      if (idx >= 0) {
        const page = Math.floor(idx / PAGE_SIZE);
        setCurrentPage(page);
        setExpandedProducts(new Set([productId]));
      }
    }
  }, [searchParams, products]);

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
   * Contagem de variações por status sobre o universo pós-busca.
   * Usada nos chips do filtro para feedback imediato e consistência entre modos.
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
   * Aplica filtro de status mantendo coerência entre grouped/flat:
   *  - grouped: mantém produto se ALGUMA variação bate; recorta lista de variantes ao filtro.
   *  - flat: filtragem efetiva acontece em flatRows.
   */
  const filteredProducts = useMemo(() => {
    if (statusFilter === 'all') return searchedProducts;
    const result: ProductStockSummary[] = [];
    for (const p of searchedProducts) {
      const matched = p.variants.filter((v) => v.status === statusFilter);
      if (matched.length > 0) {
        result.push(groupingMode === 'grouped' ? { ...p, variants: matched } : p);
      }
    }
    return result;
  }, [searchedProducts, statusFilter, groupingMode]);

  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages - 1);
  if (safePage !== currentPage) setCurrentPage(safePage);

  const paginatedProducts = useMemo(() => {
    const start = safePage * PAGE_SIZE;
    return filteredProducts.slice(start, start + PAGE_SIZE);
  }, [filteredProducts, safePage]);

  /**
   * Modo flat: 1 linha = 1 variação (SKU). Paginação continua sobre PRODUTOS
   * para preservar a UX de "X de Y", mas flatRows é o que efetivamente renderiza.
   * Aplica statusFilter na variação para consistência absoluta com os chips.
   */
  const flatRows = useMemo(() => {
    if (groupingMode !== 'flat') return [];
    const rows: Array<{ product: ProductStockSummary; variant: VariantStock }> = [];
    for (const product of paginatedProducts) {
      for (const variant of product.variants) {
        if (statusFilter !== 'all' && variant.status !== statusFilter) continue;
        rows.push({ product, variant });
      }
    }
    return rows;

  }, [groupingMode, paginatedProducts]);

  const toggleProduct = (productId: string) => {
    setExpandedProducts((prev) => {
      const next = new Set(prev);
      if (next.has(productId)) next.delete(productId);
      else next.add(productId);
      return next;
    });
  };

  const expandAll = () => setExpandedProducts(new Set(paginatedProducts.map((p) => p.productId)));
  const collapseAll = () => setExpandedProducts(new Set());



  if (isLoading) {
    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[300px]">Produto</TableHead>
            <TableHead className="hidden md:table-cell">Cores</TableHead>
            <TableHead>Estoque Total</TableHead>
            <TableHead className="hidden w-[120px] sm:table-cell">Progresso</TableHead>
            <TableHead className="hidden lg:table-cell">Reservado</TableHead>
            <TableHead>Disponível</TableHead>
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
              <TableCell className="hidden sm:table-cell">
                <div className="h-2 w-full animate-pulse rounded bg-muted" />
              </TableCell>
              <TableCell className="hidden lg:table-cell">
                <div className="h-4 w-8 animate-pulse rounded bg-muted" />
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
            {filteredProducts.length > PAGE_SIZE ? (
              <>
                {safePage * PAGE_SIZE + 1}–
                {Math.min((safePage + 1) * PAGE_SIZE, filteredProducts.length)} de{' '}
                {filteredProducts.length}
              </>
            ) : (
              <>{filteredProducts.length} produtos</>
            )}

          </span>

          {/* Toggle de agrupamento: Agrupar por produto ↔ Listar variações */}
          <div
            className="inline-flex items-center rounded-md border border-border/60 bg-background p-0.5"
            role="group"
            aria-label="Modo de visualização da tabela de estoque"
            data-testid="stock-grouping-toggle"
          >
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={groupingMode === 'grouped' ? 'secondary' : 'ghost'}
                    size="sm"
                    className="h-6 gap-1 px-2 text-[11px]"
                    onClick={() => setGroupingMode('grouped')}
                    aria-pressed={groupingMode === 'grouped'}
                  >
                    <LayoutList className="h-3 w-3" />
                    Agrupar
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Agrupa variações sob cada produto pai</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={groupingMode === 'flat' ? 'secondary' : 'ghost'}
                    size="sm"
                    className="h-6 gap-1 px-2 text-[11px]"
                    onClick={() => setGroupingMode('flat')}
                    aria-pressed={groupingMode === 'flat'}
                  >
                    <Rows3 className="h-3 w-3" />
                    Por variação
                  </Button>
                </TooltipTrigger>
                <TooltipContent>1 linha por SKU vendável (cor/tamanho)</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>

          {groupingMode === 'grouped' && (
            <>
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={expandAll}>
                Expandir Todos
              </Button>
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={collapseAll}>
                Recolher Todos
              </Button>
            </>
          )}
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
              <TableHead className="w-[280px]">
                {groupingMode === 'flat' ? 'Variação / Cor' : 'Produto / Cor'}
              </TableHead>
              <TableHead className="hidden w-[120px] md:table-cell">
                {groupingMode === 'flat' ? 'Categoria' : 'Cores'}
              </TableHead>
              <TableHead>Estoque</TableHead>
              <TableHead className="hidden w-[100px] sm:table-cell">Nível</TableHead>
              <TableHead className="hidden lg:table-cell">Reservado</TableHead>
              <TableHead>Disponível</TableHead>
              <TableHead className="hidden md:table-cell">Em Trânsito</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="hidden sm:table-cell">
                {groupingMode === 'flat' ? 'Ações' : 'Alertas'}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {groupingMode === 'flat' && flatRows.length > 0 ? (
              flatRows.map(({ product, variant }) => (
                <FlatVariantRow
                  key={`${product.productId}::${variant.id}`}
                  product={product}
                  variant={variant}
                />
              ))
            ) : groupingMode === 'grouped' && paginatedProducts.length > 0 ? (
              paginatedProducts.map((product) => (

                <ProductRow
                  key={product.productId}
                  product={product}
                  isExpanded={expandedProducts.has(product.productId)}
                  onToggle={() => toggleProduct(product.productId)}
                />
              ))
            ) : (

              <TableRow>
                <TableCell colSpan={9} className="py-16 text-center text-muted-foreground">
                  <div className="flex flex-col items-center">
                    <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted/50">
                      <Package className="h-8 w-8 opacity-30" />
                    </div>
                    <p className="mb-1 font-semibold text-foreground">Nenhum produto encontrado</p>
                    <p className="max-w-xs text-sm">
                      {inlineSearch
                        ? `Nenhum resultado para "${inlineSearch}". Tente outro termo.`
                        : 'Ajuste os filtros para visualizar os produtos.'}
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
