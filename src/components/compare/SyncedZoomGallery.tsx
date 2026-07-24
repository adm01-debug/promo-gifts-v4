import { useState, useRef, useCallback, useEffect } from 'react';
import { ZoomIn, ZoomOut, Move, RotateCcw, Maximize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { findMatchingColorIndex } from '@/lib/variant-matching';
import { OptimizedImage } from '@/components/ui/OptimizedImage';
import { getCdnUrl } from '@/utils/image-utils';
import { getProxiedImageUrl } from '@/utils/imageProxy';

interface ProductColor {
  name?: string | null;
  hex?: string | null;
}
interface Product {
  id: string;
  name: string;
  images: string[];
  colors?: ProductColor[];
}

interface SyncedZoomGalleryProps {
  products: Product[];
  onProductClick?: (productId: string) => void;
}

export function SyncedZoomGallery({ products, onProductClick }: SyncedZoomGalleryProps) {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  // Selected color/variant index per slot — drives image swap
  const [selectedColorIdx, setSelectedColorIdx] = useState<Record<string, number>>({});
  const panStartRef = useRef({ x: 0, y: 0 });

  const productKeys = products.map((_, i) => `slot-${i}`);

  useEffect(() => {
    const next: Record<string, number> = {};
    productKeys.forEach((key) => {
      if (!(key in selectedColorIdx)) next[key] = 0;
    });
    if (Object.keys(next).length > 0) {
      setSelectedColorIdx((prev) => ({ ...prev, ...next }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products.length]);

  const handleZoomIn = () => setZoom((prev) => Math.min(prev + 0.25, 4));
  const handleZoomOut = () => {
    setZoom((prev) => {
      const next = Math.max(prev - 0.25, 1);
      if (next === 1) setPan({ x: 0, y: 0 });
      return next;
    });
  };
  const resetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (zoom > 1) {
        e.preventDefault();
        setIsPanning(true);
        panStartRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
      }
    },
    [zoom, pan],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (isPanning && zoom > 1) {
        const newX = e.clientX - panStartRef.current.x;
        const newY = e.clientY - panStartRef.current.y;
        const maxPan = (zoom - 1) * 100;
        setPan({
          x: Math.max(-maxPan, Math.min(maxPan, newX)),
          y: Math.max(-maxPan, Math.min(maxPan, newY)),
        });
      }
    },
    [isPanning, zoom],
  );

  const handleMouseUp = useCallback(() => setIsPanning(false), []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    if (e.deltaY < 0) handleZoomIn();
    else handleZoomOut();
  }, []);

  const handleSliderChange = (value: number[]) => {
    setZoom(value[0]);
    if (value[0] === 1) setPan({ x: 0, y: 0 });
  };

  /**
   * Selects a color in slot `slotIdx` and propagates to OTHER slots by
   * matching color (name or hex distance < 30).
   */
  const selectColor = (slotIdx: number, colorIdx: number) => {
    const sourceProduct = products[slotIdx];
    const sourceColor = sourceProduct.colors?.[colorIdx];
    setSelectedColorIdx((prev) => {
      const next = { ...prev, [`slot-${slotIdx}`]: colorIdx };
      if (sourceColor) {
        products.forEach((p, i) => {
          if (i === slotIdx) return;
          const targetIdx = findMatchingColorIndex(sourceColor, p.colors ?? []);
          if (targetIdx >= 0) next[`slot-${i}`] = targetIdx;
        });
      }
      return next;
    });
  };

  const GalleryContent = ({ inDialog = false }: { inDialog?: boolean }) => (
    <div className={cn('space-y-4', inDialog && 'p-4')}>
      <div className="flex items-center justify-center gap-4 rounded-xl bg-muted/50 p-3 backdrop-blur-sm">
        <Button
          variant="ghost"
          size="icon"
          onClick={handleZoomOut}
          disabled={zoom <= 1}
          className="h-8 w-8"
          aria-label="Reduzir"
        >
          <ZoomOut className="h-4 w-4" />
        </Button>
        <div className="flex w-48 items-center gap-3">
          <Slider
            value={[zoom]}
            min={1}
            max={4}
            step={0.1}
            onValueChange={handleSliderChange}
            className="flex-1"
          />
          <span className="w-12 text-center text-sm font-medium">{Math.round(zoom * 100)}%</span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Ampliar"
          onClick={handleZoomIn}
          disabled={zoom >= 4}
          className="h-8 w-8"
        >
          <ZoomIn className="h-4 w-4" />
        </Button>
        <div className="h-6 w-px bg-border" />
        <Button
          variant="ghost"
          size="icon"
          onClick={resetView}
          disabled={zoom === 1 && pan.x === 0 && pan.y === 0}
          className="h-8 w-8"
          aria-label="Resetar"
        >
          <RotateCcw className="h-4 w-4" />
        </Button>
        {!inDialog && (
          <>
            <div className="h-6 w-px bg-border" />
            <Button
              variant="ghost"
              size="icon"
              aria-label="Maximizar"
              onClick={() => setIsFullscreen(true)}
              className="h-8 w-8"
            >
              <Maximize2 className="h-4 w-4" />
            </Button>
          </>
        )}
        {zoom > 1 && (
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Move className="h-3 w-3" /> Arraste para mover
          </span>
        )}
      </div>

      <div
        className={cn(
          'grid gap-4',
          products.length === 2 && 'grid-cols-2',
          products.length === 3 && 'grid-cols-3',
          products.length >= 4 && 'grid-cols-2 lg:grid-cols-4',
        )}
      >
        {products.map((product, slotIdx) => {
          const slotKey = productKeys[slotIdx];
          const colorIdx = selectedColorIdx[slotKey] ?? 0;
          const currentImage =
            product.images[Math.min(colorIdx, product.images.length - 1)] ?? product.images[0];
          const colors = product.colors ?? [];
          return (
            <div key={slotKey} className="space-y-3">
              <h3
                className="cursor-pointer truncate text-center font-display text-sm font-medium transition-colors hover:text-primary"
                onClick={() => onProductClick?.(product.id)}
              >
                {product.name}
              </h3>
              <div
                className={cn(
                  'relative aspect-square overflow-hidden rounded-xl border border-border bg-secondary/30',
                  zoom > 1 && 'cursor-grab',
                  isPanning && 'cursor-grabbing',
                )}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onWheel={handleWheel}
              >
                <img
                  src={getCdnUrl(currentImage, 'large')}
                  alt={product.name}
                  className="h-full w-full select-none object-contain transition-transform duration-100"
                  style={{
                    transform: `scale(${zoom}) translate(${pan.x / zoom}px, ${pan.y / zoom}px)`,
                  }}
                  draggable={false}
                  loading="lazy"
                />
              </div>

              {/* Color swatches — synced across products */}
              {colors.length > 1 && (
                <div className="flex flex-wrap justify-center gap-1.5">
                  {colors.slice(0, 8).map((c, idx) => (
                    <button
                      key={idx}
                      type="button"
                      title={c.name ?? ''}
                      onClick={() => selectColor(slotIdx, idx)}
                      className={cn(
                        'h-6 w-6 rounded-full border-2 transition-all',
                        colorIdx === idx
                          ? 'scale-110 border-primary ring-2 ring-primary/30'
                          : 'border-border hover:scale-105',
                      )}
                      style={{ backgroundColor: c.hex ?? '#ccc' }}
                      aria-label={`Selecionar cor ${c.name ?? idx + 1}`}
                    />
                  ))}
                  {colors.length > 8 && (
                    <span className="self-center text-xs text-muted-foreground">
                      +{colors.length - 8}
                    </span>
                  )}
                </div>
              )}

              {/* Image thumbnails (when no colors) */}
              {colors.length <= 1 && product.images.length > 1 && (
                <div className="flex justify-center gap-1.5 overflow-x-auto pb-1">
                  {product.images.slice(0, 5).map((img, idx) => (
                    <button
                      key={idx}
                      onClick={() => setSelectedColorIdx((prev) => ({ ...prev, [slotKey]: idx }))}
                      className={cn(
                        'h-10 w-10 shrink-0 overflow-hidden rounded-md transition-all',
                        colorIdx === idx
                          ? 'ring-2 ring-primary ring-offset-1 ring-offset-background'
                          : 'opacity-60 hover:opacity-100',
                      )}
                    >
                      <OptimizedImage
                        src={getCdnUrl(img, 'thumbnail')}
                        urlOriginal={getProxiedImageUrl(img) ?? null}
                        alt={`${product.name} - ${idx + 1}`}
                        className="object-cover"
                        containerClassName="h-full w-full"
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <>
      <GalleryContent />
      <Dialog open={isFullscreen} onOpenChange={setIsFullscreen}>
        <DialogContent className="bg-background/98 h-full max-h-[95vh] w-full max-w-[95vw] border-none p-0 backdrop-blur-xl">
          <div className="h-full w-full overflow-auto">
            <GalleryContent inDialog />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
