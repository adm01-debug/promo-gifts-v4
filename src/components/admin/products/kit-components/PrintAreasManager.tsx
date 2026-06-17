import { useState, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  Pencil,
  Trash2,
  Loader2,
  AlertCircle,
  Target,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
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
import { PrintAreaForm } from './PrintAreaForm';
import { fetchPrintAreas, createPrintArea, updatePrintArea, deletePrintArea } from './api';
import { type PrintArea, type PrintAreaFormData, EMPTY_PRINT_AREA } from './types';

export function PrintAreasManager({
  componentId,
  componentName: _componentName,
}: {
  componentId: string;
  componentName: string;
}) {
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<PrintArea | null>(null);

  const {
    data: areas = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ['kit-print-areas', componentId],
    queryFn: () => fetchPrintAreas(componentId),
    enabled: !!componentId && isOpen,
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    placeholderData: (prev) => prev,
  });

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['kit-print-areas', componentId] });
  }, [queryClient, componentId]);

  const handleCreate = async (formData: PrintAreaFormData) => {
    setIsSaving(true);
    try {
      const areaName = [formData.location_name, formData.technique_name]
        .filter(Boolean)
        .join(' — ');
      await createPrintArea({
        kit_component_id: componentId,
        location_code: formData.location_code.trim() || null,
        location_name: formData.location_name.trim() || null,
        area_name: areaName || null,
        technique_name: formData.technique_name.trim() || null,
        technique_id: formData.technique_id.trim() || null,
        max_width_mm: formData.max_width_mm,
        max_height_mm: formData.max_height_mm,
        tabela_preco_id: formData.tabela_preco_id.trim() || null,
        display_order: formData.display_order,
        notes: formData.notes.trim() || null,
        is_active: true,
      });
      toast.success('Área de gravação criada');
      setIsCreating(false);
      invalidate();
    } catch {
      toast.error('Erro ao criar área');
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdate = async (areaId: string, formData: PrintAreaFormData) => {
    setIsSaving(true);
    try {
      const areaName = [formData.location_name, formData.technique_name]
        .filter(Boolean)
        .join(' — ');
      await updatePrintArea(areaId, {
        location_code: formData.location_code.trim() || null,
        location_name: formData.location_name.trim() || null,
        area_name: areaName || null,
        technique_name: formData.technique_name.trim() || null,
        technique_id: formData.technique_id.trim() || null,
        max_width_mm: formData.max_width_mm,
        max_height_mm: formData.max_height_mm,
        tabela_preco_id: formData.tabela_preco_id.trim() || null,
        display_order: formData.display_order,
        notes: formData.notes.trim() || null,
      });
      toast.success('Área atualizada');
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
      await deletePrintArea(deleteTarget.id);
      toast.success('Área removida');
      setDeleteTarget(null);
      invalidate();
    } catch {
      toast.error('Erro ao remover');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className={cn(
              'flex items-center gap-1.5 rounded-md px-2 py-1 text-[10px] transition-colors',
              'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
              isOpen && 'bg-primary/10 text-primary',
              areas.length > 0 && !isOpen && 'text-primary',
            )}
          >
            <Target className="h-3 w-3" />
            Áreas de Gravação
            {areas.length > 0 && (
              <Badge variant="secondary" className="h-3.5 min-w-[14px] px-1 text-[8px]">
                {areas.length}
              </Badge>
            )}
            {isOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="ml-6 mt-1.5 space-y-1.5">
            {isLoading && (
              <div className="flex items-center gap-1.5 py-1 text-[10px] text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" /> Carregando áreas...
              </div>
            )}

            {error && (
              <div className="flex items-center gap-1.5 py-1 text-[10px] text-destructive">
                <AlertCircle className="h-3 w-3" />
                {error instanceof Error && error.message.includes('kit_component_print_areas')
                  ? 'Tabela kit_component_print_areas não existe no banco externo. Crie-a primeiro.'
                  : 'Erro ao carregar áreas'}
              </div>
            )}

            {!isLoading && !error && areas.length === 0 && !isCreating && (
              <p className="py-1 text-[10px] text-muted-foreground">Nenhuma área cadastrada</p>
            )}

            {areas.map((area) => {
              if (editingId === area.id) {
                return (
                  <PrintAreaForm
                    key={area.id}
                    initial={{
                      location_code: area.location_code ?? '',
                      location_name: area.location_name ?? '',
                      technique_name: area.technique_name ?? '',
                      technique_id: area.technique_id ?? '',
                      max_width_mm: area.max_width_mm,
                      max_height_mm: area.max_height_mm,
                      tabela_preco_id: area.tabela_preco_id ?? '',
                      display_order: area.display_order ?? 0,
                      notes: area.notes ?? '',
                    }}
                    onSave={(data) => handleUpdate(area.id, data)}
                    onCancel={() => setEditingId(null)}
                    isSaving={isSaving}
                  />
                );
              }

              const techniqueBadge = area.area_name?.includes(' — ')
                ? area.area_name.split(' — ')[1]
                : area.technique_name;

              return (
                <div
                  key={area.id}
                  className="group flex items-center gap-2 rounded-md border border-border/50 p-1.5 text-[10px] transition-colors hover:bg-accent/30"
                >
                  <Target className="h-3 w-3 shrink-0 text-primary/60" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1">
                      <span className="truncate font-medium">
                        {area.location_name || area.location_code || 'Sem local'}
                      </span>
                      {techniqueBadge && (
                        <Badge variant="outline" className="shrink-0 px-1 py-0 text-[8px]">
                          {techniqueBadge}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      {(area.max_width_mm || area.max_height_mm) && (
                        <span>
                          {area.max_width_mm ?? '?'}×{area.max_height_mm ?? '?'} mm
                        </span>
                      )}
                      {area.location_code && (
                        <span className="font-mono">{area.location_code}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label="Editar"
                      className="h-5 w-5"
                      onClick={() => {
                        setEditingId(area.id);
                        setIsCreating(false);
                      }}
                    >
                      <Pencil className="h-2.5 w-2.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label="Excluir"
                      className="h-5 w-5 text-destructive hover:text-destructive"
                      onClick={() => setDeleteTarget(area)}
                    >
                      <Trash2 className="h-2.5 w-2.5" />
                    </Button>
                  </div>
                </div>
              );
            })}

            {isCreating && (
              <PrintAreaForm
                initial={{ ...EMPTY_PRINT_AREA, display_order: areas.length }}
                onSave={handleCreate}
                onCancel={() => setIsCreating(false)}
                isSaving={isSaving}
              />
            )}

            {!isCreating && !error && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-5 gap-0.5 px-1.5 text-[10px]"
                onClick={() => {
                  setIsCreating(true);
                  setEditingId(null);
                }}
              >
                <Plus className="h-2.5 w-2.5" /> Área
              </Button>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir área de gravação?</AlertDialogTitle>
            <AlertDialogDescription>
              A área <strong>{deleteTarget?.area_name || deleteTarget?.location_name}</strong> será
              removida permanentemente.
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
    </>
  );
}
