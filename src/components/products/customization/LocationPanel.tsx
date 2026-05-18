/**
 * LocationPanel — Painel de técnicas para um local de gravação
 * 
 * Fluxo Didático:
 * 1. Lista técnicas disponíveis (agrupadas).
 * 2. Ao selecionar uma técnica, foca nela e abre as configurações.
 * 3. Permite voltar para trocar a técnica.
 */

import { useState, useMemo, useCallback } from "react";
import { ArrowLeft, Check, Palette } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { TechniqueCard } from "./TechniqueCard";
import { ConfigurationPanelV6 } from "./ConfigurationPanelV6";
import type { TechniqueOption, GravacaoLocation, CustomizationPriceResponseV6, PersonalizationItem } from "@/types/customization";

interface LocationPanelProps {
  location: GravacaoLocation;
  quantity: number;
  /** técnica já confirmada para este local (vindo do parent). */
  confirmedPersonalization?: PersonalizationItem;
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

export function LocationPanel({ location, quantity, confirmedPersonalization, onPriceCalculated }: LocationPanelProps) {
  // Inicializa com a técnica confirmada (se houver)
  const [selectedTechnique, setSelectedTechnique] = useState<TechniqueOption | null>(() => {
    if (!confirmedPersonalization?.techniqueId) return null;
    return location.options.find((t) => t.technique_id === confirmedPersonalization.techniqueId) ?? null;
  });

  const grouped = useMemo(() => groupByGrupo(location.options), [location.options]);

  const handleSelectTechnique = useCallback((technique: TechniqueOption) => {
    setSelectedTechnique(technique);
  }, []);

  const handlePriceCalculated = useCallback((techniqueId: string, price: CustomizationPriceResponseV6 | null, dimensions?: { width?: number; height?: number }) => {
    onPriceCalculated(location.location_code, techniqueId, price, dimensions);
  }, [location.location_code, onPriceCalculated]);

  return (
    <AnimatePresence mode="wait">
      {selectedTechnique ? (
        <motion.div 
          key="config"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          className="space-y-4"
        >
        {/* Header de Técnica Selecionada (Permite Voltar) */}
        <div className="flex items-center justify-between gap-3 bg-secondary/30 border border-border/60 p-3 rounded-xl">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0" aria-hidden="true">
              <Palette className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider leading-tight">
                Técnica Ativa
              </p>
                <p className="text-sm font-bold text-foreground">
                  {selectedTechnique.tecnica_nome}
                </p>
              </div>
            </div>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setSelectedTechnique(null)}
              className="h-8 text-[11px] font-bold text-muted-foreground hover:text-primary gap-1.5"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Alterar
            </Button>
          </div>

          {/* Painel de Configuração (Tamanho/Cores) */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 px-1">
              <div className="h-4 w-4 rounded-full bg-primary text-[10px] flex items-center justify-center font-bold text-primary-foreground">
                3
              </div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Configurações de Tamanho e Cores
              </p>
            </div>
            
            <ConfigurationPanelV6
              key={selectedTechnique.technique_id}
              technique={selectedTechnique}
              quantity={quantity}
              isConfirmed={confirmedPersonalization?.techniqueId === selectedTechnique.technique_id}
              initialWidth={confirmedPersonalization?.width}
              initialHeight={confirmedPersonalization?.height}
              initialColors={confirmedPersonalization?.numberOfColors}
              onPriceCalculated={handlePriceCalculated}
            />
          </div>
        </motion.div>
      ) : (
        <motion.div 
          key="list"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 20 }}
          className="space-y-4"
        >
          <div className="flex items-center gap-2 px-1">
            <div className="h-4 w-4 rounded-full bg-primary text-[10px] flex items-center justify-center font-bold text-primary-foreground">
              2
            </div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Escolha a técnica para {location.location_name}
            </p>
          </div>

          <div className="space-y-3">
            {Object.entries(grouped).map(([grupo, techs]) => (
              <div key={grupo} className="space-y-1.5">
                {Object.keys(grouped).length > 1 && (
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest px-1">
                    {grupo}
                  </p>
                )}
                <div className="grid gap-1.5">
                  {techs.map((t, idx) => (
                    <motion.div
                      key={t.technique_id}
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.03 }}
                    >
                      <TechniqueCard
                        technique={t}
                        isSelected={false}
                        onSelect={() => handleSelectTechnique(t)}
                      />
                    </motion.div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

