import type { Product } from '@/hooks/products';
import type { PromobrindPriceTable } from '@/lib/external-db';

export interface SearchFilters {
  searchQuery: string;
  category: string;
  minQuantity: number;
  colors: string[];
  technique: string;
  priceType: 'with_personalization' | 'without_personalization';
  priceRange: [number, number];
}

export interface ProductWithCalculatedPrice extends Product {
  calculatedUnitPrice: number;
  priceBreakdown: {
    productPrice: number;
    customizationPrice: number;
    setupPrice: number;
    handlingPrice: number;
    totalPerUnit: number;
  };
  matchingTechnique?: PromobrindPriceTable;
}

export type ViewMode = 'cards' | 'list' | 'table';

export const DEFAULT_FILTERS: SearchFilters = {
  searchQuery: '',
  category: 'all',
  minQuantity: 100,
  colors: [],
  technique: 'all',
  priceType: 'with_personalization',
  priceRange: [0, 100],
};

export const QUANTITY_OPTIONS = [
  { value: 50, label: '50+ unidades' },
  { value: 100, label: '100+ unidades' },
  { value: 250, label: '250+ unidades' },
  { value: 500, label: '500+ unidades' },
  { value: 1000, label: '1.000+ unidades' },
  { value: 2500, label: '2.500+ unidades' },
  { value: 5000, label: '5.000+ unidades' },
];

export const formatCurrency = (value: number): string =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
