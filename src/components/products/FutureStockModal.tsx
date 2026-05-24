import { useState, useMemo } from "react";
import { format, parseISO, addDays, isAfter, isBefore } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarClock, Package, Truck, AlertTriangle, Calendar, TrendingUp, ArrowUpDown, Filter, Clock } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  useProductVariantsWithStock,
  processStockEntries,
  calculateColorSummary,
} from "@/hooks/products";
import { sortColorSummary } from "@/utils/colorSorting";
import { Skeleton } from "@/components/ui/skeleton";

type SortOrder = "nearest" | "farthest" | "quantity-desc" | "quantity-asc";
type DateFilter = "all" | "7days" | "30days" | "90days" | "past";

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
  const [sortOrder, setSortOrder] = useState<SortOrder>("nearest");
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");
  
  // Buscar variantes com dados de estoque/reposição
  const { data: variantsWithStock = [], isLoading, error } = useProductVariantsWithStock(productId);
  
  // Processar entradas de reposição
  const stockEntries = useMemo(
    () => processStockEntries(variantsWithStock),
    [variantsWithStock]
  );
  
  // Calcular resumo por cor e ordenar
  const colorSummary = useMemo(
    () => sortColorSummary(calculateColorSummary(variantsWithStock, stockEntries)),
    [variantsWithStock, stockEntries]
  );
  
  // Aplicar filtros e ordenação
  const filteredAndSortedEntries = useMemo(() => {
    const now = new Date();
    let entries = [...stockEntries];
    
    // Filtrar por cor
    if (selectedColor) {
      entries = entries.filter(entry => entry.colorName === selectedColor);
    }
    
    // Filtrar por período
    if (dateFilter !== "all") {
      entries = entries.filter(entry => {
        const entryDate = parseISO(entry.expectedDate);
        switch (dateFilter) {
          case "past":
            return isBefore(entryDate, now);
          case "7days":
            return isAfter(entryDate, now) && isBefore(entryDate, addDays(now, 7));
          case "30days":
            return isAfter(entryDate, now) && isBefore(entryDate, addDays(now, 30));
          case "90days":
            return isAfter(entryDate, now) && isBefore(entryDate, addDays(now, 90));
          default:
            return true;
        }
      });
    }
    
    // Ordenar
    entries.sort((a, b) => {
      switch (sortOrder) {
        case "nearest":
          return new Date(a.expectedDate).getTime() - new Date(b.expectedDate).getTime();
        case "farthest":
          return new Date(b.expectedDate).getTime() - new Date(a.expectedDate).getTime();
        case "quantity-desc":
          return b.expectedQuantity - a.expectedQuantity;
        case "quantity-asc":
          return a.expectedQuantity - b.expectedQuantity;
        default:
          return 0;
      }
    });
    
    return entries;
  }, [stockEntries, selectedColor, dateFilter, sortOrder]);
  
  const hasNoFutureStock = stockEntries.length === 0;
  const hasVariants = variantsWithStock.length > 0;
  const hasActiveFilters = selectedColor || dateFilter !== "all";
  
  const clearFilters = () => {
    setSelectedColor(null);
    setDateFilter("all");
    setSortOrder("nearest");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] p-0 gap-0 overflow-hidden">
        <DialogHeader className="p-6 pb-4 border-b border-border">
          <DialogTitle className="flex items-center gap-3 text-xl">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center">
              <CalendarClock className="h-5 w-5 text-primary" />
            </div>
            <div>
              <span>Estoque Futuro</span>
              <p className="text-sm font-normal text-muted-foreground mt-0.5">
                {productName} • SKU: {productSku}
              </p>
            </div>
          </DialogTitle>
        </DialogHeader>
        
        <ScrollArea className="flex-1 max-h-[calc(85vh-120px)]">
          <div className="p-6 space-y-6">
            {/* Loading */}
            {isLoading && (
              <div className="space-y-4 p-4">
                <Skeleton className="h-10 w-full rounded-xl" />
                <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
                  {[...Array(8)].map((_, i) => (
                    <Skeleton key={i} className="aspect-square rounded-lg" />
                  ))}
                </div>
                <div className="space-y-3 pt-6">
                  {[...Array(3)].map((_, i) => (
                    <Skeleton key={i} className="h-20 w-full rounded-xl" />
                  ))}
                </div>
              </div>
            )}
            
            {/* Error */}
            {error && (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
                  <AlertTriangle className="h-8 w-8 text-destructive" />
                </div>
                <h3 className="font-display font-medium text-foreground mb-1">
                  Erro ao carregar dados
                </h3>
                <p className="text-sm text-muted-foreground max-w-xs">
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
                      <SelectTrigger className="w-[160px] h-9 text-sm">
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
                    <Select value={dateFilter} onValueChange={(v) => setDateFilter(v as DateFilter)}>
                      <SelectTrigger className="w-[140px] h-9 text-sm">
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
                      className="text-xs text-primary hover:underline ml-auto"
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
                  <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
                    {colorSummary.map((color) => {
                      const hasEntries = color.incomingCount > 0;
                      const isSelected = selectedColor === color.name;
                      
                      return (
                        <button
                          key={color.name}
                          onClick={() => setSelectedColor(isSelected ? null : color.name)}
                          title={`${color.name}\nAtual: ${color.currentStock.toLocaleString("pt-BR")}\nPrevisto: +${color.incomingTotal.toLocaleString("pt-BR")}`}
                          className={cn(
                            "relative rounded-lg overflow-hidden transition-all duration-200",
                            "border bg-card hover:shadow-md hover:scale-105",
                            isSelected && "ring-2 ring-primary ring-offset-1 ring-offset-background",
                            !hasEntries && "opacity-40 grayscale"
                          )}
                          style={{
                            borderColor: isSelected ? color.hex : undefined,
                          }}
                        >
                          {/* Imagem ou cor sólida */}
                          <div className="aspect-square relative overflow-hidden">
                            {color.thumbnail ? (
                              <img
                                src={color.thumbnail}
                                alt={color.name}
                                className="w-full h-full object-cover" loading="lazy" />
                            ) : (
                              <div
                                className="w-full h-full"
                                style={{ backgroundColor: color.hex || '#888' }}
                              />
                            )}
                            {/* Badge de quantidade incoming */}
                            {hasEntries && (
                              <div className="absolute bottom-0.5 right-0.5 px-1 py-0.5 rounded bg-primary/90 text-primary-foreground text-[9px] font-bold">
                                +{color.incomingTotal >= 1000 ? `${(color.incomingTotal / 1000).toFixed(1)}k` : color.incomingTotal}
                              </div>
                            )}
                            {/* Estoque atual no topo */}
                            <div className="absolute top-0.5 left-0.5 px-1 py-0.5 rounded bg-background/80 text-foreground text-[9px] font-medium">
                              {color.currentStock >= 1000 ? `${(color.currentStock / 1000).toFixed(1)}k` : color.currentStock}
                            </div>
                          </div>
                          {/* Nome da cor */}
                          <div className="p-1 text-center bg-card">
                            <span className="text-[10px] font-medium truncate block leading-tight">
                              {color.name}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
            
            {/* Estado vazio - sem variantes */}
            {!isLoading && !error && !hasVariants && (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                  <Package className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="font-display font-medium text-foreground mb-1">
                  Produto sem variantes
                </h3>
                <p className="text-sm text-muted-foreground max-w-xs">
                  Este produto não possui variantes de cor cadastradas no sistema.
                </p>
              </div>
            )}
            
            {/* Lista de reposições futuras */}
            {!isLoading && !error && hasVariants && hasNoFutureStock ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                  <AlertTriangle className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="font-display font-medium text-foreground mb-1">
                  Sem previsão de reposição
                </h3>
                <p className="text-sm text-muted-foreground max-w-xs">
                  Não há reposições agendadas para este produto no fornecedor.
                </p>
                <p className="text-xs text-muted-foreground/70 mt-2">
                  Dica: Previsões são fornecidas apenas pela API SPOT (Stricker).
                </p>
              </div>
            ) : !isLoading && !error && hasVariants && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-muted-foreground">
                    Previsões de reposição ({filteredAndSortedEntries.length})
                  </span>
                  {filteredAndSortedEntries.length === 0 && hasActiveFilters && (
                    <span className="text-xs text-muted-foreground">
                      Nenhum resultado para os filtros selecionados
                    </span>
                  )}
                </div>
                <div className="space-y-3">
                  {filteredAndSortedEntries.map((entry) => {
                    const expectedDate = parseISO(entry.expectedDate);
                    const daysUntil = Math.ceil(
                      (expectedDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
                    );
                    const isUrgent = daysUntil <= 7 && daysUntil >= 0;
                    const isPast = daysUntil < 0;
                    
                    return (
                      <div
                        key={entry.id}
                        className={cn(
                          "flex items-center gap-4 p-4 rounded-xl border bg-card transition-all",
                          isUrgent && !isPast && "border-warning/30 bg-warning/5",
                          isPast && "border-destructive/30 bg-destructive/5"
                        )}
                      >
                        {/* Imagem ou Cor */}
                        <div className="w-12 h-12 rounded-xl shrink-0 overflow-hidden border border-border">
                          {entry.thumbnail ? (
                            <img
                              src={entry.thumbnail}
                              alt={entry.colorName}
                              className="w-full h-full object-cover" loading="lazy" />
                          ) : (
                            <div
                              className="w-full h-full"
                              style={{ backgroundColor: entry.colorHex }}
                            />
                          )}
                        </div>
                        
                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium text-foreground">
                              {entry.colorName}
                            </span>
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-[10px] px-2 py-0",
                                isPast 
                                  ? "bg-destructive/10 text-destructive border-destructive/20"
                                  : isUrgent
                                    ? "bg-warning/10 text-warning border-warning/20"
                                    : "bg-info/10 text-info border-info/20"
                              )}
                            >
                              {isPast ? "Atrasado" : isUrgent ? "Em breve" : `Previsão ${entry.entryIndex}`}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-3 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3.5 w-3.5" />
                              {format(expectedDate, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                              <span className={cn(
                                "ml-1 font-medium",
                                isPast ? "text-destructive" : isUrgent ? "text-warning" : "text-foreground/70"
                              )}>
                                ({isPast ? `${Math.abs(daysUntil)} dias atrás` : daysUntil === 0 ? "hoje" : daysUntil === 1 ? "amanhã" : `${daysUntil} dias`})
                              </span>
                            </span>
                            <span className="flex items-center gap-1">
                              <Package className="h-3.5 w-3.5" />
                              SKU: {entry.supplierSku}
                            </span>
                          </div>
                          {/* Estoque atual da variante */}
                          <div className="text-xs text-muted-foreground/70 mt-1">
                            Estoque atual: {entry.currentStock.toLocaleString("pt-BR")} un
                            {entry.reservedStock > 0 && (
                              <span className="ml-2">
                                (reservado: {entry.reservedStock.toLocaleString("pt-BR")})
                              </span>
                            )}
                          </div>
                        </div>
                        
                        {/* Quantidade */}
                        <div className="text-right shrink-0">
                          <span className="text-xl font-bold text-primary">
                            +{entry.expectedQuantity.toLocaleString("pt-BR")}
                          </span>
                          <p className="text-xs text-muted-foreground">unidades</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            
            {/* Resumo total */}
            {!isLoading && !error && !hasNoFutureStock && filteredAndSortedEntries.length > 0 && (
              <div className="p-4 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
                      <Truck className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <span className="font-medium text-foreground">
                        {hasActiveFilters ? "Total filtrado" : "Total previsto"}
                      </span>
                      <p className="text-sm text-muted-foreground">
                        {filteredAndSortedEntries.length} reposição(ões) agendada(s)
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-2xl font-bold text-primary">
                      +{filteredAndSortedEntries.reduce((sum, e) => sum + e.expectedQuantity, 0).toLocaleString("pt-BR")}
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
