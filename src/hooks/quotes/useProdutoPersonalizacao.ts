/**
 * useProdutoPersonalizacao — busca regras de personalização de um produto local
 * (componentes + locations já modeladas em product_components / product_component_locations).
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ComponentLocation {
  id: string;
  location_code: string;
  location_name: string;
  description: string | null;
  max_width_cm: number | null;
  max_height_cm: number | null;
  is_active: boolean;
  sort_order: number | null;
}

export interface ComponentWithLocations {
  id: string;
  component_code: string;
  component_name: string;
  is_personalizable: boolean;
  sort_order: number | null;
  locations: ComponentLocation[];
}

export function useProdutoPersonalizacao(productId: string | null | undefined) {
  return useQuery({
    queryKey: ['produto-personalizacao', productId],
    enabled: !!productId,
    queryFn: async (): Promise<ComponentWithLocations[]> => {
      if (!productId) return [];
      const { data: components, error: cErr } = await supabase
        .from('product_components')
        .select('id, component_code, component_name, is_personalizable, sort_order')
        .eq('product_id', productId)
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

      if (cErr) throw cErr;
      if (!components?.length) return [];

      const componentIds = components.map((c) => c.id);
      const { data: locations, error: lErr } = await supabase
        .from('product_component_locations')
        .select('*')
        .in('component_id', componentIds)
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

      if (lErr) throw lErr;

      return components.map((c) => ({
        ...c,
        locations: ((locations ?? []) as (ComponentLocation & { component_id: string })[])
          .filter((l) => l.component_id === c.id)
          .map(({ component_id: _omit, ...rest }) => rest),
      }));
    },
  });
}
