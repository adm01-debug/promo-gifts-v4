/**
 * ComparisonHighlights — utilities to highlight best/worst values in a comparison row.
 *
 * Exporta apenas o que é consumido por CompareTableView.tsx:
 *  - useComparisonHighlight(values, mode): classifica cada valor em best/worst/neutral
 *  - highlightClasses: classes CSS por tipo de destaque
 *
 * (O componente visual ComparisonHighlights/HighlightCell foi removido por não
 *  estar em uso; restaurar do histórico se voltar a ser necessário.)
 */
import { useMemo } from 'react';

type HighlightType = 'best' | 'worst' | 'neutral';
type CompareMode = 'lower-is-better' | 'higher-is-better';

/**
 * Classifica cada valor de uma linha de comparação como melhor/pior/neutro.
 * Requer ao menos 2 valores válidos para destacar; caso contrário tudo é neutro.
 */
export function useComparisonHighlight(
  values: (number | null | undefined)[],
  mode: CompareMode = 'lower-is-better',
): HighlightType[] {
  return useMemo(() => {
    const validValues = values.filter((v): v is number => v !== null && v !== undefined);

    if (validValues.length < 2) return values.map(() => 'neutral' as HighlightType);

    const min = Math.min(...validValues);
    const max = Math.max(...validValues);

    // Todos os valores iguais → não há melhor/pior distinguível; tudo neutro.
    // (Sem este guard, min === max marcaria todas as células como 'best'.)
    if (min === max) return values.map(() => 'neutral' as HighlightType);

    return values.map((v) => {
      if (v === null || v === undefined) return 'neutral';
      if (mode === 'lower-is-better') {
        if (v === min) return 'best';
        if (v === max) return 'worst';
      } else {
        if (v === max) return 'best';
        if (v === min) return 'worst';
      }
      return 'neutral';
    });
  }, [values, mode]);
}

/**
 * Classes CSS para destaque inline numa célula de tabela de comparação.
 */
export const highlightClasses: Record<HighlightType, string> = {
  best: 'bg-success/10 text-success font-semibold border-l-2 border-l-success',
  worst: 'bg-destructive/10 text-destructive border-l-2 border-l-destructive',
  neutral: '',
};
