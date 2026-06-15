import type { AdvancedFilterState, StockFilterOption } from '@/types/advancedFilters';

export const defaultAdvancedFilters: AdvancedFilterState = {
  search: '',
  categories: [],
  suppliers: [],
  colors: [],
  materials: [],
  techniques: [],
  tags: [],
  colorGroups: [],
  colorVariations: [],
  colorNuances: [],
  datasComemorativas: [],
  publicoAlvo: [],
  endomarketing: [],
  ramosAtividade: [],
  segmentosAtividade: [],
  // FIX-11: era [0, 1000] — inconsistente com defaultFilters.priceRange [0, 9999]
  // e com a lógica de filtro que usa 9999 como "sem limite superior".
  priceRange: [0, 9999],
  // BUG-SF-16 FIX: quantityRange removido — era campo orphaned (não aparecia na UI,
  // não era serializado na URL, não era aplicado ao filtro). Ver advancedFilters.ts.
  stockStatus: 'all',
  minStock: 0,
  isKit: false,
  isFeatured: false,
  isNew: false,
  hasPersonalization: false,
  gender: [],
  maxLeadTimeDays: null,
  sortBy: 'newest',
};

export const STOCK_FILTER_OPTIONS: StockFilterOption[] = [
  { value: 'all', label: 'Todos' },
  { value: 'in_stock', label: 'Em Estoque' },
  { value: 'low_stock', label: 'Estoque Baixo' },
  { value: 'out_of_stock', label: 'Sem Estoque' },
  { value: 'future', label: 'Estoque Futuro' },
];

export const SORT_OPTIONS = [
  { value: 'newest', label: 'Mais Recentes' },
  { value: 'name', label: 'Nome (A-Z)' },
  { value: 'price-asc', label: 'Preço (Menor → Maior)' },
  { value: 'price-desc', label: 'Preço (Maior → Menor)' },
  { value: 'stock', label: 'Maior Estoque' },
  { value: 'best-seller-supplier', label: '+ Vendidos Fornecedores' },
  { value: 'best-seller-promo', label: '+ Vendidos Promo Brindes' },
];
