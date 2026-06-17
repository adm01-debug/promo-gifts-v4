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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Plus, Trash2, Loader2, Check, X } from 'lucide-react';
import { InlineEditField } from '../InlineEditField';
import { ImageUploadButton } from '../ImageUploadButton';
import type {
  GroupLocation,
  GroupLocationTechnique,
  Technique,
} from '../hooks/useGroupPersonalization';

interface GroupLocationCardProps {
  location: GroupLocation;
  selectedGroup: string | null;
  techniques: Technique[] | undefined;
  locationTechniques: GroupLocationTechnique[];
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

export function GroupLocationCard({
  location,
  selectedGroup,
  techniques,
  locationTechniques,
  onUpdateLocation,
  onDeleteLocation,
  onAddTechnique,
  addTechniquePending,
  onUpdateTechnique,
  onDeleteTechnique,
}: GroupLocationCardProps) {
  const [isAddTechniqueOpen, setIsAddTechniqueOpen] = useState(false);
  const [newTechniqueId, setNewTechniqueId] = useState('');
  const [newMaxColors, setNewMaxColors] = useState('');

  const handleAddTechnique = () => {
    if (!newTechniqueId) return;
    onAddTechnique({
      group_location_id: location.id,
      technique_id: newTechniqueId,
      max_colors: newMaxColors ? parseInt(newMaxColors, 10) : undefined,
    });
    setIsAddTechniqueOpen(false);
    setNewTechniqueId('');
    setNewMaxColors('');
  };

  return (
    <div className="rounded-lg border bg-muted/30 p-3">
      <div className="mb-3 grid grid-cols-2 gap-3 md:grid-cols-6">
        <div>
          <Label className="text-xs text-muted-foreground">Código</Label>
          <InlineEditField
            value={location.location_code}
            onSave={(value) =>
              onUpdateLocation({ id: location.id, location_code: value.toUpperCase() })
            }
            className="font-mono text-xs"
          />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Nome</Label>
          <InlineEditField
            value={location.location_name}
            onSave={(value) => onUpdateLocation({ id: location.id, location_name: value })}
          />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Larg. (cm)</Label>
          <InlineEditField
            value={location.max_width_cm?.toString() || ''}
            onSave={(value) =>
              onUpdateLocation({ id: location.id, max_width_cm: value ? parseFloat(value) : null })
            }
            type="number"
            placeholder="—"
          />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Alt. (cm)</Label>
          <InlineEditField
            value={location.max_height_cm?.toString() || ''}
            onSave={(value) =>
              onUpdateLocation({ id: location.id, max_height_cm: value ? parseFloat(value) : null })
            }
            type="number"
            placeholder="—"
          />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Área (cm²)</Label>
          <InlineEditField
            value={location.max_area_cm2?.toString() || ''}
            onSave={(value) =>
              onUpdateLocation({ id: location.id, max_area_cm2: value ? parseFloat(value) : null })
            }
            type="number"
            placeholder="—"
          />
        </div>
        <div className="flex items-end gap-2">
          <div className="flex items-center gap-1">
            <Switch
              checked={location.is_active}
              onCheckedChange={(checked) =>
                onUpdateLocation({ id: location.id, is_active: checked })
              }
            />
            <Label className="text-xs">Ativo</Label>
          </div>
          <ImageUploadButton
            currentImageUrl={location.area_image_url}
            onUpload={(url) => onUpdateLocation({ id: location.id, area_image_url: url })}
            onRemove={() => onUpdateLocation({ id: location.id, area_image_url: null })}
            folder={`groups/${selectedGroup}`}
          />
          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0 text-destructive hover:text-destructive"
            onClick={() => onDeleteLocation(location.id)}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* Techniques */}
      <div className="mt-2 border-t pt-2">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Técnicas permitidas:</span>
          <Dialog open={isAddTechniqueOpen} onOpenChange={setIsAddTechniqueOpen}>
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
                      {techniques?.map((tech) => (
                        <SelectItem key={tech.id} value={tech.id}>
                          {tech.name} ({tech.code})
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
                <Button variant="outline" onClick={() => setIsAddTechniqueOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleAddTechnique} disabled={addTechniquePending}>
                  {addTechniquePending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Associar
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
        <div className="flex flex-wrap gap-1">
          {locationTechniques.map((lt) => (
            <Tooltip key={lt.id}>
              <TooltipTrigger asChild>
                <Badge
                  variant={lt.is_default ? 'default' : 'outline'}
                  className="group cursor-pointer gap-1 text-xs"
                  onClick={() => onUpdateTechnique({ id: lt.id, is_default: !lt.is_default })}
                >
                  {lt.is_default && <Check className="h-2 w-2" />}
                  {lt.technique?.name}
                  {lt.max_colors && <span className="opacity-70">({lt.max_colors} cores)</span>}
                  <button
                    aria-label="Fechar"
                    className="ml-1 opacity-0 transition-opacity group-hover:opacity-100"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteTechnique(lt.id);
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
          {locationTechniques.length === 0 && (
            <span className="text-xs text-muted-foreground">Nenhuma técnica associada</span>
          )}
        </div>
      </div>
    </div>
  );
}
