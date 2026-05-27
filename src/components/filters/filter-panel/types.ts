import React from 'react';
import type { ColumnCount } from '@/components/products/ColumnSelector';
import {
  Palette,
  LayoutGrid,
  Package,
  DollarSign,
  Truck,
  Users,
  User,
  Calendar,
  Briefcase,
  Gem,
  Building2,
  Paintbrush,
  Tag,
  Sparkles,
  Filter,
  Target,
  TrendingUp,
  Zap,
  Ruler,
} from 'lucide-react';

// ============================================
// TIPOS E DEFAULTS
// ============================================

export interface FilterState {
  search: string;
  colorGroups: string[];
  colorVariations: string[];
  colorNuances: string[];
  colors: string[];
  categories: string[];
  suppliers: string[];
  publicoAlvo: string[];
  datasComemorativas: string[];
  endomarketing: string[];
  ramosAtividade: string[];
  segmentosAtividade: string[];
  materialGroups: string[];
  materialTypes: string[];
  materiais: string[];
  techniques: string[];
  tags: string[];
  priceRange: [number, number];
  minStock: number;
  inStock: boolean;
  isKit: boolean;
  featured: boolean;
  isNew: boolean;
  hasPersonalization: boolean;
  hasCommercialPackaging: boolean;
  gender: string[];
  sizes: string[];
  sortBy: string;
}

export interface FilterPanelProps {
  filters: FilterState;
  onFilterChange: (filters: FilterState) => void;
  onReset: () => void;
  activeFiltersCount: number;
  products?: Array<{
    tags?: { publicoAlvo?: string[]; endomarketing?: string[]; ramo?: string[]; nicho?: string[] };
  }>;
  viewMode?: 'grid' | 'list';
  onViewModeChange?: (mode: 'grid' | 'list') => void;
  gridColumns?: ColumnCount;
  onGridColumnsChange?: (cols: ColumnCount) => void;
  filteredResultsCount?: number;
}

export const defaultFilters: FilterState = {
  search: '',
  colorGroups: [],
  colorVariations: [],
  colorNuances: [],
  colors: [],
  categories: [],
  suppliers: [],
  publicoAlvo: [],
  datasComemorativas: [],
  endomarketing: [],
  ramosAtividade: [],
  segmentosAtividade: [],
  materialGroups: [],
  materialTypes: [],
  materiais: [],
  techniques: [],
  tags: [],
  priceRange: [0, 9999],
  minStock: 0,
  inStock: false,
  isKit: false,
  featured: false,
  isNew: false,
  hasPersonalization: false,
  hasCommercialPackaging: false,
  gender: [],
  sizes: [],
  sortBy: 'name',
};

export const SECTION_CONFIG: Record<string, { title: string; icon: React.ReactNode }> = {
  cores: { title: 'Cores', icon: React.createElement(Palette, { className: 'h-4 w-4' }) },
  categorias: {
    title: 'Categorias',
    icon: React.createElement(LayoutGrid, { className: 'h-4 w-4' }),
  },
  estoque: { title: 'Estoque', icon: React.createElement(Package, { className: 'h-4 w-4' }) },
  preco: {
    title: 'Faixa de Preço',
    icon: React.createElement(DollarSign, { className: 'h-4 w-4' }),
  },
  fornecedores: {
    title: 'Fornecedores',
    icon: React.createElement(Truck, { className: 'h-4 w-4' }),
  },
  publico: { title: 'Público-Alvo', icon: React.createElement(Users, { className: 'h-4 w-4' }) },
  'datas-comemorativas': {
    title: 'Datas Comemorativas',
    icon: React.createElement(Calendar, { className: 'h-4 w-4' }),
  },
  endomarketing: {
    title: 'Endomarketing',
    icon: React.createElement(Briefcase, { className: 'h-4 w-4' }),
  },
  materiais: { title: 'Materiais', icon: React.createElement(Gem, { className: 'h-4 w-4' }) },
  'ramos-atividade': {
    title: 'Nichos/Segmentos',
    icon: React.createElement(Building2, { className: 'h-4 w-4' }),
  },
  tecnicas: {
    title: 'Técnicas de Gravação',
    icon: React.createElement(Paintbrush, { className: 'h-4 w-4' }),
  },
  // BUG-SF-18 FIX: genero usava Users (igual a publico), tamanhos usava Package (igual a estoque).
  // Ícones mais semânticos: User (singular) para gênero, Ruler para tamanhos.
  genero: { title: 'Gênero', icon: React.createElement(User, { className: 'h-4 w-4' }) },
  tamanhos: { title: 'Tamanhos', icon: React.createElement(Ruler, { className: 'h-4 w-4' }) },
  tags: { title: 'Tags', icon: React.createElement(Tag, { className: 'h-4 w-4' }) },
  'opcoes-rapidas': {
    title: 'Opções Rápidas',
    icon: React.createElement(Sparkles, { className: 'h-4 w-4' }),
  },
  ordenacao: { title: 'Ordenar por', icon: React.createElement(Filter, { className: 'h-4 w-4' }) },
};

export const SECTION_GROUPS = [
  {
    label: 'PRODUTO',
    sections: ['cores', 'categorias', 'estoque', 'preco', 'materiais', 'genero', 'tamanhos'],
    icon: Package,
  },
  { label: 'COMERCIAL', sections: ['fornecedores', 'tecnicas'], icon: TrendingUp },
  {
    label: 'MARKETING',
    sections: ['publico', 'datas-comemorativas', 'endomarketing', 'ramos-atividade'],
    icon: Target,
  },
  // BUG-SF-03 FIX: 'ordenacao' estava definido em SECTION_CONFIG e sectionRenderers
  // mas NUNCA aparecia no sidebar porque não estava em nenhum SECTION_GROUPS.
  // Adicionado ao grupo 'ATALHOS' para renderizar a seção de ordenação no painel lateral.
  { label: 'ATALHOS', sections: ['tags', 'opcoes-rapidas', 'ordenacao'], icon: Zap },
];
