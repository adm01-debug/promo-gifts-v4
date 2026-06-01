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

  const { localPlaceholder, detectionRule } = useMemo(() => {
    if (lqip || !src) return { localPlaceholder: null, detectionRule: 'none' };

    if (src.includes('imagedelivery.net')) {
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

  useEffect(() => {
    if (onDetection && detectionRule !== 'none') {
      onDetection(detectionRule);
    }
  }, [detectionRule, onDetection]);

  useEffect(() => {
    if (priority || !('IntersectionObserver' in window)) {
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
      { rootMargin: '50px' },
    );
    if (imgRef.current) observer.observe(imgRef.current);
    return () => observer.disconnect();
  }, [priority]);

  const blurStyle: React.CSSProperties = {
    filter: `blur(${blurAmount}px)`,
    transform: `scale(${zoomAmount})`,
    transition: `opacity ${duration}ms ease-out, filter ${duration}ms ease-out, transform ${duration}ms ease-out`,
  };

  const loadedStyle: React.CSSProperties = {
    filter: 'blur(0px)',
    transform: 'scale(1)',
    transition: `opacity ${duration}ms ease-out, filter ${duration}ms ease-out, transform ${duration}ms ease-out`,
  };

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
            'absolute inset-0 flex items-center justify-center bg-muted/20',
            fallbackClassName,
          )}
        >
          <ImageOff className="h-8 w-8 text-muted-foreground/40" />
        </div>
      ) : (
        <>
          {(lqip || localPlaceholder) && !isLoaded && !error && (
            <img
              src={lqip ?? localPlaceholder ?? ''}
              alt=""
              aria-hidden="true"
              className={cn(
                'absolute inset-0 h-full w-full object-contain',
                isLoaded ? 'opacity-0' : 'opacity-100',
              )}
              style={blurStyle}
            />
          )}

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
              ...loadedStyle,
              ...externalStyle,
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
