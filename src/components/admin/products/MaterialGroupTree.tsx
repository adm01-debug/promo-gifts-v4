/**
 * MaterialGroupTree — Group accordion tree extracted from ProductMaterialsSection
 */
import { Checkbox } from '@/components/ui/checkbox';
import { ChevronDown, Pencil, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { MaterialGroup, MaterialType } from '@/services/materialService';
import type { ComponentType } from 'react';

interface LinkedMaterial {
  id: string;
  material_id: string;
  part?: string | null;
  percentage?: number | null;
  notes?: string | null;
}

interface MaterialGroupTreeProps {
  groups: MaterialGroup[];
  typesByGroup: Record<string, MaterialType[]>;
  filteredTypesByGroup: Record<string, MaterialType[]>;
  linkedMaterialIds: Set<string>;
  linkedMap: Map<string, LinkedMaterial>;
  openGroups: Set<string>;
  search: string;
  editingMaterialId: string | null;
  onToggleGroup: (groupId: string) => void;
  onToggleMaterial: (materialId: string, isLinked: boolean) => void;
  onEditMaterial: (materialId: string | null) => void;
  MaterialDetailEditor: ComponentType<{
    linked: LinkedMaterial;
    onSave: (data: { part: string; percentage: number | null; notes: string }) => void;
    onCancel: () => void;
  }>;
  onUpdateMaterialDetail: (
    materialId: string,
    data: { part: string; percentage: number | null; notes: string },
  ) => void;
}

export function MaterialGroupTree({
  groups,
  typesByGroup,
  filteredTypesByGroup,
  linkedMaterialIds,
  linkedMap,
  openGroups,
  search,
  editingMaterialId,
  onToggleGroup,
  onToggleMaterial,
  onEditMaterial,
  MaterialDetailEditor: materialDetailEditor,
  onUpdateMaterialDetail,
}: MaterialGroupTreeProps) {
  const MaterialDetailEditor = materialDetailEditor;
  const searchLower = search.toLowerCase();
  const visibleGroups = [...groups]
    .filter(
      (g) =>
        !search ||
        g.group_name.toLowerCase().includes(searchLower) ||
        (filteredTypesByGroup[g.group_id]?.length ?? 0) > 0,
    )
    .sort((a, b) => a.group_name.localeCompare(b.group_name, 'pt-BR'));

  if (visibleGroups.length === 0 && search) {
    return (
      <div className="py-6 text-center">
        <Search className="mx-auto mb-2 h-6 w-6 text-muted-foreground/50" />
        <p className="text-sm text-muted-foreground">
          Nenhum material encontrado para "<span className="font-medium">{search}</span>"
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-1.5 pr-3">
      {visibleGroups.map((group) => {
        const types = (
          filteredTypesByGroup[group.group_id] ||
          typesByGroup[group.group_id] ||
          []
        ).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
        const linkedInGroup = types.filter((t) => linkedMaterialIds.has(t.id)).length;
        const isOpen = openGroups.has(group.group_id) || !!search;
        const hasAnySelection = linkedInGroup > 0;

        return (
          <div
            key={group.group_id}
            className={cn(
              'overflow-hidden rounded-lg transition-all duration-200',
              hasAnySelection
                ? 'bg-gradient-to-r from-primary/10 to-primary/5 ring-1 ring-primary/30'
                : 'bg-muted/30 hover:bg-muted/50',
            )}
          >
            <div className="flex items-center gap-2 p-2.5">
              <button
                type="button"
                onClick={() => onToggleGroup(group.group_id)}
                className={cn(
                  'rounded-md p-1 transition-all duration-200',
                  isOpen ? 'bg-primary/10' : 'bg-muted hover:bg-muted/80',
                )}
              >
                <ChevronDown
                  className={cn(
                    'h-3.5 w-3.5 transition-transform duration-200',
                    isOpen ? 'rotate-180 text-primary' : 'text-muted-foreground',
                  )}
                />
              </button>
              <div
                className={cn(
                  'h-4 w-4 flex-shrink-0 rounded-full ring-2 ring-offset-1 ring-offset-background transition-all',
                  hasAnySelection ? 'scale-110 ring-primary/50' : 'ring-border/50',
                )}
                style={{
                  backgroundColor: group.group_hex_code || 'hsl(var(--muted))',
                  boxShadow: group.group_hex_code ? `0 2px 8px ${group.group_hex_code}40` : 'none',
                }}
              />
              <span
                className={cn(
                  'flex-1 truncate text-sm font-medium transition-colors',
                  hasAnySelection ? 'text-primary' : 'text-foreground',
                )}
              >
                {group.group_name}
              </span>
              <div className="flex flex-shrink-0 items-center gap-1.5">
                {linkedInGroup > 0 && (
                  <span className="min-w-[18px] rounded-full bg-primary px-1.5 py-0.5 text-center text-[10px] font-bold text-primary-foreground">
                    {linkedInGroup}
                  </span>
                )}
                <span
                  className={cn(
                    'rounded-full px-1.5 py-0.5 text-[11px]',
                    hasAnySelection
                      ? 'bg-primary/20 font-medium text-primary'
                      : 'bg-muted text-muted-foreground',
                  )}
                >
                  {types.length}
                </span>
              </div>
            </div>

            {isOpen && types.length > 0 && (
              <div className="space-y-0.5 px-2.5 pb-2.5">
                <div className="ml-8 border-t border-border/30 pt-2">
                  {types.map((type) => {
                    const isLinked = linkedMaterialIds.has(type.id);
                    const linked = linkedMap.get(type.id);
                    const percentage = linked?.percentage;
                    const detailText =
                      linked?.part ||
                      (percentage !== null && percentage !== undefined ? `${percentage}%` : '');
                    return (
                      <div key={type.id}>
                        <label
                          className={cn(
                            'flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-all duration-150',
                            isLinked
                              ? 'bg-primary/15 font-medium text-foreground shadow-sm'
                              : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
                          )}
                        >
                          <Checkbox
                            checked={isLinked}
                            onCheckedChange={() => onToggleMaterial(type.id, isLinked)}
                            className="data-[state=checked]:border-primary data-[state=checked]:bg-primary"
                          />
                          <span
                            className="h-2 w-2 flex-shrink-0 rounded-full"
                            style={{ backgroundColor: group.group_hex_code || 'hsl(var(--muted))' }}
                          />
                          <span className="flex-1 truncate">{type.name}</span>
                          {detailText && (
                            <span className="text-[10px] italic text-muted-foreground">
                              {detailText}
                            </span>
                          )}
                          {isLinked && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                onEditMaterial(editingMaterialId === type.id ? null : type.id);
                              }}
                              className="p-0.5 text-muted-foreground hover:text-primary"
                              title="Editar parte/% / obs"
                            >
                              <Pencil className="h-3 w-3" />
                            </button>
                          )}
                          {isLinked && !editingMaterialId && (
                            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
                          )}
                        </label>
                        {editingMaterialId === type.id && isLinked && linked && (
                          <MaterialDetailEditor
                            linked={linked}
                            onSave={(data) => onUpdateMaterialDetail(type.id, data)}
                            onCancel={() => onEditMaterial(null)}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {isOpen && types.length === 0 && (
              <div className="px-2.5 pb-2.5">
                <div className="ml-8 border-t border-border/30 pt-2">
                  <p className="py-2 text-xs italic text-muted-foreground">
                    Nenhum material neste grupo
                  </p>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
