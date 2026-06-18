import { dbInvoke } from '@/lib/db/postgrest';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { untypedFrom } from '@/lib/supabase-untyped';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';

export interface ProductGroup {
  id: string;
  group_code: string;
  group_name: string;
}

export interface GroupComponent {
  id: string;
  product_group_id: string;
  component_code: string;
  component_name: string;
  /**
   * Existe em product_components — herda no momento do "use group rules".
   * Toggle no admin não persiste.
   */
  is_personalizable: boolean;
  is_active: boolean;
  sort_order: number;
}

export interface GroupLocation {
  id: string;
  group_component_id: string;
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

export interface GroupLocationTechnique {
  id: string;
  group_location_id: string;
  technique_id: string;
  max_colors: number | null;
  is_default: boolean;
  is_active: boolean;
  technique?: Technique;
}

export function useGroupPersonalization() {
  const queryClient = useQueryClient();
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);

  const { data: groups, isLoading: groupsLoading } = useQuery({
    queryKey: ['product-groups'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('product_groups')
        .select('id, group_code, group_name')
        .eq('is_active', true)
        .order('group_name');
      if (error) throw error;
      return data as ProductGroup[];
    },
  });

  const { data: components, isLoading: componentsLoading } = useQuery({
    queryKey: ['group-components', selectedGroup],
    queryFn: async () => {
      if (!selectedGroup) return [];
      try {
        const { data, error } = await untypedFrom('product_group_components')
          .select('*')
          .eq('product_group_id', selectedGroup)
          .order('sort_order');
        if (error) {
          logger.warn('[Admin] product_group_components not available:', error.message);
          return [];
        }
        return data as GroupComponent[];
      } catch {
        return [];
      }
    },
    enabled: !!selectedGroup,
  });

  const { data: locations } = useQuery({
    queryKey: ['group-locations', selectedGroup],
    queryFn: async () => {
      if (!components?.length) return [];
      try {
        const componentIds = components.map((c) => c.id);
        const { data, error } = await untypedFrom('product_group_locations')
          .select('*')
          .in('group_component_id', componentIds);
        if (error) {
          logger.warn('[Admin] product_group_locations not available:', error.message);
          return [];
        }
        return data as GroupLocation[];
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
    queryKey: ['group-location-techniques', selectedGroup],
    queryFn: async () => {
      if (!locations?.length) return [];
      try {
        const locationIds = locations.map((l) => l.id);
        const { data, error } = await untypedFrom('product_group_location_techniques')
          .select(`*, technique:personalization_techniques(id, code, name)`)
          .in('group_location_id', locationIds);
        if (error) {
          logger.warn('[Admin] product_group_location_techniques not available:', error.message);
          return [];
        }
        return data as GroupLocationTechnique[];
      } catch {
        return [];
      }
    },
    enabled: !!locations?.length,
  });

  // Mutations
  const addComponent = useMutation({
    mutationFn: async (data: {
      product_group_id: string;
      component_code: string;
      component_name: string;
    }) => {
      const { error } = await untypedFrom('product_group_components').insert(data);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['group-components'] });
      toast.success('Componente adicionado!');
    },
    onError: () => toast.error('Erro ao adicionar componente — tabela pode não existir'),
  });

  const updateComponent = useMutation({
    mutationFn: async ({ id, ...data }: { id: string; [key: string]: unknown }) => {
      const { error } = await untypedFrom('product_group_components').update(data).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['group-components'] }),
    onError: () => toast.error('Erro ao atualizar componente'),
  });

  const deleteComponent = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await untypedFrom('product_group_components').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['group-components'] });
      toast.success('Componente removido!');
    },
    onError: () => toast.error('Erro ao remover componente'),
  });

  const addLocation = useMutation({
    mutationFn: async (data: {
      group_component_id: string;
      location_code: string;
      location_name: string;
      max_width_cm?: number;
      max_height_cm?: number;
      max_area_cm2?: number;
    }) => {
      const { error } = await untypedFrom('product_group_locations').insert(data);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['group-locations'] });
      toast.success('Localização adicionada!');
    },
    onError: () => toast.error('Erro ao adicionar localização'),
  });

  const updateLocation = useMutation({
    mutationFn: async ({ id, ...data }: { id: string; [key: string]: unknown }) => {
      const { error } = await untypedFrom('product_group_locations').update(data).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['group-locations'] });
      toast.success('Localização atualizada!');
    },
    onError: () => toast.error('Erro ao atualizar localização'),
  });

  const deleteLocation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await untypedFrom('product_group_locations').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['group-locations'] });
      toast.success('Localização removida!');
    },
    onError: () => toast.error('Erro ao remover localização'),
  });

  const addTechnique = useMutation({
    mutationFn: async (data: {
      group_location_id: string;
      technique_id: string;
      max_colors?: number;
    }) => {
      const { error } = await untypedFrom('product_group_location_techniques').insert(data);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['group-location-techniques'] });
      toast.success('Técnica associada!');
    },
    onError: () => toast.error('Erro ao associar técnica'),
  });

  const updateTechnique = useMutation({
    mutationFn: async ({ id, ...data }: { id: string; [key: string]: unknown }) => {
      const { error } = await untypedFrom('product_group_location_techniques')
        .update(data)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['group-location-techniques'] });
      toast.success('Técnica atualizada!');
    },
    onError: () => toast.error('Erro ao atualizar técnica'),
  });

  const deleteTechnique = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await untypedFrom('product_group_location_techniques')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['group-location-techniques'] });
      toast.success('Técnica removida!');
    },
    onError: () => toast.error('Erro ao remover técnica'),
  });

  const getLocationsForComponent = (componentId: string) =>
    locations?.filter((l) => l.group_component_id === componentId) ?? [];

  const getTechniquesForLocation = (locationId: string) =>
    locationTechniques?.filter((lt) => lt.group_location_id === locationId) ?? [];

  const reorderComponents = async (
    components: GroupComponent[],
    oldIndex: number,
    newIndex: number,
  ) => {
    const { arrayMove } = await import('@dnd-kit/sortable');
    const reordered = arrayMove(components, oldIndex, newIndex);
    for (let i = 0; i < reordered.length; i++) {
      if (reordered[i].sort_order !== i) {
        await untypedFrom('product_group_components')
          .update({ sort_order: i })
          .eq('id', reordered[i].id);
      }
    }
    queryClient.invalidateQueries({ queryKey: ['group-components'] });
    toast.success('Ordem atualizada!');
  };

  return {
    selectedGroup,
    setSelectedGroup,
    groups,
    groupsLoading,
    components,
    componentsLoading,
    locations,
    techniques,
    locationTechniques,
    addComponent,
    updateComponent,
    deleteComponent,
    addLocation,
    updateLocation,
    deleteLocation,
    addTechnique,
    updateTechnique,
    deleteTechnique,
    getLocationsForComponent,
    getTechniquesForLocation,
    reorderComponents,
  };
}
