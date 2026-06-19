/**
 * useVideoVariantLinks — CRUD hook for video_variant_links table
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface VideoVariantLink {
  id: string;
  product_id: string;
  variant_id: string;
  variant_name: string | null;
  variant_color_hex: string | null;
  video_id: string;
  supplier_code: string | null;
  created_at: string;
}

export function useVideoVariantLinks(productId?: string) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['video-variant-links', productId],
    queryFn: async () => {
      let q = supabase
        .from('video_variant_links')
        .select('*')
        .order('created_at', { ascending: false });
      if (productId) q = q.eq('product_id', productId);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
    enabled: !!productId || productId === undefined,
  });

  const createLink = useMutation({
    mutationFn: async (link: Omit<VideoVariantLink, 'id' | 'created_at'>) => {
      const { data, error } = await supabase
        .from('video_variant_links')
        .insert(link)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['video-variant-links'] });
      toast.success('Vídeo vinculado à variante');
    },
    onError: () => toast.error('Erro ao vincular vídeo'),
  });

  const deleteLink = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('video_variant_links').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['video-variant-links'] });
      toast.success('Vínculo removido');
    },
    onError: () => toast.error('Erro ao remover vínculo'),
  });

  return { ...query, createLink, deleteLink };
}
