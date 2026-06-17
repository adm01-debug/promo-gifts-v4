/**
 * ImageWithFallback — Componente de imagem reutilizável com:
 * - Variantes CDN (card, thumbnail, large, etc.)
 * - srcSet para responsive images
 * - Fallback para url_original em caso de erro de rede
 * - Lazy loading nativo
 * - Propagação de alt_text e title_text
 */

import { useState, forwardRef } from 'react';
import { getCdnUrl, getSrcSet, getImageSizes, type CdnVariant } from '@/utils/image-utils';
import { cn } from '@/lib/utils';

interface ImageWithFallbackProps extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'src'> {
  /** URL CDN da imagem (terminada em /public) */
  urlCdn: string;
  /** URL original do fornecedor (fallback para erro de rede) */
  urlOriginal?: string | null;
  /** Variante CDN a usar */
  variant?: CdnVariant;
  /** Contexto para sizes responsivo */
  context?: 'card' | 'gallery' | 'hero' | 'thumb';
  /** Habilitar srcSet responsivo */
  responsive?: boolean;
  /** Mostrar shimmer enquanto carrega */
  showShimmer?: boolean;
}

export const ImageWithFallback = forwardRef<HTMLImageElement, ImageWithFallbackProps>(
  function ImageWithFallback(
    {
      urlCdn,
      urlOriginal,
      variant = 'public',
      context,
      responsive = false,
      showShimmer: _showShimmer = true,
      className,
      alt,
      title,
      onLoad,
      onError,
      ...props
    },
    ref,
  ) {
    const [error, setError] = useState(false);
    const [loaded, setLoaded] = useState(false);

    const src = error ? urlOriginal || '/placeholder.svg' : getCdnUrl(urlCdn, variant);

    const handleError = (e: React.SyntheticEvent<HTMLImageElement>) => {
      if (!error) {
        setError(true);
      }
      onError?.(e);
    };

    const handleLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
      setLoaded(true);
      onLoad?.(e);
    };

    return (
      <div className={cn('relative overflow-hidden', className)}>
        {/* Background while loading */}
        {!loaded && <div className="absolute inset-0 bg-muted/30" />}
        <img
          ref={ref}
          src={src}
          srcSet={responsive && !error ? getSrcSet(urlCdn) : undefined}
          sizes={responsive && context ? getImageSizes(context) : undefined}
          alt={alt ?? ''}
          title={title || undefined}
          loading="lazy"
          onError={handleError}
          onLoad={handleLoad}
          className={cn(
            'h-full w-full object-cover transition-all duration-700 ease-out',
            loaded ? 'scale-100 opacity-100 blur-0' : 'scale-105 opacity-40 blur-md',
          )}
          draggable={false}
          {...props}
        />
      </div>
    );
  },
);
