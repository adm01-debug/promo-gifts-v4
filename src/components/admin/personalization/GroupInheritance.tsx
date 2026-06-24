import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Link, Unlink, Copy, Loader2 } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { untypedFrom } from '@/lib/supabase-untyped';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';
import type { ProductGroupMember, Technique } from './usePersonalizationData';

interface GroupInheritanceProps {
  productMembership: ProductGroupMember;
  selectedProduct: string;
  techniques: Technique[] | undefined;
  toggleGroupRules: (params: { id: string; use_group_rules: boolean }) => void;
}

export function GroupInheritance({
  productMembership,
  selectedProduct,
  techniques,
  toggleGroupRules,
}: GroupInheritanceProps) {
  const queryClient = useQueryClient();
  const [isCopying, setIsCopying] = useState(false);
  const isUsingGroupRules = productMembership.use_group_rules;

  const copyGroupRulesToProduct = async () => {
    setIsCopying(true);
    try {
      // BUG-GROUPINHERITANCE-GROUPCOMPONENTS-SELECT-SILENT-FAIL FIX: error not checked —
      // a failed SELECT would produce null, incorrectly showing "no components" toast
      // instead of the actual error, leaving nothing to copy.
      const { data: groupComponents, error: gcErr } = await untypedFrom('product_group_components')
        .select('*')
        .eq('product_group_id', productMembership.product_group_id);
      if (gcErr) throw gcErr;

      if (!groupComponents?.length) {
        toast.error('Grupo não possui componentes configurados');
        return;
      }

      // BUG-GROUPINHERITANCE-DELETE-SILENT-FAIL FIX: bare await swallowed RLS errors.
      // Must throw on failure — proceeding would create duplicate components.
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

        // BUG-GROUPINHERITANCE-GROUPLOCATIONS-SELECT-SILENT-FAIL FIX: error not checked —
        // a failed SELECT silently skipped location copy, producing components without areas.
        const { data: groupLocations, error: glErr } = await untypedFrom('product_group_locations')
          .select('*')
          .eq('group_component_id', gc.id);
        if (glErr) throw glErr;
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

            // BUG-GROUPINHERITANCE-GROUPTECHS-SELECT-SILENT-FAIL FIX: error not checked —
            // a failed SELECT silently skipped technique copy, creating locations without printing methods.
            const { data: groupTechs, error: gtErr } = await untypedFrom('product_group_location_techniques')
              .select('*')
              .eq('group_location_id', gl.id);
            if (gtErr) throw gtErr;
            if (groupTechs?.length) {
              for (const gt of groupTechs) {
                const tech = techniques?.find((t) => t.id === gt.technique_id);
                // BUG-GROUPINHERITANCE-TECH-INSERT-SILENT-FAIL FIX: bare await on untypedFrom.
                const { error: techInsertErr } = await untypedFrom(
                  'product_component_location_techniques',
                ).insert({
                  component_location_id: newLoc.id,
                  technique_id: gt.technique_id,
                  composed_code: `${gc.component_code}-${gl.location_code}-${tech?.code ?? ''}`,
                  max_colors: gt.max_colors,
                  is_default: gt.is_default,
                  is_active: gt.is_active,
                });
                if (techInsertErr) {
                  logger.warn('[group-inheritance] technique insert failed:', techInsertErr);
                  throw techInsertErr;
                }
              }
            }
          }
        }
      }

      // BUG-GROUPINHERITANCE-MEMBER-UPDATE-SILENT-FAIL FIX: bare await swallowed RLS errors.
      const { error: memberUpdateErr } = await supabase
        .from('product_group_members')
        .update({ use_group_rules: false })
        .eq('id', productMembership.id);
      if (memberUpdateErr) logger.warn('[group-inheritance] member update failed:', memberUpdateErr);
      queryClient.invalidateQueries({ queryKey: ['product-components'] });
      queryClient.invalidateQueries({ queryKey: ['component-locations'] });
      queryClient.invalidateQueries({ queryKey: ['location-techniques'] });
      queryClient.invalidateQueries({ queryKey: ['product-membership'] });
      toast.success('Regras do grupo copiadas!');
    } catch (error) {
      logger.error('Error copying rules:', error);
      toast.error('Erro ao copiar regras do grupo');
    } finally {
      setIsCopying(false);
    }
  };

  return (
    <>
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-primary/10 p-2">
                {isUsingGroupRules ? (
                  <Link className="h-5 w-5 text-primary" />
                ) : (
                  <Unlink className="h-5 w-5 text-muted-foreground" />
                )}
              </div>
              <div>
                <CardTitle className="text-lg">
                  Grupo: {productMembership.product_group?.group_name}
                </CardTitle>
                <CardDescription>
                  {isUsingGroupRules
                    ? 'Este produto herda as regras do grupo'
                    : 'Este produto usa regras customizadas'}
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {isUsingGroupRules ? (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" disabled={isCopying}>
                      {isCopying ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Copy className="mr-2 h-4 w-4" />
                      )}
                      Customizar
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Customizar regras do produto?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Isso irá copiar todas as regras do grupo para este produto, permitindo que
                        você as modifique individualmente.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={copyGroupRulesToProduct}>
                        Copiar e Customizar
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              ) : (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline">
                      <Link className="mr-2 h-4 w-4" />
                      Voltar para Grupo
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Voltar a usar regras do grupo?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Isso irá descartar as regras customizadas. Esta ação não pode ser desfeita.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() =>
                          toggleGroupRules({ id: productMembership.id, use_group_rules: true })
                        }
                      >
                        Usar Regras do Grupo
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
          </div>
        </CardHeader>
      </Card>

      {isUsingGroupRules && (
        <Card>
          <CardContent className="py-12 text-center">
            <Link className="mx-auto mb-4 h-12 w-12 text-primary opacity-50" />
            <h3 className="mb-2 font-display text-lg font-medium">Usando regras do grupo</h3>
            <p className="mb-4 text-muted-foreground">
              Este produto está herdando as configurações do grupo{' '}
              <strong>{productMembership.product_group?.group_name}</strong>.
            </p>
            <p className="text-sm text-muted-foreground">
              Clique em "Customizar" acima para criar regras específicas.
            </p>
          </CardContent>
        </Card>
      )}
    </>
  );
}
