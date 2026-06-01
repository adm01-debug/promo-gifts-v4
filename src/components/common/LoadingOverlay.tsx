import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface LoadingOverlayProps {
  isLoading: boolean;
  message?: string;
  fullScreen?: boolean;
  blur?: boolean;
  className?: string;
  spinnerSize?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'card' | 'inline';
}

const spinnerSizes = {
  sm: 'h-4 w-4',
  md: 'h-8 w-8',
  lg: 'h-12 w-12',
};

/**
 * LoadingOverlay - Overlay de carregamento com diferentes variantes
 *
 * @example
 * // Full screen loading
 * <LoadingOverlay isLoading={isLoading} fullScreen message="Carregando..." />
 *
 * // Card overlay
 * <div className="relative">
 *   <CardContent />
 *   <LoadingOverlay isLoading={isSaving} variant="card" />
 * </div>
 */
export function LoadingOverlay({
  isLoading,
  message,
  fullScreen = false,
  blur = true,
  className,
  spinnerSize = 'md',
  variant = 'default',
}: LoadingOverlayProps) {
  const overlayVariants = {
    card: 'absolute inset-0 rounded-lg z-10',
    inline: 'inline-flex items-center gap-2',
    default: fullScreen ? 'fixed inset-0 z-50' : 'absolute inset-0 z-10',
  };

  if (variant === 'inline') {
    return (
      <AnimatePresence>
        {isLoading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className={cn('inline-flex items-center gap-2 text-muted-foreground', className)}
          >
            <Loader2 className={cn('animate-spin', spinnerSizes[spinnerSize])} />
            {message && <span className="text-sm">{message}</span>}
          </motion.div>
        )}
      </AnimatePresence>
    );
  }

  return (
    <AnimatePresence>
      {isLoading && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className={cn(
            overlayVariants[variant],
            blur && 'backdrop-blur-sm',
            'flex items-center justify-center bg-background/80',
            className,
          )}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ delay: 0.1, duration: 0.2 }}
            className="flex flex-col items-center gap-3"
          >
            <div className="relative">
              {/* Glow effect behind spinner */}
              <div
                className={cn(
                  'absolute inset-0 animate-pulse rounded-full bg-primary/20 blur-xl',
                  spinnerSizes[spinnerSize],
                )}
              />
              <Loader2
                className={cn('relative animate-spin text-primary', spinnerSizes[spinnerSize])}
              />
            </div>
            {message && (
              <motion.p
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="text-sm font-medium text-muted-foreground"
              >
                {message}
              </motion.p>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/**
 * InlineLoader - Loader inline para botões e textos
 */
export function InlineLoader({
  className,
  size = 'sm',
}: {
  className?: string;
  size?: 'sm' | 'md';
}) {
  return (
    <Loader2 className={cn('animate-spin', size === 'sm' ? 'h-4 w-4' : 'h-5 w-5', className)} />
  );
}

/**
 * SkeletonPulse - Skeleton simples com animação de pulse
 */
export function SkeletonPulse({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-md bg-muted', className)} />;
}

export default LoadingOverlay;
