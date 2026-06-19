import type { TecnicaUnificada } from '@/types/tecnica-unificada';

export interface TechniqueQueryOptions {
  search?: string;
  tipo?: string;
  fornecedor?: string;
  limit?: number;
  page?: number;
}

const GRAVACAO_API = 'https://api.promobrindes.com.br/gravacao';
const API_KEY = import.meta.env.VITE_GRAVACAO_API_KEY;

interface TecnicaGravacaoExterno {
  id: string;
  nome: string;
  codigo: string;
  tipo: string;
  descricao?: string;
  fornecedor?: string;
  areas_aplicacao?: string[];
  quantidade_cores?: number;
  setup?: number;
  custo_por_cm2?: number;
  min_quantidade?: number;
  max_cores?: number;
  tempo_producao_dias?: number;
  dados_extras?: Record<string, unknown>;
}

interface PaginatedResponse<T> {
  data: {
    records: T[];
    total: number;
    page: number;
    limit: number;
  };
  status: number;
}

function externalToTecnicaUnificada(row: TecnicaGravacaoExterno): TecnicaUnificada {
  return {
    id: row.id,
    codigo: row.codigo,
    codigoFornecedor: null,
    codigoStricker: null,
    nome: row.nome,
    descricao: row.descricao ?? null,
    categoria: row.tipo ?? 'geral',
    icone: null,
    permiteCores: (row.max_cores ?? 0) > 0,
    minCores: (row.max_cores ?? 0) > 0 ? 1 : 0,
    maxCores: row.max_cores ?? 0,
    precoPorCor: false,
    precoCorExtra: 0,
    precoPorArea: (row.custo_por_cm2 ?? 0) > 0,
    precoPorPontos: false,
    areaMinimaCm2: null,
    areaMaximaCm2: null,
    pontosMaximos: null,
    custoSetup: row.setup ?? 0,
    custoManuseio: 0,
    multiplicadorCusto: 1,
    quantidadeMinima: row.min_quantidade ?? null,
    prazoEstimado: row.tempo_producao_dias ?? null,
    aplicaSuperficieCurva: false,
    promptSuffix: null,
    ativo: true,
    ordemExibicao: 0,
    fonte: 'externo',
    criadoEm: (row.dados_extras?.created_at as string) ?? new Date(0).toISOString(),
    atualizadoEm: (row.dados_extras?.updated_at as string) ?? new Date(0).toISOString(),
  };
}

export async function findAll(options: TechniqueQueryOptions = {}): Promise<TecnicaUnificada[]> {
  const { search: _search, tipo, fornecedor, limit = 100, page = 1 } = options;

  const params = new URLSearchParams({
    limit: String(limit),
    page: String(page),
    ...(tipo ? { tipo } : {}),
    ...(fornecedor ? { fornecedor } : {}),
  });

  const resp = await fetch(`${GRAVACAO_API}/tecnicas?${params}`, {
    headers: { 'X-API-Key': API_KEY },
  });
  if (!resp.ok) throw new Error(`Failed to fetch techniques: ${resp.statusText}`);
  const data = (await resp.json()) as PaginatedResponse<TecnicaGravacaoExterno>;

  let tecnicas = (data.data?.records ?? []).map(externalToTecnicaUnificada);

  // Filtros pós-query
  if (options?.search) {
    const search = options.search.toLowerCase();
    tecnicas = tecnicas.filter(
      (t: TecnicaUnificada) =>
        t.nome.toLowerCase().includes(search) ||
        t.codigo.toLowerCase().includes(search) ||
        t.descricao?.toLowerCase().includes(search),
    );
  }

  return tecnicas;
}

export async function findById(id: string): Promise<TecnicaUnificada | null> {
  const resp = await fetch(`${GRAVACAO_API}/tecnicas/${id}`, {
    headers: { 'X-API-Key': API_KEY },
  });
  if (!resp.ok) throw new Error(`Failed to fetch technique: ${resp.statusText}`);
  const data = (await resp.json()) as PaginatedResponse<TecnicaGravacaoExterno>;

  const records = data.data?.records ?? [];
  return records.length > 0 ? externalToTecnicaUnificada(records[0]) : null;
}

export async function findByFornecedor(fornecedorId: string): Promise<TecnicaUnificada[]> {
  return findAll({ fornecedor: fornecedorId, limit: 200 });
}

export async function create(tecnica: Omit<TecnicaUnificada, 'id'>): Promise<TecnicaUnificada> {
  const response = await fetch(`${GRAVACAO_API}/tecnicas`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': API_KEY,
    },
    body: JSON.stringify(tecnica),
  });

  if (!response.ok) {
    throw new Error(`Failed to create technique: ${response.statusText}`);
  }

  return response.json();
}

export async function update(
  id: string,
  updates: Partial<TecnicaUnificada>,
): Promise<TecnicaUnificada> {
  const response = await fetch(`${GRAVACAO_API}/tecnicas/${id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': API_KEY,
    },
    body: JSON.stringify(updates),
  });

  if (!response.ok) {
    throw new Error(`Failed to update technique: ${response.statusText}`);
  }

  return response.json();
}
