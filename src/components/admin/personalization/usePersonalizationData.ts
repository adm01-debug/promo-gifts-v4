import { dbInvoke } from '@/lib/db/postgrest';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { untypedFrom } from '@/lib/supabase-untyped';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';

export interface Product {
  id: string;
  name: string;
  sku: string;
}

export interface ProductGroup {
  id: string;
  group_code: string;
  group_name: string;
}

export interface ProductGroupMember {
  id: string;
  product_id: string;
  product_group_id: string;
  use_group_rules: boolean;
  product_group?: ProductGroup;
}

export interface Component {
  id: string;
  product_id: string;
  component_code: string;
  component_name: string;
  is_personalizable: boolean;
  is_active: boolean;
  sort_order: number;
}

export interface Location {
  id: string;
  component_id: string;
  location_code: string;
  location_name: string;
  max_width_cm: number | null;
  max_height_cm: number | null;
  max_area_cm2: number | null;
  area_image_url: string | null;
  is_active: boolean;
}

export interface Technique {
  id: string;
  code: string;
  name: string;
}

export interface LocationTechnique {
  id: string;
  component_location_id: string;
  technique_id: string;
  composed_code: string;
  max_colors: number | null;
  is_default: boolean;
  is_active: boolean;
  technique?: Technique;
}

export function usePersonalizationData(selectedProduct: string | null) {
  const queryClient = useQueryClient();

  const { data: products, isLoading: productsLoading } = useQuery({
    queryKey: ['admin-products-promobrind-full'],
    queryFn: async () => {
      const { fetchPromobrindProducts } = await import('@/lib/external-db');
      const productsData = await fetchPromobrindProducts();
      return productsData.map((p) => ({ id: p.id, name: p.name, sku: p.sku }));
    },
    staleTime: 10 * 60 * 1000,
  });

  const { data: productGroups } = useQuery({
    queryKey: ['admin-product-groups-search'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('product_groups')
        .select('id, group_code, group_name')
        .eq('is_active', true);
      if (error) throw error;
      return data;
    },
  });

  const { data: allMemberships } = useQuery({
    queryKey: ['admin-all-memberships'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('product_group_members')
        .select('product_id, product_group_id');
      if (error) throw error;
      return data;
    },
  });

  const { data: productMembership } = useQuery({
    queryKey: ['product-membership', selectedProduct],
    queryFn: async () => {
      if (!selectedProduct) return null;
      const { data, error } = await supabase
        .from('product_group_members')
        .select(`*, product_group:product_groups(id, group_code, group_name)`)
        .eq('product_id', selectedProduct)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!selectedProduct,
  });

  const { data: components, isLoading: componentsLoading } = useQuery({
    queryKey: ['product-components', selectedProduct],
    queryFn: async () => {
      if (!selectedProduct) return [];
      const { data, error } = await supabase
        .from('product_components')
        .select('*')
        .eq('product_id', selectedProduct)
        .order('sort_order');
      if (error) throw error;
      return data as Component[];
    },
    enabled: !!selectedProduct,
  });

  const { data: locations } = useQuery({
    queryKey: ['component-locations', selectedProduct],
    queryFn: async () => {
      if (!components?.length) return [];
      try {
        const componentIds = components.map((c) => c.id);
        const { data, error } = await untypedFrom('product_component_locations')
          .select('*')
          .in('component_id', componentIds);
        if (error) {
          logger.warn('[Admin] product_component_locations not available:', error.message);
          return [];
        }
        return data as Location[];
      } catch {
        return [];
      }
    },
    enabled: !!components?.length,
  });

  const { data: techniques } = useQuery({
    queryKey: ['techniques-external'],
    queryFn: async () => {
      const result = await dbInvoke<Technique>({
        table: 'personalization_techniques',
        operation: 'select',
        select: 'id, code, name',
        filters: { is_active: true },
        orderBy: { column: 'name', ascending: true },
        limit: 100,
      });
      return result.records;
    },
  });

  const { data: locationTechniques } = useQuery({
    queryKey: ['location-techniques', selectedProduct],
    queryFn: async () => {
      if (!locations?.length) return [];
      try {
        const locationIds = locations.map((l) => l.id);
        const { data, error } = await untypedFrom('product_component_location_techniques')
          .select(`*, technique:personalization_techniques(id, code, name)`)
          .in('component_location_id', locationIds);
        if (error) {
          logger.warn('[Admin] location_techniques not available:', error.message);
          return [];
        }
        return data as LocationTechnique[];
      } catch {
        return [];
      }
    },
    enabled: !!locations?.length,
  });

  // ── Mutations ──
  const toggleGroupRulesMutation = useMutation({
    mutationFn: async ({
      id,
      use_group_rules: useGroupRules,
    }: {
      id: string;
      use_group_rules: boolean;
    }) => {
      const { error } = await supabase
        .from('product_group_members')
        .update({ use_group_rules: useGroupRules })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-membership'] });
      toast.success('Modo de regras atualizado!');
    },
    onError: () => toast.error('Erro ao atualizar modo'),
  });

  const addComponentMutation = useMutation({
    mutationFn: async (data: {
      product_id: string;
      component_code: string;
      component_name: string;
    }) => {
      const { error } = await supabase.from('product_components').insert(data);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-components'] });
      toast.success('Componente adicionado!');
    },
    onError: () => toast.error('Erro ao adicionar componente'),
  });

  const updateComponentMutation = useMutation({
    mutationFn: async ({
      id,
      ...data
    }: {
      id: string;
      component_code?: string;
      component_name?: string;
      is_personalizable?: boolean;
      is_active?: boolean;
    }) => {
      const { error } = await supabase.from('product_components').update(data).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-components'] });
      toast.success('Componente atualizado!');
    },
    onError: () => toast.error('Erro ao atualizar componente'),
  });

  const deleteComponentMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('product_components').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-components'] });
      toast.success('Componente removido!');
    },
    onError: () => toast.error('Erro ao remover componente'),
  });

  const addLocationMutation = useMutation({
    mutationFn: async (data: {
      component_id: string;
      location_code: string;
      location_name: string;
      max_width_cm?: number;
      max_height_cm?: number;
      max_area_cm2?: number;
    }) => {
      const { error } = await untypedFrom('product_component_locations').insert(data);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['component-locations'] });
      toast.success('Localização adicionada!');
    },
    onError: () => toast.error('Erro ao adicionar localização'),
  });

  const updateLocationMutation = useMutation({
    mutationFn: async ({
      id,
      ...data
    }: {
      id: string;
      location_code?: string;
      location_name?: string;
      max_width_cm?: number | null;
      max_height_cm?: number | null;
      max_area_cm2?: number | null;
      area_image_url?: string | null;
      is_active?: boolean;
    }) => {
      const { error } = await untypedFrom('product_component_locations').update(data).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['component-locations'] });
      toast.success('Localização atualizada!');
    },
    onError: () => toast.error('Erro ao atualizar localização'),
  });

  const deleteLocationMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await untypedFrom('product_component_locations').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['component-locations'] });
      toast.success('Localização removida!');
    },
    onError: () => toast.error('Erro ao remover localização'),
  });

  const addTechniqueMutation = useMutation({
    mutationFn: async (data: {
      component_location_id: string;
      technique_id: string;
      composed_code: string;
      max_colors?: number;
    }) => {
      const { error } = await untypedFrom('product_component_location_techniques').insert(data);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['location-techniques'] });
      toast.success('Técnica associada!');
    },
    onError: () => toast.error('Erro ao associar técnica'),
  });

  const updateTechniqueMutation = useMutation({
    mutationFn: async ({
      id,
      ...data
    }: {
      id: string;
      is_default?: boolean;
      max_colors?: number | null;
      is_active?: boolean;
    }) => {
      const { error } = await untypedFrom('product_component_location_techniques')
        .update(data)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['location-techniques'] });
      toast.success('Técnica atualizada!');
    },
    onError: () => toast.error('Erro ao atualizar técnica'),
  });

  const deleteTechniqueMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await untypedFrom('product_component_location_techniques')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['location-techniques'] });
      toast.success('Técnica removida!');
    },
    onError: () => toast.error('Erro ao remover técnica'),
  });

  const getLocationsForComponent = (componentId: string) =>
    locations?.filter((l) => l.component_id === componentId) ?? [];

  const getTechniquesForLocation = (locationId: string) =>
    locationTechniques?.filter((lt) => lt.component_location_id === locationId) ?? [];

  return {
    products,
    productsLoading,
    productGroups,
    allMemberships,
    productMembership,
    components,
    componentsLoading,
    locations,
    techniques,
    locationTechniques,
    toggleGroupRulesMutation,
    addComponentMutation,
    updateComponentMutation,
    deleteComponentMutation,
    addLocationMutation,
    updateLocationMutation,
    deleteLocationMutation,
    addTechniqueMutation,
    updateTechniqueMutation,
    deleteTechniqueMutation,
    getLocationsForComponent,
    getTechniquesForLocation,
    queryClient,
  };
}
