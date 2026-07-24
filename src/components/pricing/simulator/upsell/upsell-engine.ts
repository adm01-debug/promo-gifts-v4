/**
 * upsell-engine — Motor de sugestões inteligentes de upsell/cross-sell.
 * Lógica pura (sem dependências React) para geração e ranqueamento de sugestões.
 */
import type { ProductTechnique, ConfiguredEngraving } from '../types';

// ============================================
// TIPOS
// ============================================

export type UpsellType = 'add_position' | 'complementary' | 'quantity_tier' | 'technique_upgrade';

export type UpsellPriority = 'high' | 'low' | 'medium';

export interface UpsellSuggestion {
  id: string;
  type: UpsellType;
  title: string;
  description: string;
  impact: string;
  priority: UpsellPriority;
}

// ============================================
// CONSTANTES
// ============================================

/** Faixas de quantidade com desconto progressivo */
export const QUANTITY_TIERS = [50, 100, 250, 500, 1000, 2500] as const;

/** Ranking de técnicas por qualidade percebida (maior = melhor) */
const TECHNIQUE_RANKING: Record<string, number> = {
  TRF: 1, // transfer
  ADH: 1, // adesivo
  SER: 2, // serigrafia
  TAMP: 2, // tampografia
  SUB: 3, // sublimação
  UV: 3, // UV digital
  HOT: 4, // hot stamping
  GRA: 4, // gravação laser
  BOR: 5, // bordado
};

/** Mapa de produtos complementares por categoria */
const COMPLEMENTARY_MAP: Record<string, string[]> = {
  Canetas: ['Cadernos', 'Blocos de notas', 'Estojos'],
  Mochilas: ['Squeezes', 'Cadernos', 'Necessaires'],
  Squeezes: ['Toalhas', 'Mochilas', 'Bonés'],
  Camisetas: ['Bonés', 'Ecobags', 'Squeeze'],
  Cadernos: ['Canetas', 'Marcadores', 'Pastas'],
  Bonés: ['Camisetas', 'Mochilas', 'Sacolas'],
  Ecobags: ['Squeezes', 'Canetas', 'Cadernos'],
  Necessaires: ['Squeezes', 'Toalhas', 'Canetas'],
  Toalhas: ['Squeezes', 'Necessaires', 'Mochilas'],
  Sacolas: ['Canetas', 'Cadernos', 'Squeezes'],
  Pastas: ['Canetas', 'Cadernos', 'Blocos de notas'],
  Copos: ['Squeezes', 'Canetas', 'Cadernos'],
  Chaveiros: ['Canetas', 'Cordões', 'Adesivos'],
  Agendas: ['Canetas', 'Cadernos', 'Marcadores'],
  Guarda_chuvas: ['Bonés', 'Mochilas', 'Camisetas'],
};

/** Limiar: só sugere próxima faixa se faltar ≤30% da quantidade atual */
const TIER_PROXIMITY_THRESHOLD = 0.3;

/** Limiar alto: se faltar ≤15%, prioridade alta */
const TIER_HIGH_PRIORITY_THRESHOLD = 0.15;

// ============================================
// GERADORES INDIVIDUAIS
// ============================================

function suggestAddPosition(
  currentEngravings: ConfiguredEngraving[],
  availableTechniques: ProductTechnique[],
): UpsellSuggestion | null {
  if (currentEngravings.length === 0) return null;

  const usedLocations = new Set(currentEngravings.map((e) => e.technique.locationCode));
  const unused = availableTechniques.find((t) => !usedLocations.has(t.locationCode));

  if (!unused) return null;

  return {
    id: `add-pos-${unused.locationCode}`,
    type: 'add_position',
    title: `Adicionar gravação em ${unused.locationName}`,
    description: `O ${unused.componentName} tem espaço em "${unused.locationName}" disponível para personalização.`,
    impact: 'Maior visibilidade da marca',
    priority: 'high',
  };
}

function suggestTechniqueUpgrades(
  currentEngravings: ConfiguredEngraving[],
  availableTechniques: ProductTechnique[],
): UpsellSuggestion[] {
  const suggestions: UpsellSuggestion[] = [];

  for (const eng of currentEngravings) {
    const currentRank = TECHNIQUE_RANKING[eng.technique.techniqueCode] ?? 0;
    const upgrades = availableTechniques.filter(
      (t) =>
        t.locationCode === eng.technique.locationCode &&
        (TECHNIQUE_RANKING[t.techniqueCode] ?? 0) > currentRank,
    );

    if (upgrades.length > 0) {
      const best = upgrades[0];
      suggestions.push({
        id: `upgrade-${eng.id}-${best.techniqueCode}`,
        type: 'technique_upgrade',
        title: `Upgrade: ${eng.technique.techniqueName} → ${best.techniqueName}`,
        description: `Técnica premium com acabamento superior na posição "${best.locationName}".`,
        impact: 'Maior durabilidade e percepção de qualidade',
        priority: 'medium',
      });
    }
  }

  return suggestions;
}

function suggestQuantityTier(quantity: number): UpsellSuggestion | null {
  if (quantity <= 0) return null;

  const nextTier = QUANTITY_TIERS.find((t) => t > quantity);
  if (!nextTier) return null;

  const diff = nextTier - quantity;
  if (diff > quantity * TIER_PROXIMITY_THRESHOLD) return null;

  return {
    id: `qty-tier-${nextTier}`,
    type: 'quantity_tier',
    title: `Aumente para ${nextTier} unidades`,
    description: `Faltam apenas ${diff} unidades para a próxima faixa de preço com desconto progressivo.`,
    impact: 'Potencial redução no custo unitário',
    priority: diff <= quantity * TIER_HIGH_PRIORITY_THRESHOLD ? 'high' : 'medium',
  };
}

function suggestComplementary(categoryName?: string | null): UpsellSuggestion | null {
  if (!categoryName) return null;

  const complements = COMPLEMENTARY_MAP[categoryName];
  if (!complements?.length) return null;

  return {
    id: `complementary-${categoryName}`,
    type: 'complementary',
    title: `Combine com ${complements[0]}`,
    description: `Clientes que compram ${categoryName} frequentemente levam ${complements.slice(0, 2).join(' e ')}.`,
    impact: 'Aumento do ticket médio',
    priority: 'low',
  };
}

// ============================================
// ORQUESTRADOR
// ============================================

const PRIORITY_ORDER: Record<UpsellPriority, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

/**
 * Gera sugestões de upsell/cross-sell ordenadas por prioridade.
 */
export function generateSuggestions(
  currentEngravings: ConfiguredEngraving[],
  availableTechniques: ProductTechnique[],
  quantity: number,
  categoryName?: string | null,
): UpsellSuggestion[] {
  const suggestions: UpsellSuggestion[] = [];

  const positionSuggestion = suggestAddPosition(currentEngravings, availableTechniques);
  if (positionSuggestion) suggestions.push(positionSuggestion);

  suggestions.push(...suggestTechniqueUpgrades(currentEngravings, availableTechniques));

  const tierSuggestion = suggestQuantityTier(quantity);
  if (tierSuggestion) suggestions.push(tierSuggestion);

  const complementarySuggestion = suggestComplementary(categoryName);
  if (complementarySuggestion) suggestions.push(complementarySuggestion);

  return suggestions.sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]);
}
