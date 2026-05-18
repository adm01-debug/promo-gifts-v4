/**
 * ProductCustomizationOptions — Seletor de personalização v6
 *
 * Fluxo guiado passo a passo:
 *   1) Local de gravação (LADO A / LADO B / CIRCULAR 360°)
 *   2) Técnica disponível para aquele local
 *   3) Tamanho / cores (configuração)
 */

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { Info, Palette, Package, Ruler, Lock, CheckCircle2, RotateCcw } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
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

  const pricesRef = useRef<Map<string, PersonalizationItem>>(new Map());
  const hasInitialized = useRef(false);
  const [, forceTick] = useState(0);

  useEffect(() => {
    pricesRef.current.clear();
    setActiveLocation(null);
    hasInitialized.current = false;
    forceTick(n => n + 1);
  }, [productId]);

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

  const stickyHeaderRef = useRef<HTMLDivElement>(null);
  const step2Ref = useRef<HTMLDivElement>(null);

  const scrollToStep = (step: number) => {
    const refs = [null, null, step2Ref];
    const target = (refs[step] as React.RefObject<HTMLDivElement>)?.current;
    
    if (target) {
      // Inside a modal, we need to scroll the container, not the window
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handleResetAll = useCallback(() => {
    pricesRef.current.clear();
    setActiveLocation(null);
    forceTick(n => n + 1);
    onSelectionChange?.([]);
  }, [onSelectionChange]);

  const handleLocationSelect = useCallback((locationCode: string) => {
    setActiveLocation(locationCode);
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

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // Parent Dialog handles this, but we can do extra logic here if needed
      }
      if (e.target instanceof HTMLInputElement) return;
      
      if (e.key === '1') handleLocationSelect(locations[0]?.location_code);
      if (e.key === '2') handleLocationSelect(locations[1]?.location_code);
      if (e.key === '3') handleLocationSelect(locations[2]?.location_code);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [locations, handleLocationSelect]);

  const locations = options?.locations || [];
  const currentLocation = locations.find((l) => l.location_code === activeLocation);

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

    return { confirmedHasCircular: hasCircular, confirmedHasFlat: hasFlat };
  }, [locations, forceTick]);

  const hasCircularOption = locations.some(isCircularLocation);
  const hasFlatOption = locations.some((l) => !isCircularLocation(l));
  const mutuallyExclusive = hasCircularOption && hasFlatOption;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-24 w-full rounded-xl" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Skeleton className="h-16 rounded-lg" /><Skeleton className="h-16 rounded-lg" />
          <Skeleton className="h-16 rounded-lg" /><Skeleton className="h-16 rounded-lg" />
        </div>
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex flex-col gap-6">
        {/* STEP 1 — Pinned Header */}
        <div 
          ref={stickyHeaderRef}
          className="sticky top-0 z-20 -mx-4 px-4 py-4 bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80 border-b border-border/40 shadow-sm md:shadow-none space-y-6"
        >
          {/* STEP HEADER — Connected Progress Line */}
          <div className="flex items-center justify-between gap-4 px-2">
            {[
              { step: 1, label: "Local", active: !activeLocation, done: !!activeLocation },
              { step: 2, label: "Técnica", active: !!activeLocation && !pricesRef.current.has(activeLocation || ''), done: pricesRef.current.has(activeLocation || '') },
              { step: 3, label: "Tamanho", active: pricesRef.current.has(activeLocation || ''), done: false },
            ].map((s, i, arr) => (
              <div key={s.step} className="flex flex-1 items-center gap-2">
                <button
                  type="button"
                  onClick={() => s.step === 1 ? window.scrollTo({ top: 0, behavior: 'smooth' }) : scrollToStep(s.step)}
                  className={cn(
                    "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold transition-all",
                    s.done ? "bg-primary text-primary-foreground" : s.active ? "bg-primary/20 text-primary ring-2 ring-primary/30" : "bg-muted text-muted-foreground"
                  )}
                >
                  {s.done ? (
                    <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}>
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    </motion.div>
                  ) : s.step}
                </button>
                <span className={cn(
                  "text-[10px] font-bold uppercase tracking-wider",
                  s.active || s.done ? "text-foreground" : "text-muted-foreground"
                )}>
                  {s.label}
                </span>
                {i < arr.length - 1 && (
                  <div className="flex-1 h-[2px] bg-muted mx-2 rounded-full overflow-hidden">
                    <motion.div 
                      className="h-full bg-primary"
                      initial={{ width: 0 }}
                      animate={{ width: s.done ? "100%" : "0%" }}
                      transition={{ duration: 0.5, ease: "easeInOut" }}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h3 className="text-[11px] font-bold uppercase tracking-widest text-foreground">
                  Escolha o Local
                </h3>
                {mutuallyExclusive && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button type="button" className="text-amber-600 hover:text-amber-700 transition-colors">
                        <Info className="h-4 w-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="bg-amber-50 text-amber-900 border-amber-200 text-[10px] max-w-[200px]">
                      Este produto possui opções de gravação exclusivas (Circular 360° vs. Lado A/B).
                    </TooltipContent>
                  </Tooltip>
                )}
              </div>
              
              {pricesRef.current.size > 0 && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={handleResetAll}
                  className="h-7 text-[9px] font-bold text-muted-foreground hover:text-destructive gap-1.5 uppercase tracking-widest"
                >
                  <RotateCcw className="h-3 w-3" />
                  Limpar Tudo
                </Button>
              )}
            </div>

            <div className="flex md:grid md:grid-cols-4 gap-2 overflow-x-auto md:overflow-x-visible pb-1 md:pb-0 scrollbar-none snap-x">
              {locations.map((loc, idx) => {
                const isActive = activeLocation === loc.location_code;
                const hasPrice = pricesRef.current.has(loc.location_code);
                const isCircular = isCircularLocation(loc);

                let isDisabled = false;
                let disabledReason: string | null = null;
                if (mutuallyExclusive) {
                  if (isCircular && exclusion.confirmedHasFlat) {
                    isDisabled = true;
                    disabledReason = "Remova LADO A/B para usar CIRCULAR (360°).";
                  } else if (!isCircular && exclusion.confirmedHasCircular) {
                    isDisabled = true;
                    disabledReason = "Remova CIRCULAR (360°) para usar lados separados.";
                  }
                }

                const button = (
                  <motion.button
                    key={loc.location_code}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    whileHover={{ scale: isDisabled ? 1 : 1.02 }}
                    whileTap={{ scale: isDisabled ? 1 : 0.98 }}
                    type="button"
                    disabled={isDisabled}
                    onClick={() => !isDisabled && handleLocationSelect(loc.location_code)}
                    className={cn(
                      "group relative flex flex-col items-start gap-1 rounded-xl border px-3 py-2.5 text-left transition-all min-w-[130px] md:min-w-0 snap-start",
                      isDisabled
                        ? "cursor-not-allowed opacity-40 bg-muted/30 border-border"
                        : isActive
                          ? "border-primary bg-primary/10 ring-2 ring-primary/30 shadow-md z-10"
                          : hasPrice
                            ? "border-emerald-500/50 bg-emerald-500/5 hover:bg-emerald-500/10 shadow-sm"
                            : "border-border bg-secondary/30 hover:bg-secondary/60 hover:border-primary/30",
                    )}
                  >
                    <div className="flex w-full items-center justify-between">
                      <span className={cn("text-[11px] font-bold uppercase tracking-wider", isActive ? "text-primary" : hasPrice ? "text-emerald-600" : "text-foreground")}>
                        {loc.location_name}
                      </span>
                      {isDisabled ? <Lock className="h-3 w-3 text-muted-foreground/60" /> : hasPrice ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> : null}
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[9px] font-medium text-muted-foreground/80">{isCircular ? "Volta toda · 360°" : "Lado único"}</span>
                      {hasPrice && pricesRef.current.get(loc.location_code)?.price && (
                        <span className="text-[10px] font-bold text-emerald-600 mt-0.5">
                          {pricesRef.current.get(loc.location_code)?.price?.preco_unitario.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </span>
                      )}
                    </div>
                  </motion.button>
                );

                return isDisabled && disabledReason ? (
                  <Tooltip key={loc.location_code}>
                    <TooltipTrigger asChild><span className="inline-flex">{button}</span></TooltipTrigger>
                    <TooltipContent side="top" className="max-w-[220px] text-xs">{disabledReason}</TooltipContent>
                  </Tooltip>
                ) : button;
              })}
            </div>
          </div>
        </div>

        {/* Workspace Area */}
        <div className="space-y-6">
          <AnimatePresence mode="wait">
            {currentLocation ? (
              <motion.div 
                key={currentLocation.location_code}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
                ref={step2Ref} 
                className="rounded-2xl border border-border/40 bg-background/50 p-4 md:p-6 shadow-sm"
              >
                <LocationPanel
                  key={currentLocation.location_code}
                  location={currentLocation}
                  quantity={quantity}
                  confirmedPersonalization={pricesRef.current.get(currentLocation.location_code)}
                  onPriceCalculated={handlePriceCalculated}
                />
              </motion.div>
            ) : (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center justify-center py-20 border-2 border-dashed rounded-3xl bg-muted/5 border-muted-foreground/10"
              >
                <div className="relative mb-6">
                  <div className="absolute inset-0 bg-primary/10 blur-3xl rounded-full" />
                  <div className="relative h-20 w-20 rounded-2xl bg-gradient-to-br from-background to-muted flex items-center justify-center shadow-inner border border-border/50">
                    <Palette className="h-10 w-10 text-muted-foreground/30 animate-pulse" />
                  </div>
                </div>
                <h4 className="text-sm font-bold text-foreground mb-1">Inicie a Configuração</h4>
                <p className="text-[11px] text-muted-foreground max-w-[220px] text-center px-4 leading-relaxed">
                  Selecione um local de gravação no topo para definir a técnica e as dimensões.
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer shortcuts legend */}
        <div className="flex items-center justify-center gap-6 pt-4 border-t border-border/40">
          <div className="flex items-center gap-1.5 text-[9px] font-bold text-muted-foreground uppercase tracking-widest">
            <kbd className="px-1.5 py-0.5 rounded bg-muted border border-border/60 text-foreground">1-4</kbd>
            Trocar Local
          </div>
          <div className="flex items-center gap-1.5 text-[9px] font-bold text-muted-foreground uppercase tracking-widest">
            <kbd className="px-1.5 py-0.5 rounded bg-muted border border-border/60 text-foreground">Enter</kbd>
            Confirmar
          </div>
          <div className="flex items-center gap-1.5 text-[9px] font-bold text-muted-foreground uppercase tracking-widest">
            <kbd className="px-1.5 py-0.5 rounded bg-muted border border-border/60 text-foreground">Esc</kbd>
            Sair
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
