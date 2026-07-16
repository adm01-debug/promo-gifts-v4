/**
 * Dados sintéticos para a Galeria de Templates de Revista.
 *
 * Uma `Magazine` "de vitrine" — 9 produtos plausíveis de brindes corporativos,
 * branding fictício ("ACME Corp") e todos os toggles de conteúdo ligados para
 * que cada template revele o máximo de informação.
 *
 * Reutilizado por todos os cards da galeria + preview em tamanho real.
 */

import {
  DEFAULT_MAGAZINE_CONTENT,
  type Magazine,
  type MagazineItem,
  type MagazineProductSnapshot,
  type MagazineTemplateId,
} from '@/types/magazine';
import { listTemplates } from '../components/templates/TemplateRegistry';

const PLACEHOLDER = '/placeholder.svg';

function snapshot(partial: Partial<MagazineProductSnapshot> & { id: string; name: string; sku: string }): MagazineProductSnapshot {
  return {
    id: partial.id,
    name: partial.name,
    sku: partial.sku,
    shortDescription: partial.shortDescription ?? '',
    description: partial.description ?? null,
    price: partial.price ?? 0,
    sale_price: partial.sale_price,
    image_url: partial.image_url ?? PLACEHOLDER,
    images: partial.images ?? [PLACEHOLDER],
    colors: partial.colors ?? [],
    category_name: partial.category_name ?? null,
    category_id: partial.category_id ?? null,
    materials: partial.materials ?? [],
    hasPersonalization: partial.hasPersonalization ?? true,
    dimensions: partial.dimensions,
  };
}

const PRODUCTS: MagazineProductSnapshot[] = [
  snapshot({
    id: 'mock-1',
    name: 'Garrafa Térmica Eco',
    sku: 'BR-1001',
    shortDescription: 'Garrafa térmica em aço inox 500ml com parede dupla e revestimento fosco.',
    price: 89.9,
    sale_price: 74.9,
    category_name: 'Drinkwares',
    image_url: PLACEHOLDER,
    materials: ['Aço inox 304', 'Silicone'],
    colors: [
      { name: 'Verde Musgo', hex: '#2e4a3a', group: 'Verde' },
      { name: 'Areia', hex: '#d4c9a8', group: 'Bege' },
    ],
    dimensions: { height_cm: 24, width_cm: 7, length_cm: 7, capacity_ml: 500, weight_g: 320 },
  }),
  snapshot({
    id: 'mock-2',
    name: 'Mochila Executiva Slim',
    sku: 'BR-1002',
    shortDescription: 'Mochila em poliéster reciclado com compartimento acolchoado para notebook 15".',
    price: 189.0,
    category_name: 'Bags',
    materials: ['Poliéster RPET', 'Nylon'],
    colors: [
      { name: 'Preto', hex: '#101010', group: 'Preto' },
      { name: 'Cinza Grafite', hex: '#3a3a3a', group: 'Cinza' },
    ],
    dimensions: { height_cm: 44, width_cm: 30, length_cm: 12, weight_g: 780 },
  }),
  snapshot({
    id: 'mock-3',
    name: 'Caneta Metalizada Prime',
    sku: 'BR-1003',
    shortDescription: 'Caneta esferográfica de metal com clip magnético e refil azul.',
    price: 24.5,
    category_name: 'Stationery',
    materials: ['Alumínio'],
    colors: [
      { name: 'Champagne', hex: '#c9a84c', group: 'Dourado' },
      { name: 'Grafite', hex: '#4a4a4a', group: 'Cinza' },
    ],
    dimensions: { height_cm: 14, width_cm: 1, length_cm: 1, weight_g: 22 },
  }),
  snapshot({
    id: 'mock-4',
    name: 'Caderno Capa Dura A5',
    sku: 'BR-1004',
    shortDescription: 'Caderno com 160 páginas pautadas, capa em couro sintético e elástico.',
    price: 59.9,
    category_name: 'Stationery',
    materials: ['Couro sintético', 'Papel 90g'],
    colors: [
      { name: 'Vinho', hex: '#5c1a2b', group: 'Vermelho' },
      { name: 'Marinho', hex: '#0c2340', group: 'Azul' },
    ],
    dimensions: { height_cm: 21, width_cm: 14, length_cm: 2, weight_g: 340 },
  }),
  snapshot({
    id: 'mock-5',
    name: 'Fone Bluetooth Studio',
    sku: 'BR-1005',
    shortDescription: 'Fone over-ear com cancelamento ativo de ruído e bateria de 30h.',
    price: 449.0,
    sale_price: 379.0,
    category_name: 'Technology',
    materials: ['ABS', 'Espuma memory'],
    colors: [
      { name: 'Preto Fosco', hex: '#0d0d0d', group: 'Preto' },
      { name: 'Branco Perolado', hex: '#f2f0eb', group: 'Branco' },
    ],
    dimensions: { height_cm: 20, width_cm: 18, length_cm: 8, weight_g: 260 },
  }),
  snapshot({
    id: 'mock-6',
    name: 'Camiseta Piquet Premium',
    sku: 'BR-1006',
    shortDescription: 'Camiseta gola polo em piquet 100% algodão penteado, botões em madrepérola.',
    price: 79.0,
    category_name: 'Wearables',
    materials: ['Algodão penteado'],
    colors: [
      { name: 'Branco', hex: '#ffffff', group: 'Branco' },
      { name: 'Verde Bandeira', hex: '#0f5132', group: 'Verde' },
    ],
    dimensions: { weight_g: 220 },
  }),
  snapshot({
    id: 'mock-7',
    name: 'Squeeze de Vidro 600ml',
    sku: 'BR-1007',
    shortDescription: 'Garrafa de vidro borossilicato com luva de silicone antiderrapante.',
    price: 42.9,
    category_name: 'Drinkwares',
    materials: ['Vidro borossilicato', 'Silicone'],
    colors: [
      { name: 'Cristal', hex: '#e8ecef', group: 'Transparente' },
      { name: 'Fumê', hex: '#4a4a55', group: 'Cinza' },
    ],
    dimensions: { height_cm: 22, width_cm: 7, length_cm: 7, capacity_ml: 600, weight_g: 380 },
  }),
  snapshot({
    id: 'mock-8',
    name: 'Power Bank 10.000mAh',
    sku: 'BR-1008',
    shortDescription: 'Carregador portátil com entrada USB-C PD 20W e display digital.',
    price: 149.0,
    category_name: 'Technology',
    materials: ['Alumínio', 'Bateria Li-Po'],
    colors: [
      { name: 'Preto', hex: '#111111', group: 'Preto' },
      { name: 'Prata', hex: '#c0c4c9', group: 'Prata' },
    ],
    dimensions: { height_cm: 14, width_cm: 7, length_cm: 1.5, weight_g: 210 },
  }),
  snapshot({
    id: 'mock-9',
    name: 'Kit Escritório Executivo',
    sku: 'BR-1009',
    shortDescription: 'Kit com caderno A5, caneta metálica e squeeze — embalagem presenteável.',
    price: 219.0,
    sale_price: 189.0,
    category_name: 'Gift Sets',
    materials: ['Couro sintético', 'Alumínio', 'Vidro'],
    colors: [
      { name: 'Preto & Dourado', hex: '#c9a84c', group: 'Dourado' },
    ],
    dimensions: { height_cm: 28, width_cm: 22, length_cm: 8, weight_g: 1200 },
  }),
];

function toItem(p: MagazineProductSnapshot, index: number): MagazineItem {
  return {
    id: `mock-item-${index}`,
    productId: p.id,
    productSnapshot: p,
    variantColorName: p.colors[0]?.name ?? null,
    position: index + 1,
    pageNumber: null,
    overrides: {},
  };
}

const ITEMS: MagazineItem[] = PRODUCTS.map(toItem);

/**
 * Fábrica de `Magazine` mock — recebe o templateId para o preview.
 * Todos os toggles de conteúdo ligados para revelar o máximo do template.
 */
export function buildMockMagazine(templateId: MagazineTemplateId): Magazine {
  return {
    id: `mock-${templateId}`,
    ownerId: 'mock-owner',
    organizationId: null,
    title: 'Coleção Corporativa 2026',
    subtitle: 'Uma seleção curada de brindes premium para elevar sua marca',
    templateId,
    branding: {
      clientName: 'ACME Corp',
      clientLogoUrl: null,
      clientCrmId: null,
      colors: { primary: '#0c2340', secondary: '#c9a84c', text: '#0f172a' },
      category: 'technology',
    },
    content: {
      ...DEFAULT_MAGAZINE_CONTENT,
      showDimensions: true,
      showMaterials: true,
      introText: 'Selecionamos o que há de melhor em brindes corporativos.',
      closingText: 'Fale com nosso time comercial para personalizar sua seleção.',
    },
    items: ITEMS,
    pageOrder: null,
    status: 'draft',
    publicToken: null,
    viewCount: 0,
    publishedAt: null,
    archivedAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Constrói uma página "products" com N itens do mock para o template solicitado.
 * Sempre respeita `productsPerPage` do registry.
 */
export function buildMockPage(templateId: MagazineTemplateId) {
  const entry = listTemplates().find((t) => t.id === templateId);
  const perPage = entry?.productsPerPage ?? 1;
  const items = ITEMS.slice(0, Math.min(perPage, ITEMS.length));
  return {
    index: 1,
    kind: 'products' as const,
    items,
  };
}
