/**
 * ComparisonScoreCard — Card com score ponderado + popover para ajustar pesos.
 * Mostra o vencedor recomendado com badge Crown.
 */
import { useMemo } from 'react';
import { Crown, Sliders, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import {
  useComparisonScore,
  useComparisonWeights,
  mapWeightsToScore,
  mapScoreToWeights,
  type ComparisonScoreWeights,
} from '@/hooks/comparison';
import type { Product } from '@/types/product-catalog';

interface ComparisonScoreCardProps {
  products: Product[];
  className?: string;
}

const WEIGHT_LABELS: Record<keyof ComparisonScoreWeights, string> = {
  price: 'Preço',
  stock: 'Estoque',
  minQuantity: 'Qtd. mínima',
  colorVariety: 'Variedade de cores',
  verifiedSupplier: 'Fornecedor verificado',
  leadTime: 'Lead time',
};

export function ComparisonScoreCard({ products, className }: ComparisonScoreCardProps) {
  // Weights persist per-user (user_preferences.comparison_weights) with a
  // localStorage fallback — so "Ajustar pesos" survives reloads and devices.
  const { weights: persistedWeights, setWeights: persistWeights, reset } = useComparisonWeights();
  const weights = useMemo<ComparisonScoreWeights>(
    () => mapWeightsToScore(persistedWeights),
    [persistedWeights],
  );
  const setWeights = (next: ComparisonScoreWeights) => persistWeights(mapScoreToWeights(next));
  const scores = useComparisonScore(products, weights);
  const winner = scores.find((s) => s.isWinner);
  const winnerProduct = winner ? products.find((p) => String(p.id) === winner.productId) : null;

  if (!winner || !winnerProduct || products.length < 2) return null;

  return (
    <div
      className={cn(
        'relative rounded-2xl border-[1.5px] border-primary/30 bg-gradient-to-br from-primary/5 via-background to-background p-4 shadow-md',
        className,
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-amber-600 shadow-lg">
            <Crown className="h-6 w-6 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <Badge className="gap-1 border-amber-500/40 bg-amber-500/20 text-amber-700 dark:text-amber-300">
                <Sparkles className="h-3 w-3" /> Recomendado
              </Badge>
              <span className="text-2xl font-bold text-foreground">{winner.total}</span>
              <span className="text-sm text-muted-foreground">/ 100</span>
            </div>
            <p className="mt-0.5 line-clamp-1 text-sm font-medium text-foreground">
              {winnerProduct.name}
            </p>
          </div>
        </div>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              <Sliders className="h-3.5 w-3.5" />
              Ajustar pesos
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80" align="end">
            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-semibold">Pesos do score</h4>
                <p className="text-xs text-muted-foreground">
                  Ajuste para refletir suas prioridades.
                </p>
              </div>
              {(Object.entries(weights) as [keyof ComparisonScoreWeights, number][]).map(
                ([key, weight]) => (
                  <div key={key} className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs">{WEIGHT_LABELS[key]}</Label>
                      <span className="font-mono text-xs text-muted-foreground">{weight}</span>
                    </div>
                    <Slider
                      value={[weight]}
                      onValueChange={(v) => setWeights({ ...weights, [key]: v[0] })}
                      min={0}
                      max={50}
                      step={5}
                    />
                  </div>
                ),
              )}
              <Button variant="ghost" size="sm" className="w-full" onClick={() => reset()}>
                Restaurar padrão
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* Mini ranking */}
      <div className="mt-4 flex flex-wrap gap-2">
        {scores
          .slice()
          .sort((a, b) => a.rank - b.rank)
          .map((s) => {
            const p = products.find((x) => String(x.id) === s.productId);
            if (!p) return null;
            return (
              <div
                key={s.productId}
                className={cn(
                  'flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs',
                  s.isWinner
                    ? 'border-primary/40 bg-primary/5 font-medium'
                    : 'border-border bg-muted/30',
                )}
              >
                <span className="font-mono text-muted-foreground">#{s.rank}</span>
                <span className="line-clamp-1 max-w-[140px]">{p.name}</span>
                <span className="font-bold text-primary">{s.total}</span>
              </div>
            );
          })}
      </div>
    </div>
  );
}
