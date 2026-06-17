/**
 * useTemplateSnapshot — Captura o estado atual do Kit Builder e persiste como kit_template (admin).
 * Útil para "Salvar como template do sistema" diretamente do builder.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { sanitizeError } from '@/lib/security/sanitize-error';
import type { KitState } from '@/lib/kit-builder';

export interface SnapshotInput {
  kitState: KitState;
  templateId?: string;
  category?: string;
  overrideName?: string;
}

export function useTemplateSnapshot() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async ({ kitState, templateId, category, overrideName }: SnapshotInput) => {
      const identity = kitState.identity;
      const payload = {
        name: overrideName || kitState.name || 'Template sem nome',
        description: identity?.description ?? null,
        category: category || 'Geral',
        color: identity?.color ?? '#3B82F6',
        icon: identity?.icon ?? 'Package',
        tag: identity?.tag ?? null,
        box_data: kitState.box ? structuredClone(kitState.box) : null,
        items_data: structuredClone(kitState.items),
        personalization_data: structuredClone(kitState.personalization),
        total_price: kitState.totalPrice,
        volume_usage_percent: kitState.volumeUsagePercent,
        is_active: true,
        updated_at: new Date().toISOString(),
      };

      if (templateId) {
        const { data, error } = await supabase
          .from('kit_templates')
          .update(payload as never)
          .eq('id', templateId)
          .select()
          .single();
        if (error || !data) throw error ?? new Error('Template not found');
        return data;
      }
      const { data, error } = await supabase
        .from('kit_templates')
        .insert(payload as never)
        .select()
        .single();
      if (error || !data) throw error ?? new Error('Failed to create template');
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-kit-templates'] });
      queryClient.invalidateQueries({ queryKey: ['kit-templates'] });
      toast.success('Template do sistema salvo!');
    },
    onError: (err: Error) =>
      toast.error('Erro ao salvar template', { description: sanitizeError(err) }),
  });

  return {
    saveAsTemplate: mutation.mutateAsync,
    isSavingTemplate: mutation.isPending,
  };
}
