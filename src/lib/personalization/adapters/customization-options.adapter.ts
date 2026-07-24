/**
 * Customization options adapter — Traduz payloads de
 * `fn_get_product_customization_options` para o formato canônico do front.
 *
 * Aceita aliases EN/legados em cada campo de opção:
 *   - `cobra_por_cor`         ← `charges_per_color`, `price_by_color`
 *   - `usa_dimensao`          ← `uses_dimension`, `price_by_area`
 *   - `is_curved`             ← `curved`, `curved_surface`
 *   - `efetiva_largura_max`   ← `effective_max_width`, `max_width_effective`
 *   - `efetiva_altura_max`    ← `effective_max_height`, `max_height_effective`
 *   - `max_cores`             ← `max_colors`
 *   - `custo_setup`           ← `setup_cost`
 *   - `variacao_label`        ← `variation_label`
 *   - `tecnica_nome`          ← `technique_name`, `name`
 *   - `codigo_tabela`         ← `table_code`
 *   - `grupo_tecnica`         ← `technique_group`, `group_code`
 *   - `gravacao_largura_max`  ← `print_max_width`
 *   - `gravacao_altura_max`   ← `print_max_height`
 */

import type {
  CustomizationOptionsResponse,
  GravacaoLocation,
  TechniqueOption,
} from '@/types/customization';
import { validateRpcPayload } from '@/lib/personalization/rpc-validator';
import { OPTIONS_CONTRACT } from '@/lib/personalization/rpc-contracts';

type Raw = Record<string, unknown>;

function pick<T = unknown>(obj: Raw, ...keys: string[]): T | undefined {
  for (const k of keys) {
    const v = obj[k];
    if (v !== undefined && v !== null) return v as T;
  }
  return undefined;
}

function toNumber(v: unknown, fallback = 0): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return fallback;
}

function toBool(v: unknown, fallback = false): boolean {
  if (typeof v === 'boolean') return v;
  if (v === 'true' || v === 1) return true;
  if (v === 'false' || v === 0) return false;
  return fallback;
}

function adaptOption(raw: Raw): TechniqueOption {
  const maxWidth = toNumber(pick(raw, 'max_width', 'largura_max'));
  const maxHeight = toNumber(pick(raw, 'max_height', 'altura_max'));
  const gravLargura = pick<number | null>(raw, 'gravacao_largura_max', 'print_max_width');
  const gravAltura = pick<number | null>(raw, 'gravacao_altura_max', 'print_max_height');

  return {
    technique_id: String(pick(raw, 'technique_id', 'tecnica_id', 'id') ?? ''),
    codigo_tabela: String(pick(raw, 'codigo_tabela', 'table_code', 'code') ?? ''),
    tecnica_nome: String(pick(raw, 'tecnica_nome', 'technique_name', 'name', 'nome') ?? ''),
    grupo_tecnica: String(pick(raw, 'grupo_tecnica', 'technique_group', 'group_code') ?? ''),
    variacao_label: String(pick(raw, 'variacao_label', 'variation_label') ?? ''),

    max_width: maxWidth,
    max_height: maxHeight,
    gravacao_largura_max: gravLargura === null ? null : toNumber(gravLargura),
    gravacao_altura_max: gravAltura === null ? null : toNumber(gravAltura),
    efetiva_largura_max: toNumber(
      pick(raw, 'efetiva_largura_max', 'effective_max_width', 'max_width_effective'),
      maxWidth,
    ),
    efetiva_altura_max: toNumber(
      pick(raw, 'efetiva_altura_max', 'effective_max_height', 'max_height_effective'),
      maxHeight,
    ),

    shape: (pick<string>(raw, 'shape') ?? 'rectangle') as 'circle' | 'rectangle',
    is_curved: toBool(pick(raw, 'is_curved', 'curved', 'curved_surface')),

    usa_dimensao: toBool(pick(raw, 'usa_dimensao', 'uses_dimension', 'price_by_area')),
    cobra_por_cor: toBool(pick(raw, 'cobra_por_cor', 'charges_per_color', 'price_by_color')),
    max_cores: toNumber(pick(raw, 'max_cores', 'max_colors'), 1),
  };
}

function adaptLocation(raw: Raw): GravacaoLocation {
  const optionsRaw = (raw.options ?? raw.opcoes ?? []) as Raw[];
  return {
    location_code: String(pick(raw, 'location_code', 'code') ?? ''),
    location_name: String(pick(raw, 'location_name', 'name') ?? ''),
    location_order: toNumber(pick(raw, 'location_order', 'order'), 0),
    options: Array.isArray(optionsRaw) ? optionsRaw.map(adaptOption) : [],
  };
}

/**
 * Adapta a resposta crua do RPC para o tipo canônico.
 * Aceita tanto o formato atual (PT) quanto aliases EN.
 */
export function adaptCustomizationOptions(
  resp: Raw | null | undefined,
): CustomizationOptionsResponse | null {
  if (!resp || typeof resp !== 'object') return null;
  // Validação observacional — não bloqueia o parse
  validateRpcPayload(OPTIONS_CONTRACT, resp);
  const locationsRaw = (resp.locations ?? resp.locais ?? []) as Raw[];
  return {
    product_id: String(pick(resp, 'product_id', 'produto_id', 'id') ?? ''),
    locations: Array.isArray(locationsRaw) ? locationsRaw.map(adaptLocation) : [],
  };
}
