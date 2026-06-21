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

// Runtime guard: rejeita itens malformados e normaliza campos numéricos.
// `typeof NaN === 'number'` é true, por isso usamos Number.isFinite() em vez de typeof.
// Aceita preços como string ("29.90") para compatibilidade com dados legados no banco.
// Campos opcionais (color_name, color_hex, etc.) só são incluídos se forem string.
function parseTemplateItems(raw: unknown): CartTemplateItem[] {
  if (!Array.isArray(raw)) return [];
  return raw.reduce<CartTemplateItem[]>((acc, item) => {
    if (item === null || typeof item !== 'object') return acc;
    const o = item as Record<string, unknown>;
    if (typeof o.product_id !== 'string' || !o.product_id) return acc;
    if (typeof o.product_name !== 'string' || !o.product_name) return acc;
    const price = Number(o.product_price);
    if (!Number.isFinite(price) || price < 0) return acc;
    const qty = Math.trunc(Number(o.quantity));
    if (!Number.isFinite(qty) || qty < 1) return acc;
    acc.push({
      product_id: o.product_id,
      product_name: o.product_name,
      product_price: price,
      quantity: qty,
      ...(typeof o.product_sku === 'string' && { product_sku: o.product_sku }),
      ...(typeof o.product_image_url === 'string' && { product_image_url: o.product_image_url }),
      ...(typeof o.color_name === 'string' && { color_name: o.color_name }),
      ...(typeof o.color_hex === 'string' && { color_hex: o.color_hex }),
    });
    return acc;
  }, []);
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
