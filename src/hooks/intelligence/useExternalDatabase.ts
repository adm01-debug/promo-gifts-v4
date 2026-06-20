/**
 * External Database Hook - Ponto de entrada principal.
 *
 * Modularizado em:
 * - src/lib/external-db/types.ts    → Interfaces de tipos
 * - src/lib/external-db/tables.ts   → Constantes de tabelas/views
 * - src/lib/external-db/invoke.ts   → Retry logic e error handling
 *
 * Este arquivo contém o hook principal e re-exporta tudo para compatibilidade.
 */
import { dbInvoke, dbInvokeDelete } from '@/lib/db/postgrest';
import { useState, useCallback, useEffect, useRef } from 'react';
import { toast } from 'sonner';

// Re-exportar tudo dos módulos para manter compatibilidade de imports
export type * from '@/lib/external-db/types';
export { extractFunctionErrorMessage } from '@/lib/external-db/invoke';
export type { ExternalTable } from '@/lib/external-db/rest-native';

import type { ExternalTable } from '@/lib/external-db/rest-native';
import { extractFunctionErrorMessage } from '@/lib/external-db/invoke';
import { KillSwitchActiveError } from '@/lib/external-db/kill-switch-client';
import { logger } from '@/lib/logger';
import type {
  ExternalProduct,
  ExternalCategory,
  ExternalSupplier,
  ExternalTechnique,
  ExternalCollection,
  ExternalCompany,
  ExternalClientContact,
  ExternalOrganization,
  ExternalRamoAtividade,
  ExternalRamoAtividadeFilho,
  ExternalMaterialGroup,
  ExternalMaterialType,
  ExternalColorGroup,
  ExternalColorVariation,
} from '@/lib/external-db/types';

// ============================================
// TIPOS INTERNOS DO HOOK
// ============================================

type Operation = 'select' | 'insert' | 'update' | 'delete';

interface QueryOptions {
  filters?: Record<string, unknown>;
  id?: string;
  select?: string;
  orderBy?: { column: string; ascending?: boolean };
  limit?: number;
  offset?: number;
}

interface QueryResult<T> {
  records: T[];
  count: number | null;
}

interface ExternalDatabaseState<T> {
  data: T[];
  count: number | null;
  isLoading: boolean;
  error: string | null;
}

/**
 * Verifica se um erro é relacionado ao bridge descontinuado.
 * Quando o kill-switch está OFF ou há falha de rede com o bridge,
 * o erro não deve gerar toast (é esperado e silencioso).
 */
function isBridgeRelatedError(err: unknown, message: string): boolean {
  // KillSwitchActiveError: bridge explicitamente desativado
  if (err instanceof KillSwitchActiveError) return true;
  // Mensagens típicas do bridge desativado ou erro de rede com a edge function
  const lower = message.toLowerCase();
  return (
    lower.includes('external-db-bridge') ||
    lower.includes('kill-switch') ||
    lower.includes('failed to send a request to the edge function') ||
    lower.includes('foi descontinuada') ||
    lower.includes('migre para rest nativo')
  );
}

// ============================================
// HOOK PRINCIPAL
// ============================================

export function useExternalDatabase<T = Record<string, unknown>>(tableName: ExternalTable) {
  if (!tableName || typeof tableName !== 'string') {
    logger.error(`[useExternalDatabase] Invalid tableName: ${JSON.stringify(tableName)}`);
  }

  const [state, setState] = useState<ExternalDatabaseState<T>>({
    data: [],
    count: null,
    isLoading: false,
    error: null,
  });
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const invoke = useCallback(
    async (
      operation: Operation,
      options?: QueryOptions & { data?: Partial<T> },
    ): Promise<T | QueryResult<T> | null> => {
      if (isMountedRef.current) {
        setState((prev) => ({ ...prev, isLoading: true, error: null }));
      }

      try {
        // MIGRAÇÃO REST-NATIVO (2026-05-30): roteia via dbInvoke, que tenta o
        // REST nativo (PostgREST) primeiro e, quando o kill-switch `edge_external_db_bridge`
        // está OFF, retorna vazio em SILÊNCIO — sem emitir o evento `unavailable` que o
        // invokeWithRetry legado disparava (banner de "catálogo indisponível") para um
        // estado que hoje é o esperado. Ver src/lib/external-db/bridge.ts::dbInvoke.
        //
        // SELECT por id: o REST nativo filtra via PostgREST (.eq), então traduzimos o id
        // em filtro. Para escritas (insert/update/delete) o id segue no campo próprio.
        const idFilter = operation === 'select' && options?.id ? { id: options.id } : undefined;
        const mergedFilters =
          idFilter || options?.filters
            ? { ...(options?.filters ?? {}), ...(idFilter ?? {}) }
            : undefined;

        const result = await dbInvoke<T>({
          table: tableName,
          operation,
          data: options?.data as Record<string, unknown> | undefined,
          filters: mergedFilters,
          id: options?.id,
          select: options?.select,
          orderBy: options?.orderBy,
          limit: options?.limit,
          offset: options?.offset,
        });

        // dbInvoke já devolve { records, count } desempacotado.
        if (operation === 'select') {
          if (isMountedRef.current) {
            setState((prev) => ({
              ...prev,
              data: result.records,
              count: result.count,
              isLoading: false,
            }));
          }
          return result as QueryResult<T>;
        }
        if (isMountedRef.current) {
          setState((prev) => ({ ...prev, isLoading: false }));
        }
        return (result.records[0] ?? null) as T;
      } catch (err) {
        const errorMessage = await extractFunctionErrorMessage(err);
        if (isMountedRef.current) {
          setState((prev) => ({ ...prev, error: errorMessage, isLoading: false }));
          // Não exibir toast para erros do bridge descontinuado — são esperados e silenciosos
          // (kill-switch OFF / falha de rede com a edge function). Demais erros (auth, dados)
          // continuam gerando toast normalmente.
          if (!isBridgeRelatedError(err, errorMessage)) {
            toast.error(errorMessage);
          } else {
            logger.warn(`[useExternalDatabase:${tableName}] bridge silenciado: ${errorMessage}`);
          }
        }
        return null;
      }
    },
    [tableName],
  );

  const fetchAll = useCallback(
    async (options?: Omit<QueryOptions, 'id'>) => {
      return invoke('select', options) as Promise<QueryResult<T> | null>;
    },
    [invoke],
  );

  const fetchOne = useCallback(
    async (id: string, select?: string) => {
      const result = await invoke('select', { id, select, limit: 1 });
      if (result && typeof result === 'object' && 'records' in result) {
        return (result as QueryResult<T>).records[0] || null;
      }
      return null;
    },
    [invoke],
  );

  const create = useCallback(
    async (data: Partial<T>) => {
      const result = await invoke('insert', { data });
      if (!result) return null;

      if (typeof result === 'object' && 'records' in result) {
        const created = (result as QueryResult<T>).records[0] || null;
        if (created) {
          toast.success('Registro criado com sucesso!');
          return created as T;
        }
        return null;
      }

      toast.success('Registro criado com sucesso!');
      return result as T;
    },
    [invoke],
  );

  const update = useCallback(
    async (id: string, data: Partial<T>) => {
      const result = await invoke('update', { id, data });
      if (!result) return null;

      if (typeof result === 'object' && 'records' in result) {
        const updated = (result as QueryResult<T>).records[0] || null;
        if (updated) {
          toast.success('Registro atualizado com sucesso!');
          return updated as T;
        }
        return null;
      }

      toast.success('Registro atualizado com sucesso!');
      return result as T;
    },
    [invoke],
  );

  const remove = useCallback(
    async (id: string) => {
      try {
        await dbInvokeDelete({ table: tableName, id });
        toast.success('Registro excluído com sucesso!');
        return true;
      } catch (err) {
        logger.error('Error deleting:', err);
        toast.error('Erro ao excluir registro');
        return false;
      }
    },
    [tableName],
  );

  const refetch = useCallback(
    async (options?: Omit<QueryOptions, 'id'>) => {
      return fetchAll(options);
    },
    [fetchAll],
  );

  return {
    ...state,
    fetchAll,
    fetchOne,
    create,
    update,
    remove,
    refetch,
    invoke,
  };
}

// ============================================
// HOOKS ESPECÍFICOS POR RECURSO
// ============================================

export function useExternalProducts() {
  return useExternalDatabase<ExternalProduct>('products');
}

export function useExternalCategories() {
  return useExternalDatabase<ExternalCategory>('categories');
}

export function useExternalSuppliers() {
  return useExternalDatabase<ExternalSupplier>('suppliers');
}

export function useExternalTechniques() {
  return useExternalDatabase<ExternalTechnique>('personalization_techniques');
}

export function useExternalCollections() {
  return useExternalDatabase<ExternalCollection>('collections');
}

// Empresas/Clientes — MIGRADO para CRM externo
export function useExternalCompanies() {
  logger.warn("[DEPRECATED] useExternalCompanies() → use useCrmCompanies() from '@/hooks/crm'");
  return useExternalDatabase<ExternalCompany>('companies');
}

export function useExternalClientContacts() {
  return useExternalDatabase<ExternalClientContact>('client_contacts');
}

export function useExternalOrganizations() {
  return useExternalDatabase<ExternalOrganization>('organizations');
}

export function useExternalRamosAtividade() {
  return useExternalDatabase<ExternalRamoAtividade>('ramo_atividade');
}

export function useExternalRamosAtividadeFilho() {
  return useExternalDatabase<ExternalRamoAtividadeFilho>('ramo_atividade_filho');
}

export function useExternalMaterialGroups() {
  return useExternalDatabase<ExternalMaterialGroup>('material_groups');
}

export function useExternalMaterialTypes() {
  return useExternalDatabase<ExternalMaterialType>('material_types');
}

export function useExternalColorGroups() {
  return useExternalDatabase<ExternalColorGroup>('color_groups');
}

export function useExternalColorVariations() {
  return useExternalDatabase<ExternalColorVariation>('color_variations');
}
