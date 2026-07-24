/**
 * WordMagicBadge — badge "✨ IA" exibido no ProductCard quando Word Magic está ativo.
 * Posicionado no canto inferior esquerdo da imagem.
 */
import { memo } from 'react';
import { Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

interface WordMagicBadgeProps {
  visible: boolean;
  className?: string;
}

export const WordMagicBadge = memo(({ visible, className }: WordMagicBadgeProps) => {
  if (!visible) return null;

  return (
    <div
      className={cn(
        'absolute bottom-2 left-2 z-20 flex items-center gap-1',
        'rounded-full border border-violet-400/60 bg-violet-600/90 px-2 py-0.5',
        'text-[10px] font-semibold text-white backdrop-blur-sm',
        'shadow-lg shadow-violet-500/20',
        'transition-all duration-300 animate-in fade-in slide-in-from-bottom-1',
        className,
      )}
      role="status"
      aria-label="Texto gerado por IA ativo"
    >
      <Sparkles className="h-2.5 w-2.5" />
      <span>IA</span>
    </div>
  );
});
