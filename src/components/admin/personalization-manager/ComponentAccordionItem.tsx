import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
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
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Plus, Trash2, Loader2, MapPin, Check, X } from 'lucide-react';
import { InlineEditField } from '../InlineEditField';
import { ImageUploadButton } from '../ImageUploadButton';
import { SortableItem } from '../SortableItem';
import type { Component, Location, Technique, LocationTechnique } from './types';

interface ComponentAccordionItemProps {
  component: Component;
  selectedProduct: string;
  locations: Location[];
  techniques?: Technique[];
  locationTechniques: LocationTechnique[];
  // Dialog state
  isAddLocationOpen: boolean;
  setIsAddLocationOpen: (open: boolean) => void;
  selectedComponentId: string | null;
  setSelectedComponentId: (id: string | null) => void;
  isAddTechniqueOpen: boolean;
  setIsAddTechniqueOpen: (open: boolean) => void;
  selectedLocationId: string | null;
  setSelectedLocationId: (id: string | null) => void;
  newLocation: { code: string; name: string; maxWidth: string; maxHeight: string; maxArea: string };
  setNewLocation: (l: {
    code: string;
    name: string;
    maxWidth: string;
    maxHeight: string;
    maxArea: string;
  }) => void;
  newTechniqueId: string;
  setNewTechniqueId: (id: string) => void;
  newMaxColors: string;
  setNewMaxColors: (c: string) => void;
  // Mutations
  updateComponent: (params: Record<string, unknown>) => void;
  deleteComponent: (id: string) => void;
  handleAddLocation: () => void;
  addLocationPending: boolean;
  updateLocation: (params: Record<string, unknown>) => void;
  deleteLocation: (id: string) => void;
  handleAddTechnique: () => void;
  addTechniquePending: boolean;
  updateTechnique: (params: Record<string, unknown>) => void;
  deleteTechnique: (id: string) => void;
}

export function ComponentAccordionItem({
  component,
  selectedProduct,
  locations,
  techniques,
  locationTechniques,
  isAddLocationOpen,
  setIsAddLocationOpen,
  selectedComponentId,
  setSelectedComponentId,
  isAddTechniqueOpen,
  setIsAddTechniqueOpen,
  selectedLocationId,
  setSelectedLocationId,
  newLocation,
  setNewLocation,
  newTechniqueId,
  setNewTechniqueId,
  newMaxColors,
  setNewMaxColors,
  updateComponent,
  deleteComponent,
  handleAddLocation,
  addLocationPending,
  updateLocation,
  deleteLocation,
  handleAddTechnique,
  addTechniquePending,
  updateTechnique,
  deleteTechnique,
}: ComponentAccordionItemProps) {
  const compLocations = locations.filter((l) => l.component_id === component.id);
  const getLocationTechniques = (locationId: string) =>
    locationTechniques.filter((lt) => lt.component_location_id === locationId);

  return (
    <SortableItem key={component.id} id={component.id}>
      <AccordionItem
        value={component.id}
        data-testid={`admin-row-${component.id}`}
        className="rounded-lg border px-4"
      >
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
          {/* Component fields */}
          <div className="mb-4 grid grid-cols-2 gap-4 rounded-lg bg-muted/30 p-4 md:grid-cols-4">
            <div>
              <Label className="text-xs text-muted-foreground">Código</Label>
              <InlineEditField
                value={component.component_code}
                onSave={(v) =>
                  updateComponent({ id: component.id, component_code: v.toUpperCase() })
                }
                className="font-mono"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Nome</Label>
              <InlineEditField
                value={component.component_name}
                onSave={(v) => updateComponent({ id: component.id, component_name: v })}
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={component.is_personalizable}
                onCheckedChange={(c) => updateComponent({ id: component.id, is_personalizable: c })}
              />
              <Label className="text-sm">Personalizável</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={component.is_active}
                onCheckedChange={(c) => updateComponent({ id: component.id, is_active: c })}
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
                      Defina uma área de personalização para {component.component_name}
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Código</Label>
                        <Input
                          placeholder="Ex: FRENTE, VERSO"
                          value={newLocation.code}
                          onChange={(e) => setNewLocation({ ...newLocation, code: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label>Nome</Label>
                        <Input
                          placeholder="Ex: Frente, Verso"
                          value={newLocation.name}
                          onChange={(e) => setNewLocation({ ...newLocation, name: e.target.value })}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <Label>Largura Máx. (cm)</Label>
                        <Input
                          type="number"
                          placeholder="10"
                          value={newLocation.maxWidth}
                          onChange={(e) =>
                            setNewLocation({ ...newLocation, maxWidth: e.target.value })
                          }
                        />
                      </div>
                      <div>
                        <Label>Altura Máx. (cm)</Label>
                        <Input
                          type="number"
                          placeholder="5"
                          value={newLocation.maxHeight}
                          onChange={(e) =>
                            setNewLocation({ ...newLocation, maxHeight: e.target.value })
                          }
                        />
                      </div>
                      <div>
                        <Label>Área Máx. (cm²)</Label>
                        <Input
                          type="number"
                          placeholder="50"
                          value={newLocation.maxArea}
                          onChange={(e) =>
                            setNewLocation({ ...newLocation, maxArea: e.target.value })
                          }
                        />
                      </div>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsAddLocationOpen(false)}>
                      Cancelar
                    </Button>
                    <Button onClick={handleAddLocation} disabled={addLocationPending}>
                      {addLocationPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Salvar
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            {compLocations.length === 0 ? (
              <p className="pl-6 text-sm text-muted-foreground">Nenhuma localização cadastrada</p>
            ) : (
              <div className="space-y-3 pl-6">
                {compLocations.map((location) => (
                  <div key={location.id} className="rounded-lg border bg-muted/30 p-3">
                    <div className="mb-3 grid grid-cols-2 gap-3 md:grid-cols-6">
                      <div>
                        <Label className="text-xs text-muted-foreground">Código</Label>
                        <InlineEditField
                          value={location.location_code}
                          onSave={(v) =>
                            updateLocation({ id: location.id, location_code: v.toUpperCase() })
                          }
                          className="font-mono text-xs"
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Nome</Label>
                        <InlineEditField
                          value={location.location_name}
                          onSave={(v) => updateLocation({ id: location.id, location_name: v })}
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Larg. (cm)</Label>
                        <InlineEditField
                          value={location.max_width_cm?.toString() ?? ''}
                          onSave={(v) =>
                            updateLocation({
                              id: location.id,
                              max_width_cm: v ? parseFloat(v) : null,
                            })
                          }
                          type="number"
                          placeholder="—"
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Alt. (cm)</Label>
                        <InlineEditField
                          value={location.max_height_cm?.toString() ?? ''}
                          onSave={(v) =>
                            updateLocation({
                              id: location.id,
                              max_height_cm: v ? parseFloat(v) : null,
                            })
                          }
                          type="number"
                          placeholder="—"
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Área (cm²)</Label>
                        <InlineEditField
                          value={location.max_area_cm2?.toString() ?? ''}
                          onSave={(v) =>
                            updateLocation({
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
                              updateLocation({ id: location.id, is_active: c })
                            }
                          />
                          <Label className="text-xs">Ativo</Label>
                        </div>
                        <ImageUploadButton
                          currentImageUrl={location.area_image_url}
                          onUpload={(url) =>
                            updateLocation({ id: location.id, area_image_url: url })
                          }
                          onRemove={() => updateLocation({ id: location.id, area_image_url: null })}
                          folder={`products/${selectedProduct}`}
                        />
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                          onClick={() => deleteLocation(location.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>

                    {/* Techniques */}
                    <div className="mt-2 border-t pt-2">
                      <div className="mb-2 flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">Técnicas permitidas:</span>
                        <Dialog
                          open={isAddTechniqueOpen && selectedLocationId === location.id}
                          onOpenChange={(open) => {
                            setIsAddTechniqueOpen(open);
                            if (open) setSelectedLocationId(location.id);
                          }}
                        >
                          <DialogTrigger asChild>
                            <Button size="sm" variant="ghost" className="h-6 px-2">
                              <Plus className="mr-1 h-3 w-3" />
                              <span className="text-xs">Técnica</span>
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Associar Técnica</DialogTitle>
                              <DialogDescription>
                                Adicione uma técnica permitida para {location.location_name}
                              </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4">
                              <div>
                                <Label>Técnica</Label>
                                <Select value={newTechniqueId} onValueChange={setNewTechniqueId}>
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
                                  onChange={(e) => setNewMaxColors(e.target.value)}
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
                              <Button onClick={handleAddTechnique} disabled={addTechniquePending}>
                                {addTechniquePending && (
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                )}
                                Associar
                              </Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {getLocationTechniques(location.id).map((lt) => (
                          <Tooltip key={lt.id}>
                            <TooltipTrigger asChild>
                              <Badge
                                variant={lt.is_default ? 'default' : 'outline'}
                                className="group cursor-pointer gap-1 text-xs"
                                onClick={() =>
                                  updateTechnique({ id: lt.id, is_default: !lt.is_default })
                                }
                              >
                                {lt.is_default && <Check className="h-2 w-2" />}
                                {lt.technique?.name}
                                {lt.max_colors && (
                                  <span className="opacity-70">({lt.max_colors} cores)</span>
                                )}
                                <button
                                  className="ml-1 opacity-0 transition-opacity group-hover:opacity-100"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    deleteTechnique(lt.id);
                                  }}
                                >
                                  <X className="h-2 w-2" />
                                </button>
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Clique para {lt.is_default ? 'remover' : 'definir'} como padrão</p>
                            </TooltipContent>
                          </Tooltip>
                        ))}
                        {getLocationTechniques(location.id).length === 0 && (
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

          {/* Component actions */}
          <div className="mt-4 flex justify-end border-t pt-4">
            <Button size="sm" variant="destructive" onClick={() => deleteComponent(component.id)}>
              <Trash2 className="mr-2 h-4 w-4" />
              Remover Componente
            </Button>
          </div>
        </AccordionContent>
      </AccordionItem>
    </SortableItem>
  );
}
