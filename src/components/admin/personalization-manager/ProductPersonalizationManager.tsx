/**
 * ProductPersonalizationManager — Orchestrator component.
 * Logic extracted to usePersonalizationManager hook.
 * UI sections extracted to sub-components.
 */
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Accordion } from '@/components/ui/accordion';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { DndContext, closestCenter } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Plus, Loader2, Layers } from 'lucide-react';
import { usePersonalizationManager } from './usePersonalizationManager';
import { ProductSelector } from './ProductSelector';
import { GroupInheritanceSection } from './GroupInheritanceSection';
import { ComponentAccordionItem } from './ComponentAccordionItem';

export function ProductPersonalizationManager() {
  const m = usePersonalizationManager();

  return (
    <div className="space-y-6">
      {/* Product Selector */}
      <ProductSelector
        searchQuery={m.searchQuery}
        setSearchQuery={m.setSearchQuery}
        selectedProduct={m.selectedProduct}
        setSelectedProduct={m.setSelectedProduct}
        productsLoading={m.productsLoading}
        filteredProducts={m.filteredProducts}
        totalProducts={m.products?.length ?? 0}
        allMemberships={m.allMemberships}
        productGroups={m.productGroups}
      />

      {/* Group Inheritance */}
      {m.selectedProduct && m.hasGroup && m.productMembership && (
        <GroupInheritanceSection
          productMembership={m.productMembership}
          isUsingGroupRules={m.isUsingGroupRules}
          isCopying={m.isCopying}
          copyGroupRulesToProduct={m.copyGroupRulesToProduct}
          toggleGroupRules={(p) => m.toggleGroupRulesMutation.mutate(p)}
        />
      )}

      {/* Components Management */}
      {m.selectedProduct && (!m.hasGroup || !m.isUsingGroupRules) && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Layers className="h-5 w-5" />
                  Componentes do Produto
                </CardTitle>
                <CardDescription>
                  {m.hasGroup
                    ? 'Regras customizadas para este produto'
                    : 'Configure as áreas de personalização'}
                </CardDescription>
              </div>
              <Dialog open={m.isAddComponentOpen} onOpenChange={m.setIsAddComponentOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="mr-2 h-4 w-4" />
                    Componente
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Novo Componente</DialogTitle>
                    <DialogDescription>
                      Adicione um componente personalizável ao produto
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label>Código</Label>
                      <Input
                        placeholder="Ex: CORPO, TAMPA"
                        value={m.newComponent.code}
                        onChange={(e) =>
                          m.setNewComponent({ ...m.newComponent, code: e.target.value })
                        }
                      />
                    </div>
                    <div>
                      <Label>Nome</Label>
                      <Input
                        placeholder="Ex: Corpo, Tampa"
                        value={m.newComponent.name}
                        onChange={(e) =>
                          m.setNewComponent({ ...m.newComponent, name: e.target.value })
                        }
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => m.setIsAddComponentOpen(false)}>
                      Cancelar
                    </Button>
                    <Button
                      onClick={m.handleAddComponent}
                      disabled={m.addComponentMutation.isPending}
                    >
                      {m.addComponentMutation.isPending && (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      )}
                      Salvar
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent data-testid="admin-table">
            {m.componentsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : !m.components?.length ? (
              <div className="py-8 text-center text-muted-foreground">
                <Layers className="mx-auto mb-4 h-12 w-12 opacity-50" />
                <p>Nenhum componente configurado</p>
                <p className="text-sm">
                  Adicione componentes para definir as áreas de personalização
                </p>
              </div>
            ) : (
              <DndContext
                sensors={m.sensors}
                collisionDetection={closestCenter}
                onDragEnd={m.handleComponentDragEnd}
              >
                <SortableContext
                  items={m.components.map((c) => c.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <Accordion type="multiple" className="space-y-2">
                    {m.selectedProduct &&
                      m.components.map((component) => (
                        <ComponentAccordionItem
                          key={component.id}
                          component={component}
                          selectedProduct={m.selectedProduct ?? ''}
                          locations={m.getLocationsForComponent(component.id)}
                          techniques={m.techniques}
                          locationTechniques={m.locationTechniques ?? []}
                          isAddLocationOpen={m.isAddLocationOpen}
                          setIsAddLocationOpen={m.setIsAddLocationOpen}
                          selectedComponentId={m.selectedComponentId}
                          setSelectedComponentId={m.setSelectedComponentId}
                          isAddTechniqueOpen={m.isAddTechniqueOpen}
                          setIsAddTechniqueOpen={m.setIsAddTechniqueOpen}
                          selectedLocationId={m.selectedLocationId}
                          setSelectedLocationId={m.setSelectedLocationId}
                          newLocation={m.newLocation}
                          setNewLocation={m.setNewLocation}
                          newTechniqueId={m.newTechniqueId}
                          setNewTechniqueId={m.setNewTechniqueId}
                          newMaxColors={m.newMaxColors}
                          setNewMaxColors={m.setNewMaxColors}
                          updateComponent={(p) =>
                            m.updateComponentMutation.mutate(
                              p as Parameters<typeof m.updateComponentMutation.mutate>[0],
                            )
                          }
                          deleteComponent={(id) => m.deleteComponentMutation.mutate(id)}
                          handleAddLocation={m.handleAddLocation}
                          addLocationPending={m.addLocationMutation.isPending}
                          updateLocation={(p) =>
                            m.updateLocationMutation.mutate(
                              p as Parameters<typeof m.updateLocationMutation.mutate>[0],
                            )
                          }
                          deleteLocation={(id) => m.deleteLocationMutation.mutate(id)}
                          handleAddTechnique={m.handleAddTechnique}
                          addTechniquePending={m.addTechniqueMutation.isPending}
                          updateTechnique={(p) =>
                            m.updateTechniqueMutation.mutate(
                              p as Parameters<typeof m.updateTechniqueMutation.mutate>[0],
                            )
                          }
                          deleteTechnique={(id) => m.deleteTechniqueMutation.mutate(id)}
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
