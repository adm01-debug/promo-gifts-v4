/**
 * Repository: Tabelas de Preço
 *
 * Abstrai acesso a dados de tabelas de preço.
 * Único ponto de acesso ao BD externo para tabelas.
 */

import { dbInvoke } from '@/lib/db/postgrest';
import { transformRawToTabelas, rawToTabelaPrecoTecnica } from '../transformers';
import type { TabelaPrecoTecnica, CustomizationPriceTableRaw } from '@/types/tecnica-unificada';
import { logger } from '@/lib/logger';

// ============================================
// TYPES
// ============================================

export interface PriceTableFilters {
  isActive?: boolean;
  techniqueId?: string;
  techniqueName?: string;
  tableCode?: string;
  tableCodeOption?: string;
  maxColors?: number;
  minColors?: number;
}

export interface PriceTableOrderBy {
  column:
    | 'table_code'
    | 'table_code_option'
    | 'max_colors'
    | 'customization_type_name'
    | 'created_at';
  ascending?: boolean;
}

export interface PriceTableQueryOptions {
  filters?: PriceTableFilters;
  orderBy?: PriceTableOrderBy;
  limit?: number;
  offset?: number;
}

// ============================================
// REPOSITORY
// ============================================

/**
 * Busca todas as tabelas com filtros opcionais
 */
export async function findAll(options: PriceTableQueryOptions = {}): Promise<TabelaPrecoTecnica[]> {
  const { filters, orderBy, limit = 500, offset } = options;

  // Construir filtros para o BD
  const dbFilters: Record<string, unknown> = {};

  if (filters?.isActive !== undefined) {
    dbFilters.is_active = filters.isActive;
  }
  if (filters?.techniqueId) {
    dbFilters.technique_id = filters.techniqueId;
  }
  if (filters?.techniqueName) {
    dbFilters.customization_type_name = filters.techniqueName;
  }
  if (filters?.tableCode) {
    dbFilters.table_code = filters.tableCode;
  }
  if (filters?.tableCodeOption) {
    dbFilters.table_code_option = filters.tableCodeOption;
  }

  const result = await dbInvoke<CustomizationPriceTableRaw>({
    table: 'customization_price_tables',
    operation: 'select',
    filters: Object.keys(dbFilters).length > 0 ? dbFilters : undefined,
    orderBy: orderBy
      ? {
          column: orderBy.column,
          ascending: orderBy.ascending ?? true,
        }
      : { column: 'table_code_option', ascending: true },
    limit,
    offset,
  });

  let tabelas = transformRawToTabelas(result.records);

  // Filtros pós-query (não suportados diretamente)
  if (filters?.maxColors !== undefined) {
    const maxColors = filters.maxColors;
    tabelas = tabelas.filter((t) => t.maxCores !== null && t.maxCores <= maxColors);
  }
  if (filters?.minColors !== undefined) {
    const minColors = filters.minColors;
    tabelas = tabelas.filter((t) => t.maxCores !== null && t.maxCores >= minColors);
  }

  return tabelas;
}

/**
 * Busca tabela por ID
 */
export async function findById(id: string): Promise<TabelaPrecoTecnica | null> {
  const result = await dbInvoke<CustomizationPriceTableRaw>({
    table: 'customization_price_tables',
    operation: 'select',
    filters: { id },
    limit: 1,
  });

  const raw = result.records[0];
  return raw ? rawToTabelaPrecoTecnica(raw) : null;
}

/**
 * Busca tabela por código de opção
 */
export async function findByCodeOption(codeOption: string): Promise<TabelaPrecoTecnica | null> {
  const result = await dbInvoke<CustomizationPriceTableRaw>({
    table: 'customization_price_tables',
    operation: 'select',
    filters: { table_code_option: codeOption },
    limit: 1,
  });

  const raw = result.records[0];
  return raw ? rawToTabelaPrecoTecnica(raw) : null;
}

/**
 * Busca tabelas por nome da técnica
 */
export async function findByTechniqueName(techniqueName: string): Promise<TabelaPrecoTecnica[]> {
  return findAll({
    filters: { techniqueName, isActive: true },
    orderBy: { column: 'max_colors', ascending: true },
  });
}

/**
 * Busca tabela adequada para parâmetros específicos
 */
export async function findBestMatch(params: {
  techniqueName: string;
  colors?: number;
  widthCm?: number;
  heightCm?: number;
}): Promise<TabelaPrecoTecnica | null> {
  const { techniqueName, colors, widthCm, heightCm } = params;

  const tabelas = await findByTechniqueName(techniqueName);

  if (tabelas.length === 0) return null;

  // Encontrar tabela que comporta o número de cores
  let tabelaAdequada: TabelaPrecoTecnica | null = null;

  if (colors) {
    tabelaAdequada = tabelas.find((t) => t.maxCores !== null && t.maxCores >= colors) ?? null;
  }

  // Se não encontrou por cores, pegar a com mais cores disponível
  if (!tabelaAdequada) {
    tabelaAdequada = tabelas.at(-1) ?? null;
  }

  // Validar dimensões se fornecidas
  if (tabelaAdequada && widthCm && heightCm) {
    if (tabelaAdequada.larguraMaxCm && widthCm > tabelaAdequada.larguraMaxCm) {
      logger.warn(`Largura ${widthCm}cm excede máximo ${tabelaAdequada.larguraMaxCm}cm`);
    }
    if (tabelaAdequada.alturaMaxCm && heightCm > tabelaAdequada.alturaMaxCm) {
      logger.warn(`Altura ${heightCm}cm excede máximo ${tabelaAdequada.alturaMaxCm}cm`);
    }
  }

  return tabelaAdequada;
}

/**
 * Lista nomes de técnicas únicos
 */
export async function findTechniqueNames(): Promise<string[]> {
  const result = await dbInvoke<{ customization_type_name: string }>({
    table: 'customization_price_tables',
    operation: 'select',
    select: 'customization_type_name',
    filters: { is_active: true },
  });

  const nomes = [...new Set(result.records.map((r) => r.customization_type_name))];
  return nomes.sort();
}

/**
 * Lista códigos de tabela únicos
 */
export async function findTableCodes(): Promise<string[]> {
  const result = await dbInvoke<{ table_code: string }>({
    table: 'customization_price_tables',
    operation: 'select',
    select: 'table_code',
    filters: { is_active: true },
  });

  const codes = [...new Set(result.records.map((r) => r.table_code))];
  return codes.sort();
}

/**
 * Conta tabelas por técnica
 */
export async function countByTechnique(): Promise<Map<string, number>> {
  const tabelas = await findAll({ filters: { isActive: true } });

  const countMap = new Map<string, number>();
  for (const tabela of tabelas) {
    const count = countMap.get(tabela.nomeTecnica) || 0;
    countMap.set(tabela.nomeTecnica, count + 1);
  }

  return countMap;
}

// ============================================
// EXPORTS
// ============================================

export const PriceTableRepository = {
  findAll,
  findById,
  findByCodeOption,
  findByTechniqueName,
  findBestMatch,
  findTechniqueNames,
  findTableCodes,
  countByTechnique,
};

export default PriceTableRepository;
