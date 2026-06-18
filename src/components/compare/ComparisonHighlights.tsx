/**
 * ComparisonHighlights — Utility to highlight best/worst in a comparison table row.
 */

export type HighlightResult = 'best' | 'worst' | 'neutral';

export const highlightClasses: Record<HighlightResult, string> = {
  best: 'bg-success/10',
  worst: 'bg-destructive/5',
  neutral: '',
};

export function useComparisonHighlight(
  values: number[],
  mode: 'lower-is-better' | 'higher-is-better',
): HighlightResult[] {
  if (values.length < 2) return values.map(() => 'neutral');
  const valid = values.filter((v) => !Number.isNaN(v) && isFinite(v));
  if (valid.length === 0) return values.map(() => 'neutral');
  const best = mode === 'lower-is-better' ? Math.min(...valid) : Math.max(...valid);
  const worst = mode === 'lower-is-better' ? Math.max(...valid) : Math.min(...valid);
  return values.map((v) => {
    if (v === best) return 'best';
    if (v === worst) return 'worst';
    return 'neutral';
  });
}
