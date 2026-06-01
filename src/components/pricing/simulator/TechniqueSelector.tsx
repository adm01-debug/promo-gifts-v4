import { useState, useMemo, useEffect } from 'react';
import { useExternalPrintAreas } from '@/hooks/simulation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import {
  Package,
  Ruler,
  Paintbrush,
  Palette,
  ChevronRight,
  Check,
  X,
  AlertCircle,
  Sparkles,
} from 'lucide-react';
import type { ProductTechnique, ComponentData, LocationData, TechniqueData } from './types';

interface TechniqueSelectorProps {
  productId: string;
  onSelect: (technique: ProductTechnique | null) => void;
  selectedTechnique: ProductTechnique | null;
}

export function TechniqueSelector({
  productId,
  onSelect,
  selectedTechnique,
}: TechniqueSelectorProps) {
  const [selectedComponent, setSelectedComponent] = useState<ComponentData | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<LocationData | null>(null);

  const { data: printAreas, isLoading, error } = useExternalPrintAreas(productId);

  const components = useMemo(() => {
    if (!printAreas) return [];
    return printAreas.map((area) => ({
      name: area.componentName,
      code: area.componentCode,
      locations: area.locations.map((loc) => ({
        name: loc.locationName,
        code: loc.locationCode,
        techniques: loc.techniques,
      })),
    }));
  }, [printAreas]);

  // Reset quando produto muda
  useEffect(() => {
    setSelectedComponent(null);
    setSelectedLocation(null);
    onSelect(null);
  }, [productId, onSelect]);

  const handleComponentSelect = (comp: ComponentData) => {
    setSelectedComponent(comp);
    setSelectedLocation(null);
    onSelect(null);
    if (comp.locations.length === 1) {
      handleLocationSelect(comp.locations[0], comp);
    }
  };

  const handleLocationSelect = (
    loc: LocationData,
    comp: ComponentData | null = selectedComponent,
  ) => {
    if (!comp) return;
    setSelectedLocation(loc);
    onSelect(null);
    const primaryTech = loc.techniques.find((t) => t.isPrimary);
    if (loc.techniques.length === 1 || primaryTech) {
      const techToSelect = primaryTech || loc.techniques[0];
      handleTechniqueSelect(techToSelect, loc, comp);
    }
  };

  const handleTechniqueSelect = (
    tech: TechniqueData,
    loc: LocationData | null = selectedLocation,
    comp: ComponentData | null = selectedComponent,
  ) => {
    if (!loc || !comp) return;

    const fullTechnique: ProductTechnique = {
      id: tech.id,
      techniqueCode: tech.techniqueCode,
      techniqueName: tech.areaName || tech.techniqueCode,
      componentName: comp.name,
      locationName: loc.name,
      locationCode: loc.code,
      composedCode: tech.servCode || `${comp.code}.${loc.code}.${tech.techniqueCode}`,
      maxWidth: tech.maxWidth,
      maxHeight: tech.maxHeight,
      maxArea: tech.areaCm2,
      maxColors: tech.maxColors,
      isCurved: tech.isCurved,
      isPrimary: tech.isPrimary,
    };
    onSelect(fullTechnique);
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-12" />
        <Skeleton className="h-12" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-4 text-destructive">
        <AlertCircle className="mb-2 h-5 w-5" />
        <p>Erro ao carregar técnicas</p>
      </div>
    );
  }

  if (!components?.length) {
    return (
      <div className="py-8 text-center text-muted-foreground">
        <Paintbrush className="mx-auto mb-2 h-8 w-8 opacity-50" />
        <p>Este produto não possui técnicas de personalização cadastradas</p>
      </div>
    );
  }

  const wizardStep = !selectedComponent ? 1 : !selectedLocation ? 2 : !selectedTechnique ? 3 : 4;

  return (
    <div className="space-y-4">
      {/* Mini step indicator */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span
          className={cn(
            'rounded px-2 py-1',
            wizardStep >= 1 ? 'bg-primary/20 font-medium text-primary' : 'bg-muted',
          )}
        >
          Componente
        </span>
        <ChevronRight className="h-3 w-3" />
        <span
          className={cn(
            'rounded px-2 py-1',
            wizardStep >= 2 ? 'bg-primary/20 font-medium text-primary' : 'bg-muted',
          )}
        >
          Local
        </span>
        <ChevronRight className="h-3 w-3" />
        <span
          className={cn(
            'rounded px-2 py-1',
            wizardStep >= 3 ? 'bg-primary/20 font-medium text-primary' : 'bg-muted',
          )}
        >
          Técnica
        </span>
      </div>

      {/* Step 1: Component Selection */}
      {!selectedComponent && (
        <div className="space-y-2">
          <p className="text-sm font-medium">Qual parte do produto será personalizada?</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {components.map((comp, idx) => (
              <button
                key={`${comp.code}-${idx}`}
                onClick={() => handleComponentSelect(comp)}
                className="group rounded-lg border bg-card p-4 text-left transition-all hover:border-primary/50 hover:bg-accent"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 transition-colors group-hover:bg-primary/20">
                    <Package className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">{comp.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {comp.locations.length} {comp.locations.length === 1 ? 'local' : 'locais'}{' '}
                      disponíveis
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Step 2: Location Selection */}
      {selectedComponent && !selectedLocation && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">
              Onde será a gravação em "{selectedComponent.name}"?
            </p>
            <Button variant="ghost" size="sm" onClick={() => setSelectedComponent(null)}>
              <X className="mr-1 h-3 w-3" /> Voltar
            </Button>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {selectedComponent.locations.map((loc, idx) => {
              const firstTech = loc.techniques[0];
              const maxWidth = firstTech?.maxWidth;
              const maxHeight = firstTech?.maxHeight;

              return (
                <button
                  key={`${loc.code}-${idx}`}
                  onClick={() => handleLocationSelect(loc)}
                  className="group rounded-lg border bg-card p-4 text-left transition-all hover:border-primary/50 hover:bg-accent"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-primary/10 transition-colors group-hover:bg-brand-primary/20">
                      <Ruler className="h-5 w-5 text-brand-primary" />
                    </div>
                    <div>
                      <p className="font-medium">{loc.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {maxWidth && maxHeight ? `${maxWidth}x${maxHeight}mm` : 'Área variável'}
                        {' • '}
                        {loc.techniques.length}{' '}
                        {loc.techniques.length === 1 ? 'técnica' : 'técnicas'}
                      </p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Step 3: Technique Selection */}
      {selectedComponent && selectedLocation && !selectedTechnique && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Qual técnica de gravação?</p>
            <Button variant="ghost" size="sm" onClick={() => setSelectedLocation(null)}>
              <X className="mr-1 h-3 w-3" /> Voltar
            </Button>
          </div>
          <div className="grid gap-2">
            {selectedLocation.techniques.map((tech) => (
              <button
                key={tech.id}
                onClick={() => handleTechniqueSelect(tech)}
                className="group rounded-lg border bg-card p-4 text-left transition-all hover:border-primary/50 hover:bg-accent"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/10 transition-colors group-hover:bg-success/20">
                      <Paintbrush className="h-5 w-5 text-success" />
                    </div>
                    <div>
                      <p className="font-medium">{tech.areaName || tech.techniqueCode}</p>
                      <p className="text-xs text-muted-foreground">
                        {tech.techniqueCode && `Código: ${tech.techniqueCode}`}
                        {tech.maxColors && ` • Até ${tech.maxColors} cores`}
                        {tech.areaCm2 && ` • ${tech.areaCm2}cm²`}
                      </p>
                    </div>
                  </div>
                  {tech.isPrimary && (
                    <Badge className="border-success/30 bg-success/20 text-success">
                      <Sparkles className="mr-1 h-3 w-3" />
                      Recomendado
                    </Badge>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Selected summary */}
      {selectedTechnique && (
        <div className="space-y-3 rounded-lg border border-primary/20 bg-primary/5 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Check className="h-5 w-5 text-success" />
              <span className="font-medium">Técnica selecionada</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSelectedComponent(null);
                setSelectedLocation(null);
                onSelect(null);
              }}
            >
              Alterar
            </Button>
          </div>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Componente</p>
              <p className="font-medium">{selectedTechnique.componentName}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Local</p>
              <p className="font-medium">{selectedTechnique.locationName}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Técnica</p>
              <p className="font-medium">{selectedTechnique.techniqueName}</p>
            </div>
          </div>
          {(selectedTechnique.maxWidth || selectedTechnique.maxColors) && (
            <div className="flex items-center gap-4 border-t pt-2 text-xs text-muted-foreground">
              {selectedTechnique.maxWidth && selectedTechnique.maxHeight && (
                <span className="flex items-center gap-1">
                  <Ruler className="h-3 w-3" />
                  Área máx: {selectedTechnique.maxWidth}x{selectedTechnique.maxHeight}mm
                </span>
              )}
              {selectedTechnique.maxColors && (
                <span className="flex items-center gap-1">
                  <Palette className="h-3 w-3" />
                  Até {selectedTechnique.maxColors} cores
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
