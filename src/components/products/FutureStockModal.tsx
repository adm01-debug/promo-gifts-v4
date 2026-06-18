import { useState, useMemo } from 'react';
import { format, parseISO, addDays, isBefore } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  CalendarClock,
  Package,
  Truck,
  AlertTriangle,
  Calendar,
  TrendingUp,
  ArrowUpDown,
  Filter,
  Clock,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import {
  calculateColorSummary,
  processStockEntries,
  useProductVariantsWithStock,
} from '@/hooks/products/useVariantSupplierSources';
import { sortColorSummary } from '@/utils/colorSorting';
import { Skeleton } from '@/components/ui/skeleton';

type SortOrder = 'nearest' | 'farthest' | 'quantity-desc' | 'quantity-asc';
type DateFilter = 'all' | '7days' | '30days' | '90days' | 'past';

interface FutureStockModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productId: string;
  productName: string;
  productSku: string;
}

export function FutureStockModal({
  open,
  onOpenChange,
  productId,
  productName,
  productSku,
}: FutureStockModalProps) {
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<SortOrder>('nearest');
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');
  const [expandedGroups, setExpandedGroups] = useState<string[]>([]);

  const toggleGroup = (colorName: string) => {
    setExpandedGroups((prev) =>
      prev.includes(colorName) ? prev.filter((name) => name !== colorName) : [...prev, colorName],
    );
  };

  // Buscar variantes com dados de estoque/reposição
  const { data: variantsWithStock = [], isLoading, error } = useProductVariantsWithStock(productId);

  // Processar entradas de reposição (todas as 1/2/3 previsões)
  const allStockEntries = useMemo(
    () => processStockEntries(variantsWithStock),
    [variantsWithStock],
  );

  // Aplicar filtros de período e cor às entradas
  const { filteredEntries, periodFilteredEntries } = useMemo(() => {
    const now = new Date();
    // Normalizar "agora" para o início do dia para evitar que previsões de hoje pareçam "atrasadas" por causa do horário
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // 1. Filtrar primeiro apenas por período (usado para o resumo de cores)
    let periodFiltered = [...allStockEntries];
    if (dateFilter !== 'all') {
      periodFiltered = periodFiltered.filter((entry) => {
        const entryDate = parseISO(entry.expectedDate);
        switch (dateFilter) {
          case 'past':
            return isBefore(entryDate, todayStart);
          case '7days':
            // Inclui hoje + próximos 7 dias (até o final do 7º dia seguinte)
            return !isBefore(entryDate, todayStart) && isBefore(entryDate, addDays(todayStart, 8));
          case '30days':
            return !isBefore(entryDate, todayStart) && isBefore(entryDate, addDays(todayStart, 31));
          case '90days':
            return !isBefore(entryDate, todayStart) && isBefore(entryDate, addDays(todayStart, 91));
          default:
            return true;
        }
      });
    }

    // 2. Filtrar por cor (usado para a lista final)
    let finalFiltered = [...periodFiltered];
    if (selectedColor) {
      finalFiltered = finalFiltered.filter((entry) => entry.colorName === selectedColor);
    }

    return {
      filteredEntries: finalFiltered,
      periodFilteredEntries: periodFiltered,
    };
  }, [allStockEntries, dateFilter, selectedColor]);

  // Calcular resumo por cor usando as entradas filtradas por período
  // Isso garante que o grid de cores mostre a quantidade que chegará NO PERÍODO selecionado
  const colorSummary = useMemo(
    () => sortColorSummary(calculateColorSummary(variantsWithStock, periodFilteredEntries)),
    [variantsWithStock, periodFilteredEntries],
  );

  // Ordenar a lista final
  const sortedEntries = useMemo(() => {
    const entries = [...filteredEntries];
    entries.sort((a, b) => {
      switch (sortOrder) {
        case 'nearest': {
          const timeA = new Date(a.expectedDate).getTime();
          const timeB = new Date(b.expectedDate).getTime();
          if (timeA !== timeB) return timeA - timeB;
          return (a.entryIndex || 0) - (b.entryIndex || 0); // Desempate pelo índice da entrada
        }
        case 'farthest': {
          const timeA = new Date(a.expectedDate).getTime();
          const timeB = new Date(b.expectedDate).getTime();
          if (timeA !== timeB) return timeB - timeA;
          return (b.entryIndex || 0) - (a.entryIndex || 0);
        }
        case 'quantity-desc':
          return b.expectedQuantity - a.expectedQuantity;
        case 'quantity-asc':
          return a.expectedQuantity - b.expectedQuantity;
        default:
          return 0;
      }
    });
    return entries;
  }, [filteredEntries, sortOrder]);

  const hasNoFutureStock = allStockEntries.length === 0;
  const hasVariants = variantsWithStock.length > 0;
  const hasActiveFilters = selectedColor || dateFilter !== 'all';

  const clearFilters = () => {
    setSelectedColor(null);
    setDateFilter('all');
    setSortOrder('nearest');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-3xl gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b border-border p-6 pb-4">
          <DialogTitle className="flex items-center gap-3 text-xl">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-primary/10">
              <CalendarClock className="h-5 w-5 text-primary" />
            </div>
            <div>
              <span>Estoque Futuro</span>
              <p className="mt-0.5 text-sm font-normal text-muted-foreground">
                {productName} • SKU: {productSku}
              </p>
            </div>
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(85vh-120px)] flex-1">
          <div className="space-y-6 p-6">
            {/* Loading */}
            {isLoading && (
              <div className="space-y-4 p-4">
                <Skeleton className="h-10 w-full rounded-xl" />
                <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-8">
                  {Array.from({ length: 8 }, (_, i) => (
                    <Skeleton key={i} className="aspect-square rounded-lg" />
                  ))}
                </div>
                <div className="space-y-3 pt-6">
                  {Array.from({ length: 3 }, (_, i) => (
                    <Skeleton key={i} className="h-20 w-full rounded-xl" />
                  ))}
                </div>
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
                  <AlertTriangle className="h-8 w-8 text-destructive" />
                </div>
                <h3 className="mb-1 font-display font-medium text-foreground">
                  Erro ao carregar dados
                </h3>
                <p className="max-w-xs text-sm text-muted-foreground">
                  {error instanceof Error ? error.message : 'Erro desconhecido'}
                </p>
              </div>
            )}

            {/* Filtros e Ordenação */}
            {!isLoading && !error && colorSummary.length > 0 && (
              <div className="space-y-4">
                {/* Controles de filtro/ordenação */}
                <div className="flex flex-wrap items-center gap-3">
                  {/* Ordenação */}
                  <div className="flex items-center gap-2">
                    <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
                    <Select value={sortOrder} onValueChange={(v) => setSortOrder(v as SortOrder)}>
                      <SelectTrigger className="h-9 w-[180px] text-sm [&>span]:truncate [&>span]:whitespace-nowrap">
                        <SelectValue placeholder="Ordenar por" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="nearest">
                          <span className="flex items-center gap-2">
                            <Clock className="h-3.5 w-3.5" /> Mais próximo
                          </span>
                        </SelectItem>
                        <SelectItem value="farthest">
                          <span className="flex items-center gap-2">
                            <Calendar className="h-3.5 w-3.5" /> Mais distante
                          </span>
                        </SelectItem>
                        <SelectItem value="quantity-desc">
                          <span className="flex items-center gap-2">
                            <TrendingUp className="h-3.5 w-3.5" /> Maior qtd
                          </span>
                        </SelectItem>
                        <SelectItem value="quantity-asc">
                          <span className="flex items-center gap-2">
                            <Package className="h-3.5 w-3.5" /> Menor qtd
                          </span>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Filtro por período */}
                  <div className="flex items-center gap-2">
                    <Filter className="h-4 w-4 text-muted-foreground" />
                    <Select
                      value={dateFilter}
                      onValueChange={(v) => setDateFilter(v as DateFilter)}
                    >
                      <SelectTrigger className="h-9 w-[140px] text-sm">
                        <SelectValue placeholder="Período" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todas as datas</SelectItem>
                        <SelectItem value="7days">Próximos 7 dias</SelectItem>
                        <SelectItem value="30days">Próximos 30 dias</SelectItem>
                        <SelectItem value="90days">Próximos 90 dias</SelectItem>
                        <SelectItem value="past">Atrasados</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Limpar filtros */}
                  {hasActiveFilters && (
                    <button
                      onClick={clearFilters}
                      className="ml-auto text-xs text-primary hover:underline"
                    >
                      Limpar filtros
                    </button>
                  )}
                </div>

                {/* Grid de cores - compacto para exibir todas */}
                <div className="space-y-2">
                  <span className="text-sm font-medium text-muted-foreground">
                    Filtrar por variação ({colorSummary.length} cores)
                  </span>
                  <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-8">
                    {colorSummary.map((color) => {
                      const hasEntries = color.incomingCount > 0;
                      const isSelected = selectedColor === color.name;

                      return (
                        <Tooltip key={color.name}>
                          <TooltipTrigger asChild>
                            <button
                              type="button"
                              title={color.name}
                              aria-label={`Filtrar por cor ${color.name}`}
                              aria-pressed={isSelected}
                              onClick={() => setSelectedColor(isSelected ? null : color.name)}
                              className={cn(
                                'relative overflow-hidden rounded-lg transition-all duration-200',
                                'border bg-card hover:scale-105 hover:shadow-md',
                                isSelected &&
                                  'ring-2 ring-primary ring-offset-1 ring-offset-background',
                                !hasEntries && 'opacity-40 grayscale',
                              )}
                              style={{
                                borderColor: isSelected ? (color.hex ?? undefined) : undefined,
                              }}
                            >
                              {/* Imagem ou cor sólida */}
                              <div className="relative aspect-square overflow-hidden">
                                {color.thumbnail ? (
                                  <img
                                    src={color.thumbnail}
                                    alt={color.name}
                                    className="h-full w-full object-cover"
                                    loading="lazy"
                                  />
                                ) : (
                                  <div
                                    className="h-full w-full"
                                    style={{ backgroundColor: color.hex || '#888' }}
                                  />
                                )}
                                {/* Badge de quantidade incoming */}
                                {hasEntries && (
                                  <div className="absolute bottom-0.5 right-0.5 rounded bg-primary/90 px-1 py-0.5 text-[9px] font-bold text-primary-foreground">
                                    +
                                    {color.incomingTotal >= 1000
                                      ? `${(color.incomingTotal / 1000).toFixed(1)}k`
                                      : color.incomingTotal}
                                  </div>
                                )}
                                {/* Estoque atual no topo */}
                                <div className="absolute left-0.5 top-0.5 rounded bg-background/80 px-1 py-0.5 text-[9px] font-medium text-foreground">
                                  {color.currentStock >= 1000
                                    ? `${(color.currentStock / 1000).toFixed(1)}k`
                                    : color.currentStock}
                                </div>
                              </div>
                              {/* Nome da cor */}
                              <div className="bg-card p-1 text-center">
                                <span className="block truncate text-[10px] font-medium leading-tight">
                                  {color.name}
                                </span>
                              </div>
                            </button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <div className="flex flex-col gap-1">
                              <span className="font-semibold">{color.name}</span>
                              <span>Atual: {color.currentStock.toLocaleString('pt-BR')} un.</span>
                              <span>
                                Previsto: +{color.incomingTotal.toLocaleString('pt-BR')} un.
                              </span>
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* Estado vazio - sem variantes */}
            {!isLoading && !error && !hasVariants && (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                  <Package className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="mb-1 font-display font-medium text-foreground">
                  Produto sem variantes
                </h3>
                <p className="max-w-xs text-sm text-muted-foreground">
                  Este produto não possui variantes de cor cadastradas no sistema.
                </p>
              </div>
            )}

            {/* Lista de reposições futuras */}
            {!isLoading && !error && hasVariants && hasNoFutureStock ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                  <AlertTriangle className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="mb-1 font-display font-medium text-foreground">
                  Sem previsão de reposição
                </h3>
                <p className="max-w-xs text-sm text-muted-foreground">
                  Não há reposições agendadas para este produto no fornecedor.
                </p>
                <p className="mt-2 text-xs text-muted-foreground/70">
                  Dica: Previsões são fornecidas apenas pela API SPOT (Stricker).
                </p>
              </div>
            ) : (
              !isLoading &&
              !error &&
              hasVariants && (
                <div className="space-y-6">
                  {/* Agrupamento por cor */}
                  {[...new Set(sortedEntries.map((e) => e.colorName))].map((colorName) => {
                    const colorEntries = sortedEntries.filter((e) => e.colorName === colorName);
                    // Agrupar por variante dentro da cor
                    const variantIds = [...new Set(colorEntries.map((e) => e.variantId))];
                    const isExpanded =
                      expandedGroups.includes(colorName) || selectedColor === colorName;

                    return (
                      <div
                        key={colorName}
                        className="space-y-4 rounded-2xl border border-border/50 bg-muted/30 p-1"
                      >
                        <button
                          onClick={() => toggleGroup(colorName)}
                          className="flex w-full items-center justify-between rounded-xl p-3 transition-colors hover:bg-muted/50"
                        >
                          <div className="flex items-center gap-3 border-l-4 border-primary pl-3">
                            <div
                              className="h-4 w-4 rounded-full border border-background shadow-sm"
                              style={{ backgroundColor: colorEntries[0]?.colorHex || '#888' }}
                            />
                            <span className="text-sm font-bold uppercase tracking-wider text-foreground">
                              {colorName}
                            </span>
                            <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                              {colorEntries.length}{' '}
                              {colorEntries.length === 1 ? 'previsão' : 'previsões'}
                            </Badge>
                          </div>
                          {isExpanded ? (
                            <ChevronUp className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          )}
                        </button>

                        {isExpanded && (
                          <div className="space-y-6 px-3 pb-4">
                            {variantIds.map((vId) => {
                              // Ordenação cronológica automática dentro da variante
                              const variantEntries = colorEntries
                                .filter((e) => e.variantId === vId)
                                .sort(
                                  (a, b) =>
                                    new Date(a.expectedDate).getTime() -
                                    new Date(b.expectedDate).getTime(),
                                );

                              const first = variantEntries[0];

                              return (
                                <div key={vId} className="space-y-3">
                                  <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-tight text-muted-foreground/70">
                                    <Package className="h-3 w-3" />
                                    Variante SKU: {first.supplierSku}
                                  </div>

                                  <div className="relative grid gap-3 pl-4">
                                    {/* Linha vertical da timeline */}
                                    <div className="absolute bottom-2 left-1.5 top-2 w-0.5 bg-border/40" />

                                    {variantEntries.map((entry) => {
                                      const expectedDate = parseISO(entry.expectedDate);
                                      const daysUntil = Math.ceil(
                                        (expectedDate.getTime() - Date.now()) /
                                          (1000 * 60 * 60 * 24),
                                      );
                                      const isUrgent = daysUntil <= 7 && daysUntil >= 0;
                                      const isPast = daysUntil < 0;

                                      return (
                                        <div
                                          key={entry.id}
                                          className={cn(
                                            'relative flex items-center gap-4 rounded-xl border bg-card p-3 transition-all hover:border-primary/30',
                                            isUrgent && !isPast && 'border-warning/30 bg-warning/5',
                                            isPast && 'border-destructive/30 bg-destructive/5',
                                          )}
                                        >
                                          {/* Marcador da timeline */}
                                          <div
                                            className={cn(
                                              'absolute -left-[18px] h-2.5 w-2.5 rounded-full border-2 border-background',
                                              isPast
                                                ? 'bg-destructive'
                                                : isUrgent
                                                  ? 'bg-warning'
                                                  : 'bg-primary',
                                            )}
                                          />
                                          {/* Indicador visual de cor/thumb */}
                                          <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg border border-border">
                                            {entry.thumbnail ? (
                                              <img
                                                src={entry.thumbnail}
                                                alt={entry.colorName}
                                                className="h-full w-full object-cover"
                                                loading="lazy"
                                              />
                                            ) : (
                                              <div
                                                className="h-full w-full"
                                                style={{
                                                  backgroundColor: entry.colorHex ?? '#888',
                                                }}
                                              />
                                            )}
                                          </div>

                                          {/* Info */}
                                          <div className="min-w-0 flex-1">
                                            <div className="mb-0.5 flex items-center gap-2">
                                              <Badge
                                                variant="outline"
                                                className={cn(
                                                  'px-1.5 py-0 text-[9px] font-bold uppercase',
                                                  isPast
                                                    ? 'border-destructive/20 bg-destructive/10 text-destructive'
                                                    : isUrgent
                                                      ? 'border-warning/20 bg-warning/10 text-warning'
                                                      : 'border-primary/20 bg-primary/10 text-primary',
                                                )}
                                              >
                                                {isPast
                                                  ? 'Atrasado'
                                                  : isUrgent
                                                    ? 'Em breve'
                                                    : `Previsão ${entry.entryIndex}`}
                                              </Badge>
                                            </div>
                                            <div className="flex items-center gap-3 text-sm">
                                              <span className="flex items-center gap-1.5 font-medium text-foreground">
                                                <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                                                {format(expectedDate, "dd 'de' MMM", {
                                                  locale: ptBR,
                                                })}
                                              </span>
                                              <span
                                                className={cn(
                                                  'text-xs font-semibold',
                                                  isPast
                                                    ? 'text-destructive'
                                                    : isUrgent
                                                      ? 'text-warning'
                                                      : 'text-primary',
                                                )}
                                              >
                                                {isPast
                                                  ? `${Math.abs(daysUntil)}d atrasado`
                                                  : daysUntil === 0
                                                    ? 'chega hoje'
                                                    : `em ${daysUntil}d`}
                                              </span>
                                            </div>
                                          </div>

                                          {/* Quantidade */}
                                          <div className="shrink-0 text-right">
                                            <div className="flex items-baseline justify-end gap-1">
                                              <span className="text-lg font-bold text-primary">
                                                +{entry.expectedQuantity.toLocaleString('pt-BR')}
                                              </span>
                                              <span className="text-[10px] font-bold uppercase text-muted-foreground">
                                                un
                                              </span>
                                            </div>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )
            )}

            {/* Resumo total */}
            {!isLoading && !error && !hasNoFutureStock && sortedEntries.length > 0 && (
              <div className="rounded-xl border border-primary/20 bg-gradient-to-br from-primary/10 to-primary/5 p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/20">
                      <Truck className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <span className="font-medium text-foreground">
                        {hasActiveFilters ? 'Total filtrado' : 'Total previsto'}
                      </span>
                      <p className="text-sm text-muted-foreground">
                        {sortedEntries.length} reposição(ões) agendada(s)
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-2xl font-bold text-primary">
                      +
                      {sortedEntries
                        .reduce((sum, e) => sum + e.expectedQuantity, 0)
                        .toLocaleString('pt-BR')}
                    </span>
                    <p className="text-xs text-muted-foreground">unidades no total</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
