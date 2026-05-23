/**
 * Price response adapter — Tradutor unificado de payloads do RPC
 * `fn_get_customization_price` para o tipo canônico `CustomizationPriceFlat`.
 *
 * Suporta 3 formatos:
 *   1. v5.9-nested  — `{ area: {...}, tabela: {...}, faixa: {...}, custos: {...}, precos: {...} }`
 *   2. v6.x-flat    — payload achatado em PT (`preco_unitario`, `valor_gravacao`, ...)
 *   3. v7-new       — payload hipotético em EN (`unit_price`, `subtotal_pieces`, ...)
 *
 * O front continua falando o "idioma canônico". Quando o back mudar nomes
 * de colunas, basta atualizar o `RENAME_MAP_V7` aqui — nenhum consumidor
 * precisa ser tocado.
 */

import type { CustomizationPriceFlat } from '@/hooks/simulation';
import {
  detectPriceSchema,
  warnUnknownSchemaOnce,
  type PriceSchemaVersion,
} from './schema-detection';
import { validateRpcPayload } from '@/lib/personalization/rpc-validator';
import { PRICE_CONTRACT } from '@/lib/personalization/rpc-contracts';

// ============================================
// MAPA DE RENOMEAÇÃO v7 (futuro)
// ============================================

/**
 * Mapeamento de nomes futuros (EN) → nomes atuais (PT).
 * Aplicado ANTES do parser flat para que o mesmo código atenda ambos.
 * Evolui conforme o back migra colunas.
 */
const RENAME_MAP_V7: Record<string, string> = {
  unit_price: 'preco_unitario',
  unit_price_per_piece: 'preco_por_unidade',
  subtotal_pieces: 'valor_gravacao',
  total_charged: 'total_cobrado',
  setup_total_value: 'setup_total',
  table_code: 'tabela',
  table_name: 'nome_tabela',
  technique_group: 'grupo_tecnica',
  quantity: 'quantidade',
  num_colors: 'num_cores',
  production_days: 'prazo_dias',
};

function normalizeV7Aliases(resp: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...resp };
  for (const [alias, canonical] of Object.entries(RENAME_MAP_V7)) {
    if (alias in out && !(canonical in out)) {
      out[canonical] = out[alias];
    }
  }
  // Markup nested object — também aceita renomeação
  const markup = out.markup as Record<string, unknown> | undefined;
  if (markup && typeof markup === 'object') {
    if ('unit_cost' in markup && !('custo_unitario' in markup))
      markup.custo_unitario = markup.unit_cost;
    if ('setup_cost_table' in markup && !('custo_setup_tabela' in markup))
      markup.custo_setup_tabela = markup.setup_cost_table;
    if ('markup_percent' in markup && !('markup_pct' in markup))
      markup.markup_pct = markup.markup_percent;
  }
  // Detalhes nested
  const detalhes = out.detalhes as Record<string, unknown> | undefined;
  if (detalhes && typeof detalhes === 'object') {
    if ('charges_per_color' in detalhes && !('cobra_por_cor' in detalhes))
      detalhes.cobra_por_cor = detalhes.charges_per_color;
    if ('max_colors' in detalhes && !('max_cores' in detalhes))
      detalhes.max_cores = detalhes.max_colors;
  }
  // Faixa nested
  const faixa = out.faixa as Record<string, unknown> | undefined;
  if (faixa && typeof faixa === 'object') {
    if ('min_qty' in faixa && !('qtd_min' in faixa)) faixa.qtd_min = faixa.min_qty;
    if ('max_qty' in faixa && !('qtd_max' in faixa)) faixa.qtd_max = faixa.max_qty;
    if ('production_days' in faixa && !('prazo_dias' in faixa))
      faixa.prazo_dias = faixa.production_days;
  }
  return out;
}

// ============================================
// PARSERS POR FORMATO
// ============================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRec = Record<string, any>;

function parseNested(resp: AnyRec): CustomizationPriceFlat {
  return {
    success: !!resp.success,
    area_id: resp.area?.id ?? '',
    area_code: resp.area?.code ?? '',
    area_name: resp.area?.name ?? '',
    tabela_id: resp.tabela?.id ?? '',
    tabela_codigo: resp.tabela?.codigo_tabela ?? '',
    tabela_codigo_curto:
      (resp.tabela?.codigo_tabela ?? '').split('-')[0] || resp.tabela?.codigo_tabela || '',
    technique: resp.tabela?.nome ?? '',
    grupo_tecnica: resp.tabela?.grupo_tecnica ?? '',
    codigo_orcamento: resp.codigo_orcamento ?? '',
    quantity: resp.parametros?.quantidade ?? 0,
    num_cores: resp.parametros?.num_cores ?? 1,
    unit_price: resp.precos?.preco_unitario_final ?? 0,
    subtotal_pecas: resp.precos?.subtotal_pecas ?? 0,
    faturamento_minimo_gravacao: resp.precos?.faturamento_minimo_gravacao ?? 0,
    minimum_applied: resp.precos?.aplica_minimo ?? false,
    total_price: resp.precos?.total_final ?? 0,
    cost_base_unit: resp.custos?.custo_base_unitario ?? 0,
    cost_unit_total: resp.custos?.custo_unitario_total ?? 0,
    cost_setup: resp.custos?.custo_setup_base ?? 0,
    markup_percent: resp.precos?.markup_percent ?? 0,
    margin_percent: resp.precos?.markup_percent ?? 0,
    price_by_color: resp.tabela?.cobra_por_cor ?? false,
    max_cores: resp.tabela?.max_cores ?? 1,
    production_days: resp.faixa?.prazo_dias ?? null,
    tier_used: resp.faixa?.ordem ?? 0,
    tier_min_qty: resp.faixa?.quantidade_minima ?? 0,
    tier_max_qty: resp.faixa?.quantidade_maxima ?? 0,
    redirected_from: resp.redirected_from,
    redirected_to: resp.redirected_to,
  };
}

function parseFlat(resp: AnyRec): CustomizationPriceFlat {
  const tabelaCode = resp.tabela ?? '';
  const unitPrice = resp.preco_unitario ?? resp.preco_por_unidade ?? 0;
  const valorGravacao = resp.valor_gravacao ?? unitPrice * (resp.quantidade ?? 0);
  return {
    success: resp.success ?? true,
    area_id: resp.area_id ?? '',
    area_code: resp.area_code ?? tabelaCode,
    area_name: resp.nome_tabela ?? '',
    tabela_id: resp.tabela_id ?? '',
    tabela_codigo: tabelaCode,
    tabela_codigo_curto: (tabelaCode as string).split('-')[0] || tabelaCode,
    technique: resp.nome_tabela ?? '',
    grupo_tecnica: resp.grupo_tecnica ?? '',
    codigo_orcamento: resp.codigo_orcamento ?? `${tabelaCode}-${resp.quantidade ?? 0}`,
    quantity: resp.quantidade ?? 0,
    num_cores: resp.num_cores ?? 1,
    unit_price: unitPrice,
    subtotal_pecas: valorGravacao,
    faturamento_minimo_gravacao: resp.setup_total ?? resp.markup?.custo_setup_tabela ?? 0,
    minimum_applied: (resp.setup_total ?? 0) > (resp.valor_gravacao ?? 0),
    total_price: resp.total_cobrado ?? resp.valor_gravacao ?? 0,
    cost_base_unit: resp.markup?.custo_unitario ?? 0,
    cost_unit_total: resp.markup?.custo_unitario ?? 0,
    cost_setup: resp.markup?.custo_setup_tabela ?? 0,
    markup_percent: resp.markup?.markup_pct ?? 0,
    margin_percent: resp.markup?.markup_pct ?? 0,
    price_by_color: resp.detalhes?.cobra_por_cor ?? false,
    max_cores: resp.detalhes?.max_cores ?? 1,
    production_days: resp.faixa?.prazo_dias ?? resp.prazo_dias ?? null,
    tier_used: resp.faixa?.faixa_id ? 1 : 0,
    tier_min_qty: resp.faixa?.qtd_min ?? 0,
    tier_max_qty: resp.faixa?.qtd_max ?? 0,
    redirected_from: resp.redirected_from,
    redirected_to: resp.redirected_to,
  };
}

// ============================================
// API PÚBLICA
// ============================================

export interface AdaptResult {
  flat: CustomizationPriceFlat;
  schemaVersion: PriceSchemaVersion;
}

/**
 * Adapta qualquer payload conhecido para o tipo canônico.
 * Retorna também a versão detectada (útil para debug/telemetria).
 */
export function adaptPriceResponseWithMeta(
  resp: Record<string, unknown> | null | undefined,
): AdaptResult {
  if (!resp) {
    return { flat: parseFlat({}), schemaVersion: 'unknown' };
  }
  // Validação observacional do payload bruto (apenas formatos não-nested)
  if (!('area' in resp)) {
    validateRpcPayload(PRICE_CONTRACT, resp);
  }
  const version = detectPriceSchema(resp);
  switch (version) {
    case 'v5.9-nested':
      return { flat: parseNested(resp as AnyRec), schemaVersion: version };
    case 'v6.x-flat':
      return { flat: parseFlat(resp as AnyRec), schemaVersion: version };
    case 'v7-new':
      return { flat: parseFlat(normalizeV7Aliases(resp) as AnyRec), schemaVersion: version };
    default: {
      warnUnknownSchemaOnce('price-response', resp);
      return { flat: parseFlat(resp as AnyRec), schemaVersion: 'unknown' };
    }
  }
}

/**
 * Versão simplificada — devolve apenas o flat canônico.
 * É a função que os consumidores devem importar.
 */
export function adaptPriceResponse(
  resp: Record<string, unknown> | null | undefined,
): CustomizationPriceFlat {
  return adaptPriceResponseWithMeta(resp).flat;
}
