/**
 * PackagingModal - Modal com detalhes da embalagem especial do produto
 */
import { useState } from 'react';
import { Gift, Package, Ruler, Scale, Boxes, Info } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { AspectRatio } from '@/components/ui/aspect-ratio';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

type PackagingContext = 'always' | 'with_customization' | 'without_customization' | null;

interface PackagingModalProps {
  isOpen: boolean;
  onClose: () => void;
  packingType: string | null;
  packagingContext?: PackagingContext;
  boxImage: string | null;
  boxWidthMm: number | null;
  boxHeightMm: number | null;
  boxLengthMm: number | null;
  boxWeightKg: number | null;
  boxQuantity: number | null;
  boxVolumeCm3: number | null;
}

// Mapeamento de contexto para texto
const contextLabels: Record<string, string> = {
  always: 'Sempre disponível',
  with_customization: 'Disponível com personalização',
  without_customization: 'Disponível sem personalização',
};

export function PackagingModal({
  isOpen,
  onClose,
  packingType,
  packagingContext,
  boxImage,
  boxWidthMm,
  boxHeightMm,
  boxLengthMm,
  boxWeightKg,
  boxQuantity,
  boxVolumeCm3,
}: PackagingModalProps) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  const hasDimensions = boxWidthMm || boxHeightMm || boxLengthMm || boxVolumeCm3;
  const hasWeight = boxWeightKg || boxQuantity;

  // Formatar dimensões
  const formatDimension = (value: number | null, unit: string) => {
    if (!value) return null;
    return `${value.toLocaleString('pt-BR')} ${unit}`;
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-warning/10">
              <Gift className="h-4 w-4 text-warning" />
            </div>
            <span>Embalagem Especial</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 pt-2">
          {/* Imagem da Embalagem */}
          <div className="relative overflow-hidden rounded-xl border border-border bg-secondary/30">
            <AspectRatio ratio={4 / 3}>
              {boxImage && !imageError ? (
                <>
                  {!imageLoaded && (
                    <div className="absolute inset-0">
                      <Skeleton className="h-full w-full rounded-none" />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Package className="h-12 w-12 animate-pulse text-muted-foreground/20" />
                      </div>
                    </div>
                  )}
                  <img
                    src={boxImage}
                    alt={packingType || 'Embalagem especial'}
                    className={cn(
                      'h-full w-full object-contain transition-all duration-700 ease-out',
                      imageLoaded ? 'scale-100 opacity-100 blur-0' : 'scale-105 opacity-40 blur-md',
                    )}
                    onLoad={() => setImageLoaded(true)}
                    onError={() => setImageError(true)}
                    loading="lazy"
                  />
                </>
              ) : (
                <div className="flex h-full flex-col items-center justify-center bg-gradient-to-br from-secondary to-secondary/50">
                  <Package className="mb-2 h-16 w-16 text-muted-foreground/30" />
                  <span className="text-xs text-muted-foreground">Imagem não disponível</span>
                </div>
              )}
            </AspectRatio>
          </div>

          {/* Tipo da Embalagem */}
          {packingType && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <Package className="h-4 w-4 text-warning" />
                Tipo
              </div>
              <div className="flex flex-col gap-1.5">
                <Badge
                  variant="secondary"
                  className="w-fit border border-warning/20 bg-warning/10 px-3 py-1.5 text-sm font-medium text-warning-foreground"
                >
                  {packingType}
                </Badge>
                {packagingContext && contextLabels[packagingContext] && (
                  <span className="text-xs text-muted-foreground">
                    {contextLabels[packagingContext]}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Dimensões */}
          {hasDimensions && (
            <>
              <Separator className="bg-border/50" />
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <Ruler className="h-4 w-4 text-info" />
                  Dimensões
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {boxWidthMm && (
                    <DimensionItem label="Largura" value={formatDimension(boxWidthMm, 'mm')} />
                  )}
                  {boxHeightMm && (
                    <DimensionItem label="Altura" value={formatDimension(boxHeightMm, 'mm')} />
                  )}
                  {boxLengthMm && (
                    <DimensionItem
                      label="Profundidade"
                      value={formatDimension(boxLengthMm, 'mm')}
                    />
                  )}
                  {boxVolumeCm3 && (
                    <DimensionItem label="Volume" value={formatDimension(boxVolumeCm3, 'cm³')} />
                  )}
                </div>
              </div>
            </>
          )}

          {/* Peso e Quantidade */}
          {hasWeight && (
            <>
              <Separator className="bg-border/50" />
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <Scale className="h-4 w-4 text-success" />
                  Peso e Quantidades
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {boxWeightKg && (
                    <DimensionItem
                      label="Peso da embalagem"
                      value={`${boxWeightKg.toLocaleString('pt-BR')} kg`}
                    />
                  )}
                  {boxQuantity && (
                    <DimensionItem
                      label="Qtd por caixa master"
                      value={`${boxQuantity.toLocaleString('pt-BR')} un`}
                      icon={<Boxes className="h-3.5 w-3.5 text-muted-foreground" />}
                    />
                  )}
                </div>
              </div>
            </>
          )}

          {/* Observação */}
          <Separator className="bg-border/50" />
          <div className="flex items-start gap-2 rounded-lg border border-info/20 bg-info/5 p-3">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-info" />
            <p className="text-xs leading-relaxed text-muted-foreground">
              A embalagem especial está inclusa no preço do produto.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Componente auxiliar para exibir dimensões
function DimensionItem({
  label,
  value,
  icon,
}: {
  label: string;
  value: string | null;
  icon?: React.ReactNode;
}) {
  if (!value) return null;

  return (
    <div className="rounded-lg border border-border/50 bg-secondary/50 p-2.5">
      <div className="mb-1 flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="text-sm font-medium text-foreground">{value}</div>
    </div>
  );
}
