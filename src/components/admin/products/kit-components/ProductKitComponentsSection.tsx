/**
 * ProductKitComponentsSection — Orchestrator
 * Sub-components: ComponentForm, PrintAreasManager, VolumeValidation
 */
import { useState, useCallback, useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Package, Plus, Pencil, Trash2, Loader2, AlertCircle, Boxes } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

import { ComponentForm } from './ComponentForm';
import { ComponentMediaManager } from './ComponentMediaManager';
import { PrintAreasManager } from './PrintAreasManager';
import { VolumeValidation } from './VolumeValidation';
import {
  fetchKitComponents,
  fetchPrintAreas,
  createComponent,
  updateComponent,
  deleteComponent,
} from './api';
import {
  type KitComponent,
  type ComponentFormData,
  type BoxInternalDimensions,
  EMPTY_FORM,
} from './types';

interface ProductKitComponentsSectionProps {
  productId: string;
  boxInternalDimensions?: BoxInternalDimensions;
}

export function ProductKitComponentsSection({
  productId,
  boxInternalDimensions,
}: ProductKitComponentsSectionProps) {
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<KitComponent | null>(null);

  const {
    data: components = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ['kit-components', productId],
    queryFn: () => fetchKitComponents(productId),
    enabled: !!productId,
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    placeholderData: (prev) => prev,
  });

  const prefetchedRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    components
      .filter((c) => c.allows_personalization && !prefetchedRef.current.has(c.id))
      .forEach((c) => {
        prefetchedRef.current.add(c.id);
        queryClient.prefetchQuery({
          queryKey: ['kit-print-areas', c.id],
          queryFn: () => fetchPrintAreas(c.id),
          staleTime: 5 * 60 * 1000,
        });
      });
  }, [components, queryClient]);

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['kit-components', productId] });
  }, [queryClient, productId]);

  const buildPayload = (formData: ComponentFormData) => ({
    component_name: formData.component_name.trim(),
    component_type_code: formData.component_type_code.trim() || null,
    component_code: formData.component_code.trim() || null,
    component_sku: formData.component_sku.trim() || null,
    supplier_component_code: formData.supplier_component_code.trim() || null,
    component_description: formData.component_description.trim() || null,
    quantity: formData.quantity,
    display_order: formData.display_order,
    material: formData.material.trim() || null,
    color: formData.color.trim() || null,
    height_mm: formData.height_mm,
    width_mm: formData.width_mm,
    length_mm: formData.length_mm,
    weight_g: formData.weight_g,
    is_optional: formData.is_optional,
    is_packaging: formData.is_packaging,
    is_replaceable: formData.is_replaceable,
    allows_personalization: formData.allows_personalization,
    personalization_notes: formData.personalization_notes.trim() || null,
    primary_image_url: formData.primary_image_url.trim() || null,
    notes: formData.notes.trim() || null,
  });

  const handleCreate = async (formData: ComponentFormData) => {
    setIsSaving(true);
    try {
      await createComponent({ kit_product_id: productId, ...buildPayload(formData) });
      toast.success('Componente criado com sucesso');
      setIsCreating(false);
      invalidate();
    } catch {
      toast.error('Erro ao criar componente');
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdate = async (compId: string, formData: ComponentFormData) => {
    setIsSaving(true);
    try {
      await updateComponent(compId, buildPayload(formData));
      toast.success('Componente atualizado');
      setEditingId(null);
      invalidate();
    } catch {
      toast.error('Erro ao atualizar');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsSaving(true);
    try {
      await deleteComponent(deleteTarget.id);
      toast.success('Componente removido');
      setDeleteTarget(null);
      invalidate();
    } catch {
      toast.error('Erro ao remover');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-16 rounded-lg" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 text-sm text-destructive">
        <AlertCircle className="h-4 w-4" /> Erro ao carregar componentes do kit
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          {components.length > 0 ? (
            <>
              <span className="font-medium text-foreground">{components.length} componentes</span>
              <span>•</span>
              <span>
                Total itens:{' '}
                <span className="font-medium text-foreground">
                  {components.reduce((s, c) => s + (c.quantity ?? 1), 0)}
                </span>
              </span>
            </>
          ) : (
            <span className="flex items-center gap-2">
              <Boxes className="h-4 w-4" /> Nenhum componente cadastrado
            </span>
          )}
        </div>
        {!isCreating && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setIsCreating(true);
              setEditingId(null);
            }}
          >
            <Plus className="mr-1 h-3.5 w-3.5" /> Novo Componente
          </Button>
        )}
      </div>

      {components.length > 0 && (
        <VolumeValidation components={components} boxDimensions={boxInternalDimensions} />
      )}

      {isCreating && (
        <ComponentForm
          initial={{ ...EMPTY_FORM, display_order: components.length }}
          onSave={handleCreate}
          onCancel={() => setIsCreating(false)}
          isSaving={isSaving}
        />
      )}

      <ScrollArea className={components.length > 5 ? 'h-[500px]' : ''}>
        <div className="space-y-2">
          {components.map((comp) => {
            if (editingId === comp.id) {
              return (
                <ComponentForm
                  key={comp.id}
                  initial={{
                    component_name: comp.component_name ?? '',
                    component_type_code: comp.component_type_code ?? '',
                    component_code: comp.component_code ?? '',
                    component_sku: comp.component_sku ?? '',
                    supplier_component_code: comp.supplier_component_code ?? '',
                    component_description: comp.component_description ?? '',
                    quantity: comp.quantity ?? 1,
                    display_order: comp.display_order ?? 0,
                    material: comp.material ?? '',
                    color: comp.color ?? '',
                    height_mm: comp.height_mm,
                    width_mm: comp.width_mm,
                    length_mm: comp.length_mm,
                    weight_g: comp.weight_g,
                    is_optional: comp.is_optional ?? false,
                    is_packaging: comp.is_packaging ?? false,
                    is_replaceable: comp.is_replaceable ?? false,
                    allows_personalization: comp.allows_personalization ?? true,
                    personalization_notes: comp.personalization_notes ?? '',
                    primary_image_url: comp.primary_image_url ?? '',
                    notes: comp.notes ?? '',
                  }}
                  onSave={(data) => handleUpdate(comp.id, data)}
                  onCancel={() => setEditingId(null)}
                  isSaving={isSaving}
                />
              );
            }

            return (
              <div key={comp.id} className="space-y-0.5">
                <div
                  className={cn(
                    'group flex items-center gap-2.5 rounded-lg border p-2.5 transition-colors',
                    'hover:bg-accent/50',
                  )}
                >
                  {comp.primary_image_url ? (
                    <img
                      src={comp.primary_image_url}
                      alt={comp.component_name ?? ''}
                      className="h-10 w-10 shrink-0 rounded-md border bg-muted/30 object-contain"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border bg-muted">
                      <Package className="h-4 w-4 text-muted-foreground" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <p className="truncate text-xs font-medium">
                        {comp.component_name || 'Sem nome'}
                      </p>
                      {comp.component_type_code && (
                        <Badge variant="secondary" className="px-1 py-0 text-[9px] uppercase">
                          {comp.component_type_code}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                      {comp.component_sku && (
                        <span className="font-mono">{comp.component_sku}</span>
                      )}
                      <span>Qtd: {comp.quantity ?? 1}</span>
                      {comp.material && <span>• {comp.material}</span>}
                      {comp.color && <span>• {comp.color}</span>}
                    </div>
                    <div className="mt-0.5 flex flex-wrap gap-1">
                      {comp.is_optional && (
                        <Badge variant="outline" className="px-1 py-0 text-[9px]">
                          Opcional
                        </Badge>
                      )}
                      {comp.is_packaging && (
                        <Badge variant="outline" className="px-1 py-0 text-[9px]">
                          Embalagem
                        </Badge>
                      )}
                      {comp.allows_personalization && (
                        <Badge className="border-primary/30 bg-primary/15 px-1 py-0 text-[9px] text-primary">
                          Personalizável
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label="Editar"
                      className="h-7 w-7"
                      onClick={() => {
                        setEditingId(comp.id);
                        setIsCreating(false);
                      }}
                    >
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label="Excluir"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => setDeleteTarget(comp)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                {comp.allows_personalization && (
                  <PrintAreasManager
                    componentId={comp.id}
                    componentName={comp.component_name ?? ''}
                  />
                )}
                <ComponentMediaManager
                  componentId={comp.id}
                  productId={productId}
                  componentName={comp.component_name ?? ''}
                />
              </div>
            );
          })}
        </div>
      </ScrollArea>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir componente?</AlertDialogTitle>
            <AlertDialogDescription>
              O componente <strong>{deleteTarget?.component_name}</strong> e suas áreas de gravação
              serão removidos permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSaving}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isSaving}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
