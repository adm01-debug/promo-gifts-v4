/**
 * HoverSetImage — Imagem principal do produto com crossfade para a foto
 * "todas as cores" (set_image_url) ao hover do card.
 *
 * Paridade com o efeito do `ProductCardImage` do Catálogo, extraído em um
 * componente reutilizável para uso em Novidades e Reposição (e qualquer
 * card futuro). Depende do parent ter a classe `group` para acionar o
 * crossfade via `group-hover:`.
 *
 * - Sem `set`: comporta-se como `<img>` normal com zoom on hover.
 * - Com `set`: a imagem principal some e a imagem set aparece em fade.
 * - Sem `primary`: renderiza ícone placeholder.
 */
import { memo } from 'react';
import { Package } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getCdnUrl } from '@/utils/image-utils';
import { OptimizedImage } from '@/components/ui/OptimizedImage';
import { getProxiedImageUrl } from '@/utils/imageProxy';

interface HoverSetImageProps {
  /** Imagem principal do produto (primary_image_url) */
  primary: string | null | undefined;
  /** Imagem com todas as cores juntas (set_image_url) — opcional */
  set?: string | null;
  /** Alt-text da imagem principal */
  alt: string;
  /** Classes extras para o <img> principal */
  primaryClassName?: string;
  /** Classes para o ícone de fallback quando não há imagem */
  fallbackIconClassName?: string;
  /** Carrega a imagem com alta prioridade (LCP) — passar true para cards above-the-fold */
  priority?: boolean;
}

export const HoverSetImage = memo(
  ({
    primary,
    set,
    alt,
    primaryClassName,
    fallbackIconClassName,
    priority = false,
  }: HoverSetImageProps) => {
    if (!primary) {
      return (
        <div className="flex h-full w-full items-center justify-center" aria-hidden="true">
          <Package className={cn('h-12 w-12 text-muted-foreground/20', fallbackIconClassName)} />
        </div>
      );
    }

    const hasSetHover = Boolean(set);

    return (
      <>
        <OptimizedImage
          src={getCdnUrl(primary, 'card')}
          urlOriginal={getProxiedImageUrl(primary) ?? null}
          alt={alt}
          className={cn(
            'object-contain transition-all duration-300 ease-out',
            'group-hover:scale-105',
            hasSetHover && 'group-hover:opacity-0',
            primaryClassName,
          )}
          containerClassName="h-full w-full"
          priority={priority}
        />
        {hasSetHover && set && (
          <img
            src={set}
            alt={`${alt} — todas as cores`}
            loading="lazy"
            decoding="async"
            className="pointer-events-none absolute inset-0 h-full w-full object-contain opacity-0 transition-opacity duration-300 ease-in-out group-hover:opacity-100"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = 'none';
            }}
          />
        )}
      </>
    );
  },
);
