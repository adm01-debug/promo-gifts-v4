import { useMemo, useState } from 'react';
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
  Minus,
  Sparkles,
  LayoutGrid,
  List,
  AlertCircle,
  ExternalLink,
  ChevronRight,
  Filter,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSupplierComparison, type Product, type SupplierComparisonSort } from '@/hooks/products';
import { Skeleton } from '@/components/ui/skeleton';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { PriceSparkline } from './PriceSparkline';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface SupplierComparisonModalProps {
  product?: Product | null;
  productId?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Linha de comparação renderizada nas variações tabela/card (base + alternativas). */
interface ComparisonRowData {
  product: Product;
  isBase: boolean;
  isLowestPrice: boolean;
  score: number;
  scoreBreakdown: Record<string, number>;
  priceDiffPercent: number;
  priceDiff: number;
}

interface ComparisonItemProps {
  row: ComparisonRowData;
  formatCurrency: (value: number) => string;
  formatPercent: (value: number) => string;
}

const SORT_LABEL: Record<string, string> = {
  score: 'Score',
  price: 'Menor preço',
  stock: 'Maior estoque',
  leadTime: 'Menor lead time',
  commonColors: 'Mais cores',
};

const BREAKDOWN_LABELS: Record<string, string> = {
  price: 'Preço',
  stock: 'Estoque',
  colors: 'Cores',
  moq: 'MOQ',
  lead: 'Lead Time',
  verified: 'Ativo',
};

const WEIGHT_LIMITS: Record<string, number> = {
  price: 35,
  stock: 20,
  colors: 15,
  moq: 15,
  lead: 10,
  verified: 10,
};

export function SupplierComparisonModal({
  product,
  open,
  onOpenChange,
}: SupplierComparisonModalProps) {
  const [onlyVerified, setOnlyVerified] = useState(false);
  const [sortBy, setSortBy] = useState<SupplierComparisonSort>('score');
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');
  const [activeFilters, setActiveFilters] = useState<string[]>([]);

  const { result: comparison, isLoading } = useSupplierComparison(product ?? null, {
    onlyVerified,
    sortBy,
  });

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

  const formatPercent = (value: number) => `${value > 0 ? '+' : ''}${value.toFixed(1)}%`;

  const displayProduct = comparison?.baseProduct ?? product;

  const allProducts = useMemo(() => {
    if (!comparison || !displayProduct) return [];
    return [
      {
        product: displayProduct,
        priceDiff: 0,
        priceDiffPercent: 0,
        stockAdvantage: false,
        isLowestPrice: displayProduct.price === comparison.lowestPrice,
        isBestStock: displayProduct.stock === comparison.highestStock,
        commonColors: [] as string[],
        leadTimeDays: displayProduct.leadTimeDays ?? null,
        isVerified: displayProduct.is_active !== false,
        score: 100,
        scoreBreakdown: { price: 35, stock: 20, colors: 15, moq: 15, lead: 10, verified: 10 },
        economiaPorMOQ: 0,
        effectiveMOQ: displayProduct.minQuantity ?? 1,
        isBase: true,
      },
      ...comparison.alternatives.map((alt) => ({ ...alt, isBase: false })),
    ];
  }, [comparison, displayProduct]);

  const filteredProducts = useMemo(() => {
    let filtered = allProducts;
    if (onlyVerified) {
      filtered = filtered.filter((p) => p.isVerified);
    }
    if (activeFilters.includes('moq10')) {
      filtered = filtered.filter((p) => (p.product.minQuantity ?? 1) <= 10);
    }
    if (activeFilters.includes('instock')) {
      filtered = filtered.filter((p) => p.product.stock > 0);
    }
    return filtered;
  }, [allProducts, onlyVerified, activeFilters]);

  const winner = useMemo(() => {
    if (allProducts.length === 0) return null;
    return allProducts.reduce(
      (prev, current) => (prev.score > current.score ? prev : current),
      allProducts[0],
    );
  }, [allProducts]);

  const winnerReason = useMemo(() => {
    if (!winner) return '';
    const { scoreBreakdown } = winner;
    const topFactor = Object.entries(scoreBreakdown).reduce((a, b) => (a[1] > b[1] ? a : b));
    const factorLabels: Record<string, string> = {
      price: 'melhor preço',
      stock: 'maior estoque',
      colors: 'maior variedade de cores',
      moq: 'baixo pedido mínimo',
      lead: 'entrega mais rápida',
      verified: 'fornecedor ativo e confiável',
    };
    return `O ${winner.product.supplier.name} é o vencedor principalmente pelo ${factorLabels[topFactor[0]] || 'equilíbrio de fatores'}.`;
  }, [winner]);

  if (isLoading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[90vh] max-w-6xl">
          <DialogHeader>
            <Skeleton className="h-8 w-64" />
          </DialogHeader>
          <div className="space-y-6 p-4">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
              {Array.from({ length: 5 }, (_, i) => (
                <Skeleton key={i} className="h-20 w-full rounded-lg" />
              ))}
            </div>
            <div className="space-y-3">
              {Array.from({ length: 5 }, (_, i) => (
                <Skeleton key={i} className="h-24 w-full rounded-xl" />
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (!displayProduct || !comparison) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Package className="mb-4 h-12 w-12 text-muted-foreground/30" />
            <p className="text-lg font-medium">Nenhuma alternativa encontrada</p>
            <p className="text-sm text-muted-foreground">
              Tente buscar por outra categoria ou produto.
            </p>
            <Button variant="outline" className="mt-6" onClick={() => onOpenChange(false)}>
              Fechar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const { lowestPrice, highestStock, maxEconomiaPorMOQ, fastestLeadTimeDays } = comparison;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] max-w-6xl flex-col overflow-hidden p-0 focus:ring-2 focus:ring-primary">
        <div className="border-b bg-muted/30 p-6">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <Building2 className="h-6 w-6 text-primary" />
              </div>
              <div>
                <DialogTitle className="text-xl font-extrabold tracking-tight">
                  Comparador de Fornecedores
                </DialogTitle>
                <div className="mt-0.5 flex items-center gap-2">
                  <p className="text-sm text-muted-foreground">{displayProduct.name}</p>
                  <Badge variant="outline" className="h-4 text-[10px] font-bold">
                    {allProducts.length} fornecedores
                  </Badge>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as 'table' | 'grid')}>
                <TabsList className="h-9 bg-muted/50 p-1">
                  <TabsTrigger
                    value="table"
                    className="h-7 gap-1.5 text-xs font-bold data-[state=active]:bg-background"
                  >
                    <List className="h-3.5 w-3.5" /> Tabela
                  </TabsTrigger>
                  <TabsTrigger
                    value="grid"
                    className="h-7 gap-1.5 text-xs font-bold data-[state=active]:bg-background"
                  >
                    <LayoutGrid className="h-3.5 w-3.5" /> Cards
                  </TabsTrigger>
                </TabsList>
              </Tabs>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="outline" size="icon" className="h-9 w-9 rounded-lg">
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Exportar Relatório</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-6">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-muted-foreground">
                <Filter className="h-3 w-3" /> Ordenar
              </div>
              <Select value={sortBy} onValueChange={(v) => setSortBy(v as SupplierComparisonSort)}>
                <SelectTrigger id="cmp-sort" className="h-9 w-[180px] bg-background font-medium">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(SORT_LABEL).map(([val, label]) => (
                    <SelectItem key={val} value={val}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <ToggleFilter
                id="moq10"
                label="MOQ ≤ 10"
                active={activeFilters.includes('moq10')}
                onToggle={() =>
                  setActiveFilters((prev) =>
                    prev.includes('moq10') ? prev.filter((f) => f !== 'moq10') : [...prev, 'moq10'],
                  )
                }
              />
              <ToggleFilter
                id="instock"
                label="Em estoque"
                active={activeFilters.includes('instock')}
                onToggle={() =>
                  setActiveFilters((prev) =>
                    prev.includes('instock')
                      ? prev.filter((f) => f !== 'instock')
                      : [...prev, 'instock'],
                  )
                }
              />
              <div className="mx-1 h-4 w-[1px] bg-border" />
              <div className="flex items-center gap-3">
                <Switch
                  id="cmp-verified"
                  checked={onlyVerified}
                  onCheckedChange={setOnlyVerified}
                  aria-checked={onlyVerified}
                  role="switch"
                  className="data-[state=checked]:bg-success"
                />
                <Label
                  htmlFor="cmp-verified"
                  className="cursor-pointer select-none text-sm font-semibold"
                >
                  Somente ativos
                </Label>
              </div>
            </div>
          </div>
        </div>

        <ScrollArea className="flex-1 p-6">
          <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-5">
            <KPICard label="Menor Preço" value={formatCurrency(lowestPrice)} color="success" />
            <KPICard
              label="Maior Estoque"
              value={`${highestStock.toLocaleString()} un.`}
              color="primary"
            />
            <KPICard label="Alternativas" value={comparison.alternatives.length} color="neutral" />
            {maxEconomiaPorMOQ > 0 && (
              <KPICard
                label="Economia Máx."
                value={formatCurrency(maxEconomiaPorMOQ)}
                color="success"
              />
            )}
            {fastestLeadTimeDays !== null && fastestLeadTimeDays > 0 && (
              <KPICard
                label="Lead Time Mín."
                value={`${fastestLeadTimeDays} dias`}
                color="neutral"
              />
            )}
          </div>

          <div className="mb-8 flex items-center gap-4 rounded-2xl border border-primary/20 bg-primary/5 p-5 shadow-inner">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
              <Sparkles className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="mb-0.5 text-sm font-bold text-primary">Por que este vencedor?</p>
              <p className="text-sm leading-relaxed text-muted-foreground">{winnerReason}</p>
            </div>
          </div>

          {viewMode === 'table' ? (
            <div className="overflow-hidden rounded-2xl border bg-background shadow-sm">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow className="hover:bg-transparent">
                    <TableHead
                      scope="col"
                      className="w-[80px] text-xs font-bold uppercase tracking-wider"
                    >
                      Prod
                    </TableHead>
                    <TableHead scope="col" className="text-xs font-bold uppercase tracking-wider">
                      Fornecedor
                    </TableHead>
                    <TableHead
                      scope="col"
                      className="text-right text-xs font-bold uppercase tracking-wider"
                    >
                      Preço / Ticket
                    </TableHead>
                    <TableHead
                      scope="col"
                      className="text-center text-xs font-bold uppercase tracking-wider"
                    >
                      Histórico & Δ
                    </TableHead>
                    <TableHead
                      scope="col"
                      className="text-center text-xs font-bold uppercase tracking-wider"
                    >
                      Estoque
                    </TableHead>
                    <TableHead
                      scope="col"
                      className="text-center text-xs font-bold uppercase tracking-wider"
                    >
                      Lead
                    </TableHead>
                    <TableHead
                      scope="col"
                      className="text-center text-xs font-bold uppercase tracking-wider"
                    >
                      Score
                    </TableHead>
                    <TableHead scope="col" className="w-[140px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProducts.map((row) => (
                    <ComparisonRow
                      key={row.product.id}
                      row={row}
                      formatCurrency={formatCurrency}
                      formatPercent={formatPercent}
                    />
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {filteredProducts.map((row) => (
                <ComparisonCard
                  key={row.product.id}
                  row={row}
                  formatCurrency={formatCurrency}
                  formatPercent={formatPercent}
                />
              ))}
            </div>
          )}
        </ScrollArea>

        {/* Sticky Decision Footer */}
        <div className="flex flex-wrap items-center justify-between gap-6 border-t bg-background/80 p-5 shadow-[0_-8px_15px_-5px_rgba(0,0,0,0.05)] backdrop-blur-sm">
          <div className="flex items-center gap-5">
            <div className="flex -space-x-4">
              {filteredProducts.slice(0, 3).map((p) => (
                <div
                  key={p.product.id}
                  className="h-12 w-12 overflow-hidden rounded-full border-4 border-background bg-muted ring-1 ring-primary/5 transition-transform hover:-translate-y-1"
                >
                  <img
                    src={p.product.images?.[0] || '/placeholder.svg'}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                </div>
              ))}
            </div>
            <div>
              <p className="text-sm font-black tracking-tight">Resumo da Decisão</p>
              <p className="text-xs font-medium text-muted-foreground">
                {filteredProducts.length} fornecedores filtrados de {allProducts.length} totais
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="mr-4 hidden flex-col items-end lg:flex">
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                Produto Selecionado
              </span>
              <span className="text-sm font-bold text-primary">{displayProduct.supplier.name}</span>
            </div>
            <Button
              variant="ghost"
              className="h-11 px-6 font-bold"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button className="h-11 bg-primary px-8 font-black shadow-xl shadow-primary/30 transition-all hover:bg-primary/90 active:scale-95">
              Confirmar Escolha <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ToggleFilter({
  label,
  active,
  onToggle,
}: {
  id: string;
  label: string;
  active: boolean;
  onToggle: () => void;
}) {
  return (
    <Button
      variant={active ? 'default' : 'outline'}
      size="sm"
      onClick={onToggle}
      className={cn(
        'h-9 rounded-full border-2 px-4 text-xs font-bold transition-all',
        active
          ? 'border-primary bg-primary shadow-lg shadow-primary/20'
          : 'border-border hover:bg-muted',
      )}
    >
      {label}
    </Button>
  );
}

const KPI_COLOR_CLASSES = {
  success: 'border-success/20 bg-success/5 text-success ring-1 ring-success/10',
  primary: 'border-primary/20 bg-primary/5 text-primary ring-1 ring-primary/10',
  neutral: 'border-border bg-muted/40 text-foreground',
} as const;

function KPICard({
  label,
  value,
  color,
}: {
  label: string;
  value: string | number;
  color: 'success' | 'primary' | 'neutral';
}) {
  return (
    <div
      className={cn(
        'rounded-2xl border p-4 transition-all hover:translate-y-[-2px] hover:shadow-md',
        KPI_COLOR_CLASSES[color],
      )}
    >
      <p className="mb-1.5 text-[10px] font-black uppercase tracking-widest opacity-60">{label}</p>
      <p className="text-2xl font-black tabular-nums">{value}</p>
    </div>
  );
}

function ComparisonRow({ row, formatCurrency, formatPercent }: ComparisonItemProps) {
  const {
    product: p,
    isBase,
    isLowestPrice,
    score,
    scoreBreakdown,
    priceDiffPercent,
    priceDiff,
  } = row;

  return (
    <TableRow
      className={cn(
        isBase && 'bg-primary/5 hover:bg-primary/10',
        'group border-b transition-colors',
      )}
    >
      <TableCell className="py-4">
        <div className="relative h-14 w-14 overflow-hidden rounded-xl border bg-muted shadow-sm transition-transform group-hover:scale-105">
          <img
            src={p.images?.[0] || '/placeholder.svg'}
            alt={`${p.name} - ${p.supplier.name}`}
            className="h-full w-full object-cover"
          />
          {isBase && (
            <div className="absolute inset-0 flex items-center justify-center bg-primary/30 backdrop-blur-[1px]">
              <Badge className="bg-primary px-1.5 text-[9px] font-black uppercase tracking-tighter text-white">
                Atual
              </Badge>
            </div>
          )}
        </div>
      </TableCell>
      <TableCell>
        <div className="flex flex-col space-y-1">
          <span className="line-clamp-1 text-sm font-black tracking-tight transition-colors group-hover:text-primary">
            {p.supplier.name}
          </span>
          <span className="line-clamp-1 text-xs font-medium text-muted-foreground">{p.name}</span>
          <div className="flex flex-wrap gap-1.5 pt-1">
            {isLowestPrice && (
              <Badge variant="default" className="h-4 bg-success text-[10px] font-black">
                Melhor Preço
              </Badge>
            )}
            {p.is_active !== false && (
              <Badge
                variant="outline"
                className="h-4 border-success/30 bg-success/5 text-[10px] font-bold text-success"
              >
                Ativo
              </Badge>
            )}
          </div>
        </div>
      </TableCell>
      <TableCell className="text-right">
        <div className="flex flex-col items-end">
          <div className="flex items-center gap-1.5">
            {p.minQuantity > 10 && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <AlertCircle className="h-3.5 w-3.5 text-warning" />
                  </TooltipTrigger>
                  <TooltipContent>MOQ Elevado: {p.minQuantity} un.</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            <span
              className={cn(
                'text-lg font-black tabular-nums tracking-tighter',
                isLowestPrice ? 'text-success' : 'text-foreground',
              )}
            >
              {formatCurrency(p.price)}
            </span>
          </div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80">
            Ticket: {formatCurrency(p.price * p.minQuantity)}
          </span>
        </div>
      </TableCell>
      <TableCell className="text-center">
        {!isBase ? (
          <div className="flex flex-col items-center gap-1.5">
            <PriceSparkline productId={p.id} />
            <div
              className={cn(
                'flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-black shadow-sm',
                priceDiffPercent > 0
                  ? 'bg-destructive/10 text-destructive'
                  : 'bg-success/10 text-success',
              )}
            >
              {priceDiffPercent > 0 ? (
                <TrendingUp className="h-3 w-3" />
              ) : (
                <TrendingDown className="h-3 w-3" />
              )}
              {formatPercent(priceDiffPercent)}
            </div>
            {priceDiff !== 0 && (
              <span className="text-[10px] font-bold tabular-nums text-muted-foreground/60">
                {priceDiff > 0 ? '+' : ''}
                {formatCurrency(priceDiff)}/un
              </span>
            )}
          </div>
        ) : (
          <span className="text-muted-foreground/30">
            <Minus className="mx-auto h-4 w-4" />
          </span>
        )}
      </TableCell>
      <TableCell className="text-center">
        <div className="flex flex-col">
          <span className="text-sm font-black tabular-nums">{p.stock.toLocaleString()}</span>
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground opacity-60">
            Em estoque
          </span>
        </div>
      </TableCell>
      <TableCell className="text-center text-sm font-black tabular-nums">
        {p.leadTimeDays ? (
          `${p.leadTimeDays}d`
        ) : (
          <span className="text-muted-foreground/30">—</span>
        )}
      </TableCell>
      <TableCell className="text-center">
        <ScoreBreakdown score={score} breakdown={scoreBreakdown} />
      </TableCell>
      <TableCell>
        <div className="flex gap-2">
          <Button
            size="sm"
            className={cn(
              'h-9 w-full rounded-xl text-xs font-black uppercase tracking-widest transition-all active:scale-95',
              isBase
                ? 'cursor-not-allowed bg-muted text-muted-foreground'
                : 'bg-primary shadow-lg shadow-primary/20',
            )}
            disabled={isBase}
          >
            {isBase ? 'Atual' : 'Trocar'}
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

function ComparisonCard({ row, formatCurrency, formatPercent }: ComparisonItemProps) {
  const { product: p, isBase, isLowestPrice, score, scoreBreakdown, priceDiffPercent } = row;

  return (
    <div
      className={cn(
        'relative flex flex-col rounded-3xl border-2 p-6 transition-all hover:translate-y-[-4px] hover:shadow-2xl',
        isBase
          ? 'border-primary bg-primary/5 shadow-xl shadow-primary/10 ring-4 ring-primary/5'
          : 'bg-background hover:border-primary/30',
      )}
    >
      <div className="mb-6 flex items-start justify-between">
        <div className="h-24 w-24 shrink-0 overflow-hidden rounded-2xl border-2 bg-muted shadow-md">
          <img
            src={p.images?.[0] || '/placeholder.svg'}
            alt={p.name}
            className="h-full w-full object-cover"
          />
        </div>
        <div className="flex flex-col items-end">
          <ScoreBreakdown score={score} breakdown={scoreBreakdown} label="Análise IA" />
          {isLowestPrice && (
            <Badge className="mt-2 bg-success text-[9px] font-black uppercase tracking-widest">
              Melhor Preço
            </Badge>
          )}
        </div>
      </div>

      <div className="mb-6">
        <h4 className="mb-2 line-clamp-1 text-xl font-black leading-tight tracking-tighter">
          {p.supplier.name}
        </h4>
        <p className="line-clamp-2 min-h-[32px] text-xs font-medium leading-relaxed text-muted-foreground">
          {p.name}
        </p>
      </div>

      <div className="mb-8 grid grid-cols-2 gap-6 rounded-2xl border border-dashed border-muted-foreground/20 bg-muted/30 p-4">
        <div className="space-y-1">
          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-60">
            Preço Unitário
          </p>
          <div className="flex flex-col">
            <span className="text-xl font-black tabular-nums">{formatCurrency(p.price)}</span>
            {!isBase && (
              <span
                className={cn(
                  'flex items-center gap-0.5 text-[11px] font-black',
                  priceDiffPercent > 0 ? 'text-destructive' : 'text-success',
                )}
              >
                {priceDiffPercent > 0 ? (
                  <TrendingUp className="h-2.5 w-2.5" />
                ) : (
                  <TrendingDown className="h-2.5 w-2.5" />
                )}
                {formatPercent(priceDiffPercent)}
              </span>
            )}
          </div>
        </div>
        <div className="space-y-1">
          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-60">
            Estoque
          </p>
          <p className="text-xl font-black tabular-nums">{p.stock.toLocaleString()}</p>
          <p className="text-[10px] font-bold uppercase text-muted-foreground">Unidades</p>
        </div>
      </div>

      <div className="mt-auto space-y-4">
        <div className="flex items-center justify-between px-1">
          <div className="flex flex-col">
            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              Pedido Mínimo
            </span>
            <span className={cn('text-sm font-bold', p.minQuantity > 10 && 'text-warning')}>
              {p.minQuantity} un.
            </span>
          </div>
          <PriceSparkline productId={p.id} />
        </div>
        <Button
          className="h-12 w-full rounded-2xl text-sm font-black uppercase tracking-widest shadow-xl shadow-primary/20 transition-all active:scale-95"
          variant={isBase ? 'secondary' : 'default'}
          disabled={isBase}
        >
          {isBase ? 'Produto Ativo' : 'Selecionar Fornecedor'}
        </Button>
      </div>
    </div>
  );
}

function ScoreBreakdown({
  score,
  breakdown,
  label,
}: {
  score: number;
  breakdown: Record<string, number>;
  label?: string;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" className="group inline-flex items-center gap-1.5">
          {label ? (
            <div className="flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-3 py-1.5 text-primary transition-all hover:bg-primary/20">
              <Sparkles className="h-3.5 w-3.5" />
              <span className="text-[10px] font-black uppercase tracking-widest">{label}</span>
            </div>
          ) : (
            <div className="flex flex-col items-center">
              <span className="text-sm font-black tabular-nums text-primary transition-transform group-hover:scale-110">
                {score}
              </span>
              <div className="mt-0.5 h-1.5 w-14 overflow-hidden rounded-full bg-muted">
                <div className="h-full bg-primary" style={{ width: `${score}%` }} />
              </div>
            </div>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 rounded-3xl border-primary/20 bg-background/95 p-6 shadow-2xl backdrop-blur-md">
        <div className="space-y-6">
          <div className="flex items-center justify-between border-b pb-4">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                <Sparkles className="h-4 w-4 text-primary" />
              </div>
              <h4 className="text-sm font-black uppercase tracking-tight">Análise IA</h4>
            </div>
            <span className="text-3xl font-black tabular-nums tracking-tighter text-primary">
              {score}
            </span>
          </div>
          <div className="space-y-4">
            {Object.entries(breakdown).map(([key, val]) => (
              <div key={key} className="space-y-2">
                <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-muted-foreground/80">
                  <span>{BREAKDOWN_LABELS[key] || key}</span>
                  <span className="text-foreground">
                    {val.toFixed(1)} / {WEIGHT_LIMITS[key]}
                  </span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <Progress value={(val / WEIGHT_LIMITS[key]) * 100} className="h-full" />
                </div>
              </div>
            ))}
          </div>
          <div className="rounded-2xl border border-dashed border-muted-foreground/30 bg-muted/50 p-3">
            <p className="text-[10px] font-medium italic leading-relaxed text-muted-foreground">
              "Esta pontuação é dinâmica e reflete o equilíbrio entre custo operacional,
              disponibilidade imediata e confiabilidade do fornecedor."
            </p>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
