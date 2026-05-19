import { useMemo } from 'react';
import Fuse, { type IFuseOptions } from 'fuse.js';

/**
 * Hook genérico de busca fuzzy tolerante a erros de digitação
 * 
 * Pode ser usado para qualquer lista de itens com campos de texto
 * Ex: clientes, pedidos, orçamentos, etc.
 * 
 * @param items - Lista de itens para buscar
 * @param query - Termo de busca
 * @param keys - Campos para buscar (com peso opcional)
 * @param options - Opções adicionais
 */

interface FuzzySearchOptions {
  threshold?: number;       // 0 = exato, 1 = muito tolerante (default: 0.35)
  minChars?: number;        // Mínimo de caracteres para buscar (default: 2)
  maxResults?: number;      // Máximo de resultados (default: todos)
  sortByScore?: boolean;    // Ordenar por relevância (default: true)
}

interface FuzzyKey<T> {
  name: keyof T;
  weight: number;
}

type FuzzyKeyConfig<T> = keyof T | FuzzyKey<T>;

export function useGenericFuzzySearch<T>(
  items: T[],
  query: string,
  keys: FuzzyKeyConfig<T>[],
  options: FuzzySearchOptions = {}
): { results: T[]; hasSearch: boolean; totalMatches: number } {
  const {
    threshold = 0.35,
    minChars = 2,
    maxResults,
    sortByScore = true,
  } = options;

  // Configuração do Fuse.js
  const fuseOptions: IFuseOptions<T> = useMemo(() => {
    const fuseKeys = keys.map((key) => {
      if (typeof key === 'object' && 'name' in key) {
        return { name: String(key.name), weight: key.weight };
      }
      return String(key);
    });

    return {
      keys: fuseKeys,
      threshold,
      distance: 100,
      includeScore: sortByScore,
      minMatchCharLength: minChars,
      ignoreLocation: true,
      findAllMatches: true,
    };
  }, [keys, threshold, minChars, sortByScore]);

  // Criar instância do Fuse
  const fuse = useMemo(() => new Fuse(items, fuseOptions), [items, fuseOptions]);

  // Executar busca
  return useMemo(() => {
    const trimmedQuery = query?.trim() || '';

    if (!trimmedQuery || trimmedQuery.length < minChars) {
      // Sem busca: retorna todos os itens (ou limitado)
      const limited = maxResults ? items.slice(0, maxResults) : items;
      return { results: limited, hasSearch: false, totalMatches: items.length };
    }

    // Busca fuzzy
    const fuseResults = fuse.search(trimmedQuery);
    const mappedResults = fuseResults.map((r) => r.item);
    
    // Aplicar limite se especificado
    const limited = maxResults ? mappedResults.slice(0, maxResults) : mappedResults;

    return {
      results: limited,
      hasSearch: true,
      totalMatches: fuseResults.length,
    };
  }, [items, query, fuse, minChars, maxResults]);
}

// ============================================
// HOOKS ESPECÍFICOS PRÉ-CONFIGURADOS
// ============================================

/**
 * Hook para busca fuzzy de clientes
 */
export interface ClientSearchItem {
  id: string;
  name: string;
  email?: string | null;
  ramo?: string | null;
  nicho?: string | null;
  phone?: string | null;
  bitrix_id?: string;
}

export function useClientFuzzySearch<T extends ClientSearchItem>(
  clients: T[],
  query: string
): { results: T[]; hasSearch: boolean } {
  const { results, hasSearch } = useGenericFuzzySearch(clients, query, [
    { name: 'name', weight: 0.4 },
    { name: 'cnpj', weight: 0.3 },
    { name: 'email', weight: 0.1 },
    { name: 'ramo', weight: 0.1 },
    { name: 'nicho', weight: 0.05 },
    { name: 'phone', weight: 0.05 },
  ]);
  return { results, hasSearch };
}

/**
 * Hook para busca fuzzy de pedidos
 */



/**
 * Hook para busca fuzzy de orçamentos
 */
export interface QuoteSearchItem {
  id: string;
  quote_number: string;
  client_name?: string | null;
  title?: string | null;
  notes?: string | null;
}

export function useQuoteFuzzySearch<T extends QuoteSearchItem>(
  quotes: T[],
  query: string
): { results: T[]; hasSearch: boolean } {
  const { results, hasSearch } = useGenericFuzzySearch(quotes, query, [
    { name: 'quote_number', weight: 0.35 },
    { name: 'client_name', weight: 0.35 },
    { name: 'title', weight: 0.2 },
    { name: 'notes', weight: 0.1 },
  ]);
  return { results, hasSearch };
}
