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
import { useState, useCallback } from 'react';
import { toast } from 'sonner';

// Re-exportar tudo dos módulos para manter compatibilidade de imports
export * from '@/lib/external-db/types';
export * from '@/lib/external-db/tables';
export { extractFunctionErrorMessage } from '@/lib/external-db/invoke';

import type { ExternalTable } from '@/lib/external-db/tables';
import { invokeWithRetry, extractFunctionErrorMessage } from '@/lib/external-db/invoke';
import { logger } from "@/lib/logger";
import type {
  ExternalProduct,
  ExternalProductImage,
  ExternalProductVariant,
  ExternalCategory,
  ExternalSupplier,
  ExternalSupplierColor,
  ExternalSupplierMaterial,
  ExternalSupplierAttributeDefinition,
  ExternalSupplierProductAttribute,
  ExternalProductSupplier,
  ExternalTechnique,
  ExternalPriceTable,
  ExternalCollection,
  ExternalTag,
  ExternalCompany,
  ExternalClientContact,
  ExternalOrganization,
  ExternalRamoAtividade,
  ExternalRamoAtividadeFilho,
  ExternalBusinessSector,
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

// ============================================
// HOOK PRINCIPAL
// ============================================

export function useExternalDatabase<T = Record<string, unknown>>(tableName: ExternalTable) {
  if (!tableName || typeof tableName !== 'string') {
    console.error(`[useExternalDatabase] Invalid tableName: ${JSON.stringify(tableName)}`);
  }

  const [state, setState] = useState<ExternalDatabaseState<T>>({
    data: [],
    count: null,
    isLoading: false,
    error: null,
  });

  const invoke = useCallback(async (
    operation: Operation,
    options?: QueryOptions & { data?: Partial<T> }
  ): Promise<T | QueryResult<T> | null> => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const { data, error } = await invokeWithRetry({
        table: tableName,
        operation,
        data: options?.data,
        filters: options?.filters,
        id: options?.id,
        select: options?.select,
        orderBy: options?.orderBy,
        limit: options?.limit,
        offset: options?.offset,
      });

      if (error) {
        const message = await extractFunctionErrorMessage(error);
        throw new Error(message);
      }

      if (!data?.success) {
        throw new Error(data?.error || 'Erro desconhecido');
      }

      if (operation === 'select') {
        const result = data.data as QueryResult<T>;
        setState(prev => ({ 
          ...prev, 
          data: result.records, 
          count: result.count,
          isLoading: false 
        }));
        return result;
      } 
        setState(prev => ({ ...prev, isLoading: false }));
        return data.data as T;
      
    } catch (err) {
      const errorMessage = await extractFunctionErrorMessage(err);
      setState(prev => ({ ...prev, error: errorMessage, isLoading: false }));
      toast.error(errorMessage);
      return null;
    }
  }, [tableName]);

  const fetchAll = useCallback(async (options?: Omit<QueryOptions, 'id'>) => {
    return invoke('select', options) as Promise<QueryResult<T> | null>;
  }, [invoke]);

  const fetchOne = useCallback(async (id: string, select?: string) => {
    const result = await invoke('select', { id, select, limit: 1 });
    if (result && 'records' in result) {
      return result.records[0] || null;
    }
    return null;
  }, [invoke]);

  const create = useCallback(async (data: Partial<T>) => {
    const result = await invoke('insert', { data });
    if (!result) return null;

    if ('records' in result) {
      const created = result.records[0] || null;
      if (created) {
        toast.success('Registro criado com sucesso!');
        return created as T;
      }
      return null;
    }

    toast.success('Registro criado com sucesso!');
    return result as T;
  }, [invoke]);

  const update = useCallback(async (id: string, data: Partial<T>) => {
    const result = await invoke('update', { id, data });
    if (!result) return null;

    if ('records' in result) {
      const updated = result.records[0] || null;
      if (updated) {
        toast.success('Registro atualizado com sucesso!');
        return updated as T;
      }
      return null;
    }

    toast.success('Registro atualizado com sucesso!');
    return result as T;
  }, [invoke]);

  const remove = useCallback(async (id: string) => {
    const result = await invoke('delete', { id });
    if (result) {
      toast.success('Registro excluído com sucesso!');
      return true;
    }
    return false;
  }, [invoke]);

  const refetch = useCallback(async (options?: Omit<QueryOptions, 'id'>) => {
    return fetchAll(options);
  }, [fetchAll]);

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

export function useExternalProductImages() {
  return useExternalDatabase<ExternalProductImage>('product_images');
}

export function useExternalProductVariants() {
  return useExternalDatabase<ExternalProductVariant>('product_variants');
}

export function useExternalCategories() {
  return useExternalDatabase<ExternalCategory>('categories');
}

export function useExternalSuppliers() {
  return useExternalDatabase<ExternalSupplier>('suppliers');
}

export function useExternalSupplierColors() {
  return useExternalDatabase<ExternalSupplierColor>('supplier_colors');
}

export function useExternalSupplierMaterials() {
  return useExternalDatabase<ExternalSupplierMaterial>('supplier_materials');
}

export function useExternalSupplierAttributeDefinitions() {
  return useExternalDatabase<ExternalSupplierAttributeDefinition>('supplier_attribute_definitions');
}

export function useExternalSupplierProductAttributes() {
  return useExternalDatabase<ExternalSupplierProductAttribute>('supplier_product_attributes');
}

export function useExternalProductSuppliers() {
  return useExternalDatabase<ExternalProductSupplier>('product_suppliers');
}

export function useExternalTechniques() {
  return useExternalDatabase<ExternalTechnique>('personalization_techniques');
}

export function useExternalPriceTables() {
  return useExternalDatabase<ExternalPriceTable>('customization_price_tables');
}

export function useExternalCollections() {
  return useExternalDatabase<ExternalCollection>('collections');
}

export function useExternalTags() {
  return useExternalDatabase<ExternalTag>('tags');
}

// Empresas/Clientes — MIGRADO para CRM externo
export function useExternalCompanies() {
  logger.warn("[DEPRECATED] useExternalCompanies() → use useCrmCompanies() from '@/hooks/useCrmCompanies'");
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

/**
 * @deprecated business_sectors não está exposta no PostgREST do BD externo (PGRST205).
 * Use useExternalRamosAtividade() para dados de segmentos/público-alvo.
 * Mantido com fallback vazio para evitar quebras em código futuro.
 */
export function useExternalBusinessSectors() {
  return {
    data: [] as ExternalBusinessSector[],
    isLoading: false,
    error: null,
    refetch: () => Promise.resolve({ data: [] as ExternalBusinessSector[], error: null }),
  };
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
