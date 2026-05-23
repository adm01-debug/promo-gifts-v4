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
import type { ProductTechnique, ComponentData, LocationData, TechniqueData } from "./types";

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
  }, [productId]);

  const handleComponentSelect = (comp: ComponentData) => {
    setSelectedComponent(comp);
    setSelectedLocation(null);
    onSelect(null);
    if (comp.locations.length === 1) {
      handleLocationSelect(comp.locations[0], comp);
    }
  };

  const handleLocationSelect = (loc: LocationData, comp: ComponentData = selectedComponent!) => {
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
    loc: LocationData = selectedLocation!,
    comp: ComponentData = selectedComponent!
  ) => {
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
      <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive">
        <AlertCircle className="w-5 h-5 mb-2" />
        <p>Erro ao carregar técnicas</p>
      </div>
    );
  }

  if (!components?.length) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Paintbrush className="w-8 h-8 mx-auto mb-2 opacity-50" />
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
            'px-2 py-1 rounded',
            wizardStep >= 1 ? 'bg-primary/20 text-primary font-medium' : 'bg-muted'
          )}
        >
          Componente
        </span>
        <ChevronRight className="w-3 h-3" />
        <span
          className={cn(
            'px-2 py-1 rounded',
            wizardStep >= 2 ? 'bg-primary/20 text-primary font-medium' : 'bg-muted'
          )}
        >
          Local
        </span>
        <ChevronRight className="w-3 h-3" />
        <span
          className={cn(
            'px-2 py-1 rounded',
            wizardStep >= 3 ? 'bg-primary/20 text-primary font-medium' : 'bg-muted'
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
                className="p-4 rounded-lg border bg-card hover:bg-accent hover:border-primary/50 transition-all text-left group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                    <Package className="w-5 h-5 text-primary" />
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
              <X className="w-3 h-3 mr-1" /> Voltar
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
                  className="p-4 rounded-lg border bg-card hover:bg-accent hover:border-primary/50 transition-all text-left group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-orange/10 flex items-center justify-center group-hover:bg-orange/20 transition-colors">
                      <Ruler className="w-5 h-5 text-orange" />
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
              <X className="w-3 h-3 mr-1" /> Voltar
            </Button>
          </div>
          <div className="grid gap-2">
            {selectedLocation.techniques.map((tech) => (
              <button
                key={tech.id}
                onClick={() => handleTechniqueSelect(tech)}
                className="p-4 rounded-lg border bg-card hover:bg-accent hover:border-primary/50 transition-all text-left group"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center group-hover:bg-success/20 transition-colors">
                      <Paintbrush className="w-5 h-5 text-success" />
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
                    <Badge className="bg-success/20 text-success border-success/30">
                      <Sparkles className="w-3 h-3 mr-1" />
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
        <div className="p-4 rounded-lg bg-primary/5 border border-primary/20 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Check className="w-5 h-5 text-success" />
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
              <p className="text-muted-foreground text-xs">Componente</p>
              <p className="font-medium">{selectedTechnique.componentName}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Local</p>
              <p className="font-medium">{selectedTechnique.locationName}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Técnica</p>
              <p className="font-medium">{selectedTechnique.techniqueName}</p>
            </div>
          </div>
          {(selectedTechnique.maxWidth || selectedTechnique.maxColors) && (
            <div className="flex items-center gap-4 text-xs text-muted-foreground pt-2 border-t">
              {selectedTechnique.maxWidth && selectedTechnique.maxHeight && (
                <span className="flex items-center gap-1">
                  <Ruler className="w-3 h-3" />
                  Área máx: {selectedTechnique.maxWidth}x{selectedTechnique.maxHeight}mm
                </span>
              )}
              {selectedTechnique.maxColors && (
                <span className="flex items-center gap-1">
                  <Palette className="w-3 h-3" />
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
