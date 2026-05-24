import { useState, useMemo } from 'react';
import { Check, ChevronDown, ChevronRight, Sparkles, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { useColorSystem, isLightColor } from '@/hooks/products';

// =====================================================
// TIPOS
// =====================================================

export interface ColorFilterSelection {
  groups: string[];      // slugs dos grupos selecionados
  variations: string[];  // slugs das variações selecionadas
  nuances: string[];     // slugs das nuances selecionadas
}

interface ColorGroupFilterProps {
  selection: ColorFilterSelection;
  onChange: (selection: ColorFilterSelection) => void;
  showNuances?: boolean;
  showVariations?: boolean;
  className?: string;
}

// =====================================================
// COMPONENTE DE SWATCH (bolinha de cor)
// =====================================================

interface ColorSwatchProps {
  hexCode: string | null;
  isSelected: boolean;
  onClick: () => void;
  label: string;
  size?: 'sm' | 'md' | 'lg';
  showCheckmark?: boolean;
}

function ColorSwatch({ 
  hexCode, 
  isSelected, 
  onClick, 
  label, 
  size = 'md',
  showCheckmark = true 
}: ColorSwatchProps) {
  const sizeClasses = {
    sm: 'w-6 h-6',
    md: 'w-8 h-8',
    lg: 'w-10 h-10',
  };

  const isTransparent = !hexCode || hexCode.toLowerCase() === '#ffffff';
  const isLight = isLightColor(hexCode);

  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      className={cn(
        sizeClasses[size],
        'rounded-full border-2 transition-all duration-200 flex items-center justify-center',
        'hover:scale-110 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2',
        isSelected 
          ? 'border-primary ring-2 ring-primary ring-offset-1' 
          : 'border-border hover:border-muted-foreground/50',
        isTransparent && 'bg-gradient-to-br from-gray-100 to-gray-200'
      )}
      style={{ 
        backgroundColor: isTransparent ? undefined : (hexCode || '#ccc'),
      }}
     aria-label="Confirmar">
      {isSelected && showCheckmark && (
        <Check 
          className={cn(
            'w-4 h-4',
            isLight ? 'text-foreground' : 'text-primary-foreground'
          )} 
        />
      )}
      {isTransparent && !isSelected && (
        <div className="w-full h-full rounded-full border border-dashed border-border" />
      )}
    </button>
  );
}

// =====================================================
// COMPONENTE PRINCIPAL
// =====================================================

export function ColorGroupFilter({
  selection,
  onChange,
  showNuances = true,
  showVariations = true,
  className,
}: ColorGroupFilterProps) {
  const { data: colorData, isLoading } = useColorSystem();
  const [isOpen, setIsOpen] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  // Contagem de seleções
  const totalSelected = useMemo(() => {
    return selection.groups.length + selection.variations.length + selection.nuances.length;
  }, [selection]);

  // Nomes das cores selecionadas para exibição
  const selectedNames = useMemo(() => {
    if (!colorData) return [];
    
    const names: string[] = [];
    
    // Grupos
    colorData.groups.forEach(group => {
      if (selection.groups.includes(group.slug)) {
        names.push(group.name);
      }
      // Variações
      group.variations.forEach(variation => {
        if (selection.variations.includes(variation.slug)) {
          names.push(variation.name);
        }
      });
    });
    
    // Nuances
    colorData.nuances.forEach(nuance => {
      if (selection.nuances.includes(nuance.slug)) {
        names.push(nuance.name);
      }
    });
    
    return names;
  }, [colorData, selection]);

  // Toggle grupo
  const toggleGroup = (slug: string, groupId: string) => {
    const isSelected = selection.groups.includes(slug);
    const newGroups = isSelected
      ? selection.groups.filter(g => g !== slug)
      : [...selection.groups, slug];
    
    // Auto-expandir variações quando seleciona o grupo
    if (!isSelected) {
      const newExpanded = new Set(expandedGroups);
      newExpanded.add(groupId);
      setExpandedGroups(newExpanded);
    }
    
    onChange({ ...selection, groups: newGroups });
  };

  // Toggle variação
  const toggleVariation = (slug: string) => {
    const newVariations = selection.variations.includes(slug)
      ? selection.variations.filter(v => v !== slug)
      : [...selection.variations, slug];
    
    onChange({ ...selection, variations: newVariations });
  };

  // Toggle nuance
  const toggleNuance = (slug: string) => {
    const newNuances = selection.nuances.includes(slug)
      ? selection.nuances.filter(n => n !== slug)
      : [...selection.nuances, slug];
    
    onChange({ ...selection, nuances: newNuances });
  };

  // Expandir/recolher grupo
  const toggleExpand = (groupId: string) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(groupId)) {
      newExpanded.delete(groupId);
    } else {
      newExpanded.add(groupId);
    }
    setExpandedGroups(newExpanded);
  };

  // Limpar tudo e fechar popover
  const clearAll = () => {
    onChange({ groups: [], variations: [], nuances: [] });
    setIsOpen(false);
  };

  if (isLoading) {
    return (
      <div className={cn('space-y-2', className)}>
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  if (!colorData) {
    return null;
  }

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={isOpen}
          className={cn(
            'w-full justify-between h-auto min-h-10 py-2',
            totalSelected > 0 && 'border-primary',
            className
          )}
        >
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-4 rounded-full bg-gradient-to-r from-destructive via-success to-info" />
              <span className="text-sm font-medium">Cores</span>
            </div>
            
            {totalSelected > 0 && (
              <>
                <Badge variant="secondary" className="text-xs">
                  {totalSelected} selecionado{totalSelected > 1 ? 's' : ''}
                </Badge>
                
                {/* Preview das cores selecionadas */}
                <div className="flex -space-x-1">
                  {selectedNames.slice(0, 3).map((name, i) => {
                    const group = colorData.groups.find(g => g.name === name);
                    const variation = colorData.groups
                      .flatMap(g => g.variations)
                      .find(v => v.name === name);
                    const hex = variation?.hex_code || group?.hex_code || '#ccc';
                    
                    return (
                      <div
                        key={i}
                        className="w-5 h-5 rounded-full border-2 border-background"
                        style={{ backgroundColor: hex }}
                        title={name}
                      />
                    );
                  })}
                  {selectedNames.length > 3 && (
                    <div className="w-5 h-5 rounded-full border-2 border-background bg-muted flex items-center justify-center text-[10px] font-medium">
                      +{selectedNames.length - 3}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
          
          <ChevronDown className={cn(
            'ml-2 h-4 w-4 shrink-0 opacity-50 transition-transform',
            isOpen && 'rotate-180'
          )} />
        </Button>
      </PopoverTrigger>
      
      <PopoverContent className="w-80 p-0" align="start">
        <div className="p-3 border-b">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-sm">Filtrar por Cor</h4>
            {totalSelected > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearAll}
                className="h-7 text-xs text-muted-foreground hover:text-destructive"
              >
                <X className="w-3 h-3 mr-1" />
                Limpar
              </Button>
            )}
          </div>
        </div>
        
        <ScrollArea className="max-h-[50vh] overflow-auto">
          <div className="p-3 space-y-4 pr-4">
            {/* Grupos de Cor (Swatches) */}
            <div>
              <h5 className="text-xs font-medium text-muted-foreground mb-2">
                Grupos de Cor
              </h5>
              <div className="flex flex-wrap gap-2">
                {colorData.groups.map((group) => (
                  <div key={group.id} className="relative group/swatch">
                    <ColorSwatch
                      hexCode={group.hex_code}
                      isSelected={selection.groups.includes(group.slug)}
                      onClick={() => toggleGroup(group.slug, group.id)}
                      label={group.name}
                      size="md"
                    />
                    
                    {/* Tooltip com nome */}
                    <div className="absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 bg-popover border rounded shadow-sm text-xs whitespace-nowrap opacity-0 group-hover/swatch:opacity-100 transition-opacity pointer-events-none z-10">
                      {group.name}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            {/* Variações Expandidas */}
            {showVariations && (
              <div className="space-y-2">
                {colorData.groups
                  .filter(group => expandedGroups.has(group.id) && group.variations.length > 1)
                  .map((group) => (
                    <Collapsible
                      key={group.id}
                      open={expandedGroups.has(group.id)}
                      onOpenChange={() => toggleExpand(group.id)}
                    >
                      <CollapsibleTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full justify-between h-8 px-2"
                        >
                          <div className="flex items-center gap-2">
                            <div
                              className="w-4 h-4 rounded-full border"
                              style={{ backgroundColor: group.hex_code || '#ccc' }}
                            />
                            <span className="text-sm">{group.name}</span>
                            <Badge variant="outline" className="text-[10px] h-4">
                              {group.variations.length} tons
                            </Badge>
                          </div>
                          <ChevronRight className={cn(
                            'h-4 w-4 transition-transform',
                            expandedGroups.has(group.id) && 'rotate-90'
                          )} />
                        </Button>
                      </CollapsibleTrigger>
                      
                      <CollapsibleContent className="pl-6 pt-2">
                        <div className="flex flex-wrap gap-1.5">
                          {group.variations.map((variation) => (
                            <button
                              key={variation.id}
                              onClick={() => toggleVariation(variation.slug)}
                              className={cn(
                                'flex items-center gap-1.5 px-2 py-1 rounded-full text-xs transition-all',
                                'border hover:bg-accent',
                                selection.variations.includes(variation.slug)
                                  ? 'border-primary bg-primary/10 text-primary'
                                  : 'border-border'
                              )}
                            >
                              <div
                                className="w-3 h-3 rounded-full border"
                                style={{ backgroundColor: variation.hex_code || group.hex_code || '#ccc' }}
                              />
                              {variation.name}
                              {selection.variations.includes(variation.slug) && (
                                <Check className="w-3 h-3" />
                              )}
                            </button>
                          ))}
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  ))}
              </div>
            )}
            
            {/* Nuances/Acabamentos */}
            {showNuances && colorData.nuances.length > 0 && (
              <div>
                <h5 className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                  <Sparkles className="w-3 h-3" />
                  Acabamento
                </h5>
                <div className="flex flex-wrap gap-1.5">
                  {colorData.nuances.map((nuance) => (
                    <button
                      key={nuance.id}
                      onClick={() => toggleNuance(nuance.slug)}
                      className={cn(
                        'px-3 py-1.5 rounded-full text-xs transition-all',
                        'border hover:bg-accent',
                        selection.nuances.includes(nuance.slug)
                          ? 'border-primary bg-primary/10 text-primary font-medium'
                          : 'border-border'
                      )}
                    >
                      {nuance.name}
                      {selection.nuances.includes(nuance.slug) && (
                        <Check className="w-3 h-3 ml-1 inline" />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
        
        {/* Footer com resumo */}
        {totalSelected > 0 && (
          <div className="p-3 border-t bg-muted/30">
            <p className="text-xs text-muted-foreground">
              {selectedNames.slice(0, 4).join(', ')}
              {selectedNames.length > 4 && ` +${selectedNames.length - 4} mais`}
            </p>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

// =====================================================
// VERSÃO COMPACTA (apenas swatches inline)
// =====================================================

interface ColorSwatchBarProps {
  selection: ColorFilterSelection;
  onChange: (selection: ColorFilterSelection) => void;
  className?: string;
}

export function ColorSwatchBar({ selection, onChange, className }: ColorSwatchBarProps) {
  const { data: colorData, isLoading } = useColorSystem();

  const toggleGroup = (slug: string) => {
    const newGroups = selection.groups.includes(slug)
      ? selection.groups.filter(g => g !== slug)
      : [...selection.groups, slug];
    
    onChange({ ...selection, groups: newGroups });
  };

  if (isLoading) {
    return (
      <div className={cn('flex gap-1.5', className)}>
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="w-6 h-6 rounded-full" />
        ))}
      </div>
    );
  }

  if (!colorData) return null;

  return (
    <div className={cn('flex flex-wrap gap-1.5', className)}>
      {colorData.groups.map((group) => (
        <ColorSwatch
          key={group.id}
          hexCode={group.hex_code}
          isSelected={selection.groups.includes(group.slug)}
          onClick={() => toggleGroup(group.slug)}
          label={group.name}
          size="sm"
        />
      ))}
    </div>
  );
}

export default ColorGroupFilter;
