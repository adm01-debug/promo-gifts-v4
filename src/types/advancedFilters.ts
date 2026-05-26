// ============================================
// TIPOS PARA FILTROS AVANÇADOS
// ============================================

export interface ColorOption {
  id: string;
  name: string;
  hex: string;
  count?: number;
}

export interface CategoryOption {
  id: string;
  name: string;
  parentId?: string;
  level: number;
  path?: string;
  count?: number;
  children?: CategoryOption[];
}

export interface TechniqueOption {
  id: string;
  name: string;
  code: string;
  estimatedDays?: number;
  minQuantity?: number;
}

export interface SupplierOption {
  id: string;
  name: string;
  code?: string;
  leadTimeDays?: number;
}

export interface MaterialOption {
  name: string;
  count?: number;
}

export interface StockFilterOption {
  value: 'all' | 'in_stock' | 'low_stock' | 'out_of_stock' | 'future';
  label: string;
}

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

  // Tiragem/Quantidade
  quantityRange: [number, number];

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
  sortBy: 'name' | 'price_asc' | 'price_desc' | 'newest' | 'stock' | 'popularity';
}

export interface ColorGroupData {
  id: string;
  name: string;
  hex_code?: string;
  is_active?: boolean;
}

export interface TagData {
  id: string;
  name: string;
  slug?: string;
  color?: string;
}
