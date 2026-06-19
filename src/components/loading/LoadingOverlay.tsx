import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';
import { LiveRegion } from '@/components/a11y';

const LOADING_VARIANT_CLASSES = {
  fullscreen: 'fixed inset-0 z-[100]',
  container: 'absolute inset-0 z-50',
  inline: 'flex items-center justify-center p-4',
} as const;

const SPINNER_SIZE_CLASSES = {
  sm: 'h-4 w-4',
  md: 'h-6 w-6',
  lg: 'h-8 w-8',
} as const;

interface LoadingOverlayProps {
  isLoading: boolean;
  message?: string;
  variant?: 'fullscreen' | 'container' | 'inline';
  blur?: boolean;
  className?: string;
}

export function LoadingOverlay({
  isLoading,
  message = 'Carregando...',
  variant = 'container',
  blur = true,
  className,
}: LoadingOverlayProps) {
  if (!isLoading) return null;

  return (
    <>
      <div
        className={cn(
          'animate-fade-in',
          LOADING_VARIANT_CLASSES[variant],
          variant !== 'inline' && 'flex items-center justify-center',
          variant !== 'inline' && blur && 'bg-background/60 backdrop-blur-sm',
          className,
        )}
        role="progressbar"
        aria-valuetext={message}
        aria-busy="true"
      >
        <div
          className={cn(
            'flex animate-scale-in flex-col items-center gap-3',
            variant !== 'inline' && 'rounded-2xl border bg-card/80 p-6 shadow-xl backdrop-blur-md',
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
        </div>
      </div>

      <LiveRegion politeness="polite">{message}</LiveRegion>
    </>
  );
}

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function Spinner({ size = 'md', className }: SpinnerProps) {
  return (
    <Loader2
      className={cn('animate-spin text-primary', SPINNER_SIZE_CLASSES[size], className)}
      aria-hidden="true"
    />
  );
}

export function LoadingDots({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center gap-1', className)} aria-label="Carregando...">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="h-2 w-2 animate-bounce rounded-full bg-primary"
          style={{ animationDelay: `${i * 0.15}s` }}
        />
      ))}
    </div>
  );
}

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
          <div className="h-full w-1/3 animate-[indeterminate-progress_1.5s_ease-in-out_infinite] rounded-full bg-primary" />
        ) : (
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-300"
            style={{ width: `${progress}%` }}
          />
        )}
      </div>
      {!indeterminate && (
        <p className="text-right text-xs text-muted-foreground">{Math.round(progress)}%</p>
      )}
    </div>
  );
}
