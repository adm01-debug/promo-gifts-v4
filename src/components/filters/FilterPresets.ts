import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import type { Json } from '@/integrations/supabase/types';
import type { FilterState } from './FilterPanel';

import { logger } from '@/lib/logger';
export interface FilterPreset {
  id: string;
  name: string;
  description?: string;
  filters: FilterState;
  context: string;
  is_default: boolean;
  icon?: string;
  color?: string;
  created_at: string;
  updated_at: string;
}

/**
 * Hook para gerenciar presets de filtros persistidos no banco de dados.
 * Cada vendedor tem seus próprios presets isolados por RLS.
 */
export function useFilterPresets(context = 'catalog') {
  const { user } = useAuth();
  const [presets, setPresets] = useState<FilterPreset[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchPresets = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('saved_filters')
        .select('*')
        .eq('category', context)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setPresets(
        (data || []).map((row) => ({
          id: row.id,
          name: row.name,
          description: row.description ?? undefined,
          filters: row.filter_config as unknown as FilterState,
          context: row.category ?? context,
          is_default: row.is_default ?? false,
          icon: row.icon ?? undefined,
          color: row.color ?? undefined,
          created_at: row.created_at ?? '',
          updated_at: row.updated_at ?? '',
        })),
      );
    } catch (err) {
      logger.error('Error fetching filter presets:', err);
    } finally {
      setIsLoading(false);
    }
  }, [user, context]);

  useEffect(() => {
    fetchPresets();
  }, [fetchPresets]);

  // Legacy compat — returns presets synchronously from state
  const getStoredPresets = useCallback((): FilterPreset[] => {
    return presets;
  }, [presets]);

  const getAllPresets = useCallback((): FilterPreset[] => {
    return presets;
  }, [presets]);

  const savePreset = useCallback(
    async (
      preset: Omit<FilterPreset, 'context' | 'created_at' | 'id' | 'is_default' | 'updated_at'>,
    ): Promise<FilterPreset | null> => {
      if (!user) {
        toast.error('Faça login para salvar presets');
        return null;
      }

      try {
        const { data, error } = await supabase
          .from('saved_filters')
          .insert({
            user_id: user.id,
            name: preset.name,
            description: preset.description || null,
            // FilterState is a flat, JSON-serializable object; widen via unknown
            // because TS won't structurally match it to Json (no index signature).
            filter_config: preset.filters as unknown as Json,
            category: context,
            icon: preset.icon || null,
            color: preset.color || null,
          })
          .select()
          .single();

        if (error) throw error;

        const newPreset: FilterPreset = {
          id: data.id,
          name: data.name,
          description: data.description ?? undefined,
          filters: data.filter_config as unknown as FilterState,
          context: data.category ?? context,
          is_default: data.is_default ?? false,
          icon: data.icon ?? undefined,
          color: data.color ?? undefined,
          created_at: data.created_at ?? '',
          updated_at: data.updated_at ?? '',
        };

        setPresets((prev) => [newPreset, ...prev]);
        return newPreset;
      } catch (err) {
        logger.error('Error saving preset:', err);
        toast.error('Erro ao salvar preset');
        return null;
      }
    },
    [user, context],
  );

  const updatePreset = useCallback(
    async (
      id: string,
      updates: Partial<Pick<FilterPreset, 'color' | 'description' | 'filters' | 'icon' | 'name'>>,
    ): Promise<FilterPreset | null> => {
      try {
        const { filters: filterState, ...restUpdates } = updates;
        const { data, error } = await supabase
          .from('saved_filters')
          .update({
            ...restUpdates,
            updated_at: new Date().toISOString(),
            ...(filterState !== undefined ? { filter_config: filterState as unknown as Json } : {}),
          })
          .eq('id', id)
          .select()
          .single();

        if (error) throw error;

        const updated: FilterPreset = {
          id: data.id,
          name: data.name,
          description: data.description ?? undefined,
          filters: data.filter_config as unknown as FilterState,
          context: data.category ?? context,
          is_default: data.is_default ?? false,
          icon: data.icon ?? undefined,
          color: data.color ?? undefined,
          created_at: data.created_at ?? '',
          updated_at: data.updated_at ?? '',
        };

        setPresets((prev) => prev.map((p) => (p.id === id ? updated : p)));
        return updated;
      } catch (err) {
        logger.error('Error updating preset:', err);
        toast.error('Erro ao atualizar preset');
        return null;
      }
    },
    [context],
  );

  const deletePreset = useCallback(async (id: string): Promise<boolean> => {
    try {
      const { error } = await supabase.from('saved_filters').delete().eq('id', id);

      if (error) throw error;

      setPresets((prev) => prev.filter((p) => p.id !== id));
      return true;
    } catch (err) {
      logger.error('Error deleting preset:', err);
      toast.error('Erro ao excluir preset');
      return false;
    }
  }, []);

  const setDefault = useCallback(
    async (id: string) => {
      if (!user) return;
      try {
        // Remove default from all presets of this context
        const { error: resetError } = await supabase
          .from('saved_filters')
          .update({ is_default: false })
          .eq('category', context);

        if (resetError) throw resetError;

        // Set selected as default
        if (id) {
          const { error: setError } = await supabase
            .from('saved_filters')
            .update({ is_default: true })
            .eq('id', id);

          if (setError) throw setError;
        }

        setPresets((prev) => prev.map((p) => ({ ...p, is_default: p.id === id })));
      } catch (err) {
        logger.error('Error setting default preset:', err);
        toast.error('Erro ao definir preset padrão');
      }
    },
    [user, context],
  );

  const getDefaultPreset = useCallback((): FilterPreset | undefined => {
    return presets.find((p) => p.is_default);
  }, [presets]);

  return {
    presets,
    isLoading,
    getAllPresets,
    getStoredPresets,
    savePreset,
    updatePreset,
    deletePreset,
    setDefault,
    getDefaultPreset,
    refetch: fetchPresets,
  };
}
