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
import { type ProductStockSummary, type VariantStock, type StockStatus } from '@/types/stock';

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
    label: 'Baixo',
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

  const progressColor =
    current <= 0
      ? 'bg-destructive'
      : current <= min * 0.25
        ? 'bg-destructive'
        : current <= min
          ? 'bg-warning'
          : 'bg-success';

  const statusLabel =
    current <= 0 ? 'Esgotado' : current <= min * 0.25 ? 'Crítico' : current <= min ? 'Baixo' : 'OK';

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
              <p className="text-destructive">🚨 Sem estoque — reposição urgente necessária</p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// ============================================
// LINHA DE VARIANTE (COR/TAMANHO)
// ============================================

function VariantRow({ variant, isNested = false }: { variant: VariantStock; isNested?: boolean }) {
  return (
    <TableRow className={cn(isNested && 'bg-muted/30')}>
      <TableCell className={cn(isNested && 'pl-12')}>
        <ColorSwatch hex={variant.colorHex} name={variant.colorName} />
      </TableCell>
      <TableCell className="hidden md:table-cell">
        <span className="font-mono text-xs text-muted-foreground">{variant.variantSku}</span>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'font-semibold',
              variant.currentStock <= 0
                ? 'text-destructive'
                : variant.currentStock <= variant.minStock * 0.25
                  ? 'text-destructive'
                  : variant.currentStock <= variant.minStock
                    ? 'text-warning'
                    : 'text-foreground',
            )}
          >
            {variant.currentStock}
          </span>
          <span className="text-xs text-muted-foreground">/ {variant.minStock} mín</span>
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
                <span className="text-sm text-warning">-{variant.reservedStock}</span>
              </TooltipTrigger>
              <TooltipContent>
                <p>{variant.reservedStock} unidades reservadas em pedidos</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ) : (
          <span className="text-muted-foreground">-</span>
        )}
      </TableCell>
      <TableCell>
        <span
          className={cn(
            'font-medium',
            variant.availableStock <= 0 ? 'text-destructive' : 'text-foreground',
          )}
        >
          {variant.availableStock}
        </span>
      </TableCell>
      <TableCell className="hidden md:table-cell">
        {variant.inTransitStock > 0 ? (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <span className="flex items-center gap-1 text-sm text-primary/80">
                  <Truck className="h-3 w-3" />+{variant.inTransitStock}
                </span>
              </TooltipTrigger>
              <TooltipContent>
                <p>{variant.inTransitStock} unidades em trânsito</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ) : (
          <span className="text-muted-foreground">-</span>
        )}
      </TableCell>
      <TableCell>
        <StockStatusBadge status={variant.status} />
      </TableCell>
      <TableCell className="hidden sm:table-cell">
        {variant.daysUntilStockout !== undefined ? (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <div
                  className={cn(
                    'flex items-center gap-1 text-sm',
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
          <span className="text-muted-foreground">-</span>
        )}
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
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              aria-label={
                isExpanded ? `Recolher ${product.productName}` : `Expandir ${product.productName}`
              }
              className="h-6 w-6"
            >
              {isExpanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </Button>
            <div className="flex flex-col">
              <span className="max-w-[200px] truncate font-medium">{product.productName}</span>
              <span className="text-xs text-muted-foreground">
                {product.productSku} • {product.totalVariants}{' '}
                {product.totalVariants === 1 ? 'variação' : 'variações'}
              </span>
            </div>
          </div>
        </TableCell>
        <TableCell className="hidden md:table-cell">
          <div className="flex flex-wrap gap-1">
            {product.availableColors.slice(0, 5).map((color, idx) => (
              <TooltipProvider key={idx}>
                <Tooltip>
                  <TooltipTrigger>
                    <div
                      className={cn(
                        'h-5 w-5 rounded-full border shadow-sm',
                        color.status === 'out_of_stock' && 'opacity-30',
                      )}
                      style={{ backgroundColor: color.colorHex || '#ccc' }}
                    />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>
                      {color.colorName}: {color.totalStock} un ({STATUS_CONFIG[color.status].label})
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ))}
            {product.availableColors.length > 5 && (
              <span className="ml-1 text-xs text-muted-foreground">
                +{product.availableColors.length - 5}
              </span>
            )}
          </div>
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
          <StockStatusBadge status={product.overallStatus} />
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
          <VariantRow key={variant.id} variant={variant} isNested />
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
}

export function VariantStockTable({ products, className }: VariantStockTableProps) {
  const [expandedProducts, setExpandedProducts] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(0);
  const [inlineSearch, setInlineSearch] = useState('');
  const [searchParams] = useSearchParams();
  const prevProductsLenRef = useRef(products.length);

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

  const totalPages = Math.max(1, Math.ceil(searchedProducts.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages - 1);
  if (safePage !== currentPage) setCurrentPage(safePage);

  const paginatedProducts = useMemo(() => {
    const start = safePage * PAGE_SIZE;
    return searchedProducts.slice(start, start + PAGE_SIZE);
  }, [searchedProducts, safePage]);

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

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex flex-col items-start justify-between gap-2 sm:flex-row sm:items-center">
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

        <div className="flex items-center gap-2">
          {/* Pagination info */}
          <span className="whitespace-nowrap text-xs text-muted-foreground">
            {searchedProducts.length > PAGE_SIZE ? (
              <>
                {safePage * PAGE_SIZE + 1}–
                {Math.min((safePage + 1) * PAGE_SIZE, searchedProducts.length)} de{' '}
                {searchedProducts.length}
              </>
            ) : (
              <>{searchedProducts.length} produtos</>
            )}
          </span>
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={expandAll}>
            Expandir Todos
          </Button>
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={collapseAll}>
            Recolher Todos
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <Table className="min-w-[700px]">
          <TableHeader className="sticky top-0 z-10 bg-background">
            <TableRow className="bg-muted/50">
              <TableHead className="w-[250px]">Produto / Cor</TableHead>
              <TableHead className="hidden w-[100px] md:table-cell">Cores</TableHead>
              <TableHead>Estoque</TableHead>
              <TableHead className="hidden w-[100px] sm:table-cell">Nível</TableHead>
              <TableHead className="hidden lg:table-cell">Reservado</TableHead>
              <TableHead>Disponível</TableHead>
              <TableHead className="hidden md:table-cell">Em Trânsito</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="hidden sm:table-cell">Alertas</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedProducts.length > 0 ? (
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
