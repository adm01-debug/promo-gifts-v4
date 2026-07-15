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

import { useState, useCallback, useRef, useEffect, useMemo, useId } from 'react';
import { ChevronDown, ChevronUp, Maximize2 } from 'lucide-react';
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
  /**
   * 'auto' (default): grid 2-col com aside sticky em ≥lg (PDP).
   * 'stacked': fluxo vertical single-column compacto (drawer estreito).
   */
  layout?: 'auto' | 'stacked';
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
  layout = 'auto',
}: ProductCustomizationOptionsProps) {
  const stacked = layout === 'stacked';
  const { data: options, isLoading, isError, error, refetch } = useProductCustomizationOptions(productId);
  const [activeLocation, setActiveLocation] = useState<string | null>(null);

  // Track prices per location
  const pricesRef = useRef<Map<string, PersonalizationItem>>(new Map());
  const hasInitialized = useRef(false);

  // Force re-render when pricesRef changes (badges/exclusão dependem disso)
  const [, forceTick] = useState(0);

  // Persistência do estado colapsado (por produto) — sobrevive entre sessões.
  const summaryStorageKey = `pgo:customization-summary-collapsed:${productId}`;
  const itemsStorageKey = `pgo:customization-summary-items-collapsed:${productId}`;
  const summaryBodyId = useId();

  const [summaryCollapsed, setSummaryCollapsed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    try {
      return window.localStorage.getItem(summaryStorageKey) === '1';
    } catch {
      return false;
    }
  });
  const [collapsedItems, setCollapsedItems] = useState<Set<string>>(() => {
    if (typeof window === 'undefined') return new Set();
    try {
      const raw = window.localStorage.getItem(itemsStorageKey);
      return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
    } catch {
      return new Set();
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(summaryStorageKey, summaryCollapsed ? '1' : '0');
    } catch {
      /* storage indisponível — ignora silenciosamente */
    }
  }, [summaryCollapsed, summaryStorageKey]);

  useEffect(() => {
    try {
      window.localStorage.setItem(itemsStorageKey, JSON.stringify(Array.from(collapsedItems)));
    } catch {
      /* storage indisponível — ignora silenciosamente */
    }
  }, [collapsedItems, itemsStorageKey]);

  const toggleItemCollapsed = useCallback((code: string) => {
    setCollapsedItems((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  }, []);

  const expandAll = useCallback(() => {
    setSummaryCollapsed(false);
    setCollapsedItems(new Set());
  }, []);

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

  const summaryItems = Array.from(pricesRef.current.values());

  const hasAnyItemCollapsed =
    summaryCollapsed || summaryItems.some((it) => collapsedItems.has(it.locationCode));

  const summary = pricesRef.current.size > 0 && (
    <div
      className="animate-in fade-in slide-in-from-bottom-2 motion-reduce:animate-none"
      data-testid="customization-summary"
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-1.5 rounded-full bg-success" />
          <h4 className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Resumo das Configurações
          </h4>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] tabular-nums text-muted-foreground">
            {summaryItems.length} {summaryItems.length === 1 ? 'local' : 'locais'}
          </span>
          {hasAnyItemCollapsed && (
            <button
              type="button"
              onClick={expandAll}
              aria-label="Expandir todos os blocos de configuração"
              className="inline-flex h-6 items-center gap-1 rounded-md border border-success/20 bg-success/5 px-1.5 text-[10px] font-medium text-success transition-colors hover:bg-success/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-success/50 focus-visible:ring-offset-1 focus-visible:ring-offset-background"
            >
              <Maximize2 className="h-3 w-3" aria-hidden="true" />
              <span>Expandir tudo</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => setSummaryCollapsed((v) => !v)}
            aria-expanded={!summaryCollapsed}
            aria-controls={summaryBodyId}
            aria-label={summaryCollapsed ? 'Expandir resumo das configurações' : 'Colapsar resumo das configurações'}
            title={summaryCollapsed ? 'Expandir resumo' : 'Colapsar resumo'}
            className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-success/20 bg-success/5 text-success transition-colors hover:bg-success/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-success/50 focus-visible:ring-offset-1 focus-visible:ring-offset-background"
          >
            {summaryCollapsed ? (
              <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
            ) : (
              <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" />
            )}
          </button>
        </div>
      </div>

      {/* Colapso com transição suave via CSS grid-rows (respeita prefers-reduced-motion). */}
      <div
        id={summaryBodyId}
        role="region"
        aria-label="Detalhes do resumo das configurações"
        hidden={summaryCollapsed}
        className={cn(
          'grid transition-[grid-template-rows,opacity] duration-300 ease-in-out motion-reduce:transition-none',
          summaryCollapsed ? 'grid-rows-[0fr] opacity-0' : 'grid-rows-[1fr] opacity-100',
        )}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="divide-y divide-success/15 overflow-hidden rounded-md border border-success/20 bg-success/5">
            {summaryItems.map((item) => {
              const unit = item.price?.preco_unitario ?? 0;
              const setup =
                (item.price?.valor_gravacao ?? 0) + (item.price?.setup_total ?? 0);
              const itemBodyId = `${summaryBodyId}-${item.locationCode}`;
              const itemCollapsed = collapsedItems.has(item.locationCode);
              return (
                <div key={item.locationCode} className="space-y-1.5 px-2.5 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-baseline gap-1.5">
                      <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-success">
                        {item.locationName}
                      </span>
                      <span className="truncate text-[11px] font-medium text-foreground">
                        {item.techniqueName}
                      </span>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <span className="text-[10px] tabular-nums text-success/80">
                        {item.width && item.height && <>{item.width}×{item.height}cm · </>}
                        {item.numberOfColors}c
                      </span>
                      <button
                        type="button"
                        onClick={() => toggleItemCollapsed(item.locationCode)}
                        aria-expanded={!itemCollapsed}
                        aria-controls={itemBodyId}
                        aria-label={
                          itemCollapsed
                            ? `Expandir detalhes de ${item.locationName}`
                            : `Colapsar detalhes de ${item.locationName}`
                        }
                        className="inline-flex h-5 w-5 items-center justify-center rounded text-success/70 transition-colors hover:bg-success/10 hover:text-success focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-success/50"
                      >
                        {itemCollapsed ? (
                          <ChevronDown className="h-3 w-3" aria-hidden="true" />
                        ) : (
                          <ChevronUp className="h-3 w-3" aria-hidden="true" />
                        )}
                      </button>
                    </div>
                  </div>
                  <div
                    id={itemBodyId}
                    hidden={itemCollapsed}
                    className={cn(
                      'grid transition-[grid-template-rows,opacity] duration-200 ease-in-out motion-reduce:transition-none',
                      itemCollapsed ? 'grid-rows-[0fr] opacity-0' : 'grid-rows-[1fr] opacity-100',
                    )}
                  >
                    <dl className="min-h-0 space-y-0.5 overflow-hidden text-[11px]">
                      <div className="flex items-center justify-between">
                        <dt className="text-muted-foreground">Preço unitário</dt>
                        <dd className="font-medium tabular-nums text-foreground">
                          R$ {unit.toFixed(2)}
                        </dd>
                      </div>
                      <div className="flex items-center justify-between">
                        <dt className="text-muted-foreground">Setup + gravação</dt>
                        <dd className="font-medium tabular-nums text-foreground">
                          R$ {setup.toFixed(2)}
                        </dd>
                      </div>
                      <div className="flex items-center justify-between border-t border-success/15 pt-1">
                        <dt className="text-[10px] font-semibold uppercase tracking-wide text-success">
                          Total
                        </dt>
                        <dd className="text-[13px] font-semibold tabular-nums text-success">
                          {(item.price?.total_cobrado ?? 0).toLocaleString('pt-BR', {
                            style: 'currency',
                            currency: 'BRL',
                          })}
                        </dd>
                      </div>
                    </dl>
                  </div>
                </div>
              );
            })}
          </div>

          {summaryItems.length > 1 && (
            <div className="mt-2 flex items-center justify-between rounded-md border border-success/20 bg-success/[0.04] px-2.5 py-2">
              <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                Total personalização
              </span>
              <span className="text-[15px] font-bold tabular-nums text-success">
                {summaryItems
                  .reduce((acc, it) => acc + (it.price?.total_cobrado ?? 0), 0)
                  .toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <TooltipProvider>
      <div className={cn(!stacked && 'lg:grid lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start lg:gap-6')}>
        <div className="space-y-3">
        <div
          ref={stickyHeaderRef}
          className={cn(
            'sticky top-0 z-20 -mx-3 space-y-2 border-b border-border/40 bg-card/95 px-3 py-2 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-card/80 md:space-y-3 md:shadow-none',
            !stacked && 'lg:static lg:mx-0 lg:rounded-xl lg:border lg:border-border/60 lg:bg-background/40 lg:px-3 lg:shadow-none',
          )}
        >
          <nav
            aria-label="Etapas da personalização"
            className="scrollbar-none flex items-center gap-1.5 overflow-x-auto pb-1 text-[10px] font-medium text-muted-foreground md:gap-2 md:pb-0 md:text-[11px]"
          >
            {[
              { n: 1, label: 'Local', onClick: () => window.scrollTo({ top: 0, behavior: 'smooth' }), active: !!(!currentLocation || !pricesRef.current.get(currentLocation.location_code)) },
              { n: 2, label: 'Técnica', onClick: () => scrollToStep(2), active: !!currentLocation && !pricesRef.current.get(currentLocation.location_code) },
              { n: 3, label: 'Tamanho', onClick: () => scrollToStep(3), active: !!currentLocation && !!pricesRef.current.get(currentLocation.location_code) },
            ].map((step, idx, arr) => (
              <div key={step.n} className="flex shrink-0 items-center gap-1.5">
                <button
                  type="button"
                  onClick={step.onClick}
                  aria-current={step.active ? 'step' : undefined}
                  aria-label={`Etapa ${step.n}: ${step.label}${step.active ? ' (atual)' : ''}`}
                  className={cn(
                    'flex shrink-0 items-center gap-1 rounded-md px-1 py-0.5 transition-colors hover:text-primary md:gap-1.5',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                    step.active && 'text-foreground',
                  )}
                >
                  <span
                    className={cn(
                      'flex h-3.5 w-3.5 items-center justify-center rounded-full text-[9px] font-bold md:h-4 md:w-4 md:text-[10px]',
                      step.active
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-foreground',
                    )}
                  >
                    {step.n}
                  </span>
                  <span>{step.label}</span>
                </button>
                {idx < arr.length - 1 && (
                  <span className="shrink-0 text-muted-foreground/40" aria-hidden>→</span>
                )}
              </div>
            ))}
          </nav>


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
                    aria-pressed={isActive}
                    aria-label={`${isCircular ? 'CIRCULAR 360°' : loc.location_name}${hasPrice ? ' (configurado)' : ''}${isActive ? ' — selecionado' : ''}`}
                    onClick={() => !isDisabled && setActiveLocation(loc.location_code)}
                    className={cn(
                      'group relative flex h-8 w-full items-center justify-center gap-1.5 rounded-md border px-2 text-center transition-all',
                      stacked ? 'h-8' : 'md:h-9 md:px-3',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                      isDisabled
                        ? 'cursor-not-allowed border-border bg-muted/30 opacity-40'
                        : isActive
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border bg-transparent text-foreground hover:border-primary/40 hover:bg-primary/5',
                    )}
                  >
                    <span className="truncate text-[10px] font-semibold uppercase tracking-wide">
                      {isCircular ? 'CIRCULAR 360°' : loc.location_name}
                    </span>
                    {hasPrice && <span aria-hidden className="text-[10px] font-bold text-primary">✓</span>}
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

        {/* Resumo inline — sempre no stacked; em ≥lg vive no aside. */}
        {summaryItems.length > 0 && (stacked ? (
          <div className="mt-5 border-t border-border/40 pt-3">
            {summary}
          </div>
        ) : (
          <div className="mt-5 border-t border-border/40 pt-3 lg:hidden">
            {summary}
          </div>
        ))}
        </div>

        {/* Aside sticky no desktop com o resumo + preço sempre visíveis. */}
        {!stacked && (
          <aside
            aria-label="Resumo da personalização"
            className="hidden lg:sticky lg:top-24 lg:block lg:self-start"
            data-testid="customization-summary-aside"
          >
            {summaryItems.length > 0 ? (
              summary
            ) : (
              <div className="rounded-xl border border-dashed border-border/60 bg-background/40 px-4 py-6 text-center">
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  Resumo
                </p>
                <p className="mt-1 text-[12px] text-muted-foreground/80">
                  Configure uma técnica para ver o preço aqui.
                </p>
              </div>
            )}
          </aside>
        )}
      </div>
    </TooltipProvider>
  );
}