/**
 * WordMagicButton — FAB circular do Word Magic para o ProductCard.
 *
 * 4 estados visuais:
 *   default    → cinza neutro, ícone livro — produto sem AI
 *   generating → roxo pulsante com spinner — gerando (~2-4s)
 *   available  → branco/borda roxa — tem AI, mostrando texto original
 *   active     → roxo sólido — mostrando texto IA
 */
import { memo } from 'react';
import { BookOpen, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface WordMagicButtonProps {
  hasEnrichment:  boolean;
  isActive:       boolean;
  isGenerating:   boolean;
  onClick:        (e: React.MouseEvent) => void;
  className?:     string;
}

export const WordMagicButton = memo(function WordMagicButton({
  hasEnrichment,
  isActive,
  isGenerating,
  onClick,
  className,
}: WordMagicButtonProps) {
  // ── Rótulos e aria ───────────────────────────────────────────────────────
  const label = isGenerating
    ? 'Gerando texto com IA…'
    : isActive
      ? 'Word Magic ativo — clique para ver o original'
      : hasEnrichment
        ? 'Ver texto gerado por IA (Word Magic)'
        : 'Gerar texto com IA (Word Magic)';

  // ── Estilo do botão ───────────────────────────────────────────────────────
  const base =
    'h-9 w-9 md:h-11 md:w-11 rounded-full shadow-lg border transition-all duration-200 min-h-[36px] min-w-[36px] md:min-h-[44px] md:min-w-[44px]';

  const stateClass = isGenerating
    ? 'border-violet-400/60 bg-violet-500/90 text-white animate-pulse'
    : isActive
      ? 'border-violet-500 bg-violet-600 text-white shadow-violet-300/50 hover:bg-violet-700 scale-105'
      : hasEnrichment
        ? 'border-violet-300/70 bg-card/95 backdrop-blur-md text-violet-500 hover:bg-violet-50 hover:scale-110 hover:shadow-xl hover:border-violet-400'
        : 'border-border/50 bg-card/95 backdrop-blur-md text-muted-foreground hover:bg-card hover:scale-110 hover:shadow-xl hover:text-violet-500';

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="secondary"
          size="icon"
          className={cn(base, stateClass, className)}
          disabled={isGenerating}
          aria-label={label}
          aria-pressed={isActive}
          data-testid="product-card-word-magic"
          data-state={isGenerating ? 'generating' : isActive ? 'active' : hasEnrichment ? 'available' : 'default'}
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            onClick(e);
          }}
        >
          {isGenerating ? (
            <Loader2 className="h-4 w-4 animate-spin md:h-5 md:w-5" />
          ) : (
            <BookOpen
              className={cn(
                'h-4 w-4 transition-all duration-300 md:h-5 md:w-5',
                isActive && 'scale-110',
              )}
            />
          )}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="left" sideOffset={8}>
        <p className="text-xs">{label}</p>
        {isActive && (
          <p className="text-[10px] text-violet-300">✨ DeepSeek V3</p>
        )}
      </TooltipContent>
    </Tooltip>
  );
});
