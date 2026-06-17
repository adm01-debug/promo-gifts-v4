import { useState, useMemo } from 'react';
import { Check, ChevronDown, ChevronUp, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useColorSystem, isLightColor } from '@/hooks/products';
import type { ColorFilterSelection } from './ColorGroupFilter';

// =====================================================
// SWATCH COM RADIX TOOLTIP
// =====================================================

interface InlineColorSwatchProps {
  hexCode: string | null;
  isSelected: boolean;
  onClick: () => void;
  label: string;
  size?: 'sm' | 'md' | 'lg';
  hasVariations?: boolean;
  isExpanded?: boolean;
  onExpandToggle?: () => void;
}

const SWATCH_SIZE_CLASSES = { sm: 'w-6 h-6', md: 'w-8 h-8', lg: 'w-10 h-10' } as const;

function InlineColorSwatch({
  hexCode,
  isSelected,
  onClick,
  label,
  size = 'md',
  hasVariations,
  isExpanded,
  onExpandToggle,
}: InlineColorSwatchProps) {
  const isTransparent = !hexCode;
  const isLight = isLightColor(hexCode);

  return (
    <div className="relative">
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={onClick}
            aria-label={`Filtrar por cor ${label}`}
            className={cn(
              SWATCH_SIZE_CLASSES[size],
              'flex items-center justify-center rounded-full border-2 transition-all duration-200',
              'hover:scale-110 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-offset-2',
              isSelected
                ? 'ring-2 ring-offset-1'
                : 'border-border hover:border-muted-foreground/50',
              isTransparent && '',
            )}
            style={{
              background: isTransparent
                ? 'conic-gradient(from 0deg, #FF0000, #FF8000, #FFFF00, #00FF00, #0000FF, #8000FF, #FF0000)'
                : undefined,
              backgroundColor: isTransparent ? undefined : hexCode || '#ccc',
              ...(isSelected
                ? {
                    borderColor: hexCode || '#ccc',
                    ['--tw-ring-color' as string]: hexCode || '#ccc',
                  }
                : {}),
            }}
          >
            {isSelected && (
              <Check
                className="h-4 w-4"
                style={{ color: isLight ? '#000000' : '#FFFFFF' }}
                strokeWidth={3}
              />
            )}
          </button>
        </TooltipTrigger>
        <TooltipContent side="top">{label}</TooltipContent>
      </Tooltip>
      {/* Indicador de variações */}
      {hasVariations && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onExpandToggle?.();
          }}
          className={cn(
            'absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full',
            'border border-border bg-background shadow-sm transition-colors hover:bg-muted',
            isExpanded && 'border-primary/40 bg-primary/10',
          )}
          aria-label={`Expandir variações de ${label}`}
        >
          {isExpanded ? (
            <ChevronUp className="h-2.5 w-2.5 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-2.5 w-2.5 text-muted-foreground" />
          )}
        </button>
      )}
    </div>
  );
}

// =====================================================
// COMPONENTE INLINE
// =====================================================

interface InlineColorGroupFilterProps {
  selection: ColorFilterSelection;
  onChange: (selection: ColorFilterSelection) => void;
  showNuances?: boolean;
  showVariations?: boolean;
  swatchSize?: 'sm' | 'md' | 'lg';
}

export function InlineColorGroupFilter({
  selection,
  onChange,
  showNuances = true,
  showVariations = true,
  swatchSize = 'md',
}: InlineColorGroupFilterProps) {
  const { data: colorData, isLoading } = useColorSystem();
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const totalSelected = useMemo(
    () => selection.groups.length + selection.variations.length + selection.nuances.length,
    [selection],
  );

  const toggleGroup = (slug: string) => {
    const isSelected = selection.groups.includes(slug);
    const newGroups = isSelected
      ? selection.groups.filter((g) => g !== slug)
      : [...selection.groups, slug];
    onChange({ ...selection, groups: newGroups });
  };

  const toggleVariation = (slug: string) => {
    const newVariations = selection.variations.includes(slug)
      ? selection.variations.filter((v) => v !== slug)
      : [...selection.variations, slug];
    onChange({ ...selection, variations: newVariations });
  };

  const toggleNuance = (slug: string) => {
    const newNuances = selection.nuances.includes(slug)
      ? selection.nuances.filter((n) => n !== slug)
      : [...selection.nuances, slug];
    onChange({ ...selection, nuances: newNuances });
  };

  const toggleExpand = (groupId: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  };

  if (isLoading) {
    return (
      <div className="flex flex-wrap gap-1.5">
        {Array.from({ length: 10 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-8 rounded-full" />
        ))}
      </div>
    );
  }

  if (!colorData) return null;

  // Groups that have variations (more than 1)
  const groupsWithVariations = new Set(
    colorData.groups.filter((g) => g.variations.length > 1).map((g) => g.id),
  );

  return (
    <TooltipProvider>
      <div className="space-y-3">
        {/* Swatches grid */}
        <div
          className={cn(
            'scrollbar-thin scrollbar-thumb-muted-foreground/30 scrollbar-track-transparent flex flex-wrap gap-2 overflow-y-auto overscroll-contain pr-1',
            swatchSize === 'sm' ? 'gap-1.5' : 'gap-2.5',
            swatchSize === 'sm' ? 'max-h-[6rem]' : 'max-h-[8.4rem]',
          )}
          style={{ scrollbarWidth: 'thin', scrollbarGutter: 'stable' }}
        >
          {colorData.groups.map((group) => (
            <InlineColorSwatch
              key={group.id}
              hexCode={group.hex_code}
              isSelected={selection.groups.includes(group.slug)}
              onClick={() => toggleGroup(group.slug)}
              label={group.name}
              size={swatchSize}
              hasVariations={showVariations && groupsWithVariations.has(group.id)}
              isExpanded={expandedGroups.has(group.id)}
              onExpandToggle={() => toggleExpand(group.id)}
            />
          ))}
        </div>

        {/* Badge de seleção + limpar */}
        {totalSelected > 0 && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Badge variant="secondary" className="text-xs">
              {totalSelected} selecionado{totalSelected > 1 ? 's' : ''}
            </Badge>
            <button
              type="button"
              onClick={() => onChange({ groups: [], variations: [], nuances: [] })}
              className="text-xs text-muted-foreground transition-colors hover:text-destructive"
              aria-label="Limpar filtros de cor"
            >
              Limpar
            </button>
          </div>
        )}

        {/* Variações expandidas */}
        {showVariations &&
          colorData.groups
            .filter((g) => expandedGroups.has(g.id) && g.variations.length > 1)
            .map((group) => (
              <div
                key={group.id}
                className="space-y-2 rounded-lg border border-border/50 bg-muted/20 p-2.5"
              >
                <div className="flex items-center gap-2 text-sm">
                  <div
                    className="h-4 w-4 rounded-full border"
                    style={{ backgroundColor: group.hex_code || '#ccc' }}
                  />
                  <span className="text-xs font-medium">{group.name}</span>
                  <Badge variant="outline" className="ml-auto h-4 text-[10px]">
                    {group.variations.length} variações
                  </Badge>
                </div>
                <div
                  className="flex max-h-32 flex-wrap gap-1.5 overflow-y-auto overscroll-contain"
                  style={{ overscrollBehavior: 'contain' }}
                >
                  {group.variations.map((v) => (
                    <button
                      key={v.id}
                      onClick={() => toggleVariation(v.slug)}
                      aria-label={`Filtrar por ${v.name}`}
                      className={cn(
                        'flex items-center gap-1.5 rounded-full border px-2 py-1 text-xs transition-all hover:bg-accent',
                        selection.variations.includes(v.slug)
                          ? 'border-primary bg-primary/10 font-medium text-primary'
                          : 'border-border',
                      )}
                    >
                      <div
                        className="h-3 w-3 flex-shrink-0 rounded-full border"
                        style={{ backgroundColor: v.hex_code || group.hex_code || '#ccc' }}
                      />
                      {v.name}
                      {selection.variations.includes(v.slug) && (
                        <Check className="h-3 w-3 flex-shrink-0" />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            ))}

        {/* Nuances/Acabamentos */}
        {showNuances && colorData.nuances.length > 0 && (
          <div>
            <h5 className="mb-1.5 flex items-center gap-1 text-xs font-medium text-muted-foreground">
              <Sparkles className="h-3 w-3" />
              Acabamento
            </h5>
            <div className="flex flex-wrap gap-1.5">
              {colorData.nuances.map((nuance) => (
                <button
                  key={nuance.id}
                  onClick={() => toggleNuance(nuance.slug)}
                  aria-label={`Filtrar por acabamento ${nuance.name}`}
                  className={cn(
                    'rounded-full border px-3 py-1.5 text-xs transition-all hover:bg-accent',
                    selection.nuances.includes(nuance.slug)
                      ? 'border-primary bg-primary/10 font-medium text-primary'
                      : 'border-border',
                  )}
                >
                  {nuance.name}
                  {selection.nuances.includes(nuance.slug) && (
                    <Check className="ml-1 inline h-3 w-3" />
                  )}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}

export default InlineColorGroupFilter;
