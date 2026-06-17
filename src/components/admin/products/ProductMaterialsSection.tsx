/**
 * ProductMaterialsSection — Seletor hierárquico de materiais (padrão Super Filtro)
 * Enriquecido com: part (parte do produto), percentage (composição %), notes
 */

import { useState, useCallback, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { materialService, type MaterialType } from '@/services/materialService';
import { dbInvoke, dbInvokeDelete } from '@/lib/db/postgrest';
import { untypedFrom } from '@/lib/supabase-untyped';
import { MaterialBadge } from '@/components/materials/MaterialBadge';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { X, Search, Gem, Save, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { MaterialGroupTree } from './MaterialGroupTree';

interface ProductMaterialsSectionProps {
  productId: string;
}

interface LinkedMaterial {
  id: string;
  material_id: string;
  part?: string | null;
  percentage?: number | null;
  notes?: string | null;
}

// Inline edit form for material detail fields
function MaterialDetailEditor({
  linked,
  onSave,
  onCancel,
}: {
  linked: LinkedMaterial;
  onSave: (data: { part: string; percentage: number | null; notes: string }) => void;
  onCancel: () => void;
}) {
  const [part, setPart] = useState(linked.part ?? '');
  const [percentage, setPercentage] = useState<string>(
    linked.percentage !== null ? String(linked.percentage) : '',
  );
  const [notes, setNotes] = useState(linked.notes ?? '');

  return (
    <div className="ml-7 mt-1 flex items-center gap-2">
      <Input
        value={part}
        onChange={(e) => setPart(e.target.value)}
        placeholder="Parte (ex: corpo)"
        className="h-6 w-24 px-1.5 text-[11px]"
      />
      <Input
        type="number"
        value={percentage}
        onChange={(e) => setPercentage(e.target.value)}
        placeholder="%"
        min="0"
        max="100"
        className="h-6 w-16 px-1.5 text-[11px]"
      />
      <Input
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Obs..."
        className="h-6 flex-1 px-1.5 text-[11px]"
      />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label="Salvar"
        className="h-6 w-6"
        onClick={() =>
          onSave({ part, percentage: percentage ? parseFloat(percentage) : null, notes })
        }
      >
        <Save className="h-3 w-3 text-primary" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-6 w-6"
        onClick={onCancel}
        aria-label="Fechar"
      >
        <X className="h-3 w-3" />
      </Button>
    </div>
  );
}

export function ProductMaterialsSection({ productId }: ProductMaterialsSectionProps) {
  const queryClient = useQueryClient();
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [editingMaterialId, setEditingMaterialId] = useState<string | null>(null);

  const { data: groupsData, isLoading: loadingGroups } = useQuery({
    queryKey: ['material-groups-admin'],
    queryFn: () => materialService.getGroups(),
    staleTime: 5 * 60 * 1000,
  });

  const { data: typesData, isLoading: loadingTypes } = useQuery({
    queryKey: ['material-types-admin'],
    queryFn: () => materialService.getTypes(),
    staleTime: 5 * 60 * 1000,
  });

  // Fetch full linked records (with part, percentage, notes)
  const { data: linkedRecords = [], isLoading: loadingProductMaterials } = useQuery<
    LinkedMaterial[]
  >({
    queryKey: ['product-materials-full', productId],
    queryFn: async () => {
      const { records } = await dbInvoke<LinkedMaterial>({
        table: 'product_materials',
        operation: 'select',
        filters: { product_id: productId },
        limit: 200,
      });
      return records;
    },
    enabled: !!productId,
  });

  const linkedMap = useMemo(
    () => new Map<string, LinkedMaterial>(linkedRecords.map((r) => [r.material_id, r])),
    [linkedRecords],
  );
  const linkedMaterialIds = useMemo(() => new Set<string>(linkedMap.keys()), [linkedMap]);

  const allTypes = useMemo(() => typesData?.types ?? [], [typesData?.types]);
  const groups = useMemo(() => groupsData?.groups ?? [], [groupsData?.groups]);

  const typesByGroup = allTypes.reduce<Record<string, MaterialType[]>>((acc, t) => {
    const gid = t.group_id;
    if (!acc[gid]) acc[gid] = [];
    acc[gid].push(t);
    return acc;
  }, {});

  const toggleMaterial = useCallback(
    async (materialId: string, isLinked: boolean) => {
      try {
        if (isLinked) {
          const linked = linkedMap.get(materialId);
          if (!linked?.id) {
            toast.error('Registro não encontrado');
            return;
          }
          await dbInvokeDelete({ table: 'product_materials', id: linked.id });
          toast.success('Material removido');
        } else {
          const { error } = await untypedFrom('product_materials').insert({
            product_id: productId,
            material_id: materialId,
          });
          if (error) throw new Error(error.message);
          toast.success('Material adicionado');
        }
        queryClient.invalidateQueries({ queryKey: ['product-materials-full', productId] });
      } catch {
        toast.error('Erro ao alterar material');
      }
    },
    [productId, queryClient, linkedMap],
  );

  const updateMaterialDetail = useCallback(
    async (
      materialId: string,
      data: { part: string; percentage: number | null; notes: string },
    ) => {
      const linked = linkedMap.get(materialId);
      if (!linked?.id) return;

      try {
        const { error } = await untypedFrom('product_materials')
          .update({
            part: data.part.trim() || null,
            percentage: data.percentage,
            notes: data.notes.trim() || null,
          })
          .eq('id', linked.id);
        if (error) throw new Error(error.message);
        toast.success('Detalhes atualizados');
        setEditingMaterialId(null);
        queryClient.invalidateQueries({ queryKey: ['product-materials-full', productId] });
      } catch {
        toast.error('Erro ao atualizar');
      }
    },
    [productId, queryClient, linkedMap],
  );

  const toggleGroup = (groupId: string) => {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  };

  const clearAll = useCallback(async () => {
    const linkedTypes = allTypes.filter((t) => linkedMaterialIds.has(t.id));
    for (const t of linkedTypes) {
      await toggleMaterial(t.id, true);
    }
  }, [allTypes, linkedMaterialIds, toggleMaterial]);

  const isLoading = loadingGroups || loadingTypes || loadingProductMaterials;

  if (isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-12 w-full rounded-lg" />
        <Skeleton className="h-12 w-full rounded-lg" />
        <Skeleton className="h-12 w-full rounded-lg" />
      </div>
    );
  }

  if (groups.length === 0) {
    return (
      <div className="py-8 text-center">
        <Gem className="mx-auto mb-2 h-8 w-8 text-muted-foreground/50" />
        <p className="text-sm text-muted-foreground">Nenhum material disponível</p>
      </div>
    );
  }

  const linkedCount = linkedMaterialIds.size;
  const searchLower = search.toLowerCase();

  const filteredTypesByGroup = search
    ? Object.fromEntries(
        Object.entries(typesByGroup).map(([gid, types]) => [
          gid,
          types.filter((t) => t.name.toLowerCase().includes(searchLower)),
        ]),
      )
    : typesByGroup;

  const editingLinked = editingMaterialId ? linkedMap.get(editingMaterialId) : undefined;

  return (
    <div className="space-y-3">
      {/* Badges dos materiais selecionados — padrão Super Filtro */}
      {linkedCount > 0 && (
        <div className="rounded-lg border border-primary/20 bg-primary/5 p-2.5">
          <div className="mb-2 flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-xs font-medium text-primary">
              <Gem className="h-3 w-3" />
              Selecionados
            </span>
            <button
              type="button"
              onClick={clearAll}
              className="text-[10px] text-muted-foreground transition-colors hover:text-destructive"
            >
              Limpar todos
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {allTypes
              .filter((t) => linkedMaterialIds.has(t.id))
              .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
              .map((t) => {
                const group = groups.find((g) => g.group_id === t.group_id);
                const linked = linkedMap.get(t.id);
                const linkedPart = linked?.part ?? '';
                const linkedPercentage = linked?.percentage;
                const hasPercentage = linkedPercentage !== null && linkedPercentage !== undefined;
                const hasDetail = linkedPart.length > 0 || hasPercentage;
                return (
                  <div key={t.id} className="flex items-center gap-0.5">
                    <MaterialBadge
                      name={`${t.name}${hasDetail ? ` (${linkedPart}${hasPercentage ? ` ${linkedPercentage}%` : ''})` : ''}`}
                      hexCode={group?.group_hex_code}
                      size="sm"
                      variant="outline"
                      onRemove={() => toggleMaterial(t.id, true)}
                    />
                    <button
                      type="button"
                      onClick={() => setEditingMaterialId(editingMaterialId === t.id ? null : t.id)}
                      className="p-0.5 text-muted-foreground hover:text-primary"
                      title="Editar detalhes (parte, %, obs)"
                    >
                      <Pencil className="h-2.5 w-2.5" />
                    </button>
                  </div>
                );
              })}
          </div>
          {/* Inline editor for selected material */}
          {editingMaterialId && editingLinked && (
            <MaterialDetailEditor
              linked={editingLinked}
              onSave={(data) => updateMaterialDetail(editingMaterialId, data)}
              onCancel={() => setEditingMaterialId(null)}
            />
          )}
        </div>
      )}

      {/* Busca */}
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar material ou grupo..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-8 pl-8 pr-8 text-sm"
        />
        {search && (
          <button
            type="button"
            onClick={() => setSearch('')}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Estatísticas */}
      <div className="flex items-center justify-between px-1 text-[11px] text-muted-foreground">
        <span>{groups.length} grupos</span>
        <span>•</span>
        <span>{allTypes.length} materiais</span>
        <span>•</span>
        <span className={cn('font-medium', linkedCount > 0 && 'text-primary')}>
          {linkedCount} selecionados
        </span>
      </div>

      <ScrollArea className="h-56">
        <MaterialGroupTree
          groups={groups}
          typesByGroup={typesByGroup}
          filteredTypesByGroup={filteredTypesByGroup}
          linkedMaterialIds={linkedMaterialIds}
          linkedMap={linkedMap}
          openGroups={openGroups}
          search={search}
          editingMaterialId={editingMaterialId}
          onToggleGroup={toggleGroup}
          onToggleMaterial={toggleMaterial}
          onEditMaterial={setEditingMaterialId}
          MaterialDetailEditor={MaterialDetailEditor}
          onUpdateMaterialDetail={updateMaterialDetail}
        />
      </ScrollArea>
    </div>
  );
}
