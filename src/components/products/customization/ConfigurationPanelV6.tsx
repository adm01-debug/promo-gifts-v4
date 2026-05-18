/**
 * ConfigurationPanelV6 — Dimensões + Cores + Preço
 * 
 * Mostra inputs condicionais baseado em usa_dimensao e cobra_por_cor.
 * Calcula preço via fn_get_customization_price com debounce.
 * Briefing v6 (12/02/2026).
 */

import { useState, useMemo, useRef } from "react";
import { Loader2, Palette, Ruler, AlertCircle, Check, Pencil, Trash2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
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
  initialWidth?: number;
  initialHeight?: number;
  initialColors?: number;
  onPriceCalculated: (techniqueId: string, price: CustomizationPriceResponseV6 | null, dimensions?: { width?: number; height?: number }) => void;
}

export function ConfigurationPanelV6({ 
  technique, 
  quantity, 
  isConfirmed = false, 
  initialWidth,
  initialHeight,
  initialColors,
  onPriceCalculated 
}: ConfigurationPanelV6Props) {
  // Dimensions
  const [largura, setLargura] = useState<string>(
    initialWidth ? String(initialWidth) : (technique.usa_dimensao ? String(technique.efetiva_largura_max) : "")
  );
  const [altura, setAltura] = useState<string>(
    initialHeight ? String(initialHeight) : (technique.usa_dimensao ? String(technique.efetiva_altura_max) : "")
  );

  // Colors
  const [numCores, setNumCores] = useState(initialColors || 1);

  // Edição local: quando confirmado, bloqueia inputs até clicar em "Editar"
  const [editing, setEditing] = useState(false);
  const [showConfirmError, setShowConfirmError] = useState(false);
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
    if (window.confirm("Deseja editar esta gravação? Isso permitirá alterar as dimensões e cores já confirmadas.")) {
      setEditing(true);
    }
  };

  const handleRemove = () => {
    if (window.confirm("Tem certeza que deseja remover esta gravação do orçamento?")) {
      onPriceCalculatedRef.current(technique.technique_id, null);
      setEditing(false);
    }
  };

  return (
    <div className={cn(
      "grid grid-cols-1 lg:grid-cols-12 gap-6 p-4 md:p-6 rounded-2xl border transition-all",
      isConfirmed
        ? "bg-primary/[0.03] border-primary/30 shadow-inner"
        : "bg-background border-border/60 shadow-sm",
    )}>
      {/* Workspace Left (Inputs) */}
      <div className="lg:col-span-7 space-y-6">
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">
            {isConfirmed && !editing ? "Gravação confirmada" : "Parâmetros da Gravação"}
          </p>
          {isConfirmed && !editing && (
            <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[10px] font-black uppercase tracking-tighter">
              <Check className="h-3 w-3 mr-1" /> No Orçamento
            </Badge>
          )}
        </div>


      {/* Dimension inputs (conditional) */}
      {technique.usa_dimensao && (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-1.5">
            <div className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
              <Ruler className="h-3.5 w-3.5" />
              Tamanho da gravação
            </div>
            <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded uppercase tracking-wider font-bold">
              Máx: {technique.efetiva_largura_max} × {technique.efetiva_altura_max} cm
            </span>
          </div>

          {/* Smart Dimension Chips */}
          <div className="flex flex-wrap gap-1.5">
            {[
              { label: "P", w: Math.min(2, technique.efetiva_largura_max), h: Math.min(2, technique.efetiva_altura_max) },
              { label: "M", w: Math.min(5, technique.efetiva_largura_max), h: Math.min(5, technique.efetiva_altura_max) },
              { label: "G", w: Math.min(8, technique.efetiva_largura_max), h: Math.min(8, technique.efetiva_altura_max) },
              { label: "Máx", w: technique.efetiva_largura_max, h: technique.efetiva_altura_max },
            ].map((chip) => (
              <button
                key={chip.label}
                type="button"
                disabled={isLocked}
                onClick={() => {
                  setLargura(String(chip.w));
                  setAltura(String(chip.h));
                }}
                className={cn(
                  "px-2 py-1 rounded border text-[10px] font-bold transition-all",
                  isLocked ? "opacity-50 cursor-not-allowed" : "hover:border-primary/50 hover:bg-primary/5 active:scale-95",
                  larguraNum === chip.w && alturaNum === chip.h ? "border-primary bg-primary/10 text-primary" : "border-border bg-card text-muted-foreground"
                )}
              >
                {chip.label} ({chip.w}×{chip.h})
              </button>
            ))}
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
                disabled={isLocked}
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
                type="button"
                disabled={isLocked}
                className={cn(
                  "px-3 h-9 rounded-md text-sm font-medium transition-colors",
                  isLocked && "opacity-50 cursor-not-allowed",
                  n === numCores
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                )}
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

        {/* AÇÕES — Confirmar / Editar / Remover */}
        <div className="flex flex-col gap-2 pt-2">
          {showConfirmError && (
            <div className="flex items-center gap-1.5 p-2 rounded bg-destructive/10 border border-destructive/20 text-[11px] text-destructive animate-in fade-in slide-in-from-top-1">
              <AlertCircle className="h-3.5 w-3.5" />
              <span>{dimensionError || (error ? "Erro ao calcular preço" : "Aguarde o cálculo do preço")}</span>
            </div>
          )}

          <div className="flex items-center gap-2">
            {!isConfirmed && (
              <Button type="button" size="lg" className="flex-1 font-bold rounded-xl shadow-lg shadow-primary/20" onClick={handleConfirm}>
                <Check className="h-4 w-4 mr-2" /> Confirmar Gravação
              </Button>
            )}
            {isConfirmed && !editing && (
              <>
                <Button type="button" size="sm" variant="outline" className="flex-1 font-bold rounded-xl" onClick={handleEdit}>
                  <Pencil className="h-4 w-4 mr-1.5" /> Editar
                </Button>
                <Button type="button" size="sm" variant="ghost" className="text-destructive hover:text-destructive hover:bg-destructive/10 font-bold rounded-xl" onClick={handleRemove}>
                  <Trash2 className="h-4 w-4 mr-1.5" /> Remover
                </Button>
              </>
            )}
            {isConfirmed && editing && (
              <>
                <Button type="button" size="sm" className="flex-1 font-bold rounded-xl" onClick={handleConfirm}>
                  <Check className="h-4 w-4 mr-1.5" /> Atualizar
                </Button>
                <Button type="button" size="sm" variant="ghost" className="font-bold" onClick={() => setEditing(false)}>
                  Cancelar
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Workspace Right (Live Preview / Summary) */}
      <div className="lg:col-span-5 flex flex-col gap-4">
        <div className="flex-1 min-h-[180px] rounded-2xl bg-muted/40 border-2 border-dashed border-border/40 flex flex-col items-center justify-center p-6 relative overflow-hidden">
          <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_center,_var(--primary)_0%,_transparent_70%)]" />
          
          {/* Visual Mockup SVG */}
          <motion.div 
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="relative w-full max-w-[120px] aspect-[1/1.5] bg-card rounded-xl border-2 border-border/60 shadow-xl flex items-center justify-center"
          >
            <motion.div 
              className="border-2 border-primary border-dashed bg-primary/10 flex items-center justify-center"
              initial={false}
              animate={{
                width: technique.usa_dimensao ? `${Math.max(20, (larguraNum / technique.efetiva_largura_max) * 100)}%` : "60%",
                height: technique.usa_dimensao ? `${Math.max(20, (alturaNum / technique.efetiva_altura_max) * 100)}%` : "40%",
              }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
            >
              <span className="text-[8px] font-black text-primary opacity-40 uppercase tracking-tighter">Arte</span>
            </motion.div>
            
            {/* Medidas indicadoras */}
            <AnimatePresence>
              {larguraNum > 0 && (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="absolute -bottom-6 left-0 right-0 flex justify-center"
                >
                  <span className="text-[10px] font-bold text-primary">{larguraNum}cm</span>
                </motion.div>
              )}
            </AnimatePresence>
            
            <AnimatePresence>
              {alturaNum > 0 && (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="absolute -right-8 top-0 bottom-0 flex items-center"
                >
                  <span className="text-[10px] font-bold text-primary origin-center rotate-90">{alturaNum}cm</span>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
          
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-10">Prévia Visual Dinâmica</p>
        </div>

        {/* Dynamic Summary Panel */}
        <AnimatePresence>
          {price && !loading && (
            <motion.div 
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="p-5 rounded-2xl bg-primary text-primary-foreground shadow-xl shadow-primary/20 space-y-3 relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 p-4 opacity-10">
                <Check className="h-12 w-12" />
              </div>
              <div className="flex justify-between items-center border-b border-primary-foreground/20 pb-3">
                <span className="text-[10px] font-bold uppercase tracking-widest opacity-80">Unitário Estimado</span>
                <span className="text-2xl font-black">R$ {price.preco_unitario.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center">
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold uppercase tracking-widest opacity-80">Total do Local</span>
                  <span className="text-[9px] opacity-60">Para {quantity} unidades</span>
                </div>
                <span className="text-xl font-bold">R$ {price.total_cobrado.toFixed(2)}</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
