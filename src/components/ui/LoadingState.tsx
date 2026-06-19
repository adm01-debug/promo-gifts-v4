import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

interface LoadingStateProps {
  text?: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'spinner' | 'dots' | 'skeleton';
  className?: string;
}

const sizeConfig = {
  sm: { icon: 'h-4 w-4', text: 'text-sm', padding: 'p-4' },
  md: { icon: 'h-6 w-6', text: 'text-base', padding: 'p-8' },
  lg: { icon: 'h-8 w-8', text: 'text-lg', padding: 'p-12' },
};

/**
 * LoadingState - Estado de carregamento flexível
 */
export function LoadingState({
  text = 'Carregando...',
  size = 'md',
  variant = 'spinner',
  className,
}: LoadingStateProps) {
  const config = sizeConfig[size];

  if (variant === 'dots') {
    return (
      <div className={cn('flex items-center justify-center gap-1', config.padding, className)}>
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className={cn(
              'animate-bounce rounded-full bg-primary',
              size === 'sm' ? 'h-1.5 w-1.5' : size === 'md' ? 'h-2 w-2' : 'h-3 w-3',
            )}
            style={{ animationDelay: `${i * 0.1}s` }}
          />
        ))}
        {text && <span className={cn('ml-2 text-muted-foreground', config.text)}>{text}</span>}
      </div>
    );
  }

  return (
    <div
      className={cn('flex items-center justify-center', config.padding, className)}
      role="status"
      aria-label={text}
    >
      <Loader2 className={cn('mr-2 animate-spin text-primary', config.icon)} aria-hidden="true" />
      <span className={cn('text-muted-foreground', config.text)}>{text}</span>
    </div>
  );
}

/**
 * LoadingSkeleton - Skeleton com forma customizável
 */
interface LoadingSkeletonProps {
  className?: string;
  variant?: 'text' | 'circular' | 'rectangular';
  width?: string | number;
  height?: string | number;
  lines?: number;
}

export function LoadingSkeleton({
  className,
  variant = 'rectangular',
  width,
  height,
  lines = 1,
}: LoadingSkeletonProps) {
  const style = {
    width: typeof width === 'number' ? `${width}px` : width,
    height: typeof height === 'number' ? `${height}px` : height,
  };

  if (variant === 'text' && lines > 1) {
    return (
      <div className={cn('space-y-2', className)}>
        {Array.from({ length: lines }).map((_, i) => (
          <Skeleton
            key={i}
            className={cn(
              'h-4',
              i === lines - 1 && 'w-3/4', // Last line shorter
            )}
          />
        ))}
      </div>
    );
  }

  return (
    <Skeleton
      className={cn(
        variant === 'circular' && 'rounded-full',
        variant === 'text' && 'h-4',
        className,
      )}
      style={style}
    />
  );
}

/**
 * LoadingCard - Card skeleton para listas
 */
export function LoadingCard({ className }: { className?: string }) {
  return (
    <Card className={cn('animate-pulse', className)}>
      <CardHeader className="space-y-2">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
      </CardHeader>
      <CardContent className="space-y-2">
        <Skeleton className="h-20" />
        <div className="flex gap-2">
          <Skeleton className="h-8 w-20" />
          <Skeleton className="h-8 w-20" />
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * LoadingTable - Skeleton para tabelas
 */
interface LoadingTableProps {
  rows?: number;
  columns?: number;
  className?: string;
}

export function LoadingTable({ rows = 5, columns = 4, className }: LoadingTableProps) {
  return (
    <div className={cn('space-y-2', className)}>
      {/* Header */}
      <div className="flex gap-4 rounded-t-lg bg-muted/50 p-3">
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={i} className="h-4 flex-1" />
        ))}
      </div>

      {/* Rows */}
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={rowIndex} className="flex gap-4 border-b p-3 last:border-0">
          {Array.from({ length: columns }).map((_b, colIndex) => (
            <Skeleton
              key={colIndex}
              className={cn('h-4 flex-1', colIndex === 0 && 'w-1/4 flex-none')}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

/**
 * LoadingButton - Placeholder para botão em loading
 */
export function LoadingButton({ width = 100, className }: { width?: number; className?: string }) {
  return <Skeleton className={cn('h-10 rounded-md', className)} style={{ width }} />;
}
