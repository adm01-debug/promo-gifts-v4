import React, { useState, useEffect, useRef, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { ImageOff, Loader2 } from 'lucide-react';
import { getBlurhashDominantColor } from '@/utils/image-utils';

interface OptimizedImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  fallbackClassName?: string;
  containerClassName?: string;
  priority?: boolean;
  blurAmount?: number;
  zoomAmount?: number;
  duration?: number;
  lqip?: string;
  /** String blurhash do banco. Extrai cor dominante como CSS placeholder sem libs externas. */
  blurhash?: string | null;
  debug?: boolean;
  onDetection?: (rule: string) => void;
  /** URL de fallback (origem do fornecedor) tentada quando a src do CF Images falha, antes do ícone de erro. */
  urlOriginal?: string | null;
}

export function OptimizedImage({
  src,
  alt,
  className,
  fallbackClassName,
  containerClassName,
  priority = false,
  blurAmount = 15,
  zoomAmount = 1.05,
  duration = 400,
  lqip,
  blurhash,
  debug = false,
  onDetection,
  urlOriginal,
  onLoad: onLoadProp,
  onError: onErrorProp,
  style: externalStyle,
  ...props
}: OptimizedImageProps) {
  const blurhashColor = useMemo(() => getBlurhashDominantColor(blurhash), [blurhash]);
  const [isLoaded, setIsLoaded] = useState(false);
  // 0 = src primaria (CF) | 1 = urlOriginal (origem fornecedor) | 2 = erro (icone)
  const [fallbackStage, setFallbackStage] = useState<0 | 1 | 2>(0);
  const error = fallbackStage === 2;
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
    transitionProperty: 'opacity, filter, transform',
    transitionDuration: `${duration}ms`,
    transitionTimingFunction: 'ease-out',
  };

  const loadedStyle: React.CSSProperties = {
    filter: 'none',
    transform: 'scale(1)',
    transitionProperty: 'opacity, filter, transform',
    transitionDuration: `${duration}ms`,
    transitionTimingFunction: 'ease-out',
  };

  // Reinicia a cadeia de fallback quando a src primaria muda (ex.: variante de cor)
  useEffect(() => {
    setFallbackStage(0);
    setIsLoaded(false);
  }, [src]);

  const activeSrc = !isInView
    ? undefined
    : fallbackStage === 0
      ? src
      : fallbackStage === 1
        ? (urlOriginal ?? undefined)
        : undefined;

  const handleImageError: React.ReactEventHandler<HTMLImageElement> = (e) => {
    if (fallbackStage === 0 && urlOriginal && !urlOriginal.includes('/placeholder')) {
      setFallbackStage(1);
      setIsLoaded(false);
    } else {
      setFallbackStage(2);
    }
    onErrorProp?.(e);
  };

  return (
    <div
      className={cn('relative overflow-hidden bg-white', containerClassName)}
      data-detection-rule={detectionRule}
      style={{
        aspectRatio: props.width && props.height ? `${props.width}/${props.height}` : 'auto',
        contain: 'layout paint',
        backgroundColor: !isLoaded && blurhashColor ? blurhashColor : undefined,
        transition: 'background-color 0.3s ease',
      }}
    >
      {error ? (
        <div
          className={cn(
            'absolute inset-0 flex flex-col items-center justify-center gap-1 bg-muted/20',
            fallbackClassName,
          )}
        >
          <ImageOff className="h-8 w-8 text-muted-foreground/40" />
          <span className="text-xs text-muted-foreground/60">Erro ao carregar</span>
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
            src={activeSrc}
            alt={alt}
            className={cn(
              'h-full w-full transition-all ease-out',
              isLoaded ? 'scale-100 opacity-100 blur-0' : 'opacity-0',
              className,
            )}
            style={{
              ...(isLoaded ? loadedStyle : blurStyle),
              ...externalStyle,
            }}
            onLoad={(e) => {
              setIsLoaded(true);
              onLoadProp?.(e);
            }}
            onError={handleImageError}
            loading={priority ? 'eager' : 'lazy'}
            decoding={priority ? 'sync' : 'async'}
            {...(priority ? { fetchpriority: 'high' } : {})}
            {...props}
          />
        </>
      )}
    </div>
  );
}
