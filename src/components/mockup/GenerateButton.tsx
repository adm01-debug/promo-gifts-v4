/**
 * GenerateButton — CTA dedicado para disparar a geração de mockup com IA.
 * Apresenta estados de loading, disabled e pulse de destaque quando pronto.
 */
import { Button } from '@/components/ui/button';
import { Sparkles, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { m as motion } from 'framer-motion';
import { useReducedMotion } from '@/hooks/ui/useReducedMotion';

interface GenerateButtonProps {
  onClick: () => void;
  isGenerating: boolean;
  disabled?: boolean;
  hasAllRequirements?: boolean;
  label?: string;
  className?: string;
}

export function GenerateButton({
  onClick,
  isGenerating,
  disabled = false,
  hasAllRequirements = true,
  label = 'Gerar Mockup com IA',
  className,
}: GenerateButtonProps) {
  const isReady = hasAllRequirements && !disabled && !isGenerating;
  const reducedMotion = useReducedMotion();

  return (
    <motion.div
      whileHover={isReady && !reducedMotion ? { scale: 1.02 } : undefined}
      whileTap={isReady && !reducedMotion ? { scale: 0.98 } : undefined}
      className={cn('relative', className)}
    >
      {isReady && (
        <motion.span
          aria-hidden
          className="absolute inset-0 rounded-md bg-primary/40 blur-md"
          animate={reducedMotion ? { opacity: 0.5 } : { opacity: [0.3, 0.7, 0.3] }}
          transition={reducedMotion ? { duration: 0 } : { duration: 2, repeat: Infinity }}
        />
      )}
      <Button
        type="button"
        size="lg"
        onClick={onClick}
        disabled={disabled || isGenerating}
        data-testid="mockup-generate-button"
        className={cn(
          'relative w-full font-semibold',
          isReady && 'bg-gradient-to-r from-primary to-primary/80 shadow-lg',
        )}
      >
        {isGenerating ? (
          <>
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Gerando…
          </>
        ) : (
          <>
            <Sparkles className="mr-2 h-5 w-5" />
            {label}
          </>
        )}
      </Button>
    </motion.div>
  );
}
