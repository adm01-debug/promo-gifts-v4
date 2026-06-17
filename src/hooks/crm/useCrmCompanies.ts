/**
 * Hook para acessar empresas/clientes do CRM externo
 * Substitui useClients (que usava bitrix_clients)
 */

import { useQuery, useInfiniteQuery } from '@tanstack/react-query';
import { selectCrm, selectCrmById, searchCrm, invokeCrmDb } from '@/lib/crm-db';
import {
  type CrmCompany,
  type CrmCompanyFilters,
  type CrmCustomer,
  getCompanyDisplayName,
} from '@/types/crm';
import { toast } from 'sonner';
import { DEMO_COMPANY, isDemoClient } from '@/lib/bi/demoClient';
import { logger } from '@/lib/logger';
import { maskSensitiveText } from '@/lib/sensitive-masking';
import { toErrorMessage } from '@/lib/to-error-message';

/**
 * Lista empresas do CRM com filtros opcionais
 */
export function useCrmCompanies(filters?: CrmCompanyFilters) {
  return useQuery<CrmCompany[]>({
    queryKey: ['crm-companies', filters],
    queryFn: async () => {
      logger.debug('[CRM-DB] useCrmCompanies: Buscando empresas...', { filters });
      const queryFilters: Record<string, unknown> = {};

      if (filters?.status) queryFilters.status = filters.status;
      if (filters?.cidade) queryFilters.cidade = filters.cidade;
      if (filters?.estado) queryFilters.estado = filters.estado;
      if (filters?.ramo_atividade) queryFilters.ramo_atividade = filters.ramo_atividade;
      if (filters?.is_customer !== undefined) queryFilters.is_customer = filters.is_customer;
      if (filters?.is_supplier !== undefined) queryFilters.is_supplier = filters.is_supplier;
      if (filters?.is_carrier !== undefined) queryFilters.is_carrier = filters.is_carrier;

      // Excluir deletados por padrão
      queryFilters.deleted_at = null;

      if (filters?.search) {
        const results = await searchCrm<CrmCompany>('companies', 'razao_social', filters.search, {
          orderBy: { column: 'razao_social', ascending: true },
          limit: 200,
        });
        logger.debug('[CRM-DB] useCrmCompanies: Busca concluída (search). Total:', results.length);
        return results;
      }

      const results = await selectCrm<CrmCompany>('companies', {
        filters: Object.keys(queryFilters).length > 0 ? queryFilters : undefined,
        orderBy: { column: 'razao_social', ascending: true },
        limit: 200,
      });
      logger.debug('[CRM-DB] useCrmCompanies: Busca concluída (select). Total:', results.length);
      return results;
    },
    staleTime: 10 * 60 * 1000,
  });
}

/**
 * Busca empresa individual do CRM por ID
 */
export function useCrmCompany(id: string | null | undefined) {
  return useQuery<CrmCompany | null>({
    queryKey: ['crm-company', id],
    queryFn: async () => {
      if (!id) return null;
      if (isDemoClient(id)) return DEMO_COMPANY as unknown as CrmCompany;
      return selectCrmById<CrmCompany>('companies', id);
    },
    enabled: !!id,
    staleTime: 10 * 60 * 1000,
  });
}

/**
 * Hook para busca infinita de empresas (dropdown/combobox)
 * Suporta carregamento incremental para performance
 */
export function useCrmInfiniteCompanySelector() {
  return useInfiniteQuery({
    queryKey: ['crm-companies-infinite'],
    queryFn: async ({ pageParam = 0 }) => {
      const startedAt = performance.now();
      logger.debug(`[CRM-DB] useCrmInfiniteCompanySelector: Carregando offset=${pageParam}...`);

      try {
        const result = await invokeCrmDb<CrmCompany[]>({
          table: 'companies',
          operation: 'select',
          select: 'id, razao_social, nome_fantasia, ramo_atividade, logo_url, cnpj',
          // Filtrar apenas clientes ativos reduz drasticamente o conjunto de linhas
          // (sem esse filtro o SELECT estourava o statement_timeout do CRM).
          filters: { deleted_at: null, is_customer: true },
          orderBy: { column: 'razao_social', ascending: true },
          limit: 50,
          offset: pageParam,
        });

        const records = result.data || [];
        const duration = Math.round(performance.now() - startedAt);
        logger.debug(
          `[CRM-DB] useCrmInfiniteCompanySelector: OK. Recebidos ${records.length} registros em ${duration}ms.`,
        );

        return {
          records: records.map((c) => ({
            id: c.id,
            name: getCompanyDisplayName(c),
            razao_social: c.razao_social,
            nome_fantasia: c.nome_fantasia,
            ramo: c.ramo_atividade,
            logo_url: c.logo_url,
            cnpj: c.cnpj,
          })),
          nextOffset: records.length === 50 ? pageParam + 50 : undefined,
        };
      } catch (err) {
        const duration = Math.round(performance.now() - startedAt);
        const msg = maskSensitiveText(toErrorMessage(err)) ?? 'unknown';
        logger.error('[CRM-DB] useCrmInfiniteCompanySelector: FALHA', {
          message: msg,
          durationMs: duration,
        });
        throw err;
      }
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage) => lastPage.nextOffset,
    staleTime: 5 * 60 * 1000,
    retry: (failureCount, error) => {
      // Retry automático com backoff apenas para erros que parecem temporários
      const msg = error instanceof Error ? error.message.toLowerCase() : '';
      const isRetryable =
        msg.includes('timeout') ||
        msg.includes('fetch') ||
        msg.includes('502') ||
        msg.includes('503') ||
        msg.includes('504') ||
        msg.includes('network');

      return isRetryable && failureCount < 3;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * Math.pow(2, attemptIndex), 10000),
  });
}

/**
 * Busca lista de empresas para seletores (dropdown/combobox)
 * @deprecated Use useCrmInfiniteCompanySelector para melhor performance em listas grandes
 */
export function useCrmCompanySelector() {
  return useQuery({
    queryKey: ['crm-companies-selector'],
    queryFn: async () => {
      logger.debug('[CRM-DB] useCrmCompanySelector: Iniciando carregamento...');
      try {
        const companies = await selectCrm<CrmCompany>('companies', {
          select: 'id, razao_social, nome_fantasia, ramo_atividade, logo_url, cnpj',
          filters: { deleted_at: null },
          orderBy: { column: 'razao_social', ascending: true },
          limit: 500,
        });

        logger.debug('[CRM-DB] useCrmCompanySelector: OK. Total:', companies.length);
        return companies.map((c) => ({
          id: c.id,
          name: getCompanyDisplayName(c),
          razao_social: c.razao_social,
          nome_fantasia: c.nome_fantasia,
          ramo: c.ramo_atividade,
          nicho: null,
          primary_color_name: null,
          primary_color_hex: null,
          logo_url: c.logo_url,
          cnpj: c.cnpj,
        }));
      } catch (err) {
        logger.error('[CRM-DB] useCrmCompanySelector: FALHA', {
          message: maskSensitiveText(toErrorMessage(err)) ?? 'unknown',
        });
        toast.error('Não foi possível carregar a lista de empresas.');
        throw err;
      }
    },
    staleTime: 15 * 60 * 1000,
  });
}

/**
 * Hook para dados de customer associado a uma company
 */
export function useCrmCustomer(companyId: string | null | undefined) {
  return useQuery<CrmCustomer | null>({
    queryKey: ['crm-customer', companyId],
    queryFn: async () => {
      if (!companyId) return null;
      const results = await selectCrm<CrmCustomer>('customers', {
        filters: { company_id: companyId },
        limit: 1,
      });
      return results[0] || null;
    },
    enabled: !!companyId,
    staleTime: 10 * 60 * 1000,
  });
}
