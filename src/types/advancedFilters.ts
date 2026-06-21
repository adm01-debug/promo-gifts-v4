// ============================================
// TIPOS PARA FILTROS AVANÇADOS
// ============================================

/** Opção de cor disponível em filtros avançados, com hex real e contagem de produtos. */
export interface ColorOption {
  id: string;
  name: string;
  hex: string;
  count?: number;
}

/** Opção de categoria hierárquica com nível e caminho para filtros de catálogo. */
export interface CategoryOption {
  id: string;
  name: string;
  parentId?: string;
  level: number;
  path?: string;
  count?: number;
  children?: CategoryOption[];
}

/** Opção de técnica de personalização (gravação, bordado, etc.) com prazo e mínimo. */
export interface TechniqueOption {
  id: string;
  name: string;
  code: string;
  estimatedDays?: number;
  minQuantity?: number;
}

/** Opção de fornecedor com código e prazo de lead time para filtros avançados. */
export interface SupplierOption {
  id: string;
  name: string;
  code?: string;
  leadTimeDays?: number;
}

/** Opção de material disponível como filtro de catálogo (ex.: metal, couro, plástico). */
export interface MaterialOption {
  name: string;
  count?: number;
}

/** Opção de status de estoque para o filtro de disponibilidade no catálogo. */
export interface StockFilterOption {
  value: 'all' | 'future' | 'in_stock' | 'low_stock' | 'out_of_stock';
  label: string;
}

/** Estado completo dos filtros avançados do Super Filtro e catálogo B2B. */
export interface AdvancedFilterState {
  // Filtros básicos
  search: string;
  categories: string[];
  suppliers: string[];
  colors: string[];
  materials: string[];
  techniques: string[];
  tags: string[];

  // Sistema hierárquico de cores
  colorGroups: string[];
  colorVariations: string[];
  colorNuances: string[];

  // Filtros de marketing
  datasComemorativas: string[];
  publicoAlvo: string[];
  endomarketing: string[];
  ramosAtividade: string[];
  segmentosAtividade: string[];

  // Faixa de preço
  priceRange: [number, number];

  // BUG-SF-16 FIX: quantityRange foi removido — era declarado mas nunca:
  // (a) exibido no painel de filtros, (b) serializado na URL, (c) aplicado ao filtro de produtos.
  // Se implementado no futuro, deve ser adicionado também em FilterState e useFiltersPageState.

  // Estoque
  stockStatus: StockFilterOption['value'];
  minStock: number;

  // Características
  isKit: boolean;
  isFeatured: boolean;
  isNew: boolean;
  hasPersonalization: boolean;

  // Gênero
  gender: string[];

  // Prazo de entrega
  maxLeadTimeDays: number | null;

  // Ordenação
  // BUG-SF-09 FIX: era 'price_asc'/'price_desc' (underscore) — SORT_OPTIONS usa hyphen ('price-asc').
  // Adicionados todos os valores reais de SORT_OPTIONS para evitar divergência de tipo.
  sortBy:
    | string
    | 'best-seller-promo'
    | 'best-seller-supplier'
    | 'name'
    | 'newest'
    | 'popularity'
    | 'price-asc'
    | 'price-desc'
    | 'stock';
}

/** Grupo canônico de cor (ex.: Azul, Vermelho) vindo da tabela `color_groups`. */
export interface ColorGroupData {
  id: string;
  name: string;
  hex_code?: string;
  is_active?: boolean;
}

/** Tag de produto (público-alvo, datas comemorativas, endomarketing, nicho). */
export interface TagData {
  id: string;
  name: string;
  slug?: string;
  color?: string;
}
