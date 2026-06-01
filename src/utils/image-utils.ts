/**
 * image-utils.ts — Utilitários de imagem baseados no Briefing Técnico v3
 *
 * CDN: Cloudflare Images (100% funcional, HTTP 200 confirmado)
 * Variantes: public, large, medium, card, small, thumbnail
 *
 * REGRA CRÍTICA:
 *   is_primary = true  → imagem SET (todas as cores juntas) → Hero PDP
 *   is_og_image = true → imagem MAIN (cor individual)       → Cards, OG tags
 */

import { getProxiedImageUrl } from '@/utils/imageProxy';

// ============================================
// TIPOS
// ============================================

export type CdnVariant = 'public' | 'large' | 'medium' | 'card' | 'small' | 'thumbnail';

export type ImageTypeCode =
  | 'main'
  | 'gallery'
  | 'set'
  | 'logo'
  | 'ambient'
  | 'detail'
  | 'box'
  | 'pouch'
  | 'vitrine_pessoa'
  | 'vitrine_ambiente'
  | 'component'
  | 'location'
  | 'area'
  | 'mockup'
  | 'thumbnail'
  | 'product'
  | 'other';

export interface ProductImageMeta {
  id?: string;
  url_cdn: string;
  url_original?: string | null;
  filename?: string | null;
  image_type: string;
  is_primary: boolean;
  is_og_image?: boolean;
  applies_to_color?: boolean | null;
  supplier_code?: string | null;
  alt_text?: string | null;
  title_text?: string | null;
  display_order: number;
}

export interface CategorizedImages {
  hero: ProductImageMeta | null; // is_primary (set — todas as cores)
  main: ProductImageMeta[]; // image_type=main
  gallery: ProductImageMeta[]; // image_type=gallery
  logo: ProductImageMeta[]; // image_type=logo (com gravação)
  ambient: ProductImageMeta[]; // image_type=ambient
  packaging: ProductImageMeta[]; // box + pouch
}

// ============================================
// CDN HELPERS
// ============================================

/**
 * Troca a variante de tamanho da URL CDN do Cloudflare Images.
 * url_cdn já vem com /public no final.
 *
 * Variantes disponíveis:
 *   /public    → 1366×768  (alta res)
 *   /large     → 1200×1200 (zoom/lightbox)
 *   /medium    → 600×600   (galeria)
 *   /card      → 400×400   (card de produto)
 *   /small     → 300×300   (thumbnails)
 *   /thumbnail → 150×150   (micro thumb)
 */
export function getCdnUrl(urlCdn: string, variant: CdnVariant = 'public'): string {
  if (!urlCdn) return '/placeholder.svg';
  // Only transform Cloudflare Images URLs (imagedelivery.net)
  if (urlCdn.includes('imagedelivery.net')) {
    return urlCdn.replace(/\/[^/]+$/, `/${variant}`);
  }
  // Proxy non-Cloudflare URLs (e.g., spotgifts.com.br) to avoid CORS
  return getProxiedImageUrl(urlCdn) || urlCdn;
}

/**
 * Gera srcSet para responsive images usando variantes CDN.
 */
export function getSrcSet(urlCdn: string): string {
  if (!urlCdn) return '';
  const base = urlCdn.replace(/\/[^/]+$/, '');
  return [
    `${base}/thumbnail 150w`,
    `${base}/small 300w`,
    `${base}/card 480w`,
    `${base}/medium 720w`,
    `${base}/large 1000w`,
  ].join(', ');
}

/**
 * Gera sizes para responsive images baseado no contexto.
 */
export function getImageSizes(context: 'card' | 'gallery' | 'hero' | 'thumb'): string {
  switch (context) {
    case 'card':
      return '(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 400px';
    case 'gallery':
      return '(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 600px';
    case 'hero':
      return '(max-width: 768px) 100vw, 1200px';
    case 'thumb':
      return '150px';
  }
}

// ============================================
// SELEÇÃO DE IMAGEM POR CONTEXTO
// ============================================

/**
 * Para CARD de produto (listagem/grid).
 * Prioridade: is_og_image (MAIN, cor individual) → qualquer main → is_primary (SET) → primeira
 */
export function getCardImage(images: ProductImageMeta[]): ProductImageMeta | null {
  return (
    images.find((i) => i.is_og_image) ||
    images.find((i) => i.image_type === 'main') ||
    images.find((i) => i.is_primary) ||
    images[0] ||
    null
  );
}

/**
 * Para HERO da página de produto (sem cor selecionada).
 * Prioridade: is_primary (SET, todas as cores) → is_og_image → primeira
 */
export function getHeroImage(images: ProductImageMeta[]): ProductImageMeta | null {
  return images.find((i) => i.is_primary) || images.find((i) => i.is_og_image) || images[0] || null;
}

/**
 * Para Open Graph / SEO meta tags.
 * Prioridade: is_og_image → qualquer main → is_primary → primeira
 */
export function getOgImage(images: ProductImageMeta[]): ProductImageMeta | null {
  return (
    images.find((i) => i.is_og_image) ||
    images.find((i) => i.image_type === 'main') ||
    images.find((i) => i.is_primary) ||
    images[0] ||
    null
  );
}

// ============================================
// FILTRAGEM POR COR
// ============================================

/**
 * Filtra imagens relevantes para uma cor selecionada.
 * Retorna: imagens específicas da cor + imagens genéricas (set, ambient, box, etc.)
 */
export function getColorImages(images: ProductImageMeta[], colorCode: string): ProductImageMeta[] {
  // Imagens específicas dessa cor
  const specific = images.filter(
    (i) => i.applies_to_color === true && i.supplier_code === colorCode,
  );

  // Imagens genéricas (sem cor — set, ambient, box, etc.)
  const generic = images.filter((i) => i.applies_to_color === false || i.applies_to_color === null);

  // Cor específica primeiro, genéricas depois
  return [...specific, ...generic];
}

/**
 * Obtém as cores disponíveis baseado nas imagens.
 * Retorna array de supplier_codes únicos (apenas numéricos).
 */
export function getAvailableColors(images: ProductImageMeta[]): string[] {
  const colors = new Set<string>();
  images.forEach((i) => {
    if (i.applies_to_color && i.supplier_code && /^\d+$/.test(i.supplier_code)) {
      colors.add(i.supplier_code);
    }
  });
  return Array.from(colors).sort();
}

/**
 * Obtém imagem thumbnail para seletor de cor.
 * Prioridade: main da cor → gallery da cor → primeira da cor
 */
export function getColorThumbnail(
  images: ProductImageMeta[],
  colorCode: string,
): ProductImageMeta | null {
  const colorImgs = images.filter(
    (i) => i.supplier_code === colorCode && i.applies_to_color === true,
  );
  return (
    colorImgs.find((i) => i.image_type === 'main') ||
    colorImgs.find((i) => i.image_type === 'gallery') ||
    colorImgs[0] ||
    null
  );
}

// ============================================
// CATEGORIZAÇÃO
// ============================================

/**
 * Separa imagens por categoria para exibição organizada (tabs na galeria).
 */
export function categorizeImages(images: ProductImageMeta[]): CategorizedImages {
  return {
    hero: images.find((i) => i.is_primary) || null,
    main: images.filter((i) => i.image_type === 'main'),
    gallery: images.filter((i) => i.image_type === 'gallery'),
    logo: images.filter((i) => i.image_type === 'logo'),
    ambient: images.filter((i) => i.image_type === 'ambient'),
    packaging: images.filter((i) => i.image_type === 'box' || i.image_type === 'pouch'),
  };
}

// ============================================
// CONSTANTES
// ============================================

/** Cloudflare account hash para montagem manual de URLs */
export const CF_ACCOUNT_HASH = 'vKMs9Ow8bA_enuhLXZ2HAw';
export const CF_BASE_URL = `https://imagedelivery.net/${CF_ACCOUNT_HASH}`;

/** Tipos que aparecem na galeria pública */
export const GALLERY_TYPES: ImageTypeCode[] = [
  'main',
  'gallery',
  'set',
  'logo',
  'ambient',
  'detail',
  'box',
  'pouch',
  'vitrine_pessoa',
  'vitrine_ambiente',
];

/** Tipos específicos de cor */
export const COLOR_SPECIFIC_TYPES: ImageTypeCode[] = ['main', 'gallery', 'detail', 'product'];

/** Ordem de prioridade de exibição por tipo */
export const IMAGE_TYPE_PRIORITY: Record<string, number> = {
  main: 10,
  vitrine_pessoa: 12,
  vitrine_ambiente: 13,
  set: 15,
  gallery: 20,
  ambient: 25,
  logo: 30,
  detail: 35,
  box: 40,
  pouch: 41,
  component: 50,
  location: 51,
  area: 52,
  mockup: 60,
  thumbnail: 70,
  other: 99,
};
