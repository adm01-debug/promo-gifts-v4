import React, { useState, useCallback, useMemo } from 'react';
import { type FilterPreset, useFilterPresets } from './FilterPresets';
import { type FilterState, defaultFilters } from './FilterPanel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import {
  Bookmark,
  Plus,
  MoreHorizontal,
  Pencil,
  Trash2,
  Check,
  Loader2,
  Copy,
  RefreshCw,
  SlidersHorizontal,
  Sparkles,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { PRESET_COLORS, countFilters, summarizeFilters } from './preset-utils';
import { ColorEmojiPicker } from './PresetFormParts';

// Re-export for external consumers
export { PRESET_COLORS } from './preset-utils';

interface PresetsBarProps {
  currentFilters: FilterState;
  onApplyPreset: (filters: FilterState, presetId?: string) => void;
  activePresetId?: string;
}

export const PresetsBar = React.forwardRef<HTMLDivElement, PresetsBarProps>(function PresetsBar(
  { currentFilters, onApplyPreset, activePresetId },
  ref,
) {
  const { presets, isLoading, savePreset, updatePreset, deletePreset } = useFilterPresets();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<FilterPreset | null>(null);
  const [newPresetName, setNewPresetName] = useState('');
  const [newPresetDescription, setNewPresetDescription] = useState('');
  const [newPresetColor, setNewPresetColor] = useState(PRESET_COLORS[0]);
  const [newPresetEmoji, setNewPresetEmoji] = useState('📦');
  const [isSaving, setIsSaving] = useState(false);

  const hasActiveFilters = useMemo(
    () => JSON.stringify(currentFilters) !== JSON.stringify(defaultFilters),
    [currentFilters],
  );

  const resetForm = useCallback(() => {
    setNewPresetName('');
    setNewPresetDescription('');
    setNewPresetColor(PRESET_COLORS[0]);
    setNewPresetEmoji('📦');
  }, []);

  const handleCreatePreset = useCallback(async () => {
    if (!newPresetName.trim()) {
      toast.error('Digite um nome para o preset');
      return;
    }
    setIsSaving(true);
    const result = await savePreset({
      name: newPresetName.trim(),
      description: newPresetDescription.trim() || undefined,
      filters: currentFilters,
      icon: newPresetEmoji,
      color: newPresetColor,
    });
    setIsSaving(false);
    if (result) {
      toast.success('Preset criado com sucesso!');
      resetForm();
      setIsCreateOpen(false);
    }
  }, [
    newPresetName,
    newPresetDescription,
    currentFilters,
    newPresetEmoji,
    newPresetColor,
    savePreset,
    resetForm,
  ]);

  const handleUpdatePreset = useCallback(async () => {
    if (!selectedPreset || !newPresetName.trim()) return;
    setIsSaving(true);
    const result = await updatePreset(selectedPreset.id, {
      name: newPresetName.trim(),
      description: newPresetDescription.trim() || undefined,
      icon: newPresetEmoji,
      color: newPresetColor,
    });
    setIsSaving(false);
    if (result) {
      toast.success('Preset atualizado!');
      resetForm();
      setIsEditOpen(false);
      setSelectedPreset(null);
    }
  }, [
    selectedPreset,
    newPresetName,
    newPresetDescription,
    newPresetEmoji,
    newPresetColor,
    updatePreset,
    resetForm,
  ]);

  const handleDeletePreset = useCallback(async () => {
    if (!selectedPreset) return;
    const success = await deletePreset(selectedPreset.id);
    if (success) toast.success('Preset removido');
    setIsDeleteOpen(false);
    setSelectedPreset(null);
  }, [selectedPreset, deletePreset]);

  const handleApplyPreset = useCallback(
    (preset: FilterPreset) => {
      onApplyPreset(preset.filters, preset.id);
      toast.success(`Preset "${preset.name}" aplicado`);
    },
    [onApplyPreset],
  );

  const handleClearPreset = useCallback(() => {
    onApplyPreset(defaultFilters, undefined);
    toast.info('Preset desativado');
  }, [onApplyPreset]);

  const handleDuplicatePreset = useCallback(
    async (preset: FilterPreset) => {
      setIsSaving(true);
      const result = await savePreset({
        name: `${preset.name} (cópia)`,
        description: preset.description,
        filters: preset.filters,
        icon: preset.icon,
        color: preset.color,
      });
      setIsSaving(false);
      if (result) toast.success(`Preset "${preset.name}" duplicado!`);
    },
    [savePreset],
  );

  const handleUpdateFilters = useCallback(
    async (preset: FilterPreset) => {
      if (!hasActiveFilters) {
        toast.info('Aplique filtros antes de atualizar o preset');
        return;
      }
      setIsSaving(true);
      const result = await updatePreset(preset.id, { filters: currentFilters });
      setIsSaving(false);
      if (result) toast.success(`Filtros do preset "${preset.name}" atualizados!`);
    },
    [currentFilters, hasActiveFilters, updatePreset],
  );

  const openEditDialog = useCallback((preset: FilterPreset) => {
    setSelectedPreset(preset);
    setNewPresetName(preset.name);
    setNewPresetDescription(preset.description ?? '');
    setNewPresetColor(preset.color || PRESET_COLORS[0]);
    setNewPresetEmoji(preset.icon || '📦');
    setIsEditOpen(true);
  }, []);

  const openDeleteDialog = useCallback((preset: FilterPreset) => {
    setSelectedPreset(preset);
    setIsDeleteOpen(true);
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent, action: () => void) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      action();
    }
  }, []);

  return (
    <div ref={ref} className="contents">
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            aria-label="Presets de filtros salvos"
            className={cn(
              'relative h-10 w-10 rounded-full border-border/50 transition-colors',
              presets.length > 0 ? 'hover:border-primary/50' : 'opacity-60 hover:opacity-100',
            )}
          >
            <Bookmark className="h-4 w-4" />
            {presets.length > 0 && (
              <Badge
                variant="secondary"
                className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary p-0 text-[10px] font-bold text-primary-foreground"
              >
                {presets.length}
              </Badge>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-80 p-3" sideOffset={8}>
          <div className="space-y-3">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Bookmark className="h-4 w-4 text-primary" />
                <span>Meus Presets</span>
                {presets.length > 0 && (
                  <span className="text-xs text-muted-foreground">({presets.length})</span>
                )}
              </div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Salvar preset com filtros atuais"
                    className="h-7 w-7 text-muted-foreground hover:text-primary"
                    onClick={() => {
                      if (!hasActiveFilters) {
                        toast.info('Selecione pelo menos um filtro para salvar um preset');
                        return;
                      }
                      setIsCreateOpen(true);
                    }}
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Salvar combinação atual como preset</TooltipContent>
              </Tooltip>
            </div>

            {/* Active preset indicator with clear */}
            {activePresetId && presets.find((p) => p.id === activePresetId) && (
              <div className="flex items-center gap-2 rounded-md border border-primary/20 bg-primary/10 px-2.5 py-1.5 text-xs">
                <Check className="h-3 w-3 shrink-0 text-primary" />
                <span className="flex-1 truncate font-medium text-primary">
                  {presets.find((p) => p.id === activePresetId)?.name}
                </span>
                <button
                  onClick={handleClearPreset}
                  className="shrink-0 rounded p-0.5 transition-colors hover:bg-primary/20"
                  aria-label="Desativar preset"
                >
                  <X className="h-3 w-3 text-primary" />
                </button>
              </div>
            )}

            {/* List */}
            {isLoading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : presets.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-6">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted/80">
                  <Sparkles className="h-5 w-5 text-muted-foreground" />
                </div>
                <p className="text-center text-xs text-muted-foreground">
                  Salve combinações de filtros
                  <br />
                  para reaplicar com um clique
                </p>
                {hasActiveFilters && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-1 h-7 gap-1.5 text-xs"
                    onClick={() => setIsCreateOpen(true)}
                  >
                    <Plus className="h-3 w-3" />
                    Salvar filtros atuais
                  </Button>
                )}
              </div>
            ) : (
              <div className="scrollbar-thin max-h-60 space-y-1 overflow-y-auto">
                {presets.map((preset) => {
                  const filterCount = countFilters(preset.filters);
                  const presetColor = preset.color || PRESET_COLORS[0];
                  const isActive = activePresetId === preset.id;
                  const summary = summarizeFilters(preset.filters);

                  return (
                    <Tooltip key={preset.id}>
                      <TooltipTrigger asChild>
                        <div
                          role="button"
                          tabIndex={0}
                          aria-label={`Aplicar preset ${preset.name}`}
                          aria-pressed={isActive}
                          className={cn(
                            'group flex cursor-pointer items-center gap-2 rounded-lg py-2 pl-0 pr-2 transition-all hover:bg-accent',
                            isActive
                              ? 'border border-primary/30 bg-primary/10'
                              : 'border border-transparent',
                          )}
                          onClick={() =>
                            isActive ? handleClearPreset() : handleApplyPreset(preset)
                          }
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              handleApplyPreset(preset);
                            }
                          }}
                        >
                          {/* Colored left accent */}
                          <div
                            className="w-1 shrink-0 self-stretch rounded-full transition-opacity"
                            style={{ backgroundColor: presetColor, opacity: isActive ? 1 : 0.5 }}
                          />
                          {/* Icon */}
                          <div
                            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-sm"
                            style={{ backgroundColor: `${presetColor}20` }}
                          >
                            {preset.icon || '🔖'}
                          </div>
                          {/* Text */}
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">{preset.name}</p>
                            {preset.description ? (
                              <p className="truncate text-[10px] text-muted-foreground">
                                {preset.description}
                              </p>
                            ) : (
                              <p className="text-[10px] text-muted-foreground">
                                {filterCount} filtro{filterCount !== 1 ? 's' : ''}
                              </p>
                            )}
                          </div>
                          {/* Active check */}
                          {isActive && <Check className="h-3.5 w-3.5 shrink-0 text-primary" />}
                          {/* Filter count badge */}
                          {!isActive && filterCount > 0 && (
                            <span
                              className="shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold"
                              style={{ backgroundColor: `${presetColor}20`, color: presetColor }}
                            >
                              {filterCount}
                            </span>
                          )}
                          {/* Actions menu */}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button
                                aria-label={`Opções do preset ${preset.name}`}
                                className="shrink-0 rounded p-1 opacity-0 transition-opacity hover:bg-muted group-hover:opacity-100"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <MoreHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-44">
                              <DropdownMenuItem onClick={() => openEditDialog(preset)}>
                                <Pencil className="mr-2 h-3.5 w-3.5" />
                                Editar
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleUpdateFilters(preset)}
                                disabled={!hasActiveFilters}
                              >
                                <RefreshCw className="mr-2 h-3.5 w-3.5" />
                                Atualizar filtros
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleDuplicatePreset(preset)}>
                                <Copy className="mr-2 h-3.5 w-3.5" />
                                Duplicar
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => openDeleteDialog(preset)}
                                className="text-destructive focus:text-destructive"
                              >
                                <Trash2 className="mr-2 h-3.5 w-3.5" />
                                Excluir
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="left" className="max-w-52">
                        {summary}
                      </TooltipContent>
                    </Tooltip>
                  );
                })}
              </div>
            )}
          </div>
        </PopoverContent>
      </Popover>

      {/* ─── Create Dialog ─────────────────────────────── */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-md" onKeyDown={(e) => handleKeyDown(e, handleCreatePreset)}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <SlidersHorizontal className="h-4 w-4 text-primary" />
              Salvar Preset de Filtros
            </DialogTitle>
            <DialogDescription>
              Salve os filtros atuais como um preset para uso futuro.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Nome do Preset</label>
              <Input
                placeholder="Ex: Campanha de Verão"
                value={newPresetName}
                onChange={(e) => setNewPresetName(e.target.value)}
                maxLength={50}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Descrição (opcional)</label>
              <Input
                placeholder="Descreva o preset..."
                value={newPresetDescription}
                onChange={(e) => setNewPresetDescription(e.target.value)}
                maxLength={100}
              />
            </div>
            <ColorEmojiPicker
              emoji={newPresetEmoji}
              color={newPresetColor}
              onEmojiChange={setNewPresetEmoji}
              onColorChange={setNewPresetColor}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreatePreset} disabled={isSaving || !newPresetName.trim()}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Salvar Preset
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Edit Dialog ───────────────────────────────── */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-md" onKeyDown={(e) => handleKeyDown(e, handleUpdatePreset)}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-4 w-4 text-primary" />
              Editar Preset
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Nome</label>
              <Input
                value={newPresetName}
                onChange={(e) => setNewPresetName(e.target.value)}
                maxLength={50}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Descrição</label>
              <Input
                value={newPresetDescription}
                onChange={(e) => setNewPresetDescription(e.target.value)}
                maxLength={100}
              />
            </div>
            <ColorEmojiPicker
              emoji={newPresetEmoji}
              color={newPresetColor}
              onEmojiChange={setNewPresetEmoji}
              onColorChange={setNewPresetColor}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleUpdatePreset} disabled={isSaving || !newPresetName.trim()}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Delete Dialog ─────────────────────────────── */}
      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Preset</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o preset "{selectedPreset?.name}"? Esta ação não pode
              ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeletePreset}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
});
