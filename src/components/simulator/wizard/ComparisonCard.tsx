/**
 * ComparisonCard — Card individual de técnica no comparativo
 * Extraído de StepComparison.tsx
 */

import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Trophy, Zap, Clock, DollarSign, Check, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/format';
import type { TechniqueComparisonResult } from '@/types/domain/simulator-wizard';

interface ComparisonCardProps {
  result: TechniqueComparisonResult;
  onSelect: (r: TechniqueComparisonResult) => void;
  quantity: number;
  isFirst: boolean;
  maxPrice: number;
  isSelected: boolean;
}

export function ComparisonCard({
  result,
  onSelect,
  quantity,
  isFirst,
  maxPrice,
  isSelected,
}: ComparisonCardProps) {
  const [showDetails, setShowDetails] = useState(false);
  const isBestValue = result.isCheapest;
  const savingsPercent =
    maxPrice > 0 && result.totalPrice < maxPrice
      ? Math.round(((maxPrice - result.totalPrice) / maxPrice) * 100)
      : 0;

  return (
    <div className="relative">
      {isBestValue && !isSelected && (
        <div className="pointer-events-none absolute -inset-px rounded-2xl bg-gradient-to-r from-warning/40 via-primary/30 to-warning/40 blur-sm" />
      )}
      <button
        onClick={() => onSelect(result)}
        className={cn(
          'group relative w-full rounded-2xl p-6 text-left transition-all duration-300',
          'border bg-card hover:border-primary/40 hover:shadow-xl hover:shadow-primary/10',
          isSelected && 'border-primary/50 shadow-lg shadow-primary/10 ring-2 ring-primary',
          !isSelected &&
            isBestValue &&
            'border-warning/30 shadow-lg shadow-warning/10 ring-2 ring-warning/50',
          !isSelected && !isBestValue && isFirst && 'ring-1 ring-primary/20',
        )}
      >
        <div className="flex items-start justify-between gap-5">
          {/* Checkbox */}
          <motion.div
            className={cn(
              'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border-2 transition-all',
              isSelected
                ? 'border-primary bg-primary'
                : 'border-muted-foreground/30 group-hover:border-primary/50',
            )}
            animate={isSelected ? { scale: [1, 1.15, 1] } : {}}
            transition={{ duration: 0.25 }}
          >
            {isSelected && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 400, damping: 15 }}
              >
                <Check className="h-5 w-5 text-primary-foreground" />
              </motion.div>
            )}
          </motion.div>

          {/* Info */}
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex flex-wrap items-center gap-3">
              <h4 className="text-xl font-bold">{result.techniqueName}</h4>
              <Badge variant="outline" className="font-mono text-xs">
                {result.techniqueCode}
              </Badge>
              {isBestValue && (
                <Badge className="gap-1.5 border-0 bg-gradient-to-r from-warning to-brand-primary px-3 py-1 text-sm text-primary-foreground shadow-lg shadow-amber-500/25">
                  <Trophy className="h-4 w-4" />
                  Melhor Custo-Benefício
                </Badge>
              )}
              {result.isFastest && (
                <Badge variant="secondary" className="gap-1.5">
                  <Zap className="h-3.5 w-3.5" />
                  Mais Rápido
                </Badge>
              )}
              {savingsPercent > 0 && (
                <Badge
                  variant="outline"
                  className="gap-1 border-primary text-primary dark:border-primary dark:text-primary"
                >
                  ↓ {savingsPercent}% vs mais caro
                </Badge>
              )}
            </div>

            {/* Unit price */}
            <div className="mt-3 flex items-center gap-6">
              <div className="flex items-baseline gap-1.5">
                <DollarSign className="h-5 w-5 self-center text-primary" />
                <span className="text-2xl font-extrabold text-primary">
                  {formatCurrency(result.unitPrice)}
                </span>
                <span className="text-sm font-medium text-muted-foreground">/un</span>
              </div>
              {result.productionDays && (
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  <span className="font-semibold">{result.productionDays}</span>
                  <span className="text-sm">dias</span>
                </div>
              )}
            </div>

            {/* Collapsible details */}
            <div className="mt-3">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowDetails(!showDetails);
                }}
                className="flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                <ChevronDown
                  className={cn('h-3.5 w-3.5 transition-transform', showDetails && 'rotate-180')}
                />
                Detalhes técnicos
              </button>
              <AnimatePresence>
                {showDetails && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="mt-2 flex flex-wrap gap-2">
                      {result.budgetCode && (
                        <Badge variant="secondary" className="gap-1 font-mono text-xs">
                          📋 {result.budgetCode}
                        </Badge>
                      )}
                      {result.minimumApplied && (
                        <Badge
                          variant="outline"
                          className="border-warning/30 text-xs text-warning dark:border-warning/40 dark:text-warning"
                        >
                          Faturamento mínimo aplicado
                        </Badge>
                      )}
                      {result.maxColors !== null && (
                        <Badge variant="outline" className="text-xs">
                          Máx {result.maxColors} cores
                        </Badge>
                      )}
                      <Badge variant="outline" className="text-xs">
                        Faixa {result.tierUsed} ({result.tierMinQty}-{result.tierMaxQty || '∞'} un.)
                      </Badge>
                      {result.setupPrice > 0 && (
                        <Badge variant="outline" className="text-xs">
                          Setup: {formatCurrency(result.setupPrice)}
                        </Badge>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Total Price */}
          <div className="shrink-0 text-right">
            <div className="min-w-[140px] rounded-2xl bg-muted/50 p-4 transition-colors group-hover:bg-primary/5">
              <p className="mb-1 text-[11px] uppercase tracking-wider text-muted-foreground">
                Total
              </p>
              <p className="text-2xl font-bold text-primary">{formatCurrency(result.totalPrice)}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {formatCurrency(result.costPerUnit)}/un
              </p>
            </div>
          </div>
        </div>
      </button>
    </div>
  );
}
