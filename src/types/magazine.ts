/**
 * Magazine — Tipos SSOT do módulo de criação de revistas de produtos.
 *
 * v1: persistência local (localStorage) até a migração do BD Gold
 * (qa/migrations-draft/2026-07-12_magazines.sql) ser aprovada.
 */

import type { Product, ProductColor } from '@/types/product-catalog';

export type MagazineTemplateId =
  | 'editorial-vogue'
  | 'editorial-magazine'
  | 'editorial-hero-grid'
  | 'editorial-mono'
  | 'editorial-manifesto'
  | 'catalog-grid-2x3'
  | 'catalog-grid-3x3'
  | 'catalog-list'
  | 'catalog-giftset'
  | 'corporate-hero'
  | 'corporate-split'
  | 'corporate-executive';

/**
 * Categoria semântica da revista — usada pelo SidebarChrome e PageNumberBadge
 * para colorir consistentemente todas as páginas internas. Sistema inspirado
 * no TOC do catálogo Abreez 2026.
 */
export type MagazineCategory =
  | 'technology'
  | 'drinkwares'
  | 'general'
  | 'wearables'
  | 'pins'
  | 'awards'
  | 'packaging'
  | 'stationery'
  | 'bags'
  | 'clocks'
  | 'signs'
  | 'id'
  | 'giftsets'
  | 'customized';

export type MagazineTemplateFamily = 'editorial' | 'catalog' | 'corporate';

export interface MagazineTemplateMeta {
  id: MagazineTemplateId;
  name: string;
  family: MagazineTemplateFamily;
  description: string;
  productsPerPage: number;
  /** Fonte Google recomendada para o corpo da revista (heading + body). */
  fonts: { heading: string; body: string };
  /** Paleta padrão (sobreescrita pelas cores do cliente quando presentes). */
  defaultColors: { primary: string; secondary: string; text: string };
}

/** Toggles de conteúdo — quais campos do produto entram na página. */
export interface MagazineContentSettings {
  showPrice: boolean;
  showCode: boolean;
  showPersonalization: boolean;
  showDescription: boolean;
  showDimensions: boolean;
  showMaterials: boolean;
  showColors: boolean;
  /** Agrupar produtos por categoria com quebra de seção. */
  groupByCategory: boolean;
}

export interface MagazineClientBranding {
  clientName: string | null;
  clientLogoUrl: string | null;
  clientCrmId: string | null;
  colors: { primary: string; secondary: string; text: string };
  /**
   * Categoria semântica da revista — colore SidebarChrome/PageNumberBadge.
   * `null` = deriva da primeira categoria de produto encontrada (fallback).
   */
  category: MagazineCategory | null;
}

/** Item da revista — 1 produto por posição, com override de variação/imagem. */
export interface MagazineItem {
  id: string;
  productId: string;
  /** Snapshot do produto (congelado na hora do add — evita quebrar se produto sair). */
  productSnapshot: MagazineProductSnapshot;
  /** Cor selecionada (nome). null = imagem principal do produto. */
  variantColorName: string | null;
  position: number;
  /** Página forçada — null = layout automático. */
  pageNumber: number | null;
  /** Override de campos por item — sobrepõe as flags globais. */
  overrides: Partial<MagazineContentSettings>;
}

/** Snapshot mínimo do produto para renderização estável. */
export interface MagazineProductSnapshot {
  id: string;
  name: string;
  sku: string;
  shortDescription: string;
  description: string | null;
  price: number;
  sale_price?: number;
  image_url: string;
  images: string[];
  colors: ProductColor[];
  category_name: string | null;
  category_id: string | null;
  materials: string[];
  hasPersonalization: boolean | null;
  dimensions?: Product['dimensions'];
}

export interface Magazine {
  id: string;
  ownerId: string;
  organizationId: string | null;
  title: string;
  subtitle: string;
  templateId: MagazineTemplateId;
  branding: MagazineClientBranding;
  content: MagazineContentSettings;
  items: MagazineItem[];
  /** Ordem de páginas customizada — null = derivado de `items` + template. */
  pageOrder: number[] | null;
  status: 'draft' | 'published';
  publicToken: string | null;
  pdfUrl: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Página derivada pela paginação — usada pelo renderer de template. */
export interface MagazinePage {
  index: number;
  kind: 'cover' | 'section' | 'products' | 'back-cover';
  /** Título de seção (quando kind = 'section'). */
  sectionTitle?: string;
  items: MagazineItem[];
}

export const DEFAULT_MAGAZINE_CONTENT: MagazineContentSettings = {
  showPrice: true,
  showCode: true,
  showPersonalization: true,
  showDescription: true,
  showDimensions: false,
  showMaterials: false,
  showColors: true,
  groupByCategory: false,
};

export const DEFAULT_BRANDING: MagazineClientBranding = {
  clientName: null,
  clientLogoUrl: null,
  clientCrmId: null,
  colors: {
    primary: '#2e4a3a',
    secondary: '#e86f2e',
    text: '#1a1a1a',
  },
  category: 'technology',
};
