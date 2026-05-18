/**
 * ConfigurationPanelV6 — Dimensões + Cores + Preço
 * 
 * Mostra inputs condicionais baseado em usa_dimensao e cobra_por_cor.
 * Calcula preço via fn_get_customization_price com debounce.
 * Briefing v6 (12/02/2026).
 */

import { useState, useMemo, useRef } from "react";
import { Loader2, Palette, Ruler, AlertCircle, Check, Pencil, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useCustomizationPriceReactive } from "@/hooks/useCustomizationPrice";
import type { TechniqueOption, CustomizationPriceResponseV6 } from "@/types/customization";

interface ConfigurationPanelV6Props {
  technique: TechniqueOption;
  quantity: number;
  /** True quando esta técnica já foi confirmada e está no orçamento. */
  isConfirmed?: boolean;
  onPriceCalculated: (techniqueId: string, price: CustomizationPriceResponseV6 | null, dimensions?: { width?: number; height?: number }) => void;
}

export function ConfigurationPanelV6({ technique, quantity, isConfirmed = false, onPriceCalculated }: ConfigurationPanelV6Props) {
  // Dimensions
  const [largura, setLargura] = useState<string>(
    technique.usa_dimensao ? String(technique.efetiva_largura_max) : ""
  );
  const [altura, setAltura] = useState<string>(
    technique.usa_dimensao ? String(technique.efetiva_altura_max) : ""
  );

  // Colors
  const [numCores, setNumCores] = useState(1);

  // Edição local: quando confirmado, bloqueia inputs até clicar em "Editar"
  const [editing, setEditing] = useState(false);
  const isLocked = isConfirmed && !editing;

  const larguraNum = parseFloat(largura) || 0;
  const alturaNum = parseFloat(altura) || 0;

  // Validation
  const dimensionError = useMemo(() => {
    if (!technique.usa_dimensao) return null;
    if (larguraNum <= 0 || alturaNum <= 0) return "Preencha largura e altura";
    if (larguraNum > technique.efetiva_largura_max) return `Largura máxima: ${technique.efetiva_largura_max} cm`;
    if (alturaNum > technique.efetiva_altura_max) return `Altura máxima: ${technique.efetiva_altura_max} cm`;
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

  const canConfirm = !!price && !loading && !error && !dimensionError;

  const handleConfirm = () => {
    if (!canConfirm || !price) return;
    const dims = technique.usa_dimensao ? { width: larguraNum, height: alturaNum } : undefined;
    onPriceCalculatedRef.current(technique.technique_id, price, dims);
    setEditing(false);
  };

  const handleRemove = () => {
    onPriceCalculatedRef.current(technique.technique_id, null);
    setEditing(false);
  };

  return (
    <div className="space-y-4 p-4 rounded-lg bg-secondary/30 border border-border/50">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
        Configure a gravação
      </p>

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
              />
            </div>
            <span className="text-muted-foreground mt-5">×</span>
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
            {Array.from({ length: technique.max_cores }, (_, i) => i + 1).map(n => (
              <button
                key={n}
                className={cn(
                  "px-3 h-9 rounded-md text-sm font-medium transition-colors",
                  n === numCores
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                )}
                onClick={() => setNumCores(n)}
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
        <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 text-sm text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Calculando preço...
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-sm text-destructive">
          <AlertCircle className="h-3.5 w-3.5" />
          {error}
        </div>
      )}

      {/* Price result */}
      {price && !loading && (
        <div className="p-3 rounded-lg bg-primary/5 border border-primary/20 space-y-2">
          <div className="flex items-center gap-2">
            <Check className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold text-foreground">
              {price.nome_tabela}
            </span>
          </div>
          
          <div className="text-xs text-muted-foreground space-y-0.5">
            {technique.usa_dimensao && larguraNum > 0 && alturaNum > 0 && (
              <p>Gravação: {larguraNum} × {alturaNum} cm</p>
            )}
            <p>Quantidade: {price.quantidade} peças</p>
            <p>Faixa: {price.faixa.qtd_min} a {price.faixa.qtd_max} peças</p>
            {price.num_cores > 1 && (
              <p>Cores: {price.num_cores}</p>
            )}
          </div>

          <div className="border-t border-border/50 pt-2 space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Preço unitário:</span>
              <span className="font-semibold text-primary">
                R$ {price.preco_unitario.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Gravação ({price.quantidade}×):</span>
              <span className="font-medium text-foreground">
                R$ {price.valor_gravacao.toFixed(2)}
              </span>
            </div>
            {price.setup_total > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Setup:</span>
                <span className="font-medium text-foreground">
                  R$ {price.setup_total.toFixed(2)}
                </span>
              </div>
            )}
            <div className="flex justify-between text-sm font-bold border-t border-border/50 pt-1">
              <span className="text-foreground">TOTAL:</span>
              <span className="text-primary">
                R$ {price.total_cobrado.toFixed(2)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Waiting for inputs */}
      {!price && !loading && !error && (
        <div className="p-3 rounded-lg bg-muted/30 text-xs text-muted-foreground text-center">
          {technique.usa_dimensao && (larguraNum <= 0 || alturaNum <= 0)
            ? "Preencha largura e altura para calcular o preço"
            : "Aguardando cálculo..."}
        </div>
      )}
    </div>
  );
}
