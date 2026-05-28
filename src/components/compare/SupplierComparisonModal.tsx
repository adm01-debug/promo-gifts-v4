import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Building2,
  TrendingDown,
  TrendingUp,
  Package,
  Crown,
  ArrowRight,
  Minus,
  ShieldCheck,
  Clock,
  Palette,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSupplierComparison, type Product, type SupplierComparisonSort } from '@/hooks/products';
import { Skeleton } from '@/components/ui/skeleton';

interface SupplierComparisonModalProps {
  product?: Product | null;
  productId?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SupplierComparisonModal({
  product,
  open,
  onOpenChange,
}: SupplierComparisonModalProps) {
  const navigate = useNavigate();
  const [onlyVerified, setOnlyVerified] = useState(false);
  const [sortBy, setSortBy] = useState<SupplierComparisonSort>('score');

  const { result: comparison, isLoading } = useSupplierComparison(product ?? null, {
    onlyVerified,
    sortBy,
  });

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

  const formatPercent = (value: number) => `${value > 0 ? '+' : ''}${value.toFixed(1)}%`;

  const getStockStatusLabel = (status: string) => {
    switch (status) {
      case 'in-stock':
        return { label: 'Em estoque', color: 'text-success' };
      case 'low-stock':
        return { label: 'Estoque baixo', color: 'text-warning' };
      case 'out-of-stock':
        return { label: 'Sem estoque', color: 'text-destructive' };
      default:
        return { label: 'Em estoque', color: 'text-success' };
    }
  };

  // hooks calls must happen unconditionally — declarar antes do early-return
  const baseProduct = comparison?.baseProduct;
  const baseIsLowest = baseProduct ? baseProduct.price === comparison?.lowestPrice : false;
  const baseIsBestStock = baseProduct ? baseProduct.stock === comparison?.highestStock : false;

  const allProducts = useMemo(() => {
    if (!comparison || !baseProduct) return [];
    return [
      {
        product: baseProduct,
        priceDiff: 0,
        priceDiffPercent: 0,
        stockAdvantage: false,
        isLowestPrice: baseIsLowest,
        isBestStock: baseIsBestStock,
        commonColors: [] as string[],
        commonMaterials: [] as string[],
        leadTimeDays: baseProduct.leadTimeDays ?? null,
        isVerified: baseProduct.is_active !== false,
        score: 100,
        economiaPorMOQ: 0,
        effectiveMOQ: baseProduct.minQuantity ?? 1,
        isBase: true,
      },
      ...comparison.alternatives.map((alt) => ({ ...alt, isBase: false })),
    ];
  }, [comparison, baseProduct, baseIsLowest, baseIsBestStock]);

  if (isLoading || !baseProduct) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[85vh] max-w-5xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              Comparador de Fornecedores
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-6 p-4">
            {!baseProduct && !isLoading ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Package className="mb-4 h-12 w-12 text-muted-foreground/30" />
                <p className="text-lg font-medium">Produto base não carregado</p>
                <p className="text-sm text-muted-foreground">
                  Ocorreu um erro ao carregar os dados para comparação.
                </p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                  {[...Array(4)].map((_, i) => (
                    <Skeleton key={i} className="h-20 w-full rounded-lg" />
                  ))}
                </div>
                <div className="space-y-3">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-24 w-full rounded-xl" />
                  ))}
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // Se comparison for null, significa que não foram encontradas alternativas similares
  if (!comparison) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[85vh] max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              Comparador de Fornecedores
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
              <Sparkles className="h-8 w-8 text-muted-foreground/40" />
            </div>
            <h3 className="text-xl font-bold">Nenhuma alternativa encontrada</h3>
            <p className="mt-2 max-w-sm text-muted-foreground">
              Não encontramos outros fornecedores oferecendo produtos similares a{' '}
              <span className="font-semibold text-foreground">&quot;{baseProduct.name}&quot;</span>{' '}
              nesta categoria.
            </p>
            <Button variant="outline" className="mt-8" onClick={() => onOpenChange(false)}>
              Fechar comparador
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const { lowestPrice, highestStock, maxEconomiaPorMOQ, fastestLeadTimeDays } = comparison;
  const verifiedCount = comparison.alternativesUnfiltered.filter((a) => a.isVerified).length;
  const totalAlternatives = comparison.alternativesUnfiltered.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-5xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            Comparador de Fornecedores
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            {allProducts.length} fornecedores · ordenado por {SORT_LABEL[sortBy]}
            {onlyVerified && ` · somente ativos (${verifiedCount}/${totalAlternatives})`}
          </p>
        </DialogHeader>

        {/* Controles */}
        <div className="flex flex-wrap items-center gap-4 border-b border-border pb-4">
          <div className="flex items-center gap-2">
            <Label htmlFor="cmp-sort" className="text-xs text-muted-foreground">
              Ordenar por
            </Label>
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as SupplierComparisonSort)}>
              <SelectTrigger id="cmp-sort" className="h-9 w-[200px] text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="score">
                  <span className="flex items-center gap-2">
                    <Sparkles className="h-3.5 w-3.5" /> Score (recomendado)
                  </span>
                </SelectItem>
                <SelectItem value="price">
                  <span className="flex items-center gap-2">
                    <TrendingDown className="h-3.5 w-3.5" /> Menor preço
                  </span>
                </SelectItem>
                <SelectItem value="stock">
                  <span className="flex items-center gap-2">
                    <Package className="h-3.5 w-3.5" /> Maior estoque
                  </span>
                </SelectItem>
                <SelectItem value="leadTime">
                  <span className="flex items-center gap-2">
                    <Clock className="h-3.5 w-3.5" /> Menor lead time
                  </span>
                </SelectItem>
                <SelectItem value="commonColors">
                  <span className="flex items-center gap-2">
                    <Palette className="h-3.5 w-3.5" /> Mais cores em comum
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <Switch
              id="cmp-verified"
              checked={onlyVerified}
              onCheckedChange={setOnlyVerified}
              disabled={verifiedCount === 0}
            />
            <Label htmlFor="cmp-verified" className="cursor-pointer text-sm">
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5 text-success" />
                Somente fornecedores ativos
              </span>
            </Label>
          </div>
        </div>

        <ScrollArea className="h-[60vh]">
          {/* Summary Cards */}
          <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-5">
            <div className="rounded-lg border border-success/20 bg-success/10 p-3">
              <p className="mb-1 text-xs text-muted-foreground">Menor preço</p>
              <p className="text-lg font-bold text-success">{formatCurrency(lowestPrice)}</p>
            </div>
            <div className="rounded-lg border border-primary/20 bg-primary/10 p-3">
              <p className="mb-1 text-xs text-muted-foreground">Maior estoque</p>
              <p className="text-lg font-bold text-primary">
                {highestStock.toLocaleString('pt-BR')} un.
              </p>
            </div>
            <div className="rounded-lg border border-border bg-muted p-3">
              <p className="mb-1 text-xs text-muted-foreground">Fornecedores</p>
              <p className="text-lg font-bold">{allProducts.length}</p>
            </div>
            <div className="rounded-lg border border-success/20 bg-success/10 p-3">
              <p className="mb-1 text-xs text-muted-foreground">Economia / pedido (MOQ)</p>
              <p className="text-lg font-bold text-success">{formatCurrency(maxEconomiaPorMOQ)}</p>
            </div>
            <div className="rounded-lg border border-border bg-muted p-3">
              <p className="mb-1 flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" /> Lead time mín.
              </p>
              <p className="text-lg font-bold">
                {fastestLeadTimeDays !== null ? `${fastestLeadTimeDays}d` : '—'}
              </p>
            </div>
          </div>

          {/* Empty state quando o filtro zera as alternativas */}
          {comparison.alternatives.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border bg-muted/30 p-8 text-center">
              <ShieldCheck className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
              <p className="text-sm font-medium">Nenhum fornecedor ativo encontrado</p>
              <p className="text-xs text-muted-foreground">
                Desative o filtro &quot;somente ativos&quot; para ver todas as alternativas.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[60px]">Img</TableHead>
                  <TableHead>Produto / Fornecedor</TableHead>
                  <TableHead className="text-right">Preço</TableHead>
                  <TableHead className="text-center">Variação</TableHead>
                  <TableHead className="text-center">Estoque</TableHead>
                  <TableHead className="text-center">Lead</TableHead>
                  <TableHead className="text-center">Cores ⌒</TableHead>
                  <TableHead className="w-[90px] text-center">Score</TableHead>
                  <TableHead className="w-[90px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {allProducts.map((row) => {
                  const {
                    product: p,
                    priceDiff,
                    priceDiffPercent,
                    isLowestPrice,
                    isBestStock,
                    isBase,
                    commonColors,
                    leadTimeDays,
                    isVerified,
                    score,
                  } = row;
                  const status = getStockStatusLabel(p.stockStatus);

                  return (
                    <TableRow
                      key={p.id}
                      className={cn(isBase && 'border-l-2 border-l-primary bg-primary/5')}
                    >
                      <TableCell>
                        <div className="relative flex h-14 w-14 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted">
                          {p.images?.[0] ? (
                            <img
                              src={p.images[0]}
                              alt={p.name}
                              className="h-full w-full object-cover transition-opacity duration-300"
                              onError={(e) => {
                                (e.target as HTMLImageElement).src = '/placeholder.svg';
                                (e.target as HTMLImageElement).className =
                                  'w-8 h-8 opacity-20 object-contain';
                              }}
                              loading="lazy"
                            />
                          ) : (
                            <Package className="h-6 w-6 text-muted-foreground/30" />
                          )}
                          {isBase && (
                            <Badge
                              variant="default"
                              className="absolute -left-2 -top-2 px-1 text-[10px]"
                            >
                              Atual
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <p className="line-clamp-1 font-medium">{p.name}</p>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <Badge variant="outline" className="text-xs">
                              <Building2 className="mr-1 h-3 w-3" />
                              {p.supplier.name}
                            </Badge>
                            {isVerified && (
                              <Badge
                                variant="outline"
                                className="border-success/30 bg-success/10 text-[10px] text-success"
                              >
                                <ShieldCheck className="mr-0.5 h-3 w-3" /> Ativo
                              </Badge>
                            )}
                            {isLowestPrice && (
                              <Badge variant="default" className="bg-success text-[10px]">
                                <Crown className="mr-0.5 h-3 w-3" /> Melhor preço
                              </Badge>
                            )}
                            {isBestStock && !isLowestPrice && (
                              <Badge variant="default" className="bg-primary text-[10px]">
                                <Package className="mr-0.5 h-3 w-3" /> Melhor estoque
                              </Badge>
                            )}
                          </div>
                          <p className="font-mono text-xs text-muted-foreground">{p.sku}</p>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div>
                          <span
                            className={cn(
                              'text-lg font-bold',
                              isLowestPrice ? 'text-success' : 'text-foreground',
                            )}
                          >
                            {formatCurrency(p.price)}
                          </span>
                          <p className="text-[10px] text-muted-foreground">
                            MOQ {p.minQuantity ?? 1}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        {isBase ? (
                          <span className="text-muted-foreground">—</span>
                        ) : priceDiff > 0 ? (
                          <div className="flex items-center justify-center gap-1 text-destructive">
                            <TrendingUp className="h-4 w-4" />
                            <span className="text-sm font-medium">
                              {formatPercent(priceDiffPercent)}
                            </span>
                          </div>
                        ) : priceDiff < 0 ? (
                          <div className="flex flex-col items-center text-success">
                            <div className="flex items-center gap-1">
                              <TrendingDown className="h-4 w-4" />
                              <span className="text-sm font-medium">
                                {formatPercent(priceDiffPercent)}
                              </span>
                            </div>
                            {row.economiaPorMOQ > 0 && (
                              <span className="text-[10px] text-muted-foreground">
                                economiza {formatCurrency(row.economiaPorMOQ)}/pedido
                              </span>
                            )}
                          </div>
                        ) : (
                          <div className="flex items-center justify-center gap-1 text-muted-foreground">
                            <Minus className="h-4 w-4" />
                            <span className="text-sm">Igual</span>
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex flex-col items-center gap-0.5">
                          <span className={cn('text-xs font-medium', status.color)}>
                            {status.label}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {p.stock.toLocaleString('pt-BR')} un.
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        {leadTimeDays !== null ? (
                          <span className="text-sm">{leadTimeDays}d</span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {isBase ? (
                          <span className="text-muted-foreground">—</span>
                        ) : (
                          <CommonColorsBadge colors={commonColors} product={p} />
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <ScorePill score={score} isBase={isBase} />
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant={isBase ? 'outline' : 'default'}
                          onClick={() => {
                            onOpenChange(false);
                            navigate(`/produto/${p.id}`);
                          }}
                        >
                          {isBase ? 'Ver' : 'Trocar'}
                          <ArrowRight className="ml-1 h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}

          {/* Materials Comparison */}
          <div className="mt-6 rounded-lg border border-border bg-muted/50 p-4">
            <h4 className="mb-3 font-medium">Materiais comparados</h4>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {allProducts.map(({ product: p, isBase, commonMaterials }) => (
                <div
                  key={p.id}
                  className={cn(
                    'rounded-lg border bg-background p-3',
                    isBase ? 'border-primary' : 'border-border',
                  )}
                >
                  <p className="mb-2 flex items-center gap-2 text-sm font-medium">
                    {p.supplier.name}
                    {isBase && (
                      <Badge variant="secondary" className="text-xs">
                        Atual
                      </Badge>
                    )}
                  </p>
                  {Array.isArray(p.materials) && p.materials.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {p.materials.map((material) => {
                        const isCommon =
                          !isBase && commonMaterials.includes(material.toLowerCase().trim());
                        return (
                          <Badge
                            key={material}
                            variant="outline"
                            className={cn(
                              'text-xs',
                              isCommon && 'border-success/40 bg-success/10 text-success',
                            )}
                          >
                            {material}
                          </Badge>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

/* -------------------------------------------------------------------------- */
/*  Subcomponents                                                              */
/* -------------------------------------------------------------------------- */

const SORT_LABEL: Record<SupplierComparisonSort, string> = {
  score: 'score',
  price: 'menor preço',
  stock: 'maior estoque',
  leadTime: 'menor lead time',
  commonColors: 'cores em comum',
};

function ScorePill({ score, isBase }: { score: number; isBase: boolean }) {
  const tone =
    score >= 75
      ? 'bg-success/15 text-success border-success/30'
      : score >= 50
        ? 'bg-primary/15 text-primary border-primary/30'
        : 'bg-muted text-muted-foreground border-border';
  return (
    <div className="flex flex-col items-center gap-1">
      <Badge
        variant="outline"
        className={cn('px-2 py-0.5 text-xs font-semibold', tone, isBase && 'opacity-60')}
      >
        {score}
      </Badge>
      <div className="h-1 w-12 overflow-hidden rounded-full bg-border/60">
        <div
          className={cn(
            'h-full transition-all',
            score >= 75 ? 'bg-success' : score >= 50 ? 'bg-primary' : 'bg-muted-foreground/40',
          )}
          style={{ width: `${Math.max(4, score)}%` }}
        />
      </div>
    </div>
  );
}

function CommonColorsBadge({ colors, product }: { colors: string[]; product: Product }) {
  if (colors.length === 0) {
    return <span className="text-xs text-muted-foreground">0</span>;
  }
  const hexByName = new Map(
    (product.colors ?? []).map((c) => [c.name?.toLowerCase().trim() ?? '', c.hex]),
  );
  return (
    <div className="flex items-center justify-center gap-1">
      <span className="text-xs font-medium">{colors.length}</span>
      <div className="flex -space-x-1">
        {colors.slice(0, 4).map((name) => {
          const hex = hexByName.get(name) ?? '#999';
          return (
            <span
              key={name}
              title={name}
              className="h-3 w-3 rounded-full border border-background"
              style={{ backgroundColor: hex }}
            />
          );
        })}
        {colors.length > 4 && (
          <span className="ml-1 text-[10px] text-muted-foreground">+{colors.length - 4}</span>
        )}
      </div>
    </div>
  );
}
