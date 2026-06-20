import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface TemplateArea {
  name: string;
  positionX: number;
  positionY: number;
  logoWidth: number;
  logoHeight: number;
}

interface TemplatePreviewProps {
  areas: TemplateArea[];
  className?: string;
  showTooltips?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const sizeConfig = {
  sm: { container: 'w-16 h-16', dot: { min: 6, max: 14 }, text: 'text-[6px]', label: 'text-[6px]' },
  md: { container: 'w-20 h-20', dot: { min: 8, max: 20 }, text: 'text-[8px]', label: 'text-[8px]' },
  lg: {
    container: 'w-28 h-28',
    dot: { min: 10, max: 24 },
    text: 'text-[10px]',
    label: 'text-[9px]',
  },
};

export function TemplatePreview({
  areas,
  className,
  showTooltips = true,
  size = 'md',
}: TemplatePreviewProps) {
  const config = sizeConfig[size];
  const maxSize = Math.max(...areas.map((a) => Math.max(a.logoWidth, a.logoHeight)), 1);

  const renderAreaMarker = (area: TemplateArea, index: number) => {
    const normalizedSize =
      config.dot.min +
      (Math.max(area.logoWidth, area.logoHeight) / maxSize) * (config.dot.max - config.dot.min);

    const marker = (
      <div
        className={cn(
          'absolute -translate-x-1/2 -translate-y-1/2 transform',
          'flex items-center justify-center rounded-full',
          'bg-primary font-bold text-primary-foreground',
          'border border-primary-foreground/20 shadow-sm',
          'transition-transform duration-200 hover:scale-110',
          config.text,
        )}
        style={{
          left: `${area.positionX}%`,
          top: `${area.positionY}%`,
          width: `${normalizedSize}px`,
          height: `${normalizedSize}px`,
        }}
        aria-label={`Área ${index + 1}: ${area.name}`}
      >
        {index + 1}
      </div>
    );

    if (!showTooltips) return <div key={index}>{marker}</div>;

    return (
      <TooltipProvider key={index}>
        <Tooltip>
          <TooltipTrigger asChild>{marker}</TooltipTrigger>
          <TooltipContent side="top">
            <div className="space-y-1">
              <p className="font-medium">{area.name}</p>
              <p className="text-muted-foreground">
                {area.logoWidth}×{area.logoHeight} cm
              </p>
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  };

  return (
    <div
      className={cn(
        'relative rounded-md border border-border bg-muted/50',
        'transition-all duration-200',
        config.container,
        className,
      )}
      role="img"
      aria-label={`Template com ${areas.length} ${areas.length === 1 ? 'área' : 'áreas'} de personalização`}
    >
      {/* Grid lines for visual reference */}
      <div className="pointer-events-none absolute inset-0 opacity-20" aria-hidden="true">
        <div className="absolute bottom-0 left-1/2 top-0 w-px bg-border" />
        <div className="absolute left-0 right-0 top-1/2 h-px bg-border" />
      </div>

      {/* Area markers */}
      {areas.map((area, index) => renderAreaMarker(area, index))}

      {/* Legend */}
      <div className="absolute -bottom-1 left-0 right-0 flex justify-center" aria-hidden="true">
        <span className={cn('rounded bg-background px-1 text-muted-foreground', config.label)}>
          {areas.length} {areas.length === 1 ? 'área' : 'áreas'}
        </span>
      </div>
    </div>
  );
}

// Versão expandida para visualização detalhada
interface TemplatePreviewExpandedProps extends TemplatePreviewProps {
  productImage?: string;
  onAreaClick?: (index: number, area: TemplateArea) => void;
}

export function TemplatePreviewExpanded({
  areas,
  className,
  productImage,
  onAreaClick,
}: TemplatePreviewExpandedProps) {
  return (
    <div
      className={cn(
        'relative aspect-square w-full overflow-hidden rounded-lg border border-border bg-muted/30',
        className,
      )}
    >
      {productImage && (
        <img
          loading="lazy"
          src={productImage}
          alt="Produto"
          className="absolute inset-0 h-full w-full object-contain opacity-30"
        />
      )}

      {/* Grid overlay */}
      <div className="pointer-events-none absolute inset-0 opacity-10" aria-hidden="true">
        <div className="absolute bottom-0 left-1/4 top-0 w-px bg-border" />
        <div className="absolute bottom-0 left-1/2 top-0 w-px bg-border" />
        <div className="absolute bottom-0 left-3/4 top-0 w-px bg-border" />
        <div className="absolute left-0 right-0 top-1/4 h-px bg-border" />
        <div className="absolute left-0 right-0 top-1/2 h-px bg-border" />
        <div className="absolute left-0 right-0 top-3/4 h-px bg-border" />
      </div>

      {/* Area markers */}
      {areas.map((area, index) => (
        <TooltipProvider key={index}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => onAreaClick?.(index, area)}
                className={cn(
                  'absolute -translate-x-1/2 -translate-y-1/2 transform',
                  'flex items-center justify-center rounded-full',
                  'bg-primary text-sm font-bold text-primary-foreground',
                  'border-2 border-primary-foreground/30 shadow-lg',
                  'transition-all duration-200',
                  'hover:scale-110 hover:shadow-xl',
                  onAreaClick && 'cursor-pointer',
                )}
                style={{
                  left: `${area.positionX}%`,
                  top: `${area.positionY}%`,
                  width: '32px',
                  height: '32px',
                }}
                aria-label={`Selecionar área ${index + 1}: ${area.name}`}
              >
                {index + 1}
              </button>
            </TooltipTrigger>
            <TooltipContent side="top">
              <div className="space-y-1">
                <p className="font-medium">{area.name}</p>
                <p className="text-xs text-muted-foreground">
                  Tamanho: {area.logoWidth}×{area.logoHeight} cm
                </p>
                <p className="text-xs text-muted-foreground">
                  Posição: {area.positionX}%, {area.positionY}%
                </p>
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ))}
    </div>
  );
}
