import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Layers, ChevronDown, ChevronUp, Copy } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { AreaCard } from './AreaCard';

export interface PersonalizationArea {
  id: string;
  name: string;
  positionX: number;
  positionY: number;
  logoWidth: number;
  logoHeight: number;
  logoRotation?: number;
  logoScale?: number;
  logoPreview: string | null;
  /** File handle for the logo (used during upload, before persistence). */
  logoFile?: File | null;
  // ─── Metadata vinda do RPC fn_get_product_customization_options ───
  /** Largura máxima de gravação na área (cm) */
  maxWidthCm?: number | null;
  /** Altura máxima de gravação na área (cm) */
  maxHeightCm?: number | null;
  /** Máximo de cores suportadas na área */
  maxColors?: number | null;
  /** Se a área aceita gravação em superfície curva */
  isCurved?: boolean;
  /** Quantas técnicas estão disponíveis para esta área */
  techniquesAvailable?: number;
}

interface MultiAreaManagerProps {
  areas: PersonalizationArea[];
  activeAreaId: string | null;
  onAreasChange: (areas: PersonalizationArea[]) => void;
  onActiveAreaChange: (areaId: string | null) => void;
  onLogoUpload: (areaId: string, file: File) => void;
  onLogoRemove?: (areaId: string) => void;
  productLocations?: { code: string; name: string; order: number }[] | null;
}

export function MultiAreaManager({
  areas,
  activeAreaId,
  onAreasChange,
  onActiveAreaChange,
  onLogoUpload,
  onLogoRemove,
}: MultiAreaManagerProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  const activeAreaHasLogo = areas.find((a) => a.id === activeAreaId)?.logoPreview;

  const applyLogoToAllAreas = () => {
    const activeArea = areas.find((a) => a.id === activeAreaId);
    if (!activeArea?.logoPreview) {
      toast.error('Selecione uma área com logo primeiro');
      return;
    }
    onAreasChange(
      areas.map((a) => ({
        ...a,
        logoPreview: activeArea.logoPreview,
        logoFile: activeArea.logoFile ?? null,
      })),
    );
    toast.success(`Logo aplicado em ${areas.length} áreas`);
  };

  return (
    <Card
      onDragOver={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDraggingOver(true);
      }}
      onDragLeave={(e) => {
        e.preventDefault();
        setIsDraggingOver(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setIsDraggingOver(false);
        const file = e.dataTransfer.files?.[0];
        if (!file) return;
        const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'];
        const MAX_SIZE_BYTES = 10 * 1024 * 1024;
        if (!ALLOWED_TYPES.includes(file.type)) {
          toast.error('Formato não suportado. Use JPG, PNG, WebP ou SVG.');
          return;
        }
        if (file.size > MAX_SIZE_BYTES) {
          toast.error('Arquivo muito grande. Tamanho máximo: 10 MB.');
          return;
        }
        const targetAreaId = activeAreaId || areas[0]?.id;
        if (targetAreaId) {
          onLogoUpload(targetAreaId, file);
          toast.success(
            `Logo aplicado na área "${areas.find((a) => a.id === targetAreaId)?.name || 'ativa'}"`,
          );
        }
      }}
      className={cn(
        'border-border/30 transition-all duration-200',
        isDraggingOver && 'border-primary bg-primary/5 ring-2 ring-primary',
      )}
    >
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <CardHeader className="pb-3">
          <CollapsibleTrigger asChild>
            <div className="flex cursor-pointer items-center justify-between hover:opacity-80">
              <div className="flex items-center gap-2">
                <Layers className="h-4 w-4 text-primary" />
                <CardTitle className="text-base">Áreas de Personalização</CardTitle>
                <Badge variant="secondary" className="text-xs">
                  {areas.length} {areas.length === 1 ? 'área' : 'áreas'}
                </Badge>
              </div>
              {isExpanded ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
          </CollapsibleTrigger>
          <CardDescription className="text-xs">
            {isDraggingOver
              ? '🎯 Solte a imagem para aplicar como logo'
              : areas.some((a) => a.maxWidthCm !== null || a.techniquesAvailable !== null)
                ? `${areas.length} ${areas.length === 1 ? 'área oficial do produto' : 'áreas oficiais do produto'}`
                : `${areas.length} ${areas.length === 1 ? 'local configurado' : 'locais configurados'} para este produto`}
          </CardDescription>
        </CardHeader>

        <CollapsibleContent>
          <CardContent className="space-y-3 pt-0">
            {/* Areas list — read-only, no add/remove */}
            <div className="space-y-2">
              {areas.map((area, index) => (
                <AreaCard
                  key={area.id}
                  area={area}
                  index={index}
                  isActive={activeAreaId === area.id}
                  isReadOnly={true}
                  canRemove={false}
                  onSelect={() => onActiveAreaChange(area.id)}
                  onNameChange={() => {}}
                  onLogoUpload={(file) => onLogoUpload(area.id, file)}
                  onLogoRemove={() => {
                    const updated = areas.map((a) =>
                      a.id === area.id ? { ...a, logoPreview: null, logoFile: null } : a,
                    );
                    onAreasChange(updated);
                    onLogoRemove?.(area.id);
                  }}
                  onRemove={() => {}}
                />
              ))}
            </div>

            {areas.length > 1 && activeAreaHasLogo && (
              <Button
                variant="secondary"
                size="sm"
                onClick={applyLogoToAllAreas}
                className="w-full"
              >
                <Copy className="mr-1 h-4 w-4" /> Aplicar Logo em Todas as Áreas
              </Button>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
