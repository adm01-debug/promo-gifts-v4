/**
 * print-area-grouping — Utilitário para agrupar áreas de personalização
 * por componente e localização, facilitando exibição hierárquica no simulador.
 *
 * Features:
 * - Agrupamento hierárquico: Componente → Localização → Técnicas
 * - Priorização de áreas primárias
 * - Filtragem por técnica
 * - Estatísticas e resumos
 * - Detecção de área máxima por grupo
 */
import type { PrintAreaWithTechniques, GroupedPrintArea } from '@/types/gravacao';

// ============================================
// AGRUPAMENTO PRINCIPAL
// ============================================

/**
 * Agrupa áreas de impressão/personalização por componente → localização → técnicas.
 * Áreas sem componente são agrupadas sob "Produto" (default).
 */
export function groupPrintAreasByComponent(areas: PrintAreaWithTechniques[]): GroupedPrintArea[] {
  if (!areas.length) return [];

  const componentMap = new Map<
    string,
    Map<string, GroupedPrintArea['locations'][number]['techniques']>
  >();

  for (const area of areas) {
    const compName = area.component_name || 'Produto';
    const locName = area.location_name || area.area_name || 'Padrão';

    let locMap = componentMap.get(compName);
    if (!locMap) {
      locMap = new Map();
      componentMap.set(compName, locMap);
    }

    let techniques = locMap.get(locName);
    if (!techniques) {
      techniques = [];
      locMap.set(locName, techniques);
    }

    for (const tech of area.techniques) {
      const code = tech.codigo;

      // Deduplicação: evita técnica duplicada na mesma localização+área
      const isDuplicate = techniques.some((t) => t.techniqueCode === code && t.id === area.area_id);
      if (isDuplicate) continue;

      techniques.push({
        id: area.area_id,
        areaName: area.area_name,
        techniqueCode: code,
        maxWidth: area.max_width ?? null,
        maxHeight: area.max_height ?? null,
        maxColors: null, // TecnicaSimples não carrega max_colors; preenchido downstream
        areaCm2:
          area.max_width && area.max_height
            ? Math.round(area.max_width * area.max_height * 100) / 100
            : null,
        isCurved: area.is_curved,
        isPrimary: area.is_primary,
        servCode: code,
      });
    }
  }

  const grouped: GroupedPrintArea[] = [];

  for (const [compName, locMap] of componentMap) {
    const locations: GroupedPrintArea['locations'] = [];

    for (const [locName, techniques] of locMap) {
      locations.push({
        locationName: locName,
        locationCode: locName.toLowerCase().replace(/\s+/g, '-'),
        techniques,
      });
    }

    // Sort: primary areas first
    locations.sort((a, b) => {
      const aPrimary = a.techniques.some((t) => t.isPrimary);
      const bPrimary = b.techniques.some((t) => t.isPrimary);
      if (aPrimary && !bPrimary) return -1;
      if (!aPrimary && bPrimary) return 1;
      return 0;
    });

    grouped.push({
      componentName: compName,
      componentCode: compName.toLowerCase().replace(/\s+/g, '-'),
      locations,
    });
  }

  // Sort: "Produto" first, then alphabetical
  grouped.sort((a, b) => {
    if (a.componentName === 'Produto') return -1;
    if (b.componentName === 'Produto') return 1;
    return a.componentName.localeCompare(b.componentName);
  });

  return grouped;
}

// ============================================
// FILTROS E CONSULTAS
// ============================================

/**
 * Retorna todas as técnicas únicas de todas as áreas agrupadas.
 */
export function getUniqueTechniques(groups: GroupedPrintArea[]): string[] {
  const set = new Set<string>();
  for (const g of groups) {
    for (const loc of g.locations) {
      for (const tech of loc.techniques) {
        set.add(tech.techniqueCode);
      }
    }
  }
  return [...set].sort();
}

/**
 * Filtra áreas agrupadas por técnica específica.
 */
export function filterGroupsByTechnique(
  groups: GroupedPrintArea[],
  techniqueCode: string,
): GroupedPrintArea[] {
  return groups
    .map((g) => ({
      ...g,
      locations: g.locations
        .map((loc) => ({
          ...loc,
          techniques: loc.techniques.filter((t) => t.techniqueCode === techniqueCode),
        }))
        .filter((loc) => loc.techniques.length > 0),
    }))
    .filter((g) => g.locations.length > 0);
}

/**
 * Filtra áreas agrupadas por componente específico.
 */
export function filterGroupsByComponent(
  groups: GroupedPrintArea[],
  componentName: string,
): GroupedPrintArea[] {
  return groups.filter((g) => g.componentName === componentName);
}

/**
 * Achata toda a hierarquia em uma lista plana de técnicas com contexto.
 * Útil para iteração simples no simulador.
 */
export interface FlattenedTechnique {
  componentName: string;
  componentCode: string;
  locationName: string;
  locationCode: string;
  techniqueCode: string;
  areaName: string;
  maxWidth: number | null;
  maxHeight: number | null;
  areaCm2: number | null;
  isPrimary: boolean;
  isCurved: boolean;
}

export function flattenTechniques(groups: GroupedPrintArea[]): FlattenedTechnique[] {
  const result: FlattenedTechnique[] = [];
  for (const g of groups) {
    for (const loc of g.locations) {
      for (const tech of loc.techniques) {
        result.push({
          componentName: g.componentName,
          componentCode: g.componentCode,
          locationName: loc.locationName,
          locationCode: loc.locationCode,
          techniqueCode: tech.techniqueCode,
          areaName: tech.areaName,
          maxWidth: tech.maxWidth,
          maxHeight: tech.maxHeight,
          areaCm2: tech.areaCm2,
          isPrimary: tech.isPrimary,
          isCurved: tech.isCurved,
        });
      }
    }
  }
  return result;
}

// CONTADORES E ESTATÍSTICAS
// ============================================

/**
 * Conta o total de áreas de impressão em todos os grupos.
 */
export function countTotalAreas(groups: GroupedPrintArea[]): number {
  let count = 0;
  for (const g of groups) {
    for (const loc of g.locations) {
      count += loc.techniques.length;
    }
  }
  return count;
}

/**
 * Conta total de localizações únicas.
 */
export function countTotalLocations(groups: GroupedPrintArea[]): number {
  let count = 0;
  for (const g of groups) {
    count += g.locations.length;
  }
  return count;
}

/**
 * Conta total de componentes.
 */
export function countTotalComponents(groups: GroupedPrintArea[]): number {
  return groups.length;
}

// ============================================
// RESUMO E ANÁLISE
// ============================================

export interface PrintAreaSummary {
  totalComponents: number;
  totalLocations: number;
  totalTechniqueSlots: number;
  uniqueTechniques: string[];
  hasPrimaryArea: boolean;
  hasCurvedArea: boolean;
  maxAreaCm2: number | null;
  primaryLocations: string[];
}

/**
 * Gera resumo estatístico completo das áreas agrupadas.
 */
export function summarizeGroups(groups: GroupedPrintArea[]): PrintAreaSummary {
  const uniqueTechniques = getUniqueTechniques(groups);
  let totalTechniqueSlots = 0;
  let totalLocations = 0;
  let hasPrimaryArea = false;
  let hasCurvedArea = false;
  let maxAreaCm2: number | null = null;
  const primaryLocations: string[] = [];

  for (const g of groups) {
    totalLocations += g.locations.length;
    for (const loc of g.locations) {
      totalTechniqueSlots += loc.techniques.length;
      for (const tech of loc.techniques) {
        if (tech.isPrimary) {
          hasPrimaryArea = true;
          if (!primaryLocations.includes(loc.locationName)) {
            primaryLocations.push(loc.locationName);
          }
        }
        if (tech.isCurved) hasCurvedArea = true;
        if (tech.areaCm2 !== null) {
          maxAreaCm2 = maxAreaCm2 === null ? tech.areaCm2 : Math.max(maxAreaCm2, tech.areaCm2);
        }
      }
    }
  }

  return {
    totalComponents: groups.length,
    totalLocations,
    totalTechniqueSlots,
    uniqueTechniques,
    hasPrimaryArea,
    hasCurvedArea,
    maxAreaCm2,
    primaryLocations,
  };
}

/**
 * Encontra a maior área disponível (em cm²) entre todos os grupos.
 */
export function findLargestArea(
  groups: GroupedPrintArea[],
): { componentName: string; locationName: string; areaCm2: number } | null {
  let largest: { componentName: string; locationName: string; areaCm2: number } | null = null;

  for (const g of groups) {
    for (const loc of g.locations) {
      for (const tech of loc.techniques) {
        if (tech.areaCm2 !== null && (largest === null || tech.areaCm2 > largest.areaCm2)) {
          largest = {
            componentName: g.componentName,
            locationName: loc.locationName,
            areaCm2: tech.areaCm2,
          };
        }
      }
    }
  }

  return largest;
}
