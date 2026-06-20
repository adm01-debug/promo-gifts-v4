/**
 * ConfigurationPanelV6 — Dimensões + Cores + Preço
 *
 * Mostra inputs condicionais baseado em usa_dimensao e cobra_por_cor.
 * Calcula preço via fn_get_customization_price com debounce.
 * Briefing v6 (12/02/2026).
 */

import { useState, useMemo, useRef, useEffect } from 'react';
import { Loader2, Palette, Ruler, AlertCircle, Check, Pencil, Trash2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useCustomizationPriceReactive } from '@/hooks/simulation';
import type { TechniqueOption, CustomizationPriceResponseV6 } from '@/types/customization';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';

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
}

export function ConfigurationPanelV6({
  technique,
  quantity,
  isConfirmed = false,
  initialWidth,
  initialHeight,
  initialColors,
  onPriceCalculated,
  onDimensionsChange,
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

  // Colors
  const [numCores, setNumCores] = useState(initialColors || 1);

  // Edição local: quando confirmado, bloqueia inputs até clicar em "Editar"
  const [editing, setEditing] = useState(false);
  const [showConfirmError, setShowConfirmError] = useState(false);
  const [editConfirmOpen, setEditConfirmOpen] = useState(false);
  const [removeConfirmOpen, setRemoveConfirmOpen] = useState(false);
  const isLocked = isConfirmed && !editing;

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
          'space-y-4 rounded-lg border p-4',
          isConfirmed ? 'border-primary/30 bg-primary/5' : 'border-border/50 bg-secondary/30',
        )}
      >
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {isConfirmed && !editing ? 'Gravação confirmada' : 'Configure a gravação'}
          </p>
          {isConfirmed && !editing && (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-primary">
              <Check className="h-3 w-3" /> Adicionada ao orçamento
            </span>
          )}
        </div>

        {/* Dimension inputs (conditional) */}
        {technique.usa_dimensao && (
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-sm text-foreground">
              <Ruler className="h-3.5 w-3.5" />
              <span className="font-medium">Tamanho da gravação</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Máx. {technique.efetiva_largura_max} × {technique.efetiva_altura_max} cm
            </p>
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
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-sm text-foreground">
              <Palette className="h-3.5 w-3.5" />
              <span className="font-medium">Nº de cores</span>
            </div>
            <div className="flex gap-1.5">
              {Array.from({ length: technique.max_cores }, (_, i) => i + 1).map((n) => (
                <button
                  key={n}
                  type="button"
                  disabled={isLocked}
                  className={cn(
                    'h-9 rounded-md px-3 text-sm font-medium transition-colors',
                    isLocked && 'cursor-not-allowed opacity-50',
                    n === numCores
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
                  )}
                  data-testid={`customization-color-button-${n}`}
                  onClick={() => !isLocked && setNumCores(n)}
                >
                  {n} {n === 1 ? 'cor' : 'cores'}
                  {n === 2 && ' (-10%)'}
                  {n === 3 && ' (-15%)'}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Full color info */}
        {!technique.cobra_por_cor && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Palette className="h-3 w-3" />
            Full Color — sem limite de cores
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex items-center gap-2 rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Calculando preço...
          </div>
        )}

        {/* Error */}
        {error && !loading && (
          <div className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
            <AlertCircle className="h-3.5 w-3.5" />
            {error}
          </div>
        )}

        {/* Price result */}
        {price && !loading && (
          <div className="space-y-2 rounded-lg border border-primary/20 bg-primary/5 p-3">
            <div className="flex items-center gap-2">
              <Check className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold text-foreground">{price.nome_tabela}</span>
            </div>

            <div className="space-y-0.5 text-xs text-muted-foreground">
              {technique.usa_dimensao && larguraNum > 0 && alturaNum > 0 && (
                <p>
                  Gravação: {larguraNum} × {alturaNum} cm
                </p>
              )}
              <p>Quantidade: {price.quantidade} peças</p>
              <p>
                Faixa: {price.faixa?.qtd_min} a {price.faixa?.qtd_max} peças
              </p>
              {(price.num_cores ?? 0) > 1 && <p>Cores: {price.num_cores}</p>}
            </div>

            <div className="space-y-1 border-t border-border/50 pt-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Preço unitário:</span>
                <span className="font-semibold text-primary">
                  R$ {(price.preco_unitario ?? 0).toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Gravação ({price.quantidade}×):</span>
                <span className="font-medium text-foreground">
                  R$ {(price.valor_gravacao ?? 0).toFixed(2)}
                </span>
              </div>
              {(price.setup_total ?? 0) > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Setup:</span>
                  <span className="font-medium text-foreground">
                    R$ {(price.setup_total ?? 0).toFixed(2)}
                  </span>
                </div>
              )}
              <div className="flex justify-between border-t border-border/50 pt-1 text-sm font-bold">
                <span className="text-foreground">TOTAL:</span>
                <span className="text-primary" data-testid="customization-total-price">
                  R$ {(price.total_cobrado ?? 0).toFixed(2)}
                </span>
              </div>
            </div>
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

          <div className="flex items-center gap-2">
            {!isConfirmed && (
              <Button
                type="button"
                size="sm"
                className="flex-1"
                onClick={handleConfirm}
                data-testid="customization-confirm-button"
              >
                <Check className="mr-1.5 h-4 w-4" />
                Confirmar e adicionar ao orçamento
              </Button>
            )}
            {isConfirmed && !editing && (
              <>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="flex-1"
                  onClick={handleEdit}
                >
                  <Pencil className="mr-1.5 h-4 w-4" />
                  Editar
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                  onClick={handleRemove}
                >
                  <Trash2 className="mr-1.5 h-4 w-4" />
                  Remover
                </Button>
              </>
            )}
            {isConfirmed && editing && (
              <>
                <Button type="button" size="sm" className="flex-1" onClick={handleConfirm}>
                  <Check className="mr-1.5 h-4 w-4" />
                  Atualizar gravação
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(false)}>
                  Cancelar
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
