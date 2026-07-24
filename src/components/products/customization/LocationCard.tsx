/**
 * LocationCard — Card colapsável por local físico do produto
 *
 * FLUXO DE SELEÇÃO EM 4 ETAPAS:
 * 1. Área (este card = local físico)
 * 2. Técnica (grupo: Laser, UV Digital, Serigrafia…) — só nome
 * 3. Variação (tabela de preço: Plana, Cilíndrica…) — auto-skip se 1 só
 * 4. Configurar (tamanho + cores + quantidade) → Preço
 */

import { useState, useMemo, useCallback } from 'react';
import { ChevronDown, ChevronUp, Sparkles, Maximize2 } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { TechniqueOption } from './TechniqueOption';
import { VariationSelector } from './VariationSelector';
import { ConfigurationPanel } from './ConfigurationPanel';
import { type PrintAreaV2, type CustomizationPriceFlat } from '@/hooks/simulation';

export interface LocationGroupData {
  groupKey: string;
  componentName: string;
  locationName: string;
  locationCode: string;
  isPrimary: boolean;
  maxWidth: number;
  maxHeight: number;
  areas: PrintAreaV2[];
}

interface LocationCardProps {
  group: LocationGroupData;
  isExpanded: boolean;
  selectedAreaId: string | null;
  quantity: number;
  onToggle: () => void;
  onSelectArea: (areaId: string, priceData: CustomizationPriceFlat | null) => void;
}

// ============================================
// HELPERS
// ============================================

interface TechniqueGroup {
  groupCode: string;
  groupLabel: string;
  areas: PrintAreaV2[];
}

/** Extrai o label do grupo técnico do area_name: "Lado A — Laser" → "Laser" */
function extractTechLabel(areaName: string): string {
  const parts = areaName.split(' — ');
  return parts.length > 1 ? parts[parts.length - 1] : areaName;
}

/** Agrupa áreas por grupo_tecnica */
function groupAreasByTechnique(areas: PrintAreaV2[]): TechniqueGroup[] {
  const groups = new Map<string, TechniqueGroup>();

  for (const area of areas) {
    const groupCode = area.grupo_tecnica || extractTechLabel(area.area_name);

    if (!groups.has(groupCode)) {
      groups.set(groupCode, {
        groupCode,
        groupLabel: extractTechLabel(area.area_name),
        areas: [],
      });
    }
    groups.get(groupCode)?.areas.push(area);
  }

  return [...groups.values()];
}

/** Count unique technique groups */
function countUniqueTechniques(areas: PrintAreaV2[]): number {
  const unique = new Set<string>();
  for (const a of areas) {
    unique.add(a.grupo_tecnica || extractTechLabel(a.area_name));
  }
  return unique.size;
}

// ============================================
// COMPONENT
// ============================================

export function LocationCard({
  group,
  isExpanded,
  selectedAreaId,
  quantity,
  onToggle,
  onSelectArea,
}: LocationCardProps) {
  const hasSelection = selectedAreaId !== null;
  const techniqueCount = countUniqueTechniques(group.areas);

  // Step 2: selected technique group code
  const [selectedGroupCode, setSelectedGroupCode] = useState<string | null>(null);
  // Step 3: selected area_id (variation)
  const [selectedVariationId, setSelectedVariationId] = useState<string | null>(selectedAreaId);

  // Group areas by technique
  const techniqueGroups = useMemo(() => groupAreasByTechnique(group.areas), [group.areas]);

  // Get areas for the currently selected technique group
  const selectedTechGroup = useMemo(() => {
    if (!selectedGroupCode) return null;
    return techniqueGroups.find((g) => g.groupCode === selectedGroupCode) || null;
  }, [techniqueGroups, selectedGroupCode]);

  // Get the selected area object for ConfigurationPanel
  const selectedArea = useMemo(() => {
    if (!selectedVariationId) return null;
    return group.areas.find((a) => a.area_id === selectedVariationId) || null;
  }, [group.areas, selectedVariationId]);

  // Step 2: Select technique group
  const handleSelectTechnique = useCallback(
    (groupCode: string) => {
      if (selectedGroupCode === groupCode) {
        // Deselect
        setSelectedGroupCode(null);
        setSelectedVariationId(null);
        onSelectArea(selectedAreaId || '', null);
        return;
      }
      setSelectedGroupCode(groupCode);
      setSelectedVariationId(null); // Reset variation when technique changes
    },
    [selectedGroupCode, selectedAreaId, onSelectArea],
  );

  // Step 3: Select variation (area_id)
  const handleSelectVariation = useCallback((areaId: string) => {
    setSelectedVariationId(areaId);
  }, []);

  // Step 4: Price calculated
  const handlePriceCalculated = useCallback(
    (areaId: string, priceData: CustomizationPriceFlat | null) => {
      onSelectArea(areaId, priceData);
    },
    [onSelectArea],
  );

  return (
    <Collapsible open={isExpanded} onOpenChange={onToggle}>
      <div
        className={cn(
          'rounded-xl border transition-all duration-200',
          hasSelection
            ? 'border-primary/40 bg-card shadow-lg shadow-primary/5'
            : isExpanded
              ? 'border-primary/20 bg-card shadow-md shadow-primary/5'
              : 'border-border bg-card/50 hover:border-primary/20 hover:bg-card',
        )}
      >
        {/* Etapa 1: Header do local */}
        <CollapsibleTrigger asChild>
          <button type="button" className="flex w-full items-center justify-between p-4 text-left">
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  'flex h-10 w-10 items-center justify-center rounded-lg transition-colors',
                  hasSelection
                    ? 'bg-primary text-primary-foreground'
                    : isExpanded
                      ? 'bg-primary/20 text-primary'
                      : 'bg-secondary text-secondary-foreground',
                )}
              >
                <Sparkles className="h-4 w-4" />
              </div>
              <div>
                <p className="font-medium text-foreground">
                  {group.componentName} — {group.locationName}
                </p>
                <div className="mt-0.5 flex items-center gap-2">
                  <span className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Maximize2 className="h-3 w-3" />
                    até {group.maxWidth}×{group.maxHeight}cm
                  </span>
                  <span className="text-sm text-muted-foreground">
                    · {techniqueCount} técnica{techniqueCount !== 1 ? 's' : ''}
                  </span>
                </div>
              </div>
            </div>
            {isExpanded ? (
              <ChevronUp className="h-5 w-5 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-5 w-5 text-muted-foreground" />
            )}
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent forceMount>
          <div className={cn('space-y-3 px-4 pb-4', !isExpanded && 'hidden')}>
            {/* Etapa 2: Escolha a técnica */}
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Etapa 2 · Escolha a técnica
            </p>
            <div className="space-y-1.5">
              {techniqueGroups.map((techGroup) => (
                <TechniqueOption
                  key={techGroup.groupCode}
                  groupCode={techGroup.groupCode}
                  groupLabel={techGroup.groupLabel}
                  isSelected={selectedGroupCode === techGroup.groupCode}
                  onSelect={handleSelectTechnique}
                />
              ))}
            </div>

            {/* Etapa 3: Escolha a variação */}
            {selectedTechGroup && (
              <VariationSelector
                variations={selectedTechGroup.areas}
                selectedAreaId={selectedVariationId}
                onSelect={handleSelectVariation}
              />
            )}

            {/* Etapa 4: Configure */}
            {selectedArea && (
              <ConfigurationPanel
                key={selectedArea.area_id}
                area={selectedArea}
                quantity={quantity}
                onPriceCalculated={handlePriceCalculated}
              />
            )}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
