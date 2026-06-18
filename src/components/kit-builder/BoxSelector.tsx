/**
 * Box Selector
 * Seletor de caixa/embalagem para o kit com filtros avançados
 */

import { useState, useMemo } from 'react';
import { Search, Package, Check, Ruler, Box, SlidersHorizontal, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BoxCardSkeleton } from './KitCardSkeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Collapsible, CollapsibleContent } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import {
  formatVolume,
  formatDimensions,
  formatCurrency,
  type KitBox,
  type BoxFilters,
} from '@/lib/kit-builder';

interface BoxSelectorProps {
  boxes: KitBox[];
  selectedBox: KitBox | null;
  isLoading: boolean;
  filters: BoxFilters;
  onFiltersChange: (filters: BoxFilters) => void;
  onSelect: (box: KitBox) => void;
  onClear: () => void;
}

export function BoxSelector({
  boxes,
  selectedBox,
  isLoading,
  filters,
  onFiltersChange,
  onSelect,
  onClear,
}: BoxSelectorProps) {
  const [searchValue, setSearchValue] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);

  const handleSearchChange = (value: string) => {
    setSearchValue(value);
    onFiltersChange({ ...filters, search: value || undefined });
  };

  // Extract unique materials from boxes
  const materials = useMemo(() => {
    const set = new Set<string>();
    boxes.forEach((b) => {
      if (b.material) set.add(b.material);
    });
    return [...set].sort();
  }, [boxes]);

  // Dimension ranges for sliders
  const maxDims = useMemo(() => {
    let w = 0,
      h = 0,
      d = 0;
    boxes.forEach((b) => {
      if (b.internalWidth > w) w = b.internalWidth;
      if (b.internalHeight > h) h = b.internalHeight;
      if (b.internalDepth > d) d = b.internalDepth;
    });
    return { width: Math.ceil(w) || 50, height: Math.ceil(h) || 50, depth: Math.ceil(d) || 50 };
  }, [boxes]);

  const hasActiveFilters = !!(
    filters.minWidth ||
    filters.minHeight ||
    filters.minDepth ||
    filters.material
  );

  const activeFilterCount = [
    filters.minWidth,
    filters.minHeight,
    filters.minDepth,
    filters.material,
  ].filter(Boolean).length;

  const clearAdvancedFilters = () => {
    onFiltersChange({
      ...filters,
      minWidth: undefined,
      minHeight: undefined,
      minDepth: undefined,
      material: undefined,
    });
  };

  // Se já tem uma caixa selecionada, mostra resumo
  if (selectedBox) {
    return (
      <Card className="border-primary bg-primary/5">
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <div className="h-24 w-24 flex-shrink-0 overflow-hidden rounded-lg bg-secondary">
              {selectedBox.imageUrl ? (
                <img
                  src={selectedBox.imageUrl}
                  alt={selectedBox.name}
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <Package className="h-10 w-10 text-muted-foreground" />
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="mb-1 flex items-center gap-2">
                <Badge variant="default" className="bg-primary">
                  <Check className="mr-1 h-3 w-3" />
                  Selecionada
                </Badge>
              </div>
              <h3 className="truncate font-display text-lg font-semibold">{selectedBox.name}</h3>
              <p className="font-mono text-sm text-muted-foreground">{selectedBox.sku}</p>
              <div className="mt-3 flex flex-wrap gap-3">
                <div className="flex items-center gap-1.5 text-sm">
                  <Ruler className="h-4 w-4 text-muted-foreground" />
                  <span>
                    {formatDimensions(
                      selectedBox.internalWidth,
                      selectedBox.internalHeight,
                      selectedBox.internalDepth,
                    )}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-sm">
                  <Box className="h-4 w-4 text-muted-foreground" />
                  <span>{formatVolume(selectedBox.internalVolume)}</span>
                </div>
                <div className="font-semibold text-primary">
                  {formatCurrency(selectedBox.price)}
                </div>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={onClear}>
              Trocar
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search + filter toggle */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar caixa ou embalagem..."
            value={searchValue}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button
          variant={hasActiveFilters ? 'default' : 'outline'}
          size="icon"
          aria-label="SlidersHorizontal"
          onClick={() => setFiltersOpen(!filtersOpen)}
          className="relative flex-shrink-0"
          title="Filtros avançados"
        >
          <SlidersHorizontal className="h-4 w-4" />
          {activeFilterCount > 0 && (
            <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
              {activeFilterCount}
            </span>
          )}
        </Button>
      </div>

      {/* Advanced filters */}
      <Collapsible open={filtersOpen} onOpenChange={setFiltersOpen}>
        <CollapsibleContent>
          <Card className="border-dashed">
            <CardContent className="space-y-4 p-4">
              <div className="flex items-center justify-between">
                <h4 className="flex items-center gap-2 text-sm font-semibold">
                  <SlidersHorizontal className="h-4 w-4" />
                  Filtros Avançados
                </h4>
                {hasActiveFilters && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 gap-1 text-xs"
                    onClick={clearAdvancedFilters}
                  >
                    <X className="h-3 w-3" />
                    Limpar
                  </Button>
                )}
              </div>

              {/* Dimension sliders */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">
                    Largura mín:{' '}
                    <span className="font-semibold text-foreground">{filters.minWidth ?? 0}cm</span>
                  </Label>
                  <Slider
                    min={0}
                    max={maxDims.width}
                    step={1}
                    value={[filters.minWidth ?? 0]}
                    onValueChange={([v]) =>
                      onFiltersChange({ ...filters, minWidth: v || undefined })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">
                    Altura mín:{' '}
                    <span className="font-semibold text-foreground">
                      {filters.minHeight || 0}cm
                    </span>
                  </Label>
                  <Slider
                    min={0}
                    max={maxDims.height}
                    step={1}
                    value={[filters.minHeight || 0]}
                    onValueChange={([v]) =>
                      onFiltersChange({ ...filters, minHeight: v || undefined })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">
                    Profundidade mín:{' '}
                    <span className="font-semibold text-foreground">{filters.minDepth ?? 0}cm</span>
                  </Label>
                  <Slider
                    min={0}
                    max={maxDims.depth}
                    step={1}
                    value={[filters.minDepth ?? 0]}
                    onValueChange={([v]) =>
                      onFiltersChange({ ...filters, minDepth: v || undefined })
                    }
                  />
                </div>
              </div>

              {/* Material filter */}
              {materials.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Material</Label>
                  <Select
                    value={filters.material || '_all'}
                    onValueChange={(v) =>
                      onFiltersChange({ ...filters, material: v === '_all' ? undefined : v })
                    }
                  >
                    <SelectTrigger className="w-full sm:w-64">
                      <SelectValue placeholder="Todos os materiais" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_all">Todos os materiais</SelectItem>
                      {materials.map((m) => (
                        <SelectItem key={m} value={m}>
                          {m}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </CardContent>
          </Card>
        </CollapsibleContent>
      </Collapsible>

      {/* Box list */}
      <ScrollArea className="h-[50vh] pr-4">
        {isLoading ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {[1, 2, 3, 4].map((i) => (
              <BoxCardSkeleton key={i} />
            ))}
          </div>
        ) : boxes.length === 0 ? (
          <div className="py-12 text-center">
            <Package className="mx-auto mb-3 h-12 w-12 text-muted-foreground" />
            <p className="text-muted-foreground">Nenhuma caixa encontrada</p>
            <p className="text-sm text-muted-foreground">Tente ajustar os filtros</p>
            {hasActiveFilters && (
              <Button variant="link" size="sm" className="mt-2" onClick={clearAdvancedFilters}>
                Limpar filtros
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {boxes.map((box) => (
              <Card
                key={box.id}
                className={cn(
                  'group cursor-pointer rounded-xl border-border/50 transition-all duration-200 will-change-transform',
                  'hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg',
                  'focus-within:ring-2 focus-within:ring-primary/60',
                )}
                onClick={() => onSelect(box)}
              >
                <CardContent className="p-4">
                  <div className="flex gap-3">
                    <div className="h-20 w-20 flex-shrink-0 overflow-hidden rounded-lg bg-secondary">
                      {box.imageUrl ? (
                        <img
                          src={box.imageUrl}
                          alt={box.name}
                          className="h-full w-full object-cover transition-transform group-hover:scale-105"
                          loading="lazy"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center">
                          <Package className="h-8 w-8 text-muted-foreground" />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="truncate font-medium transition-colors group-hover:text-primary">
                        {box.name}
                      </h4>
                      <p className="mb-2 font-mono text-xs text-muted-foreground">{box.sku}</p>
                      <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                        <span>
                          {formatDimensions(
                            box.internalWidth,
                            box.internalHeight,
                            box.internalDepth,
                          )}
                        </span>
                        <span>•</span>
                        <span>{formatVolume(box.internalVolume)}</span>
                        {box.material && (
                          <>
                            <span>•</span>
                            <span>{box.material}</span>
                          </>
                        )}
                      </div>
                      <p className="mt-1 font-semibold text-primary">{formatCurrency(box.price)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
