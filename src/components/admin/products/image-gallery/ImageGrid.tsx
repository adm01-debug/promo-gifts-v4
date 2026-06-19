import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import {
  GripVertical,
  ZoomIn,
  Star,
  X,
  Film,
  Type,
  CheckSquare,
  Square,
  CheckCircle2,
  Cloud,
  CloudOff,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { type ExternalImage, type VariantInfo, IMAGE_TYPES } from './types';
import { ImageMetaEditor } from './ImageMetaEditor';
import { OptimizedImage } from '@/components/ui/OptimizedImage';

const CF_STATUS_CONFIG = {
  verified: { icon: Cloud, className: 'text-emerald-500', label: 'Cloudflare: sincronizado' },
  syncing: {
    icon: Loader2,
    className: 'text-blue-400 animate-spin',
    label: 'Cloudflare: sincronizando',
  },
  pending: { icon: Cloud, className: 'text-muted-foreground/50', label: 'Cloudflare: pendente' },
  missing: { icon: AlertCircle, className: 'text-amber-500', label: 'Cloudflare: ausente' },
  failed: { icon: CloudOff, className: 'text-destructive', label: 'Cloudflare: falhou' },
  skipped: { icon: AlertCircle, className: 'text-warning/60', label: 'Cloudflare: ignorado' },
} as const;

interface Props {
  filteredImages: string[];
  images: string[];
  extImageMap: Map<string, ExternalImage>;
  variantMap: Map<string, VariantInfo>;
  bulkMode: boolean;
  selectedUrls: Set<string>;
  editingIndex: number | null;
  dragIndex: number | null;
  dragOverIndex: number | null;
  toggleSelect: (url: string) => void;
  handleDragStart: (index: number) => void;
  handleDragOver: (e: React.DragEvent, index: number) => void;
  handleDrop: (e: React.DragEvent, index: number) => void;
  handleDragEnd: () => void;
  setPreviewUrl: (url: string | null) => void;
  setEditingIndex: (index: number | null) => void;
  handleSetPrimary: (url: string) => void;
  requestRemove: (url: string) => void;
  updateExternalImageMeta: (
    url: string,
    data: { alt_text: string; image_type: string; caption: string },
  ) => void;
}

export function ImageGrid({
  filteredImages,
  images,
  extImageMap,
  variantMap,
  bulkMode,
  selectedUrls,
  editingIndex,
  dragIndex,
  dragOverIndex,
  toggleSelect,
  handleDragStart,
  handleDragOver,
  handleDrop,
  handleDragEnd,
  setPreviewUrl,
  setEditingIndex,
  handleSetPrimary,
  requestRemove,
  updateExternalImageMeta,
}: Props) {
  return (
    <div className="grid grid-cols-4 gap-2 sm:grid-cols-5 md:grid-cols-6">
      {filteredImages.map((img, index) => {
        const ext = extImageMap.get(img);
        const typeInfo = ext?.image_type
          ? IMAGE_TYPES.find((t) => t.value === ext.image_type)
          : null;
        const isFirst = images.indexOf(img) === 0;
        const variantCode = ext?.supplier_code || ext?.variant_id;
        const variant = variantCode ? variantMap.get(variantCode) : null;
        const isVideo = ext?.image_type === 'video';
        const globalIndex = images.indexOf(img);
        const isSelected = selectedUrls.has(img);
        const cfStatus = ext?.cf_sync_status;
        const cfConfig = cfStatus ? CF_STATUS_CONFIG[cfStatus] : null;

        return (
          <div
            key={`${img}-${index}`}
            draggable={!bulkMode}
            onDragStart={() => !bulkMode && handleDragStart(globalIndex)}
            onDragOver={(e) => !bulkMode && handleDragOver(e, globalIndex)}
            onDrop={(e) => !bulkMode && handleDrop(e, globalIndex)}
            onDragEnd={handleDragEnd}
            onClick={bulkMode ? () => toggleSelect(img) : undefined}
            className={cn(
              'group relative aspect-square overflow-hidden rounded-lg border-2 transition-all',
              isFirst && !bulkMode ? 'border-primary ring-1 ring-primary/30' : 'border-border/60',
              dragIndex === globalIndex && 'scale-95 opacity-50',
              dragOverIndex === globalIndex &&
                dragIndex !== globalIndex &&
                'border-dashed border-primary',
              bulkMode && 'cursor-pointer',
              isSelected && 'border-primary ring-2 ring-primary/40',
            )}
          >
            {isVideo ? (
              <div className="flex h-full w-full items-center justify-center bg-muted/30">
                <Film className="h-8 w-8 text-muted-foreground/40" />
              </div>
            ) : (
              <OptimizedImage
                src={img}
                alt={ext?.alt_text || `Imagem ${index + 1}`}
                urlOriginal={ext?.url_original ?? ext?.url ?? null}
                blurhash={ext?.blurhash}
                className="object-contain"
                containerClassName="h-full w-full"
              />
            )}

            {/* Badges top-left */}
            <div className="absolute left-1 top-1 flex flex-col gap-0.5">
              {isFirst && (
                <Badge className="bg-primary px-1 py-0 text-[9px] leading-tight text-primary-foreground">
                  Principal
                </Badge>
              )}
              {typeInfo && !isFirst && (
                <Badge
                  variant="secondary"
                  className="flex items-center gap-0.5 px-1 py-0 text-[8px] leading-tight"
                >
                  <typeInfo.icon className={cn('h-2 w-2', typeInfo.color)} />
                  {typeInfo.label}
                </Badge>
              )}
              {variant && (
                <Badge
                  variant="outline"
                  className="flex items-center gap-0.5 bg-background/80 px-1 py-0 text-[8px] leading-tight backdrop-blur-sm"
                >
                  {variant.color_hex && (
                    <div
                      className="h-2 w-2 rounded-full border border-border/40"
                      style={{ backgroundColor: variant.color_hex }}
                    />
                  )}
                  {variant.color_name || variant.name}
                </Badge>
              )}
            </div>

            {/* Top-right badges */}
            <div className="absolute right-1 top-1 flex flex-col gap-0.5">
              {ext?.is_og_image && (
                <Badge variant="secondary" className="px-1 py-0 text-[8px] leading-tight">
                  OG
                </Badge>
              )}
              {ext?.alt_text && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-primary/80">
                      <CheckCircle2 className="h-2 w-2 text-white" />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>Alt: {ext.alt_text}</TooltipContent>
                </Tooltip>
              )}
              {cfConfig && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex h-3.5 w-3.5 items-center justify-center">
                      <cfConfig.icon className={cn('h-3 w-3', cfConfig.className)} />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>{cfConfig.label}</TooltipContent>
                </Tooltip>
              )}
            </div>

            {/* Meta editor */}
            {editingIndex === globalIndex && ext && (
              <ImageMetaEditor
                image={ext}
                onSave={(data) => updateExternalImageMeta(img, data)}
                onCancel={() => setEditingIndex(null)}
              />
            )}

            {/* Bulk checkbox */}
            {bulkMode && (
              <div className="absolute right-1 top-1 z-10">
                <div
                  className={cn(
                    'flex h-5 w-5 items-center justify-center rounded transition-colors',
                    isSelected ? 'bg-primary text-primary-foreground' : 'bg-black/50 text-white/70',
                  )}
                >
                  {isSelected ? (
                    <CheckSquare className="h-3.5 w-3.5" />
                  ) : (
                    <Square className="h-3.5 w-3.5" />
                  )}
                </div>
              </div>
            )}

            {/* Hover overlay */}
            {editingIndex !== globalIndex && !bulkMode && (
              <div className="absolute inset-0 flex items-center justify-center gap-1 bg-black/60 opacity-0 transition-opacity group-hover:opacity-100">
                <GripVertical className="absolute left-1 top-1 h-4 w-4 cursor-grab text-white/70" />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Ampliar"
                  className="h-7 w-7 text-white hover:bg-white/20"
                  onClick={() => setPreviewUrl(img)}
                >
                  <ZoomIn className="h-3.5 w-3.5" />
                </Button>
                {ext && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Type"
                    className="h-7 w-7 text-white hover:bg-white/20"
                    onClick={() => setEditingIndex(globalIndex)}
                    title="Editar metadados"
                  >
                    <Type className="h-3.5 w-3.5" />
                  </Button>
                )}
                {!isFirst && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Favoritar"
                    className="h-7 w-7 text-warning hover:bg-white/20"
                    onClick={() => handleSetPrimary(img)}
                    title="Definir como principal"
                  >
                    <Star className="h-3.5 w-3.5" />
                  </Button>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Fechar"
                  className="h-7 w-7 text-destructive hover:bg-white/20"
                  onClick={() => requestRemove(img)}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
