import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

interface LoadingOverlayProps {
  isLoading: boolean;
  message?: string;
  fullScreen?: boolean;
  blur?: boolean;
  className?: string;
  spinnerSize?: 'lg' | 'md' | 'sm';
  variant?: 'card' | 'default' | 'inline';
}

const spinnerSizes = {
  sm: 'h-4 w-4',
  md: 'h-8 w-8',
  lg: 'h-12 w-12',
};

export function LoadingOverlay({
  isLoading,
  message,
  fullScreen = false,
  blur = true,
  className,
  spinnerSize = 'md',
  variant = 'default',
}: LoadingOverlayProps) {
  if (!isLoading) return null;

  const overlayVariants = {
    card: 'absolute inset-0 rounded-lg z-10',
    inline: 'inline-flex items-center gap-2',
    default: fullScreen ? 'fixed inset-0 z-50' : 'absolute inset-0 z-10',
  };

  if (variant === 'inline') {
    return (
      <div
        className={cn(
          'inline-flex animate-fade-in items-center gap-2 text-muted-foreground',
          className,
        )}
      >
        <Loader2 className={cn('animate-spin', spinnerSizes[spinnerSize])} />
        {message && <span className="text-sm">{message}</span>}
      </div>
    );
  }

  return (
    <div
      className={cn(
        'animate-fade-in',
        overlayVariants[variant],
        blur && 'backdrop-blur-sm',
        'flex items-center justify-center bg-background/80',
        className,
      )}
    >
      <div className="flex animate-scale-in flex-col items-center gap-3">
        <div className="relative">
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
          <p className="animate-fade-in text-sm font-medium text-muted-foreground">{message}</p>
        )}
      </div>
    </div>
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
  size?: 'md' | 'sm';
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
