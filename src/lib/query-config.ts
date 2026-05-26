/**
 * Configuração centralizada do React Query
 *
 * Define staleTime, cacheTime e outras opções globais
 * com foco especial em dados de técnicas de personalização
 */
import { QueryClient, type DefaultOptions } from '@tanstack/react-query';

// ============================================
// CONSTANTES DE CACHE (em milissegundos)
// ============================================

export const CACHE_TIMES = {
  // Dados muito estáveis - raramente mudam
  VERY_STABLE: 24 * 60 * 60 * 1000, // 24 hours

  // Dados estáveis - podem mudar ocasionalmente
  STABLE: 60 * 60 * 1000, // 1 hour

  // Dados de técnicas - fonte externa, atualização moderada
  TECNICAS: 30 * 60 * 1000, // 30 minutes

  // Dados de tabelas de preço - atualização moderada
  TABELAS_PRECO: 20 * 60 * 1000, // 20 minutes

  // Dados de produtos - podem ter atualizações frequentes
  PRODUTOS: 10 * 60 * 1000, // 10 minutes

  // Dados dinâmicos - mudam frequentemente
  DYNAMIC: 5 * 60 * 1000, // 5 minutes

  // Dados em tempo real - sempre frescos
  REALTIME: 1 * 60 * 1000, // 1 minute

  // Sem cache
  NONE: 0,
} as const;

// ============================================
// GARBAGE COLLECTION TIMES
// ============================================

export const GC_TIMES = {
  // Manter dados inativos por mais tempo para técnicas
  TECNICAS: 30 * 60 * 1000, // 30 minutos

  // Padrão para a maioria dos dados
  DEFAULT: 10 * 60 * 1000, // 10 minutos

  // Dados transitórios
  SHORT: 5 * 60 * 1000, // 5 minutos
} as const;

// ============================================
// QUERY KEYS COM PREFIXOS PARA MATCHING
// ============================================

export const QUERY_KEY_PREFIXES = {
  TECNICAS: 'tecnicas-unificadas',
  TABELAS_PRECO: 'tabelas-preco',
  PRODUTOS: 'products',
  PRODUTO_PERSONALIZACAO: 'produto-personalizacao',
  CATEGORIAS: 'categories',
  CORES: 'colors',
} as const;

// ============================================
// OPÇÕES PADRÃO DO QUERY CLIENT
// ============================================

const defaultQueryOptions: DefaultOptions = {
  queries: {
    // StaleTime padrão global - dados ficam "frescos" por 5 minutos
    staleTime: CACHE_TIMES.PRODUTOS,

    // GC time padrão - dados inativos são removidos após 10 minutos
    gcTime: GC_TIMES.DEFAULT,

    // Retry configuration
    retry: (failureCount, error) => {
      if (error instanceof Error) {
        const msg = error.message.toLowerCase();
        // CloudNotReady → tentar mais vezes (backend ainda subindo)
        if (
          (error as { code?: string }).code === 'CLOUD_NOT_READY' ||
          msg.includes('cloud_not_ready')
        ) {
          return failureCount < 5;
        }
        // 4xx determinísticos → não retry
        if (/\b(400|401|403|404|409|422)\b/.test(msg)) {
          return false;
        }
        // 5xx / network → até 3
        if (
          /\b(500|502|503|504)\b/.test(msg) ||
          msg.includes('network') ||
          msg.includes('failed to fetch')
        ) {
          return failureCount < 3;
        }
      }
      return failureCount < 2;
    },
    retryDelay: (attemptIndex, error) => {
      // CloudNotReady alinha com o polling adaptativo do status (5→10→15s)
      if (error instanceof Error && (error as { code?: string }).code === 'CLOUD_NOT_READY') {
        return [3000, 5000, 8000, 12000, 15000][Math.min(attemptIndex, 4)];
      }
      return Math.min(1000 * 2 ** attemptIndex, 30000);
    },

    // Refetch behavior
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    refetchOnMount: true,
  },
  mutations: {
    retry: false,
  },
};

// ============================================
// QUERY CLIENT FACTORY
// ============================================

export function createQueryClient(): QueryClient {
  const client = new QueryClient({
    defaultOptions: defaultQueryOptions,
  });

  // Expose to window for edge-case prefetching (e.g. hover on cards).
  // Window's specific shape doesn't overlap with an index signature, so widen via unknown.
  if (typeof window !== 'undefined') {
    (window as unknown as Record<string, unknown>).queryClient = client;
  }

  return client;
}

// ============================================
// HELPERS PARA STALE TIME POR QUERY KEY
// ============================================

/**
 * Retorna o staleTime apropriado baseado na query key
 * Uso: staleTime: getStaleTimeForKey(queryKey)
 */
export function getStaleTimeForKey(queryKey: readonly unknown[]): number {
  const firstKey = queryKey[0];

  if (typeof firstKey !== 'string') {
    return CACHE_TIMES.PRODUTOS; // default
  }

  // Técnicas e tabelas de preço - dados externos, cache maior
  if (firstKey.includes(QUERY_KEY_PREFIXES.TECNICAS)) {
    return CACHE_TIMES.TECNICAS;
  }

  if (firstKey.includes(QUERY_KEY_PREFIXES.TABELAS_PRECO)) {
    return CACHE_TIMES.TABELAS_PRECO;
  }

  if (firstKey.includes(QUERY_KEY_PREFIXES.PRODUTO_PERSONALIZACAO)) {
    return CACHE_TIMES.PRODUTOS;
  }

  // Categorias e cores - muito estáveis
  if (firstKey === QUERY_KEY_PREFIXES.CATEGORIAS) {
    return CACHE_TIMES.STABLE;
  }

  if (firstKey === QUERY_KEY_PREFIXES.CORES) {
    return CACHE_TIMES.VERY_STABLE;
  }

  return CACHE_TIMES.PRODUTOS;
}

/**
 * Retorna o gcTime apropriado baseado na query key
 */
export function getGcTimeForKey(queryKey: readonly unknown[]): number {
  const firstKey = queryKey[0];

  if (typeof firstKey !== 'string') {
    return GC_TIMES.DEFAULT;
  }

  // Técnicas têm gc time maior pois são dados caros de buscar
  if (firstKey.includes(QUERY_KEY_PREFIXES.TECNICAS)) {
    return GC_TIMES.TECNICAS;
  }

  return GC_TIMES.DEFAULT;
}

// ============================================
// OPÇÕES PRÉ-CONFIGURADAS PARA HOOKS
// ============================================

/**
 * Opções otimizadas para queries de técnicas
 */
export const TECNICAS_QUERY_OPTIONS = {
  staleTime: CACHE_TIMES.TECNICAS,
  gcTime: GC_TIMES.TECNICAS,
  refetchOnWindowFocus: false,
  refetchOnMount: false, // Não refetch se já tem dados válidos
} as const;

/**
 * Opções otimizadas para queries de tabelas de preço
 */
export const TABELAS_PRECO_QUERY_OPTIONS = {
  staleTime: CACHE_TIMES.TABELAS_PRECO,
  gcTime: GC_TIMES.TECNICAS,
  refetchOnWindowFocus: false,
  refetchOnMount: false,
} as const;

/**
 * Opções otimizadas para queries de produtos
 */
export const PRODUTOS_QUERY_OPTIONS = {
  staleTime: CACHE_TIMES.PRODUTOS,
  gcTime: GC_TIMES.DEFAULT,
  refetchOnWindowFocus: false,
} as const;

/**
 * Opções para dados muito estáveis (categorias, cores)
 */
export const STABLE_DATA_QUERY_OPTIONS = {
  staleTime: CACHE_TIMES.STABLE,
  gcTime: GC_TIMES.TECNICAS,
  refetchOnWindowFocus: false,
  refetchOnMount: false,
} as const;
