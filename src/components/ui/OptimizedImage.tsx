import React, { useState, useEffect, useRef, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { ImageOff, Loader2 } from 'lucide-react';

interface OptimizedImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  fallbackClassName?: string;
  containerClassName?: string;
  priority?: boolean;
  blurAmount?: number;
  zoomAmount?: number;
  duration?: number;
  lqip?: string;
  debug?: boolean;
  onDetection?: (rule: string) => void;
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
  priority = false,
  blurAmount = 20,
  zoomAmount = 1.1,
  duration = 700,
  lqip,
  debug = false,
  onLoad: onLoadProp,
  onError: onErrorProp,
  ...props
}: OptimizedImageProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState(false);
  const [isInView, setIsInView] = useState(priority);
  const imgRef = useRef<HTMLImageElement>(null);

  // Generate a local blurred placeholder if no lqip is provided
  const { localPlaceholder, detectionRule } = useMemo(() => {
    if (lqip || !src) return { localPlaceholder: null, detectionRule: 'none' };
    
    // Cloudflare Images (imagedelivery.net)
    if (src.includes('imagedelivery.net')) {
      // Handle URLs with query strings or trailing slashes
      // Standard: https://imagedelivery.net/<hash>/<id>/<variant>
      let baseUrl = src.split('?')[0];
      if (baseUrl.endsWith('/')) {
        baseUrl = baseUrl.slice(0, -1);
      }
      
      const thumbUrl = baseUrl.replace(/\/[^/]+$/, '/thumbnail');
      
      if (debug || process.env.NODE_ENV === 'development') {
        console.info(`[OptimizedImage] Cloudflare Image detected. Rule: CF_VARIANT_REPLACEMENT. Generated thumbnail: ${thumbUrl}`);
      }
      return { localPlaceholder: thumbUrl, detectionRule: 'cloudflare' };
    }

    // If it's an Unsplash image, we can get a tiny version for LQIP
    if (src.includes('unsplash.com')) {
      const url = new URL(src);
      url.searchParams.set('w', '50');
      url.searchParams.set('q', '10');
      url.searchParams.set('blur', '10');
      const thumbUrl = url.toString();
      if (debug || process.env.NODE_ENV === 'development') {
        console.info(`[OptimizedImage] Unsplash Image detected. Rule: UNSPLASH_PARAMS. Generated thumbnail: ${thumbUrl}`);
      }
      return { localPlaceholder: thumbUrl, detectionRule: 'unsplash' };
    }
    
    // If it's a Supabase storage image
    if (src.includes('/storage/v1/object/public/')) {
      const thumbUrl = `${src}${src.includes('?') ? '&' : '?'}width=50&quality=10`;
      if (debug || process.env.NODE_ENV === 'development') {
        console.info(`[OptimizedImage] Supabase Storage detected. Rule: SUPABASE_TRANSFORM. Generated thumbnail: ${thumbUrl}`);
      }
      return { localPlaceholder: thumbUrl, detectionRule: 'supabase' };
    }

    return { localPlaceholder: null, detectionRule: 'generic' };
  }, [lqip, src, debug]);

  useEffect(() => {
    if (priority) {
      setIsInView(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      { rootMargin: '200px' },
    );

    if (imgRef.current) {
      observer.observe(imgRef.current);
    }

    return () => observer.disconnect();
  }, [src, priority]);

  return (
    <div 
      className={cn('relative overflow-hidden bg-white', containerClassName)}
      data-detection-rule={detectionRule}
      style={{ 
        aspectRatio: props.width && props.height ? `${props.width}/${props.height}` : 'auto'
      } as React.CSSProperties}
    >
      {error ? (
        <div
          className={cn(
            'flex h-full w-full items-center justify-center bg-muted/30 text-muted-foreground transition-opacity duration-300',
            fallbackClassName,
          )}
        >
          <div className="flex flex-col items-center gap-2">
            <ImageOff className="h-8 w-8 opacity-20" />
            <span className="text-xs font-medium opacity-40">Erro ao carregar</span>
          </div>
        </div>
      ) : (
        <>
          {/* Low Quality Image Preview (LQIP) or Local Fallback */}
          {(lqip || localPlaceholder) && !isLoaded && !error && (
            <img
              src={lqip || localPlaceholder!}
              alt=""
              aria-hidden="true"
              className={cn(
                "absolute inset-0 h-full w-full object-cover transition-opacity duration-300",
                "opacity-100"
              )}
              style={{ 
                filter: `blur(${blurAmount}px)`,
                transform: `scale(${zoomAmount})`,
              }}
            />
          )}

          {/* Loading Shimmer - only if no LQIP */}
          {!isLoaded && !lqip && !localPlaceholder && (
            <div
              aria-hidden
              className="absolute inset-0 z-10 flex items-center justify-center bg-muted/10 animate-pulse"
            >
              <Loader2 className="h-6 w-6 text-muted-foreground/20 animate-spin" />
            </div>
          )}

          <img
            ref={imgRef}
            src={isInView ? src : undefined}
            alt={alt}
            className={cn(
              'h-full w-full transition-all ease-out-expo',
              isLoaded ? 'opacity-100 scale-100 blur-0' : 'opacity-0',
              className,
            )}
            style={{ 
              transitionDuration: `${duration}ms`,
              transitionProperty: 'opacity, filter, transform',
              filter: isLoaded ? 'none' : `blur(${blurAmount}px)`,
              transform: isLoaded ? 'scale(1)' : `scale(${zoomAmount})`,
              willChange: 'opacity, filter, transform'
            }}
            onLoad={(e) => {
              setIsLoaded(true);
              onLoadProp?.(e);
            }}
            onError={(e) => {
              setError(true);
              onErrorProp?.(e);
            }}
            loading={priority ? 'eager' : 'lazy'}
            {...(priority ? { fetchpriority: 'high' } : {})}
            {...props}
          />
        </>
      )}
    </div>
  );
}
