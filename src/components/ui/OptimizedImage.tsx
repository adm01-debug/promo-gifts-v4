import React, { useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { ImageOff } from 'lucide-react';

interface OptimizedImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  fallbackClassName?: string;
  containerClassName?: string;
}

/**
 * OptimizedImage component that handles:
 * 1. Lazy loading via native loading="lazy" and IntersectionObserver fallback
 * 2. Smooth fade-in transition when loaded
 * 3. Skeleton placeholder while loading
 * 4. Error state handling with fallback icon
 */
export function OptimizedImage({
  src,
  alt,
  className,
  fallbackClassName,
  containerClassName,
  ...props
}: OptimizedImageProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState(false);
  const [isInView, setIsInView] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      { rootMargin: '200px' } // Load slightly before it enters the viewport
    );

    if (imgRef.current) {
      observer.observe(imgRef.current);
    }

    return () => observer.disconnect();
  }, [src]);

  return (
    <div className={cn("relative overflow-hidden bg-muted/20", containerClassName)}>
      {!isLoaded && !error && (
        <Skeleton className="absolute inset-0 z-0 h-full w-full" />
      )}
      
      {error ? (
        <div className={cn("flex h-full w-full items-center justify-center bg-muted/50 text-muted-foreground", fallbackClassName)}>
          <ImageOff className="h-6 w-6 opacity-20" />
        </div>
      ) : (
        <img
          ref={imgRef}
          src={isInView ? src : undefined}
          alt={alt}
          className={cn(
            "h-full w-full object-cover transition-opacity duration-500",
            isLoaded ? "opacity-100" : "opacity-0",
            className
          )}
          onLoad={() => setIsLoaded(true)}
          onError={() => setError(true)}
          loading="lazy"
          {...props}
        />
      )}
    </div>
  );
}
