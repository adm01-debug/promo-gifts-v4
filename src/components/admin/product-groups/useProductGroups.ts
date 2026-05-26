import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface ProductGroup {
  id: string;
  group_code: string;
  group_name: string;
  description: string | null;
  is_active: boolean;
}

export interface SimpleProduct {
  id: string;
  name: string;
  sku: string;
}

export interface ProductGroupMember {
  id: string;
  product_group_id: string;
  product_id: string;
}

export function useProductGroups() {
  const queryClient = useQueryClient();

  const { data: groups, isLoading: groupsLoading } = useQuery({
    queryKey: ['product-groups'],
    queryFn: async () => {
      const { data, error } = await supabase.from('product_groups').select('*').order('group_name');
      if (error) throw error;
      return data as ProductGroup[];
    },
  });

  const { data: allProducts } = useQuery({
    queryKey: ['all-products-promobrind-full'],
    queryFn: async () => {
      const { fetchPromobrindProducts } = await import('@/lib/external-db');
      const productsData = await fetchPromobrindProducts();
      return productsData.map((p) => ({ id: p.id, name: p.name, sku: p.sku })) as SimpleProduct[];
    },
    staleTime: 10 * 60 * 1000,
  });

  const { data: groupMembers } = useQuery({
    queryKey: ['product-group-members'],
    queryFn: async () => {
      const { data, error } = await supabase.from('product_group_members').select('*');
      if (error) throw error;
      return data as ProductGroupMember[];
    },
  });

  const addGroup = useMutation({
    mutationFn: async (data: { group_code: string; group_name: string; description?: string }) => {
      const { error } = await supabase.from('product_groups').insert(data);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-groups'] });
      toast.success('Grupo criado!');
    },
    onError: () => toast.error('Erro ao criar grupo'),
  });

  const updateGroup = useMutation({
    mutationFn: async ({
      id,
      ...data
    }: {
      id: string;
      group_code?: string;
      group_name?: string;
      description?: string;
      is_active?: boolean;
    }) => {
      const { error } = await supabase.from('product_groups').update(data).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-groups'] });
      toast.success('Grupo atualizado!');
    },
    onError: () => toast.error('Erro ao atualizar grupo'),
  });

  const deleteGroup = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('product_groups').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-groups'] });
      toast.success('Grupo removido!');
    },
    onError: () => toast.error('Erro ao remover grupo'),
  });

  const addMember = useMutation({
    mutationFn: async (data: { product_group_id: string; product_id: string }) => {
      const { error } = await supabase.from('product_group_members').insert(data);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-group-members'] });
      toast.success('Produto adicionado ao grupo!');
    },
    onError: () => toast.error('Erro ao adicionar produto'),
  });

  const removeMember = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('product_group_members').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-group-members'] });
      toast.success('Produto removido do grupo!');
    },
    onError: () => toast.error('Erro ao remover produto'),
  });

  const getMembersForGroup = (groupId: string) =>
    groupMembers?.filter((m) => m.product_group_id === groupId) || [];
  const getAvailableProducts = (groupId: string) => {
    const memberIds = getMembersForGroup(groupId).map((m) => m.product_id);
    return allProducts?.filter((p) => !memberIds.includes(p.id)) || [];
  };
  const getProductInfo = (productId: string) => allProducts?.find((p) => p.id === productId);

  return {
    groups,
    groupsLoading,
    allProducts,
    groupMembers,
    addGroup,
    updateGroup,
    deleteGroup,
    addMember,
    removeMember,
    getMembersForGroup,
    getAvailableProducts,
    getProductInfo,
  };
}
