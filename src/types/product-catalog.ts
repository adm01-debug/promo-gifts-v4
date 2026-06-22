/**
 * Product Catalog Types (Runtime/UI)
 *
 * These are the runtime types used throughout the UI.
 * Distinct from src/types/product.ts which holds DB-oriented types.
 */

/** Variação de cor de um produto com hex real, grupo cromático e imagem da variação. */
export interface ProductColor {
  name: string;
  hex: string;
  group: string;
  groupSlug?: string;
  variationSlug?: string;
  code?: string;
  image?: string;
  images?: string[];
  /** Estoque desta variação de cor (vem do mapper externo). */
  stock?: number;
}

/** Tipo canônico de produto no catálogo B2B — usado em UI, cart, kit-builder e filtros. */
export interface Product {
  id: string;
  name: string;
  description?: string | null;
  /** Descrição curta opcional (blurb) usada no QuickView. */
  shortDescription: string;
  price: number;
  sale_price?: number;
  /** Preço de comparação / preço original antes do desconto. */
  comparePrice?: number | null;
  category_id?: string | null;
  category_name?: string | null;
  image_url?: string;
  /**
   * URL da imagem "set" (todas as cores juntas) no Cloudflare Images.
   * Sem sufixo de variante — concatenar "/public" para exibição.
   * Quando presente, usada como imagem de hover no catálogo (crossfade CSS).
   * null/undefined = produto não tem set → card mostra imagem estática.
   * Fontes: SPOT (image_type=set original) + XBZ (d1 reclassificado, 2026-06-02).
   */
  set_image_url?: string | null;
  og_image_url?: string;
  primary_image_url?: string | null;
  /** Blurhash da imagem primária — cor dominante usada como placeholder no card. */
  primary_image_blurhash?: string | null;
  /** URL de fallback da imagem primária (usada se a imagem principal falhar). */
  primary_image_fallback_url?: string | null;
  images: string[];
  sku: string;
  stock: number;
  created_at?: string;
  updated_at?: string;
  colors: ProductColor[];
  materials: string[];
  supplier_reference?: string | null;
  brand?: string | null;
  is_active?: boolean;
  minQuantity: number;

  dimensions?: {
    height_cm?: number | null;
    width_cm?: number | null;
    length_cm?: number | null;
    diameter_cm?: number | null;
    circumference_cm?: number | null;
    weight_g?: number | null;
    capacity_ml?: number | null;
  };

  packingType?: string | null;
  packingClassification?: string | null;
  hasCommercialPackaging?: boolean | null;
  /** BUG-15c: adicionado para suportar filtro hasPersonalization no Super Filtro e Catálogo.
   *  Mapeado do campo has_personalization na DB (via product mapper). */
  hasPersonalization?: boolean | null;
  repackingType?: string | null;
  packagingContext?: 'always' | 'with_customization' | 'without_customization' | null;
  boxImage?: string | null;
  boxWidthMm?: number | null;
  boxHeightMm?: number | null;
  boxLengthMm?: number | null;
  boxWeightKg?: number | null;
  boxQuantity?: number | null;
  boxVolumeCm3?: number | null;

  stockStatus: 'in-stock' | 'low-stock' | 'out-of-stock';
  featured: boolean;
  newArrival: boolean;
  onSale: boolean;
  isKit: boolean;
  gender?: string | null;
  category: { id: number | string; name: string };
  supplier: { id: string; name: string };
  tags: {
    publicoAlvo: string[];
    datasComemorativas: string[];
    endomarketing: string[];
    ramo: string[];
    nicho: string[];
  };
  /**
   * Tags descritivas planas vindas da coluna `products.tags` quando ela é um
   * array (ex.: ["caneta", "metal", "bambu"]). Sinal de similaridade primário
   * usado pelo Match de Produtos — preservado separadamente das tags de
   * marketing estruturadas (que ficam vazias quando a fonte é um array plano).
   */
  descriptiveTags?: string[];

  subcategory?: string;
  groups?: Array<{ id: number; name: string }>;
  variations?: ProductVariation[];
  kitItems?: KitComponent[];

  priceUpdatedAt?: string | null;
  priceFreshnessThresholdDays?: number | null;
  metadata?: { height_mm?: number | null; width_mm?: number | null; [key: string]: unknown } | null;
  leadTimeDays?: number | null;
  video?: string | null;
  productVideos?: Array<{
    id: string;
    url_stream: string | null;
    url_hls: string | null;
    url_thumbnail: string | null;
    url_original: string | null;
    source_youtube_id: string | null;
    video_type: string | null;
    display_order: number;
    is_primary: boolean;
    title: string | null;
  }>;

  // ── Word Magic — conteúdo gerado por IA (DeepSeek V3) ──────────────────────
  /** Título comercial gerado por IA. null = ainda não gerado. */
  aiTitle?: string | null;
  /** Descrição B2B completa gerada por IA. */
  aiDescription?: string | null;
  /** Resumo curto gerado por IA (para listagem no catálogo). */
  aiSummary?: string | null;
  /** Versão do conteúdo IA. 0 = sem geração. Incrementa a cada re-geração. */
  aiVersion?: number | null;
  /** Timestamp da última geração IA (ISO 8601). */
  aiGeneratedAt?: string | null;

  /**
   * Color Swatches V2 — JSONB do BD externo (products.color_swatches), populado por trigger.
   * Cada item já agrega image_url (P1→P4 fallback) + stock_quantity (SUM por color_id).
   * Consumido por useProductColorSwatch + ColorSwatchPicker quando a flag
   * useColorSwatchesV2 estiver habilitada. null = produto sem variações de cor.
   */
  color_swatches?: import('./colorSwatch').ColorSwatch[] | null;
  has_colors?: boolean | null;

  /**
   * FAN-OUT DE COR: quando o filtro de cor está ativo, um produto pode aparecer
   * como múltiplos cards (1 por cor selecionada que possui). Este campo carrega
   * o color_id daquele card específico, usado para compor a key única
   * `${id}|${_cardColorId}` no grid e para deep-link na PDP (?cor=).
   * undefined = card normal (1 por produto, sem fan-out).
   */
  _cardColorId?: string;
}

/** Componente individual de um kit de brindes (kit nativo do fornecedor ou kit montado). */
export interface KitComponent {
  id: string;
  /** UUID do produto-componente. NULL para kits nativos (componente não vendável avulso). */
  productId: string;
  productName: string;
  quantity: number;
  sku: string;
  /** Imagem principal (capa). */
  imageUrl?: string | null;
  /** Galeria completa de fotos do componente (kits nativos). */
  images?: string[] | null;
  isOptional?: boolean;
  isPackaging?: boolean;
  isReplaceable?: boolean;
  allowsPersonalization?: boolean;
  material?: string | null;
  weightG?: number | null;
  heightMm?: number | null;
  widthMm?: number | null;
  lengthMm?: number | null;
  /** Diâmetro em mm (peças cilíndricas: copos, garrafas, canecas). */
  diameterMm?: number | null;
  /** Circunferência em mm (alternativa ao diâmetro). */
  circumferenceMm?: number | null;
  volumeMl?: number | null;
  componentTypeCode?: string | null;
  supplierComponentCode?: string | null;
  description?: string | null;
  personalizationNotes?: string | null;
  color?: string | null;
  video?: string;
  productVideos?: Array<{
    id: string;
    url_stream: string | null;
    url_hls: string | null;
    url_thumbnail: string | null;
    url_original: string | null;
    source_youtube_id: string | null;
    video_type: string | null;
    display_order: number;
    is_primary: boolean;
    title: string | null;
  }>;
}

/** Variação de produto (SKU) com cor, estoque, imagens e dimensões específicas. */
export interface ProductVariation {
  id: string;
  sku: string;
  color: {
    name: string;
    hex: string;
  };
  stock: number;
  image?: string | null;
  images?: string[];
  videos?: Array<{
    id: string;
    url_stream: string | null;
    url_hls: string | null;
    url_thumbnail: string | null;
    url_original: string | null;
    source_youtube_id: string | null;
    video_type: string | null;
    display_order: number;
    is_primary: boolean;
    title: string | null;
  }>;
  size_code?: string | null;
}

/** Parâmetros de consulta para filtrar e ordenar produtos no catálogo. */
export interface ProductFilters {
  category?: string;
  categoryId?: number | string;
  search?: string;
  minPrice?: number;
  maxPrice?: number;
  inStock?: boolean;
  limit?: number;
  // União das opções de ambos os lados do merge (main + PR) — `| string` mantém
  // permissivo, mas preservamos todos os literais para autocomplete/intenção.
  sortBy?:
    | string
    | 'best-seller-promo'
    | 'best-seller-supplier'
    | 'name-asc'
    | 'name-desc'
    | 'name'
    | 'newest'
    | 'price-asc'
    | 'price-desc'
    | 'stock';
}

/** Representação mínima de produto para seletores e catálogo (~10× menor que `Product`). */
export interface ProductLightweight {
  id: string;
  name: string;
  sku: string;
  supplier_reference?: string | null;
  price: number;
  image_url: string;
  stock: number;
  brand: string | null;
  category_id: string | null;
  is_active: boolean;
}
