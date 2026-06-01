import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
import { Accordion } from '@/components/ui/accordion';
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
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { Plus, Loader2, Layers, Palette } from 'lucide-react';
import { GroupComponentCard } from './group-personalization/GroupComponentCard';
import { useGroupPersonalization } from './hooks/useGroupPersonalization';

export function GroupPersonalizationManager() {
  const {
    selectedGroup,
    setSelectedGroup,
    groups,
    groupsLoading,
    components,
    componentsLoading,
    locations,
    techniques,
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
  } = useGroupPersonalization();

  const [isAddComponentOpen, setIsAddComponentOpen] = useState(false);
  const [newComponent, setNewComponent] = useState({ code: '', name: '' });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleAddComponent = () => {
    if (!selectedGroup || !newComponent.code || !newComponent.name) return;
    addComponent.mutate({
      product_group_id: selectedGroup,
      component_code: newComponent.code.toUpperCase(),
      component_name: newComponent.name,
    });
    setIsAddComponentOpen(false);
    setNewComponent({ code: '', name: '' });
  };

  const handleComponentDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id || !components) return;
    const oldIndex = components.findIndex((c) => c.id === active.id);
    const newIndex = components.findIndex((c) => c.id === over.id);
    await reorderComponents(components, oldIndex, newIndex);
  };

  return (
    <div className="space-y-6">
      {/* Group Selector */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="h-5 w-5" />
            Regras de Personalização por Grupo
          </CardTitle>
          <CardDescription>
            Configure componentes, locais e técnicas permitidas para cada grupo
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Select value={selectedGroup || ''} onValueChange={setSelectedGroup}>
            <SelectTrigger className="w-full max-w-md">
              <SelectValue placeholder="Selecione um grupo..." />
            </SelectTrigger>
            <SelectContent>
              {groupsLoading ? (
                <div className="flex items-center justify-center p-4">
                  <Loader2 className="h-4 w-4 animate-spin" />
                </div>
              ) : (
                groups?.map((group) => (
                  <SelectItem key={group.id} value={group.id}>
                    {group.group_name} ({group.group_code})
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Components Management */}
      {selectedGroup && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Layers className="h-5 w-5" />
                  Componentes do Grupo
                </CardTitle>
                <CardDescription>
                  Template de componentes que será aplicado aos produtos do grupo
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
                    <DialogDescription>Adicione um componente template ao grupo</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="comp-code">Código</Label>
                      <Input
                        id="comp-code"
                        placeholder="Ex: CORPO, TAMPA"
                        value={newComponent.code}
                        onChange={(e) => setNewComponent({ ...newComponent, code: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="comp-name">Nome</Label>
                      <Input
                        id="comp-name"
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
                    <Button onClick={handleAddComponent} disabled={addComponent.isPending}>
                      {addComponent.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
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
                <p className="text-sm">
                  Adicione componentes para definir as áreas de personalização
                </p>
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
                      <GroupComponentCard
                        key={component.id}
                        component={component}
                        selectedGroup={selectedGroup}
                        locations={getLocationsForComponent(component.id)}
                        techniques={techniques}
                        locationTechniques={
                          locations?.flatMap((l) =>
                            l.group_component_id === component.id
                              ? getTechniquesForLocation(l.id)
                              : [],
                          ) || []
                        }
                        onUpdateComponent={(data) => updateComponent.mutate(data)}
                        onDeleteComponent={(id) => deleteComponent.mutate(id)}
                        onAddLocation={(data) => addLocation.mutate(data)}
                        addLocationPending={addLocation.isPending}
                        onUpdateLocation={(data) => updateLocation.mutate(data)}
                        onDeleteLocation={(id) => deleteLocation.mutate(id)}
                        onAddTechnique={(data) => addTechnique.mutate(data)}
                        addTechniquePending={addTechnique.isPending}
                        onUpdateTechnique={(data) => updateTechnique.mutate(data)}
                        onDeleteTechnique={(id) => deleteTechnique.mutate(id)}
                      />
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
