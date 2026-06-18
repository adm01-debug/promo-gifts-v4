/**
 * Hook: Tabelas de Preço
 *
 * Responsável por: Busca e filtragem de tabelas de preço
 */
import { dbInvoke } from '@/lib/db/postgrest';
import { useQuery } from '@tanstack/react-query';
import { TABELAS_PRECO_QUERY_OPTIONS } from '@/lib/query-config';
import { rawToTabelaPrecoTecnica, transformRawToTabelas } from '@/lib/personalization';
import { TECNICAS_QUERY_KEYS } from '@/hooks/tecnicas/keys';
import type {
  TabelaPrecoTecnica,
  TabelaPrecoFiltros,
  CustomizationPriceTableRaw,
} from '@/types/tecnica-unificada';
import { logger } from '@/lib/logger';

/**
 * Lista de tabelas de preço com filtros
 */
export function useTabelasPreco(filtros?: TabelaPrecoFiltros) {
  return useQuery({
    queryKey: [...TECNICAS_QUERY_KEYS.tabelasPreco(), filtros],
    queryFn: async (): Promise<TabelaPrecoTecnica[]> => {
      const filters: Record<string, unknown> = {};

      if (filtros?.apenasAtivas) {
        filters.is_active = true;
      }
      if (filtros?.tecnicaId) {
        filters.technique_id = filtros.tecnicaId;
      }
      if (filtros?.codigoTabela) {
        filters.table_code = filtros.codigoTabela;
      }
      if (filtros?.nomeTecnica) {
        filters.customization_type_name = filtros.nomeTecnica;
      }

      const result = await dbInvoke<CustomizationPriceTableRaw>({
        table: 'customization_price_tables',
        operation: 'select',
        filters: Object.keys(filters).length > 0 ? filters : undefined,
        orderBy: { column: 'table_code', ascending: true },
        limit: 500,
      });

      let tabelas = transformRawToTabelas(result.records);

      // Filtro de max_colors pós-query
      if (filtros?.maxCores !== undefined) {
        tabelas = tabelas.filter((t) => t.maxCores === filtros.maxCores);
      }

      return tabelas;
    },
    ...TABELAS_PRECO_QUERY_OPTIONS,
  });
}

/**
 * Tabelas por nome da técnica
 */
export function useTabelasPorTecnica(nomeTecnica: string | undefined) {
  return useQuery({
    queryKey: TECNICAS_QUERY_KEYS.tabelasPorTecnica(nomeTecnica ?? ''),
    queryFn: async (): Promise<TabelaPrecoTecnica[]> => {
      if (!nomeTecnica) return [];

      const result = await dbInvoke<CustomizationPriceTableRaw>({
        table: 'customization_price_tables',
        operation: 'select',
        filters: { customization_type_name: nomeTecnica, is_active: true },
        orderBy: { column: 'max_colors', ascending: true },
      });

      return transformRawToTabelas(result.records);
    },
    enabled: !!nomeTecnica,
    ...TABELAS_PRECO_QUERY_OPTIONS,
  });
}

/**
 * Tabela por código de opção
 */
export function useTabelaPorCodigo(codigoOpcao: string | undefined) {
  return useQuery({
    queryKey: TECNICAS_QUERY_KEYS.tabelaPorCodigo(codigoOpcao ?? ''),
    queryFn: async (): Promise<TabelaPrecoTecnica | null> => {
      if (!codigoOpcao) return null;

      const result = await dbInvoke<CustomizationPriceTableRaw>({
        table: 'customization_price_tables',
        operation: 'select',
        filters: { table_code_option: codigoOpcao },
        limit: 1,
      });

      const tabela = result.records[0];
      return tabela ? rawToTabelaPrecoTecnica(tabela) : null;
    },
    enabled: !!codigoOpcao,
    ...TABELAS_PRECO_QUERY_OPTIONS,
  });
}

/**
 * Lista de nomes de técnicas únicos (para filtros)
 */
export function useNomesTecnicasPreco() {
  return useQuery({
    queryKey: TECNICAS_QUERY_KEYS.nomesTecnicas(),
    queryFn: async (): Promise<string[]> => {
      const result = await dbInvoke<{ customization_type_name: string }>({
        table: 'customization_price_tables',
        operation: 'select',
        select: 'customization_type_name',
        filters: { is_active: true },
      });

      const nomes = [...new Set(result.records.map((r) => r.customization_type_name))];
      return nomes.sort();
    },
    staleTime: 10 * 60 * 1000,
  });
}

/**
 * Busca tabela adequada para técnica + cores + dimensões
 */
export async function buscarTabelaAdequada(
  nomeTecnica: string,
  cores: number,
  larguraCm?: number,
  alturaCm?: number,
): Promise<TabelaPrecoTecnica | null> {
  const result = await dbInvoke<CustomizationPriceTableRaw>({
    table: 'customization_price_tables',
    operation: 'select',
    filters: { customization_type_name: nomeTecnica, is_active: true },
    orderBy: { column: 'max_colors', ascending: true },
  });

  const tabelas = transformRawToTabelas(result.records);

  // Encontrar tabela que comporta o número de cores
  let tabelaAdequada = tabelas.find((t) => t.maxCores !== null && t.maxCores >= cores);

  // Se não encontrou por cores, pegar a com mais cores disponível
  if (!tabelaAdequada && tabelas.length > 0) {
    tabelaAdequada = tabelas.at(-1);
  }

  // Validar dimensões se fornecidas
  if (tabelaAdequada && larguraCm && alturaCm) {
    if (tabelaAdequada.larguraMaxCm && larguraCm > tabelaAdequada.larguraMaxCm) {
      logger.warn(`Largura ${larguraCm}cm excede máximo ${tabelaAdequada.larguraMaxCm}cm`);
    }
    if (tabelaAdequada.alturaMaxCm && alturaCm > tabelaAdequada.alturaMaxCm) {
      logger.warn(`Altura ${alturaCm}cm excede máximo ${tabelaAdequada.alturaMaxCm}cm`);
    }
  }

  return tabelaAdequada ?? null;
}
