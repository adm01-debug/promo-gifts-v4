import { logger } from '@/lib/logger';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export type SystemSetting = {
  key: string;
  value: string;
  description: string | null;
  updated_at: string;
};

export function useSystemSettings() {
  const queryClient = useQueryClient();

  const { data: settings, isLoading } = useQuery({
    queryKey: ['system_settings'],
    queryFn: async () => {
      const { data, error } = await supabase.from('system_settings').select('*');

      if (error) throw error;
      return data as SystemSetting[];
    },
    staleTime: 5 * 60 * 1000,
    retry: 3,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 30_000),
  });

  const updateSetting = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: string }) => {
      const { error } = await supabase
        .from('system_settings')
        .update({ value, updated_at: new Date().toISOString() })
        .eq('key', key);

      if (error) throw error;
      return { key, value };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['system_settings'] });
      toast.success('Configuração atualizada com sucesso');
    },
    onError: (error) => {
      logger.error('Error updating system setting:', error);
      toast.error('Erro ao atualizar configuração');
    },
  });

  const getSetting = (key: string, defaultValue: string) => {
    const setting = settings?.find((s) => s.key === key);
    return setting ? setting.value : defaultValue;
  };

  return {
    settings,
    isLoading,
    getSetting,
    updateSetting,
  };
}
