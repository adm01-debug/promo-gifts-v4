import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { Cloud, CloudOff, Fingerprint, Layers } from 'lucide-react';
import { type ExternalImage, type VariantInfo, IMAGE_TYPES } from './types';

const CF_BADGE: Record<string, { label: string; icon: typeof Cloud; className: string }> = {
  verified: { label: 'CF ✓', icon: Cloud, className: 'text-emerald-600' },
  failed: { label: 'CF falhou', icon: CloudOff, className: 'text-destructive' },
  pending: { label: 'CF pendente', icon: Cloud, className: 'text-muted-foreground' },
  syncing: { label: 'CF sincronizando', icon: Cloud, className: 'text-blue-400' },
  skipped: { label: 'CF ignorado', icon: Cloud, className: 'text-warning' },
};

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
            <img
              src={previewUrl}
              alt="Preview"
              className="h-auto max-h-[80vh] w-full rounded object-contain"
              loading="lazy"
            />
            {(() => {
              const ext = extImageMap.get(previewUrl);
              if (!ext) return null;
              const typeInfo = ext.image_type
                ? IMAGE_TYPES.find((t) => t.value === ext.image_type)
                : null;
              const variant =
                ext.supplier_code || ext.variant_id
                  ? variantMap.get(ext.supplier_code || ext.variant_id || '')
                  : null;
              return (
                <div className="flex flex-wrap gap-2 px-2 pb-1 text-[11px] text-muted-foreground">
                  {typeInfo && (
                    <Badge variant="secondary" className="flex items-center gap-1 text-[10px]">
                      <typeInfo.icon className={cn('h-3 w-3', typeInfo.color)} />
                      {typeInfo.label}
                    </Badge>
                  )}
                  {variant && (
                    <Badge variant="outline" className="flex items-center gap-1 text-[10px]">
                      {variant.color_hex && (
                        <div
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: variant.color_hex }}
                        />
                      )}
                      {variant.color_name || variant.name}
                    </Badge>
                  )}
                  {ext.alt_text && <span>Alt: {ext.alt_text}</span>}
                  {ext.caption && <span>• {ext.caption}</span>}
                  {ext.format && <span className="uppercase">• {ext.format}</span>}
                  {ext.width_px && ext.height_px && (
                    <span>
                      • {ext.width_px}×{ext.height_px}px
                    </span>
                  )}
                  {ext.file_size_bytes && (
                    <span>• {(ext.file_size_bytes / 1024).toFixed(0)}KB</span>
                  )}
                  {(() => {
                    const status = ext.cf_sync_status;
                    if (!status) return null;
                    const cf = CF_BADGE[status];
                    if (!cf) return null;
                    return (
                      <Badge variant="outline" className={cn('flex items-center gap-1 text-[10px]', cf.className)}>
                        <cf.icon className="h-2.5 w-2.5" />
                        {cf.label}
                      </Badge>
                    );
                  })()}
                  {ext.blurhash && (
                    <Badge variant="secondary" className="flex items-center gap-1 text-[10px]">
                      <Layers className="h-2.5 w-2.5" />
                      blurhash
                    </Badge>
                  )}
                  {ext.content_hash && (
                    <span className="flex items-center gap-1">
                      <Fingerprint className="h-2.5 w-2.5" />
                      {ext.content_hash.slice(0, 8)}…
                    </span>
                  )}
                </div>
              );
            })()}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
