import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { invokeExternalRpc } from '@/lib/external-rpc';
import { fetchPromobrindProductBySku } from '@/lib/external-db';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Palette,
  MapPin,
  Maximize2,
  Clock,
  Layers,
  Info,
  FileSpreadsheet,
  FileText,
  Download,
} from 'lucide-react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { exportToExcel, exportToPDF } from '@/utils/personalizationExport';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';

interface RpcTechniqueOption {
  technique_id: string;
  tecnica_nome: string;
  codigo_tabela: string;
  max_cores: number;
}

interface RpcLocation {
  location_code: string;
  location_name: string;
  options?: RpcTechniqueOption[];
}

interface RpcComponent {
  id: string;
  component_code: string;
  component_name: string;
  is_personalizable: boolean;
  locations?: RpcLocation[];
  product_group_locations?: RpcLocation[];
}

interface DbTechnique {
  id?: string;
  name?: string;
  code?: string;
  description?: string;
  estimatedDays?: number;
  max_colors?: number;
  is_default?: boolean;
  personalization_techniques?: {
    id: string;
    name: string;
    code: string;
    description?: string;
    estimated_days?: number;
  };
}

interface DbLocation {
  id: string;
  location_code: string;
  location_name: string;
  max_width_cm?: number | null;
  max_height_cm?: number | null;
  max_area_cm2?: number | null;
  area_image_url?: string | null;
  techniques?: DbTechnique[];
  product_group_location_techniques?: DbTechnique[];
}

interface ProductPersonalizationRulesProps {
  productId: string;
  productSku: string;
  productName?: string;
}

interface TechniqueInfo {
  id: string;
  name: string;
  code: string;
  description: string | null;
  estimatedDays: number | null;
  maxColors: number | null;
  isDefault: boolean;
}

interface LocationInfo {
  id: string;
  code: string;
  name: string;
  maxWidth: number | null;
  maxHeight: number | null;
  maxArea: number | null;
  areaImageUrl: string | null;
  techniques: TechniqueInfo[];
}

interface ComponentInfo {
  id: string;
  code: string;
  name: string;
  isPersonalizable: boolean;
  locations: LocationInfo[];
}

export function ProductPersonalizationRules({
  productId: _productId,
  productSku,
  productName,
}: ProductPersonalizationRulesProps) {
  // Check if product uses group rules or has custom rules
  const { data: productData, isLoading: loadingProduct } = useQuery({
    queryKey: ['product-personalization-source', productSku],
    queryFn: async () => {
      // Buscar produto no banco Promobrind pelo SKU
      const promobrindProduct = await fetchPromobrindProductBySku(productSku);

      if (!promobrindProduct) return { source: 'none' as const, productDbId: null };

      // Usar o ID do produto Promobrind para verificar regras
      const productDbId = promobrindProduct.id;

      // Check if product has custom components
      const { data: customComponents } = await supabase
        .from('product_components')
        .select('id')
        .eq('product_id', productDbId)
        .eq('is_active', true)
        .limit(1);

      if (customComponents?.length) {
        return { source: 'product' as const, productDbId };
      }

      // Check if product belongs to a group
      const { data: groupMember } = await supabase
        .from('product_group_members')
        .select('product_group_id, use_group_rules')
        .eq('product_id', productDbId)
        .maybeSingle();

      if (groupMember?.use_group_rules) {
        return { source: 'group' as const, productDbId, groupId: groupMember.product_group_id };
      }

      return { source: 'none' as const, productDbId };
    },
  });

  // Fetch product-specific rules via external DB
  const { data: productComponents, isLoading: loadingProductRules } = useQuery({
    queryKey: ['product-custom-rules', productData?.productDbId],
    queryFn: async () => {
      if (!productData?.productDbId || productData.source !== 'product') return null;

      try {
        const result = await invokeExternalRpc<{ locations: RpcLocation[] }>(
          'fn_get_product_customization_options',
          { p_product_id: productData.productDbId },
        );

        if (!result?.locations?.length) return [];

        // Map v6 response to component-like structure for compatibility
        return result.locations.map((loc: RpcLocation) => ({
          id: loc.location_code,
          component_code: loc.location_code,
          component_name: loc.location_name,
          is_personalizable: true,
          locations: [
            {
              id: loc.location_code,
              location_code: loc.location_code,
              location_name: loc.location_name,
              techniques:
                loc.options?.map((opt: RpcTechniqueOption) => ({
                  id: opt.technique_id,
                  name: opt.tecnica_nome,
                  code: opt.codigo_tabela,
                  max_colors: opt.max_cores,
                })) ?? [],
            },
          ],
        }));
      } catch (err) {
        logger.warn('Error fetching product rules via v6:', err);
        return null;
      }
    },
    enabled: productData?.source === 'product',
  });

  // Fetch group rules — group products also use the v6 API since the
  // local DB does not have product_group_components/locations tables.
  const { data: groupComponents, isLoading: loadingGroupRules } = useQuery({
    queryKey: ['product-group-rules', productData?.groupId, productData?.productDbId],
    queryFn: async () => {
      if (!productData?.productDbId || productData.source !== 'group') return null;

      try {
        const result = await invokeExternalRpc<{ locations: RpcLocation[] }>(
          'fn_get_product_customization_options',
          { p_product_id: productData.productDbId },
        );

        if (!result?.locations?.length) return [];

        return result.locations.map((loc: RpcLocation) => ({
          id: loc.location_code,
          component_code: loc.location_code,
          component_name: loc.location_name,
          is_personalizable: true,
          locations: [
            {
              id: loc.location_code,
              location_code: loc.location_code,
              location_name: loc.location_name,
              techniques:
                loc.options?.map((opt: RpcTechniqueOption) => ({
                  id: opt.technique_id,
                  name: opt.tecnica_nome,
                  code: opt.codigo_tabela,
                  max_colors: opt.max_cores,
                })) ?? [],
            },
          ],
        }));
      } catch (err) {
        logger.warn('Error fetching group rules via v6:', err);
        return null;
      }
    },
    enabled: productData?.source === 'group',
  });

  const isLoading = loadingProduct || loadingProductRules || loadingGroupRules;

  // Transform data to unified format
  const components: ComponentInfo[] = (() => {
    const rawComponents = productData?.source === 'product' ? productComponents : groupComponents;
    if (!rawComponents) return [];

    return (rawComponents as RpcComponent[]).map((comp: RpcComponent) => {
      const locations =
        productData?.source === 'product'
          ? comp.locations // v6 format from invokeExternalRpc
          : comp.product_group_locations;

      return {
        id: comp.id,
        code: comp.component_code,
        name: comp.component_name,
        isPersonalizable: comp.is_personalizable,
        locations: ((locations ?? []) as DbLocation[]).map((loc: DbLocation) => {
          const techniques =
            productData?.source === 'product'
              ? loc.techniques // v6 format
              : loc.product_group_location_techniques;

          return {
            id: loc.id,
            code: loc.location_code,
            name: loc.location_name,
            maxWidth: loc.max_width_cm ?? null,
            maxHeight: loc.max_height_cm ?? null,
            maxArea: loc.max_area_cm2 ?? null,
            areaImageUrl: loc.area_image_url ?? null,
            techniques: (techniques ?? [])
              .map((tech: DbTechnique): TechniqueInfo | null => {
                const id = tech.id || tech.personalization_techniques?.id;
                if (!id) return null;
                return {
                  id,
                  name: tech.name || (tech.personalization_techniques?.name ?? ''),
                  code: tech.code || (tech.personalization_techniques?.code ?? ''),
                  description:
                    tech.description ?? tech.personalization_techniques?.description ?? null,
                  estimatedDays:
                    tech.estimatedDays ?? tech.personalization_techniques?.estimated_days ?? null,
                  maxColors: tech.max_colors ?? null,
                  isDefault: tech.is_default ?? false,
                };
              })
              .filter((t): t is TechniqueInfo => t !== null),
          };
        }),
      };
    });
  })();

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-24 w-full rounded-xl" />
      </div>
    );
  }

  if (!components || components.length === 0) {
    return null;
  }

  const personalizableComponents = components.filter(
    (c) => c.isPersonalizable && c.locations.length > 0,
  );

  if (personalizableComponents.length === 0) {
    return null;
  }

  const handleExportExcel = () => {
    try {
      exportToExcel({
        productName: productName || productSku,
        productSku,
        components: personalizableComponents,
      });
      toast.success('Excel exportado com sucesso!');
    } catch (error) {
      logger.error('Export error:', error);
      toast.error('Erro ao exportar Excel');
    }
  };

  const handleExportPDF = () => {
    try {
      exportToPDF({
        productName: productName || productSku,
        productSku,
        components: personalizableComponents,
      });
      toast.success('PDF exportado com sucesso!');
    } catch (error) {
      logger.error('Export error:', error);
      toast.error('Erro ao exportar PDF');
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="font-display text-sm font-semibold text-foreground">Regras de Gravação</h3>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <Info className="h-3.5 w-3.5 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent>
                <p>Técnicas e locais disponíveis para personalização deste produto</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-[11px]">
              <Download className="h-3.5 w-3.5" />
              Exportar
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={handleExportExcel} className="cursor-pointer gap-2 text-xs">
              <FileSpreadsheet className="h-3.5 w-3.5 text-success" />
              Excel
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleExportPDF} className="cursor-pointer gap-2 text-xs">
              <FileText className="h-3.5 w-3.5 text-destructive" />
              PDF
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Accordion type="single" collapsible className="w-full">
        {personalizableComponents.map((component) => (
          <AccordionItem
            key={component.id}
            value={component.id}
            className="mb-1 rounded-lg border border-border bg-card/50 px-3"
          >
            <AccordionTrigger className="py-2.5 hover:no-underline">
              <div className="flex items-center gap-2">
                <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/10">
                  <Layers className="h-3 w-3 text-primary" />
                </div>
                <div className="text-left">
                  <span className="text-xs font-medium text-foreground">{component.name}</span>
                  <span className="ml-2 text-[10px] text-muted-foreground">
                    {component.locations.length}{' '}
                    {component.locations.length === 1 ? 'local' : 'locais'}
                  </span>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pb-3">
              <div className="space-y-3 pl-8">
                {component.locations.map((location) => (
                  <div
                    key={location.id}
                    className="space-y-2 rounded-lg border border-border/50 bg-secondary/30 p-3"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <MapPin className="h-3.5 w-3.5 text-info" />
                        <span className="text-xs font-medium">{location.name}</span>
                        <span className="font-mono text-[10px] text-muted-foreground">
                          ({location.code})
                        </span>
                      </div>
                      {(location.maxWidth || location.maxHeight) && (
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Maximize2 className="h-3.5 w-3.5" />
                          {location.maxWidth && location.maxHeight
                            ? `${location.maxWidth} × ${location.maxHeight} cm`
                            : location.maxArea
                              ? `${location.maxArea} cm²`
                              : null}
                        </div>
                      )}
                    </div>

                    {/* Area image */}
                    {location.areaImageUrl && (
                      <div className="relative overflow-hidden rounded-lg border border-border/50 bg-background">
                        <img
                          src={location.areaImageUrl}
                          alt={`Área de impressão - ${location.name}`}
                          className="max-h-40 w-full object-contain"
                          loading="lazy"
                        />
                        <div className="absolute bottom-2 left-2 rounded bg-background/80 px-2 py-1 text-xs text-muted-foreground backdrop-blur-sm">
                          Área de impressão
                        </div>
                      </div>
                    )}

                    {location.techniques.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {location.techniques.map((technique) => (
                          <TooltipProvider key={technique.id}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Badge
                                  variant={technique.isDefault ? 'default' : 'secondary'}
                                  className="cursor-help px-3 py-1 text-xs"
                                >
                                  <Palette className="mr-1.5 h-3 w-3" />
                                  {technique.name}
                                  {technique.maxColors && (
                                    <span className="ml-1.5 opacity-75">
                                      ({technique.maxColors}{' '}
                                      {technique.maxColors === 1 ? 'cor' : 'cores'})
                                    </span>
                                  )}
                                  {technique.isDefault && (
                                    <span className="ml-1.5 text-[10px] uppercase tracking-wide opacity-75">
                                      padrão
                                    </span>
                                  )}
                                </Badge>
                              </TooltipTrigger>
                              <TooltipContent side="bottom">
                                <div className="space-y-1">
                                  <p className="font-medium">{technique.name}</p>
                                  {technique.description && (
                                    <p className="text-xs opacity-80">{technique.description}</p>
                                  )}
                                  {technique.estimatedDays && (
                                    <p className="flex items-center gap-1 text-xs opacity-75">
                                      <Clock className="h-3 w-3" />~{technique.estimatedDays}{' '}
                                      {technique.estimatedDays === 1 ? 'dia' : 'dias'}
                                    </p>
                                  )}
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
}
