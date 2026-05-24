/**
 * StepSpecs - Passo 3: Especificações da Gravação (v6)
 * 
 * Configura: cores (se cobra_por_cor), tamanho (se usa_dimensao)
 * Campos condicionais baseados nos dados v6 das técnicas disponíveis.
 */

import { useMemo } from 'react';
import { useLivePricePreview } from '@/hooks/simulator/useLivePricePreview';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  SlidersHorizontal,
  Palette,
  Ruler,
  DollarSign,
  ChevronLeft,
  ChevronDown,
  AlertTriangle,
  BarChart3,
  Loader2,
  Info,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/format';
import type { UseSimulatorWizardReturn } from '@/hooks/simulator/useSimulatorWizard';

interface StepSpecsProps {
  wizard: UseSimulatorWizardReturn;
}

export function StepSpecs({ wizard }: StepSpecsProps) {
  const { selectedLocation, engravingSpecs } = wizard;

  // Live price preview
  const { estimate, isLoading: priceLoading } = useLivePricePreview({
    selectedLocation,
    engravingSpecs,
    quantity: wizard.quantity,
  });

  // v6: Analyze techniques to determine which fields to show
  const techniques = selectedLocation?.availableTechniques || [];
  
  const { anyUsaDimensao, anyCobraPorCor, maxColors, maxWidth, maxHeight } = useMemo(() => {
    if (!techniques.length) {
      return { anyUsaDimensao: true, anyCobraPorCor: true, maxColors: 3, maxWidth: 50, maxHeight: 50 };
    }
    const anyUsaDimensao = techniques.some(t => t.usaDimensao !== false);
    const anyCobraPorCor = techniques.some(t => t.cobraPorCor === true);
    
    const colorTechniques = techniques.filter(t => t.cobraPorCor === true);
    const maxColors = colorTechniques.length > 0
      ? Math.max(...colorTechniques.map(t => t.maxColors || 3))
      : 1;

    const dimTechniques = techniques.filter(t => t.usaDimensao !== false);
    const maxWidth = dimTechniques.length > 0
      ? Math.max(...dimTechniques.map(t => t.efetivaLarguraMax || t.areaMaxWidth || selectedLocation?.maxWidthCm || 50))
      : selectedLocation?.maxWidthCm || 50;
    
    const maxHeight = dimTechniques.length > 0
      ? Math.max(...dimTechniques.map(t => t.efetivaAlturaMax || t.areaMaxHeight || selectedLocation?.maxHeightCm || 50))
      : selectedLocation?.maxHeightCm || 50;

    return { anyUsaDimensao, anyCobraPorCor, maxColors, maxWidth, maxHeight };
  }, [techniques, selectedLocation]);

  const currentArea = engravingSpecs.width * engravingSpecs.height;
  const maxArea = selectedLocation?.maxAreaCm2 || maxWidth * maxHeight;
  const areaExceeded = anyUsaDimensao && currentArea > maxArea;

  // Count how many techniques will be filtered by current specs
  const compatibleCount = useMemo(() => {
    return techniques.filter(t => {
      if (t.cobraPorCor && t.maxColors !== null && t.maxColors > 0 && engravingSpecs.colors > t.maxColors) {
        return false;
      }
      return true;
    }).length;
  }, [techniques, engravingSpecs.colors]);

  if (!selectedLocation) {
    return (
      <div className="max-w-4xl mx-auto text-center py-16">
        <p className="text-muted-foreground">Selecione um local de gravação primeiro.</p>
      </div>
    );
  }

  const handleCompare = async () => {
    await wizard.fetchComparisonPrices();
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="p-3 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5">
          <SlidersHorizontal className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h3 className="font-display text-xl font-bold">Especificações da Gravação</h3>
          <p className="text-muted-foreground">
            {techniques.length} {techniques.length === 1 ? 'técnica disponível' : 'técnicas disponíveis'} neste local
          </p>
        </div>
      </div>

      {/* Specs Cards */}
      <div className={cn(
        "grid gap-6 max-w-3xl",
        anyUsaDimensao && anyCobraPorCor ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1"
      )}>
        {/* Colors - Only if any technique charges by color */}
        {anyCobraPorCor ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-6 rounded-3xl bg-card border shadow-sm"
          >
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-primary/10">
                  <Palette className="h-5 w-5 text-primary" />
                </div>
                <h4 className="font-bold text-lg">Nº de Cores</h4>
              </div>
              <Badge variant="outline" className="text-xs">Máx {maxColors}</Badge>
            </div>
            
            <div className="flex flex-wrap gap-2">
              {Array.from({ length: maxColors }, (_, i) => i + 1).map(num => (
                <Button
                  key={num}
                  variant={engravingSpecs.colors === num ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => wizard.updateSpecs({ colors: num })}
                  className={cn(
                    'h-12 px-5 rounded-xl text-sm font-bold',
                    engravingSpecs.colors === num && 'shadow-lg shadow-primary/20'
                  )}
                >
                  {num} {num === 1 ? 'cor' : 'cores'}
                </Button>
              ))}
            </div>

            {estimate && !priceLoading && engravingSpecs.colors > 1 ? (
              <p className="text-sm text-muted-foreground mt-4">
                {engravingSpecs.colors} cores • Estimativa: <span className="font-semibold text-primary">{formatCurrency(estimate.unitPrice)}/un</span>
              </p>
            ) : (
              <p className="text-sm text-muted-foreground mt-4">
                {engravingSpecs.colors === 1 ? '1 cor de gravação' : `${engravingSpecs.colors} cores selecionadas`}
              </p>
            )}
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-6 rounded-3xl bg-card border shadow-sm"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 rounded-xl bg-primary/10">
                <Palette className="h-5 w-5 text-primary" />
              </div>
              <h4 className="font-bold text-lg">Cores</h4>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Info className="h-4 w-4" />
              <span>Full Color — todas as técnicas neste local são de impressão digital (sem limite de cores)</span>
            </div>
          </motion.div>
        )}

        {/* Size - Only if any technique uses dimensions */}
        {anyUsaDimensao && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className={cn(
              'p-6 rounded-3xl border shadow-sm',
              areaExceeded ? 'bg-warning/5 border-warning/30' : 'bg-card'
            )}
          >
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-primary/10">
                  <Ruler className="h-5 w-5 text-primary" />
                </div>
                <h4 className="font-bold text-lg">Tamanho</h4>
              </div>
              <Badge variant="outline">Máx {maxWidth}×{maxHeight}cm</Badge>
            </div>

            {/* Width */}
            <div className="space-y-2 mb-5">
              <div className="flex justify-between items-center text-sm">
                <Label className="font-medium">Largura</Label>
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-7 w-7 rounded-lg"
                    onClick={() => wizard.updateSpecs({ width: Math.max(0.5, engravingSpecs.width - 0.5) })}
                    disabled={engravingSpecs.width <= 0.5}
                    aria-label="Diminuir largura"
                  >
                    −
                  </Button>
                  <Input
                    type="number"
                    value={engravingSpecs.width}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value);
                      if (!isNaN(v) && v >= 0.5 && v <= maxWidth) wizard.updateSpecs({ width: v });
                    }}
                    min={0.5}
                    max={maxWidth}
                    step={0.5}
                    className="w-20 h-7 text-center text-sm font-bold rounded-lg"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-7 w-7 rounded-lg"
                    onClick={() => wizard.updateSpecs({ width: Math.min(maxWidth, engravingSpecs.width + 0.5) })}
                    disabled={engravingSpecs.width >= maxWidth}
                    aria-label="Aumentar largura"
                  >
                    +
                  </Button>
                  <span className="text-xs text-muted-foreground ml-1">cm</span>
                </div>
              </div>
              <Slider
                value={[engravingSpecs.width]}
                min={0.5}
                max={maxWidth}
                step={0.5}
                onValueChange={([value]) => wizard.updateSpecs({ width: value })}
                className="opacity-60"
              />
            </div>

            {/* Height */}
            <div className="space-y-2 mb-5">
              <div className="flex justify-between items-center text-sm">
                <Label className="font-medium">Altura</Label>
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-7 w-7 rounded-lg"
                    onClick={() => wizard.updateSpecs({ height: Math.max(0.5, engravingSpecs.height - 0.5) })}
                    disabled={engravingSpecs.height <= 0.5}
                    aria-label="Diminuir altura"
                  >
                    −
                  </Button>
                  <Input
                    type="number"
                    value={engravingSpecs.height}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value);
                      if (!isNaN(v) && v >= 0.5 && v <= maxHeight) wizard.updateSpecs({ height: v });
                    }}
                    min={0.5}
                    max={maxHeight}
                    step={0.5}
                    className="w-20 h-7 text-center text-sm font-bold rounded-lg"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-7 w-7 rounded-lg"
                    onClick={() => wizard.updateSpecs({ height: Math.min(maxHeight, engravingSpecs.height + 0.5) })}
                    disabled={engravingSpecs.height >= maxHeight}
                    aria-label="Aumentar altura"
                  >
                    +
                  </Button>
                  <span className="text-xs text-muted-foreground ml-1">cm</span>
                </div>
              </div>
              <Slider
                value={[engravingSpecs.height]}
                min={0.5}
                max={maxHeight}
                step={0.5}
                onValueChange={([value]) => wizard.updateSpecs({ height: value })}
                className="opacity-60"
              />
            </div>

            {/* Área Máxima shortcut */}
            <Button
              variant="outline"
              size="sm"
              className="w-full mb-4 gap-2 text-xs"
              onClick={() => wizard.updateSpecs({ width: maxWidth, height: maxHeight })}
            >
              <Ruler className="h-3 w-3" />
              Área Máxima ({maxWidth}×{maxHeight}cm)
            </Button>

            {/* Area */}
            <div className={cn(
              'p-4 rounded-2xl border transition-colors',
              areaExceeded ? 'bg-warning/10 border-warning' : 'bg-muted/50'
            )}>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Área total</span>
                <div className="flex items-center gap-2">
                  {areaExceeded && <AlertTriangle className="h-4 w-4 text-warning" />}
                  <span className={cn('font-bold text-lg', areaExceeded && 'text-warning')}>
                    {currentArea.toFixed(1)}cm²
                  </span>
                </div>
              </div>
              {areaExceeded && (
                <p className="text-xs text-warning mt-2">
                  ⚠️ Excede o máximo permitido de {maxArea}cm²
                </p>
              )}
            </div>
          </motion.div>
        )}
      </div>

      {/* Compatibility info */}
      {compatibleCount < techniques.length && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-warning/10 border border-warning/20 text-sm text-warning-foreground">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>
            Com {engravingSpecs.colors} {engravingSpecs.colors === 1 ? 'cor' : 'cores'}, apenas {compatibleCount} de {techniques.length} técnicas serão compatíveis.
          </span>
        </div>
      )}

      {/* Live Price Preview */}
      {(estimate || priceLoading) && !areaExceeded && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 rounded-2xl bg-gradient-to-r from-primary/5 to-primary/10 border border-primary/20"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-primary/10">
                <DollarSign className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Estimativa de preço</p>
                {priceLoading ? (
                  <div className="flex items-center gap-2 mt-1">
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    <span className="text-sm text-muted-foreground">Calculando...</span>
                  </div>
                ) : estimate ? (
                  <p className="text-sm">
                    <span className="font-bold text-primary text-lg">{formatCurrency(estimate.unitPrice)}</span>
                    <span className="text-muted-foreground">/un via {estimate.cheapestName}</span>
                  </p>
                ) : null}
              </div>
            </div>
            {estimate && (
              <div className="text-right">
                <p className="font-bold text-primary">
                  {formatCurrency(estimate.totalPrice)}
                </p>
                <p className="text-xs text-muted-foreground">total gravação</p>
              </div>
            )}
          </div>
          <p className="text-[10px] text-muted-foreground/70 mt-2">
            * Estimativa baseada na técnica mais acessível. Clique em "Comparar" para ver todas.
          </p>

          {/* Breakdown — detalhamento por área, técnica e tamanho retornado pelo RPC */}
          {estimate && !priceLoading && (
            <Collapsible className="mt-3">
              <CollapsibleTrigger className="group flex items-center gap-1.5 text-xs font-semibold text-primary hover:text-primary/80 transition-colors">
                <ChevronDown className="h-3.5 w-3.5 transition-transform group-data-[state=open]:rotate-180" />
                Ver detalhamento do cálculo
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-3">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2 p-3 rounded-xl bg-background/60 border border-border/60 text-xs">
                  <div>
                    <p className="text-muted-foreground">Área</p>
                    <p className="font-semibold truncate" title={estimate.breakdown.areaName}>
                      {estimate.breakdown.areaName}
                      {estimate.breakdown.areaCode && (
                        <span className="ml-1 text-muted-foreground/70">({estimate.breakdown.areaCode})</span>
                      )}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Técnica</p>
                    <p className="font-semibold truncate" title={estimate.cheapestName}>
                      {estimate.cheapestName}
                      {estimate.breakdown.techniqueGroup && (
                        <span className="ml-1 text-muted-foreground/70">· {estimate.breakdown.techniqueGroup}</span>
                      )}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Tabela</p>
                    <p className="font-semibold font-mono truncate" title={estimate.breakdown.tableCode}>
                      {estimate.breakdown.tableCodeShort || estimate.breakdown.tableCode || '—'}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Tamanho</p>
                    <p className="font-semibold">
                      {estimate.breakdown.width !== null && estimate.breakdown.height !== null ? (
                        <>
                          {estimate.breakdown.width}×{estimate.breakdown.height}cm
                          {estimate.breakdown.areaCm2 !== null && (
                            <span className="ml-1 text-muted-foreground/70">({estimate.breakdown.areaCm2}cm²)</span>
                          )}
                        </>
                      ) : (
                        <span className="text-muted-foreground/70">não usa dimensão</span>
                      )}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Cores</p>
                    <p className="font-semibold">
                      {estimate.breakdown.numColors}
                      <span className="ml-1 text-muted-foreground/70">
                        {estimate.breakdown.priceByColor ? `(máx ${estimate.breakdown.maxColors})` : '(full color)'}
                      </span>
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Faixa de quantidade</p>
                    <p className="font-semibold">
                      {estimate.breakdown.tierMinQty}
                      {estimate.breakdown.tierMaxQty > 0 && estimate.breakdown.tierMaxQty < 999999
                        ? ` – ${estimate.breakdown.tierMaxQty}`
                        : '+'}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Subtotal peças</p>
                    <p className="font-semibold">{formatCurrency(estimate.breakdown.subtotalPieces)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Setup / Mín.</p>
                    <p className="font-semibold">
                      {formatCurrency(estimate.breakdown.setupTotal)}
                      {estimate.breakdown.minimumApplied && (
                        <span className="ml-1 text-warning text-[10px]">⚠ aplicado</span>
                      )}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Custo / un</p>
                    <p className="font-semibold">{formatCurrency(estimate.costPerUnit)}</p>
                  </div>
                  {estimate.productionDays !== null && (
                    <div>
                      <p className="text-muted-foreground">Prazo produção</p>
                      <p className="font-semibold">{estimate.productionDays} dias</p>
                    </div>
                  )}
                  {estimate.breakdown.quotationCode && (
                    <div className="col-span-2 sm:col-span-3">
                      <p className="text-muted-foreground">Código orçamento</p>
                      <p className="font-semibold font-mono text-[11px] truncate" title={estimate.breakdown.quotationCode}>
                        {estimate.breakdown.quotationCode}
                      </p>
                    </div>
                  )}
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}
        </motion.div>
      )}

      {/* Navigation */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="flex justify-between pt-6"
      >
        <Button variant="ghost" size="lg" onClick={wizard.previousStep} className="gap-2">
          <ChevronLeft className="h-5 w-5" />
          Voltar
        </Button>
        <div className="flex flex-col items-end gap-1">
          <Button
            disabled={wizard.isCalculating || areaExceeded}
            onClick={handleCompare}
            size="lg"
            className="gap-3 min-w-[220px] h-14 rounded-xl shadow-lg shadow-primary/25 text-base"
          >
            {wizard.isCalculating ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Calculando...
              </>
            ) : (
              <>
                <BarChart3 className="h-5 w-5" />
                Comparar {techniques.length} Técnica{techniques.length !== 1 ? 's' : ''}
              </>
            )}
          </Button>
          {estimate && !priceLoading && (
            <p className="text-[11px] text-muted-foreground/70">
              A partir de {formatCurrency(estimate.unitPrice)}/un
            </p>
          )}
        </div>
      </motion.div>
    </div>
  );
}
