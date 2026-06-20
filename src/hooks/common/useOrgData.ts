import { useOrganization } from '@/contexts/OrganizationContext';
import { untypedFrom } from '@/lib/supabase-untyped';
import type { Database } from '@/integrations/supabase/types';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { logger } from '@/lib/logger';
type PublicTables = Database['public']['Tables'];
type TableName = keyof PublicTables;
type DynamicTableName = TableName | (string & {});
type TableInsert<T extends TableName> = PublicTables[T]['Insert'];
type TableUpdate<T extends TableName> = PublicTables[T]['Update'];
type OrgScopedInsert<T extends TableName> = Omit<TableInsert<T>, 'organization_id'>;
type OrgScopedUpdate<T extends TableName> = Omit<TableUpdate<T>, 'organization_id'>;

/**
 * Hook to fetch generic data scoped to the current organization.
 * Automatically adds organization_id filter if currentOrg is available.
 */
export function useOrgData<T, TTable extends DynamicTableName = DynamicTableName>(
  tableName: TTable,
  options: {
    enabled?: boolean;
    select?: string;
    filters?: Record<string, unknown>;
  } = {},
) {
  const { currentOrg } = useOrganization();

  return useQuery({
    queryKey: [tableName, currentOrg?.id, options.select, options.filters],
    queryFn: async () => {
      if (!currentOrg) return [] as T[];

      let query = untypedFrom<T>(tableName).select(options.select || '*');

      // Scope to current organization
      query = query.eq('organization_id', currentOrg.id);

      // Apply additional filters
      if (options.filters) {
        Object.entries(options.filters).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            query = query.eq(key, value);
          }
        });
      }

      const { data, error } = await query;

      if (error) {
        logger.error(`Error fetching ${tableName}:`, error);
        throw error;
      }

      return (data || []) as T[];
    },
    enabled: !!currentOrg && options.enabled !== false,
  });
}

/**
 * Hook to create data scoped to the current organization.
 * Automatically adds organization_id to the payload.
 */
export function useOrgCreate<TTable extends DynamicTableName>(tableName: TTable) {
  const { currentOrg } = useOrganization();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (
      payload: TTable extends TableName
        ? OrgScopedInsert<Extract<TTable, TableName>>
        : Record<string, unknown>,
    ) => {
      if (!currentOrg) throw new Error('No organization selected');

      const { data, error } = await untypedFrom(tableName)
        .insert({ ...payload, organization_id: currentOrg.id })
        .select()
        .single();

      if (error) throw error;
      if (!data) throw new Error('Registro não retornado após criação');
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [tableName, currentOrg?.id] });
      toast.success('Registro criado com sucesso');
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : 'Erro desconhecido';
      toast.error(`Erro ao criar registro: ${message}`);
    },
  });
}

/**
 * Hook to update data. RLS will handle organization check.
 */
export function useOrgUpdate<TTable extends DynamicTableName>(tableName: TTable) {
  const { currentOrg } = useOrganization();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      ...payload
    }: { id: string } & (TTable extends TableName
      ? OrgScopedUpdate<Extract<TTable, TableName>>
      : Record<string, unknown>)) => {
      const { data, error } = await untypedFrom(tableName)
        .update(payload)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      if (!data) throw new Error('Registro não retornado após atualização');
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [tableName, currentOrg?.id] });
      toast.success('Registro atualizado com sucesso');
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : 'Erro desconhecido';
      toast.error(`Erro ao atualizar registro: ${message}`);
    },
  });
}

/**
 * Hook to delete data. RLS will handle organization check.
 */
export function useOrgDelete<TTable extends DynamicTableName>(tableName: TTable) {
  const { currentOrg } = useOrganization();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await untypedFrom(tableName).delete().eq('id', id);

      if (error) throw error;
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [tableName, currentOrg?.id] });
      toast.success('Registro removido com sucesso');
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : 'Erro desconhecido';
      toast.error(`Erro ao remover registro: ${message}`);
    },
  });
}
