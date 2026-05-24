/**
 * Domain Selectors: PersonalizaÃ§Ã£o
 *
 * FunÃ§Ãµes puras para seleÃ§Ã£o e filtragem de dados.
 */

import type {
  PriceTableInput,
  TechniqueInput,
  TableSelectionCriteria,
  ColorOption,
  SizeOption,
  PriceTier,
} from './types';

// ============================================
// TABLE SELECTION
// ============================================

/**
 * Seleciona a melhor tabela de preÃ§o para os critÃ©rios dados
 * Prioridade: cores -> dimensÃµes -> primeira disponÃ­vel
 */
export function selectBestTable(
  tables: PriceTableInput[],
  criteria: TableSelectionCriteria,
): PriceTableInput | null {
  if (tables.length === 0) return null;

  // Filtrar apenas tabelas ativas
  let candidates = tables.filter((t) => t.isActive);

  if (candidates.length === 0) return null;

  // Filtrar por nome da tÃ©cnica
  if (criteria.techniqueName) {
    const techniqueName = criteria.techniqueName.toLowerCase();
    const byName = candidates.filter((t) => t.techniqueName.toLowerCase().includes(techniqueName));
    if (byName.length > 0) candidates = byName;
  }

  // Filtrar por cÃ³digo da tÃ©cnica
  if (criteria.techniqueCode) {
    const techniqueCode = criteria.techniqueCode.toLowerCase();
    const byCode = candidates.filter(
      (t) =>
        t.tableCode.toLowerCase().includes(techniqueCode) ||
        techniqueCode.includes(t.tableCode.toLowerCase()),
    );
    if (byCode.length > 0) candidates = byCode;
  }

  // Ordenar por nÃºmero de cores (preferir a que atende exatamente)
  if (criteria.colors) {
    const colors = criteria.colors;
    candidates.sort((a, b) => {
      const aFits = a.maxColors !== null && a.maxColors >= colors;
      const bFits = b.maxColors !== null && b.maxColors >= colors;

      if (aFits && !bFits) return -1;
      if (!aFits && bFits) return 1;

      // Preferir a menor que ainda atende
      if (aFits && bFits) {
        return (a.maxColors || 0) - (b.maxColors || 0);
      }

      // Se nenhuma atende, preferir a maior
      return (b.maxColors || 0) - (a.maxColors || 0);
    });
  }

  // Filtrar por dimensÃµes
  if (criteria.widthCm && criteria.heightCm) {
    const widthCm = criteria.widthCm;
    const heightCm = criteria.heightCm;
    const byDimensions = candidates.filter(
      (t) =>
        (t.maxWidthCm === null || t.maxWidthCm >= widthCm) &&
        (t.maxHeightCm === null || t.maxHeightCm >= heightCm),
    );
    if (byDimensions.length > 0) candidates = byDimensions;
  }

  return candidates[0];
}

/**
 * Filtra tabelas por tÃ©cnica
 */
export function filterTablesByTechnique(
  tables: PriceTableInput[],
  techniqueName: string,
): PriceTableInput[] {
  const normalized = techniqueName.toLowerCase();

  return tables.filter(
    (t) =>
      t.techniqueName.toLowerCase().includes(normalized) ||
      t.tableCode.toLowerCase().includes(normalized),
  );
}

/**
 * Agrupa tabelas por nome de tÃ©cnica
 */
export function groupTablesByTechnique(tables: PriceTableInput[]): Map<string, PriceTableInput[]> {
  const grouped = new Map<string, PriceTableInput[]>();

  for (const table of tables) {
    const key = table.techniqueName;
    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    grouped.get(key)?.push(table);
  }

  return grouped;
}

// ============================================
// TECHNIQUE SELECTION
// ============================================

/**
 * Filtra tÃ©cnicas por categoria
 */
export function filterTechniquesByCategory(
  techniques: TechniqueInput[],
  category: string,
): TechniqueInput[] {
  return techniques.filter(
    (t) => t.category.toLowerCase() === category.toLowerCase() && t.isActive,
  );
}

/**
 * Retorna tÃ©cnicas Ãºnicas (por cÃ³digo)
 */
export function getUniqueTechniques(techniques: TechniqueInput[]): TechniqueInput[] {
  const seen = new Set<string>();
  return techniques.filter((t) => {
    if (seen.has(t.code)) return false;
    seen.add(t.code);
    return true;
  });
}

/**
 * Retorna categorias Ãºnicas das tÃ©cnicas
 */
export function getUniqueCategories(techniques: TechniqueInput[]): string[] {
  const categories = [...new Set(techniques.map((t) => t.category))];
  return categories.sort();
}

// ============================================
// OPTIONS EXTRACTION
// ============================================

/**
 * Extrai opÃ§Ãµes de cores disponÃ­veis das tabelas
 */
export function extractColorOptions(
  tables: PriceTableInput[],
  hasPriceByColor: boolean,
): ColorOption[] {
  if (!hasPriceByColor || tables.length === 0) return [];

  // Coletar todos os maxColors Ãºnicos
  const uniqueColors = [
    ...new Set(tables.map((t) => t.maxColors).filter((c): c is number => c !== null && c > 0)),
  ].sort((a, b) => a - b);

  // Se sÃ³ hÃ¡ um valor, criar opÃ§Ãµes de 1 atÃ© o mÃ¡ximo
  if (uniqueColors.length <= 1) {
    const maxColors = uniqueColors[0] || 4;
    return Array.from({ length: maxColors }, (_, i) => ({
      value: i + 1,
      label: `${i + 1} ${i === 0 ? 'cor' : 'cores'}`,
    }));
  }

  // Se hÃ¡ variaÃ§Ã£o, usar os valores disponÃ­veis
  return uniqueColors.map((c) => ({
    value: c,
    label: `${c} ${c === 1 ? 'cor' : 'cores'}`,
  }));
}

/**
 * Extrai opÃ§Ãµes de tamanho disponÃ­veis das tabelas
 */
export function extractSizeOptions(tables: PriceTableInput[]): SizeOption[] {
  if (tables.length === 0) return [];

  const uniqueAreas = new Map<string, SizeOption>();

  for (const table of tables) {
    const width = table.maxWidthCm;
    const height = table.maxHeightCm;

    if (width && height && width > 0 && height > 0) {
      const key = `${width}x${height}`;
      if (!uniqueAreas.has(key)) {
        uniqueAreas.set(key, {
          label: `${width} x ${height} cm`,
          value: key,
          width,
          height,
          areaCm2: width * height,
          priceModifier: 1,
        });
      }
    }
  }

  // Ordenar por Ã¡rea
  return Array.from(uniqueAreas.values()).sort((a, b) => a.areaCm2 - b.areaCm2);
}

/**
 * Extrai quantidades sugeridas das faixas
 */
export function extractQuantityOptions(tiers: PriceTier[]): number[] {
  if (tiers.length === 0) return [1, 10, 50, 100, 500];

  return tiers.map((t) => t.minQuantity).sort((a, b) => a - b);
}

// ============================================
// SCORING & RANKING
// ============================================

/**
 * Calcula score de compatibilidade entre tabela e critÃ©rios
 * Maior score = melhor match
 */
export function calculateTableScore(
  table: PriceTableInput,
  criteria: TableSelectionCriteria,
): number {
  let score = 0;

  // Base: tabela ativa
  if (table.isActive) score += 100;

  // Match por nome
  if (criteria.techniqueName) {
    const nameMatch = table.techniqueName
      .toLowerCase()
      .includes(criteria.techniqueName.toLowerCase());
    if (nameMatch) score += 50;
  }

  // Match por cÃ³digo
  if (criteria.techniqueCode) {
    const codeMatch = table.tableCode.toLowerCase().includes(criteria.techniqueCode.toLowerCase());
    if (codeMatch) score += 50;
  }

  // Match por cores
  if (criteria.colors && table.maxColors !== null) {
    if (table.maxColors >= criteria.colors) {
      // Quanto mais prÃ³ximo do necessÃ¡rio, melhor
      score += 30 - Math.min(table.maxColors - criteria.colors, 30);
    } else {
      score -= 20; // Penaliza se nÃ£o atende
    }
  }

  // Match por dimensÃµes
  if (criteria.widthCm && criteria.heightCm) {
    const fitsWidth = table.maxWidthCm === null || table.maxWidthCm >= criteria.widthCm;
    const fitsHeight = table.maxHeightCm === null || table.maxHeightCm >= criteria.heightCm;

    if (fitsWidth && fitsHeight) score += 20;
    else score -= 10;
  }

  return score;
}

/**
 * Ordena tabelas por score de compatibilidade
 */
export function rankTablesByCriteria(
  tables: PriceTableInput[],
  criteria: TableSelectionCriteria,
): PriceTableInput[] {
  return [...tables].sort((a, b) => {
    const scoreA = calculateTableScore(a, criteria);
    const scoreB = calculateTableScore(b, criteria);
    return scoreB - scoreA;
  });
}
