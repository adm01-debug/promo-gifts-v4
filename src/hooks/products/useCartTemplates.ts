/**
 * useCartTemplates - Salvar e carregar templates de carrinho reutilizáveis
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { sanitizeError } from '@/lib/security/sanitize-error';

export interface CartTemplateItem {
  product_id: string;
  product_name: string;
  product_sku?: string;
  product_image_url?: string;
  product_price: number;
  quantity: number;
  color_name?: string;
  color_hex?: string;
}

export interface CartTemplate {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  items: CartTemplateItem[];
  created_at: string;
  updated_at: string;
}

const QUERY_KEY = 'cart-templates';

// Runtime guard: rejeita itens que não tenham os campos obrigatórios para evitar
// crash no componente ao renderizar um template com JSON malformado no banco.
function parseTemplateItems(raw: unknown): CartTemplateItem[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (item): item is CartTemplateItem =>
      item !== null &&
      typeof item === 'object' &&
      typeof (item as Record<string, unknown>).product_id === 'string' &&
      typeof (item as Record<string, unknown>).product_name === 'string' &&
      typeof (item as Record<string, unknown>).product_price === 'number' &&
      typeof (item as Record<string, unknown>).quantity === 'number',
  );
}

export function useCartTemplates() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const userId = user?.id;

  const templatesQuery = useQuery<CartTemplate[]>({
    queryKey: [QUERY_KEY, userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from('cart_templates')
        .select('*')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false });
      if (error) throw error;
      return (data || []).map((t) => ({
        ...t,
        items: parseTemplateItems(t.items),
      }));
    },
    enabled: !!userId,
  });

  const saveTemplate = useMutation({
    mutationFn: async ({
      name,
      description,
      items,
    }: {
      name: string;
      description?: string;
      items: CartTemplateItem[];
    }) => {
      if (!userId) throw new Error('Não autenticado');
      const { error } = await supabase.from('cart_templates').insert({
        user_id: userId,
        name,
        description: description || null,
        items: items as unknown as Json,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY, userId] });
      toast.success('Template salvo com sucesso');
    },
    onError: (err: Error) => toast.error('Operação falhou', { description: sanitizeError(err) }),
  });

  const deleteTemplate = useMutation({
    mutationFn: async (templateId: string) => {
      const { error } = await supabase.from('cart_templates').delete().eq('id', templateId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY, userId] });
      toast.success('Template excluído');
    },
    onError: (err: Error) =>
      toast.error('Não foi possível excluir o template', { description: sanitizeError(err) }),
  });

  return {
    templates: templatesQuery.data || [],
    isLoading: templatesQuery.isLoading,
    saveTemplate,
    deleteTemplate,
  };
}
