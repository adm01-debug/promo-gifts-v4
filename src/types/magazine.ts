/**
 * Magazine — Tipos SSOT do módulo de criação de revistas de produtos.
 *
 * v2: persistência no BD Gold (doufsxqlfjyuvxuezpln) via magazines/magazine_items.
 * FIX C7 (auditoria): 'archived' adicionado — o BD arquiva rascunhos antigos
 * automaticamente via cron (magazine_auto_archive_stale_drafts), e o front
 * precisa reconhecer esse status sem quebrar a renderização.
 */

import type { Product, ProductColor } from '@/types/product-catalog';

export type MagazineTemplateId =
  'catalog-giftset' | 'catalog-grid-2x3' | 'catalog-grid-3x3' | 'catalog-list' | 'corporate-executive' | 'corporate-hero' | 'corporate-split' | 'editorial-hero-grid' | 'editorial-magazine' | 'editorial-manifesto' | 'editorial-mono' | 'editorial-vogue';

/**
 * Categoria semântica da revista — usada pelo SidebarChrome e PageNumberBadge
 * para colorir consistentemente todas as páginas internas. Sistema inspirado
 * no TOC do catálogo Abreez 2026.
 */
export type MagazineCategory =
  'awards' | 'bags' | 'clocks' | 'customized' | 'drinkwares' | 'general' | 'giftsets' | 'id' | 'packaging' | 'pins' | 'signs' | 'stationery' | 'technology' | 'wearables';

export type MagazineTemplateFamily = 'catalog' | 'corporate' | 'editorial';

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
  /** Texto de introdução opcional (exibido antes dos produtos). */
  introText?: string;
  /** Texto de fechamento opcional (exibido após os produtos). */
  closingText?: string;
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
  /**
   * FIX C3 (auditoria BD): position é NUMERIC no BD (não INTEGER) para permitir
   * reordenação sem violar UNIQUE(magazine_id, position) durante o rewrite.
   * Ex.: mover item da posição 3 para entre 1 e 2 → position = 1.5.
   */
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
  /**
   * FIX C7 (auditoria BD): 'archived' adicionado ao contrato de tipos.
   * O BD arquiva rascunhos com mais de 365 dias sem edição automaticamente
   * (cron magazine-cleanup-nightly → magazine_auto_archive_stale_drafts).
   * Trate 'archived' como somente-leitura na UI (mesmo tratamento de 'draft'
   * para renderização, mas sem permitir novas edições sem reativar).
   */
  status: 'archived' | 'draft' | 'published';
  publicToken: string | null;
  pdfUrl: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Página derivada pela paginação — usada pelo renderer de template. */
export interface MagazinePage {
  index: number;
  kind: 'back-cover' | 'cover' | 'products' | 'section';
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

/**
 * FIX A12 (auditoria BD): limites de tamanho espelhando as CHECK constraints
 * do banco (magazines_title_len, magazines_subtitle_len, e o limite de 500
 * itens por revista/import). Use estes limites para validar no client ANTES
 * de enviar ao BD — evita round-trip desnecessário com erro 23514.
 */
export const MAGAZINE_LIMITS = {
  TITLE_MAX_LENGTH: 200,
  SUBTITLE_MAX_LENGTH: 300,
  MAX_ITEMS_PER_MAGAZINE: 500,
  MAX_BOOKMARKS_PER_DEVICE: 500,
} as const;
