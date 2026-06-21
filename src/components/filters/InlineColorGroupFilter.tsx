import { useState, useMemo, useEffect } from 'react';
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
  hasSelectedChild?: boolean; // filho (variation) está selecionado
  onClick: () => void;
  label: string;
  selectedLabel?: string; // nome para o tooltip quando selecionado
  size?: 'lg' | 'md' | 'sm';
  hasVariations?: boolean;
  isExpanded?: boolean;
  onExpandToggle?: () => void;
}

const SWATCH_SIZE_CLASSES = { sm: 'w-6 h-6', md: 'w-8 h-8', lg: 'w-10 h-10' } as const;

function InlineColorSwatch({
  hexCode,
  isSelected,
  hasSelectedChild = false,
  onClick,
  label,
  selectedLabel,
  size = 'md',
  hasVariations,
  isExpanded,
  onExpandToggle,
}: InlineColorSwatchProps) {
  const isTransparent = !hexCode;
  const isLight = isLightColor(hexCode);

  // Texto do tooltip: quando selecionado, orienta a desmarcar
  const tooltipText = isSelected
    ? `${selectedLabel ?? label} · clique para desmarcar`
    : hasSelectedChild
    ? `${label} · selecionar grupo inteiro`
    : `Filtrar por ${label}`;

  return (
    <div className="relative">
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={onClick}
            aria-label={tooltipText}
            className={cn(
              SWATCH_SIZE_CLASSES[size],
              'flex items-center justify-center rounded-full border-2 transition-all duration-200',
              'hover:scale-110 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-offset-2',
              isSelected
                ? 'ring-2 ring-offset-1'
                : hasSelectedChild
                // Filho selecionado: borda tracejada sutil no pai
                ? 'border-dashed border-current opacity-80 hover:opacity-100'
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
                : hasSelectedChild
                ? {
                    borderColor: hexCode || '#ccc',
                    color: hexCode || '#ccc',
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
            {/* Ponto indicador: filho selecionado */}
            {!isSelected && hasSelectedChild && (
              <div
                className="h-2 w-2 rounded-full border border-white/60"
                style={{ backgroundColor: hexCode || '#ccc' }}
              />
            )}
          </button>
        </TooltipTrigger>
        <TooltipContent side="top">{tooltipText}</TooltipContent>
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
// COMPONENTE INLINE — MODO SELEÇÃO Única
//
// FEAT-COR-UNICA 2026-06-21: proibido selecionar mais de uma cor por vez.
// Quando o usuário clica num grupo, variação ou nuança, a seleção anterior é
// substituída (não acumulada). Isso garante que o card mostra exatamente
// 1 foto + 1 estoque da cor escolhida, sem ambiguidade.
//
// Hierarquia de seleção:
//   Grupo ("Azul") → agrega todas as variações do grupo
//   Variação ("Azul Royal") → específico — 1 foto + 1 estoque
//   Nuança ("Metalizado") → cross-cutting (todas as cores com esse acabamento)
//
// Ao clicar num grupo cujo filho está selecionado → troca para o grupo (mais amplo).
// Ao clicar na cor já selecionada → desmarca tudo.
// =====================================================

interface InlineColorGroupFilterProps {
  selection: ColorFilterSelection;
  onChange: (selection: ColorFilterSelection) => void;
  showNuances?: boolean;
  showVariations?: boolean;
  swatchSize?: 'lg' | 'md' | 'sm';
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

  // Mapa slug-da-variação → id-do-grupo-pai (para auto-expand e parent indicator)
  const variationToGroupId = useMemo(() => {
    const map = new Map<string, string>();
    if (!colorData) return map;
    for (const g of colorData.groups) {
      for (const v of g.variations) {
        map.set(v.slug, g.id);
      }
    }
    return map;
  }, [colorData]);

  // Conjunto de group IDs que têm alguma variação selecionada
  const groupsWithSelectedVariation = useMemo(() => {
    const set = new Set<string>();
    for (const vSlug of selection.variations) {
      const gId = variationToGroupId.get(vSlug);
      if (gId) set.add(gId);
    }
    return set;
  }, [selection.variations, variationToGroupId]);

  // AUTO-EXPAND: quando uma variação está selecionada (ex: restauração de URL),
  // expandir automaticamente o grupo pai para que o usuário veja a seleção ativa.
  useEffect(() => {
    if (selection.variations.length === 0 || !colorData) return;
    const groupsToExpand = new Set<string>();
    for (const vSlug of selection.variations) {
      const gId = variationToGroupId.get(vSlug);
      if (gId) groupsToExpand.add(gId);
    }
    if (groupsToExpand.size > 0) {
      setExpandedGroups((prev) => {
        const next = new Set(prev);
        let changed = false;
        for (const gId of groupsToExpand) {
          if (!next.has(gId)) { next.add(gId); changed = true; }
        }
        return changed ? next : prev;
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selection.variations.join(','), variationToGroupId, colorData]);

  // FEAT-COR-UNICA: nome da cor para exibição no badge
  const selectedColorName = useMemo(() => {
    if (!colorData) return null;
    if (selection.groups.length === 1) {
      return colorData.groups.find((g) => g.slug === selection.groups[0])?.name ?? null;
    }
    if (selection.variations.length === 1) {
      const vSlug = selection.variations[0];
      for (const g of colorData.groups) {
        const v = g.variations.find((v) => v.slug === vSlug);
        if (v) return v.name;
      }
    }
    if (selection.nuances.length === 1) {
      return colorData.nuances.find((n) => n.slug === selection.nuances[0])?.name ?? null;
    }
    return null;
  }, [colorData, selection]);

  const hasAnySelection =
    selection.groups.length > 0 ||
    selection.variations.length > 0 ||
    selection.nuances.length > 0;

  // FEAT-COR-UNICA: toggles exclusivos — seleção única
  const toggleGroup = (slug: string) => {
    const isDirectlySelected = selection.groups.includes(slug);
    if (isDirectlySelected) {
      // Desmarca tudo
      onChange({ groups: [], variations: [], nuances: [] });
    } else {
      // Seleciona exclusivamente este grupo (limpa variações e nuanças)
      onChange({ groups: [slug], variations: [], nuances: [] });
    }
  };

  const toggleVariation = (slug: string) => {
    const isSelected = selection.variations.includes(slug);
    if (isSelected) {
      // Desmarca tudo
      onChange({ groups: [], variations: [], nuances: [] });
    } else {
      // Seleciona exclusivamente esta variação (limpa grupos e nuanças)
      onChange({ groups: [], variations: [slug], nuances: [] });
    }
  };

  const toggleNuance = (slug: string) => {
    const isSelected = selection.nuances.includes(slug);
    if (isSelected) {
      // Desmarca tudo
      onChange({ groups: [], variations: [], nuances: [] });
    } else {
      // Seleciona exclusivamente esta nuança (limpa grupos e variações)
      onChange({ groups: [], variations: [], nuances: [slug] });
    }
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
              hasSelectedChild={groupsWithSelectedVariation.has(group.id)}
              onClick={() => toggleGroup(group.slug)}
              label={group.name}
              selectedLabel={group.name}
              size={swatchSize}
              hasVariations={showVariations && groupsWithVariations.has(group.id)}
              isExpanded={expandedGroups.has(group.id)}
              onExpandToggle={() => toggleExpand(group.id)}
            />
          ))}
        </div>

        {/* Badge: nome da cor selecionada + limpar */}
        {hasAnySelection && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Badge
              variant="secondary"
              className="max-w-[160px] truncate text-xs font-medium"
              title={selectedColorName ?? undefined}
            >
              {selectedColorName ?? '1 cor selecionada'}
            </Badge>
            <button
              type="button"
              onClick={() => onChange({ groups: [], variations: [], nuances: [] })}
              className="text-xs text-muted-foreground transition-colors hover:text-destructive"
              aria-label="Limpar filtro de cor"
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
                  {group.variations.map((v) => {
                    const isVariationSelected = selection.variations.includes(v.slug);
                    return (
                      <button
                        key={v.id}
                        onClick={() => toggleVariation(v.slug)}
                        aria-label={
                          isVariationSelected
                            ? `${v.name} selecionado · clique para desmarcar`
                            : `Filtrar por ${v.name}`
                        }
                        className={cn(
                          'flex items-center gap-1.5 rounded-full border px-2 py-1 text-xs transition-all hover:bg-accent',
                          isVariationSelected
                            ? 'border-primary bg-primary/10 font-medium text-primary'
                            : 'border-border',
                        )}
                      >
                        <div
                          className="h-3 w-3 flex-shrink-0 rounded-full border"
                          style={{ backgroundColor: v.hex_code || group.hex_code || '#ccc' }}
                        />
                        {v.name}
                        {isVariationSelected && (
                          <Check className="h-3 w-3 flex-shrink-0" />
                        )}
                      </button>
                    );
                  })}
                </div>
                {/* Hint de seleção exclusiva dentro do painel de variações */}
                <p className="text-[10px] text-muted-foreground/60">
                  Selecione uma variação para ver a foto e estoque específicos
                </p>
              </div>
            ))}

        {/* Nuanças/Acabamentos */}
        {showNuances && colorData.nuances.length > 0 && (
          <div>
            <h5 className="mb-1.5 flex items-center gap-1 text-xs font-medium text-muted-foreground">
              <Sparkles className="h-3 w-3" />
              Acabamento
            </h5>
            <div className="flex flex-wrap gap-1.5">
              {colorData.nuances.map((nuance) => {
                const isNuanceSelected = selection.nuances.includes(nuance.slug);
                return (
                  <button
                    key={nuance.id}
                    onClick={() => toggleNuance(nuance.slug)}
                    aria-label={
                      isNuanceSelected
                        ? `${nuance.name} selecionado · clique para desmarcar`
                        : `Filtrar por acabamento ${nuance.name}`
                    }
                    className={cn(
                      'rounded-full border px-3 py-1.5 text-xs transition-all hover:bg-accent',
                      isNuanceSelected
                        ? 'border-primary bg-primary/10 font-medium text-primary'
                        : 'border-border',
                    )}
                  >
                    {nuance.name}
                    {isNuanceSelected && (
                      <Check className="ml-1 inline h-3 w-3" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}

export default InlineColorGroupFilter;
