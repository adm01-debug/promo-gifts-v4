import React, { useState, useEffect, useRef, useMemo } from 'react';
import { cn } from '@/lib/utils';
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
 * 3. Blur-up (LQIP) placeholder while loading
 * 4. Error state handling with fallback icon
 * 5. Auto-detection of CDN provider (Cloudflare, Unsplash, Supabase) for placeholder generation
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
  onDetection,
  onLoad: onLoadProp,
  onError: onErrorProp,
  style: externalStyle,
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
        // eslint-disable-next-line no-console
        console.info(
          `[OptimizedImage] Cloudflare Image detected. Rule: CF_VARIANT_REPLACEMENT. Generated thumbnail: ${thumbUrl}`,
        );
      }
      return { localPlaceholder: thumbUrl, detectionRule: 'cloudflare' };
    }

    // Unsplash — tiny LQIP via query params
    if (src.includes('unsplash.com')) {
      const url = new URL(src);
      url.searchParams.set('w', '50');
      url.searchParams.set('q', '10');
      url.searchParams.set('blur', '10');
      const thumbUrl = url.toString();
      if (debug || process.env.NODE_ENV === 'development') {
        // eslint-disable-next-line no-console
        console.info(
          `[OptimizedImage] Unsplash Image detected. Rule: UNSPLASH_PARAMS. Generated thumbnail: ${thumbUrl}`,
        );
      }
      return { localPlaceholder: thumbUrl, detectionRule: 'unsplash' };
    }

    // Supabase Storage
    if (src.includes('/storage/v1/object/public/')) {
      const thumbUrl = `${src}${src.includes('?') ? '&' : '?'}width=50&quality=10`;
      if (debug || process.env.NODE_ENV === 'development') {
        // eslint-disable-next-line no-console
        console.info(
          `[OptimizedImage] Supabase Storage detected. Rule: SUPABASE_TRANSFORM. Generated thumbnail: ${thumbUrl}`,
        );
      }
      return { localPlaceholder: thumbUrl, detectionRule: 'supabase' };
    }

    return { localPlaceholder: null, detectionRule: 'generic' };
  }, [lqip, src, debug]);

  // Fire detection callback only when detectionRule changes.
  // onDetection is intentionally excluded from deps: callers often pass
  // inline arrow functions (new ref on every render) which would cause
  // double-firing. The callback is stable-enough within a detectionRule cycle.
  useEffect(() => {
    onDetection?.(detectionRule);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detectionRule]);

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
      style={
        {
          aspectRatio: props.width && props.height ? `${props.width}/${props.height}` : 'auto',
        } as React.CSSProperties
      }
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
          {/* Low Quality Image Preview (LQIP) or Auto-Generated Placeholder */}
          {(lqip || localPlaceholder) && !isLoaded && !error && (
            <img
              src={lqip ?? localPlaceholder ?? ''}
              alt=""
              aria-hidden="true"
              className={cn(
                'absolute inset-0 h-full w-full object-cover transition-opacity duration-300',
                'opacity-100',
              )}
              style={{
                filter: `blur(${blurAmount}px)`,
                transform: `scale(${zoomAmount})`,
              }}
            />
          )}

          {/* Loading Shimmer — only if no LQIP/placeholder */}
          {!isLoaded && !lqip && !localPlaceholder && (
            <div
              aria-hidden
              className="absolute inset-0 z-10 flex animate-pulse items-center justify-center bg-muted/10"
            >
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground/20" />
            </div>
          )}

          <img
            ref={imgRef}
            src={isInView ? src : undefined}
            alt={alt}
            className={cn(
              'h-full w-full transition-all ease-out',
              isLoaded ? 'scale-100 opacity-100 blur-0' : 'opacity-0',
              className,
            )}
            style={{
              transitionDuration: `${duration}ms`,
              transitionProperty: 'opacity, filter, transform',
              filter: isLoaded ? 'none' : `blur(${blurAmount}px)`,
              transform: isLoaded ? 'scale(1)' : `scale(${zoomAmount})`,
              willChange: 'opacity, filter, transform',
              // External style merged only after animation completes to prevent
              // overriding blur-up effect during load. When called from
              // ProductCardImage, externalStyle is undefined until imageLoaded=true,
              // which is batched with isLoaded=true — no mid-animation conflict.
              ...(isLoaded ? (externalStyle ?? {}) : {}),
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
