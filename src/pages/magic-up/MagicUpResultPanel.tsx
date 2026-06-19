/**
 * MagicUp Result Panel — Right side with generated image variations
 */
import { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { AdImageResult } from '@/components/magic-up/AdImageResult';
import { MagicUpVariationComparator } from '@/components/magic-up/MagicUpVariationComparator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { useMagicUpState } from '@/hooks/intelligence';

type MagicUpStateReturn = ReturnType<typeof useMagicUpState>;

interface MagicUpResultPanelProps {
  m: MagicUpStateReturn;
}

export function MagicUpResultPanel({ m }: MagicUpResultPanelProps) {
  const dotRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const thumbRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const handleArrowKey = (
    e: React.KeyboardEvent<HTMLButtonElement>,
    currentIndex: number,
    refs: React.MutableRefObject<Array<HTMLButtonElement | null>>,
  ) => {
    const total = m.variations.length;
    if (total < 2) return;
    // APG Tabs (manual activation) — modo NÃO-WRAP:
    // ArrowRight/Down no último índice e ArrowLeft/Up no primeiro NÃO ciclam.
    // Home/End sempre saltam para os extremos.
    let nextIndex: number | null = null;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      if (currentIndex >= total - 1) {
        e.preventDefault(); // consome a tecla mas mantém foco
        return;
      }
      nextIndex = currentIndex + 1;
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      if (currentIndex <= 0) {
        e.preventDefault();
        return;
      }
      nextIndex = currentIndex - 1;
    } else if (e.key === 'Home') {
      nextIndex = 0;
    } else if (e.key === 'End') {
      nextIndex = total - 1;
    }
    if (nextIndex === null) return;
    e.preventDefault();
    m.setActiveVariation(nextIndex);
    refs.current[nextIndex]?.focus();
  };

  const totalVariations = m.variations.length;
  const liveAnnouncement =
    totalVariations > 1
      ? `Variação ${m.activeVariation + 1} de ${totalVariations} selecionada`
      : '';

  return (
    <div className="space-y-3 lg:sticky lg:top-4 lg:self-start">
      {/* Live region para leitores de tela: anuncia troca de variação (WCAG 4.1.3) */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
        data-testid="magic-up-variation-live-region"
      >
        {liveAnnouncement}
      </div>

      {m.variations.length > 1 && (
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            size="icon"
            aria-label="Voltar"
            className="h-8 w-8 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:bg-muted disabled:text-muted-foreground disabled:opacity-100"
            disabled={m.activeVariation === 0}
            onClick={() => m.setActiveVariation(m.activeVariation - 1)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <TooltipProvider>
            <div
              className="flex flex-wrap items-center justify-center gap-3"
              role="tablist"
              aria-label="Variações geradas"
              data-testid="magic-up-dots-container"
            >
              {m.variations.map((_, i) => (
                <Tooltip key={i}>
                  <TooltipTrigger asChild>
                    <button
                      ref={(el) => {
                        dotRefs.current[i] = el;
                      }}
                      onClick={() => m.setActiveVariation(i)}
                      onKeyDown={(e) => handleArrowKey(e, i, dotRefs)}
                      aria-label={`Selecionar variação ${i + 1}`}
                      aria-describedby={`magic-up-dot-tooltip-${i}`}
                      aria-current={i === m.activeVariation ? 'true' : undefined}
                      aria-keyshortcuts="ArrowLeft ArrowRight ArrowUp ArrowDown Home End"
                      role="tab"
                      aria-selected={i === m.activeVariation}
                      tabIndex={i === m.activeVariation ? 0 : -1}
                      className="group relative -mx-[18px] -my-[18px] inline-flex h-11 min-h-11 w-11 min-w-11 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                    >
                      <span
                        aria-hidden="true"
                        className={cn(
                          'block h-2 rounded-full transition-all',
                          i === m.activeVariation
                            ? 'w-6 bg-primary'
                            : 'w-2 bg-muted-foreground/30 group-hover:bg-muted-foreground/50',
                        )}
                      />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent id={`magic-up-dot-tooltip-${i}`} side="top">
                    Variação {i + 1}
                  </TooltipContent>
                </Tooltip>
              ))}
            </div>
          </TooltipProvider>
          <Button
            variant="outline"
            size="icon"
            aria-label="Avançar"
            className="h-8 w-8 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:bg-muted disabled:text-muted-foreground disabled:opacity-100"
            disabled={m.activeVariation === m.variations.length - 1}
            onClick={() => m.setActiveVariation(m.activeVariation + 1)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      <AdImageResult
        imageUrl={m.currentVariation?.imageUrl || null}
        isLoading={m.generating}
        productName={m.selectedProduct?.name}
        sceneName={m.selectedScene?.title}
        onDownload={m.handleDownload}
        onShare={m.handleShare}
        onRegenerate={m.handleGenerate}
        onToggleFavorite={m.currentVariation?.id ? m.handleToggleFavorite : undefined}
        isFavorite={m.currentVariation?.isFavorite}
        history={m.history}
        onSelectHistory={m.handleSelectHistory}
        onDeleteHistory={m.handleDeleteHistory}
        onToggleHistoryFavorite={m.handleToggleHistoryFavorite}
        qualityScore={m.qualityScore}
        qualityDiagnosis={m.currentVariation?.qualityDiagnosis || m.qualityDiagnosis}
        curationStatus={m.currentVariation?.curationStatus || m.curationStatus}
        onSetCurationStatus={m.handleSetCurationStatus}
        onRunQualityScore={m.handleRunQualityScore}
        copyPack={m.copyPack}
        aspectRatio={m.creativeControls.aspectRatio}
      />

      <MagicUpVariationComparator
        variations={m.variations}
        activeIndex={m.activeVariation}
        onSelect={m.setActiveVariation}
        onSelectWinner={m.handleSelectWinningVariation}
      />

      {m.variations.length > 1 && (
        <div
          className="flex gap-2 overflow-x-auto pb-1"
          role="tablist"
          aria-label="Miniaturas das variações"
        >
          {m.variations.map((v, i) => (
            <button
              key={i}
              ref={(el) => {
                thumbRefs.current[i] = el;
              }}
              onClick={() => m.setActiveVariation(i)}
              onKeyDown={(e) => handleArrowKey(e, i, thumbRefs)}
              aria-label={`Abrir miniatura da variação ${i + 1}`}
              aria-keyshortcuts="ArrowLeft ArrowRight ArrowUp ArrowDown Home End"
              role="tab"
              aria-selected={i === m.activeVariation}
              tabIndex={i === m.activeVariation ? 0 : -1}
              className={cn(
                'h-16 w-16 shrink-0 overflow-hidden rounded-lg border-2 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                i === m.activeVariation
                  ? 'border-primary ring-2 ring-primary/20'
                  : 'border-border hover:border-primary/40',
              )}
            >
              <img
                src={v.imageUrl}
                alt={`Variação ${i + 1}`}
                className="h-full w-full object-cover"
                loading="lazy"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
