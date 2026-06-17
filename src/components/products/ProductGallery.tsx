import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Play, Maximize2 } from 'lucide-react';
import { m as motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { getCdnUrl } from '@/utils/image-utils';
import { GalleryFullscreen } from './gallery/GalleryFullscreen';
import { GalleryVideoPlayer } from './gallery/GalleryVideoPlayer';
import { GalleryColorVariations } from './gallery/GalleryColorVariations';

interface ProductVideo {
  id: string;
  url_stream: string | null;
  url_hls: string | null;
  url_thumbnail: string | null;
  url_original: string | null;
  source_youtube_id: string | null;
  video_type: string | null;
  display_order: number;
  is_primary: boolean;
  title: string | null;
}

interface ColorMedia {
  name: string;
  hex: string;
  sku?: string;
  stock?: number;
  image?: string;
  images?: string[];
  videos?: string[];
}

interface ProductGalleryProps {
  images: string[];
  video?: string;
  videos?: string[];
  productVideos?: ProductVideo[];
  productName: string;
  colors?: ColorMedia[];
  onColorSelect?: (colorIndex: number) => void;
  selectedColorIndex?: number;
  /** Dados de venda para compartilhamento do vídeo via WhatsApp */
  productId?: string | null;
  productPrice?: number | null;
  productSku?: string | null;
  productMinQuantity?: number | null;
  shareUrl?: string | null;
}

export function ProductGallery({
  images,
  video,
  videos = [],
  productVideos = [],
  productName,
  colors,
  onColorSelect,
  selectedColorIndex = 0,
  productId,
  productPrice,
  productSku,
  productMinQuantity,
  shareUrl,
}: ProductGalleryProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isVideoPlayerOpen, setIsVideoPlayerOpen] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [isImageLoading, setIsImageLoading] = useState(true);
  const [isAnimating, setIsAnimating] = useState(false);
  const panStartRef = useRef({ x: 0, y: 0 });

  const hasProductVideos = productVideos.length > 0;
  const selectedColor = colors?.[selectedColorIndex];

  const displayImages = useMemo(
    () =>
      selectedColor?.images?.length
        ? selectedColor.images
        : selectedColor?.image
          ? [selectedColor.image]
          : images,
    [selectedColor, images],
  );

  const displayVideos = useMemo(
    () =>
      selectedColor?.videos?.length ? selectedColor.videos : video ? [video, ...videos] : videos,
    [selectedColor, video, videos],
  );

  const allMedia = useMemo(
    () => [...displayImages, ...displayVideos],
    [displayImages, displayVideos],
  );
  const isVideo = useCallback(
    (index: number) => index >= displayImages.length,
    [displayImages.length],
  );

  const resetZoom = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  useEffect(() => {
    setSelectedIndex(0);
    resetZoom();
  }, [selectedColorIndex, resetZoom]);
  useEffect(() => {
    setIsImageLoading(true);
  }, [selectedIndex]);

  const goToPrevious = useCallback(() => {
    setIsAnimating(true);
    setSelectedIndex((prev) => (prev === 0 ? allMedia.length - 1 : prev - 1));
    resetZoom();
    setTimeout(() => setIsAnimating(false), 400);
  }, [allMedia.length, resetZoom]);

  const goToNext = useCallback(() => {
    setIsAnimating(true);
    setSelectedIndex((prev) => (prev === allMedia.length - 1 ? 0 : prev + 1));
    resetZoom();
    setTimeout(() => setIsAnimating(false), 400);
  }, [allMedia.length, resetZoom]);

  const handleZoomIn = () => setZoom((prev) => Math.min(prev + 0.5, 4));
  const handleZoomOut = () =>
    setZoom((prev) => {
      const n = Math.max(prev - 0.5, 1);
      if (n === 1) setPan({ x: 0, y: 0 });
      return n;
    });

  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoom > 1) {
      setIsPanning(true);
      panStartRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
    }
  };
  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning && zoom > 1) {
      const maxPan = (zoom - 1) * 150;
      setPan({
        x: Math.max(-maxPan, Math.min(maxPan, e.clientX - panStartRef.current.x)),
        y: Math.max(-maxPan, Math.min(maxPan, e.clientY - panStartRef.current.y)),
      });
    }
  };
  const handleMouseUp = () => setIsPanning(false);
  const handleWheel = (e: React.WheelEvent) => {
    if (isFullscreen) {
      e.preventDefault();
      if (e.deltaY < 0) {
        handleZoomIn();
      } else {
        handleZoomOut();
      }
    }
  };

  const handleColorSelect = useCallback(
    (index: number) => {
      setSelectedIndex(0);
      resetZoom();
      onColorSelect?.(index);
    },
    [resetZoom, onColorSelect],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowLeft') goToPrevious();
      if (e.key === 'ArrowRight') goToNext();
      if (e.key === 'Escape') setIsFullscreen(false);
      if (e.key === '+' || e.key === '=') handleZoomIn();
      if (e.key === '-') handleZoomOut();
    },
    [goToPrevious, goToNext],
  );

  const handleSelectIndex = (index: number) => {
    setIsAnimating(true);
    setSelectedIndex(index);
    resetZoom();
    setTimeout(() => setIsAnimating(false), 400);
  };

  return (
    <div className="space-y-4" onKeyDown={handleKeyDown} tabIndex={0}>
      {/* Main image */}
      <div className="group relative">
        <div className="absolute -inset-4 rounded-3xl bg-gradient-to-br from-primary/5 via-transparent to-primary/5 opacity-0 blur-xl transition-opacity duration-700 group-hover:opacity-100" />
        <div className="relative overflow-hidden rounded-2xl border border-border/30 shadow-lg transition-all duration-500 group-hover:border-primary/20 group-hover:shadow-2xl group-hover:shadow-primary/10">
          {/* Image view inline */}
          <div
            className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-white"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onWheel={handleWheel}
          >
            {!isVideo(selectedIndex) && <div className="absolute inset-0 bg-white" />}
            <AnimatePresence mode="wait">
              {isVideo(selectedIndex) ? (
                <motion.video
                  key={allMedia[selectedIndex]}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  src={allMedia[selectedIndex]}
                  controls
                  className="h-full w-full object-contain"
                  poster={displayImages[0]}
                />
              ) : (
                <motion.div
                  key={allMedia[selectedIndex]}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.3 }}
                  className="h-full w-full"
                  drag="x"
                  dragConstraints={{ left: 0, right: 0 }}
                  dragElastic={0.2}
                  onDragEnd={(_e, info) => {
                    if (info.offset.x < -50) goToNext();
                    else if (info.offset.x > 50) goToPrevious();
                  }}
                >
                  <img
                    src={getCdnUrl(allMedia[selectedIndex], 'large')}
                    alt={`${productName} - Imagem ${selectedIndex + 1}`}
                    className={cn(
                      'h-full w-full object-contain transition-all duration-700 ease-out',
                      zoom > 1 && 'cursor-grab',
                      isPanning && 'cursor-grabbing',
                      isAnimating && 'scale-95 opacity-80',
                      isImageLoading
                        ? 'scale-105 opacity-40 blur-md'
                        : 'scale-100 opacity-100 blur-0',
                    )}
                    style={{
                      transform: `scale(${zoom}) translate(${pan.x / zoom}px, ${pan.y / zoom}px)`,
                    }}
                    draggable={false}
                    onLoad={() => setIsImageLoading(false)}
                    onError={(e) => {
                      const img = e.currentTarget;
                      if (!img.dataset.fallback) {
                        img.dataset.fallback = '1';
                        img.src = '/placeholder.svg';
                        setIsImageLoading(false);
                      }
                    }}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Play button */}
          {hasProductVideos && (
            <button
              onClick={() => setIsVideoPlayerOpen(true)}
              className={cn(
                'absolute right-4 top-4 z-20 flex animate-fade-in items-center gap-2 rounded-full bg-destructive px-3 py-2 text-destructive-foreground shadow-xl transition-all duration-300 hover:scale-105 hover:bg-destructive/90 hover:shadow-2xl',
              )}
            >
              <Play className="h-4 w-4 fill-white" />
              <span className="text-xs font-semibold">
                {productVideos.length > 1 ? `${productVideos.length} vídeos` : 'Vídeo'}
              </span>
            </button>
          )}

          {/* Nav arrows */}
          {allMedia.length > 1 && (
            <>
              <Button
                variant="secondary"
                size="icon"
                className={cn(
                  'absolute left-4 top-1/2 h-12 w-12 -translate-x-2 -translate-y-1/2 rounded-full border border-border/50 bg-card/95 opacity-0 shadow-xl backdrop-blur-md transition-all duration-300 hover:scale-110 hover:bg-card hover:shadow-2xl group-hover:translate-x-0 group-hover:opacity-100',
                )}
                onClick={goToPrevious}
                aria-label="Voltar"
              >
                <ChevronLeft className="h-6 w-6" />
              </Button>
              <Button
                variant="secondary"
                size="icon"
                className={cn(
                  'absolute right-4 top-1/2 h-12 w-12 -translate-y-1/2 translate-x-2 rounded-full border border-border/50 bg-card/95 opacity-0 shadow-xl backdrop-blur-md transition-all duration-300 hover:scale-110 hover:bg-card hover:shadow-2xl group-hover:translate-x-0 group-hover:opacity-100',
                )}
                onClick={goToNext}
                aria-label="Avançar"
              >
                <ChevronRight className="h-6 w-6" />
              </Button>
            </>
          )}

          {/* Controls */}
          <div
            className={cn(
              'absolute bottom-4 right-4 flex translate-y-2 gap-2 opacity-0 transition-all delay-100 duration-300 group-hover:translate-y-0 group-hover:opacity-100',
            )}
          >
            <Button
              variant="secondary"
              size="icon"
              aria-label="Maximizar"
              className="h-10 w-10 rounded-full border border-border/50 bg-card/95 shadow-xl backdrop-blur-md transition-all duration-200 hover:scale-110 hover:bg-card"
              onClick={() => setIsFullscreen(true)}
            >
              <Maximize2 className="h-4 w-4" />
            </Button>
          </div>

          {/* Counter */}
          <div
            className={cn(
              'absolute bottom-4 left-4 translate-y-2 opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100',
            )}
          >
            <div className="flex items-center gap-2 rounded-full border border-border/50 bg-card/95 px-3 py-2 shadow-xl backdrop-blur-md">
              <span className="text-sm font-medium">
                {selectedIndex + 1} / {allMedia.length}
              </span>
              <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-300"
                  style={{ width: `${((selectedIndex + 1) / allMedia.length) * 100}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Color Variations */}
      {colors && colors.length > 0 && (
        <GalleryColorVariations
          colors={colors}
          selectedColorIndex={selectedColorIndex}
          onColorSelect={handleColorSelect}
        />
      )}

      {/* Fullscreen Dialog */}
      <GalleryFullscreen
        open={isFullscreen}
        onOpenChange={setIsFullscreen}
        allMedia={allMedia}
        selectedIndex={selectedIndex}
        productName={productName}
        imageCount={displayImages.length}
        isVideo={isVideo}
        zoom={zoom}
        pan={pan}
        isPanning={isPanning}
        isImageLoading={isImageLoading}
        isAnimating={isAnimating}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onResetZoom={resetZoom}
        onGoNext={goToNext}
        onGoPrevious={goToPrevious}
        onSelectIndex={handleSelectIndex}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onWheel={handleWheel}
        onKeyDown={handleKeyDown}
      />

      {/* Video Player Dialog */}
      <GalleryVideoPlayer
        productVideos={productVideos}
        productName={productName}
        open={isVideoPlayerOpen}
        onOpenChange={setIsVideoPlayerOpen}
        productId={productId}
        productPrice={productPrice}
        productSku={productSku}
        productMinQuantity={productMinQuantity}
        shareUrl={shareUrl}
      />
    </div>
  );
}
