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

import { useState, useMemo, useCallback, useRef, useEffect, useId } from 'react';
import { Pencil, Info } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { TechniqueCard } from './TechniqueCard';
import { ConfigurationPanelV6 } from './ConfigurationPanelV6';
import type {
  TechniqueOption,
  GravacaoLocation,
  CustomizationPriceResponseV6,
  PersonalizationItem,
} from '@/types/customization';

interface LocationPanelProps {
  location: GravacaoLocation;
  quantity: number;
  /** técnica já confirmada para este local (vindo do parent). */
  confirmedPersonalization?: PersonalizationItem;
  /** Identificador do produto — usado para chave de persistência do rascunho. */
  productId?: string;
  onPriceCalculated: (
    locationCode: string,
    techniqueId: string,
    price: CustomizationPriceResponseV6 | null,
    dimensions?: { width?: number; height?: number },
  ) => void;
}

/** Rascunho persistido (técnica selecionada + dimensões não confirmadas). */
interface LocationDraft {
  techniqueId?: string;
  width?: number;
  height?: number;
  colors?: number;
  pickerOpen?: boolean;
  savedAt: string;
}

const DRAFT_STORAGE_PREFIX = 'qb:loc-draft';
const DRAFT_TTL_MS = 1000 * 60 * 60 * 24; // 24h

function draftKey(productId: string | undefined, locationCode: string): string | null {
  if (!productId) return null;
  return `${DRAFT_STORAGE_PREFIX}:${productId}:${locationCode}`;
}

function readDraft(key: string | null): LocationDraft | null {
  if (!key || typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LocationDraft;
    if (parsed?.savedAt && Date.now() - new Date(parsed.savedAt).getTime() > DRAFT_TTL_MS) {
      window.sessionStorage.removeItem(key);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function writeDraft(key: string | null, draft: Omit<LocationDraft, 'savedAt'>) {
  if (!key || typeof window === 'undefined') return;
  try {
    const payload: LocationDraft = { ...draft, savedAt: new Date().toISOString() };
    window.sessionStorage.setItem(key, JSON.stringify(payload));
  } catch {
    /* quota / disabled storage — silently ignore */
  }
}

function clearDraft(key: string | null) {
  if (!key || typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(key);
  } catch {
    /* noop */
  }
}

/** Agrupa técnicas por grupo_tecnica */
function groupByGrupo(options: TechniqueOption[]): Record<string, TechniqueOption[]> {
  return options.reduce<Record<string, TechniqueOption[]>>((groups, t) => {
    const group = t.grupo_tecnica || 'OUTROS';
    if (!groups[group]) groups[group] = [];
    groups[group].push(t);
    return groups;
  }, {});
}

interface SelectedTechniqueBarProps {
  technique: TechniqueOption;
  onChangeClick: () => void;
  isPickerOpen: boolean;
  pickerId: string;
  changeButtonRef?: React.Ref<HTMLButtonElement>;
}

function SelectedTechniqueBar({
  technique,
  onChangeClick,
  isPickerOpen,
  pickerId,
  changeButtonRef,
}: SelectedTechniqueBarProps) {
  return (
    <div
      className={`flex items-center justify-between gap-3 rounded-lg border px-3 py-2 transition-colors ${isPickerOpen ? 'border-primary/60 bg-primary/10 ring-1 ring-primary/30' : 'border-primary/30 bg-primary/5'}`}
    >
      <div className="flex min-w-0 items-center gap-2">
        <span
          className={`h-2 w-2 shrink-0 rounded-full bg-primary transition-transform ${isPickerOpen ? 'scale-110 animate-pulse' : ''}`}
          aria-hidden
        />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">{technique.tecnica_nome}</p>
          {technique.grupo_tecnica && (
            <p className="truncate text-[10px] uppercase tracking-wide text-muted-foreground">
              {technique.grupo_tecnica}
            </p>
          )}
        </div>
      </div>
      <Button
        ref={changeButtonRef}
        type="button"
        variant={isPickerOpen ? 'default' : 'outline'}
        size="sm"
        className="h-8 shrink-0 gap-1.5"
        onClick={onChangeClick}
        aria-expanded={isPickerOpen}
        aria-controls={pickerId}
        aria-label={
          isPickerOpen
            ? `Fechar seletor de técnicas — técnica atual: ${technique.tecnica_nome}`
            : `Trocar técnica de gravação — técnica atual: ${technique.tecnica_nome}`
        }
        data-testid="customization-change-technique"
      >
        <Pencil className="h-3.5 w-3.5" />
        {isPickerOpen ? 'Fechar' : 'Trocar'}
      </Button>
    </div>
  );
}

export function LocationPanel({
  location,
  quantity,
  confirmedPersonalization,
  productId,
  onPriceCalculated,
}: LocationPanelProps) {
  const storageKey = useMemo(
    () => draftKey(productId, location.location_code),
    [productId, location.location_code],
  );

  const [announcement, setAnnouncement] = useState('');

  // Hidrata estado inicial: confirmada > rascunho persistido > nada.
  const initialDraft = useMemo<LocationDraft | null>(
    () => (confirmedPersonalization ? null : readDraft(storageKey)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [storageKey],
  );

  const [selectedTechnique, setSelectedTechnique] = useState<TechniqueOption | null>(() => {
    const techId = confirmedPersonalization?.techniqueId ?? initialDraft?.techniqueId;
    if (!techId) return null;
    return location.options.find((t) => t.technique_id === techId) ?? null;
  });

  // Picker fechado por padrão se já existe técnica selecionada
  const [isPickerOpen, setIsPickerOpen] = useState<boolean>(() => {
    if (confirmedPersonalization) return false;
    if (initialDraft?.techniqueId) return initialDraft.pickerOpen ?? false;
    return true;
  });

  // Guarda as últimas dimensões/cores informadas (para preservar ao trocar técnica)
  const lastDimsRef = useRef<{ width?: number; height?: number; colors?: number }>({
    width: confirmedPersonalization?.width ?? initialDraft?.width,
    height: confirmedPersonalization?.height ?? initialDraft?.height,
    colors: confirmedPersonalization?.numberOfColors ?? initialDraft?.colors,
  });

  // Persiste rascunho sempre que técnica/picker muda. Dimensões são persistidas em handleDimensionsChange.
  useEffect(() => {
    // Se há uma personalização confirmada para esta técnica, o rascunho é redundante — limpa.
    if (
      confirmedPersonalization &&
      confirmedPersonalization.techniqueId === selectedTechnique?.technique_id
    ) {
      clearDraft(storageKey);
      return;
    }
    if (!selectedTechnique) {
      clearDraft(storageKey);
      return;
    }
    writeDraft(storageKey, {
      techniqueId: selectedTechnique.technique_id,
      width: lastDimsRef.current.width,
      height: lastDimsRef.current.height,
      colors: lastDimsRef.current.colors,
      pickerOpen: isPickerOpen,
    });
  }, [storageKey, selectedTechnique, isPickerOpen, confirmedPersonalization]);

  const grouped = useMemo(() => groupByGrupo(location.options), [location.options]);

  // IDs estáveis para wiring de aria-controls
  const pickerId = useId();

  // Ref do botão "Trocar/Fechar" para restituir foco quando o picker fecha
  const changeButtonRef = useRef<HTMLButtonElement | null>(null);

  // Foco no primeiro card ao reabrir a lista; foco de volta no botão ao fechar (a11y)
  const firstCardRef = useRef<HTMLDivElement | null>(null);
  const prevPickerOpenRef = useRef<boolean>(isPickerOpen);
  useEffect(() => {
    const wasOpen = prevPickerOpenRef.current;
    if (isPickerOpen && selectedTechnique) {
      const el = firstCardRef.current?.querySelector<HTMLElement>("[role='button'],button");
      el?.focus?.();
    } else if (!isPickerOpen && wasOpen && selectedTechnique) {
      // Picker fechou enquanto havia técnica selecionada → devolve foco ao trigger.
      changeButtonRef.current?.focus?.();
    }
    prevPickerOpenRef.current = isPickerOpen;
  }, [isPickerOpen, selectedTechnique]);

  const [clampNotice, setClampNotice] = useState<string | null>(null);

  // Mensagem para o announcer aria-live (transições de estado)
  // Usamos ref para rastrear se é o primeiro render para evitar anúncios duplicados na hidratação
  const isFirstRenderRef = useRef(true);

  useEffect(() => {
    if (isFirstRenderRef.current) {
      isFirstRenderRef.current = false;
      return;
    }

    if (!selectedTechnique) {
      setAnnouncement('');
      return;
    }

    let msg = isPickerOpen
      ? `Seletor de técnicas aberto. Técnica atual: ${selectedTechnique.tecnica_nome}.`
      : `Técnica selecionada: ${selectedTechnique.tecnica_nome}.`;

    if (!isPickerOpen && clampNotice) {
      msg += ` ${clampNotice}`;
    }

    setAnnouncement(msg);
  }, [isPickerOpen, selectedTechnique, clampNotice]);

  const handleSelectTechnique = useCallback(
    (technique: TechniqueOption) => {
      // Estado C → clicou na mesma técnica: apenas fecha o picker
      if (selectedTechnique?.technique_id === technique.technique_id) {
        setIsPickerOpen(false);
        return;
      }

      setClampNotice(null);

      // Variáveis para foco automático
      let forcedW = false;
      let forcedH = false;
      let forcedC = false;

      // Trocando de técnica com uma anterior já selecionada
      if (selectedTechnique && selectedTechnique.technique_id !== technique.technique_id) {
        toast.success(
          `Técnica alterada: ${selectedTechnique.tecnica_nome} → ${technique.tecnica_nome}`,
          { duration: 2500 },
        );

        // Verifica se haverá clamp de dimensões
        const currentW = lastDimsRef.current.width;
        const currentH = lastDimsRef.current.height;
        const currentC = lastDimsRef.current.colors;

        forcedW =
          technique.usa_dimensao &&
          currentW !== undefined &&
          currentW !== null &&
          currentW > (technique.efetiva_largura_max || 0);
        forcedH =
          technique.usa_dimensao &&
          currentH !== undefined &&
          currentH !== null &&
          currentH > (technique.efetiva_altura_max || 0);
        forcedC =
          technique.cobra_por_cor &&
          currentC !== undefined &&
          currentC !== null &&
          currentC > (technique.max_cores || 1);

        if (forcedW || forcedH || forcedC) {
          const reasons = [];
          if (forcedW) reasons.push('Largura');
          if (forcedH) reasons.push('Altura');
          if (forcedC) reasons.push('Cores');
          setClampNotice(
            `As dimensões (${reasons.join(', ')}) foram ajustadas aos limites da nova técnica.`,
          );
        }
      }

      // Clamp de cores se a nova técnica tiver limite menor
      const maxCores = technique.max_cores || 1;
      const currentC = lastDimsRef.current.colors;
      if (currentC !== undefined && currentC !== null && currentC > maxCores) {
        lastDimsRef.current.colors = maxCores;
      }

      setSelectedTechnique(technique);
      setIsPickerOpen(false);

      // Foco automático no controle ajustado se houve clamp (A11y)
      setTimeout(() => {
        if (forcedW) {
          document.querySelector<HTMLElement>('[data-testid="customization-width-input"]')?.focus();
        } else if (forcedH) {
          document
            .querySelector<HTMLElement>('[data-testid="customization-height-input"]')
            ?.focus();
        } else if (forcedC) {
          document
            .querySelector<HTMLElement>('[data-testid^="customization-color-button-"]')
            ?.focus();
        }
      }, 50);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: see comment above
    [selectedTechnique, toast],
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

  // Captura dimensões/cores em tempo real (mesmo sem confirmar) para preservar ao trocar técnica
  // e persistir o rascunho — assim o vendedor recupera o que digitou ao voltar para a tela.
  const handleDimensionsChange = useCallback(
    (dims: { width?: number; height?: number; colors?: number }) => {
      lastDimsRef.current = {
        width: dims.width ?? lastDimsRef.current.width,
        height: dims.height ?? lastDimsRef.current.height,
        colors: dims.colors ?? lastDimsRef.current.colors,
      };

      // Se a técnica atual NÃO cobra por cor, forçamos colors a undefined para o rascunho
      // Isso evita que rascunhos de Silk (monocromático) carreguem cores anteriores de um Transfer.
      const colorsToPersist = selectedTechnique?.cobra_por_cor
        ? lastDimsRef.current.colors
        : undefined;

      // Persiste o rascunho atualizado (só se há técnica selecionada e não está confirmada).
      if (
        selectedTechnique &&
        confirmedPersonalization?.techniqueId !== selectedTechnique.technique_id
      ) {
        writeDraft(storageKey, {
          techniqueId: selectedTechnique.technique_id,
          width: lastDimsRef.current.width,
          height: lastDimsRef.current.height,
          colors: colorsToPersist,
          pickerOpen: isPickerOpen,
        });
      }
    },
    [storageKey, selectedTechnique, confirmedPersonalization, isPickerOpen],
  );

  // Estados derivados
  const showPicker = !selectedTechnique || isPickerOpen;
  const showConfig = !!selectedTechnique;

  // Dimensões iniciais para o ConfigurationPanel:
  // - técnica = a confirmada → usa o snapshot persistido;
  // - troca de técnica → usa últimas dimensões digitadas, com clamp aos limites da nova técnica
  //   (evita estourar largura/altura máxima quando a nova técnica é menor).
  const clamp = (v: number | undefined, max: number | undefined) =>
    v === null || v === undefined
      ? undefined
      : max !== null && max !== undefined && v > max
        ? max
        : v;

  const isSameAsConfirmed =
    selectedTechnique?.technique_id === confirmedPersonalization?.techniqueId;
  const rawWidth = isSameAsConfirmed ? confirmedPersonalization?.width : lastDimsRef.current.width;
  const rawHeight = isSameAsConfirmed
    ? confirmedPersonalization?.height
    : lastDimsRef.current.height;
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
    ? clamp(rawColors ?? 1, selectedTechnique?.max_cores)
    : undefined;

  return (
    <div className="space-y-3" data-testid="customization-location-panel">
      {/* Anúncio de transições de estado (somente leitores de tela) */}
      <p
        className="sr-only"
        role="status"
        aria-live="polite"
        aria-atomic="true"
        data-testid="customization-aria-announcer"
      >
        {announcement}
      </p>

      {/* Barra resumo da técnica selecionada (Estado B/C) */}
      {showConfig && (
        <div className="space-y-2">
          <SelectedTechniqueBar
            technique={selectedTechnique}
            isPickerOpen={isPickerOpen}
            pickerId={pickerId}
            changeButtonRef={changeButtonRef}
            onChangeClick={() => setIsPickerOpen((v) => !v)}
          />

          {clampNotice && !isPickerOpen && (
            <Alert
              variant="default"
              className="border-amber-200 bg-amber-50 py-2"
              data-testid="clamp-notice"
            >
              <Info className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-xs text-amber-800">{clampNotice}</AlertDescription>
            </Alert>
          )}
        </div>
      )}

      {/* Picker de técnicas (Estado A ou C) */}
      {showPicker && (
        <div
          ref={firstCardRef}
          id={pickerId}
          role="radiogroup"
          tabIndex={0}
          aria-label={
            selectedTechnique
              ? `Trocar técnica de gravação para ${location.location_name}. Atual: ${selectedTechnique.tecnica_nome}.`
              : `Escolha a técnica de gravação para ${location.location_name}.`
          }
          className="space-y-3 rounded-lg border border-primary/20 bg-primary/[0.02] p-3 animate-in fade-in slide-in-from-top-1"
          data-testid="customization-technique-picker"
          onKeyDown={(e) => {
            if (e.key === 'Escape' && selectedTechnique) {
              setIsPickerOpen(false);
            }
          }}
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
                <p className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
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
