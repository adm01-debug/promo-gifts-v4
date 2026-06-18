/**
 * TechniqueColorConfigDialog — Modal for technique-specific color configuration
 *
 * Handles 3 categories:
 * - Laser: Light/Dark tone selection
 * - Serigrafia: 1-3 color Pantone selection from detected logo colors
 * - Digital UV / others: Full color (policromia) — informational only
 */

import { useState, useCallback, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { Paintbrush, Palette, Zap, Check, Info } from 'lucide-react';
import type { DetectedColor } from '@/hooks/simulation';

// Re-export types and utils from shared module
export type { TechniqueCategory, LaserTone, TechniqueColorConfig } from './techniqueColorUtils';
export { classifyTechnique, techniqueNeedsColorConfig } from './techniqueColorUtils';

import {
  type LaserTone,
  type TechniqueColorConfig,
  classifyTechnique,
} from './techniqueColorUtils';

// ─── Helpers ─────────────────────────────────────────────────────────

const LASER_TONES: Record<LaserTone, { label: string; hex: string; description: string }> = {
  claro: {
    label: 'Laser Claro',
    hex: '#C0C0C0',
    description: 'Tom cinza claro — ideal para superfícies escuras',
  },
  escuro: {
    label: 'Laser Escuro',
    hex: '#4A4A4A',
    description: 'Tom chumbo/escuro — ideal para superfícies claras',
  },
};
// ─── Component ───────────────────────────────────────────────────────

interface TechniqueColorConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  techniqueName: string;
  techniqueCode?: string | null;
  detectedColors: DetectedColor[];
  currentConfig?: TechniqueColorConfig | null;
  onConfirm: (config: TechniqueColorConfig) => void;
}

export function TechniqueColorConfigDialog({
  open,
  onOpenChange,
  techniqueName,
  techniqueCode,
  detectedColors = [],
  currentConfig,
  onConfirm,
}: TechniqueColorConfigDialogProps) {
  const category = useMemo(
    () => classifyTechnique(techniqueName, techniqueCode),
    [techniqueName, techniqueCode],
  );

  // Local state for form
  const [laserTone, setLaserTone] = useState<LaserTone>(currentConfig?.laserTone || 'escuro');
  const [colorCount, setColorCount] = useState<number>(currentConfig?.colorCount || 1);
  const [selectedIndices, setSelectedIndices] = useState<number[]>(
    currentConfig?.selectedPantoneIndices ?? [],
  );

  // Reset when dialog opens with new config
  useEffect(() => {
    if (open) {
      setLaserTone(currentConfig?.laserTone || 'escuro');
      setColorCount(currentConfig?.colorCount || 1);
      setSelectedIndices(currentConfig?.selectedPantoneIndices ?? []);
    }
  }, [open, currentConfig]);

  // When color count changes, trim selected indices if needed
  useEffect(() => {
    if (selectedIndices.length > colorCount) {
      setSelectedIndices((prev) => prev.slice(0, colorCount));
    }
  }, [colorCount, selectedIndices.length]);

  const handlePantoneToggle = useCallback(
    (index: number) => {
      setSelectedIndices((prev) => {
        if (prev.includes(index)) {
          return prev.filter((i) => i !== index);
        }
        if (prev.length >= colorCount) {
          // Replace last selection
          return [...prev.slice(0, colorCount - 1), index];
        }
        return [...prev, index];
      });
    },
    [colorCount],
  );

  const handleConfirm = useCallback(() => {
    const config: TechniqueColorConfig = { category };

    if (category === 'laser') {
      config.laserTone = laserTone;
    } else if (category === 'serigrafia') {
      config.colorCount = colorCount;
      config.selectedPantoneIndices = selectedIndices;
      // Resolve actual hex + pantoneCode for each selected index so canvas processing can use them
      config.selectedColors = selectedIndices.map((idx) => {
        const color = detectedColors[idx];
        return {
          hex: color.hex,
          pantoneCode: color.selectedPantone || color.pantoneMatch?.pantoneCode || color.name,
        };
      });
    } else {
      config.isFullColor = true;
    }

    onConfirm(config);
    onOpenChange(false);
  }, [category, laserTone, colorCount, selectedIndices, detectedColors, onConfirm, onOpenChange]);

  const isValid = useMemo(() => {
    if (category === 'laser') return true; // always has a default
    if (category === 'serigrafia') {
      if (detectedColors.length === 0) return true; // no colors detected, allow proceeding
      return selectedIndices.length > 0 && selectedIndices.length <= colorCount;
    }
    return true;
  }, [category, detectedColors.length, selectedIndices, colorCount]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Palette className="h-5 w-5 text-primary" />
            Configuração de Cores
          </DialogTitle>
          <DialogDescription>
            <span className="font-medium text-foreground">{techniqueName}</span>
            {' — '}
            {category === 'laser' && 'Selecione o tom de gravação'}
            {category === 'serigrafia' && 'Selecione as cores para impressão'}
            {(category === 'digital' || category === 'other') &&
              'Impressão em policromia (full color)'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-2">
          {/* ─── LASER ─────────────────────────────────────── */}
          {category === 'laser' && (
            <div className="space-y-3">
              <Label className="text-sm font-medium">Tom da Gravação</Label>
              <RadioGroup
                value={laserTone}
                onValueChange={(v) => setLaserTone(v as LaserTone)}
                className="grid grid-cols-2 gap-3"
              >
                {(Object.entries(LASER_TONES) as [LaserTone, typeof LASER_TONES.claro][]).map(
                  ([key, tone]) => (
                    <label
                      key={key}
                      className={cn(
                        'relative flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 p-4 transition-all',
                        laserTone === key
                          ? 'border-primary bg-primary/5 shadow-sm'
                          : 'border-muted hover:border-primary/30',
                      )}
                    >
                      <RadioGroupItem value={key} className="sr-only" />
                      <div
                        className="h-12 w-12 rounded-full border-2 shadow-inner"
                        style={{ backgroundColor: tone.hex, borderColor: `${tone.hex}80` }}
                      />
                      <span className="text-sm font-medium">{tone.label}</span>
                      <span className="text-center text-[10px] leading-tight text-muted-foreground">
                        {tone.description}
                      </span>
                      {laserTone === key && (
                        <div className="absolute right-2 top-2">
                          <Check className="h-4 w-4 text-primary" />
                        </div>
                      )}
                    </label>
                  ),
                )}
              </RadioGroup>

              <div className="flex items-start gap-2 rounded-lg bg-muted/50 p-2.5 text-xs text-muted-foreground">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>
                  O logo será convertido automaticamente para monocromia no tom selecionado. A
                  gravação a laser produz apenas um tom sobre o material.
                </span>
              </div>
            </div>
          )}

          {/* ─── SERIGRAFIA ────────────────────────────────── */}
          {category === 'serigrafia' && (
            <div className="space-y-4">
              {/* Color count selector */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Quantidade de Cores</Label>
                <div className="flex gap-2">
                  {[1, 2, 3].map((n) => (
                    <Button
                      key={n}
                      variant={colorCount === n ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setColorCount(n)}
                      className="flex-1"
                    >
                      {n} {n === 1 ? 'cor' : 'cores'}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Pantone selection */}
              {detectedColors.length > 0 ? (
                <div className="space-y-2">
                  <Label className="text-sm font-medium">
                    Selecione {colorCount === 1 ? 'a cor' : `até ${colorCount} cores`} Pantone
                  </Label>
                  <div className="grid gap-2">
                    {detectedColors.map((color, idx) => {
                      const isSelected = selectedIndices.includes(idx);
                      // Never truly disable — handlePantoneToggle already handles replacement
                      // when colorCount is reached. "atMax" is purely a visual hint.
                      const atMax = !isSelected && selectedIndices.length >= colorCount;
                      const pantoneLabel =
                        color.selectedPantone || color.pantoneMatch?.pantoneCode || color.name;
                      return (
                        <label
                          key={`${color.hex}-${idx}`}
                          className={cn(
                            'flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-all',
                            isSelected
                              ? 'border-primary bg-primary/5'
                              : atMax
                                ? 'border-muted/50 hover:border-primary/20'
                                : 'border-muted hover:border-primary/30',
                          )}
                        >
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => handlePantoneToggle(idx)}
                          />
                          <div
                            className="h-8 w-8 shrink-0 rounded border shadow-sm"
                            style={{ backgroundColor: color.hex }}
                          />
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-medium">{pantoneLabel}</div>
                            <div className="text-[10px] text-muted-foreground">
                              {color.hex} • {color.name}
                            </div>
                          </div>
                          {isSelected && (
                            <Badge variant="secondary" className="shrink-0 text-[10px]">
                              #{selectedIndices.indexOf(idx) + 1}
                            </Badge>
                          )}
                        </label>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-2 rounded-lg border border-warning/20 bg-warning/5 p-3 dark:border-warning/40 dark:bg-warning/10">
                  <Info className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
                  <div className="text-xs text-warning dark:text-warning">
                    <p className="mb-1 font-medium">Cores não detectadas</p>
                    <p>
                      Faça upload do logo primeiro para detectar as cores Pantone automaticamente.
                      Você poderá configurar as cores após o upload.
                    </p>
                  </div>
                </div>
              )}

              <div className="flex items-start gap-2 rounded-lg bg-muted/50 p-2.5 text-xs text-muted-foreground">
                <Paintbrush className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>
                  {colorCount === 1
                    ? 'O logo será convertido para monocromia na cor Pantone selecionada.'
                    : `O logo será simplificado para ${colorCount} cores Pantone selecionadas.`}
                </span>
              </div>
            </div>
          )}

          {/* ─── DIGITAL / FULL COLOR ─────────────────────── */}
          {(category === 'digital' || category === 'other') && (
            <div className="flex flex-col items-center gap-3 py-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-destructive via-success to-info">
                <Zap className="h-8 w-8 text-primary-foreground" />
              </div>
              <Badge className="px-3 py-1 text-sm">Policromia (Full Color)</Badge>
              <p className="max-w-xs text-center text-sm text-muted-foreground">
                Esta técnica suporta impressão em cores completas. O logo será aplicado sem
                restrições de cores.
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={!isValid}>
            <Check className="mr-1.5 h-4 w-4" />
            Confirmar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
