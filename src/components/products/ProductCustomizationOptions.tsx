/**
 * ProductCustomizationOptions — Seletor de personalização v6
 *
 * Fluxo guiado passo a passo:
 *   1) Local de gravação (LADO A / LADO B / CIRCULAR 360°)
 *   2) Técnica disponível para aquele local
 *   3) Tamanho / cores (configuração)
 *
 * Regra de exclusividade: se o produto possuir uma opção "CIRCULAR/360°"
 * ela é mutuamente exclusiva com locais planos (LADO A, LADO B, etc.).
 * Selecionar CIRCULAR bloqueia LADO A/B (e vice-versa) com tooltip explicando.
 */

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useProductCustomizationOptions } from '@/hooks/products/useProductCustomizationOptions';
import { LocationPanel } from './customization/LocationPanel';
import type {
  CustomizationPriceResponseV6,
  GravacaoLocation,
  PersonalizationItem,
} from '@/types/customization';

interface ProductCustomizationOptionsProps {
  productId: string;
  productSku?: string;
  quantity?: number;
  initialPersonalizations?: PersonalizationItem[];
  onSelectionChange?: (personalizations: PersonalizationItem[]) => void;
}

/** Detecta se um local é "CIRCULAR/360°" (mutuamente exclusivo com locais planos). */
function isCircularLocation(loc: GravacaoLocation): boolean {
  const code = (loc.location_code || '').toUpperCase();
  const name = (loc.location_name || '').toUpperCase();
  return (
    code.includes('CIRCULAR') ||
    code.includes('360') ||
    name.includes('CIRCULAR') ||
    name.includes('360')
  );
}

export function ProductCustomizationOptions({
  productId,
  quantity = 100,
  initialPersonalizations = [],
  onSelectionChange,
}: ProductCustomizationOptionsProps) {
  const { data: options, isLoading, isError, error, refetch } = useProductCustomizationOptions(productId);
  const [activeLocation, setActiveLocation] = useState<string | null>(null);

  // Track prices per location
  const pricesRef = useRef<Map<string, PersonalizationItem>>(new Map());
  const hasInitialized = useRef(false);

  // Force re-render when pricesRef changes (badges/exclusão dependem disso)
  const [, forceTick] = useState(0);

  // Reset local state when productId changes
  useEffect(() => {
    pricesRef.current.clear();
    setActiveLocation(null);
    hasInitialized.current = false;
    forceTick((n) => n + 1);
  }, [productId]);

  // Initialize from initialPersonalizations
  useEffect(() => {
    if (!hasInitialized.current && initialPersonalizations.length > 0) {
      initialPersonalizations.forEach((item) => {
        if (item.locationCode) {
          pricesRef.current.set(item.locationCode, item);
        }
      });
      hasInitialized.current = true;
      forceTick((n) => n + 1);
    }
  }, [initialPersonalizations, productId]);

  // Refs for scrolling and offset calculation
  const stickyHeaderRef = useRef<HTMLDivElement>(null);
  const step2Ref = useRef<HTMLDivElement>(null);
  const step3Ref = useRef<HTMLDivElement>(null);

  const scrollToStep = (step: number) => {
    const refs = [null, null, step2Ref, step3Ref];
    const target = refs[step];
    if (target?.current) {
      const headerHeight = stickyHeaderRef.current?.offsetHeight || 140;
      const elementPosition = target.current.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - headerHeight - 12;
      window.scrollTo({ top: offsetPosition, behavior: 'smooth' });
    }
  };

  // Auto-select primeiro local quando dados carregam
  useEffect(() => {
    if (options?.locations?.length && !activeLocation) {
      setActiveLocation(options.locations[0].location_code);
    }
  }, [options, activeLocation]);

  const handlePriceCalculated = useCallback(
    (
      locationCode: string,
      techniqueId: string,
      price: CustomizationPriceResponseV6 | null,
      dimensions?: { width?: number; height?: number },
    ) => {
      const location = options?.locations.find((l) => l.location_code === locationCode);
      const technique = location?.options.find((t) => t.technique_id === techniqueId);

      if (price && technique) {
        pricesRef.current.set(locationCode, {
          locationCode,
          locationName: location?.location_name || locationCode,
          techniqueId,
          techniqueName: technique.tecnica_nome,
          codigoTabela: technique.codigo_tabela,
          grupoTecnica: technique.grupo_tecnica,
          width: dimensions?.width,
          height: dimensions?.height,
          numberOfColors: price.num_cores ?? 1,
          usaDimensao: technique.usa_dimensao,
          price,
        });
      } else {
        pricesRef.current.delete(locationCode);
      }

      forceTick((n) => n + 1);
      const items = Array.from(pricesRef.current.values());
      onSelectionChange?.(items);
    },
    [options, onSelectionChange],
  );

  const locations = options?.locations ?? [];

  /** Calcula exclusividade circular ↔ plano. */
  const exclusion = useMemo(() => {
    const confirmedCodes = Array.from(pricesRef.current.keys());
    const confirmedHasCircular = confirmedCodes.some((code) => {
      const l = locations.find((x) => x.location_code === code);
      return l ? isCircularLocation(l) : false;
    });
    const confirmedHasFlat = confirmedCodes.some((code) => {
      const l = locations.find((x) => x.location_code === code);
      return l ? !isCircularLocation(l) : false;
    });
    return { confirmedHasCircular, confirmedHasFlat };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: see comment above
  }, [locations, pricesRef.current.size]);

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-5 w-64" />
        <Skeleton className="h-16 w-full rounded-xl" />
        <Skeleton className="h-32 w-full rounded-xl" />
      </div>
    );
  }

  // FIX-RQ-01: mostrar erro REAL em vez de 'sem técnicas' quando a RPC falha.
  // Antes: erro era silenciado — isError=true aparecia como locations=[] → 'sem técnicas'.
  // Agora: usuário vê a mensagem real e pode tentar novamente sem recarregar a página.
  if (isError) {
    const msg = error instanceof Error ? error.message : String(error ?? 'Erro desconhecido');
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-center">
        <p className="text-xs font-semibold text-destructive">Erro ao carregar técnicas</p>
        <p className="mt-1 text-[11px] text-muted-foreground">{msg}</p>
        <button
          type="button"
          onClick={() => void refetch()}
          className="mt-2 rounded-md bg-primary px-3 py-1 text-[11px] font-semibold text-primary-foreground hover:opacity-90"
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  if (!locations.length) {
    return (
      <div className="py-4 text-center text-sm text-muted-foreground">
        Este produto não possui opções de personalização configuradas.
      </div>
    );
  }

  const currentLocation = locations.find((l) => l.location_code === activeLocation);
  const hasCircularOption = locations.some(isCircularLocation);
  const hasFlatOption = locations.some((l) => !isCircularLocation(l));
  const mutuallyExclusive = hasCircularOption && hasFlatOption;

  return (
    <TooltipProvider>
      <div className="space-y-3">
        <div
          ref={stickyHeaderRef}
          className="sticky top-0 z-20 -mx-3 space-y-2 border-b border-border/40 bg-card/95 px-3 py-2 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-card/80 md:space-y-3 md:shadow-none"
        >
          <div className="scrollbar-none flex items-center gap-1.5 overflow-x-auto pb-1 text-[10px] font-medium text-muted-foreground md:gap-2 md:pb-0 md:text-[11px]">
            <button
              type="button"
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              className="flex shrink-0 items-center gap-1 transition-colors hover:text-primary md:gap-1.5"
            >
              <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground md:h-4 md:w-4 md:text-[10px]">
                1
              </span>
              <span>Local</span>
            </button>
            <span className="shrink-0 text-muted-foreground/40">→</span>
            <button
              type="button"
              onClick={() => scrollToStep(2)}
              className="flex shrink-0 items-center gap-1 transition-colors hover:text-primary md:gap-1.5"
            >
              <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-muted text-[9px] font-bold text-foreground md:h-4 md:w-4 md:text-[10px]">
                2
              </span>
              <span>Técnica</span>
            </button>
            <span className="shrink-0 text-muted-foreground/40">→</span>
            <button
              type="button"
              onClick={() => scrollToStep(3)}
              className="flex shrink-0 items-center gap-1 transition-colors hover:text-primary md:gap-1.5"
            >
              <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-muted text-[9px] font-bold text-foreground md:h-4 md:w-4 md:text-[10px]">
                3
              </span>
              <span>Tamanho</span>
            </button>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <p className="truncate text-[10px] font-semibold text-foreground md:text-xs">
                Onde a arte será gravada?
              </p>
              <Badge variant="outline" className="h-4 px-1 text-[9px]">
                {locations.length}
              </Badge>
            </div>

            <div className="grid grid-cols-3 gap-1.5 md:gap-2">
              {locations.map((loc) => {
                const isActive = activeLocation === loc.location_code;
                const hasPrice = pricesRef.current.has(loc.location_code);
                const isCircular = isCircularLocation(loc);

                let isDisabled = false;
                let disabledReason: string | null = null;
                if (mutuallyExclusive) {
                  if (isCircular && exclusion.confirmedHasFlat) {
                    isDisabled = true;
                    disabledReason =
                      'Remova as gravações de LADO A/B para usar gravação CIRCULAR (360°).';
                  } else if (!isCircular && exclusion.confirmedHasCircular) {
                    isDisabled = true;
                    disabledReason =
                      'Gravação CIRCULAR (360°) já cobre toda a peça. Remova-a para usar lados separados.';
                  }
                }

                const button = (
                  <button
                    key={loc.location_code}
                    type="button"
                    disabled={isDisabled}
                    onClick={() => !isDisabled && setActiveLocation(loc.location_code)}
                    className={cn(
                      'group relative flex h-10 w-full items-center justify-center gap-1.5 rounded-lg border px-2 text-center transition-all md:h-11 md:px-3',
                      isDisabled
                        ? 'cursor-not-allowed border-border bg-muted/30 opacity-40'
                        : isActive
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border bg-transparent text-foreground hover:border-primary/40 hover:bg-primary/5',
                    )}
                  >
                    <span className="truncate text-[10px] font-semibold uppercase tracking-wide md:text-xs">
                      {isCircular ? 'CIRCULAR 360°' : loc.location_name}
                    </span>
                    {hasPrice && <span className="text-[10px] font-bold text-primary">✓</span>}
                  </button>
                );


                return isDisabled && disabledReason ? (
                  <Tooltip key={loc.location_code}>
                    <TooltipTrigger asChild>
                      <span className="inline-flex">{button}</span>
                    </TooltipTrigger>
                    <TooltipContent side="top" className=" ">
                      {disabledReason}
                    </TooltipContent>
                  </Tooltip>
                ) : (
                  button
                );
              })}
            </div>

            {mutuallyExclusive && (
              <p className="pt-0.5 text-[10px] italic text-muted-foreground/80">
                💡 <span className="font-medium">CIRCULAR (360°)</span> é exclusivo: substitui
                gravações em LADO A/B.
              </p>
            )}
          </div>
        </div>

        {currentLocation && (
          <div
            ref={step2Ref}
            className="scroll-mt-28 space-y-2.5 rounded-xl border border-border/60 bg-background/40 p-3"
          >
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Técnicas para <span className="text-primary">{currentLocation.location_name}</span>
              </p>
              <Badge variant="secondary" className="text-[10px]">
                {currentLocation.options.length} técnica
                {currentLocation.options.length !== 1 ? 's' : ''}
              </Badge>
            </div>
            <div ref={step3Ref} className="scroll-mt-28 border-t border-border/40 pt-2">
              <LocationPanel
                key={currentLocation.location_code}
                location={currentLocation}
                quantity={quantity}
                productId={productId}
                confirmedPersonalization={pricesRef.current.get(currentLocation.location_code)}
                onPriceCalculated={handlePriceCalculated}
              />
            </div>
          </div>
        )}

        {pricesRef.current.size > 0 && (
          <div className="mt-5 border-t border-border/40 pt-3 animate-in fade-in slide-in-from-bottom-2">
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-success" />
                <h4 className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  Resumo das Configurações
                </h4>
              </div>
              <span className="text-[10px] tabular-nums text-muted-foreground">
                {pricesRef.current.size} {pricesRef.current.size === 1 ? 'local' : 'locais'}
              </span>
            </div>

            <div className="divide-y divide-success/15 overflow-hidden rounded-lg border border-success/20 bg-success/5">
              {Array.from(pricesRef.current.values()).map((item) => (
                <div
                  key={item.locationCode}
                  className="flex items-center justify-between gap-3 px-3 py-2"
                >
                  <div className="flex min-w-0 items-baseline gap-2">
                    <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-success">
                      {item.locationName}
                    </span>
                    <span className="truncate text-[12px] font-medium text-foreground">
                      {item.techniqueName}
                    </span>
                    <span className="hidden shrink-0 text-[10px] tabular-nums text-muted-foreground/70 sm:inline">
                      {item.width && item.height && <>· {item.width}×{item.height}cm </>}
                      · {item.numberOfColors} {item.numberOfColors === 1 ? 'cor' : 'cores'}
                    </span>
                  </div>
                  <span className="shrink-0 text-[13px] font-semibold tabular-nums text-success">
                    {item.price?.total_cobrado?.toLocaleString('pt-BR', {
                      style: 'currency',
                      currency: 'BRL',
                    })}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}


      </div>
    </TooltipProvider>
  );
}