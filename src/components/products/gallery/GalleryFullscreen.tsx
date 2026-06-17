/**
 * GalleryFullscreen — Dialog fullscreen com zoom e navegação
 */

import { Play, ZoomIn, ZoomOut, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { getCdnUrl } from '@/utils/image-utils';
import { OptimizedImage } from '@/components/ui/OptimizedImage';

interface GalleryFullscreenProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  allMedia: string[];
  selectedIndex: number;
  productName: string;
  imageCount: number;
  isVideo: (index: number) => boolean;
  zoom: number;
  pan: { x: number; y: number };
  isPanning: boolean;
  isImageLoading: boolean;
  isAnimating: boolean;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetZoom: () => void;
  onGoNext: () => void;
  onGoPrevious: () => void;
  onSelectIndex: (index: number) => void;
  onMouseDown: (e: React.MouseEvent) => void;
  onMouseMove: (e: React.MouseEvent) => void;
  onMouseUp: () => void;
  onWheel: (e: React.WheelEvent) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
}

export function GalleryFullscreen({
  open,
  onOpenChange,
  allMedia,
  selectedIndex,
  productName,
  imageCount: _imageCount,
  isVideo,
  zoom,
  pan,
  isPanning,
  isImageLoading,
  isAnimating,
  onZoomIn,
  onZoomOut,
  onResetZoom,
  onGoNext,
  onGoPrevious,
  onSelectIndex,
  onMouseDown,
  onMouseMove,
  onMouseUp,
  onWheel,
  onKeyDown,
}: GalleryFullscreenProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          onOpenChange(false);
          onResetZoom();
        }
      }}
    >
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-hidden p-0" onKeyDown={onKeyDown}>
        <div
          className="relative h-full w-full overflow-hidden bg-white"
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseUp}
          onWheel={onWheel}
        >
          {!isVideo(selectedIndex) && <div className="absolute inset-0 bg-white" />}
          {isVideo(selectedIndex) ? (
            <video
              src={allMedia[selectedIndex]}
              controls
              className="h-full w-full animate-fade-in object-contain"
            />
          ) : (
            <img
              key={allMedia[selectedIndex]}
              src={allMedia[selectedIndex]}
              alt={`${productName} - Imagem ${selectedIndex + 1}`}
              className={cn(
                'h-full w-full object-contain transition-all duration-700 ease-out',
                zoom > 1 && 'cursor-grab',
                isPanning && 'cursor-grabbing',
                isAnimating && 'scale-95 opacity-80',
                isImageLoading ? 'scale-105 opacity-40 blur-md' : 'scale-100 opacity-100 blur-0',
              )}
              style={{
                transform: `scale(${zoom}) translate(${pan.x / zoom}px, ${pan.y / zoom}px)`,
              }}
              draggable={false}
              onError={(e) => {
                const img = e.currentTarget;
                if (!img.dataset.fallback) {
                  img.dataset.fallback = '1';
                  img.src = '/placeholder.svg';
                }
              }}
            />
          )}

          {/* Navigation */}
          {allMedia.length > 1 && (
            <>
              <Button
                variant="secondary"
                size="icon"
                className="absolute left-3 top-1/2 h-10 w-10 -translate-y-1/2 rounded-full border border-border/50 bg-card/90 shadow-lg backdrop-blur-md transition-all duration-200 hover:scale-110 hover:bg-card"
                onClick={onGoPrevious}
                aria-label="Voltar"
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <Button
                variant="secondary"
                size="icon"
                className="absolute right-3 top-1/2 h-10 w-10 -translate-y-1/2 rounded-full border border-border/50 bg-card/90 shadow-lg backdrop-blur-md transition-all duration-200 hover:scale-110 hover:bg-card"
                onClick={onGoNext}
                aria-label="Avançar"
              >
                <ChevronRight className="h-5 w-5" />
              </Button>
            </>
          )}

          {/* Counter */}
          <div className="absolute bottom-3 left-3 flex items-center gap-2 rounded-full border border-border/50 bg-card/90 px-3 py-1.5 shadow-lg backdrop-blur-md">
            <span className="text-xs font-semibold">
              {selectedIndex + 1} / {allMedia.length}
            </span>
            <div className="h-1.5 w-12 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all duration-300"
                style={{ width: `${((selectedIndex + 1) / allMedia.length) * 100}%` }}
              />
            </div>
          </div>

          {/* Zoom controls */}
          {!isVideo(selectedIndex) && (
            <div className="absolute bottom-3 right-3 flex items-center gap-1.5">
              <Button
                variant="secondary"
                size="icon"
                className="h-8 w-8 rounded-full border border-border/50 bg-card/90 shadow-lg backdrop-blur-md transition-all duration-200 hover:bg-card"
                onClick={onZoomOut}
                disabled={zoom <= 1}
                aria-label="Reduzir"
              >
                <ZoomOut className="h-3.5 w-3.5" />
              </Button>
              {zoom > 1 && (
                <span className="rounded border border-border/50 bg-card/90 px-1.5 py-0.5 text-[10px] font-semibold text-foreground backdrop-blur-md">
                  {Math.round(zoom * 100)}%
                </span>
              )}
              <Button
                variant="secondary"
                size="icon"
                className="h-8 w-8 rounded-full border border-border/50 bg-card/90 shadow-lg backdrop-blur-md transition-all duration-200 hover:bg-card"
                onClick={onZoomIn}
                disabled={zoom >= 4}
                aria-label="Ampliar"
              >
                <ZoomIn className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
        </div>

        {/* Thumbnails strip */}
        {allMedia.length > 1 && (
          <div className="scrollbar-thin flex gap-2 overflow-x-auto border-t border-border/40 px-4 py-3">
            {allMedia.map((media, index) => (
              <button
                key={`thumb-${index}`}
                aria-label={`Ver ${isVideo(index) ? 'vídeo' : 'imagem'} ${index + 1}`}
                onClick={() => onSelectIndex(index)}
                className={cn(
                  'relative h-14 w-14 shrink-0 overflow-hidden rounded-lg transition-all duration-200',
                  selectedIndex === index
                    ? 'ring-2 ring-primary ring-offset-1 ring-offset-card'
                    : 'opacity-50 hover:opacity-100',
                )}
              >
                {isVideo(index) ? (
                  <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-secondary to-muted">
                    <Play className="h-4 w-4 text-foreground" />
                  </div>
                ) : (
                  <OptimizedImage
                    src={getCdnUrl(media, 'thumbnail')}
                    alt={`${productName} - ${index + 1}`}
                    className="object-cover"
                    containerClassName="h-full w-full"
                  />
                )}
              </button>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
