/**
 * simulationPriceFetcher — Cálculo oficial de preço do simulador.
 *
 * Fonte única de verdade: o RPC `fn_get_customization_price`, que reflete
 * a estrutura atualizada das tabelas de gravação (áreas, técnicas, faixas
 * e valores). Não há mais fallback heurístico no front.
 *
 * Fluxo:
 *   1. Para um `productId`, carrega `print_area_techniques` via
 *      `fetchProductPrintAreasV2` (já cacheado em React Query upstream).
 *   2. Resolve cada técnica selecionada (`Technique.id` ou `code`) para o
 *      `area_id` correspondente daquele produto.
 *   3. Chama o RPC em paralelo (`Promise.allSettled`) e mapeia o retorno
 *      flat para `SimulationOption`.
 *   4. Técnicas sem print area cadastrada → opção marcada como
 *      `unavailable` (UI exibe motivo, sem inventar preço).
 */

import { invokeExternalRpc } from '@/lib/external-rpc';
import {
  fetchProductPrintAreasV2,
  type CustomizationPriceResponse,
  type PrintAreaV2,
} from '@/hooks/simulation';
import { adaptPriceResponse } from '@/lib/personalization/adapters';
import type { Technique, TechniqueSettings, SimulationOption } from '@/types/simulation';
import { logger } from '@/lib/logger';

interface FetchOptionsParams {
  selectedTechniqueIds: string[];
  techniques: Technique[] | undefined;
  techniqueSettings: Record<string, TechniqueSettings>;
  quantity: number;
  productUnitPrice: number;
  productId: string | null;
  idSuffix?: string;
}

/**
 * Resolve uma técnica (do catálogo `personalization_techniques`) para um
 * `area_id` válido do produto, casando por nome ou código.
 */
function resolveAreaIdForTechnique(
  technique: Technique,
  printAreas: PrintAreaV2[],
): PrintAreaV2 | null {
  if (printAreas.length === 0) return null;

  const techNameNorm = technique.name?.trim().toLowerCase() ?? '';
  const techCodeNorm = technique.code?.trim().toLowerCase() ?? '';

  // 1. Match exato por nome da técnica vinculada à tabela
  const byName = printAreas.find(
    (a) => (a.technique_name ?? '').trim().toLowerCase() === techNameNorm,
  );
  if (byName) return byName;

  // 2. Match por grupo de técnica (LASER, SERIGRAFIA, ...)
  const byGroup = printAreas.find(
    (a) => (a.grupo_tecnica ?? '').trim().toLowerCase() === techCodeNorm,
  );
  if (byGroup) return byGroup;

  // 3. Match por substring (DTF dentro de "DTF Têxtil", etc.)
  const bySubstring = printAreas.find((a) => {
    const haystack = `${a.technique_name ?? ''} ${a.grupo_tecnica ?? ''}`.toLowerCase();
    return techCodeNorm.length > 1 && haystack.includes(techCodeNorm);
  });
  if (bySubstring) return bySubstring;

  return null;
}

function buildUnavailableOption(
  technique: Technique,
  settings: TechniqueSettings,
  quantity: number,
  productUnitPrice: number,
  reason: string,
  idSuffix?: string,
): SimulationOption {
  const totalProductCost = productUnitPrice * quantity;
  return {
    id: `${technique.id}-${idSuffix ?? 'na'}`,
    techniqueId: technique.id,
    techniqueName: technique.name,
    techniqueCode: technique.code ?? '',
    colors: settings.colors,
    width: settings.width,
    height: settings.height,
    positions: settings.positions,
    unitCost: 0,
    setupCost: 0,
    totalPersonalizationCost: 0,
    costPerUnit: 0,
    estimatedDays: technique.estimated_days,
    productUnitPrice,
    totalProductCost,
    grandTotal: totalProductCost,
    grandTotalPerUnit: quantity > 0 ? totalProductCost / quantity : 0,
    priceSource: 'unavailable',
    unavailableReason: reason,
    calculatedAt: new Date().toISOString(),
    rpcAvailable: false,
  };
}

/**
 * Fallback heurístico (legado): usado APENAS quando o RPC oficial falha
 * ou está indisponível. Estima o preço a partir de campos do catálogo
 * `personalization_techniques` (unit_cost, setup_cost) — sem consultar
 * tabelas de gravação. Marca a opção com `priceSource: 'legacy-fallback'`
 * e `fallbackReason` para que a UI exiba aviso ao usuário.
 */
function buildLegacyFallbackOption(
  technique: Technique,
  settings: TechniqueSettings,
  quantity: number,
  productUnitPrice: number,
  reason: string,
  idSuffix?: string,
): SimulationOption {
  const positions = Math.max(1, settings.positions);
  const colors = Math.max(1, settings.colors);
  // Estimativa: unit_cost por cor por posição × quantidade + setup × posições
  const unitCost = (technique.unit_cost ?? 0) * colors * positions;
  const setupCost = (technique.setup_cost ?? 0) * positions;
  const totalPersonalizationCost = unitCost * quantity + setupCost;
  const costPerUnit = quantity > 0 ? totalPersonalizationCost / quantity : 0;
  const totalProductCost = productUnitPrice * quantity;
  const grandTotal = totalProductCost + totalPersonalizationCost;
  return {
    id: `${technique.id}-${idSuffix ?? 'fb'}`,
    techniqueId: technique.id,
    techniqueName: technique.name,
    techniqueCode: technique.code ?? '',
    colors,
    width: settings.width,
    height: settings.height,
    positions,
    unitCost,
    setupCost,
    totalPersonalizationCost,
    costPerUnit,
    estimatedDays: technique.estimated_days,
    productUnitPrice,
    totalProductCost,
    grandTotal,
    grandTotalPerUnit: quantity > 0 ? grandTotal / quantity : 0,
    priceSource: 'legacy-fallback',
    fallbackReason: reason,
    calculatedAt: new Date().toISOString(),
    rpcAvailable: false,
  };
}

/**
 * Busca o preço de UMA técnica via RPC `fn_get_customization_price` e
 * monta a `SimulationOption` correspondente.
 */
export async function fetchOptionForTechnique(
  technique: Technique,
  settings: TechniqueSettings,
  quantity: number,
  productUnitPrice: number,
  printAreas: PrintAreaV2[],
  idSuffix?: string,
): Promise<SimulationOption> {
  const area = resolveAreaIdForTechnique(technique, printAreas);

  if (!area) {
    return buildUnavailableOption(
      technique,
      settings,
      quantity,
      productUnitPrice,
      'Técnica sem área de gravação cadastrada para este produto',
      idSuffix,
    );
  }

  const cobraPorCor = area.cobra_por_cor;
  const effectiveColors =
    !cobraPorCor || (area.max_colors ?? 0) <= 1 ? 1 : Math.max(1, settings.colors);

  const rpcParams: Record<string, unknown> = {
    p_area_id: area.area_id,
    p_quantidade: quantity,
    p_num_cores: effectiveColors,
  };

  if (settings.width > 0 && settings.height > 0) {
    rpcParams.p_largura_cm = settings.width;
    rpcParams.p_altura_cm = settings.height;
  }

  let result: CustomizationPriceResponse | null = null;
  let rpcError: string | null = null;
  try {
    result = await invokeExternalRpc<CustomizationPriceResponse>(
      'fn_get_customization_price',
      rpcParams,
    );
  } catch (err) {
    rpcError = err instanceof Error ? err.message : 'Erro desconhecido na RPC';
    logger.warn(
      '[simulationPriceFetcher] RPC fn_get_customization_price falhou — usando fallback legado',
      err,
    );
  }

  if (!result?.success) {
    const reason =
      rpcError ??
      (typeof result === 'object' &&
      result &&
      'error' in result &&
      typeof (result as { error?: unknown }).error === 'string'
        ? (result as { error: string }).error
        : 'RPC fn_get_customization_price não retornou preço para esta combinação');
    return buildLegacyFallbackOption(
      technique,
      settings,
      quantity,
      productUnitPrice,
      reason,
      idSuffix,
    );
  }

  const flat = adaptPriceResponse(result as unknown as Record<string, unknown>);

  // Multiplicador por nº de posições (a regra de negócio do simulador
  // legado preserva esse comportamento — o RPC calcula 1 posição).
  const positions = Math.max(1, settings.positions);
  const unitCost = flat.unit_price * positions;
  const setupCost = flat.cost_setup * positions;
  const totalPersonalizationCost = flat.total_price * positions;
  const costPerUnit = quantity > 0 ? totalPersonalizationCost / quantity : 0;

  const totalProductCost = productUnitPrice * quantity;
  const grandTotal = totalProductCost + totalPersonalizationCost;
  const grandTotalPerUnit = quantity > 0 ? grandTotal / quantity : 0;

  return {
    id: `${technique.id}-${idSuffix ?? Date.now()}`,
    techniqueId: technique.id,
    techniqueName: technique.name,
    techniqueCode: technique.code ?? '',
    colors: effectiveColors,
    width: settings.width,
    height: settings.height,
    positions,
    unitCost,
    setupCost,
    totalPersonalizationCost,
    costPerUnit,
    estimatedDays: flat.production_days ?? technique.estimated_days,
    productUnitPrice,
    totalProductCost,
    grandTotal,
    grandTotalPerUnit,
    priceSource: 'rpc',
    calculatedAt: new Date().toISOString(),
    rpcAvailable: true,
  };
}

/**
 * Busca preços de TODAS as técnicas selecionadas em paralelo.
 * Falhas individuais não bloqueiam as demais (degrada para `unavailable`).
 */
export async function fetchAllOptions({
  selectedTechniqueIds,
  techniques,
  techniqueSettings,
  quantity,
  productUnitPrice,
  productId,
  idSuffix,
}: FetchOptionsParams): Promise<SimulationOption[]> {
  if (!productId || selectedTechniqueIds.length === 0 || !techniques?.length) {
    return [];
  }

  let printAreas: PrintAreaV2[] = [];
  try {
    printAreas = await fetchProductPrintAreasV2(productId);
  } catch (err) {
    logger.warn('[simulationPriceFetcher] Falha ao carregar print areas', err);
  }

  const tasks = selectedTechniqueIds.map(async (techId) => {
    const technique = techniques.find((t) => t.id === techId);
    if (!technique) return null;
    const settings = techniqueSettings[techId] ?? {
      colors: 1,
      width: 10,
      height: 10,
      positions: 1,
    };
    try {
      return await fetchOptionForTechnique(
        technique,
        settings,
        quantity,
        productUnitPrice,
        printAreas,
        idSuffix,
      );
    } catch (err) {
      logger.warn('[simulationPriceFetcher] Falha em técnica — fallback legado', techId, err);
      return buildLegacyFallbackOption(
        technique,
        settings,
        quantity,
        productUnitPrice,
        err instanceof Error ? err.message : 'Erro desconhecido',
        idSuffix,
      );
    }
  });

  const settled = await Promise.all(tasks);
  return settled.filter((o): o is SimulationOption => o !== null);
}
