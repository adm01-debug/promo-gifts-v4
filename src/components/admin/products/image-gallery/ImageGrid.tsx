import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { GripVertical, ZoomIn, Star, X, Film, Type, CheckSquare, Square, CheckCircle2 } from 'lucide-react';
import { type ExternalImage, type VariantInfo, IMAGE_TYPES } from "./types";
import { ImageMetaEditor } from './ImageMetaEditor';

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
  updateExternalImageMeta: (url: string, data: { alt_text: string; image_type: string; caption: string }) => void;
}

export function ImageGrid({
  filteredImages, images, extImageMap, variantMap, bulkMode, selectedUrls,
  editingIndex, dragIndex, dragOverIndex, toggleSelect,
  handleDragStart, handleDragOver, handleDrop, handleDragEnd,
  setPreviewUrl, setEditingIndex, handleSetPrimary, requestRemove, updateExternalImageMeta,
}: Props) {
  return (
    <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-2">
      {filteredImages.map((img, index) => {
        const ext = extImageMap.get(img);
        const typeInfo = ext?.image_type ? IMAGE_TYPES.find(t => t.value === ext.image_type) : null;
        const isFirst = images.indexOf(img) === 0;
        const variantCode = ext?.supplier_code || ext?.variant_id;
        const variant = variantCode ? variantMap.get(variantCode) : null;
        const isVideo = ext?.image_type === 'video';
        const globalIndex = images.indexOf(img);
        const isSelected = selectedUrls.has(img);

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
              'relative group rounded-lg border-2 overflow-hidden aspect-square transition-all',
              isFirst && !bulkMode ? 'border-primary ring-1 ring-primary/30' : 'border-border/60',
              dragIndex === globalIndex && 'opacity-50 scale-95',
              dragOverIndex === globalIndex && dragIndex !== globalIndex && 'border-primary border-dashed',
              bulkMode && 'cursor-pointer',
              isSelected && 'border-primary ring-2 ring-primary/40',
            )}
          >
            {isVideo ? (
              <div className="w-full h-full bg-muted/30 flex items-center justify-center"><Film className="h-8 w-8 text-muted-foreground/40" /></div>
            ) : (
              
<img src={img} alt={ext?.alt_text || `Imagem ${index + 1}`} className="w-full h-full object-contain bg-muted/30" loading="lazy" />
            )}

            {/* Badges top-left */}
            <div className="absolute top-1 left-1 flex flex-col gap-0.5">
              {isFirst && <Badge className="text-[9px] px-1 py-0 bg-primary text-primary-foreground leading-tight">Principal</Badge>}
              {typeInfo && !isFirst && (
                <Badge variant="secondary" className="text-[8px] px-1 py-0 leading-tight flex items-center gap-0.5">
                  <typeInfo.icon className={cn("h-2 w-2", typeInfo.color)} />{typeInfo.label}
                </Badge>
              )}
              {variant && (
                <Badge variant="outline" className="text-[8px] px-1 py-0 leading-tight bg-background/80 backdrop-blur-sm flex items-center gap-0.5">
                  {variant.color_hex && <div className="w-2 h-2 rounded-full border border-border/40" style={{ backgroundColor: variant.color_hex }} />}
                  {variant.color_name || variant.name}
                </Badge>
              )}
            </div>

            {/* Top-right badges */}
            <div className="absolute top-1 right-1 flex flex-col gap-0.5">
              {ext?.is_og_image && <Badge variant="secondary" className="text-[8px] px-1 py-0 leading-tight">OG</Badge>}
              {ext?.alt_text && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="w-3.5 h-3.5 rounded-full bg-primary/80 flex items-center justify-center"><CheckCircle2 className="h-2 w-2 text-white" /></div>
                  </TooltipTrigger>
                  <TooltipContent className="text-[10px] max-w-[180px]">Alt: {ext.alt_text}</TooltipContent>
                </Tooltip>
              )}
            </div>

            {/* Meta editor */}
            {editingIndex === globalIndex && ext && (
              <ImageMetaEditor image={ext} onSave={(data) => updateExternalImageMeta(img, data)} onCancel={() => setEditingIndex(null)} />
            )}

            {/* Bulk checkbox */}
            {bulkMode && (
              <div className="absolute top-1 right-1 z-10">
                <div className={cn("w-5 h-5 rounded flex items-center justify-center transition-colors", isSelected ? "bg-primary text-primary-foreground" : "bg-black/50 text-white/70")}>
                  {isSelected ? <CheckSquare className="h-3.5 w-3.5" /> : <Square className="h-3.5 w-3.5" />}
                </div>
              </div>
            )}

            {/* Hover overlay */}
            {editingIndex !== globalIndex && !bulkMode && (
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
                <GripVertical className="absolute top-1 left-1 h-4 w-4 text-white/70 cursor-grab" />
                <Button type="button" variant="ghost" size="icon" aria-label="Ampliar" className="h-7 w-7 text-white hover:bg-white/20" onClick={() => setPreviewUrl(img)}><ZoomIn className="h-3.5 w-3.5" /></Button>
                {ext && <Button type="button" variant="ghost" size="icon" aria-label="Type" className="h-7 w-7 text-white hover:bg-white/20" onClick={() => setEditingIndex(globalIndex)} title="Editar metadados"><Type className="h-3.5 w-3.5" /></Button>}
                {!isFirst && <Button type="button" variant="ghost" size="icon" aria-label="Favoritar" className="h-7 w-7 text-warning hover:bg-white/20" onClick={() => handleSetPrimary(img)} title="Definir como principal"><Star className="h-3.5 w-3.5" /></Button>}
                <Button type="button" variant="ghost" size="icon" aria-label="Fechar" className="h-7 w-7 text-destructive hover:bg-white/20" onClick={() => requestRemove(img)}><X className="h-3.5 w-3.5" /></Button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
