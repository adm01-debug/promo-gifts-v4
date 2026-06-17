/**
 * TechniqueMultiSelector — Grid of available techniques to toggle.
 */
import { useQuery } from '@tanstack/react-query';
import { invokeExternalRpc } from '@/lib/external-rpc';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { AlertCircle, Package, Paintbrush, Palette, Ruler, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { logger } from '@/lib/logger';
import type { ProductTechnique, SelectedTechniqueConfig } from './types';
import type { CustomizationOptionsResponse } from '@/types/customization';

interface Props {
  productId: string;
  selectedTechniques: SelectedTechniqueConfig[];
  onToggleTechnique: (technique: ProductTechnique, add: boolean) => void;
}

export function TechniqueMultiSelector({
  productId,
  selectedTechniques,
  onToggleTechnique,
}: Props) {
  const {
    data: techniques,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['product-techniques-multi', productId],
    queryFn: async (): Promise<ProductTechnique[]> => {
      try {
        const result = await invokeExternalRpc<CustomizationOptionsResponse>(
          'fn_get_product_customization_options',
          { p_product_id: productId },
        );
        if (!result?.locations?.length) return [];
        const techList: ProductTechnique[] = [];
        for (const loc of result.locations) {
          for (const opt of loc.options ?? []) {
            techList.push({
              id: opt.technique_id,
              techniqueId: opt.technique_id,
              techniqueName: opt.tecnica_nome || 'Técnica',
              techniqueCode: opt.codigo_tabela || '',
              componentName: loc.location_name,
              locationName: loc.location_name,
              locationCode: loc.location_code,
              composedCode: opt.codigo_tabela,
              maxWidth: null,
              maxHeight: null,
              maxArea: null,
              maxColors: opt.max_cores ?? null,
              isDefault: false,
            });
          }
        }
        return techList;
      } catch (err) {
        logger.warn('Error fetching techniques via v6:', err);
        return [];
      }
    },
    enabled: !!productId,
  });

  if (isLoading)
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-16" />
        ))}
      </div>
    );
  if (error)
    return (
      <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-4 text-destructive">
        <AlertCircle className="mb-2 h-5 w-5" />
        <p>Erro ao carregar técnicas</p>
      </div>
    );
  if (!techniques?.length)
    return (
      <div className="py-8 text-center text-muted-foreground">
        <Paintbrush className="mx-auto mb-2 h-8 w-8 opacity-50" />
        <p>Este produto não possui técnicas de personalização cadastradas</p>
      </div>
    );

  const grouped = techniques.reduce(
    (acc, tech) => {
      (acc[tech.componentName] ??= []).push(tech);
      return acc;
    },
    {} as Record<string, ProductTechnique[]>,
  );
  const isSelected = (techId: string) =>
    selectedTechniques.some((st) => st.technique.id === techId);

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Selecione uma ou mais técnicas de gravação para comparar
      </p>
      {Object.entries(grouped).map(([componentName, techs]) => (
        <div key={componentName} className="space-y-2">
          <h4 className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Package className="h-4 w-4" />
            {componentName}
          </h4>
          <div className="grid gap-2 sm:grid-cols-2">
            {techs.map((tech) => {
              const selected = isSelected(tech.id);
              return (
                <button
                  key={tech.id}
                  onClick={() => onToggleTechnique(tech, !selected)}
                  className={cn(
                    'rounded-lg border p-3 text-left transition-all',
                    selected
                      ? 'border-primary bg-primary/10 ring-1 ring-primary'
                      : 'border-border bg-card hover:bg-accent',
                  )}
                >
                  <div className="mb-2 flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <Checkbox checked={selected} className="pointer-events-none" />
                      <span className="font-medium">{tech.techniqueName}</span>
                    </div>
                    {tech.isDefault && (
                      <Badge variant="secondary" className="text-xs">
                        <Sparkles className="mr-1 h-3 w-3" />
                        Padrão
                      </Badge>
                    )}
                  </div>
                  <div className="ml-6 space-y-1 text-xs text-muted-foreground">
                    <p>Local: {tech.locationName}</p>
                    <div className="flex items-center gap-3">
                      {tech.maxWidth && tech.maxHeight && (
                        <span className="flex items-center gap-1">
                          <Ruler className="h-3 w-3" />
                          {tech.maxWidth}x{tech.maxHeight}cm
                        </span>
                      )}
                      {tech.maxColors && (
                        <span className="flex items-center gap-1">
                          <Palette className="h-3 w-3" />
                          {tech.maxColors} cor{tech.maxColors > 1 ? 'es' : ''}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
