/**
 * rpc-native.ts — Direct RPC wrapper for Supabase functions.
 *
 * AUDIT FIXES (2026-05-31 exhaustive audit):
 *
 * fn_get_customization_price — COMPLETE REWRITE of parameter interface:
 *   DB signature: fn_get_customization_price(p_area_id uuid, p_quantidade int,
 *     p_num_cores int, p_largura_cm numeric, p_altura_cm numeric, p_num_pontos int)
 *   No p_product_id param exists. Previous interface was entirely wrong.
 *
 * get_category_descendants — param name fix:
 *   DB param: p_category_id (not category_uuid)
 *
 * 6 non-existent RPCs: fn_get_customization_price_v2, fn_get_product_print_areas (v1+v2),
 *   fn_link_product_print_areas, fn_backfill_product_print_areas, fn_find_fornecedor_price_table
 *   → Marked as NOT_IN_DB in dispatch table with descriptive errors.
 *   Individual wrappers return safe empty values via try/catch.
 *
 * Confirmed correct: fn_get_product_customization_options(p_product_id uuid) ✓
 */
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';
import { toErrorMessage } from '@/lib/to-error-message';

// ── Correct interfaces (verified against DB information_schema.parameters) ────────────────

/**
 * Parameters for fn_get_customization_price (verified signature):
 * fn_get_customization_price(p_area_id uuid, p_quantidade int, p_num_cores int,
 *   p_largura_cm numeric, p_altura_cm numeric, p_num_pontos int)
 *
 * Note: there is NO p_product_id parameter in this function.
 * Product is resolved by p_area_id (which belongs to a product's print area).
 */
export interface CustomizationPriceParams {
  p_area_id: string; // uuid of the print area
  p_quantidade: number; // quantity
  p_num_cores: number; // number of colors (0 if not applicable)
  p_largura_cm: number; // width in cm
  p_altura_cm: number; // height in cm
  p_num_pontos?: number; // stitch count (embroidery), default 0
}

export interface CustomizationPriceResult {
  success: boolean;
  preco_total?: number;
  preco_unitario?: number;
  tabela_codigo?: string;
  tabela?: {
    id: string;
    area_maxima_texto?: string | null;
    largura_max_cm?: number | null;
    altura_max_cm?: number | null;
    max_cores?: number | null;
    cobra_por_cor?: boolean;
  };
  [key: string]: unknown;
}

export interface CustomizationOptionResult {
  technique_id: string;
  technique_name: string;
  area_id: string;
  area_name: string;
  [key: string]: unknown;
}

// ── RPC client type ─────────────────────────────────────────────────────────────────
type RpcClient = {
  rpc: (
    name: string,
    params?: Record<string, unknown>,
  ) => Promise<{
    data: unknown;
    error: { message: string; code?: string } | null;
  }>;
};

async function callRpc<T>(name: string, params?: Record<string, unknown>): Promise<T> {
  const client = supabase as unknown as RpcClient;
  const { data, error } = await client.rpc(name, params ?? {});
  if (error) {
    logger.warn(
      `[rpc-native] RPC '${name}' failed: ${error.message} (code=${error.code ?? 'n/a'})`,
    );
    throw new Error(`rpc-native error (${name}): ${error.message}`);
  }
  return data as T;
}

// ── Enrichment (optional metadata from tabela_preco_gravacao_oficial) ─────────────────
type EnrichableResult = Record<string, unknown>;

async function enrichCustomizationPrice(result: EnrichableResult): Promise<EnrichableResult> {
  if (!result.success || !result.tabela_codigo || result.tabela) return result;
  try {
    type SB = {
      from: (t: string) => {
        select: (c: string) => {
          eq: (
            col: string,
            val: unknown,
          ) => {
            eq: (
              col: string,
              val: unknown,
            ) => { limit: (n: number) => Promise<{ data: Array<Record<string, unknown>> | null }> };
          };
        };
      };
    };
    const s = supabase as unknown as SB;
    const { data } = await s
      .from('tabela_preco_gravacao_oficial')
      .select('id,area_maxima_texto,max_cores,cobra_por_cor')
      .eq('codigo_tabela', result.tabela_codigo)
      .eq('ativo', true)
      .limit(1);
    if (!data?.length) return result;
    const t = data[0];
    return {
      ...result,
      tabela: {
        ...(result.tabela ?? {}),
        id: t.id,
        area_maxima_texto: t.area_maxima_texto ?? null,
        max_cores: t.max_cores ?? null,
        cobra_por_cor: t.cobra_por_cor ?? false,
      },
    };
  } catch (e) {
    logger.warn(`[rpc-native] enrichCustomizationPrice failed (non-fatal): ${toErrorMessage(e)}`);
    return result;
  }
}

// ── Public RPC functions ────────────────────────────────────────────────────────────────

/**
 * Calculates customization price for a given print area and quantity.
 * Uses correct DB param names: p_area_id, p_quantidade, p_num_cores, p_largura_cm, p_altura_cm, p_num_pontos.
 */
export async function getCustomizationPrice(
  params: CustomizationPriceParams,
): Promise<CustomizationPriceResult> {
  const rpcParams = {
    p_area_id: params.p_area_id,
    p_quantidade: params.p_quantidade,
    p_num_cores: params.p_num_cores,
    p_largura_cm: params.p_largura_cm,
    p_altura_cm: params.p_altura_cm,
    p_num_pontos: params.p_num_pontos ?? 0,
  };
  const raw = await callRpc<EnrichableResult>('fn_get_customization_price', rpcParams);
  return enrichCustomizationPrice(raw) as unknown as CustomizationPriceResult;
}

/**
 * Returns available customization options for a product.
 * Confirmed signature: fn_get_product_customization_options(p_product_id uuid)
 */
export async function getProductCustomizationOptions(
  productId: string,
): Promise<CustomizationOptionResult[]> {
  try {
    const data = await callRpc<CustomizationOptionResult[] | null>(
      'fn_get_product_customization_options',
      { p_product_id: productId },
    );
    return Array.isArray(data) ? data : [];
  } catch (e) {
    logger.warn(`[rpc-native] getProductCustomizationOptions(${productId}): ${toErrorMessage(e)}`);
    return [];
  }
}

/**
 * Returns all descendants of a category (recursive).
 * FIX: param is p_category_id (not category_uuid as previously coded).
 */
export async function getCategoryDescendants(categoryId: string): Promise<string[]> {
  try {
    const data = await callRpc<string[] | null>('get_category_descendants', {
      p_category_id: categoryId,
    });
    return Array.isArray(data) ? data : [];
  } catch (e) {
    logger.warn(`[rpc-native] getCategoryDescendants(${categoryId}): ${toErrorMessage(e)}`);
    return [];
  }
}

// ── RPCs not yet in DB ────────────────────────────────────────────────────────────────────
// Audit confirmed these functions do not exist in doufsxqlfjyuvxuezpln yet.
// Stubs return safe empty values and log a clear NOT_IN_DB warning.

export async function getProductPrintAreas(productId: string): Promise<unknown[]> {
  logger.warn(
    `[rpc-native] fn_get_product_print_areas NOT_IN_DB for product ${productId}. Use print_area_techniques table directly.`,
  );
  return [];
}

export async function getProductPrintAreasV2(productId: string): Promise<unknown[]> {
  logger.warn(`[rpc-native] fn_get_product_print_areas_v2 NOT_IN_DB for product ${productId}.`);
  return [];
}

export async function linkProductPrintAreas(
  productId: string,
  _areas: unknown[],
): Promise<{ success: boolean; affected: number }> {
  logger.warn(`[rpc-native] fn_link_product_print_areas NOT_IN_DB. Product: ${productId}`);
  return { success: false, affected: 0 };
}

export async function backfillProductPrintAreas(
  _productIds: string[],
): Promise<{ success: boolean; processed: number; errors: number }> {
  logger.warn('[rpc-native] fn_backfill_product_print_areas NOT_IN_DB.');
  return { success: false, processed: 0, errors: 0 };
}

export async function findFornecedorPriceTable(_params: { technique_id: string }): Promise<null> {
  logger.warn('[rpc-native] fn_find_fornecedor_price_table NOT_IN_DB.');
  return null;
}

// ── Dispatch table ────────────────────────────────────────────────────────────────────────
type DispatchFn = (params: Record<string, unknown>) => Promise<unknown>;

const RPC_DISPATCH: Record<string, DispatchFn> = {
  // ✓ Exists in DB — correct param names
  fn_get_customization_price: (p) =>
    getCustomizationPrice(p as unknown as CustomizationPriceParams),
  fn_get_product_customization_options: (p) =>
    getProductCustomizationOptions(p.p_product_id as string),
  get_category_descendants: (p) => getCategoryDescendants(p.p_category_id as string),
  // ➠ Not in DB yet — safe returns (FASE 2: was throw, now returns safe empty)
  fn_get_customization_price_v2: async () => {
    logger.warn(
      '[rpc-native] fn_get_customization_price_v2 NOT_IN_DB — returning safe empty. Use fn_get_customization_price instead.',
    );
    return { success: false, preco_total: 0, preco_unitario: 0 };
  },
  fn_get_product_print_areas: async () => {
    logger.warn('[rpc-native] fn_get_product_print_areas NOT_IN_DB — returning [].');
    return [];
  },
  fn_get_product_print_areas_v2: async () => {
    logger.warn('[rpc-native] fn_get_product_print_areas_v2 NOT_IN_DB — returning [].');
    return [];
  },
  fn_link_product_print_areas: async () => {
    logger.warn('[rpc-native] fn_link_product_print_areas NOT_IN_DB — returning safe empty.');
    return { success: false, affected: 0 };
  },
  fn_backfill_product_print_areas: async () => {
    logger.warn('[rpc-native] fn_backfill_product_print_areas NOT_IN_DB — returning safe empty.');
    return { success: false, processed: 0, errors: 0 };
  },
  fn_find_fornecedor_price_table: async () => {
    logger.warn('[rpc-native] fn_find_fornecedor_price_table NOT_IN_DB — returning null.');
    return null;
  },
};

/**
 * Compatibility shim for invokeExternalDb({operation:'rpc', rpcName, rpcParams}).
 * Throws with a clear DB-verified error if rpcName is not in the allowed list.
 */
export async function dispatchRpc(
  rpcName: string,
  rpcParams?: Record<string, unknown>,
): Promise<unknown> {
  const fn = RPC_DISPATCH[rpcName];
  if (!fn) {
    throw new Error(
      `rpc-native: '${rpcName}' not in dispatch table. Allowed: ${Object.keys(RPC_DISPATCH).join(', ')}`,
    );
  }
  logger.debug(`[rpc-native] dispatching ${rpcName}`);
  return fn(rpcParams ?? {});
}
