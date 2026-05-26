/**
 * ComparisonHighlights - Visual diff highlighting for product comparison
 * Shows best/worst values with color coding
 */
import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { TrendingUp, Minus, Crown, AlertTriangle } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

type HighlightType = 'best' | 'worst' | 'neutral';
type CompareMode = 'lower-is-better' | 'higher-is-better';

interface ComparisonHighlightsProps {
  values: (number | null | undefined)[];
  labels: string[];
  mode?: CompareMode;
  formatValue?: (value: number) => string;
  showIndicators?: boolean;
  className?: string;
}

export function ComparisonHighlights({
  values,
  labels,
  mode = 'lower-is-better',
  formatValue = (v) => v.toString(),
  showIndicators = true,
  className,
}: ComparisonHighlightsProps) {
  const analysis = useMemo(() => {
    const validValues = values
      .map((v, i) => ({ value: v, index: i }))
      .filter(
        (item): item is { value: number; index: number } =>
          item.value !== null && item.value !== undefined,
      );

    if (validValues.length === 0) return [];

    const sortedAsc = [...validValues].sort((a, b) => a.value - b.value);
    const bestIndex =
      mode === 'lower-is-better' ? sortedAsc[0]?.index : sortedAsc[sortedAsc.length - 1]?.index;
    const worstIndex =
      mode === 'lower-is-better' ? sortedAsc[sortedAsc.length - 1]?.index : sortedAsc[0]?.index;

    return values.map((value, index) => {
      if (value === null || value === undefined) {
        return { value: null, type: 'neutral' as HighlightType, diff: 0 };
      }

      let type: HighlightType = 'neutral';
      if (validValues.length > 1) {
        if (index === bestIndex) type = 'best';
        else if (index === worstIndex) type = 'worst';
      }

      // Calculate diff from best
      const bestValue = validValues.find((v) => v.index === bestIndex)?.value ?? value;
      const diff = mode === 'lower-is-better' ? value - bestValue : bestValue - value;

      return { value, type, diff };
    });
  }, [values, mode]);

  return (
    <TooltipProvider>
      <div className={cn('flex gap-2', className)}>
        {analysis.map((item, index) => (
          <HighlightCell
            key={index}
            value={item.value}
            type={item.type}
            diff={item.diff}
            label={labels[index] || `Item ${index + 1}`}
            formatValue={formatValue}
            showIndicator={showIndicators}
            mode={mode}
          />
        ))}
      </div>
    </TooltipProvider>
  );
}

interface HighlightCellProps {
  value: number | null;
  type: HighlightType;
  diff: number;
  label: string;
  formatValue: (value: number) => string;
  showIndicator: boolean;
  mode: CompareMode;
}

function HighlightCell({
  value,
  type,
  diff,
  label,
  formatValue,
  showIndicator,
  mode,
}: HighlightCellProps) {
  if (value === null) {
    return (
      <div className="flex-1 rounded-md bg-muted/50 p-2 text-center">
        <span className="text-muted-foreground">—</span>
      </div>
    );
  }

  const styles = {
    best: {
      bg: 'bg-success/10 border-success/30',
      text: 'text-success font-semibold',
      icon: Crown,
      tooltip: 'Melhor valor',
    },
    worst: {
      bg: 'bg-destructive/10 border-destructive/30',
      text: 'text-destructive',
      icon: AlertTriangle,
      tooltip: 'Valor mais alto',
    },
    neutral: {
      bg: 'bg-muted/50 border-border',
      text: 'text-foreground',
      icon: Minus,
      tooltip: null,
    },
  };

  const style = styles[type];
  const Icon = style.icon;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className={cn(
            'flex-1 rounded-md border p-2 transition-all duration-200',
            'cursor-default hover:shadow-md',
            style.bg,
          )}
        >
          <div className="flex items-center justify-center gap-1.5">
            {showIndicator && type !== 'neutral' && (
              <Icon className={cn('h-3.5 w-3.5', style.text)} />
            )}
            <span className={cn('text-sm', style.text)}>{formatValue(value)}</span>
            {type === 'best' && diff === 0 && <TrendingUp className="h-3 w-3 text-success" />}
            {type !== 'best' && diff > 0 && (
              <span className="text-xs text-muted-foreground">
                (+{mode === 'lower-is-better' ? formatValue(diff) : formatValue(-diff)})
              </span>
            )}
          </div>
        </div>
      </TooltipTrigger>
      <TooltipContent>
        <div className="text-xs">
          <p className="font-medium">{label}</p>
          {style.tooltip && <p className="text-muted-foreground">{style.tooltip}</p>}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

/**
 * Utility to highlight best/worst in a comparison table row
 */
interface HighlightRowProps {
  attribute: string;
  values: (string | number | boolean | null)[];
  productNames: string[];
  mode?: CompareMode;
  formatFn?: (v: string | number | boolean) => string;
}

export function useComparisonHighlight(
  values: (number | null | undefined)[],
  mode: CompareMode = 'lower-is-better',
) {
  return useMemo(() => {
    const validIndices = values
      .map((v, i) => ({ v, i }))
      .filter((x) => x.v !== null && x.v !== undefined);

    if (validIndices.length < 2) return values.map(() => 'neutral' as HighlightType);

    const numericValues = validIndices.map((x) => x.v as number);
    const min = Math.min(...numericValues);
    const max = Math.max(...numericValues);

    return values.map((v) => {
      if (v === null || v === undefined) return 'neutral' as HighlightType;
      if (mode === 'lower-is-better') {
        if (v === min) return 'best' as HighlightType;
        if (v === max) return 'worst' as HighlightType;
      } else {
        if (v === max) return 'best' as HighlightType;
        if (v === min) return 'worst' as HighlightType;
      }
      return 'neutral' as HighlightType;
    });
  }, [values, mode]);
}

/**
 * CSS classes for inline highlighting
 */
export const highlightClasses = {
  best: 'bg-success/10 text-success font-semibold border-l-2 border-l-success',
  worst: 'bg-destructive/10 text-destructive border-l-2 border-l-destructive',
  neutral: '',
} as const;
