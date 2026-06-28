import { useState } from 'react';
import { Package } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ProductThumbProps {
  src?: string | null;
  alt?: string;
  /** Tailwind size classes, e.g. "h-[68px] w-[68px]". Must include both h and w. */
  sizeClassName: string;
  className?: string;
  /** Border radius class. Default: rounded-md */
  roundedClassName?: string;
  /** Custom icon size class for fallback. */
  iconClassName?: string;
  'data-testid'?: string;
}

/**
 * Thumb unificado de produto para QuoteView.
 * - Mantém aspect ratio fixo via h/w (anti-distorção).
 * - Estado de loading com skeleton (mesma área → zero layout shift).
 * - Placeholder com ícone quando não há imagem ou erro.
 */
export function ProductThumb({
  src,
  alt = '',
  sizeClassName,
  className,
  roundedClassName = 'rounded-md',
  iconClassName = 'h-5 w-5',
  'data-testid': testId,
}: ProductThumbProps) {
  const [loaded, setLoaded] = useState(false);
  const [errored, setErrored] = useState(false);
  const hasImage = Boolean(src) && !errored;

  return (
    <div
      className={cn(
        'relative shrink-0 overflow-hidden border border-border bg-muted',
        sizeClassName,
        roundedClassName,
        className,
      )}
      data-testid={testId}
    >
      {hasImage ? (
        <>
          {!loaded && (
            <div
              aria-hidden="true"
              className="absolute inset-0 animate-pulse bg-muted"
              data-testid={testId ? `${testId}-skeleton` : undefined}
            />
          )}
          <img
            src={src ?? undefined}
            alt={alt}
            className={cn(
              'h-full w-full object-cover transition-opacity duration-200',
              loaded ? 'opacity-100' : 'opacity-0',
            )}
            loading="lazy"
            decoding="async"
            onLoad={() => setLoaded(true)}
            onError={() => setErrored(true)}
          />
        </>
      ) : (
        <div
          className="flex h-full w-full items-center justify-center text-muted-foreground"
          aria-hidden="true"
          data-testid={testId ? `${testId}-placeholder` : undefined}
        >
          <Package className={iconClassName} />
        </div>
      )}
    </div>
  );
}
