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
import { Info, Palette, Package, Ruler } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useProductCustomizationOptions } from "@/hooks/useProductCustomizationOptions";
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
      const headerOffset = stickyHeaderRef.current?.offsetHeight || 80;
      const elementPosition = target.current.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - headerOffset - 20;

      window.scrollTo({
        top: offsetPosition,
        behavior: "smooth"
      });
    }
  };

  const handleLocationSelect = useCallback((locationCode: string) => {
    setActiveLocation(locationCode);
    // Smooth scroll para a área de conteúdo se estiver no mobile
    if (window.innerWidth < 768) {
      setTimeout(() => {
        step2Ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    }
  }, []);

  const handlePriceCalculated = useCallback(
    (
      locationCode: string,
      techniqueId: string,
      price: CustomizationPriceResponseV6 | null,
      dimensions?: { width?: number; height?: number }
    ) => {
      if (!options) return;

      const loc = options.locations.find((l) => l.location_code === locationCode);
      const tech = loc?.options.find((t) => t.technique_id === techniqueId);

      if (price && loc && tech) {
        pricesRef.current.set(locationCode, {
          locationCode,
          locationName: loc.location_name,
          techniqueId,
          techniqueName: tech.tecnica_nome,
          codigoTabela: tech.codigo_tabela,
          grupoTecnica: tech.grupo_tecnica,
          width: dimensions?.width,
          height: dimensions?.height,
          numberOfColors: price.num_cores,
          usaDimensao: tech.usa_dimensao,
          price,
        });
      } else {
        pricesRef.current.delete(locationCode);
      }

      forceTick((n) => n + 1);
      onSelectionChange?.(Array.from(pricesRef.current.values()));
    },
    [options, onSelectionChange]
  );

  const locations = options?.locations || [];
  const currentLocation = locations.find((l) => l.location_code === activeLocation);

  // Regras de exclusividade para o UI (exibir tooltips/disabled)
  const exclusion = useMemo(() => {
    const confirmed = Array.from(pricesRef.current.values());
    const hasCircular = confirmed.some((item) => {
      const loc = locations.find((l) => l.location_code === item.locationCode);
      return loc ? isCircularLocation(loc) : false;
    });
    const hasFlat = confirmed.some((item) => {
      const loc = locations.find((l) => l.location_code === item.locationCode);
      return loc ? !isCircularLocation(loc) : false;
    });

    return {
      confirmedHasCircular: hasCircular,
      confirmedHasFlat: hasFlat,
    };
  }, [locations, forceTick]); // forceTick ensures update when pricesRef changes

  const hasCircularOption = locations.some(isCircularLocation);
  const hasFlatOption = locations.some((l) => !isCircularLocation(l));
  const mutuallyExclusive = hasCircularOption && hasFlatOption;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-24 w-full rounded-xl" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Skeleton className="h-16 rounded-lg" />
          <Skeleton className="h-16 rounded-lg" />
          <Skeleton className="h-16 rounded-lg" />
          <Skeleton className="h-16 rounded-lg" />
        </div>
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex flex-col gap-6">
        {/* STEP 1 — Local Selection (Pinned Header) */}
        <div 
          ref={stickyHeaderRef}
          className="sticky top-0 z-20 -mx-4 px-4 py-4 bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80 border-b border-border/40 shadow-sm md:shadow-none space-y-4"
        >
          {/* STEP HEADER — Modern Progress Bar */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-1 rounded-full bg-muted overflow-hidden">
              <div 
                className="h-full bg-primary transition-all duration-500" 
                style={{ 
                  width: pricesRef.current.has(activeLocation || '') 
                    ? '100%' 
                    : activeLocation 
                      ? '66%' 
                      : '33%' 
                }}
              />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground whitespace-nowrap">
              {pricesRef.current.has(activeLocation || '') 
                ? 'Concluído' 
                : activeLocation 
                  ? 'Passo 2 de 3' 
                  : 'Passo 1 de 3'}
            </span>
          </div>

          <div className="flex items-center gap-2 md:gap-4 pb-2">
            <button 
              type="button"
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              className="flex items-center gap-1.5 shrink-0 hover:text-primary transition-colors"
            >
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                1
              </span>
              <span className="text-xs font-bold">Local</span>
            </button>
            <span className="text-muted-foreground/30 shrink-0">→</span>
            <button 
              type="button"
              onClick={() => scrollToStep(2)}
              className="flex items-center gap-1.5 shrink-0 hover:text-primary transition-colors"
            >
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-muted text-[10px] font-bold text-foreground">
                2
              </span>
              <span className="text-xs font-bold">Técnica</span>
            </button>
            <span className="text-muted-foreground/30 shrink-0">→</span>
            <button 
              type="button"
              onClick={() => scrollToStep(3)}
              className="flex items-center gap-1.5 shrink-0 hover:text-primary transition-colors"
            >
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-muted text-[10px] font-bold text-foreground">
                3
              </span>
              <span className="text-xs font-bold">Tamanho</span>
            </button>
          </div>

          {/* Local Selection Cards */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-foreground">
                Escolha o Local
              </h3>
              {mutuallyExclusive && (
                <Badge variant="outline" className="text-[9px] gap-1 text-amber-600 border-amber-200 bg-amber-50">
                  <Info className="h-2.5 w-2.5" />
                  Opções Exclusivas
                </Badge>
              )}
            </div>

            <div className="flex md:grid md:grid-cols-4 gap-2 overflow-x-auto md:overflow-x-visible pb-1 md:pb-0 scrollbar-none snap-x">
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
                    onClick={() => !isDisabled && handleLocationSelect(loc.location_code)}
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
        </div>

        {/* STEPS 2 + 3 — Content Area (Focused Workspace) */}
        <div className="space-y-6">
          {currentLocation ? (
            <div 
              ref={step2Ref} 
              className="rounded-2xl border border-border/40 bg-background/50 p-4 md:p-6 shadow-sm animate-in fade-in zoom-in-95 duration-300"
            >
              <LocationPanel
                key={currentLocation.location_code}
                location={currentLocation}
                quantity={quantity}
                confirmedPersonalization={pricesRef.current.get(currentLocation.location_code)}
                onPriceCalculated={handlePriceCalculated}
              />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 border-2 border-dashed rounded-2xl bg-muted/5">
              <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
                <Package className="h-8 w-8 text-muted-foreground/40" />
              </div>
              <p className="text-sm font-medium text-muted-foreground">Selecione um local acima para começar</p>
            </div>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}
