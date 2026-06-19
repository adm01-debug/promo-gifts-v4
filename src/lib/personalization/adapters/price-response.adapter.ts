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

type AnyRec = Record<string, unknown>;

const isDefined = (v: unknown): v is NonNullable<unknown> => v !== null && v !== undefined;
const str = (v: unknown): string => (isDefined(v) ? String(v) : '');
const num = (v: unknown): number => (typeof v === 'number' ? v : Number(v) || 0);
const bool = (v: unknown): boolean => Boolean(v);
const numOrNull = (v: unknown): number | null =>
  isDefined(v) ? (typeof v === 'number' ? v : Number(v) || 0) : null;
const asObj = (v: unknown): AnyRec | undefined =>
  isDefined(v) && typeof v === 'object' && !Array.isArray(v) ? (v as AnyRec) : undefined;

/**
 * Margem real a partir do markup (ambos % sobre custo). Antes `margin_percent`
 * recebia o próprio markup — markup e margem divergem (markup 115% ≈ margem 53%).
 * margem% = markup / (100 + markup) * 100.
 */
const markupToMargin = (markupPct: number): number =>
  markupPct > 0 ? Math.round((markupPct / (100 + markupPct)) * 10000) / 100 : 0;

function parseNested(resp: AnyRec): CustomizationPriceFlat {
  const area = asObj(resp.area);
  const tabela = asObj(resp.tabela);
  const parametros = asObj(resp.parametros);
  const precos = asObj(resp.precos);
  const custos = asObj(resp.custos);
  const faixa = asObj(resp.faixa);
  const tabelaCodigo = str(tabela?.codigo_tabela);
  return {
    success: !!resp.success,
    area_id: str(area?.id),
    area_code: str(area?.code),
    area_name: str(area?.name),
    tabela_id: str(tabela?.id),
    tabela_codigo: tabelaCodigo,
    tabela_codigo_curto: tabelaCodigo.split('-')[0] || tabelaCodigo,
    technique: str(tabela?.nome),
    grupo_tecnica: str(tabela?.grupo_tecnica),
    codigo_orcamento: str(resp.codigo_orcamento),
    quantity: num(parametros?.quantidade),
    num_cores: num(parametros?.num_cores) || 1,
    unit_price: num(precos?.preco_unitario_final),
    subtotal_pecas: num(precos?.subtotal_pecas),
    faturamento_minimo_gravacao: num(precos?.faturamento_minimo_gravacao),
    minimum_applied: bool(precos?.aplica_minimo),
    total_price: num(precos?.total_final),
    cost_base_unit: num(custos?.custo_base_unitario),
    cost_unit_total: num(custos?.custo_unitario_total),
    cost_setup: num(custos?.custo_setup_base),
    markup_percent: num(precos?.markup_percent),
    margin_percent: markupToMargin(num(precos?.markup_percent)),
    price_by_color: bool(tabela?.cobra_por_cor),
    max_cores: num(tabela?.max_cores) || 1,
    production_days: numOrNull(faixa?.prazo_dias),
    tier_used: num(faixa?.ordem),
    tier_min_qty: num(faixa?.quantidade_minima),
    tier_max_qty: num(faixa?.quantidade_maxima),
    redirected_from: resp.redirected_from as string | undefined,
    redirected_to: resp.redirected_to as string | undefined,
  };
}

function parseFlat(resp: AnyRec): CustomizationPriceFlat {
  const markup = asObj(resp.markup);
  const detalhes = asObj(resp.detalhes);
  const faixa = asObj(resp.faixa);
  const tabelaCode = str(resp.tabela);
  const unitPrice = num(resp.preco_unitario ?? resp.preco_por_unidade);
  const quantidade = num(resp.quantidade);
  const rawValorGravacao = isDefined(resp.valor_gravacao) ? num(resp.valor_gravacao) : 0;
  const valorGravacao = isDefined(resp.valor_gravacao) ? rawValorGravacao : unitPrice * quantidade;
  const setupTotal = num(resp.setup_total ?? markup?.custo_setup_tabela);
  return {
    success: isDefined(resp.success) ? bool(resp.success) : true,
    area_id: str(resp.area_id),
    area_code: str(resp.area_code) || tabelaCode,
    area_name: str(resp.nome_tabela),
    tabela_id: str(resp.tabela_id),
    tabela_codigo: tabelaCode,
    tabela_codigo_curto: tabelaCode.split('-')[0] || tabelaCode,
    technique: str(resp.nome_tabela),
    grupo_tecnica: str(resp.grupo_tecnica),
    codigo_orcamento: str(resp.codigo_orcamento) || `${tabelaCode}-${quantidade}`,
    quantity: quantidade,
    num_cores: num(resp.num_cores) || 1,
    unit_price: unitPrice,
    subtotal_pecas: valorGravacao,
    faturamento_minimo_gravacao: num(resp.setup_total ?? markup?.custo_setup_tabela),
    minimum_applied: setupTotal > rawValorGravacao,
    total_price: num(resp.total_cobrado ?? resp.valor_gravacao),
    cost_base_unit: num(markup?.custo_unitario),
    cost_unit_total: num(markup?.custo_unitario),
    cost_setup: num(markup?.custo_setup_tabela),
    markup_percent: num(markup?.markup_pct),
    margin_percent: markupToMargin(num(markup?.markup_pct)),
    price_by_color: bool(detalhes?.cobra_por_cor),
    max_cores: num(detalhes?.max_cores) || 1,
    production_days: numOrNull(faixa?.prazo_dias ?? resp.prazo_dias),
    tier_used: isDefined(faixa?.faixa_id) ? 1 : 0,
    tier_min_qty: num(faixa?.qtd_min),
    tier_max_qty: num(faixa?.qtd_max),
    redirected_from: resp.redirected_from as string | undefined,
    redirected_to: resp.redirected_to as string | undefined,
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
      return { flat: parseNested(resp), schemaVersion: version };
    case 'v6.x-flat':
      return { flat: parseFlat(resp), schemaVersion: version };
    case 'v7-new':
      return { flat: parseFlat(normalizeV7Aliases(resp)), schemaVersion: version };
    case 'unknown':
    default: {
      warnUnknownSchemaOnce('price-response', resp);
      return { flat: parseFlat(resp), schemaVersion: 'unknown' };
    }
  }
}

/**
 * Versão simplificada — devolve apenas o flat canônico.
 * É a função que os consumidores devem importar.
 */
export function adaptPriceResponse(resp: unknown): CustomizationPriceFlat {
  return adaptPriceResponseWithMeta(resp as Record<string, unknown> | null | undefined).flat;
}
