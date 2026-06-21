/**
 * MockupLightbox — Dialog de visualização ampliada de mockup
 * Extraído de MockupHistoryPanel.tsx
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Download, RotateCcw, Clock, X, MapPin, ZoomIn, ZoomOut } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ShareMenu } from './ShareMenu';
import type { GeneratedMockup } from '@/hooks/mockup/mockupGenerationService';

// GeneratedMockup importado de @/hooks/mockup/mockupGenerationService (SSOT)

interface MockupLightboxProps {
  mockup: GeneratedMockup | null;
  onClose: () => void;
  onLoadFromHistory: (mockup: GeneratedMockup) => void;
  onDownload: (url: string) => void;
}

export function MockupLightbox({
  mockup,
  onClose,
  onLoadFromHistory,
  onDownload,
}: MockupLightboxProps) {
  const [zoom, setZoom] = useState(1);

  const handleClose = () => {
    setZoom(1);
    onClose();
  };

  return (
    <Dialog
      open={!!mockup}
      onOpenChange={(open) => {
        if (!open) handleClose();
      }}
    >
      <DialogContent className="h-auto max-h-[95vh] w-auto max-w-[95vw] border-0 bg-black p-0 [&>button]:hidden">
        {mockup && (
          <div className="relative flex h-full w-full flex-col">
            {/* Top bar */}
            <div className="flex shrink-0 items-center justify-between border-b border-border bg-card px-4 py-2.5">
              <div className="flex min-w-0 items-center gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-primary-foreground">
                    {mockup.product_name}
                  </p>
                  <div className="mt-0.5 flex items-center gap-2">
                    {mockup.product_sku && (
                      <span className="font-mono text-[10px] text-muted-foreground">
                        {mockup.product_sku}
                      </span>
                    )}
                    <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">
                      {mockup.technique_name}
                    </Badge>
                    {mockup.location_name && (
                      <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                        <MapPin className="h-2.5 w-2.5" /> {mockup.location_name}
                      </span>
                    )}
                  </div>
                </div>
                {mockup.client_name && (
                  <Badge
                    variant="outline"
                    className="shrink-0 border-primary/40 text-[10px] text-primary"
                  >
                    👤 {mockup.client_name}
                  </Badge>
                )}
                <span className="flex shrink-0 items-center gap-1 text-[10px] text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  {formatDistanceToNow(new Date(mockup.created_at), {
                    addSuffix: true,
                    locale: ptBR,
                  })}
                </span>
              </div>
              <div className="ml-4 flex shrink-0 items-center gap-1.5">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 gap-1.5 border-border bg-muted text-xs text-foreground hover:bg-muted"
                  onClick={() => onLoadFromHistory(mockup)}
                >
                  <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" /> Regenerar
                </Button>
                <ShareMenu
                  mockupUrl={mockup.mockup_url}
                  productName={mockup.product_name}
                  techniqueName={mockup.technique_name}
                />
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 gap-1.5 border-border bg-muted text-xs text-foreground hover:bg-muted"
                  onClick={() => onDownload(mockup.layout_url || mockup.mockup_url)}
                >
                  <Download className="h-3.5 w-3.5" aria-hidden="true" /> Baixar PDF
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 text-muted-foreground hover:bg-muted hover:text-primary-foreground"
                  onClick={handleClose}
                  aria-label="Fechar lightbox"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </Button>
              </div>
            </div>

            {/* Image */}
            <div
              className="flex flex-1 items-center justify-center overflow-auto"
              style={{ cursor: zoom > 1 ? 'grab' : 'default', minHeight: '70vh' }}
            >
              <img
                src={mockup.layout_url || mockup.mockup_url}
                alt={`Mockup de ${mockup.product_name}`}
                className="max-h-[82vh] select-none object-contain"
                style={{
                  transform: `scale(${zoom})`,
                  transition: 'transform 0.15s ease-out',
                  imageRendering: zoom > 1.5 ? 'auto' : undefined,
                }}
                draggable={false}
              />
            </div>

            {/* Zoom bar */}
            <div className="flex shrink-0 items-center justify-center border-t border-border bg-card py-2">
              <div className="flex items-center gap-1">
                <Button
                  size="icon"
                  aria-label="Diminuir zoom"
                  variant="ghost"
                  className="h-7 w-7 text-muted-foreground hover:bg-muted hover:text-primary-foreground"
                  onClick={() => setZoom((z) => Math.max(z - 0.25, 0.25))}
                  disabled={zoom <= 0.25}
                >
                  <ZoomOut className="h-3.5 w-3.5" aria-hidden="true" />
                </Button>
                <span className="w-12 text-center text-xs font-medium text-muted-foreground">
                  {Math.round(zoom * 100)}%
                </span>
                <Button
                  size="icon"
                  aria-label="Aumentar zoom"
                  variant="ghost"
                  className="h-7 w-7 text-muted-foreground hover:bg-muted hover:text-primary-foreground"
                  onClick={() => setZoom((z) => Math.min(z + 0.25, 5))}
                >
                  <ZoomIn className="h-3.5 w-3.5" aria-hidden="true" />
                </Button>
                <Button
                  size="icon"
                  aria-label="Resetar zoom"
                  variant="ghost"
                  className="h-7 w-7 text-muted-foreground hover:bg-muted hover:text-primary-foreground"
                  onClick={() => setZoom(1)}
                >
                  <RotateCcw className="h-3 w-3" aria-hidden="true" />
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
