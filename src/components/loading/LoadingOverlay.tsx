import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { LiveRegion } from '@/components/a11y';

interface LoadingOverlayProps {
  isLoading: boolean;
  message?: string;
  variant?: 'fullscreen' | 'container' | 'inline';
  blur?: boolean;
  className?: string;
}

/**
 * Versatile loading overlay component
 * - fullscreen: covers entire viewport
 * - container: covers parent container
 * - inline: simple inline loader
 */
export function LoadingOverlay({
  isLoading,
  message = 'Carregando...',
  variant = 'container',
  blur = true,
  className,
}: LoadingOverlayProps) {
  const variants = {
    fullscreen: 'fixed inset-0 z-[100]',
    container: 'absolute inset-0 z-50',
    inline: 'flex items-center justify-center p-4',
  };

  return (
    <AnimatePresence>
      {isLoading && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className={cn(
              variants[variant],
              variant !== 'inline' && 'flex items-center justify-center',
              variant !== 'inline' && blur && 'bg-background/60 backdrop-blur-sm',
              className,
            )}
            role="progressbar"
            aria-valuetext={message}
            aria-busy="true"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ duration: 0.2, delay: 0.1 }}
              className={cn(
                'flex flex-col items-center gap-3',
                variant !== 'inline' &&
                  'rounded-2xl border bg-card/80 p-6 shadow-xl backdrop-blur-md',
              )}
            >
              <div className="relative">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <div className="absolute inset-0 h-8 w-8 animate-ping opacity-20">
                  <Loader2 className="h-8 w-8 text-primary" />
                </div>
              </div>
              {message && (
                <p className="animate-pulse text-sm font-medium text-muted-foreground">{message}</p>
              )}
            </motion.div>
          </motion.div>

          {/* Screen reader announcement */}
          <LiveRegion politeness="polite">{message}</LiveRegion>
        </>
      )}
    </AnimatePresence>
  );
}

// Simple spinner component
interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function Spinner({ size = 'md', className }: SpinnerProps) {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-6 w-6',
    lg: 'h-8 w-8',
  };

  return (
    <Loader2
      className={cn('animate-spin text-primary', sizeClasses[size], className)}
      aria-hidden="true"
    />
  );
}

// Dots loading indicator
export function LoadingDots({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center gap-1', className)} aria-label="Carregando...">
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          className="h-2 w-2 rounded-full bg-primary"
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.5, 1, 0.5],
          }}
          transition={{
            duration: 0.8,
            repeat: Infinity,
            delay: i * 0.2,
          }}
        />
      ))}
    </div>
  );
}

// Progress bar loading
interface ProgressLoaderProps {
  progress?: number;
  indeterminate?: boolean;
  message?: string;
  className?: string;
}

export function ProgressLoader({
  progress = 0,
  indeterminate = false,
  message,
  className,
}: ProgressLoaderProps) {
  return (
    <div className={cn('space-y-2', className)}>
      {message && <p className="text-sm text-muted-foreground">{message}</p>}
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        {indeterminate ? (
          <motion.div
            className="h-full w-1/3 rounded-full bg-primary"
            animate={{
              x: ['-100%', '400%'],
            }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          />
        ) : (
          <motion.div
            className="h-full rounded-full bg-primary"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.3 }}
          />
        )}
      </div>
      {!indeterminate && (
        <p className="text-right text-xs text-muted-foreground">{Math.round(progress)}%</p>
      )}
    </div>
  );
}
