/**
 * Hook: Recomendações de Técnicas baseadas em IA
 *
 * Analisa o produto selecionado e recomenda técnicas compatíveis
 * baseado no material, categoria e histórico de uso.
 */
import { useMemo } from 'react';
import type { Product, Technique } from '@/types/simulation';

// Mapeamento de materiais/categorias para técnicas recomendadas
const MATERIAL_TECHNIQUE_MAP: Record<string, string[]> = {
  // Têxteis
  algodão: ['SILK', 'SERIGRAFIA', 'DTF', 'SUB', 'BORD'],
  poliester: ['SUB', 'DTF', 'TRANSFER'],
  poliéster: ['SUB', 'DTF', 'TRANSFER'],
  nylon: ['DTF', 'TRANSFER'],
  tecido: ['SILK', 'SERIGRAFIA', 'DTF', 'SUB', 'BORD', 'TRANSFER'],
  camiseta: ['SILK', 'SERIGRAFIA', 'DTF', 'SUB'],
  camisa: ['SILK', 'SERIGRAFIA', 'DTF', 'BORD'],
  polo: ['BORD', 'SILK'],
  boné: ['BORD', 'SILK', 'TRANSFER'],
  sacola: ['SILK', 'SERIGRAFIA'],
  ecobag: ['SILK', 'SERIGRAFIA'],
  toalha: ['BORD', 'SUB'],
  manta: ['SUB', 'BORD'],
  mochila: ['BORD', 'SILK'],

  // Metais
  metal: ['LASER', 'GRAVACAO'],
  aço: ['LASER', 'GRAVACAO'],
  inox: ['LASER'],
  aluminio: ['LASER', 'GRAVACAO'],
  alumínio: ['LASER', 'GRAVACAO'],

  // Plásticos
  plastico: ['SILK', 'TRANSFER', 'TAMPOGRAFIA'],
  plástico: ['SILK', 'TRANSFER', 'TAMPOGRAFIA'],
  acrílico: ['LASER', 'UV'],
  acrilico: ['LASER', 'UV'],

  // Cerâmica/Porcelana
  porcelana: ['SUB', 'DECALQUE'],
  ceramica: ['SUB', 'DECALQUE'],
  cerâmica: ['SUB', 'DECALQUE'],
  caneca: ['SUB', 'DECALQUE', 'UV'],

  // Vidro
  vidro: ['LASER', 'JATEAMENTO', 'UV'],
  cristal: ['LASER', 'JATEAMENTO'],

  // Couro
  couro: ['LASER', 'BORD', 'GRAVACAO'],
  courvin: ['BORD', 'GRAVACAO'],

  // Madeira
  madeira: ['LASER', 'GRAVACAO', 'UV'],
  bambu: ['LASER', 'GRAVACAO'],
  mdf: ['LASER', 'UV'],

  // Papel
  papel: ['OFFSET', 'UV', 'HOTSTAMP'],
  papelao: ['SILK', 'OFFSET'],
  papelão: ['SILK', 'OFFSET'],
  embalagem: ['OFFSET', 'SILK', 'HOTSTAMP'],

  // Categorias genéricas
  escritório: ['LASER', 'SILK', 'TAMPOGRAFIA'],
  escritorio: ['LASER', 'SILK', 'TAMPOGRAFIA'],
  escolar: ['SILK', 'TAMPOGRAFIA', 'TRANSFER'],
  esportivo: ['SUB', 'DTF', 'SILK'],
  tecnologia: ['LASER', 'UV', 'SILK'],
  bebida: ['LASER', 'SUB', 'UV'],
  cozinha: ['LASER', 'SUB'],
  automotivo: ['LASER', 'UV'],
};

// Scoring de popularidade base (histórico simulado)
const POPULARITY_SCORES: Record<string, number> = {
  SILK: 95,
  SERIGRAFIA: 90,
  DTF: 85,
  SUB: 80,
  BORD: 75,
  LASER: 70,
  TRANSFER: 65,
  TAMPOGRAFIA: 60,
  UV: 55,
  HOTSTAMP: 50,
  GRAVACAO: 45,
  OFFSET: 40,
  DECALQUE: 35,
  JATEAMENTO: 30,
};

export interface TechniqueRecommendation {
  techniqueId: string;
  techniqueCode: string;
  isRecommended: boolean;
  recommendationScore: number; // 0-100
  recommendationReason: string;
  popularityScore: number;
  matchedKeywords: string[];
}

export interface TechniqueWithRecommendation extends Technique {
  recommendation: TechniqueRecommendation;
}

export interface UseTechniqueRecommendationsResult {
  recommendedTechniques: TechniqueWithRecommendation[];
  hasRecommendations: boolean;
  recommendationSummary: string;
}

/**
 * Extrai palavras-chave do produto para matching
 */
function extractKeywords(product: Product | null): string[] {
  if (!product) return [];

  const text = [product.name, product.category?.name, product.sku]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  // Extrair palavras individuais
  const words = text.split(/[\s\-_/,]+/).filter((w) => w.length > 2);

  return [...new Set(words)];
}

/**
 * Calcula score de recomendação para uma técnica
 */
function calculateRecommendationScore(
  technique: Technique,
  keywords: string[],
): { score: number; matchedKeywords: string[]; reason: string } {
  const code = technique.code?.toUpperCase() ?? '';
  const matchedKeywords: string[] = [];
  let score = 0;
  const reasons: string[] = [];

  // Verificar match com materiais/categorias
  for (const keyword of keywords) {
    const recommendedCodes = MATERIAL_TECHNIQUE_MAP[keyword];
    if (recommendedCodes?.some((rc) => code.includes(rc))) {
      score += 25;
      matchedKeywords.push(keyword);
    }
  }

  // Adicionar score de popularidade
  const popularityKey = Object.keys(POPULARITY_SCORES).find((k) => code.includes(k));
  const popularityScore = popularityKey ? POPULARITY_SCORES[popularityKey] : 30;
  score += popularityScore * 0.3; // 30% do peso para popularidade

  // Normalizar score para 0-100
  score = Math.min(100, Math.round(score));

  // Gerar razão
  if (matchedKeywords.length > 0) {
    reasons.push(`Ideal para ${matchedKeywords.slice(0, 2).join(', ')}`);
  }
  if (technique.estimated_days <= 3) {
    reasons.push('Entrega rápida');
  }
  if (technique.unit_cost < 2) {
    reasons.push('Ótimo custo-benefício');
  }

  return {
    score,
    matchedKeywords,
    reason: reasons.length > 0 ? reasons[0] : 'Técnica compatível',
  };
}

/**
 * Hook principal de recomendações
 */
export function useTechniqueRecommendations(
  techniques: Technique[] | undefined,
  selectedProduct: Product | null,
): UseTechniqueRecommendationsResult {
  const recommendedTechniques = useMemo(() => {
    if (!techniques || techniques.length === 0) {
      return [];
    }

    const keywords = extractKeywords(selectedProduct);

    return techniques.map((technique): TechniqueWithRecommendation => {
      const { score, matchedKeywords, reason } = calculateRecommendationScore(technique, keywords);

      const popularityKey = Object.keys(POPULARITY_SCORES).find((k) =>
        (technique.code?.toUpperCase() ?? '').includes(k),
      );
      const popularityScore = popularityKey ? POPULARITY_SCORES[popularityKey] : 30;

      return {
        ...technique,
        recommendation: {
          techniqueId: technique.id,
          techniqueCode: technique.code || '',
          isRecommended: score >= 40 && matchedKeywords.length > 0,
          recommendationScore: score,
          recommendationReason: reason,
          popularityScore,
          matchedKeywords,
        },
      };
    });
  }, [techniques, selectedProduct]);

  const hasRecommendations = useMemo(() => {
    return recommendedTechniques.some((t) => t.recommendation.isRecommended);
  }, [recommendedTechniques]);

  const recommendationSummary = useMemo(() => {
    if (!selectedProduct) {
      return 'Selecione um produto para ver recomendações';
    }

    const recommended = recommendedTechniques.filter((t) => t.recommendation.isRecommended);
    if (recommended.length === 0) {
      return 'Todas as técnicas são compatíveis';
    }

    return `${recommended.length} técnica(s) recomendada(s) para ${selectedProduct.name}`;
  }, [recommendedTechniques, selectedProduct]);

  return {
    recommendedTechniques,
    hasRecommendations,
    recommendationSummary,
  };
}

export type SortOption =
  | 'popularity'
  | 'price_asc'
  | 'price_desc'
  | 'recommended'
  | 'time_asc'
  | 'time_desc';

/**
 * Ordena técnicas por critério
 */
export function sortTechniques(
  techniques: TechniqueWithRecommendation[],
  sortBy: SortOption,
  selectedIds: string[] = [],
): TechniqueWithRecommendation[] {
  const sorted = [...techniques].sort((a, b) => {
    // Selecionadas sempre primeiro
    const aSelected = selectedIds.includes(a.id);
    const bSelected = selectedIds.includes(b.id);
    if (aSelected && !bSelected) return -1;
    if (!aSelected && bSelected) return 1;

    switch (sortBy) {
      case 'recommended':
        // Por score de recomendação
        if (a.recommendation.isRecommended && !b.recommendation.isRecommended) return -1;
        if (!a.recommendation.isRecommended && b.recommendation.isRecommended) return 1;
        return b.recommendation.recommendationScore - a.recommendation.recommendationScore;

      case 'price_asc':
        return a.unit_cost - b.unit_cost;

      case 'price_desc':
        return b.unit_cost - a.unit_cost;

      case 'time_asc':
        return a.estimated_days - b.estimated_days;

      case 'time_desc':
        return b.estimated_days - a.estimated_days;

      case 'popularity':
        return b.recommendation.popularityScore - a.recommendation.popularityScore;

      default:
        return 0;
    }
  });

  return sorted;
}
