import { dbInvoke } from '@/lib/db/postgrest';
import { type ExternalTechnique } from '@/types/external-db';
import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Slider } from '@/components/ui/slider';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Clock,
  Palette,
  Search,
  Zap,
  AlertTriangle,
  CheckCircle2,
  Package,
  Filter,
  X,
  Info,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Technique {
  id: string;
  code: string | null;
  name: string;
  description: string | null;
  setup_cost: number | null;
  unit_cost: number | null;
  min_quantity: number | null;
  estimated_days: number | null;
  is_active: boolean;
}

interface TechniqueSelectorProps {
  onSelect: (technique: Technique | null) => void;
  selectedId?: string;
  quantity?: number;
  maxDays?: number;
  showFilters?: boolean;
  compact?: boolean;
}

type SLAFilter = 'all' | 'express' | 'standard' | 'extended';

const SLA_OPTIONS: Array<{
  value: SLAFilter;
  label: string;
  maxDays: number | null;
  icon: React.ReactNode;
}> = [
  { value: 'all', label: 'Todos', maxDays: null, icon: <Palette className="h-3 w-3" /> },
  { value: 'express', label: 'Express (≤3 dias)', maxDays: 3, icon: <Zap className="h-3 w-3" /> },
  {
    value: 'standard',
    label: 'Normal (4-7 dias)',
    maxDays: 7,
    icon: <Clock className="h-3 w-3" />,
  },
  {
    value: 'extended',
    label: 'Estendido (8+ dias)',
    maxDays: null,
    icon: <AlertTriangle className="h-3 w-3" />,
  },
];

function formatCurrency(value: number | null): string {
  if (!value) return '—';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

function getSLABadgeStyle(days: number | null): string {
  if (!days) return 'bg-muted text-muted-foreground';
  if (days <= 3) return 'bg-primary/10 text-primary border-primary/30';
  if (days <= 7) return 'bg-warning/10 text-warning border-warning/30';
  return 'bg-destructive/10 text-destructive border-destructive/30';
}

export function TechniqueSelector({
  onSelect,
  selectedId,
  quantity = 100,
  maxDays,
  showFilters = true,
  compact = false,
}: TechniqueSelectorProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [slaFilter, setSlaFilter] = useState<SLAFilter>('all');
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 1000]);
  const [showActiveFilters, setShowActiveFilters] = useState(false);

  const { data: techniques, isLoading } = useQuery({
    queryKey: ['techniques-selector-external'],
    queryFn: async () => {
      const result = await dbInvoke<Technique>({
        table: 'personalization_techniques',
        operation: 'select',
        filters: { is_active: true },
        orderBy: { column: 'name', ascending: true },
        limit: 100,
      });
      // Mapear campos do BD externo para interface
      return result.records.map((t) => {
        const ext = t as Technique & Pick<ExternalTechnique, 'setup_price' | 'handling_price'>;
        return {
          ...t,
          setup_cost: ext.setup_price ?? t.setup_cost ?? null,
          unit_cost: ext.handling_price ?? t.unit_cost ?? null,
        };
      });
    },
    staleTime: 10 * 60 * 1000, // 10 minutos
  });

  const filteredTechniques = useMemo(() => {
    if (!techniques) return [];

    return techniques.filter((t) => {
      // Search filter
      if (searchQuery) {
        const search = searchQuery.toLowerCase();
        const matchesName = t.name.toLowerCase().includes(search);
        const matchesCode = t.code?.toLowerCase().includes(search);
        const matchesDesc = t.description?.toLowerCase().includes(search);
        if (!matchesName && !matchesCode && !matchesDesc) return false;
      }

      // SLA filter
      if (slaFilter !== 'all') {
        const days = t.estimated_days || 999;
        if (slaFilter === 'express' && days > 3) return false;
        if (slaFilter === 'standard' && (days < 4 || days > 7)) return false;
        if (slaFilter === 'extended' && days < 8) return false;
      }

      // Max days filter (from prop)
      if (maxDays && t.estimated_days && t.estimated_days > maxDays) return false;

      // Price range filter
      const totalCost = (t.setup_cost ?? 0) + (t.unit_cost ?? 0) * quantity;
      if (totalCost < priceRange[0] || totalCost > priceRange[1]) return false;

      return true;
    });
  }, [techniques, searchQuery, slaFilter, priceRange, quantity, maxDays]);

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (searchQuery) count++;
    if (slaFilter !== 'all') count++;
    if (priceRange[0] > 0 || priceRange[1] < 1000) count++;
    return count;
  }, [searchQuery, slaFilter, priceRange]);

  const clearFilters = () => {
    setSearchQuery('');
    setSlaFilter('all');
    setPriceRange([0, 1000]);
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {showFilters && (
        <div className="space-y-3">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar técnica..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-9"
            />
            {searchQuery && (
              <Button
                variant="ghost"
                size="sm"
                className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2 p-0"
                onClick={() => setSearchQuery('')}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>

          {/* SLA Quick Filters */}
          <div className="flex flex-wrap gap-2">
            {SLA_OPTIONS.map((option) => (
              <Button
                key={option.value}
                variant={slaFilter === option.value ? 'default' : 'outline'}
                size="sm"
                className="h-8"
                onClick={() => setSlaFilter(option.value)}
              >
                {option.icon}
                <span className="ml-1">{option.label}</span>
              </Button>
            ))}
          </div>

          {/* Advanced filters toggle */}
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground"
              onClick={() => setShowActiveFilters(!showActiveFilters)}
            >
              <Filter className="mr-1 h-4 w-4" />
              Super Filtro
              {activeFiltersCount > 0 && (
                <Badge variant="secondary" className="ml-2 h-5 w-5 justify-center p-0">
                  {activeFiltersCount}
                </Badge>
              )}
            </Button>

            {activeFiltersCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground hover:text-destructive"
                onClick={clearFilters}
              >
                <X className="mr-1 h-4 w-4" />
                Limpar Filtros
              </Button>
            )}
          </div>

          {/* Advanced filters panel */}
          {showActiveFilters && (
            <div className="space-y-4 rounded-lg bg-muted/50 p-4">
              <div>
                <Label className="text-sm">Faixa de Preço (p/ {quantity} un.)</Label>
                <div className="mt-2 px-2">
                  <Slider
                    value={priceRange}
                    onValueChange={(value) => setPriceRange(value as [number, number])}
                    max={1000}
                    step={50}
                    className="w-full"
                  />
                  <div className="mt-1 flex justify-between text-xs text-muted-foreground">
                    <span>{formatCurrency(priceRange[0])}</span>
                    <span>{formatCurrency(priceRange[1])}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Results count */}
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          {filteredTechniques.length} técnica{filteredTechniques.length !== 1 ? 's' : ''} encontrada
          {filteredTechniques.length !== 1 ? 's' : ''}
        </span>
        <span className="flex items-center gap-1">
          <Info className="h-3 w-3" />
          Qtd: {quantity} unidades
        </span>
      </div>

      {/* Techniques list */}
      <RadioGroup
        value={selectedId}
        onValueChange={(value) => {
          const technique = filteredTechniques.find((t) => t.id === value);
          onSelect(technique || null);
        }}
        className="space-y-2"
      >
        {filteredTechniques.map((technique) => {
          const totalCost = (technique.setup_cost ?? 0) + (technique.unit_cost ?? 0) * quantity;
          const minQtyMet = !technique.min_quantity || quantity >= technique.min_quantity;
          const isSelected = selectedId === technique.id;

          return (
            <TooltipProvider key={technique.id}>
              <div
                className={cn(
                  'relative flex items-center gap-3 rounded-lg border p-3 transition-all',
                  isSelected
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/50',
                  !minQtyMet && 'pointer-events-none opacity-60',
                  compact ? 'p-2' : 'p-3',
                )}
              >
                <RadioGroupItem value={technique.id} id={technique.id} disabled={!minQtyMet} />

                <Label
                  htmlFor={technique.id}
                  className="flex flex-1 cursor-pointer items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{technique.name}</span>
                        {technique.code && (
                          <Badge variant="outline" className="font-mono text-[10px]">
                            {technique.code}
                          </Badge>
                        )}
                      </div>
                      {!compact && technique.description && (
                        <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                          {technique.description}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {technique.estimated_days && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Badge
                            variant="outline"
                            className={cn('gap-1', getSLABadgeStyle(technique.estimated_days))}
                          >
                            {technique.estimated_days <= 3 ? (
                              <Zap className="h-3 w-3" />
                            ) : technique.estimated_days <= 7 ? (
                              <Clock className="h-3 w-3" />
                            ) : (
                              <AlertTriangle className="h-3 w-3" />
                            )}
                            {technique.estimated_days}d
                          </Badge>
                        </TooltipTrigger>
                        <TooltipContent>
                          Prazo: {technique.estimated_days} dias úteis
                        </TooltipContent>
                      </Tooltip>
                    )}

                    {technique.min_quantity && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span
                            className={cn(
                              'flex items-center gap-1 text-xs',
                              minQtyMet ? 'text-muted-foreground' : 'text-destructive',
                            )}
                          >
                            <Package className="h-3 w-3" />
                            {technique.min_quantity}+
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>Mínimo: {technique.min_quantity} unidades</TooltipContent>
                      </Tooltip>
                    )}

                    <div className="text-right">
                      <div className="text-sm font-semibold">{formatCurrency(totalCost)}</div>
                      {!compact && (
                        <div className="text-[10px] text-muted-foreground">p/ {quantity} un.</div>
                      )}
                    </div>
                  </div>
                </Label>

                {isSelected && (
                  <CheckCircle2 className="absolute right-3 top-3 h-4 w-4 text-primary" />
                )}
              </div>
            </TooltipProvider>
          );
        })}
      </RadioGroup>

      {filteredTechniques.length === 0 && (
        <div className="py-8 text-center text-muted-foreground">
          <Palette className="mx-auto mb-4 h-12 w-12 opacity-50" />
          <p>Nenhuma técnica encontrada</p>
          {activeFiltersCount > 0 && (
            <Button variant="link" size="sm" className="mt-2" onClick={clearFilters}>
              Limpar filtros
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
