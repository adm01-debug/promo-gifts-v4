/**
 * Kit Templates Hook
 * Lista templates curados pelo sistema (kit_templates) e clona para custom_kits.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { sanitizeError } from '@/lib/security/sanitize-error';

export interface KitTemplateRow {
  id: string;
  name: string;
  description: string | null;
  category: string;
  color: string;
  icon: string;
  tag: string | null;
  cover_image_url: string | null;
  box_data: Record<string, unknown> | null;
  items_data: Record<string, unknown>[];
  personalization_data: Record<string, unknown>;
  total_price: number;
  volume_usage_percent: number;
  usage_count: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

const QUERY_KEY = ['kit-templates'] as const;

export function useKitTemplates() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: templates = [], isLoading } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('kit_templates')
        .select('*')
        .eq('is_active', true)
        .order('usage_count', { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as KitTemplateRow[];
    },
    staleTime: 60_000,
  });

  const cloneMutation = useMutation({
    mutationFn: async (template: KitTemplateRow) => {
      if (!user?.id) throw new Error('Usuário não autenticado');

      const { data, error } = await supabase
        .from('custom_kits')
        .insert({
          user_id: user.id,
          name: `${template.name} (cópia)`,
          status: 'draft',
          kit_type: 'montado',
          box_data: template.box_data ? structuredClone(template.box_data) : null,
          items_data: structuredClone(template.items_data),
          personalization_data: structuredClone(template.personalization_data),
          kit_quantity: 1,
          box_price: 0,
          items_price: 0,
          personalization_price: 0,
          total_price: template.total_price,
          volume_usage_percent: template.volume_usage_percent,
          color: template.color,
          icon: template.icon,
          tag: template.tag,
          description: template.description,
        })
        .select()
        .single();
      if (error) throw error;

      // Increment usage_count (best-effort)
      try {
        await (
          supabase as unknown as {
            rpc: (name: string, args: Record<string, unknown>) => Promise<unknown>;
          }
        ).rpc('increment_kit_template_usage', { _template_id: template.id });
      } catch {
        /* best-effort */
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custom-kits'] });
      toast.success('Template clonado para os seus kits!');
    },
    onError: (err: Error) => toast.error('Erro ao clonar', { description: sanitizeError(err) }),
  });

  return {
    templates,
    isLoading,
    cloneTemplate: cloneMutation.mutateAsync,
    isCloning: cloneMutation.isPending,
  };
}
