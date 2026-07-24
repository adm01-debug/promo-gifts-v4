/**
 * ZoomableGallery — Refactored orchestrator
 * Hook + sub-components extracted.
 */
import { useState, useRef, useCallback } from 'react';
import { m as motion, AnimatePresence, type PanInfo } from 'framer-motion';
import { Maximize2, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { useGalleryZoom } from './zoomable-gallery/useGalleryZoom';
import { GalleryToolbar } from './zoomable-gallery/GalleryToolbar';
import { GalleryThumbnails, FullscreenThumbnails } from './zoomable-gallery/GalleryThumbnails';

interface ZoomableGalleryProps {
  images: string[];
  productName: string;
  className?: string;
  onShare?: (imageUrl: string) => void;
  onDownload?: (imageUrl: string) => void;
}

export function ZoomableGallery({
  images,
  productName,
  className,
  onShare,
  onDownload,
}: ZoomableGalleryProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showThumbnails, setShowThumbnails] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);

  const g = useGalleryZoom(images, isFullscreen);

  const handlePan = (_event: MouseEvent | PointerEvent | TouchEvent, info: PanInfo) => {
    if (g.zoom > 1) {
      const maxOffset = (g.zoom - 1) * 100;
      g.x.set(Math.max(-maxOffset, Math.min(maxOffset, g.x.get() + info.delta.x)));
      g.y.set(Math.max(-maxOffset, Math.min(maxOffset, g.y.get() + info.delta.y)));
    }
  };

  const ImageViewer = useCallback(
    ({ fullscreen = false }: { fullscreen?: boolean }) => (
      <motion.div
        ref={containerRef}
        className={cn(
          'relative overflow-hidden',
          fullscreen ? 'h-full w-full' : 'aspect-square rounded-2xl',
        )}
        onWheel={g.handleWheel}
      >
        <motion.img
          src={images[g.currentIndex]}
          alt={`${productName} - ${g.currentIndex + 1}`}
          className={cn(
            'h-full w-full select-none object-contain',
            g.zoom > 1 ? 'cursor-grab active:cursor-grabbing' : 'cursor-zoom-in',
          )}
          style={{ scale: g.scale, x: g.x, y: g.y, rotate: g.rotation }}
          drag={g.zoom > 1}
          dragConstraints={{ left: -100, right: 100, top: -100, bottom: 100 }}
          dragElastic={0.1}
          onPan={handlePan}
          onTap={g.handleTap}
          draggable={false}
        />
        <AnimatePresence>
          {g.zoom > 1 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="absolute left-4 top-4 rounded-full bg-card/90 px-3 py-1.5 text-sm font-medium shadow-lg backdrop-blur-sm"
            >
              {Math.round(g.zoom * 100)}%
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      g.currentIndex,
      g.zoom,
      g.rotation,
      g.scale,
      g.x,
      g.y,
      g.handleWheel,
      g.handleTap,
      images,
      productName,
    ],
  );

  return (
    <>
      <div className={cn('space-y-4', className)}>
        <div className="group relative">
          <div className="overflow-hidden rounded-2xl border border-border/50 shadow-lg transition-shadow group-hover:shadow-xl">
            <ImageViewer />
          </div>
          {images.length > 1 && (
            <>
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  'absolute left-2 top-1/2 h-12 w-12 -translate-y-1/2 rounded-full',
                  'border-0 bg-black/30 text-primary-foreground/80 backdrop-blur-sm transition-all duration-200 hover:bg-black/50 hover:text-primary-foreground',
                )}
                onClick={g.goToPrevious}
                aria-label="Voltar"
              >
                <ChevronLeft className="h-6 w-6" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  'absolute right-2 top-1/2 h-12 w-12 -translate-y-1/2 rounded-full',
                  'border-0 bg-black/30 text-primary-foreground/80 backdrop-blur-sm transition-all duration-200 hover:bg-black/50 hover:text-primary-foreground',
                )}
                onClick={g.goToNext}
                aria-label="Avançar"
              >
                <ChevronRight className="h-6 w-6" />
              </Button>
            </>
          )}
          <div
            className={cn(
              'absolute bottom-4 right-4 flex gap-2',
              'opacity-0 transition-opacity group-hover:opacity-100',
            )}
          >
            <Button
              variant="secondary"
              size="icon"
              aria-label="Maximizar"
              className="h-9 w-9 rounded-full bg-card/90 shadow-lg backdrop-blur-sm"
              onClick={() => setIsFullscreen(true)}
            >
              <Maximize2 className="h-4 w-4" />
            </Button>
          </div>
          {images.length > 1 && (
            <div
              className={cn(
                'absolute bottom-4 left-4 rounded-full px-3 py-1.5',
                'bg-card/90 text-sm font-medium shadow-lg backdrop-blur-sm',
              )}
            >
              {g.currentIndex + 1} / {images.length}
            </div>
          )}
        </div>
        {images.length > 1 && (
          <GalleryThumbnails
            images={images}
            currentIndex={g.currentIndex}
            onSelect={g.setCurrentIndex}
          />
        )}
      </div>

      <Dialog open={isFullscreen} onOpenChange={setIsFullscreen}>
        <DialogContent className="bg-background/98 h-screen max-h-[100vh] w-screen max-w-[100vw] p-0 backdrop-blur-xl">
          <div className="relative flex h-full w-full flex-col">
            <GalleryToolbar
              zoom={g.zoom}
              onZoomIn={g.handleZoomIn}
              onZoomOut={g.handleZoomOut}
              onRotate={g.handleRotate}
              onReset={g.resetView}
              onClose={() => setIsFullscreen(false)}
              onShare={onShare ? () => onShare(images[g.currentIndex]) : undefined}
              onDownload={onDownload ? () => onDownload(images[g.currentIndex]) : undefined}
            />
            <div className="flex flex-1 items-center justify-center p-16">
              <ImageViewer fullscreen />
            </div>
            {images.length > 1 && (
              <>
                <Button
                  variant="secondary"
                  size="icon"
                  className="absolute left-4 top-1/2 h-12 w-12 -translate-y-1/2 rounded-full bg-card/90 shadow-lg"
                  onClick={g.goToPrevious}
                  aria-label="Voltar"
                >
                  <ChevronLeft className="h-6 w-6" />
                </Button>
                <Button
                  variant="secondary"
                  size="icon"
                  className="absolute right-4 top-1/2 h-12 w-12 -translate-y-1/2 rounded-full bg-card/90 shadow-lg"
                  onClick={g.goToNext}
                  aria-label="Avançar"
                >
                  <ChevronRight className="h-6 w-6" />
                </Button>
              </>
            )}
            <AnimatePresence>
              {showThumbnails && images.length > 1 && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 20 }}
                  className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-background/80 to-transparent p-4"
                >
                  <FullscreenThumbnails
                    images={images}
                    currentIndex={g.currentIndex}
                    onSelect={g.setCurrentIndex}
                  />
                </motion.div>
              )}
            </AnimatePresence>
            <Button
              variant="ghost"
              size="sm"
              className="absolute bottom-4 right-4 rounded-full"
              onClick={() => setShowThumbnails(!showThumbnails)}
            >
              {showThumbnails ? 'Ocultar' : 'Mostrar'} miniaturas
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
