// src/components/simulator/ScenarioComparison.tsx
// Comparativo de Cenários A vs B

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  GitCompare,
  Save,
  Trash2,
  ArrowRight,
  Trophy,
  TrendingDown,
  Clock,
  Sparkles,
} from 'lucide-react';
import { m as motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/hooks/simulation';
import type { SimulationOption, Product } from '@/types/simulation';

export interface SimulationScenario {
  id: string;
  name: string;
  productName: string;
  quantity: number;
  options: SimulationOption[];
  bestOption: SimulationOption | null;
  createdAt: Date;
}

interface ScenarioComparisonProps {
  scenarioA: SimulationScenario | null;
  scenarioB: SimulationScenario | null;
  currentSimulation: {
    options: SimulationOption[];
    product: Product | undefined;
    quantity: number;
    bestOption: SimulationOption | null;
  };
  onSaveAsScenario: (name: 'A' | 'B') => void;
  onClearScenario: (name: 'A' | 'B') => void;
}

export function ScenarioComparison({
  scenarioA,
  scenarioB,
  currentSimulation,
  onSaveAsScenario,
  onClearScenario,
}: ScenarioComparisonProps) {
  const [_selectedView, _setSelectedView] = useState<'compare' | 'details'>('compare');

  const canSave = currentSimulation.options.length > 0;

  // Calculate comparison metrics
  const comparison =
    scenarioA && scenarioB
      ? {
          priceDiff:
            (scenarioB.bestOption?.grandTotal ?? 0) - (scenarioA.bestOption?.grandTotal ?? 0),
          priceDiffPercent: scenarioA.bestOption?.grandTotal
            ? (((scenarioB.bestOption?.grandTotal ?? 0) - scenarioA.bestOption.grandTotal) /
                scenarioA.bestOption.grandTotal) *
              100
            : 0,
          daysDiff:
            (scenarioB.bestOption?.estimatedDays ?? 0) - (scenarioA.bestOption?.estimatedDays ?? 0),
          winner:
            (scenarioA.bestOption?.grandTotal ?? 0) <= (scenarioB.bestOption?.grandTotal ?? 0)
              ? 'A'
              : 'B',
        }
      : null;

  return (
    <Card className="border-2 border-dashed border-muted-foreground/30">
      <CardHeader className="pb-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-muted p-2">
              <GitCompare className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <CardTitle className="flex items-center gap-2 text-lg">
                Comparar Cenários
                <Badge variant="outline" className="gap-1 text-xs">
                  <Sparkles className="h-3 w-3" />
                  Beta
                </Badge>
              </CardTitle>
              <CardDescription>Salve simulações para comparar lado a lado</CardDescription>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Save Buttons */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold">Cenário A</span>
              {scenarioA && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs text-destructive hover:text-destructive"
                  onClick={() => onClearScenario('A')}
                >
                  <Trash2 className="mr-1 h-3 w-3" />
                  Limpar
                </Button>
              )}
            </div>
            {scenarioA ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="rounded-lg border border-primary/30 bg-primary/10 p-3"
              >
                <p className="truncate text-sm font-medium">{scenarioA.productName}</p>
                <p className="text-xs text-muted-foreground">{scenarioA.quantity} un</p>
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Melhor:</span>
                  <span className="font-bold text-primary">
                    {formatCurrency(scenarioA.bestOption?.grandTotal ?? 0)}
                  </span>
                </div>
              </motion.div>
            ) : (
              <Button
                variant="outline"
                className="h-20 w-full border-dashed"
                onClick={() => onSaveAsScenario('A')}
                disabled={!canSave}
              >
                <Save className="mr-2 h-4 w-4" />
                Salvar como A
              </Button>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold">Cenário B</span>
              {scenarioB && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs text-destructive hover:text-destructive"
                  onClick={() => onClearScenario('B')}
                >
                  <Trash2 className="mr-1 h-3 w-3" />
                  Limpar
                </Button>
              )}
            </div>
            {scenarioB ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="rounded-lg border border-primary/25 bg-primary/15 p-3"
              >
                <p className="truncate text-sm font-medium">{scenarioB.productName}</p>
                <p className="text-xs text-muted-foreground">{scenarioB.quantity} un</p>
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Melhor:</span>
                  <span className="font-bold text-primary/80">
                    {formatCurrency(scenarioB.bestOption?.grandTotal ?? 0)}
                  </span>
                </div>
              </motion.div>
            ) : (
              <Button
                variant="outline"
                className="h-20 w-full border-dashed"
                onClick={() => onSaveAsScenario('B')}
                disabled={!canSave}
              >
                <Save className="mr-2 h-4 w-4" />
                Salvar como B
              </Button>
            )}
          </div>
        </div>

        {/* Comparison Result */}
        <AnimatePresence>
          {comparison && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="rounded-xl border border-success/30 bg-gradient-to-br from-success/10 to-primary/10 p-4">
                <div className="mb-3 flex items-center gap-2">
                  <Trophy className="h-5 w-5 text-success" />
                  <span className="font-semibold">Resultado da Comparação</span>
                </div>

                <div className="grid grid-cols-3 gap-4 text-center">
                  {/* Scenario A */}
                  <div
                    className={cn(
                      'rounded-lg p-3 transition-all',
                      comparison.winner === 'A' && 'bg-success/20 ring-2 ring-success',
                    )}
                  >
                    <p className="mb-1 text-xs text-muted-foreground">Cenário A</p>
                    <p className="text-lg font-bold">
                      {formatCurrency(scenarioA?.bestOption?.grandTotal ?? 0)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {scenarioA?.bestOption?.estimatedDays}d
                    </p>
                    {comparison.winner === 'A' && (
                      <Badge className="mt-2 bg-success text-success-foreground">
                        <Trophy className="mr-1 h-3 w-3" />
                        Vencedor
                      </Badge>
                    )}
                  </div>

                  {/* Comparison */}
                  <div className="flex flex-col items-center justify-center">
                    <ArrowRight className="h-6 w-6 text-muted-foreground" />
                    <div
                      className={cn(
                        'mt-2 rounded-full px-3 py-1 text-sm font-medium',
                        comparison.priceDiff > 0
                          ? 'bg-success/20 text-success'
                          : 'bg-destructive/20 text-destructive',
                      )}
                    >
                      {comparison.priceDiff > 0 ? (
                        <>
                          <TrendingDown className="mr-1 inline h-3 w-3" />A é{' '}
                          {Math.abs(comparison.priceDiffPercent).toFixed(1)}% mais barato
                        </>
                      ) : comparison.priceDiff < 0 ? (
                        <>
                          <TrendingDown className="mr-1 inline h-3 w-3" />B é{' '}
                          {Math.abs(comparison.priceDiffPercent).toFixed(1)}% mais barato
                        </>
                      ) : (
                        'Mesmo preço'
                      )}
                    </div>
                    {comparison.daysDiff !== 0 && (
                      <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {comparison.daysDiff > 0
                          ? `A é ${comparison.daysDiff}d mais rápido`
                          : `B é ${Math.abs(comparison.daysDiff)}d mais rápido`}
                      </div>
                    )}
                  </div>

                  {/* Scenario B */}
                  <div
                    className={cn(
                      'rounded-lg p-3 transition-all',
                      comparison.winner === 'B' && 'bg-success/20 ring-2 ring-success',
                    )}
                  >
                    <p className="mb-1 text-xs text-muted-foreground">Cenário B</p>
                    <p className="text-lg font-bold">
                      {formatCurrency(scenarioB?.bestOption?.grandTotal ?? 0)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {scenarioB?.bestOption?.estimatedDays}d
                    </p>
                    {comparison.winner === 'B' && (
                      <Badge className="mt-2 bg-success text-success-foreground">
                        <Trophy className="mr-1 h-3 w-3" />
                        Vencedor
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Savings highlight */}
                {comparison.priceDiff !== 0 && (
                  <div className="mt-4 rounded-lg bg-card/50 p-3 text-center">
                    <p className="text-sm text-muted-foreground">
                      Economia escolhendo {comparison.winner}:
                    </p>
                    <p className="text-2xl font-bold text-success">
                      {formatCurrency(Math.abs(comparison.priceDiff))}
                    </p>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Empty state hint */}
        {!scenarioA && !scenarioB && (
          <div className="py-4 text-center text-sm text-muted-foreground">
            <p>
              Salve duas simulações diferentes para comparar qual oferece melhor custo-benefício
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
