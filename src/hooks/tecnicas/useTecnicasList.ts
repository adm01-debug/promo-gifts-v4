/**
 * Hook: Lista de Técnicas
 *
 * IMPORTANTE: USA SOMENTE O BD EXTERNO PROMOBRIND!
 * Tabela real: tabela_preco_gravacao_oficial
 * O bridge mapeia 'tecnica_gravacao' → tabela real
 */
import { useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { dbInvoke } from '@/lib/db/postgrest';
import { TECNICAS_QUERY_OPTIONS } from '@/lib/query-config';
import { TECNICAS_QUERY_KEYS } from '@/hooks/tecnicas/keys';
import type { TecnicaUnificada, TecnicaResumo, TecnicaFiltros } from '@/types/tecnica-unificada';
import {
  adaptTecnicaRow,
  adaptTecnicaRows,
  type TecnicaGravacaoCanonical,
} from '@/lib/personalization/adapters';

type TecnicaBridgeResponse = TecnicaGravacaoCanonical;

function bridgeToTecnicaUnificada(row: TecnicaBridgeResponse): TecnicaUnificada {
  const maxCoresRaw = row.max_colors ?? row.max_cores;
  const maxCores = typeof maxCoresRaw === 'string' ? parseInt(maxCoresRaw, 10) : (maxCoresRaw ?? 0);
  const codigo = row.code ?? row.codigo ?? '';
  const nome = row.name ?? row.nome ?? '';
  const ativo = row.active ?? row.ativo ?? true;
  const ordem = row.display_order ?? row.ordem_exibicao ?? row.ordem_grupo ?? 0;
  const setupCost =
    row.custo_setup ?? row.setup_price ?? (row as { setup_cost?: number }).setup_cost ?? 0;
  const handling = row.handling_price ?? row.custo_manuseio ?? 0;
  const minQty =
    (row as { min_quantity?: number | null }).min_quantity ?? row.quantidade_corte ?? null;
  const prazo =
    row.production_days ??
    row.tempo_producao_dias ??
    (row as { estimated_days?: number | null }).estimated_days ??
    null;
  const curva = row.applies_to_curved ?? row.aplica_superficie_curva ?? row.is_curved ?? false;
  return {
    id: row.id,
    codigo: codigo || '',
    codigoFornecedor: row.internal_code ?? row.codigo_interno ?? null,
    codigoStricker: null,
    nome: nome || '',
    descricao: row.description ?? row.descricao ?? null,
    categoria: row.group_name ?? row.nome_grupo ?? row.group ?? row.grupo_tecnica ?? 'geral',
    icone: null,
    permiteCores: row.allows_colors ?? row.permite_cores ?? maxCores > 0,
    minCores: 1,
    maxCores: maxCores || 0,
    precoPorCor: row.charges_per_color ?? row.cobra_por_cor ?? false,
    precoCorExtra: 0,
    precoPorArea: row.price_by_area ?? row.cobra_por_area ?? false,
    precoPorPontos: row.price_by_points ?? row.cobra_por_pontos ?? false,
    areaMinimaCm2: null,
    areaMaximaCm2: row.max_area_cm2 ?? row.area_maxima_cm2 ?? null,
    pontosMaximos: null,
    custoSetup: typeof setupCost === 'number' ? setupCost : 0,
    custoManuseio: typeof handling === 'number' ? handling : 0,
    multiplicadorCusto: 1,
    quantidadeMinima: minQty,
    prazoEstimado: prazo,
    aplicaSuperficieCurva: !!curva,
    promptSuffix: null,
    ativo: !!ativo,
    ordemExibicao: typeof ordem === 'number' ? ordem : 0,
    fonte: 'externo',
    criadoEm: row.created_at ?? '',
    atualizadoEm: row.updated_at ?? '',
  };
}

// FIX-BRIDGE-01 (2026-06-01): migrated from supabase.functions.invoke to dbInvoke.
async function fetchTecnicasExterno(): Promise<TecnicaBridgeResponse[]> {
  const result = await dbInvoke<Record<string, unknown>>({
    table: 'tecnica_gravacao',
    operation: 'select',
    orderBy: { column: 'ordem_exibicao', ascending: true },
    limit: 200,
  });
  return adaptTecnicaRows(result.records ?? []);
}

export function useTecnicasList(filtros?: TecnicaFiltros) {
  return useQuery({
    queryKey: [...TECNICAS_QUERY_KEYS.lista(), filtros],
    queryFn: async (): Promise<TecnicaUnificada[]> => {
      const rawData = await fetchTecnicasExterno();
      let tecnicas = rawData.map(bridgeToTecnicaUnificada);
      if (filtros) {
        if (filtros.apenasAtivas) tecnicas = tecnicas.filter((t) => t.ativo);
        if (filtros.categoria) tecnicas = tecnicas.filter((t) => t.categoria === filtros.categoria);
        if (filtros.permiteCores !== undefined)
          tecnicas = tecnicas.filter((t) => t.permiteCores === filtros.permiteCores);
        if (filtros.precoPorArea !== undefined)
          tecnicas = tecnicas.filter((t) => t.precoPorArea === filtros.precoPorArea);
        if (filtros.precoPorPontos !== undefined)
          tecnicas = tecnicas.filter((t) => t.precoPorPontos === filtros.precoPorPontos);
        if (filtros.aplicaCurva !== undefined)
          tecnicas = tecnicas.filter((t) => t.aplicaSuperficieCurva === filtros.aplicaCurva);
        if (filtros.busca) {
          const busca = filtros.busca.toLowerCase();
          tecnicas = tecnicas.filter(
            (t) =>
              t.nome.toLowerCase().includes(busca) ||
              t.codigo.toLowerCase().includes(busca) ||
              t.descricao?.toLowerCase().includes(busca),
          );
        }
      }
      return tecnicas;
    },
    ...TECNICAS_QUERY_OPTIONS,
  });
}

export function useTecnicasResumo(apenasAtivas = true) {
  return useQuery({
    queryKey: [...TECNICAS_QUERY_KEYS.resumo(), apenasAtivas],
    queryFn: async (): Promise<TecnicaResumo[]> => {
      const rawData = await fetchTecnicasExterno();
      let tecnicas = rawData;
      if (apenasAtivas) tecnicas = tecnicas.filter((t) => (t.active ?? t.ativo) === true);
      return tecnicas.map((t) => {
        const maxCoresRaw = t.max_colors ?? t.max_cores;
        const maxCores =
          typeof maxCoresRaw === 'string' ? parseInt(maxCoresRaw, 10) : (maxCoresRaw ?? 0);
        return {
          id: t.id,
          codigo: t.code ?? t.codigo ?? '',
          nome: t.name ?? t.nome ?? '',
          categoria: t.group_name ?? t.nome_grupo ?? t.group ?? t.grupo_tecnica ?? 'geral',
          permiteCores: t.allows_colors ?? t.permite_cores ?? maxCores > 0,
          maxCores,
          precoPorCor: t.charges_per_color ?? t.cobra_por_cor ?? false,
          precoPorArea: t.price_by_area ?? t.cobra_por_area ?? false,
          ativo: t.active ?? t.ativo ?? true,
        };
      });
    },
    ...TECNICAS_QUERY_OPTIONS,
  });
}

export function useTecnicaById(id: string | undefined) {
  return useQuery({
    queryKey: TECNICAS_QUERY_KEYS.detalhe(id ?? ''),
    queryFn: async (): Promise<TecnicaUnificada | null> => {
      if (!id) return null;
      const result = await dbInvoke<Record<string, unknown>>({
        table: 'tecnica_gravacao',
        operation: 'select',
        filters: { id },
        limit: 1,
      });
      return result.records.length > 0
        ? bridgeToTecnicaUnificada(adaptTecnicaRow(result.records[0]))
        : null;
    },
    ...TECNICAS_QUERY_OPTIONS,
  });
}

export function useTecnicaByCodigo(codigo: string | undefined) {
  return useQuery({
    queryKey: TECNICAS_QUERY_KEYS.porCodigo(codigo ?? ''),
    queryFn: async (): Promise<TecnicaUnificada | null> => {
      if (!codigo) return null;
      const result = await dbInvoke<Record<string, unknown>>({
        table: 'tecnica_gravacao',
        operation: 'select',
        filters: { codigo },
        limit: 1,
      });
      return result.records.length > 0
        ? bridgeToTecnicaUnificada(adaptTecnicaRow(result.records[0]))
        : null;
    },
    ...TECNICAS_QUERY_OPTIONS,
  });
}

export function useCategoriasTecnicas() {
  const { data: tecnicas = [] } = useTecnicasList({ apenasAtivas: true });
  return useMemo(
    () => [...new Set(tecnicas.map((t) => t.categoria))].filter((c) => c !== 'geral').sort(),
    [tecnicas],
  );
}

export function useInvalidateTecnicas() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: TECNICAS_QUERY_KEYS.all });
  };
}
