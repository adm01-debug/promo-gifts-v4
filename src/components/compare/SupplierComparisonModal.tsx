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
  Minus,
  ShieldCheck,
  Clock,
  Palette,
  Sparkles,
  LayoutGrid,
  List,
  Info,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  useSupplierComparison,
  type Product,
  type SupplierComparisonSort,
} from '@/hooks/products';
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

export function SupplierComparisonModal({
  product,
  open,
  onOpenChange,
}: SupplierComparisonModalProps) {
  const navigate = useNavigate();
  const [onlyVerified, setOnlyVerified] = useState(false);
  const [sortBy, setSortBy] = useState<SupplierComparisonSort>('score');
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  const [selectedForDuel, setSelectedForDuel] = useState<string[]>([]);

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
      filtered = filtered.filter(p => p.isVerified);
    }
    if (activeFilters.includes('moq10')) {
      filtered = filtered.filter(p => (p.product.minQuantity ?? 1) <= 10);
    }
    if (activeFilters.includes('instock')) {
      filtered = filtered.filter(p => p.product.stock > 0);
    }
    return filtered;
  }, [allProducts, onlyVerified, activeFilters]);

  const winner = useMemo(() => {
    return allProducts.reduce((prev, current) => (prev.score > current.score) ? prev : current, allProducts[0]);
  }, [allProducts]);

  const winnerReason = useMemo(() => {
    if (!winner) return '';
    const { scoreBreakdown } = winner;
    const topFactor = Object.entries(scoreBreakdown).reduce((a, b) => a[1] > b[1] ? a : b);
    const factorLabels: Record<string, string> = {
      price: 'melhor preço',
      stock: 'maior estoque',
      colors: 'maior variedade de cores',
      moq: 'baixo pedido mínimo',
      lead: 'entrega mais rápida',
      verified: 'fornecedor ativo e confiável'
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
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-20 w-full rounded-lg" />
              ))}
            </div>
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
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
            <p className="text-sm text-muted-foreground">Tente buscar por outra categoria ou produto.</p>
            <Button variant="outline" className="mt-6" onClick={() => onOpenChange(false)}>Fechar</Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const { lowestPrice, highestStock, maxEconomiaPorMOQ, fastestLeadTimeDays } = comparison;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-6xl p-0 overflow-hidden flex flex-col">
        <div className="p-6 border-b bg-muted/30">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Building2 className="h-6 w-6 text-primary" />
              </div>
              <div>
                <DialogTitle className="text-xl">Comparador de Fornecedores</DialogTitle>
                <p className="text-sm text-muted-foreground">
                  {displayProduct.name} · {allProducts.length} opções encontradas
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as 'table' | 'grid')}>
                <TabsList className="h-9">
                  <TabsTrigger value="table" className="h-7 gap-1.5">
                    <List className="h-4 w-4" /> Tabela
                  </TabsTrigger>
                  <TabsTrigger value="grid" className="h-7 gap-1.5">
                    <LayoutGrid className="h-4 w-4" /> Cards
                  </TabsTrigger>
                </TabsList>
              </Tabs>
              <Button variant="outline" size="icon" title="Exportar">
                <ExternalLink className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-6">
            <div className="flex items-center gap-2">
              <Label htmlFor="cmp-sort" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Ordenar
              </Label>
              <Select value={sortBy} onValueChange={(v) => setSortBy(v as SupplierComparisonSort)}>
                <SelectTrigger id="cmp-sort" className="h-9 w-[180px] bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(SORT_LABEL).map(([val, label]) => (
                    <SelectItem key={val} value={val}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <Switch
                id="cmp-verified"
                checked={onlyVerified}
                onCheckedChange={setOnlyVerified}
              />
              <Label htmlFor="cmp-verified" className="cursor-pointer text-sm font-medium">
                Somente ativos
              </Label>
            </div>
          </div>
        </div>

        <ScrollArea className="flex-1 p-6">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-5 mb-8">
            <KPICard label="Menor Preço" value={formatCurrency(lowestPrice)} color="success" />
            <KPICard label="Maior Estoque" value={`${highestStock.toLocaleString()} un.`} color="primary" />
            <KPICard label="Alternativas" value={comparison.alternatives.length} color="neutral" />
            <KPICard label="Economia Máx." value={formatCurrency(maxEconomiaPorMOQ)} color="success" />
            {fastestLeadTimeDays && <KPICard label="Lead Time Mín." value={`${fastestLeadTimeDays} dias`} color="neutral" />}
          </div>

          {viewMode === 'table' ? (
            <div className="rounded-xl border bg-background overflow-hidden">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead className="w-[80px]">Prod</TableHead>
                    <TableHead>Fornecedor</TableHead>
                    <TableHead className="text-right">Preço / Ticket</TableHead>
                    <TableHead className="text-center">Variação</TableHead>
                    <TableHead className="text-center">Estoque</TableHead>
                    <TableHead className="text-center">Lead</TableHead>
                    <TableHead className="text-center">Score</TableHead>
                    <TableHead className="w-[120px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allProducts.map((row) => (
                    <ComparisonRow key={row.product.id} row={row} formatCurrency={formatCurrency} formatPercent={formatPercent} />
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {allProducts.map((row) => (
                <ComparisonCard key={row.product.id} row={row} formatCurrency={formatCurrency} formatPercent={formatPercent} />
              ))}
            </div>
          )}
        </ScrollArea>

        <div className="p-4 border-t bg-muted/30 flex justify-between items-center">
          <p className="text-xs text-muted-foreground italic">
            * O score é calculado com base em preço (35%), estoque (20%), MOQ (15%), cores (15%), lead time (10%) e verificação (10%).
          </p>
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>Fechar</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function KPICard({ label, value, color }: { label: string; value: string | number; color: 'success' | 'primary' | 'neutral' }) {
  const colorMap = {
    success: 'border-success/20 bg-success/5 text-success',
    primary: 'border-primary/20 bg-primary/5 text-primary',
    neutral: 'border-border bg-muted/50 text-foreground',
  };
  return (
    <div className={cn('rounded-xl border p-4 transition-all hover:shadow-sm', colorMap[color])}>
      <p className="text-[10px] uppercase font-bold tracking-widest opacity-70 mb-1">{label}</p>
      <p className="text-xl font-bold">{value}</p>
    </div>
  );
}

function ComparisonRow({ row, formatCurrency, formatPercent }: any) {
  const { product: p, isBase, isLowestPrice, score, scoreBreakdown, priceDiffPercent, priceDiff } = row;

  return (
    <TableRow className={cn(isBase && 'bg-primary/5 hover:bg-primary/10 transition-colors', 'group')}>
      <TableCell>
        <div className="relative h-12 w-12 rounded-lg border bg-muted overflow-hidden">
          <img src={p.images?.[0] || '/placeholder.svg'} alt={p.name} className="h-full w-full object-cover" />
          {isBase && <div className="absolute inset-0 bg-primary/20 flex items-center justify-center"><Badge className="scale-75">Atual</Badge></div>}
        </div>
      </TableCell>
      <TableCell>
        <div className="flex flex-col">
          <span className="font-bold text-sm line-clamp-1 group-hover:text-primary transition-colors">{p.supplier.name}</span>
          <span className="text-xs text-muted-foreground line-clamp-1">{p.name}</span>
          <div className="flex gap-1 mt-1">
            {isLowestPrice && <Badge variant="default" className="bg-success text-[10px] h-4">Melhor Preço</Badge>}
            {p.is_active !== false && <Badge variant="outline" className="text-[10px] h-4 text-success border-success/30">Ativo</Badge>}
          </div>
        </div>
      </TableCell>
      <TableCell className="text-right">
        <div className="flex flex-col">
          <div className="flex items-center justify-end gap-1.5">
            {p.minQuantity > 10 && <AlertCircle className="h-3 w-3 text-warning" />}
            <span className={cn('font-bold', isLowestPrice ? 'text-success' : 'text-foreground')}>
              {formatCurrency(p.price)}
            </span>
          </div>
          <span className="text-[10px] text-muted-foreground">
            MOQ {p.minQuantity} · {formatCurrency(p.price * p.minQuantity)} total
          </span>
        </div>
      </TableCell>
      <TableCell className="text-center">
        {!isBase && (
          <div className="flex flex-col items-center">
            <PriceSparkline productId={p.id} className="mb-1" />
            <div className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded flex items-center gap-0.5', priceDiffPercent > 0 ? 'bg-destructive/10 text-destructive' : 'bg-success/10 text-success')}>
              {priceDiffPercent > 0 ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />}
              {formatPercent(priceDiffPercent)}
            </div>
            {!isBase && priceDiff !== 0 && (
              <span className="text-[10px] text-muted-foreground mt-0.5">
                {priceDiff > 0 ? '+' : ''}{formatCurrency(priceDiff)}/un
              </span>
            )}
          </div>
        )}
      </TableCell>
      <TableCell className="text-center">
        <div className="flex flex-col">
          <span className="font-bold text-sm">{p.stock.toLocaleString()}</span>
          <span className="text-[10px] text-muted-foreground">un. disponível</span>
        </div>
      </TableCell>
      <TableCell className="text-center text-sm font-medium">
        {p.leadTimeDays ? `${p.leadTimeDays}d` : '—'}
      </TableCell>
      <TableCell className="text-center">
        <ScoreBreakdown score={score} breakdown={scoreBreakdown} />
      </TableCell>
      <TableCell>
        <div className="flex gap-2">
          <Button size="sm" className={cn('h-8 text-xs font-bold w-full', isBase ? 'bg-muted text-muted-foreground' : 'bg-primary')} disabled={isBase}>
            {isBase ? 'Atual' : 'Trocar'}
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

function ComparisonCard({ row, formatCurrency, formatPercent }: any) {
  const { product: p, isBase, isLowestPrice, score, scoreBreakdown, priceDiffPercent } = row;

  return (
    <div className={cn(
      'relative flex flex-col rounded-2xl border p-5 transition-all hover:shadow-lg',
      isBase ? 'border-primary/40 bg-primary/5 ring-1 ring-primary/20' : 'bg-background'
    )}>
      {isBase && <Badge className="absolute -top-2 -right-2 px-3 py-1 shadow-sm">Produto Atual</Badge>}
      
      <div className="flex gap-4 mb-4">
        <div className="h-20 w-20 rounded-xl border bg-muted overflow-hidden shrink-0">
          <img src={p.images?.[0] || '/placeholder.svg'} alt={p.name} className="h-full w-full object-cover" />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="font-bold text-lg truncate group-hover:text-primary transition-colors">{p.supplier.name}</h4>
          <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed mb-2">{p.name}</p>
          <div className="flex flex-wrap gap-1.5">
            {isLowestPrice && <Badge className="bg-success">Melhor Preço</Badge>}
            {p.is_active !== false && <Badge variant="outline" className="text-success border-success/30">Ativo</Badge>}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="space-y-1">
          <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Preço</p>
          <div className="flex items-baseline gap-2">
            <span className="text-xl font-bold">{formatCurrency(p.price)}</span>
            {!isBase && <span className={cn('text-[10px] font-bold', priceDiffPercent > 0 ? 'text-destructive' : 'text-success')}>
              ({formatPercent(priceDiffPercent)})
            </span>}
          </div>
          <p className="text-[10px] text-muted-foreground">MOQ: {p.minQuantity} un.</p>
        </div>
        <div className="space-y-1">
          <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Estoque</p>
          <p className="text-xl font-bold">{p.stock.toLocaleString()}</p>
          <p className="text-[10px] text-muted-foreground">unidades</p>
        </div>
      </div>

      <div className="mt-auto space-y-4">
        <div className="p-3 bg-muted/40 rounded-xl space-y-2">
          <div className="flex justify-between items-center text-xs font-bold">
            <span>Score de Recomendação</span>
            <span className="text-primary">{score}/100</span>
          </div>
          <Progress value={score} className="h-1.5" />
          <div className="flex justify-between">
            <ScoreBreakdown score={score} breakdown={scoreBreakdown} label="Ver Detalhes" />
            <PriceSparkline productId={p.id} />
          </div>
        </div>
        <Button className="w-full font-bold h-11" variant={isBase ? 'outline' : 'default'} disabled={isBase}>
          {isBase ? 'Produto Atual' : 'Adicionar ao Orçamento'}
        </Button>
      </div>
    </div>
  );
}

function ScoreBreakdown({ score, breakdown, label }: { score: number; breakdown: Record<string, number>; label?: string }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="inline-flex items-center gap-1 hover:opacity-80 transition-opacity">
          {label ? (
            <span className="text-[10px] font-bold text-primary underline decoration-dotted">{label}</span>
          ) : (
            <div className="flex flex-col items-center">
              <span className="text-sm font-bold text-primary">{score}</span>
              <Progress value={score} className="h-1 w-12" />
            </div>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-4 shadow-2xl border-primary/20">
        <div className="space-y-4">
          <div className="flex items-center justify-between pb-2 border-b">
            <h4 className="font-bold text-sm flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" /> Análise do Score</h4>
            <span className="text-xl font-black text-primary">{score}</span>
          </div>
          <div className="space-y-3">
            {Object.entries(breakdown).map(([key, val]) => (
              <div key={key} className="space-y-1">
                <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  <span>{BREAKDOWN_LABELS[key] || key}</span>
                  <span>{val.toFixed(1)} / {WEIGHT_LIMITS[key]}</span>
                </div>
                <Progress value={(val / WEIGHT_LIMITS[key]) * 100} className="h-1" />
              </div>
            ))}
          </div>
          <p className="text-[9px] text-muted-foreground leading-relaxed pt-2 border-t">
            * O score pondera variáveis críticas para garantir a melhor decisão de compra.
          </p>
        </div>
      </PopoverContent>
    </Popover>
  );
}

const WEIGHT_LIMITS: Record<string, number> = {
  price: 35,
  stock: 20,
  colors: 15,
  moq: 15,
  lead: 10,
  verified: 10,
};
