/**
 * LocationPanel — Painel de técnicas para um local de gravação
 *
 * Comportamento:
 *  - Sem técnica selecionada → lista todas as técnicas agrupadas.
 *  - Com técnica selecionada → esconde a lista e mostra apenas a barra-resumo
 *    da técnica + o painel de configuração de tamanho/cores.
 *  - Botão "Trocar" reabre a lista sem apagar a técnica/preço já calculado;
 *    selecionar outra técnica troca e mantém as dimensões já preenchidas.
 */

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { Pencil } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TechniqueCard } from "./TechniqueCard";
import { ConfigurationPanelV6 } from "./ConfigurationPanelV6";
import type {
  TechniqueOption,
  GravacaoLocation,
  CustomizationPriceResponseV6,
  PersonalizationItem,
} from "@/types/customization";

interface LocationPanelProps {
  location: GravacaoLocation;
  quantity: number;
  /** técnica já confirmada para este local (vindo do parent). */
  confirmedPersonalization?: PersonalizationItem;
  onPriceCalculated: (
    locationCode: string,
    techniqueId: string,
    price: CustomizationPriceResponseV6 | null,
    dimensions?: { width?: number; height?: number },
  ) => void;
}

/** Agrupa técnicas por grupo_tecnica */
function groupByGrupo(options: TechniqueOption[]): Record<string, TechniqueOption[]> {
  return options.reduce((groups, t) => {
    const group = t.grupo_tecnica || "OUTROS";
    if (!groups[group]) groups[group] = [];
    groups[group].push(t);
    return groups;
  }, {} as Record<string, TechniqueOption[]>);
}

interface SelectedTechniqueBarProps {
  technique: TechniqueOption;
  onChangeClick: () => void;
}

function SelectedTechniqueBar({ technique, onChangeClick }: SelectedTechniqueBarProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-center justify-between gap-3 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2"
    >
      <div className="flex min-w-0 items-center gap-2">
        <span className="h-2 w-2 shrink-0 rounded-full bg-primary" aria-hidden />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">
            {technique.tecnica_nome}
          </p>
          {technique.grupo_tecnica && (
            <p className="truncate text-[10px] uppercase tracking-wide text-muted-foreground">
              {technique.grupo_tecnica}
            </p>
          )}
        </div>
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-8 shrink-0 gap-1.5"
        onClick={onChangeClick}
        aria-expanded={false}
        aria-label="Trocar técnica de gravação"
        data-testid="customization-change-technique"
      >
        <Pencil className="h-3.5 w-3.5" />
        Trocar
      </Button>
    </div>
  );
}

export function LocationPanel({
  location,
  quantity,
  confirmedPersonalization,
  onPriceCalculated,
}: LocationPanelProps) {
  // Inicializa com a técnica confirmada (se houver) para que ao reabrir o local
  // o vendedor já veja o painel da gravação adicionada.
  const [selectedTechnique, setSelectedTechnique] = useState<TechniqueOption | null>(() => {
    if (!confirmedPersonalization?.techniqueId) return null;
    return (
      location.options.find((t) => t.technique_id === confirmedPersonalization.techniqueId) ?? null
    );
  });

  // Picker fica fechado por padrão se já existe técnica selecionada
  const [isPickerOpen, setIsPickerOpen] = useState<boolean>(() => !selectedTechnique);

  // Guarda as últimas dimensões/cores informadas (para preservar ao trocar técnica)
  const lastDimsRef = useRef<{ width?: number; height?: number; colors?: number }>({
    width: confirmedPersonalization?.width,
    height: confirmedPersonalization?.height,
    colors: confirmedPersonalization?.numberOfColors,
  });

  const grouped = useMemo(() => groupByGrupo(location.options), [location.options]);

  // Foco no primeiro card ao reabrir a lista (a11y)
  const firstCardRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (isPickerOpen && selectedTechnique) {
      // só auto-focar em modo "trocar"
      const el = firstCardRef.current?.querySelector<HTMLElement>("[role='button'],button");
      el?.focus?.();
    }
  }, [isPickerOpen, selectedTechnique]);

  const handleSelectTechnique = useCallback(
    (technique: TechniqueOption) => {
      // Estado C → clicou na mesma técnica: apenas fecha o picker
      if (selectedTechnique?.technique_id === technique.technique_id) {
        setIsPickerOpen(false);
        return;
      }

      // Trocando de técnica com uma anterior já selecionada
      if (selectedTechnique && selectedTechnique.technique_id !== technique.technique_id) {
        toast.success(
          `Técnica alterada: ${selectedTechnique.tecnica_nome} → ${technique.tecnica_nome}`,
          { duration: 2500 },
        );
      }

      setSelectedTechnique(technique);
      setIsPickerOpen(false);
    },
    [selectedTechnique],
  );

  const handlePriceCalculated = useCallback(
    (
      techniqueId: string,
      price: CustomizationPriceResponseV6 | null,
      dimensions?: { width?: number; height?: number },
    ) => {
      if (dimensions) {
        lastDimsRef.current = {
          width: dimensions.width ?? lastDimsRef.current.width,
          height: dimensions.height ?? lastDimsRef.current.height,
          colors: lastDimsRef.current.colors,
        };
      }
      onPriceCalculated(location.location_code, techniqueId, price, dimensions);
    },
    [location.location_code, onPriceCalculated],
  );

  // Captura dimensões/cores em tempo real (mesmo sem confirmar) para preservar ao trocar técnica.
  const handleDimensionsChange = useCallback(
    (dims: { width?: number; height?: number; colors?: number }) => {
      lastDimsRef.current = {
        width: dims.width ?? lastDimsRef.current.width,
        height: dims.height ?? lastDimsRef.current.height,
        colors: dims.colors ?? lastDimsRef.current.colors,
      };
    },
    [],
  );

  // Estados derivados
  const showPicker = !selectedTechnique || isPickerOpen;
  const showConfig = !!selectedTechnique;

  // Dimensões iniciais para o ConfigurationPanel:
  // - técnica = a confirmada → usa o snapshot persistido;
  // - troca de técnica → usa últimas dimensões digitadas, com clamp aos limites da nova técnica
  //   (evita estourar largura/altura máxima quando a nova técnica é menor).
  const clamp = (v: number | undefined, max: number | undefined) =>
    v == null ? undefined : max != null && v > max ? max : v;

  const isSameAsConfirmed =
    selectedTechnique?.technique_id === confirmedPersonalization?.techniqueId;
  const rawWidth = isSameAsConfirmed ? confirmedPersonalization?.width : lastDimsRef.current.width;
  const rawHeight = isSameAsConfirmed ? confirmedPersonalization?.height : lastDimsRef.current.height;
  const rawColors = isSameAsConfirmed
    ? confirmedPersonalization?.numberOfColors
    : lastDimsRef.current.colors;
  const initialWidth = selectedTechnique?.usa_dimensao
    ? clamp(rawWidth, selectedTechnique?.efetiva_largura_max)
    : undefined;
  const initialHeight = selectedTechnique?.usa_dimensao
    ? clamp(rawHeight, selectedTechnique?.efetiva_altura_max)
    : undefined;
  const initialColors = selectedTechnique?.cobra_por_cor
    ? clamp(rawColors, selectedTechnique?.max_cores)
    : undefined;

  return (
    <div className="space-y-3" data-testid="customization-location-panel">
      {/* Barra resumo da técnica selecionada (Estado B/C) */}
      {showConfig && (
        <SelectedTechniqueBar
          technique={selectedTechnique}
          onChangeClick={() => setIsPickerOpen((v) => !v)}
        />
      )}

      {/* Picker de técnicas (Estado A ou C) */}
      {showPicker && (
        <div
          ref={firstCardRef}
          className="space-y-3 animate-in fade-in slide-in-from-top-1"
          data-testid="customization-technique-picker"
        >
          {selectedTechnique && (
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Escolha a nova técnica
              </p>
              <Badge variant="secondary" className="text-[10px]">
                Atual: {selectedTechnique.tecnica_nome}
              </Badge>
            </div>
          )}

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
        </div>
      )}

      {/* Configuration panel — permanece MONTADO mesmo com o picker aberto,
          apenas ocultado via `hidden`. Isso preserva o hook reativo de preço
          e evita re-cálculo desnecessário ao clicar na mesma técnica. */}
      {showConfig && (
        <div hidden={isPickerOpen} aria-hidden={isPickerOpen}>
          <ConfigurationPanelV6
            key={selectedTechnique.technique_id}
            technique={selectedTechnique}
            quantity={quantity}
            isConfirmed={confirmedPersonalization?.techniqueId === selectedTechnique.technique_id}
            initialWidth={initialWidth}
            initialHeight={initialHeight}
            initialColors={initialColors}
            onPriceCalculated={handlePriceCalculated}
            onDimensionsChange={handleDimensionsChange}
          />
        </div>
      )}
    </div>
  );
}
