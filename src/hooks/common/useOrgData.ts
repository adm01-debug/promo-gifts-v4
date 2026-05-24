import { useOrganization } from '@/contexts/OrganizationContext';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

/**
 * Hook to fetch generic data scoped to the current organization.
 * Automatically adds organization_id filter if currentOrg is available.
 */
export function useOrgData<T>(
  tableName: string,
  options: {
    enabled?: boolean;
    select?: string;
    filters?: Record<string, unknown>;
  } = {},
) {
  const { currentOrg } = useOrganization();

  return useQuery({
    queryKey: [tableName, currentOrg?.id, options.filters],
    queryFn: async () => {
      if (!currentOrg) return [] as T[];

      let query = supabase.from(tableName as never).select(options.select || '*');

      // Scope to current organization
      query = query.eq('organization_id', currentOrg.id);

      // Apply additional filters
      if (options.filters) {
        Object.entries(options.filters).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            query = query.eq(key as never, value);
          }
        });
      }

      const { data, error } = await query;

      if (error) {
        console.error(`Error fetching ${tableName}:`, error);
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
export function useOrgCreate(tableName: string) {
  const { currentOrg } = useOrganization();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      if (!currentOrg) throw new Error('No organization selected');

      const { data, error } = await supabase
        .from(tableName as never)
        .insert({
          ...payload,
          organization_id: currentOrg.id,
        })
        .select()
        .single();

      if (error) throw error;
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
export function useOrgUpdate(tableName: string) {
  const { currentOrg } = useOrganization();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...payload }: { id: string; [key: string]: unknown }) => {
      const { data, error } = await supabase
        .from(tableName as never)
        .update(payload)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
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
export function useOrgDelete(tableName: string) {
  const { currentOrg } = useOrganization();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from(tableName as never)
        .delete()
        .eq('id', id);

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
