import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Plus, Trash2, Loader2, MapPin } from 'lucide-react';
import { InlineEditField } from '../InlineEditField';
import { SortableItem } from '../SortableItem';
import { GroupLocationCard } from './GroupLocationCard';
import type {
  GroupComponent,
  GroupLocation,
  GroupLocationTechnique,
  Technique,
} from '../hooks/useGroupPersonalization';

interface GroupComponentCardProps {
  component: GroupComponent;
  selectedGroup: string | null;
  locations: GroupLocation[];
  techniques: Technique[] | undefined;
  locationTechniques: GroupLocationTechnique[];
  onUpdateComponent: (data: { id: string; [key: string]: unknown }) => void;
  onDeleteComponent: (id: string) => void;
  onAddLocation: (data: {
    group_component_id: string;
    location_code: string;
    location_name: string;
    max_width_cm?: number;
    max_height_cm?: number;
    max_area_cm2?: number;
  }) => void;
  addLocationPending: boolean;
  onUpdateLocation: (data: { id: string; [key: string]: unknown }) => void;
  onDeleteLocation: (id: string) => void;
  onAddTechnique: (data: {
    group_location_id: string;
    technique_id: string;
    max_colors?: number;
  }) => void;
  addTechniquePending: boolean;
  onUpdateTechnique: (data: { id: string; [key: string]: unknown }) => void;
  onDeleteTechnique: (id: string) => void;
}

export function GroupComponentCard({
  component,
  selectedGroup,
  locations,
  techniques,
  locationTechniques,
  onUpdateComponent,
  onDeleteComponent,
  onAddLocation,
  addLocationPending,
  onUpdateLocation,
  onDeleteLocation,
  onAddTechnique,
  addTechniquePending,
  onUpdateTechnique,
  onDeleteTechnique,
}: GroupComponentCardProps) {
  const [isAddLocationOpen, setIsAddLocationOpen] = useState(false);
  const [newLocation, setNewLocation] = useState({
    code: '',
    name: '',
    maxWidth: '',
    maxHeight: '',
    maxArea: '',
  });

  const handleAddLocation = () => {
    if (!newLocation.code || !newLocation.name) return;
    onAddLocation({
      group_component_id: component.id,
      location_code: newLocation.code.toUpperCase(),
      location_name: newLocation.name,
      max_width_cm: newLocation.maxWidth ? parseFloat(newLocation.maxWidth) : undefined,
      max_height_cm: newLocation.maxHeight ? parseFloat(newLocation.maxHeight) : undefined,
      max_area_cm2: newLocation.maxArea ? parseFloat(newLocation.maxArea) : undefined,
    });
    setIsAddLocationOpen(false);
    setNewLocation({ code: '', name: '', maxWidth: '', maxHeight: '', maxArea: '' });
  };

  const componentLocations = locations.filter((l) => l.group_component_id === component.id);
  const getLocationTechniques = (locationId: string) =>
    locationTechniques.filter((lt) => lt.group_location_id === locationId);

  return (
    <SortableItem id={component.id}>
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
                onSave={(value) =>
                  onUpdateComponent({ id: component.id, component_code: value.toUpperCase() })
                }
                className="font-mono"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Nome</Label>
              <InlineEditField
                value={component.component_name}
                onSave={(value) => onUpdateComponent({ id: component.id, component_name: value })}
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={component.is_personalizable}
                onCheckedChange={(checked) =>
                  onUpdateComponent({ id: component.id, is_personalizable: checked })
                }
              />
              <Label className="text-sm">Personalizável</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={component.is_active}
                onCheckedChange={(checked) =>
                  onUpdateComponent({ id: component.id, is_active: checked })
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
              <Dialog open={isAddLocationOpen} onOpenChange={setIsAddLocationOpen}>
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

            {componentLocations.length === 0 ? (
              <p className="pl-6 text-sm text-muted-foreground">Nenhuma localização cadastrada</p>
            ) : (
              <div className="space-y-3 pl-6">
                {componentLocations.map((location) => (
                  <GroupLocationCard
                    key={location.id}
                    location={location}
                    selectedGroup={selectedGroup}
                    techniques={techniques}
                    locationTechniques={getLocationTechniques(location.id)}
                    onUpdateLocation={onUpdateLocation}
                    onDeleteLocation={onDeleteLocation}
                    onAddTechnique={onAddTechnique}
                    addTechniquePending={addTechniquePending}
                    onUpdateTechnique={onUpdateTechnique}
                    onDeleteTechnique={onDeleteTechnique}
                  />
                ))}
              </div>
            )}
          </div>

          <div className="mt-4 flex justify-end border-t pt-4">
            <Button size="sm" variant="destructive" onClick={() => onDeleteComponent(component.id)}>
              <Trash2 className="mr-2 h-4 w-4" />
              Remover Componente
            </Button>
          </div>
        </AccordionContent>
      </AccordionItem>
    </SortableItem>
  );
}
