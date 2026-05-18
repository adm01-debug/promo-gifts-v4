/**
 * LocationPanel — Painel de técnicas para um local de gravação
 * 
 * Mostra as técnicas agrupadas por grupo_tecnica.
 * O vendedor seleciona 1 técnica, depois configura dimensões/cores.
 * Briefing v6 (12/02/2026).
 */

import { useState, useMemo, useCallback } from "react";
import { TechniqueCard } from "./TechniqueCard";
import { ConfigurationPanelV6 } from "./ConfigurationPanelV6";
import type { TechniqueOption, GravacaoLocation, CustomizationPriceResponseV6 } from "@/types/customization";

interface LocationPanelProps {
  location: GravacaoLocation;
  quantity: number;
  /** technique_id já confirmada para este local (vindo do parent). */
  confirmedTechniqueId?: string;
  onPriceCalculated: (locationCode: string, techniqueId: string, price: CustomizationPriceResponseV6 | null, dimensions?: { width?: number; height?: number }) => void;
}


/** Agrupa técnicas por grupo_tecnica */
function groupByGrupo(options: TechniqueOption[]): Record<string, TechniqueOption[]> {
  return options.reduce((groups, t) => {
    const group = t.grupo_tecnica || 'OUTROS';
    if (!groups[group]) groups[group] = [];
    groups[group].push(t);
    return groups;
  }, {} as Record<string, TechniqueOption[]>);
}

export function LocationPanel({ location, quantity, confirmedTechniqueId, onPriceCalculated }: LocationPanelProps) {
  // Inicializa com a técnica confirmada (se houver) para que ao reabrir o local
  // o vendedor já veja o painel da gravação adicionada.
  const [selectedTechnique, setSelectedTechnique] = useState<TechniqueOption | null>(() => {
    if (!confirmedTechniqueId) return null;
    return location.options.find((t) => t.technique_id === confirmedTechniqueId) ?? null;
  });

  const grouped = useMemo(() => groupByGrupo(location.options), [location.options]);

  const handleSelectTechnique = useCallback((technique: TechniqueOption) => {
    if (selectedTechnique?.technique_id === technique.technique_id) {
      // Deselect
      setSelectedTechnique(null);
      onPriceCalculated(location.location_code, '', null);
    } else {
      setSelectedTechnique(technique);
    }
  }, [selectedTechnique, location.location_code, onPriceCalculated]);

  const handlePriceCalculated = useCallback((techniqueId: string, price: CustomizationPriceResponseV6 | null, dimensions?: { width?: number; height?: number }) => {
    onPriceCalculated(location.location_code, techniqueId, price, dimensions);
  }, [location.location_code, onPriceCalculated]);

  return (
    <div className="space-y-3">
      {/* Technique list grouped */}
      {Object.entries(grouped).map(([grupo, techs]) => (
        <div key={grupo} className="space-y-1.5">
          {Object.keys(grouped).length > 1 && (
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-1">
              {grupo}
            </p>
          )}
          {techs.map((t) => (
            <TechniqueCard
              key={t.technique_id}
              technique={t}
              isSelected={selectedTechnique?.technique_id === t.technique_id}
              onSelect={handleSelectTechnique}
            />
          ))}
        </div>
      ))}

      {/* Configuration panel */}
      {selectedTechnique && (
        <ConfigurationPanelV6
          key={selectedTechnique.technique_id}
          technique={selectedTechnique}
          quantity={quantity}
          isConfirmed={confirmedTechniqueId === selectedTechnique.technique_id}
          onPriceCalculated={handlePriceCalculated}
        />
      )}
    </div>
  );
}
