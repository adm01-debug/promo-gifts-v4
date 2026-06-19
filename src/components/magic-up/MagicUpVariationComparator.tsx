import { useRef } from 'react';
import { Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { VariationItem } from '@/hooks/intelligence';

interface MagicUpVariationComparatorProps {
  variations: VariationItem[];
  activeIndex: number;
  onSelect: (index: number) => void;
  onSelectWinner: (index: number) => void;
  loadingWinnerIndex?: number | null;
}

export function MagicUpVariationComparator({
  variations,
  activeIndex,
  onSelect,
  onSelectWinner,
  loadingWinnerIndex = null,
}: MagicUpVariationComparatorProps) {
  const cardRefs = useRef<Array<HTMLButtonElement | null>>([]);

  if (variations.length < 2) return null;
  // Resolve score explicitamente: number (incluindo 0) ou null (ausente).
  // qualityDiagnosis.total tem prioridade absoluta sobre qualityScore.
  const resolveScore = (variation: VariationItem): number | null => {
    if (typeof variation.qualityDiagnosis?.total === 'number')
      return variation.qualityDiagnosis.total;
    if (typeof variation.qualityScore === 'number') return variation.qualityScore;
    return null;
  };
  const scores = variations.map(resolveScore);
  const numericScores = scores.filter((s): s is number => s !== null);
  const bestScore: number | null = numericScores.length > 0 ? Math.max(...numericScores) : null;
  const explicitWinnerIndex = variations.findIndex((variation) => variation.isWinner);
  const winnerIndex =
    explicitWinnerIndex >= 0
      ? explicitWinnerIndex
      : bestScore !== null
        ? scores.findIndex((s) => s === bestScore)
        : -1;

  const handleArrowKey = (e: React.KeyboardEvent<HTMLButtonElement>, currentIndex: number) => {
    const total = variations.length;
    let nextIndex: number | null = null;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') nextIndex = (currentIndex + 1) % total;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp')
      nextIndex = (currentIndex - 1 + total) % total;
    else if (e.key === 'Home') nextIndex = 0;
    else if (e.key === 'End') nextIndex = total - 1;
    if (nextIndex === null) return;
    e.preventDefault();
    onSelect(nextIndex);
    const nextCard = cardRefs.current[nextIndex];
    nextCard?.focus();
    if (nextCard && typeof nextCard.scrollIntoView === 'function') {
      const prefersReducedMotion =
        typeof window !== 'undefined' &&
        window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      nextCard.scrollIntoView({
        block: 'nearest',
        inline: 'nearest',
        behavior: prefersReducedMotion ? 'auto' : 'smooth',
      });
    }
  };

  return (
    <section
      data-testid="magic-up-variation-comparator"
      className="rounded-lg border bg-card p-3"
      aria-label="Comparador de variações"
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-sm font-semibold">Comparar variações</p>
        <Badge
          variant="secondary"
          aria-label={`Melhor score entre variações: ${bestScore !== null ? bestScore : 'indisponível'}`}
        >
          Melhor score: {bestScore !== null ? bestScore : '—'}
        </Badge>
      </div>
      <div
        role="list"
        data-testid="variation-list"
        className="grid grid-cols-2 gap-2 sm:grid-cols-3"
      >
        {variations.map((variation, index) => {
          const score = scores[index];
          const isWinner = index === winnerIndex;
          const isActive = index === activeIndex;
          return (
            <div
              role="listitem"
              data-testid={`variation-item-${index + 1}`}
              data-variation-index={index}
              key={`${variation.id || variation.imageUrl}-${index}`}
              className={cn(
                'overflow-hidden rounded-lg border',
                isActive
                  ? 'border-primary ring-2 ring-primary/20'
                  : 'border-border hover:border-primary/40',
              )}
            >
              <button
                ref={(el) => {
                  cardRefs.current[index] = el;
                }}
                type="button"
                data-testid={`variation-card-${index + 1}`}
                data-variation-index={index}
                data-active={isActive ? 'true' : 'false'}
                data-winner={isWinner ? 'true' : 'false'}
                aria-pressed={isActive}
                aria-current={isActive ? 'true' : undefined}
                aria-keyshortcuts="ArrowLeft ArrowRight ArrowUp ArrowDown Home End"
                aria-label={`Selecionar variação ${index + 1}${score !== null ? `, score ${score}` : ''}${isWinner ? ', melhor score' : ''}`}
                onClick={() => onSelect(index)}
                onKeyDown={(e) => handleArrowKey(e, index)}
                className="group block w-full text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <div className="relative aspect-square bg-muted">
                  <img
                    src={variation.imageUrl}
                    alt={`Variação ${index + 1}`}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                  {isWinner && (
                    <Badge className="absolute left-1 top-1 text-[10px]" aria-label="Melhor score">
                      Melhor score
                    </Badge>
                  )}
                </div>
                <div className="space-y-1 p-2">
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-xs font-medium">Variação {index + 1}</span>
                    <span
                      className="text-xs font-semibold text-primary"
                      aria-label={score !== null ? `Score ${score} de 100` : 'Score indisponível'}
                    >
                      {score !== null ? score : '—'}
                    </span>
                  </div>
                </div>
              </button>
              <div className="px-2 pb-2">
                {(() => {
                  const isLoadingThis = loadingWinnerIndex === index;
                  return (
                    <Button
                      size="sm"
                      variant="ghost"
                      data-testid={`variation-winner-button-${index + 1}`}
                      data-variation-index={index}
                      className="h-6 w-full text-[11px] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:bg-muted disabled:text-muted-foreground disabled:opacity-100"
                      aria-label={`Marcar variação ${index + 1} como vencedora`}
                      aria-busy={isLoadingThis || undefined}
                      disabled={isLoadingThis}
                      onClick={() => onSelectWinner(index)}
                    >
                      {isLoadingThis ? (
                        <span className="inline-flex items-center gap-1">
                          <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
                          <span className="sr-only">Marcando vencedora…</span>
                          Marcar vencedora
                        </span>
                      ) : (
                        'Marcar vencedora'
                      )}
                    </Button>
                  );
                })()}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
