/**
 * PromptCustomizationPanel — Location/technique selector extracted from PromptGenerator
 */
import { useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { MapPin, Paintbrush, Ruler } from 'lucide-react';
import type { PrintAreaWithTechniques } from '@/types/gravacao';

interface PromptCustomizationPanelProps {
  printAreas: PrintAreaWithTechniques[];
  selectedAreaId: string | null;
  selectedTechId: string | null;
  onAreaChange: (areaId: string) => void;
  onTechChange: (techId: string) => void;
}

export function PromptCustomizationPanel({
  printAreas,
  selectedAreaId,
  selectedTechId,
  onAreaChange,
  onTechChange,
}: PromptCustomizationPanelProps) {
  const selectedArea = useMemo(() => {
    if (!selectedAreaId) return null;
    return printAreas.find((a) => a.area_id === selectedAreaId) || null;
  }, [selectedAreaId, printAreas]);

  const availableTechniques = useMemo(() => {
    if (!selectedArea) return [];
    return selectedArea.techniques ?? [];
  }, [selectedArea]);

  const selectedTech = useMemo(() => {
    if (!selectedTechId) return null;
    return availableTechniques.find((t) => t.id === selectedTechId) || null;
  }, [selectedTechId, availableTechniques]);

  const locationLabel = useMemo(() => {
    if (!selectedArea) return null;
    return [selectedArea.component_name, selectedArea.location_name].filter(Boolean).join(' — ');
  }, [selectedArea]);

  return (
    <div className="space-y-2.5 rounded-lg border border-primary/20 bg-primary/5 p-3">
      <p className="flex items-center gap-1.5 text-[11px] font-semibold text-primary">
        <MapPin className="h-3.5 w-3.5" />
        Personalização do Produto
      </p>

      <div className="grid grid-cols-2 gap-2.5">
        <div className="space-y-1">
          <Label className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <MapPin className="h-3 w-3" /> Local
          </Label>
          <Select value={selectedAreaId || 'none'} onValueChange={onAreaChange}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Selecione..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none" className="text-xs">
                Nenhum
              </SelectItem>
              {printAreas.map((area) => {
                const label =
                  [area.component_name, area.location_name].filter(Boolean).join(' — ') ||
                  area.area_code;
                return (
                  <SelectItem key={area.area_id} value={area.area_id} className="text-xs">
                    {label}
                    {area.max_width > 0 && (
                      <span className="ml-1 text-muted-foreground">
                        ({area.max_width}×{area.max_height}
                        {area.unit})
                      </span>
                    )}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <Paintbrush className="h-3 w-3" /> Técnica
          </Label>
          <Select
            value={selectedTechId || 'none'}
            onValueChange={onTechChange}
            disabled={!selectedAreaId || availableTechniques.length === 0}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue
                placeholder={selectedAreaId ? 'Selecione...' : 'Escolha local primeiro'}
              />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none" className="text-xs">
                Nenhuma
              </SelectItem>
              {availableTechniques.map((t) => (
                <SelectItem key={t.id} value={t.id} className="text-xs">
                  {t.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {selectedArea && selectedArea.max_width > 0 && (
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
          <Ruler className="h-3 w-3 shrink-0" />
          <span>
            Área máxima:{' '}
            <strong className="text-foreground">
              {selectedArea.max_width} × {selectedArea.max_height} {selectedArea.unit}
            </strong>
            {selectedArea.is_curved && (
              <Badge variant="outline" className="ml-1.5 px-1 py-0 text-[8px]">
                Superfície curva
              </Badge>
            )}
          </span>
        </div>
      )}

      {(selectedArea || selectedTech) && (
        <div className="flex flex-wrap gap-1">
          {locationLabel && (
            <Badge variant="secondary" className="gap-1 text-[9px]">
              <MapPin className="h-2.5 w-2.5" /> {locationLabel}
            </Badge>
          )}
          {selectedTech && (
            <Badge variant="secondary" className="gap-1 text-[9px]">
              <Paintbrush className="h-2.5 w-2.5" /> {selectedTech.nome}
            </Badge>
          )}
        </div>
      )}
    </div>
  );
}
