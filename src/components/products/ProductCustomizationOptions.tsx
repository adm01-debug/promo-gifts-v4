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

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useProductCustomizationOptions } from "@/hooks/products/useProductCustomizationOptions";
import { LocationPanel } from "./customization/LocationPanel";
import type {
  CustomizationPriceResponseV6,
  GravacaoLocation,
  PersonalizationItem,
} from "@/types/customization";

interface ProductCustomizationOptionsProps {
  productId: string;
  productSku?: string;
  quantity?: number;
  initialPersonalizations?: PersonalizationItem[];
  onSelectionChange?: (personalizations: PersonalizationItem[]) => void;
}

/** Detecta se um local é "CIRCULAR/360°" (mutuamente exclusivo com locais planos). */
function isCircularLocation(loc: GravacaoLocation): boolean {
  const code = (loc.location_code || "").toUpperCase();
  const name = (loc.location_name || "").toUpperCase();
  return (
    code.includes("CIRCULAR") ||
    code.includes("360") ||
    name.includes("CIRCULAR") ||
    name.includes("360")
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
    forceTick(n => n + 1);
  }, [productId]);

  // Initialize from initialPersonalizations
  useEffect(() => {
    if (!hasInitialized.current && initialPersonalizations.length > 0) {
      initialPersonalizations.forEach(item => {
        if (item.locationCode) {
          pricesRef.current.set(item.locationCode, item);
        }
      });
      hasInitialized.current = true;
      forceTick(n => n + 1);
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
        behavior: "smooth"
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
          numberOfColors: price.num_cores,
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
    // pricesRef é mutável, mas forceTick (via state) garante recomputação
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
      <div className="text-center py-4 text-muted-foreground text-sm">
        Este produto não possui opções de personalização configuradas.
      </div>
    );
  }

  const currentLocation = locations.find((l) => l.location_code === activeLocation);
  const hasCircularOption = locations.some(isCircularLocation);
  const hasFlatOption = locations.some((l) => !isCircularLocation(l));
  const mutuallyExclusive = hasCircularOption && hasFlatOption;

  return (
    <TooltipProvider delayDuration={200}>
      <div className="space-y-3">
        {/* Bloco fixo: stepper + locais — sempre visíveis durante a rolagem */}
        <div 
          ref={stickyHeaderRef}
          className="sticky top-0 z-20 -mx-3 px-3 py-2 bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80 border-b border-border/40 shadow-sm md:shadow-none space-y-2 md:space-y-3"
        >

        {/* STEP HEADER — guia didático com âncoras */}
        <div className="flex items-center gap-1.5 md:gap-2 text-[10px] md:text-[11px] font-medium text-muted-foreground overflow-x-auto pb-1 md:pb-0 scrollbar-none">
          <button 
            type="button"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="flex items-center gap-1 md:gap-1.5 shrink-0 hover:text-primary transition-colors"
          >
            <span className="flex h-3.5 w-3.5 md:h-4 md:w-4 items-center justify-center rounded-full bg-primary text-[9px] md:text-[10px] font-bold text-primary-foreground">
              1
            </span>
            <span>Local</span>
          </button>
          <span className="text-muted-foreground/40 shrink-0">→</span>
          <button 
            type="button"
            onClick={() => scrollToStep(2)}
            className="flex items-center gap-1 md:gap-1.5 shrink-0 hover:text-primary transition-colors"
          >
            <span className="flex h-3.5 w-3.5 md:h-4 md:w-4 items-center justify-center rounded-full bg-muted text-[9px] md:text-[10px] font-bold text-foreground">
              2
            </span>
            <span>Técnica</span>
          </button>
          <span className="text-muted-foreground/40 shrink-0">→</span>
          <button 
            type="button"
            onClick={() => scrollToStep(3)}
            className="flex items-center gap-1 md:gap-1.5 shrink-0 hover:text-primary transition-colors"
          >
            <span className="flex h-3.5 w-3.5 md:h-4 md:w-4 items-center justify-center rounded-full bg-muted text-[9px] md:text-[10px] font-bold text-foreground">
              3
            </span>
            <span>Tamanho</span>
          </button>
        </div>

        {/* STEP 1 — Local */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[10px] md:text-xs font-semibold text-foreground truncate">
              Onde a arte será gravada?
            </p>
            <Badge variant="outline" className="text-[9px] px-1 h-4">
              {locations.length}
            </Badge>
          </div>

          <div className="flex md:grid md:grid-cols-3 gap-2 overflow-x-auto md:overflow-x-visible pb-1 md:pb-0 scrollbar-none snap-x">
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
                    "Remova as gravações de LADO A/B para usar gravação CIRCULAR (360°).";
                } else if (!isCircular && exclusion.confirmedHasCircular) {
                  isDisabled = true;
                  disabledReason =
                    "Gravação CIRCULAR (360°) já cobre toda a peça. Remova-a para usar lados separados.";
                }
              }

              const button = (
                <button
                  key={loc.location_code}
                  type="button"
                  disabled={isDisabled}
                  onClick={() => !isDisabled && setActiveLocation(loc.location_code)}
                  className={cn(
                    "group relative flex flex-col items-start gap-0.5 rounded-xl border px-3 py-2 text-left transition-all min-w-[120px] md:min-w-0 snap-start",
                    isDisabled
                      ? "cursor-not-allowed opacity-40 bg-muted/30 border-border"
                      : isActive
                        ? "border-primary bg-primary/15 ring-2 ring-primary/30 shadow-sm"
                        : hasPrice
                          ? "border-primary/40 bg-primary/5 hover:bg-primary/10"
                          : "border-border bg-secondary/40 hover:bg-secondary hover:border-primary/30",
                  )}
                >
                  <div className="flex w-full items-center justify-between">
                    <span
                      className={cn(
                        "text-xs font-bold uppercase tracking-wide",
                        isActive ? "text-primary" : "text-foreground",
                      )}
                    >
                      {loc.location_name}
                    </span>
                    {hasPrice && (
                      <span className="text-[10px] font-bold text-primary">✓</span>
                    )}
                  </div>
                  <span className="text-[10px] text-muted-foreground">
                    {isCircular ? "Volta toda · 360°" : "Lado único"}
                  </span>
                </button>
              );

              return isDisabled && disabledReason ? (
                <Tooltip key={loc.location_code}>
                  <TooltipTrigger asChild>
                    <span className="inline-flex">{button}</span>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-[220px] text-xs">
                    {disabledReason}
                  </TooltipContent>
                </Tooltip>
              ) : (
                button
              );
            })}
          </div>

          {mutuallyExclusive && (
            <p className="text-[10px] text-muted-foreground/80 italic pt-0.5">
              💡 <span className="font-medium">CIRCULAR (360°)</span> é exclusivo: substitui
              gravações em LADO A/B.
            </p>
          )}
        </div>
        {/* /fim do bloco sticky (stepper + locais) */}
        </div>

        {/* STEPS 2 + 3 — Técnica + Tamanho (rolam normalmente abaixo do bloco fixo) */}
        {currentLocation && (
          <div ref={step2Ref} className="rounded-xl border border-border/60 bg-background/40 p-3 space-y-2.5 scroll-mt-28">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Técnicas para{" "}
                <span className="text-primary">{currentLocation.location_name}</span>
              </p>
              <Badge variant="secondary" className="text-[10px]">
                {currentLocation.options.length} técnica
                {currentLocation.options.length !== 1 ? "s" : ""}
              </Badge>
            </div>
            <div ref={step3Ref} className="pt-2 border-t border-border/40 scroll-mt-28">
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
          <div className="mt-6 pt-4 border-t border-border/60 animate-in fade-in slide-in-from-bottom-2">
            <div className="flex items-center gap-2 mb-3">
              <div className="h-1.5 w-1.5 rounded-full bg-primary" />
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-foreground">
                Resumo das Configurações
              </h4>
            </div>
            
            <div className="grid gap-2">
              {Array.from(pricesRef.current.values()).map((item) => (
                <div 
                  key={item.locationCode}
                  className="flex items-start justify-between p-2.5 rounded-lg bg-primary/5 border border-primary/10"
                >
                  <div className="space-y-0.5">
                    <p className="text-[10px] font-bold text-primary uppercase leading-none mb-1">
                      {item.locationName}
                    </p>
                    <p className="text-xs font-semibold text-foreground">
                      {item.techniqueName}
                    </p>
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                      {item.width && item.height && (
                        <span>{item.width} × {item.height} cm</span>
                      )}
                      {item.width && item.height && <span>•</span>}
                      <span>{item.numberOfColors} {item.numberOfColors === 1 ? 'cor' : 'cores'}</span>
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <p className="text-[10px] text-muted-foreground uppercase">Total Local</p>
                    <p className="text-xs font-bold text-primary">
                      {item.price?.total_cobrado?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
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
