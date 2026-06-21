/**
 * image-utils.ts — Utilitários para manipulação de imagens de produtos.
 *
 * CONCEITOS-CHAVE (ADR-001):
 *   is_primary=true → imagem capa canônica do produto (predominantemente type='main').
 *                     Vai para products.primary_image_url via trigger.
 *   og_image_url    → calculado em runtime: is_og_image=true → first main → is_primary.
 *                     NÃO está no SELECT; é calculado por enrichProducts().
 *
 * TIPOS DE IMAGEM:
 *   main      → imagem principal do produto. Pode ser cor-específica (applies_to_color=true,
 *               image_type='main'). Tipicamente image_type='main', cor individual.
 *   Nota: is_primary=true é encontrado em 5.553 imagens 'main' e apenas 1 'set'.
 *
 *   gallery   → imagens de galeria do produto.
 *   product   → foto do produto isolado (sem fundo).
 *   set       → imagens de conjunto/kit.
 *   logo      → logo de gravação.
 *   ambient   → imagens ambientadas.
 *   detail    → detalhe do produto.
 *
 * TIPOS TÉCNICOS (excluídos da galeria do produto):
 *   box, pouch, location, area, component
 */

export type ImageTypeCode =
  | 'ambient'
  | 'area'
  | 'box'
  | 'component'
  | 'detail'
  | 'gallery'
  | 'location'
  | 'logo'
  | 'main'
  | 'pouch'
  | 'product'
  | 'set';

export interface ProductImageMeta {
  id?: string;
  url_cdn: string;
  url_original: string | null;
  image_type: string;
  is_primary: boolean;
  is_og_image: boolean;
  applies_to_color: boolean | null;
  supplier_code: string | null;
  alt_text: string | null;
  title_text: string | null;
  display_order: number;
  blurhash?: string | null;
  content_hash?: string | null;
  cf_sync_status?: string | null;
}

export interface GroupedImages {
  hero: ProductImageMeta | null; // imagem com is_primary=true (predominantemente type='main')
  main: ProductImageMeta[]; // image_type=main
  gallery: ProductImageMeta[]; // image_type=gallery
  logo: ProductImageMeta[]; // image_type=logo (com gravação)
  ambient: ProductImageMeta[]; // image_type=ambient
  packaging: ProductImageMeta[]; // image_type=box | pouch
  technical: ProductImageMeta[]; // location | area | component
}

/**
 * Variantes de tamanho do Cloudflare Images.
 * `card` (400×400) é usada nos cards de catálogo por dezenas de consumidores.
 */
export type CdnVariant = 'card' | 'large' | 'medium' | 'public' | 'small' | 'thumbnail';

// CDN variant suffixes
const CDN_VARIANTS: Record<CdnVariant, string> = {
  thumbnail: '/thumbnail',
  small: '/small',
  card: '/card',
  medium: '/medium',
  large: '/large',
  public: '/public',
};

/**
 * True só quando o HOST da URL é (sub)domínio de imagedelivery.net.
 * Valida o hostname parseado em vez de `includes(...)` — um substring match
 * aceitaria `https://evil.com/?x=imagedelivery.net` ou `imagedelivery.net.evil.com`.
 */
export function isImageDeliveryUrl(url: string | null | undefined): url is string {
  if (!url) return false;
  try {
    const { hostname } = new URL(url);
    return hostname === 'imagedelivery.net' || hostname.endsWith('.imagedelivery.net');
  } catch {
    return false;
  }
}

/**
 * Gera URL do CDN com variante de tamanho.
 */
export function getCdnUrl(url: string | null | undefined, variant: CdnVariant = 'public'): string {
  if (!url) return '/placeholder.svg';
  if (isImageDeliveryUrl(url)) {
    // Remove variante existente e aplica a nova
    const base = url.replace(/\/(thumbnail|small|card|medium|large|public)$/, '');
    return `${base}${CDN_VARIANTS[variant]}`;
  }
  return url;
}

/**
 * Gera srcSet para imagens responsivas.
 */
export function getSrcSet(url: string | null | undefined): string | undefined {
  if (!isImageDeliveryUrl(url)) return undefined;
  const base = url.replace(/\/(thumbnail|small|card|medium|large|public)$/, '');
  return [
    `${base}/thumbnail 150w`,
    `${base}/small 400w`,
    `${base}/card 480w`,
    `${base}/medium 800w`,
    `${base}/large 1200w`,
  ].join(', ');
}

export function getImageSizes(context: 'card' | 'gallery' | 'hero' | 'thumb'): string {
  switch (context) {
    case 'card':
      return '(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw';
    case 'gallery':
      return '(max-width: 768px) 100vw, 50vw';
    case 'hero':
      return '(max-width: 768px) 100vw, 60vw';
    case 'thumb':
      return '80px';
    default:
      return '100vw';
  }
}

/**
 * Obtém URL da imagem OG (Open Graph / SEO).
 * Prioridade: is_og_image → qualquer main → is_primary → primeira
 */
export function getOgImageUrl(images: ProductImageMeta[]): string | null {
  const og =
    images.find((i) => i.is_og_image) ||
    images.find((i) => i.image_type === 'main') ||
    images.find((i) => i.is_primary) ||
    images[0];
  return og?.url_cdn ?? null;
}

/**
 * Retorna a imagem OG como objeto (para compatibilidade com testes).
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

/**
 * Retorna a imagem para exibição em cards de catálogo.
 * Prioridade: is_og_image → main → is_primary → primeira
 */
export function getCardImage(images: ProductImageMeta[]): ProductImageMeta | null {
  if (images.length === 0) return null;
  return (
    images.find((i) => i.is_og_image) ||
    images.find((i) => i.image_type === 'main') ||
    images.find((i) => i.is_primary) ||
    images[0] ||
    null
  );
}

/**
 * Retorna a imagem hero (principal) do produto.
 * Prioridade: is_primary → is_og_image → primeira
 */
export function getHeroImage(images: ProductImageMeta[]): ProductImageMeta | null {
  return images.find((i) => i.is_primary) || images.find((i) => i.is_og_image) || images[0] || null;
}

/**
 * Obtém URL da imagem principal do produto.
 * Prioridade: is_og_image → qualquer main → is_primary → primeira
 */
export function getPrimaryImageUrl(images: ProductImageMeta[]): string | null {
  const primary =
    images.find((i) => i.is_og_image) ||
    images.find((i) => i.image_type === 'main') ||
    images.find((i) => i.is_primary) ||
    images[0];
  return primary?.url_cdn ?? null;
}

/**
 * Obtém imagem para exibição baseada na cor selecionada.
 * Prioridade: main da cor → gallery da cor → primeira da cor
 */
export function getColorHeroImage(
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

/**
 * Agrupa imagens por tipo.
 */
export function groupImages(images: ProductImageMeta[]): GroupedImages {
  return {
    hero: images.find((i) => i.is_primary) ?? null,
    main: images.filter((i) => i.image_type === 'main'),
    gallery: images.filter((i) => i.image_type === 'gallery'),
    logo: images.filter((i) => i.image_type === 'logo'),
    ambient: images.filter((i) => i.image_type === 'ambient'),
    packaging: images.filter((i) => i.image_type === 'box' || i.image_type === 'pouch'),
    technical: images.filter(
      (i) => i.image_type === 'location' || i.image_type === 'area' || i.image_type === 'component',
    ),
  };
}

/** Alias de groupImages para compatibilidade */
export function categorizeImages(images: ProductImageMeta[]): GroupedImages {
  return groupImages(images);
}

/**
 * Obtém imagens para a galeria de um produto com filtro de cor.
 *
 * Comportamento (ADR-001):
 *   - A imagem type='main' é a imagem PRINCIPAL do produto.
 *     Deve SEMPRE aparecer em primeiro lugar na galeria, mesmo quando uma cor
 *     está activa — ela é o hero do produto, não uma variante de cor.
 *   - Tipos técnicos (box, pouch, location, area, component) são excluídos.
 *   - hero sempre primeiro; specific da cor depois; deduplicado.
 *
 * Prioridade de hero:
 *   1. main com is_primary=true (hero canônico)
 *   2. main genérico (!applies_to_color) — não ligado a nenhuma cor
 *   3. main da cor seleccionada em specific — último recurso quando só existem mains por cor
 *
 * @param images     Lista completa de ProductImageMeta do produto
 * @param colorCode  supplier_code da cor seleccionada
 */
export function getColorImages(images: ProductImageMeta[], colorCode: string): ProductImageMeta[] {
  // 1) Imagens específicas desta cor (não-técnicas, ADR-001)
  const specific = images.filter(
    (i) =>
      i.applies_to_color === true &&
      i.supplier_code === colorCode &&
      !TECHNICAL_IMAGE_TYPES.has(i.image_type),
  );

  // 2) Hero: main com is_primary=true → qualquer main sem applies_to_color
  //    → main cor-específica da cor seleccionada (último recurso: produto só tem mains por cor)
  //    A main é a imagem principal do produto e deve sempre aparecer, mesmo com cor activa.
  const hero =
    images.find((i) => i.image_type === 'main' && i.is_primary) ??
    images.find((i) => i.image_type === 'main' && !i.applies_to_color) ??
    specific.find((i) => i.image_type === 'main');

  // 3) Hero sempre primeiro; deduplicar os specific (remover hero se vier na lista)
  const result: ProductImageMeta[] = [];
  if (hero) result.push(hero);
  result.push(...specific.filter((i) => i.id !== hero?.id));

  return result;
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
// CONSTANTES EXPORTADAS
// ============================================

/** Tipos que aparecem na galeria do produto (exclui técnicos) */
export const GALLERY_TYPES: ImageTypeCode[] = [
  'main',
  'gallery',
  'product',
  'set',
  'logo',
  'ambient',
  'detail',
];

/** Tipos técnicos — documentação/embalagem, não aparecem na galeria */
export const TECHNICAL_IMAGE_TYPES = new Set<string>([
  'box',
  'pouch',
  'location',
  'area',
  'component',
]);

/** Tipos de imagem que podem ser cor-específicas */
export const COLOR_SPECIFIC_TYPES: ImageTypeCode[] = ['main', 'gallery', 'detail', 'product'];

// ============================================
// BLURHASH UTILITIES (zero-dependency)
// ============================================

const BASE83 =
  '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz#$%*+,-.:;=?@[]^_{|}~';

function decode83(str: string, start: number, len: number): number {
  let v = 0;
  for (let i = start; i < start + len; i++) {
    const idx = BASE83.indexOf(str[i]);
    if (idx < 0) return 0;
    v = v * 83 + idx;
  }
  return v;
}

/**
 * Extrai a cor dominante (componente DC) de uma string blurhash sem bibliotecas externas.
 * Retorna uma string CSS `rgb(r,g,b)` ou `null` se o hash for inválido.
 *
 * O componente DC está em espaço sRGB (8 bits por canal) codificado como 4 dígitos base83
 * na posição 2 do hash. Funciona independente do número de componentes AC.
 */
export function getBlurhashDominantColor(hash: string | null | undefined): string | null {
  if (!hash || hash.length < 6) return null;
  try {
    const dc = decode83(hash, 2, 4);
    const r = (dc >> 16) & 0xff;
    const g = (dc >> 8) & 0xff;
    const b = dc & 0xff;
    return `rgb(${r},${g},${b})`;
  } catch {
    return null;
  }
}
