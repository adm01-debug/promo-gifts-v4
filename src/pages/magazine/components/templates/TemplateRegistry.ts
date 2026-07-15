/**
 * TemplateRegistry — SSOT dos 10 templates de design da Magazine.
 *
 * Cada template define metadata + componente React puro que renderiza
 * uma página (1920×2716 px, proporção A4 a 300dpi).
 */

import type { ComponentType } from 'react';
import type {
  Magazine,
  MagazinePage,
  MagazineTemplateId,
  MagazineTemplateMeta,
} from '@/types/magazine';

import { VogueTemplate } from './editorial/VogueTemplate';
import { MagazineTemplate } from './editorial/MagazineTemplate';
import { HeroGridTemplate } from './editorial/HeroGridTemplate';
import { MonoTemplate } from './editorial/MonoTemplate';
import { EditorialManifestoTemplate } from './editorial/EditorialManifestoTemplate';
import { Grid2x3Template } from './catalog/Grid2x3Template';
import { Grid3x3Template } from './catalog/Grid3x3Template';
import { ListTemplate } from './catalog/ListTemplate';
import { GiftSetShowcaseTemplate } from './catalog/GiftSetShowcaseTemplate';
import { CorporateHeroTemplate } from './corporate/CorporateHeroTemplate';
import { CorporateSplitTemplate } from './corporate/CorporateSplitTemplate';
import { CorporateExecutiveTemplate } from './corporate/CorporateExecutiveTemplate';

export interface TemplatePageProps {
  magazine: Magazine;
  page: MagazinePage;
  /** Total de páginas na revista, usado para folios "05 / 24". */
  totalPages?: number;
}

export interface TemplateEntry extends MagazineTemplateMeta {
  Component: ComponentType<TemplatePageProps>;
}

export const TEMPLATE_REGISTRY: Record<MagazineTemplateId, TemplateEntry> = {
  'editorial-vogue': {
    id: 'editorial-vogue',
    name: 'Vogue',
    family: 'editorial',
    description: 'Hero fullbleed, tipografia serifada, 1 produto por página',
    productsPerPage: 1,
    fonts: { heading: 'Cormorant Garamond', body: 'Work Sans' },
    defaultColors: { primary: '#0f172a', secondary: '#dc2626', text: '#111111' },
    Component: VogueTemplate,
  },
  'editorial-magazine': {
    id: 'editorial-magazine',
    name: 'Magazine',
    family: 'editorial',
    description: '2 colunas, imagem 60/40, sidebar de detalhes',
    productsPerPage: 2,
    fonts: { heading: 'Instrument Serif', body: 'Inter' },
    defaultColors: { primary: '#1e293b', secondary: '#eab308', text: '#0f172a' },
    Component: MagazineTemplate,
  },
  'editorial-hero-grid': {
    id: 'editorial-hero-grid',
    name: 'Hero Grid',
    family: 'editorial',
    description: 'Hero + 4 produtos coadjuvantes',
    productsPerPage: 5,
    fonts: { heading: 'DM Serif Display', body: 'Fira Sans' },
    defaultColors: { primary: '#111827', secondary: '#f97316', text: '#111827' },
    Component: HeroGridTemplate,
  },
  'editorial-mono': {
    id: 'editorial-mono',
    name: 'Mono',
    family: 'editorial',
    description: 'Preto e branco, foco absoluto na fotografia',
    productsPerPage: 1,
    fonts: { heading: 'Archivo Black', body: 'Hind' },
    defaultColors: { primary: '#000000', secondary: '#000000', text: '#000000' },
    Component: MonoTemplate,
  },
  'editorial-manifesto': {
    id: 'editorial-manifesto',
    name: 'Manifesto',
    family: 'editorial',
    description: 'Página-manifesto em 3 fatias (30/40/30) — narrativa de coleção',
    productsPerPage: 2,
    fonts: { heading: 'Playfair Display', body: 'Inter' },
    defaultColors: { primary: '#2e4a3a', secondary: '#e86f2e', text: '#1a1a1a' },
    Component: EditorialManifestoTemplate,
  },
  'catalog-grid-2x3': {
    id: 'catalog-grid-2x3',
    name: 'Catálogo 2×3',
    family: 'catalog',
    description: '6 produtos por página, foco em preço e código',
    productsPerPage: 6,
    fonts: { heading: 'Playfair Display', body: 'Inter' },
    defaultColors: { primary: '#1a1a1a', secondary: '#e86f2e', text: '#1a1a1a' },
    Component: Grid2x3Template,
  },
  'catalog-grid-3x3': {
    id: 'catalog-grid-3x3',
    name: 'Catálogo 3×3',
    family: 'catalog',
    description: '9 produtos por página, densidade máxima',
    productsPerPage: 9,
    fonts: { heading: 'Playfair Display', body: 'Inter' },
    defaultColors: { primary: '#1a1a1a', secondary: '#e86f2e', text: '#1a1a1a' },
    Component: Grid3x3Template,
  },
  'catalog-list': {
    id: 'catalog-list',
    name: 'Lista',
    family: 'catalog',
    description: 'Lista com thumb, specs completas e preço',
    productsPerPage: 5,
    fonts: { heading: 'Playfair Display', body: 'Inter' },
    defaultColors: { primary: '#1a1a1a', secondary: '#e86f2e', text: '#1a1a1a' },
    Component: ListTemplate,
  },
  'catalog-giftset': {
    id: 'catalog-giftset',
    name: 'Gift Set Showcase',
    family: 'catalog',
    description: 'Composição hero + tabela "Product includes" + variações — ideal p/ kits',
    productsPerPage: 8,
    fonts: { heading: 'Playfair Display', body: 'Inter' },
    defaultColors: { primary: '#1a1a1a', secondary: '#2f6c6c', text: '#1a1a1a' },
    Component: GiftSetShowcaseTemplate,
  },
  'corporate-hero': {
    id: 'corporate-hero',
    name: 'Corporativo Hero',
    family: 'corporate',
    description: 'Capa com logo do cliente em destaque, produtos 2×2',
    productsPerPage: 4,
    fonts: { heading: 'Sora', body: 'Manrope' },
    defaultColors: { primary: '#0c2340', secondary: '#c9a84c', text: '#0c2340' },
    Component: CorporateHeroTemplate,
  },
  'corporate-split': {
    id: 'corporate-split',
    name: 'Corporativo Split',
    family: 'corporate',
    description: 'Cabeçalho fixo com marca, 2 produtos por página',
    productsPerPage: 2,
    fonts: { heading: 'Space Grotesk', body: 'DM Sans' },
    defaultColors: { primary: '#1e3a5f', secondary: '#e11d48', text: '#0f172a' },
    Component: CorporateSplitTemplate,
  },
  'corporate-executive': {
    id: 'corporate-executive',
    name: 'Executivo',
    family: 'corporate',
    description: 'Paleta sóbria, tipografia serifada + sans, alto padrão',
    productsPerPage: 3,
    fonts: { heading: 'Instrument Serif', body: 'Work Sans' },
    defaultColors: { primary: '#0d0d0d', secondary: '#c9a84c', text: '#111111' },
    Component: CorporateExecutiveTemplate,
  },
};

export function getTemplate(id: MagazineTemplateId): TemplateEntry {
  return TEMPLATE_REGISTRY[id] ?? TEMPLATE_REGISTRY['editorial-vogue'];
}

export function listTemplates(): TemplateEntry[] {
  return Object.values(TEMPLATE_REGISTRY);
}

export function templatesByFamily(): Record<'catalog' | 'corporate' | 'editorial', TemplateEntry[]> {
  const out = { editorial: [], catalog: [], corporate: [] } as Record<
    'catalog' | 'corporate' | 'editorial',
    TemplateEntry[]
  >;
  for (const t of listTemplates()) out[t.family].push(t);
  return out;
}
