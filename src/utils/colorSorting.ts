// Utilitário para ordenação padronizada de cores
// Ordem definida pelo PO (2026-06-14):
// 1-Preto → 2-Branco → 3-Prata/Cinza → 4-Verde → 5-Laranja → 6-Azul → 7-Vermelho
// → 8-Amarelo → 9-Rosa → 10-Roxo → 11-Marrom → 99-Outros
// Dentro de cada grupo: Escuro → Claro

const COLOR_GROUP_ORDER: Record<string, number> = {
  // 1 - Preto
  preto: 1,
  negro: 1,
  black: 1,

  // 2 - Branco
  branco: 2,
  white: 2,

  // 3 - Prata / Cinza
  prata: 3,
  silver: 3,
  cinza: 3,
  gray: 3,
  grey: 3,
  chumbo: 3,
  grafite: 3,

  // 4 - Verde
  verde: 4,
  green: 4,
  musgo: 4,
  oliva: 4,
  lima: 4,
  menta: 4,
  esmeralda: 4,

  // 5 - Laranja
  laranja: 5,
  orange: 5,
  coral: 5,
  salmão: 5,
  tangerina: 5,
  pêssego: 5,

  // 6 - Azul
  azul: 6,
  blue: 6,
  marinho: 6,
  navy: 6,
  royal: 6,
  celeste: 6,
  turquesa: 6,
  cobalto: 6,
  indigo: 6,

  // 7 - Vermelho
  vermelho: 7,
  red: 7,
  bordô: 7,
  vinho: 7,
  burgundy: 7,
  escarlate: 7,
  carmim: 7,
  rubi: 7,

  // 8 - Amarelo
  amarelo: 8,
  yellow: 8,
  dourado: 8,
  gold: 8,
  ouro: 8,
  mostarda: 8,

  // 9 - Rosa
  rosa: 9,
  pink: 9,
  magenta: 9,
  fúcsia: 9,
  fucsia: 9,

  // 10 - Roxo
  roxo: 10,
  purple: 10,
  violeta: 10,
  lilás: 10,
  lavanda: 10,
  uva: 10,
  berinjela: 10,

  // 11 - Marrom
  marrom: 11,
  brown: 11,
  caramelo: 11,
  chocolate: 11,
  café: 11,
  bege: 11,
  nude: 11,
  creme: 11,
  terra: 11,
  mogno: 11,
};

// Palavras que indicam tons ESCUROS dentro de um grupo (prioridade 1 = aparece primeiro)
// IMPORTANTE: Não incluir palavras que já são grupos de cor (ex: 'marinho' é grupo azul, não modificador)
const DARK_MODIFIERS: string[] = [
  'escuro',
  'escura',
  'dark',
  'noite',
  'night',
  'midnight',
  'meia-noite',
  'deep',
  'profundo',
  'profunda',
  'militar',
  'floresta',
  'forest',
  'petróleo',
  'petroleum',
];

// Palavras que indicam tons CLAROS dentro de um grupo (prioridade 3 = aparece por último)
// IMPORTANTE: Não incluir nomes que já são grupos de cor (ex: 'rosa', 'coral', 'salmão')
const LIGHT_MODIFIERS: string[] = [
  'claro',
  'clara',
  'light',
  'baby',
  'bebê',
  'bebe',
  'pastel',
  'soft',
  'suave',
  'sky',
  'céu',
  'ceu',
  'agua',
  'água',
  'aqua',
  'gelo',
  'ice',
  'neve',
  'snow',
  'off-white',
  'offwhite',
  'pálido',
  'palido',
  'pale',
];

// Palavras que indicam tons MÉDIOS/VIBRANTES (prioridade 2 = no meio)
const MEDIUM_MODIFIERS: string[] = [
  'royal',
  'real',
  'neon',
  'fluorescente',
  'vivo',
  'viva',
  'brilhante',
  'bright',
  'elétrico',
  'eletrico',
  'electric',
  'tiffany',
];

// Palavras que indicam variação escura ESPECÍFICA do grupo (não modificadores genéricos)
// São cores por si só, mas dentro do seu grupo representam tons escuros
const DARK_SPECIFIC_COLORS: Record<string, boolean> = {
  marinho: true, // Dentro de Azuis → é o mais escuro
  navy: true,
  cobalto: true,
  indigo: true,
  musgo: true, // Dentro de Verdes → escuro
  oliva: true,
  floresta: true,
  vinho: true, // Dentro de Vermelhos → escuro
  bordô: true,
  burgundy: true,
  carmim: true,
  mostarda: true, // Dentro de Amarelos → mais escuro/opaco
  magenta: true, // Dentro de Rosas → mais vibrante/escuro
  fúcsia: true,
  fucsia: true,
  berinjela: true, // Dentro de Roxos → mais escuro
  chocolate: true, // Dentro de Marrons → escuro
  café: true,
  mogno: true,
  grafite: true, // Dentro de Cinzas → escuro
  chumbo: true,
};

// Palavras que indicam variação clara ESPECÍFICA do grupo
const LIGHT_SPECIFIC_COLORS: Record<string, boolean> = {
  celeste: true, // Dentro de Azuis → claro
  turquesa: true,
  lima: true, // Dentro de Verdes → claro
  menta: true,
  coral: true, // Dentro de Laranjas → mais claro/vibrante
  salmão: true,
  pêssego: true,
  tangerina: true,
  rosa: true, // Dentro de Rosas → quando é "rosa" puro, é claro
  lilás: true, // Dentro de Roxos → claro
  lavanda: true,
  bege: true, // Dentro de Marrons → claro
  nude: true,
  creme: true,
  caramelo: true,
  prata: true, // Dentro de Cinzas → claro
  silver: true,
};

/**
 * Detecta o grupo de cor baseado no nome
 */
function getColorGroup(colorName: string): number {
  if (!colorName) return 99;

  const normalized = colorName
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  // Procura por palavras-chave no nome da cor
  for (const [keyword, order] of Object.entries(COLOR_GROUP_ORDER)) {
    const normalizedKeyword = keyword.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (normalized.includes(normalizedKeyword)) {
      return order;
    }
  }

  // Cor não identificada vai para o final
  return 99;
}

/**
 * Calcula luminosidade a partir de um hex color (0 = escuro, 1 = claro)
 * Retorna 0.5 (médio) se hex inválido
 */
function getLuminanceFromHex(hex: string | undefined | null): number {
  if (!hex) return 0.5;

  // Remove # se existir e limpa espaços
  const cleanHex = hex.replace('#', '').trim();

  // Valida se é um hex válido de 6 caracteres
  if (!/^[0-9A-Fa-f]{6}$/.test(cleanHex)) {
    // Tenta expandir hex de 3 caracteres (ex: "FFF" → "FFFFFF")
    if (/^[0-9A-Fa-f]{3}$/.test(cleanHex)) {
      const expanded = cleanHex
        .split('')
        .map((c) => c + c)
        .join('');
      return getLuminanceFromHex(expanded);
    }
    return 0.5; // Hex inválido, retorna valor médio
  }

  // Converte para RGB
  const r = parseInt(cleanHex.substring(0, 2), 16) / 255;
  const g = parseInt(cleanHex.substring(2, 4), 16) / 255;
  const b = parseInt(cleanHex.substring(4, 6), 16) / 255;

  // Valida se parse foi bem-sucedido
  if (isNaN(r) || isNaN(g) || isNaN(b)) {
    return 0.5;
  }

  // Fórmula de luminância relativa (percepção humana)
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

/**
 * Detecta prioridade de luminosidade baseado no nome da cor
 * Retorna: 1 = escuro, 2 = médio, 3 = claro
 */
function getLuminosityPriority(colorName: string): number {
  if (!colorName) return 2;

  const normalized = colorName
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  // 1. Primeiro verifica modificadores GENÉRICOS explícitos (mais importante)
  for (const modifier of DARK_MODIFIERS) {
    const normalizedMod = modifier.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (normalized.includes(normalizedMod)) {
      return 1; // Escuro primeiro
    }
  }

  for (const modifier of LIGHT_MODIFIERS) {
    const normalizedMod = modifier.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (normalized.includes(normalizedMod)) {
      return 3; // Claro por último
    }
  }

  for (const modifier of MEDIUM_MODIFIERS) {
    const normalizedMod = modifier.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (normalized.includes(normalizedMod)) {
      return 2; // Médio
    }
  }

  // 2. Depois verifica se é uma cor específica que indica tom escuro/claro
  for (const [colorKey, _] of Object.entries(DARK_SPECIFIC_COLORS)) {
    const normalizedKey = colorKey.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (normalized.includes(normalizedKey)) {
      return 1; // Variação escura do grupo
    }
  }

  for (const [colorKey, _] of Object.entries(LIGHT_SPECIFIC_COLORS)) {
    const normalizedKey = colorKey.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (normalized.includes(normalizedKey)) {
      return 3; // Variação clara do grupo
    }
  }

  // Padrão: médio (cores base como "Azul", "Verde", etc.)
  return 2;
}

/**
 * Ordena um array de itens por cor seguindo a ordem padrão
 * Primeiro por grupo de cor, depois do escuro para o claro
 * @param items Array de itens com propriedade de cor
 * @param getColorName Função para extrair o nome da cor do item
 * @param getHex Função opcional para extrair o hex da cor (para ordenação mais precisa)
 */
export function sortByColorGroup<T>(
  items: T[],
  getColorName: (item: T) => string,
  getHex?: (item: T) => string | undefined,
): T[] {
  if (!items || items.length === 0) return [];

  return [...items].sort((a, b) => {
    const nameA = getColorName(a) || '';
    const nameB = getColorName(b) || '';

    const groupA = getColorGroup(nameA);
    const groupB = getColorGroup(nameB);

    // Primeiro ordena por grupo de cor
    if (groupA !== groupB) {
      return groupA - groupB;
    }

    // Dentro do mesmo grupo, ordena do escuro para o claro
    const lumPriorityA = getLuminosityPriority(nameA);
    const lumPriorityB = getLuminosityPriority(nameB);

    if (lumPriorityA !== lumPriorityB) {
      return lumPriorityA - lumPriorityB;
    }

    // Se temos hex disponível, usa luminância real como desempate
    if (getHex) {
      const hexA = getHex(a);
      const hexB = getHex(b);
      if (hexA && hexB) {
        const lumA = getLuminanceFromHex(hexA);
        const lumB = getLuminanceFromHex(hexB);
        // Escuro primeiro (menor luminância primeiro)
        if (Math.abs(lumA - lumB) > 0.05) {
          return lumA - lumB;
        }
      }
    }

    // Fallback: ordena alfabeticamente
    return nameA.localeCompare(nameB, 'pt-BR');
  });
}

/**
 * Ordena variações de produto por cor (escuro → claro)
 */
export function sortVariationsByColor<T extends { color: { name: string; hex?: string } }>(
  variations: T[],
): T[] {
  if (!variations || variations.length === 0) return [];

  return sortByColorGroup(
    variations,
    (v) => v.color?.name ?? '',
    (v) => v.color?.hex,
  );
}

/**
 * Ordena resumo de cores para FutureStockModal (escuro → claro)
 */
export function sortColorSummary<T extends { name: string; hex?: string | null }>(
  colors: T[],
): T[] {
  if (!colors || colors.length === 0) return [];

  return sortByColorGroup(
    colors,
    (c) => c.name || '',
    (c) => c.hex ?? undefined,
  );
}
