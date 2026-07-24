/**
 * ProductPersonalizationManager — Orchestrator (refactored from 1256 lines)
 * Data logic → usePersonalizationData hook
 * UI sections → ProductSelector, GroupInheritance, ComponentEditor (inline for now)
 */
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { Plus, Trash2, Loader2, Layers, MapPin, Check, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';
import { InlineEditField } from './InlineEditField';
import { ImageUploadButton } from './ImageUploadButton';
import { SortableItem } from './SortableItem';
import { usePersonalizationData } from './personalization/usePersonalizationData';
import { ProductSelector } from './personalization/ProductSelector';
import { GroupInheritance } from './personalization/GroupInheritance';

export function ProductPersonalizationManager() {
  const [selectedProduct, setSelectedProduct] = useState<string | null>(null);
  const [isAddComponentOpen, setIsAddComponentOpen] = useState(false);
  const [isAddLocationOpen, setIsAddLocationOpen] = useState(false);
  const [isAddTechniqueOpen, setIsAddTechniqueOpen] = useState(false);
  const [selectedComponentId, setSelectedComponentId] = useState<string | null>(null);
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null);
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

  const {
    products,
    productsLoading,
    productGroups,
    allMemberships,
    productMembership,
    components,
    componentsLoading,
    techniques,
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
  } = usePersonalizationData(selectedProduct);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleAddComponent = () => {
    if (!selectedProduct || !newComponent.code || !newComponent.name) return;
    addComponentMutation.mutate(
      {
        product_id: selectedProduct,
        component_code: newComponent.code.toUpperCase(),
        component_name: newComponent.name,
      },
      {
        onSuccess: () => {
          setIsAddComponentOpen(false);
          setNewComponent({ code: '', name: '' });
        },
      },
    );
  };

  const handleAddLocation = () => {
    if (!selectedComponentId || !newLocation.code || !newLocation.name) return;
    addLocationMutation.mutate(
      {
        component_id: selectedComponentId,
        location_code: newLocation.code.toUpperCase(),
        location_name: newLocation.name,
        max_width_cm: newLocation.maxWidth ? parseFloat(newLocation.maxWidth) : undefined,
        max_height_cm: newLocation.maxHeight ? parseFloat(newLocation.maxHeight) : undefined,
        max_area_cm2: newLocation.maxArea ? parseFloat(newLocation.maxArea) : undefined,
      },
      {
        onSuccess: () => {
          setIsAddLocationOpen(false);
          setNewLocation({ code: '', name: '', maxWidth: '', maxHeight: '', maxArea: '' });
        },
      },
    );
  };

  const handleAddTechnique = () => {
    if (!selectedLocationId || !newTechniqueId) return;
    // lookup below
    const allLocs = components?.flatMap((c) => getLocationsForComponent(c.id)) ?? [];
    const loc = allLocs.find((l) => l.id === selectedLocationId);
    const comp = components?.find((c) => c.id === loc?.component_id);
    const tech = techniques?.find((t) => t.id === newTechniqueId);
    if (!loc || !comp || !tech) return;
    addTechniqueMutation.mutate(
      {
        component_location_id: selectedLocationId,
        technique_id: newTechniqueId,
        composed_code: `${comp.component_code}-${loc.location_code}-${tech.code}`,
        max_colors: newMaxColors ? parseInt(newMaxColors, 10) : undefined,
      },
      {
        onSuccess: () => {
          setIsAddTechniqueOpen(false);
          setNewTechniqueId('');
          setNewMaxColors('');
        },
      },
    );
  };

  const handleComponentDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id || !components) return;
    const oldIndex = components.findIndex((c) => c.id === active.id);
    const newIndex = components.findIndex((c) => c.id === over.id);
    const reordered = arrayMove(components, oldIndex, newIndex);
    for (let i = 0; i < reordered.length; i++) {
      if (reordered[i].sort_order !== i) {
        // BUG-REORDER-SORT-SILENT-FAIL FIX: bare await swallowed RLS errors and
        // still showed toast.success to the user even when the DB update failed.
        const { error: sortErr } = await supabase
          .from('product_components')
          .update({ sort_order: i })
          .eq('id', reordered[i].id);
        if (sortErr) {
          logger.warn('[product-reorder] sort_order update failed at index', i, ':', sortErr);
          toast.error('Erro ao reordenar componentes');
          queryClient.invalidateQueries({ queryKey: ['product-components'] });
          return;
        }
      }
    }
    queryClient.invalidateQueries({ queryKey: ['product-components'] });
    toast.success('Ordem atualizada!');
  };

  const isUsingGroupRules = productMembership?.use_group_rules ?? false;
  const hasGroup = !!productMembership;

  return (
    <div className="space-y-6">
      <ProductSelector
        products={products}
        productsLoading={productsLoading}
        productGroups={productGroups}
        allMemberships={allMemberships}
        selectedProduct={selectedProduct}
        onSelectProduct={setSelectedProduct}
      />

      {selectedProduct && hasGroup && productMembership && (
        <GroupInheritance
          productMembership={productMembership}
          selectedProduct={selectedProduct}
          techniques={techniques}
          toggleGroupRules={(p) => toggleGroupRulesMutation.mutate(p)}
        />
      )}

      {selectedProduct && (!hasGroup || !isUsingGroupRules) && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Layers className="h-5 w-5" />
                  Componentes do Produto
                </CardTitle>
                <CardDescription>
                  {hasGroup ? 'Regras customizadas' : 'Configure as áreas de personalização'}
                </CardDescription>
              </div>
              <Dialog open={isAddComponentOpen} onOpenChange={setIsAddComponentOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="mr-2 h-4 w-4" />
                    Componente
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Novo Componente</DialogTitle>
                    <DialogDescription>Adicione um componente personalizável</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label>Código</Label>
                      <Input
                        placeholder="Ex: CORPO, TAMPA"
                        value={newComponent.code}
                        onChange={(e) => setNewComponent({ ...newComponent, code: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label>Nome</Label>
                      <Input
                        placeholder="Ex: Corpo, Tampa"
                        value={newComponent.name}
                        onChange={(e) => setNewComponent({ ...newComponent, name: e.target.value })}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsAddComponentOpen(false)}>
                      Cancelar
                    </Button>
                    <Button onClick={handleAddComponent} disabled={addComponentMutation.isPending}>
                      {addComponentMutation.isPending && (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      )}
                      Salvar
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent>
            {componentsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : !components?.length ? (
              <div className="py-8 text-center text-muted-foreground">
                <Layers className="mx-auto mb-4 h-12 w-12 opacity-50" />
                <p>Nenhum componente configurado</p>
              </div>
            ) : (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleComponentDragEnd}
              >
                <SortableContext
                  items={components.map((c) => c.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <Accordion type="multiple" className="space-y-2">
                    {components.map((component) => (
                      <SortableItem key={component.id} id={component.id}>
                        <AccordionItem value={component.id} className="rounded-lg border px-4">
                          <AccordionTrigger className="hover:no-underline">
                            <div className="flex flex-1 items-center gap-3">
                              <Badge variant="outline" className="font-mono">
                                {component.component_code}
                              </Badge>
                              <span className="font-medium">{component.component_name}</span>
                              <div className="ml-auto mr-4 flex items-center gap-2">
                                {component.is_personalizable && (
                                  <Badge variant="secondary" className="text-xs">
                                    Personalizável
                                  </Badge>
                                )}
                                {!component.is_active && (
                                  <Badge variant="destructive" className="text-xs">
                                    Inativo
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </AccordionTrigger>
                          <AccordionContent className="pb-2 pt-4">
                            <div className="mb-4 grid grid-cols-2 gap-4 rounded-lg bg-muted/30 p-4 md:grid-cols-4">
                              <div>
                                <Label className="text-xs text-muted-foreground">Código</Label>
                                <InlineEditField
                                  value={component.component_code}
                                  onSave={(v) =>
                                    updateComponentMutation.mutate({
                                      id: component.id,
                                      component_code: v.toUpperCase(),
                                    })
                                  }
                                  className="font-mono"
                                />
                              </div>
                              <div>
                                <Label className="text-xs text-muted-foreground">Nome</Label>
                                <InlineEditField
                                  value={component.component_name}
                                  onSave={(v) =>
                                    updateComponentMutation.mutate({
                                      id: component.id,
                                      component_name: v,
                                    })
                                  }
                                />
                              </div>
                              <div className="flex items-center gap-2">
                                <Switch
                                  checked={component.is_personalizable}
                                  onCheckedChange={(c) =>
                                    updateComponentMutation.mutate({
                                      id: component.id,
                                      is_personalizable: c,
                                    })
                                  }
                                />
                                <Label className="text-sm">Personalizável</Label>
                              </div>
                              <div className="flex items-center gap-2">
                                <Switch
                                  checked={component.is_active}
                                  onCheckedChange={(c) =>
                                    updateComponentMutation.mutate({
                                      id: component.id,
                                      is_active: c,
                                    })
                                  }
                                />
                                <Label className="text-sm">Ativo</Label>
                              </div>
                            </div>

                            {/* Locations */}
                            <div className="space-y-4">
                              <div className="flex items-center justify-between">
                                <h4 className="flex items-center gap-2 text-sm font-medium">
                                  <MapPin className="h-4 w-4" />
                                  Localizações
                                </h4>
                                <Dialog
                                  open={isAddLocationOpen && selectedComponentId === component.id}
                                  onOpenChange={(open) => {
                                    setIsAddLocationOpen(open);
                                    if (open) setSelectedComponentId(component.id);
                                  }}
                                >
                                  <DialogTrigger asChild>
                                    <Button size="sm" variant="outline">
                                      <Plus className="mr-1 h-3 w-3" />
                                      Localização
                                    </Button>
                                  </DialogTrigger>
                                  <DialogContent>
                                    <DialogHeader>
                                      <DialogTitle>Nova Localização</DialogTitle>
                                      <DialogDescription>
                                        Defina uma área para {component.component_name}
                                      </DialogDescription>
                                    </DialogHeader>
                                    <div className="space-y-4">
                                      <div className="grid grid-cols-2 gap-4">
                                        <div>
                                          <Label>Código</Label>
                                          <Input
                                            placeholder="Ex: FRENTE"
                                            value={newLocation.code}
                                            onChange={(e) =>
                                              setNewLocation({
                                                ...newLocation,
                                                code: e.target.value,
                                              })
                                            }
                                          />
                                        </div>
                                        <div>
                                          <Label>Nome</Label>
                                          <Input
                                            placeholder="Ex: Frente"
                                            value={newLocation.name}
                                            onChange={(e) =>
                                              setNewLocation({
                                                ...newLocation,
                                                name: e.target.value,
                                              })
                                            }
                                          />
                                        </div>
                                      </div>
                                      <div className="grid grid-cols-3 gap-4">
                                        <div>
                                          <Label>Larg. Máx (cm)</Label>
                                          <Input
                                            type="number"
                                            value={newLocation.maxWidth}
                                            onChange={(e) =>
                                              setNewLocation({
                                                ...newLocation,
                                                maxWidth: e.target.value,
                                              })
                                            }
                                          />
                                        </div>
                                        <div>
                                          <Label>Alt. Máx (cm)</Label>
                                          <Input
                                            type="number"
                                            value={newLocation.maxHeight}
                                            onChange={(e) =>
                                              setNewLocation({
                                                ...newLocation,
                                                maxHeight: e.target.value,
                                              })
                                            }
                                          />
                                        </div>
                                        <div>
                                          <Label>Área Máx (cm²)</Label>
                                          <Input
                                            type="number"
                                            value={newLocation.maxArea}
                                            onChange={(e) =>
                                              setNewLocation({
                                                ...newLocation,
                                                maxArea: e.target.value,
                                              })
                                            }
                                          />
                                        </div>
                                      </div>
                                    </div>
                                    <DialogFooter>
                                      <Button
                                        variant="outline"
                                        onClick={() => setIsAddLocationOpen(false)}
                                      >
                                        Cancelar
                                      </Button>
                                      <Button
                                        onClick={handleAddLocation}
                                        disabled={addLocationMutation.isPending}
                                      >
                                        {addLocationMutation.isPending && (
                                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        )}
                                        Salvar
                                      </Button>
                                    </DialogFooter>
                                  </DialogContent>
                                </Dialog>
                              </div>

                              {getLocationsForComponent(component.id).length === 0 ? (
                                <p className="pl-6 text-sm text-muted-foreground">
                                  Nenhuma localização cadastrada
                                </p>
                              ) : (
                                <div className="space-y-3 pl-6">
                                  {getLocationsForComponent(component.id).map((location) => (
                                    <div
                                      key={location.id}
                                      className="rounded-lg border bg-muted/30 p-3"
                                    >
                                      <div className="mb-3 grid grid-cols-2 gap-3 md:grid-cols-6">
                                        <div>
                                          <Label className="text-xs text-muted-foreground">
                                            Código
                                          </Label>
                                          <InlineEditField
                                            value={location.location_code}
                                            onSave={(v) =>
                                              updateLocationMutation.mutate({
                                                id: location.id,
                                                location_code: v.toUpperCase(),
                                              })
                                            }
                                            className="font-mono text-xs"
                                          />
                                        </div>
                                        <div>
                                          <Label className="text-xs text-muted-foreground">
                                            Nome
                                          </Label>
                                          <InlineEditField
                                            value={location.location_name}
                                            onSave={(v) =>
                                              updateLocationMutation.mutate({
                                                id: location.id,
                                                location_name: v,
                                              })
                                            }
                                          />
                                        </div>
                                        <div>
                                          <Label className="text-xs text-muted-foreground">
                                            Larg. (cm)
                                          </Label>
                                          <InlineEditField
                                            value={location.max_width_cm?.toString() ?? ''}
                                            onSave={(v) =>
                                              updateLocationMutation.mutate({
                                                id: location.id,
                                                max_width_cm: v ? parseFloat(v) : null,
                                              })
                                            }
                                            type="number"
                                            placeholder="—"
                                          />
                                        </div>
                                        <div>
                                          <Label className="text-xs text-muted-foreground">
                                            Alt. (cm)
                                          </Label>
                                          <InlineEditField
                                            value={location.max_height_cm?.toString() ?? ''}
                                            onSave={(v) =>
                                              updateLocationMutation.mutate({
                                                id: location.id,
                                                max_height_cm: v ? parseFloat(v) : null,
                                              })
                                            }
                                            type="number"
                                            placeholder="—"
                                          />
                                        </div>
                                        <div>
                                          <Label className="text-xs text-muted-foreground">
                                            Área (cm²)
                                          </Label>
                                          <InlineEditField
                                            value={location.max_area_cm2?.toString() ?? ''}
                                            onSave={(v) =>
                                              updateLocationMutation.mutate({
                                                id: location.id,
                                                max_area_cm2: v ? parseFloat(v) : null,
                                              })
                                            }
                                            type="number"
                                            placeholder="—"
                                          />
                                        </div>
                                        <div className="flex items-end gap-2">
                                          <div className="flex items-center gap-1">
                                            <Switch
                                              checked={location.is_active}
                                              onCheckedChange={(c) =>
                                                updateLocationMutation.mutate({
                                                  id: location.id,
                                                  is_active: c,
                                                })
                                              }
                                            />
                                            <Label className="text-xs">Ativo</Label>
                                          </div>
                                          <ImageUploadButton
                                            currentImageUrl={location.area_image_url}
                                            onUpload={(url) =>
                                              updateLocationMutation.mutate({
                                                id: location.id,
                                                area_image_url: url,
                                              })
                                            }
                                            onRemove={() =>
                                              updateLocationMutation.mutate({
                                                id: location.id,
                                                area_image_url: null,
                                              })
                                            }
                                            folder={`products/${selectedProduct}`}
                                          />
                                          <Button
                                            size="sm"
                                            variant="ghost"
                                            className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                                            onClick={() =>
                                              deleteLocationMutation.mutate(location.id)
                                            }
                                          >
                                            <Trash2 className="h-3 w-3" />
                                          </Button>
                                        </div>
                                      </div>

                                      {/* Techniques */}
                                      <div className="mt-2 border-t pt-2">
                                        <div className="mb-2 flex items-center justify-between">
                                          <span className="text-xs text-muted-foreground">
                                            Técnicas permitidas:
                                          </span>
                                          <Dialog
                                            open={
                                              isAddTechniqueOpen &&
                                              selectedLocationId === location.id
                                            }
                                            onOpenChange={(open) => {
                                              setIsAddTechniqueOpen(open);
                                              if (open) setSelectedLocationId(location.id);
                                            }}
                                          >
                                            <DialogTrigger asChild>
                                              <Button
                                                size="sm"
                                                variant="ghost"
                                                className="h-6 px-2"
                                              >
                                                <Plus className="mr-1 h-3 w-3" />
                                                <span className="text-xs">Técnica</span>
                                              </Button>
                                            </DialogTrigger>
                                            <DialogContent>
                                              <DialogHeader>
                                                <DialogTitle>Associar Técnica</DialogTitle>
                                                <DialogDescription>
                                                  Adicione uma técnica para {location.location_name}
                                                </DialogDescription>
                                              </DialogHeader>
                                              <div className="space-y-4">
                                                <div>
                                                  <Label>Técnica</Label>
                                                  <Select
                                                    value={newTechniqueId}
                                                    onValueChange={setNewTechniqueId}
                                                  >
                                                    <SelectTrigger>
                                                      <SelectValue placeholder="Selecione..." />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                      {techniques?.map((t) => (
                                                        <SelectItem key={t.id} value={t.id}>
                                                          {t.name} ({t.code})
                                                        </SelectItem>
                                                      ))}
                                                    </SelectContent>
                                                  </Select>
                                                </div>
                                                <div>
                                                  <Label>Máximo de Cores</Label>
                                                  <Input
                                                    type="number"
                                                    placeholder="Ex: 4"
                                                    value={newMaxColors}
                                                    onChange={(e) =>
                                                      setNewMaxColors(e.target.value)
                                                    }
                                                  />
                                                  <p className="mt-1 text-xs text-muted-foreground">
                                                    Deixe em branco para sem limite
                                                  </p>
                                                </div>
                                              </div>
                                              <DialogFooter>
                                                <Button
                                                  variant="outline"
                                                  onClick={() => setIsAddTechniqueOpen(false)}
                                                >
                                                  Cancelar
                                                </Button>
                                                <Button
                                                  onClick={handleAddTechnique}
                                                  disabled={addTechniqueMutation.isPending}
                                                >
                                                  {addTechniqueMutation.isPending && (
                                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                  )}
                                                  Associar
                                                </Button>
                                              </DialogFooter>
                                            </DialogContent>
                                          </Dialog>
                                        </div>
                                        <div className="flex flex-wrap gap-1">
                                          {getTechniquesForLocation(location.id).map((lt) => (
                                            <Tooltip key={lt.id}>
                                              <TooltipTrigger asChild>
                                                <Badge
                                                  variant={lt.is_default ? 'default' : 'outline'}
                                                  className="group cursor-pointer gap-1 text-xs"
                                                  onClick={() =>
                                                    updateTechniqueMutation.mutate({
                                                      id: lt.id,
                                                      is_default: !lt.is_default,
                                                    })
                                                  }
                                                >
                                                  {lt.is_default && <Check className="h-2 w-2" />}
                                                  {lt.technique?.name}
                                                  {lt.max_colors && (
                                                    <span className="opacity-70">
                                                      ({lt.max_colors} cores)
                                                    </span>
                                                  )}
                                                  <button
                                                    className="ml-1 opacity-0 transition-opacity group-hover:opacity-100"
                                                    onClick={(e) => {
                                                      e.stopPropagation();
                                                      deleteTechniqueMutation.mutate(lt.id);
                                                    }}
                                                  >
                                                    <X className="h-2 w-2" />
                                                  </button>
                                                </Badge>
                                              </TooltipTrigger>
                                              <TooltipContent>
                                                <p>
                                                  Clique para{' '}
                                                  {lt.is_default ? 'remover' : 'definir'} como
                                                  padrão
                                                </p>
                                              </TooltipContent>
                                            </Tooltip>
                                          ))}
                                          {getTechniquesForLocation(location.id).length === 0 && (
                                            <span className="text-xs text-muted-foreground">
                                              Nenhuma técnica associada
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>

                            <div className="mt-4 flex justify-end border-t pt-4">
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => deleteComponentMutation.mutate(component.id)}
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Remover Componente
                              </Button>
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      </SortableItem>
                    ))}
                  </Accordion>
                </SortableContext>
              </DndContext>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
