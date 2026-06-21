import { memo } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Trash2, MapPin, Upload, RefreshCw, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { PersonalizationArea } from './MultiAreaManager';

interface AreaCardProps {
  area: PersonalizationArea;
  index: number;
  isActive: boolean;
  isReadOnly: boolean;
  canRemove: boolean;
  onSelect: () => void;
  onNameChange: (name: string) => void;
  onLogoUpload: (file: File) => void;
  onLogoRemove: () => void;
  onRemove: () => void;
}

export const AreaCard = memo(
  ({
    area,
    index,
    isActive,
    isReadOnly,
    canRemove,
    onSelect,
    onNameChange,
    onLogoUpload,
    onLogoRemove,
    onRemove,
  }: AreaCardProps) => {
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      e.stopPropagation();
      const file = e.target.files?.[0];
      if (file?.type.startsWith('image/')) {
        onLogoUpload(file);
      }
      // Reset input so the same file can be re-selected
      e.target.value = '';
    };

    return (
      <div
        className={cn(
          'group flex cursor-pointer items-center gap-2 rounded-lg border p-2.5 transition-all duration-200',
          isActive
            ? 'border-primary/60 bg-primary/5 shadow-sm shadow-primary/10'
            : 'border-border/30 hover:border-primary/40 hover:bg-muted/50',
        )}
        onClick={onSelect}
        role="button"
        tabIndex={0}
        data-testid={`mockup-area-card-${area.id}`}
        aria-pressed={isActive}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onSelect();
          }
        }}
      >
        {/* Step number */}
        <div
          className={cn(
            'flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold transition-all duration-200',
            isActive
              ? 'scale-110 bg-primary text-primary-foreground'
              : 'bg-primary/10 text-primary',
          )}
        >
          {index + 1}
        </div>

        {/* Area name */}
        <div className="min-w-0 flex-1">
          {isReadOnly ? (
            <>
              <span className={cn('block truncate text-sm', isActive && 'font-medium')}>
                {area.name}
              </span>
              {(area.maxWidthCm || area.maxHeightCm || area.techniquesAvailable) && (
                <span className="block truncate text-[10px] text-muted-foreground">
                  {area.maxWidthCm && area.maxHeightCm && (
                    <>
                      {area.maxWidthCm}×{area.maxHeightCm}cm
                    </>
                  )}
                  {area.techniquesAvailable ? (
                    <>
                      {' '}
                      · {area.techniquesAvailable}{' '}
                      {area.techniquesAvailable === 1 ? 'técnica' : 'técnicas'}
                    </>
                  ) : null}
                  {area.maxColors ? (
                    <>
                      {' '}
                      · até {area.maxColors} cor{area.maxColors > 1 ? 'es' : ''}
                    </>
                  ) : null}
                  {area.isCurved ? <> · curvo</> : null}
                </span>
              )}
            </>
          ) : (
            <Input
              value={area.name}
              onChange={(e) => {
                e.stopPropagation();
                onNameChange(e.target.value);
              }}
              onClick={(e) => e.stopPropagation()}
              className={cn(
                'h-7 border-0 bg-transparent p-0 text-sm focus-visible:ring-0',
                isActive && 'font-medium',
              )}
              placeholder="Nome da área"
              aria-label={`Nome da área ${index + 1}`}
            />
          )}
        </div>

        {/* Logo indicator / upload button */}
        {area.logoPreview ? (
          <div className="flex flex-shrink-0 items-center gap-1">
            {/* Logo thumbnail */}
            <div className="relative h-7 w-7 overflow-hidden rounded border border-border/30 bg-background">
              <img
                src={area.logoPreview}
                alt="Miniatura do logo enviado"
                className="h-full w-full object-contain"
                loading="lazy"
              />
            </div>

            {/* Replace button */}
            <div className="relative">
              <input
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                onClick={(e) => e.stopPropagation()}
                className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0"
                aria-label={`Substituir logo de ${area.name}`}
              />
              <Button
                variant="ghost"
                size="icon"
                aria-label="Substituir logo"
                className="pointer-events-none h-7 w-7 text-muted-foreground hover:bg-primary/10 hover:text-primary"
                title="Substituir logo"
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </Button>
            </div>

            {/* Remove logo button */}
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
              onClick={(e) => {
                e.stopPropagation();
                onLogoRemove();
              }}
              title="Remover logo"
              aria-label={`Remover logo de ${area.name}`}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        ) : (
          <>
            {/* Position indicator - before upload button */}
            <div className="hidden flex-shrink-0 items-center gap-1 text-[10px] text-muted-foreground sm:flex">
              <MapPin className="h-3 w-3" />
              <span>{area.positionX}%</span>
              <span>×</span>
              <span>{area.positionY}%</span>
            </div>

            {/* Upload button - far right */}
            <div className="relative flex-shrink-0">
              <input
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                onClick={(e) => e.stopPropagation()}
                className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0"
                id={`logo-upload-${area.id}`}
                data-testid={`mockup-logo-upload-input-${area.id}`}
                aria-label={`Upload logo para ${area.name}`}
              />
              <Button
                variant="default"
                size="sm"
                className="pointer-events-none h-7 gap-1 bg-primary px-3 text-xs font-semibold text-primary-foreground shadow-sm hover:bg-primary/90"
              >
                <Upload className="h-3 w-3" />
                Adicionar Logo
              </Button>
            </div>
          </>
        )}

        {/* Remove area button */}
        {!isReadOnly && canRemove && (
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              'h-7 w-7 opacity-0 transition-opacity group-hover:opacity-100',
              'text-muted-foreground hover:bg-destructive/10 hover:text-destructive',
            )}
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            aria-label={`Remover área ${area.name}`}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    );
  },
);
AreaCard.displayName = 'AreaCard';
