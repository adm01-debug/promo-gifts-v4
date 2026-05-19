import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { type ExternalImage, type VariantInfo, IMAGE_TYPES } from "./types";

interface Props {
  previewUrl: string | null;
  onClose: () => void;
  extImageMap: Map<string, ExternalImage>;
  variantMap: Map<string, VariantInfo>;
}

export function ImagePreviewDialog({ previewUrl, onClose, extImageMap, variantMap }: Props) {
  return (
    <Dialog open={!!previewUrl} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-3xl p-2">
        {previewUrl && (
          <div className="space-y-2">
            
<img src={previewUrl} alt="Preview" className="w-full h-auto max-h-[80vh] object-contain rounded"  loading="lazy" />
            {extImageMap.get(previewUrl) && (() => {
              const ext = extImageMap.get(previewUrl)!;
              const typeInfo = ext.image_type ? IMAGE_TYPES.find(t => t.value === ext.image_type) : null;
              const variant = (ext.supplier_code || ext.variant_id) ? variantMap.get(ext.supplier_code || ext.variant_id || '') : null;
              return (
                <div className="flex flex-wrap gap-2 px-2 pb-1 text-[11px] text-muted-foreground">
                  {typeInfo && <Badge variant="secondary" className="text-[10px] flex items-center gap-1"><typeInfo.icon className={cn("h-3 w-3", typeInfo.color)} />{typeInfo.label}</Badge>}
                  {variant && (
                    <Badge variant="outline" className="text-[10px] flex items-center gap-1">
                      {variant.color_hex && <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: variant.color_hex }} />}
                      {variant.color_name || variant.name}
                    </Badge>
                  )}
                  {ext.alt_text && <span>Alt: {ext.alt_text}</span>}
                  {ext.caption && <span>• {ext.caption}</span>}
                  {ext.width_px && ext.height_px && <span>• {ext.width_px}×{ext.height_px}px</span>}
                  {ext.file_size_bytes && <span>• {(ext.file_size_bytes / 1024).toFixed(0)}KB</span>}
                </div>
              );
            })()}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
