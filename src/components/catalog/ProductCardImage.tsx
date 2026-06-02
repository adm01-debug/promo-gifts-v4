/**
 * ProductCardImage
 *
 * Exibe a imagem principal do produto no card do catálogo.
 * Quando o produto tem set_image_url (foto com todas as cores juntas),
 * faz crossfade suave para ela ao passar o mouse.
 *
 * COMPORTAMENTO:
 *   - Mouse fora  → exibe primary_image_url (imagem principal, type='main')
 *   - Mouse dentro → crossfade para set_image_url (todas as cores, type='set')
 *   - Sem set_image_url → imagem principal estática, sem efeito hover
 *
 * PERFORMANCE:
 *   - Ambas as imagens pré-carregadas pelo browser no render do card
 *   - Crossfade 100% CSS (Tailwind group/group-hover) — zero JS no hover
 *   - Zero queries extras — set_image_url já vem no SELECT do catálogo
 *
 * COBERTURA (2026-06-02):
 *   - SPOT/Stricker: ~1.163 produtos com hover
 *   - XBZ Brindes:   ~2.560 produtos com hover (d1 reclassificado)
 *   - Asia Import:   ~363 produtos com hover
 *   - Total:         ~4.086 / 6.086 (67,1%)
 *
 * USO:
 *   <ProductCardImage
 *     mainUrl={product.image_url}
 *     setUrl={product.set_image_url}
 *     alt={product.name}
 *   />
 */

import React from 'react';
import { cn } from '@/lib/utils';

/** Sufixo Cloudflare Images para tamanho público. */
const CF_PUBLIC = '/public';

/**
 * Monta a URL completa para exibição no Cloudflare Images.
 * Se a URL não tem sufixo de variante, adiciona /public.
 */
function toCfUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (
    url.startsWith('https://imagedelivery.net/') &&
    !url.match(/\/(public|thumbnail|small|medium|large)$/)
  ) {
    return url + CF_PUBLIC;
  }
  return url;
}

interface ProductCardImageProps {
  /** URL da imagem principal (type='main'). Campo products.primary_image_url. */
  mainUrl?: string | null;
  /**
   * URL da imagem de hover (type='set' — todas as cores juntas).
   * Campo products.set_image_url.
   * null/undefined = sem efeito hover (imagem estática).
   */
  setUrl?: string | null;
  /** Alt text acessível. */
  alt: string;
  /** Classe CSS adicional para o container externo. */
  className?: string;
  /** Arredondamento. Default: rounded-lg */
  rounded?: string;
  /** Aspect ratio. Default: aspect-square */
  aspect?: string;
}

export function ProductCardImage({
  mainUrl,
  setUrl,
  alt,
  className,
  rounded = 'rounded-lg',
  aspect = 'aspect-square',
}: ProductCardImageProps) {
  const mainSrc = toCfUrl(mainUrl) ?? '/placeholder.svg';
  const setSrc = toCfUrl(setUrl);
  const hasHover = Boolean(setSrc);

  return (
    <div
      className={cn(
        'product-card-img-wrapper relative overflow-hidden bg-muted/20',
        aspect,
        rounded,
        // Classe group Tailwind — ativa hover em todos os filhos
        hasHover && 'group',
        className,
      )}
    >
      {/* Imagem principal — visível por padrão, some no hover */}
      <img
        src={mainSrc}
        alt={alt}
        loading="lazy"
        decoding="async"
        className={cn(
          'absolute inset-0 h-full w-full object-contain',
          'transition-opacity duration-300 ease-in-out',
          hasHover && 'group-hover:opacity-0',
        )}
        onError={(e) => {
          (e.currentTarget as HTMLImageElement).src = '/placeholder.svg';
        }}
      />

      {/* Imagem hover (set — todas as cores) — só renderiza se existir */}
      {hasHover && setSrc && (
        <img
          src={setSrc}
          alt={`${alt} — todas as cores`}
          loading="lazy"
          decoding="async"
          className={cn(
            'absolute inset-0 h-full w-full object-contain',
            'opacity-0 transition-opacity duration-300 ease-in-out',
            'group-hover:opacity-100',
          )}
          onError={(e) => {
            // Se imagem set falhar, esconde para evitar broken image
            (e.currentTarget as HTMLImageElement).style.display = 'none';
          }}
        />
      )}
    </div>
  );
}

export default ProductCardImage;
