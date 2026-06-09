import React, { useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { ImageOff } from 'lucide-react';

interface OptimizedImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  fallbackClassName?: string;
  containerClassName?: string;
  priority?: boolean;
  /**
   * URL de fallback (CDN do fornecedor / url_original).
   * Se a src principal (CF Images) falhar, tenta esta URL antes de mostrar ícone.
   * Double-guard: se o fallback também falhar → mostra <ImageOff />.
   * Não dispara para /placeholder.svg (evita loop).
   */
  urlOriginal?: string | null;
}

/**
 * OptimizedImage — image component with:
 * 1. Lazy loading (native + IntersectionObserver fallback)
 * 2. Smooth fade-in on load
 * 3. Skeleton placeholder while loading
 * 4. Double-fallback: CF URL → urlOriginal (supplier origin) → <ImageOff />
 */
export function OptimizedImage({
  src,
  alt,
  className,
  fallbackClassName,
  containerClassName,
  priority = false,
  urlOriginal,
  ...props
}: OptimizedImageProps) {
  // 0 = primary (CF), 1 = urlOriginal, 2 = error (show icon)
  const [fallbackStage, setFallbackStage] = useState<0 | 1 | 2>(0);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isInView, setIsInView] = useState(priority);
  const imgRef = useRef<HTMLImageElement>(null);

  // Reset state when src changes (e.g. color variant change)
  useEffect(() => {
    setFallbackStage(0);
    setIsLoaded(false);
  }, [src]);

  useEffect(() => {
    if (priority) { setIsInView(true); return; }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) { setIsInView(true); observer.disconnect(); }
      },
      { rootMargin: '200px' }
    );
    if (imgRef.current) observer.observe(imgRef.current);
    return () => observer.disconnect();
  }, [src, priority]);

  // Determine active src for current stage
  const activeSrc: string | undefined = (() => {
    if (!isInView) return undefined;
    if (fallbackStage === 0) return src;
    if (fallbackStage === 1) return urlOriginal ?? undefined;
    return undefined; // stage 2 = icon
  })();

  const handleError = () => {
    if (fallbackStage === 0 && urlOriginal && !urlOriginal.includes('/placeholder')) {
      // CF failed → try supplier origin
      setFallbackStage(1);
      setIsLoaded(false);
    } else {
      // Origin also failed (or no fallback) → show icon
      setFallbackStage(2);
    }
  };

  const isError = fallbackStage === 2;

  return (
    <div className={cn('relative overflow-hidden bg-muted/20', containerClassName)}>
      {!isLoaded && !isError && (
        <Skeleton className="absolute inset-0 z-0 h-full w-full" />
      )}

      {isError ? (
        <div className={cn(
          'flex h-full w-full items-center justify-center bg-muted/50 text-muted-foreground',
          fallbackClassName
        )}>
          <ImageOff className="h-6 w-6 opacity-20" />
        </div>
      ) : (
        <img
          ref={imgRef}
          src={activeSrc}
          alt={alt}
          className={cn(
            'h-full w-full object-cover transition-opacity duration-500',
            isLoaded ? 'opacity-100' : 'opacity-0',
            className
          )}
          onLoad={() => setIsLoaded(true)}
          onError={handleError}
          loading={priority ? 'eager' : 'lazy'}
          {...(priority ? { fetchpriority: 'high' } as any : {})}
          {...props}
        />
      )}
    </div>
  );
}
