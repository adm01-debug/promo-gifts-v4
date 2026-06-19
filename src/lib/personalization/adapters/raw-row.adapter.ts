/**
 * raw-row.adapter — Adapters para linhas brutas vindas de
 * `external-db-bridge` (tecnica_gravacao, tabela_preco_gravacao_oficial,
 * tabela_preco_gravacao_oficial_faixa, print_area_techniques).
 *
 * Cada função preenche **ambos** os nomes (PT legado + EN canônico novo)
 * para que consumidores possam migrar gradualmente sem quebra.
 *
 * Telemetria: cada vez que detectamos um campo legado vindo do back, o
 * contador `legacyFieldsSeen` em `window.__personalizationSchemaStats` é
 * incrementado — quando todos zerarem em produção, podemos remover os
 * `@deprecated`.
 */

import { recordLegacyField } from './schema-detection';
import type {
  FaixaPrecoCanonical,
  PrintAreaTechniqueCanonical,
  TabelaPrecoCanonical,
  TecnicaGravacaoCanonical,
} from './raw-row.types';

type Raw = Record<string, unknown>;

function toNumberOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function toBoolOrNull(v: unknown): boolean | null {
  if (v === null || v === undefined) return null;
  if (typeof v === 'boolean') return v;
  if (v === 'true' || v === 1) return true;
  if (v === 'false' || v === 0) return false;
  return null;
}

/**
 * Mapeamento bidirecional: ao detectar uma das chaves, espelhamos para a outra.
 * `[ptKey, enKey, kind]` — `kind` define a coerção.
 */
type Kind = 'string' | 'number' | 'bool' | 'raw';
const TECNICA_PAIRS: Array<[string, string, Kind]> = [
  ['codigo', 'code', 'string'],
  ['codigo_interno', 'internal_code', 'string'],
  ['nome', 'name', 'string'],
  ['descricao', 'description', 'string'],
  ['grupo_tecnica', 'group', 'string'],
  ['nome_grupo', 'group_name', 'string'],
  ['permite_cores', 'allows_colors', 'bool'],
  ['max_cores', 'max_colors', 'number'],
  ['cobra_por_cor', 'charges_per_color', 'bool'],
  ['cobra_por_area', 'price_by_area', 'bool'],
  ['cobra_por_pontos', 'price_by_points', 'bool'],
  ['area_maxima_cm2', 'max_area_cm2', 'number'],
  ['requer_setup', 'requires_setup', 'bool'],
  ['tipo_setup', 'setup_type', 'string'],
  ['custo_setup', 'setup_price', 'number'],
  ['custo_setup_por_cor', 'setup_by_color', 'bool'],
  ['custo_manuseio', 'handling_price', 'number'],
  ['tempo_producao_dias', 'production_days', 'number'],
  ['quantidade_corte', 'min_quantity', 'number'],
  ['aplica_superficie_curva', 'applies_to_curved', 'bool'],
  ['ativo', 'active', 'bool'],
  ['ordem_exibicao', 'display_order', 'number'],
  ['validade_inicio', 'valid_from', 'string'],
  ['validade_fim', 'valid_to', 'string'],
  ['faturamento_minimo', 'minimum_revenue', 'number'],
];

const FAIXA_PAIRS: Array<[string, string, Kind]> = [
  ['quantidade_minima', 'min_quantity', 'number'],
  ['quantidade_maxima', 'max_quantity', 'number'],
  ['preco_unitario', 'unit_price', 'number'],
  ['prazo_dias', 'production_days', 'number'],
  ['ordem', 'display_order', 'number'],
  ['tabela_preco_gravacao_id', 'price_table_id', 'string'],
];

const PRINT_AREA_PAIRS: Array<[string, string, Kind]> = [
  ['area_code', 'location_code', 'string'],
  ['area_name', 'location_name', 'string'],
  ['max_width', 'largura_max', 'number'],
  ['max_height', 'altura_max', 'number'],
  ['ativo', 'is_active', 'bool'],
  ['tabela_preco_id', 'price_table_id', 'string'],
];

function coerce(value: unknown, kind: Kind): unknown {
  switch (kind) {
    case 'number':
      return toNumberOrNull(value);
    case 'bool':
      return toBoolOrNull(value);
    case 'string':
      return value === null ? null : String(value);
    case 'raw':
    default:
      return value;
  }
}

/**
 * Espelha pares PT ↔ EN: para cada par, se exatamente um lado tem valor,
 * preenche o outro. Telemetria registra quando o lado PT (legado) foi visto.
 */
function mirrorPairs<T extends Raw>(
  out: T,
  raw: Raw,
  pairs: Array<[string, string, Kind]>,
  legacyPrefix: string,
): T {
  for (const [ptKey, enKey, kind] of pairs) {
    const ptVal = raw[ptKey];
    const enVal = raw[enKey];
    const hasPt = ptVal !== undefined && ptVal !== null;
    const hasEn = enVal !== undefined && enVal !== null;

    if (hasPt) recordLegacyField(`${legacyPrefix}.${ptKey}`);

    if (hasPt && !hasEn) {
      const coerced = coerce(ptVal, kind);
      (out as Raw)[ptKey] = coerced;
      (out as Raw)[enKey] = coerced;
    } else if (!hasPt && hasEn) {
      const coerced = coerce(enVal, kind);
      (out as Raw)[enKey] = coerced;
      (out as Raw)[ptKey] = coerced;
    } else if (hasPt && hasEn) {
      // Ambos presentes: prioriza EN (canônico novo) mas preserva PT como veio.
      (out as Raw)[ptKey] = coerce(ptVal, kind);
      (out as Raw)[enKey] = coerce(enVal, kind);
    }
  }
  return out;
}

/**
 * Adapter para linhas de `tecnica_gravacao` / `tabela_preco_gravacao_oficial`
 * (formatos compatíveis após o bridge).
 */
export function adaptTecnicaRow(raw: Raw): TecnicaGravacaoCanonical {
  if (!raw || typeof raw !== 'object') {
    return { id: '' } as TecnicaGravacaoCanonical;
  }
  const out: TecnicaGravacaoCanonical = { ...raw, id: String(raw.id ?? '') };
  return mirrorPairs(out as Raw, raw, TECNICA_PAIRS, 'tecnica') as TecnicaGravacaoCanonical;
}

export function adaptTecnicaRows(rows: Raw[] | null | undefined): TecnicaGravacaoCanonical[] {
  if (!Array.isArray(rows)) return [];
  return rows.map(adaptTecnicaRow);
}

/**
 * Adapter para linhas de `tabela_preco_gravacao_oficial`.
 * Reusa o mesmo conjunto de pares (a tabela compartilha colunas com tecnica_gravacao
 * após mapeamento do bridge) e adiciona descontos por cor.
 */
export function adaptTabelaPrecoRow(raw: Raw): TabelaPrecoCanonical {
  const base = adaptTecnicaRow(raw) as TabelaPrecoCanonical;
  // Espelha campos específicos da tabela
  const extraPairs: Array<[string, string, Kind]> = [
    ['tecnica_variante_id', 'variant_id', 'string'],
    ['desconto_segunda_cor', 'discount_2nd_color', 'number'],
    ['desconto_terceira_cor', 'discount_3rd_color', 'number'],
    ['desconto_quarta_cor_mais', 'discount_4th_color_plus', 'number'],
  ];
  return mirrorPairs(base as Raw, raw, extraPairs, 'tabela_preco') as TabelaPrecoCanonical;
}

export function adaptTabelaPrecoRows(rows: Raw[] | null | undefined): TabelaPrecoCanonical[] {
  if (!Array.isArray(rows)) return [];
  return rows.map(adaptTabelaPrecoRow);
}

/**
 * Adapter para linhas de `tabela_preco_gravacao_oficial_faixa`.
 */
export function adaptFaixaPrecoRow(raw: Raw): FaixaPrecoCanonical {
  if (!raw || typeof raw !== 'object') {
    return { id: '' } as FaixaPrecoCanonical;
  }
  const out: FaixaPrecoCanonical = { ...raw, id: String(raw.id ?? '') };
  return mirrorPairs(out as Raw, raw, FAIXA_PAIRS, 'faixa') as FaixaPrecoCanonical;
}

export function adaptFaixaPrecoRows(rows: Raw[] | null | undefined): FaixaPrecoCanonical[] {
  if (!Array.isArray(rows)) return [];
  return rows.map(adaptFaixaPrecoRow);
}

/**
 * Adapter para linhas de `print_area_techniques` — preserva o output do
 * `print-area.adapter.ts` original mas adiciona aliases EN.
 */
export function adaptPrintAreaTechniqueRow(raw: Raw): PrintAreaTechniqueCanonical {
  if (!raw || typeof raw !== 'object') {
    return { id: '' } as PrintAreaTechniqueCanonical;
  }
  const out: PrintAreaTechniqueCanonical = { ...raw, id: String(raw.id ?? '') };
  return mirrorPairs(
    out as Raw,
    raw,
    PRINT_AREA_PAIRS,
    'print_area',
  ) as PrintAreaTechniqueCanonical;
}

export function adaptPrintAreaTechniqueRows(
  rows: Raw[] | null | undefined,
): PrintAreaTechniqueCanonical[] {
  if (!Array.isArray(rows)) return [];
  return rows.map(adaptPrintAreaTechniqueRow);
}

/**
 * Helper para mutations: aceita um payload parcial em qualquer schema
 * (PT, EN ou misto) e devolve um objeto contendo **ambos** os nomes para
 * o backend, garantindo que a mutation funcione mesmo se o back já tiver
 * trocado as colunas.
 */
export function buildTecnicaUpdatePayload(partial: Raw): Raw {
  const adapted = adaptTecnicaRow({ ...partial, id: partial.id ?? 'tmp' });
  // Remove o id sintético se não vinha originalmente.
  if (partial.id === undefined) delete (adapted as Raw).id;
  return adapted as Raw;
}
