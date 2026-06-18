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
  const code = (loc.location_code ?? '').toUpperCase();
  const name = (loc.location_name ?? '').toUpperCase();
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
  const { data: options, isLoading } = useProductCustomizationOptions(productId);
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
      // Calculate dynamic offset based on the actual height of the sticky header
      const headerHeight = stickyHeaderRef.current?.offsetHeight || 140;
      const elementPosition = target.current.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - headerHeight - 12; // -12 for extra breathing room

      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth',
      });
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
      const items = [...pricesRef.current.values()];
      onSelectionChange?.(items);
    },
    [options, onSelectionChange],
  );

  const locations = options?.locations ?? [];

  /** Calcula exclusividade circular ↔ plano. */
  const exclusion = useMemo(() => {
    const confirmedCodes = [...pricesRef.current.keys()];
    const confirmedHasCircular = confirmedCodes.some((code) => {
      const l = locations.find((x) => x.location_code === code);
      return l ? isCircularLocation(l) : false;
    });
    const confirmedHasFlat = confirmedCodes.some((code) => {
      const l = locations.find((x) => x.location_code === code);
      return l ? !isCircularLocation(l) : false;
    });
    return { confirmedHasCircular, confirmedHasFlat };
    // pricesRef é mutável, mas forceTick (via state) garante recomputação
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
        {/* Bloco fixo: stepper + locais — sempre visíveis durante a rolagem */}
        <div
          ref={stickyHeaderRef}
          className="sticky top-0 z-20 -mx-3 space-y-2 border-b border-border/40 bg-card/95 px-3 py-2 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-card/80 md:space-y-3 md:shadow-none"
        >
          {/* STEP HEADER — guia didático com âncoras */}
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

          {/* STEP 1 — Local */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <p className="truncate text-[10px] font-semibold text-foreground md:text-xs">
                Onde a arte será gravada?
              </p>
              <Badge variant="outline" className="h-4 px-1 text-[9px]">
                {locations.length}
              </Badge>
            </div>

            <div className="scrollbar-none flex snap-x gap-2 overflow-x-auto pb-1 md:grid md:grid-cols-2 md:overflow-x-visible md:pb-0 lg:grid-cols-3">
              {locations.map((loc) => {
                const isActive = activeLocation === loc.location_code;
                const hasPrice = pricesRef.current.has(loc.location_code);
                const isCircular = isCircularLocation(loc);

                // Regras de exclusão
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
                      'group relative flex min-w-[120px] snap-start flex-col items-start gap-0.5 rounded-xl border px-3 py-2 text-left transition-all md:min-w-0',
                      isDisabled
                        ? 'cursor-not-allowed border-border bg-muted/30 opacity-40'
                        : isActive
                          ? 'border-primary bg-primary/15 shadow-sm ring-2 ring-primary/30'
                          : hasPrice
                            ? 'border-primary/40 bg-primary/5 hover:bg-primary/10'
                            : 'border-border bg-secondary/40 hover:border-primary/30 hover:bg-secondary',
                    )}
                  >
                    <div className="flex w-full items-center justify-between">
                      <span
                        className={cn(
                          'text-xs font-bold uppercase tracking-wide',
                          isActive ? 'text-primary' : 'text-foreground',
                        )}
                      >
                        {loc.location_name}
                      </span>
                      {hasPrice && <span className="text-[10px] font-bold text-primary">✓</span>}
                    </div>
                    <span className="text-[10px] text-muted-foreground">
                      {isCircular ? 'Volta toda · 360°' : 'Lado único'}
                    </span>
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
          {/* /fim do bloco sticky (stepper + locais) */}
        </div>

        {/* STEPS 2 + 3 — Técnica + Tamanho (rolam normalmente abaixo do bloco fixo) */}
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

        {/* SUMMARY — Resumo final das gravações confirmadas */}
        {pricesRef.current.size > 0 && (
          <div className="mt-6 border-t border-border/60 pt-4 animate-in fade-in slide-in-from-bottom-2">
            <div className="mb-3 flex items-center gap-2">
              <div className="h-1.5 w-1.5 rounded-full bg-primary" />
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-foreground">
                Resumo das Configurações
              </h4>
            </div>

            <div className="grid gap-2">
              {[...pricesRef.current.values()].map((item) => (
                <div
                  key={item.locationCode}
                  className="flex items-start justify-between rounded-lg border border-primary/10 bg-primary/5 p-2.5"
                >
                  <div className="space-y-0.5">
                    <p className="mb-1 text-[10px] font-bold uppercase leading-none text-primary">
                      {item.locationName}
                    </p>
                    <p className="text-xs font-semibold text-foreground">{item.techniqueName}</p>
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                      {item.width && item.height && (
                        <span>
                          {item.width} × {item.height} cm
                        </span>
                      )}
                      {item.width && item.height && <span>•</span>}
                      <span>
                        {item.numberOfColors} {item.numberOfColors === 1 ? 'cor' : 'cores'}
                      </span>
                    </div>
                  </div>

                  <div className="text-right">
                    <p className="text-[10px] uppercase text-muted-foreground">Total Local</p>
                    <p className="text-xs font-bold text-primary">
                      {item.price?.total_cobrado?.toLocaleString('pt-BR', {
                        style: 'currency',
                        currency: 'BRL',
                      })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}
