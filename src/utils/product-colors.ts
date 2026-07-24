/**
 * Product Color Utilities
 *
 * Color detection, hex lookup, and normalization for product variants.
 */
import type { ProductColor } from '@/types/product-catalog';

// Cores base para detecção de grupo
const COLOR_GROUP_KEYWORDS: Record<string, string[]> = {
  Azul: ['azul', 'blue', 'marinho', 'celeste', 'royal', 'turquesa', 'petróleo', 'navy'],
  Verde: ['verde', 'green', 'limão', 'menta', 'musgo', 'oliva', 'esmeralda', 'lime', 'neon'],
  Vermelho: ['vermelho', 'red', 'bordô', 'vinho', 'cereja', 'coral', 'carmim', 'rubi'],
  Amarelo: ['amarelo', 'yellow', 'dourado', 'ouro', 'gold', 'mostarda'],
  Laranja: ['laranja', 'orange', 'tangerina', 'pêssego'],
  Rosa: ['rosa', 'pink', 'magenta', 'fúcsia', 'salmão', 'flamingo', 'rosa bebê'],
  Roxo: ['roxo', 'purple', 'lilás', 'violeta', 'lavanda', 'uva'],
  Preto: ['preto', 'black', 'negro', 'grafite', 'chumbo'],
  Branco: ['branco', 'white', 'off-white', 'creme', 'gelo', 'pérola', 'neve'],
  Cinza: ['cinza', 'gray', 'grey', 'prata', 'silver', 'acetinado', 'fosco', 'cromado'],
  Marrom: [
    'marrom',
    'brown',
    'chocolate',
    'café',
    'caramelo',
    'bege',
    'nude',
    'areia',
    'natural',
    'palha',
    'terra',
  ],
  Transparente: ['transparente', 'transparent', 'cristal', 'clear', 'incolor'],
};

// Mapeamento de cores conhecidas para hexadecimais
const KNOWN_COLOR_HEX: Record<string, string> = {
  preto: '#000000',
  branco: '#FFFFFF',
  cinza: '#808080',
  'cinza claro': '#C0C0C0',
  'cinza grafite': '#2F2F2F',
  azul: '#0000FF',
  'azul royal': '#4169E1',
  'azul marinho': '#000080',
  'azul celeste': '#87CEEB',
  'azul petróleo': '#0D4F5C',
  vermelho: '#FF0000',
  'vermelho bordô': '#800020',
  vinho: '#722F37',
  verde: '#008000',
  'verde neon': '#39FF14',
  'verde claro': '#90EE90',
  'verde musgo': '#556B2F',
  'verde militar': '#4B5320',
  amarelo: '#FFFF00',
  dourado: '#FFD700',
  mostarda: '#FFDB58',
  laranja: '#EF941B',
  coral: '#FF7F50',
  salmão: '#FA8072',
  rosa: '#FFC0CB',
  'rosa flamingo': '#FC8EAC',
  'rosa bebê': '#F4C2C2',
  magenta: '#FF00FF',
  fúcsia: '#FF00FF',
  roxo: '#800080',
  lilás: '#C8A2C8',
  violeta: '#EE82EE',
  lavanda: '#E6E6FA',
  marrom: '#8B4513',
  bege: '#F5F5DC',
  'bege palha': '#CCAA92',
  natural: '#BB8B64',
  nude: '#E3BC9A',
  caramelo: '#FFD59A',
  chocolate: '#7B3F00',
  café: '#6F4E37',
  prata: '#C0C0C0',
  'prata cromado': '#D8DBDE',
  'prata acetinado (fosco)': '#868686',
  cromado: '#E8E8E8',
  ouro: '#FFD700',
};

/** Busca hex em mapeamento conhecido */
export function findKnownHex(colorName: string): string | null {
  if (!colorName) return null;
  const nameLower = colorName
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

  for (const [key, hex] of Object.entries(KNOWN_COLOR_HEX)) {
    const keyNorm = key.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (keyNorm === nameLower) return hex;
  }
  for (const [key, hex] of Object.entries(KNOWN_COLOR_HEX)) {
    const keyNorm = key.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (nameLower.includes(keyNorm) || keyNorm.includes(nameLower)) return hex;
  }
  return null;
}

export function detectColorGroup(colorName: string): string {
  const nameLower = colorName.toLowerCase().trim();
  for (const [group, keywords] of Object.entries(COLOR_GROUP_KEYWORDS)) {
    if (keywords.some((kw) => nameLower.includes(kw))) return group;
  }
  const firstWord = nameLower.split(/[\s-]+/)[0];
  return firstWord.charAt(0).toUpperCase() + firstWord.slice(1);
}

/** Normaliza array de cores (strings ou objetos) para formato padronizado */
export function normalizeColors(colors: unknown[] | undefined): ProductColor[] {
  if (!colors || !Array.isArray(colors)) return [];

  return colors.map((c: unknown) => {
    if (typeof c === 'string') {
      const name = c || 'Sem cor';
      return {
        name,
        hex: findKnownHex(name) || '#CCCCCC',
        group: detectColorGroup(name),
        code: undefined,
      };
    }

    const co = c as Record<string, unknown>;
    const name = String(co.name || co.color_name || 'Sem cor');
    const groupSlug = co.groupSlug ? String(co.groupSlug) : undefined;
    const variationSlug = co.variationSlug ? String(co.variationSlug) : undefined;
    const group = String(co.groupName || co.group || co.color_group || detectColorGroup(name));

    let hex = (co.hex || co.hex_code || co.color_hex) as string | null | undefined;
    if (!hex || hex === '#CCCCCC') {
      const knownHex = findKnownHex(name);
      if (knownHex) hex = knownHex;
    }

    const images =
      Array.isArray(co.images) && co.images.length ? (co.images as string[]) : undefined;
    return {
      name,
      hex: hex || '#CCCCCC',
      group,
      groupSlug,
      variationSlug,
      code:
        co.code || co.color_code || co.supplier_code
          ? String(co.code || co.color_code || co.supplier_code)
          : undefined,
      image: co.image ? String(co.image) : undefined,
      images,
    };
  });
}
