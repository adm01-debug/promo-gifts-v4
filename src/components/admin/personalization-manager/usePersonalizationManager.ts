import { dbInvoke } from '@/lib/db/postgrest';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { untypedFrom } from '@/lib/supabase-untyped';
import { toast } from 'sonner';
import {
  useSensor,
  useSensors,
  PointerSensor,
  KeyboardSensor,
  type DragEndEvent,
} from '@dnd-kit/core';
import { arrayMove, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { logger } from '@/lib/logger';
import type {
  Product,
  ProductGroup,
  ProductGroupMember,
  Component,
  Location,
  Technique,
  LocationTechnique,
} from './types';

export function usePersonalizationManager() {
  const queryClient = useQueryClient();
  const [selectedProduct, setSelectedProduct] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddComponentOpen, setIsAddComponentOpen] = useState(false);
  const [isAddLocationOpen, setIsAddLocationOpen] = useState(false);
  const [isAddTechniqueOpen, setIsAddTechniqueOpen] = useState(false);
  const [selectedComponentId, setSelectedComponentId] = useState<string | null>(null);
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null);
  const [isCopying, setIsCopying] = useState(false);

  const [newComponent, setNewComponent] = useState({ code: '', name: '' });
  const [newLocation, setNewLocation] = useState({
    code: '',
    name: '',
    maxWidth: '',
    maxHeight: '',
    maxArea: '',
  });
  const [newTechniqueId, setNewTechniqueId] = useState('');
  const [newMaxColors, setNewMaxColors] = useState('');

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // ── Queries ──
  const { data: products, isLoading: productsLoading } = useQuery({
    queryKey: ['admin-products-promobrind-full'],
    queryFn: async () => {
      const { fetchPromobrindProducts } = await import('@/lib/external-db');
      const productsData = await fetchPromobrindProducts();
      return productsData.map((p) => ({ id: p.id, name: p.name, sku: p.sku })) as Product[];
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
      return data as ProductGroup[];
    },
  });

  const { data: allMemberships } = useQuery({
    queryKey: ['admin-all-memberships'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('product_group_members')
        .select('product_id, product_group_id');
      if (error) throw error;
      return data as { product_id: string; product_group_id: string }[];
    },
  });

  const filteredProducts =
    products?.filter((product) => {
      if (!searchQuery.trim()) return true;
      const query = searchQuery.toLowerCase();
      const matchesName = product.name.toLowerCase().includes(query);
      const matchesSku = product.sku.toLowerCase().includes(query);
      const membership = allMemberships?.find((m) => m.product_id === product.id);
      const group = membership
        ? productGroups?.find((g) => g.id === membership.product_group_id)
        : null;
      const matchesGroup =
        group?.group_name.toLowerCase().includes(query) ||
        group?.group_code.toLowerCase().includes(query);
      return matchesName || matchesSku || matchesGroup;
    }) ?? [];

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
      return data as ProductGroupMember | null;
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
      setIsAddComponentOpen(false);
      setNewComponent({ code: '', name: '' });
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
      setIsAddLocationOpen(false);
      setNewLocation({ code: '', name: '', maxWidth: '', maxHeight: '', maxArea: '' });
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
      setIsAddTechniqueOpen(false);
      setNewTechniqueId('');
      setNewMaxColors('');
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

  // ── Handlers ──
  const handleAddComponent = () => {
    if (!selectedProduct || !newComponent.code || !newComponent.name) return;
    addComponentMutation.mutate({
      product_id: selectedProduct,
      component_code: newComponent.code.toUpperCase(),
      component_name: newComponent.name,
    });
  };

  const handleAddLocation = () => {
    if (!selectedComponentId || !newLocation.code || !newLocation.name) return;
    addLocationMutation.mutate({
      component_id: selectedComponentId,
      location_code: newLocation.code.toUpperCase(),
      location_name: newLocation.name,
      max_width_cm: newLocation.maxWidth ? parseFloat(newLocation.maxWidth) : undefined,
      max_height_cm: newLocation.maxHeight ? parseFloat(newLocation.maxHeight) : undefined,
      max_area_cm2: newLocation.maxArea ? parseFloat(newLocation.maxArea) : undefined,
    });
  };

  const handleAddTechnique = () => {
    if (!selectedLocationId || !newTechniqueId) return;
    const location = locations?.find((l) => l.id === selectedLocationId);
    const component = components?.find((c) => c.id === location?.component_id);
    const technique = techniques?.find((t) => t.id === newTechniqueId);
    if (!location || !component || !technique) return;
    const composedCode = `${component.component_code}-${location.location_code}-${technique.code}`;
    addTechniqueMutation.mutate({
      component_location_id: selectedLocationId,
      technique_id: newTechniqueId,
      composed_code: composedCode,
      max_colors: newMaxColors ? parseInt(newMaxColors, 10) : undefined,
    });
  };

  const getLocationsForComponent = (componentId: string) =>
    locations?.filter((l) => l.component_id === componentId) ?? [];
  const getTechniquesForLocation = (locationId: string) =>
    locationTechniques?.filter((lt) => lt.component_location_id === locationId) ?? [];

  const handleComponentDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id || !components) return;
    const oldIndex = components.findIndex((c) => c.id === active.id);
    const newIndex = components.findIndex((c) => c.id === over.id);
    const reordered = arrayMove(components, oldIndex, newIndex);
    for (let i = 0; i < reordered.length; i++) {
      if (reordered[i].sort_order !== i) {
        await supabase
          .from('product_components')
          .update({ sort_order: i })
          .eq('id', reordered[i].id);
      }
    }
    queryClient.invalidateQueries({ queryKey: ['product-components'] });
    toast.success('Ordem atualizada!');
  };

  const copyGroupRulesToProduct = async () => {
    if (!selectedProduct || !productMembership?.product_group_id) return;
    setIsCopying(true);
    try {
      const { data: groupComponents } = await untypedFrom('product_group_components')
        .select('*')
        .eq('product_group_id', productMembership.product_group_id);
      if (!groupComponents?.length) {
        toast.error('Grupo não possui componentes configurados');
        return;
      }
      // BUG-PERSONALIZATION-DELETE-SILENT-FAIL FIX: bare await swallowed RLS errors.
      // If delete fails, component insert loop would create duplicates.
      const { error: deleteCompErr } = await supabase
        .from('product_components')
        .delete()
        .eq('product_id', selectedProduct);
      if (deleteCompErr) throw deleteCompErr;
      for (const gc of groupComponents) {
        const { data: newComp, error: compError } = await supabase
          .from('product_components')
          .insert({
            product_id: selectedProduct,
            component_code: gc.component_code,
            component_name: gc.component_name,
            is_personalizable: gc.is_personalizable,
            is_active: gc.is_active,
            sort_order: gc.sort_order,
          })
          .select()
          .single();
        if (compError) throw compError;
        const { data: groupLocations } = await untypedFrom('product_group_locations')
          .select('*')
          .eq('group_component_id', gc.id);
        if (groupLocations?.length) {
          for (const gl of groupLocations) {
            const { data: newLoc, error: locError } = await untypedFrom(
              'product_component_locations',
            )
              .insert({
                component_id: newComp.id,
                location_code: gl.location_code,
                location_name: gl.location_name,
                max_width_cm: gl.max_width_cm,
                max_height_cm: gl.max_height_cm,
                max_area_cm2: gl.max_area_cm2,
                area_image_url: gl.area_image_url,
                is_active: gl.is_active,
              })
              .select()
              .single();
            if (locError) throw locError;
            const { data: groupTechniques } = await untypedFrom('product_group_location_techniques')
              .select('*')
              .eq('group_location_id', gl.id);
            if (groupTechniques?.length) {
              for (const gt of groupTechniques) {
                const technique = techniques?.find((t) => t.id === gt.technique_id);
                const composedCode = `${gc.component_code}-${gl.location_code}-${technique?.code ?? ''}`;
                await untypedFrom('product_component_location_techniques').insert({
                  component_location_id: newLoc.id,
                  technique_id: gt.technique_id,
                  composed_code: composedCode,
                  max_colors: gt.max_colors,
                  is_default: gt.is_default,
                  is_active: gt.is_active,
                });
              }
            }
          }
        }
      }
      await supabase
        .from('product_group_members')
        .update({ use_group_rules: false })
        .eq('id', productMembership.id);
      queryClient.invalidateQueries({ queryKey: ['product-components'] });
      queryClient.invalidateQueries({ queryKey: ['component-locations'] });
      queryClient.invalidateQueries({ queryKey: ['location-techniques'] });
      queryClient.invalidateQueries({ queryKey: ['product-membership'] });
      toast.success('Regras do grupo copiadas! Agora você pode customizar.');
    } catch (error) {
      logger.error('Error copying rules:', error);
      toast.error('Erro ao copiar regras do grupo');
    } finally {
      setIsCopying(false);
    }
  };

  const isUsingGroupRules = productMembership?.use_group_rules ?? false;
  const hasGroup = !!productMembership;

  return {
    // State
    selectedProduct,
    setSelectedProduct,
    searchQuery,
    setSearchQuery,
    isAddComponentOpen,
    setIsAddComponentOpen,
    isAddLocationOpen,
    setIsAddLocationOpen,
    isAddTechniqueOpen,
    setIsAddTechniqueOpen,
    selectedComponentId,
    setSelectedComponentId,
    selectedLocationId,
    setSelectedLocationId,
    isCopying,
    newComponent,
    setNewComponent,
    newLocation,
    setNewLocation,
    newTechniqueId,
    setNewTechniqueId,
    newMaxColors,
    setNewMaxColors,
    sensors,
    // Data
    products,
    productsLoading,
    productGroups,
    allMemberships,
    filteredProducts,
    productMembership,
    components,
    componentsLoading,
    locations,
    techniques,
    locationTechniques,
    isUsingGroupRules,
    hasGroup,
    // Mutations
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
    // Handlers
    handleAddComponent,
    handleAddLocation,
    handleAddTechnique,
    getLocationsForComponent,
    getTechniquesForLocation,
    handleComponentDragEnd,
    copyGroupRulesToProduct,
  };
}
