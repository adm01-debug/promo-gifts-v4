/**
 * ConfigurationPanelV6 — Dimensões + Cores + Preço
 *
 * Mostra inputs condicionais baseado em usa_dimensao e cobra_por_cor.
 * Calcula preço via fn_get_customization_price com debounce.
 * Briefing v6 (12/02/2026).
 */

import { useState, useMemo, useRef, useEffect, useId, useCallback, type ReactNode } from 'react';
import { Loader2, Palette, Ruler, AlertCircle, Check, Pencil, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useCustomizationPriceReactive } from '@/hooks/simulation';
import type { TechniqueOption, CustomizationPriceResponseV6 } from '@/types/customization';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useCustomizationCollapsePrefs } from '@/hooks/customization/useCustomizationCollapsePrefs';
import { formatEngravingTitle } from '@/lib/customization/format-engraving-title';

interface ConfigurationPanelV6Props {
  technique: TechniqueOption;
  quantity: number;
  /** True quando esta técnica já foi confirmada e está no orçamento. */
  isConfirmed?: boolean;
  initialWidth?: number;
  initialHeight?: number;
  initialColors?: number;
  onPriceCalculated: (
    techniqueId: string,
    price: CustomizationPriceResponseV6 | null,
    dimensions?: { width?: number; height?: number },
  ) => void;
  /** Emitido a cada mudança de dimensão/cor (sem precisar confirmar). Usado para preservar inputs ao trocar de técnica. */
  onDimensionsChange?: (dims: { width?: number; height?: number; colors?: number }) => void;
  /** Ícone opcional exibido antes do nome da gravação confirmada. Default: <Check />. Passe `null` para ocultar. */
  confirmedIcon?: ReactNode;
}

type CollapsedInteractionProps = {
  inert?: '';
};

export function ConfigurationPanelV6({
  technique,
  quantity,
  isConfirmed = false,
  initialWidth,
  initialHeight,
  initialColors,
  onPriceCalculated,
  onDimensionsChange,
  confirmedIcon,
}: ConfigurationPanelV6Props) {
  // Dimensions
  const [largura, setLargura] = useState<string>(
    initialWidth
      ? String(initialWidth)
      : technique.usa_dimensao
        ? String(technique.efetiva_largura_max)
        : '',
  );
  const [altura, setAltura] = useState<string>(
    initialHeight
      ? String(initialHeight)
      : technique.usa_dimensao
        ? String(technique.efetiva_altura_max)
        : '',
  );

  // Colors — usa ?? para preservar valor 0 legítimo vindo do backend
  const [numCores, setNumCores] = useState<number>(initialColors ?? 1);

  // Resync quando técnica ou valores iniciais mudarem (troca de técnica sem remount)
  useEffect(() => {
    setNumCores(initialColors ?? 1);
  }, [technique.technique_id, initialColors]);
  useEffect(() => {
    if (initialWidth !== undefined) setLargura(String(initialWidth));
  }, [technique.technique_id, initialWidth]);
  useEffect(() => {
    if (initialHeight !== undefined) setAltura(String(initialHeight));
  }, [technique.technique_id, initialHeight]);

  // Edição local: quando confirmado, bloqueia inputs até clicar em "Editar"
  const [editing, setEditing] = useState(false);
  const [showConfirmError, setShowConfirmError] = useState(false);
  const [editConfirmOpen, setEditConfirmOpen] = useState(false);
  const [removeConfirmOpen, setRemoveConfirmOpen] = useState(false);

  // Persistência do estado de colapso (localStorage + sync no perfil quando logado)
  // e emissão de evento de analytics em cada toggle.
  const { collapsed, setCollapsed: setCollapsedPref } = useCustomizationCollapsePrefs(
    technique.technique_id,
  );
  const setCollapsed = useCallback(
    (next: boolean | ((v: boolean) => boolean)) => {
      const value = typeof next === 'function' ? (next as (v: boolean) => boolean)(collapsed) : next;
      setCollapsedPref(technique.technique_id, value);
    },
    [collapsed, setCollapsedPref, technique.technique_id],
  );

  const contentId = useId();
  const isLocked = isConfirmed && !editing;
  const collapsedInteractionProps: CollapsedInteractionProps = collapsed ? { inert: '' } : {};

  const larguraNum = parseFloat(largura) || 0;
  const alturaNum = parseFloat(altura) || 0;

  // Validation
  const dimensionError = useMemo(() => {
    if (!technique.usa_dimensao) return null;
    if (larguraNum <= 0 || alturaNum <= 0) return 'Preencha largura e altura';
    if (larguraNum > technique.efetiva_largura_max)
      return `Largura máxima: ${technique.efetiva_largura_max} cm`;
    if (alturaNum > technique.efetiva_altura_max)
      return `Altura máxima: ${technique.efetiva_altura_max} cm`;
    return null;
  }, [technique, larguraNum, alturaNum]);

  // Preview reativo apenas — inserção no orçamento ocorre via botão "Confirmar".
  const { price, loading, error } = useCustomizationPriceReactive(
    technique.technique_id,
    quantity,
    technique.cobra_por_cor ? numCores : 1,
    technique.usa_dimensao ? larguraNum : null,
    technique.usa_dimensao ? alturaNum : null,
    technique.usa_dimensao,
  );

  const onPriceCalculatedRef = useRef(onPriceCalculated);
  onPriceCalculatedRef.current = onPriceCalculated;

  const onDimensionsChangeRef = useRef(onDimensionsChange);
  onDimensionsChangeRef.current = onDimensionsChange;

  // Emite dimensões/cores em tempo real para o LocationPanel preservar entre trocas de técnica.
  useEffect(() => {
    onDimensionsChangeRef.current?.({
      width: technique.usa_dimensao ? (larguraNum > 0 ? larguraNum : undefined) : undefined,
      height: technique.usa_dimensao ? (alturaNum > 0 ? alturaNum : undefined) : undefined,
      colors: technique.cobra_por_cor ? numCores : undefined,
    });
  }, [larguraNum, alturaNum, numCores, technique.usa_dimensao, technique.cobra_por_cor]);

  const canConfirm = !!price && !loading && !error && !dimensionError;

  const handleConfirm = () => {
    if (!canConfirm) {
      setShowConfirmError(true);
      return;
    }
    if (!price) return;

    setShowConfirmError(false);
    const dims = technique.usa_dimensao ? { width: larguraNum, height: alturaNum } : undefined;
    onPriceCalculatedRef.current(technique.technique_id, price, dims);
    setEditing(false);
  };

  const handleEdit = () => {
    setEditConfirmOpen(true);
  };

  const handleRemove = () => {
    setRemoveConfirmOpen(true);
  };

  return (
    <>
      <ConfirmDialog
        open={editConfirmOpen}
        onOpenChange={setEditConfirmOpen}
        title="Editar gravação"
        description="Deseja editar esta gravação? Isso permitirá alterar as dimensões e cores já confirmadas."
        onConfirm={() => setEditing(true)}
      />
      <ConfirmDialog
        open={removeConfirmOpen}
        onOpenChange={setRemoveConfirmOpen}
        title="Remover gravação"
        description="Tem certeza que deseja remover esta gravação do orçamento?"
        onConfirm={() => {
          onPriceCalculatedRef.current(technique.technique_id, null);
          setEditing(false);
        }}
      />
      <div
        className={cn(
          'flex flex-col rounded-lg border p-4 transition-[gap] duration-300 ease-out motion-reduce:transition-none',
          collapsed ? 'gap-0' : 'gap-4',
          isConfirmed ? 'border-primary/30 bg-primary/5' : 'border-border/50 bg-secondary/30',
        )}
      >
        <div className="flex items-center justify-between gap-2">
          {isConfirmed && !editing ? (
            (() => {
              const showSkeleton = loading && !price?.nome_tabela;
              const title = formatEngravingTitle({
                nomeTabela: price?.nome_tabela,
                techniqueName:
                  (technique as { name?: string; technique_name?: string }).name ??
                  (technique as { technique_name?: string }).technique_name,
                groupName: (technique as { grupo_tecnica?: string }).grupo_tecnica,
                fallback: 'Gravação confirmada',
              });
              const iconNode =
                confirmedIcon === null
                  ? null
                  : confirmedIcon ?? (
                      <Check className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
                    );
              return (
                <p
                  className="flex min-w-0 items-center gap-1.5 text-xs font-semibold text-foreground"
                  data-testid="customization-confirmed-header"
                >
                  {iconNode}
                  {showSkeleton ? (
                    <span
                      aria-hidden
                      data-testid="customization-confirmed-skeleton"
                      className="inline-block h-3.5 w-24 animate-pulse rounded bg-muted"
                    />
                  ) : (
                    <span
                      className="truncate whitespace-nowrap"
                      title={title}
                      data-testid="customization-confirmed-title"
                    >
                      {title}
                    </span>
                  )}
                </p>
              );
            })()
          ) : (
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Configure a gravação
            </p>
          )}
          <div className="flex items-center gap-2">


            <button
              type="button"
              onClick={() => setCollapsed((v) => !v)}
              aria-label={collapsed ? 'Expandir configurações da gravação' : 'Recolher configurações da gravação'}
              aria-expanded={!collapsed}
              aria-controls={contentId}
              className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background sm:h-6 sm:w-6"
              data-testid="customization-collapse-toggle"
            >
              {collapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <div
          {...collapsedInteractionProps}
          id={contentId}
          role="region"
          aria-label="Configurações da gravação"
          aria-hidden={collapsed}
          className={cn(
            'grid transition-[grid-template-rows,opacity] duration-300 ease-out motion-reduce:transition-none',
            collapsed ? 'grid-rows-[0fr] opacity-0' : 'grid-rows-[1fr] opacity-100',
          )}
        >
          <div className="min-h-0 overflow-hidden">
            <div className="space-y-4">



        {/* Dimension inputs (conditional) */}
        {technique.usa_dimensao && (
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-sm text-foreground flex-wrap">
              <Ruler className="h-3.5 w-3.5" />
              <span className="font-medium">Tamanho da gravação</span>
              <span className="text-xs text-muted-foreground">
                Máx. {technique.efetiva_largura_max} × {technique.efetiva_altura_max} cm
              </span>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex-1">
                <Label className="text-xs text-muted-foreground">Largura (cm)</Label>
                <Input
                  type="number"
                  step="0.1"
                  min="0.1"
                  max={technique.efetiva_largura_max}
                  value={largura}
                  onChange={(e) => setLargura(e.target.value)}
                  placeholder={`até ${technique.efetiva_largura_max}`}
                  className="h-9 text-sm"
                  disabled={isLocked}
                  data-testid="customization-width-input"
                />
              </div>
              <span className="mt-5 text-muted-foreground">×</span>
              <div className="flex-1">
                <Label className="text-xs text-muted-foreground">Altura (cm)</Label>
                <Input
                  type="number"
                  step="0.1"
                  min="0.1"
                  max={technique.efetiva_altura_max}
                  value={altura}
                  onChange={(e) => setAltura(e.target.value)}
                  placeholder={`até ${technique.efetiva_altura_max}`}
                  className="h-9 text-sm"
                  disabled={isLocked}
                  data-testid="customization-height-input"
                />
              </div>
            </div>

            {dimensionError && larguraNum > 0 && alturaNum > 0 && (
              <div className="flex items-center gap-1.5 text-xs text-destructive">
                <AlertCircle className="h-3 w-3" />
                {dimensionError}
              </div>
            )}
          </div>
        )}

        {/* Color selector (conditional) */}
        {technique.cobra_por_cor && technique.max_cores > 1 && (
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              <Palette className="h-3 w-3" />
              Nº de cores
            </div>
            <div role="radiogroup" aria-label="Número de cores" className="inline-flex rounded-lg border border-border/60 bg-card p-0.5">
              {Array.from({ length: technique.max_cores }, (_, i) => i + 1).map((n) => (
                <button
                  key={n}
                  type="button"
                  role="radio"
                  aria-checked={n === numCores}
                  aria-label={`${n} ${n === 1 ? 'cor' : 'cores'}${n === 2 ? ' — 10% de desconto' : ''}${n === 3 ? ' — 15% de desconto' : ''}`}
                  disabled={isLocked}
                  className={cn(
                    'h-7 rounded-md px-2.5 text-[12px] font-medium tabular-nums transition-colors',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-1 focus-visible:ring-offset-background',
                    isLocked && 'cursor-not-allowed opacity-50',
                    n === numCores
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                  data-testid={`customization-color-button-${n}`}
                  onClick={() => !isLocked && setNumCores(n)}
                >
                  {n} {n === 1 ? 'cor' : 'cores'}
                  {n === 2 && <span className="ml-1 text-success/80">−10%</span>}
                  {n === 3 && <span className="ml-1 text-success/80">−15%</span>}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Full color info */}
        {!technique.cobra_por_cor && (
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Palette className="h-3 w-3" />
            Full Color — sem limite de cores
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex items-center gap-2 rounded-lg bg-muted/40 px-3 py-2 text-[12px] text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Calculando preço...
          </div>
        )}

        {/* Error */}
        {error && !loading && (
          <div className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-[12px] text-destructive">
            <AlertCircle className="h-3.5 w-3.5" />
            {error}
          </div>
        )}

        {/* Price result — "fichinha": label à esquerda, valores tabulares à direita */}
        {price && !loading && (
          <div
            className="space-y-1.5 rounded-md border border-primary/20 bg-primary/[0.04] p-2.5"
            aria-live="polite"
          >
            <div className="flex items-center justify-between gap-2 border-b border-border/40 pb-1.5">
              <div className="flex min-w-0 items-center gap-1.5">
                <Check className="h-3 w-3 shrink-0 text-primary" aria-hidden />
                <span className="truncate text-[11px] font-medium text-foreground">
                  {price.nome_tabela}
                </span>
              </div>
              <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">
                {price.quantidade} pç
                {technique.usa_dimensao && larguraNum > 0 && alturaNum > 0 && (
                  <> · {larguraNum}×{alturaNum}cm</>
                )}
                {(price.num_cores ?? 0) > 1 && <> · {price.num_cores}c</>}
              </span>
            </div>

            <dl className="space-y-1 text-[11px]">
              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground">Preço unitário</dt>
                <dd className="font-medium tabular-nums text-foreground">
                  R$ {(price.preco_unitario ?? 0).toFixed(2)}
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground">Setup + gravação</dt>
                <dd className="font-medium tabular-nums text-foreground">
                  R$ {((price.valor_gravacao ?? 0) + (price.setup_total ?? 0)).toFixed(2)}
                </dd>
              </div>
              <div className="flex items-center justify-between border-t border-border/40 pt-1.5">
                <dt className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Total
                </dt>
                <dd
                  className="text-[15px] font-semibold tabular-nums text-primary"
                  data-testid="customization-total-price"
                >
                  R$ {(price.total_cobrado ?? 0).toFixed(2)}
                </dd>
              </div>
            </dl>
          </div>
        )}



        {/* Waiting for inputs */}
        {!price && !loading && !error && (
          <div className="rounded-lg bg-muted/30 p-3 text-center text-xs text-muted-foreground">
            {technique.usa_dimensao && (larguraNum <= 0 || alturaNum <= 0)
              ? 'Preencha largura e altura para calcular o preço'
              : 'Aguardando cálculo...'}
          </div>
        )}

        {/* AÇÕES — Confirmar / Editar / Remover */}
        <div className="flex flex-col gap-2 pt-1">
          {showConfirmError && (
            <div className="flex items-center gap-1.5 rounded border border-destructive/20 bg-destructive/10 p-2 text-[11px] text-destructive animate-in fade-in slide-in-from-top-1">
              <AlertCircle className="h-3.5 w-3.5" />
              <span>
                {dimensionError ||
                  (error ? 'Erro ao calcular preço' : 'Aguarde o cálculo do preço')}
              </span>
            </div>
          )}

          <div className="flex items-center gap-1.5">
            {!isConfirmed && (
              <Button
                type="button"
                size="sm"
                className="h-8 flex-1 text-xs"
                onClick={handleConfirm}
                data-testid="customization-confirm-button"
                aria-label="Adicionar gravação ao orçamento"
              >
                <Check className="mr-1 h-3.5 w-3.5" aria-hidden />
                Adicionar ao orçamento
              </Button>
            )}
            {isConfirmed && !editing && (
              <>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8 flex-1 text-xs"
                  onClick={handleEdit}
                  aria-label="Editar gravação confirmada"
                >
                  <Pencil className="mr-1 h-3.5 w-3.5" aria-hidden />
                  Editar
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-8 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
                  onClick={handleRemove}
                  aria-label="Remover gravação do orçamento"
                >
                  <Trash2 className="mr-1 h-3.5 w-3.5" aria-hidden />
                  Remover
                </Button>
              </>
            )}
            {isConfirmed && editing && (
              <>
                <Button type="button" size="sm" className="h-8 flex-1 text-xs" onClick={handleConfirm}>
                  <Check className="mr-1 h-3.5 w-3.5" aria-hidden />
                  Atualizar
                </Button>
                <Button type="button" size="sm" variant="ghost" className="h-8 text-xs" onClick={() => setEditing(false)}>
                  Cancelar
                </Button>
              </>
            )}
          </div>
        </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
