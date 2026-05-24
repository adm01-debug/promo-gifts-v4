import { useState, useRef, useCallback, useEffect } from "react";
import { ChevronLeft, ChevronRight, Play, Maximize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getCdnUrl } from "@/utils/image-utils";
import { GalleryFullscreen } from "./gallery/GalleryFullscreen";
import { GalleryVideoPlayer } from "./gallery/GalleryVideoPlayer";
import { GalleryColorVariations } from "./gallery/GalleryColorVariations";

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
}

export function ProductGallery({ 
  images, video, videos = [], productVideos = [], productName, 
  colors, onColorSelect, selectedColorIndex = 0
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
  
  const displayImages = selectedColor?.images?.length 
    ? selectedColor.images 
    : selectedColor?.image ? [selectedColor.image] : images;
  
  const displayVideos = selectedColor?.videos?.length 
    ? selectedColor.videos 
    : video ? [video, ...videos] : videos;

  const allMedia = [...displayImages, ...displayVideos];
  const isVideo = useCallback((index: number) => index >= displayImages.length, [displayImages.length]);

  const resetZoom = useCallback(() => { setZoom(1); setPan({ x: 0, y: 0 }); }, []);

  useEffect(() => { setSelectedIndex(0); resetZoom(); }, [selectedColorIndex, resetZoom]);
  useEffect(() => { setIsImageLoading(true); }, [selectedIndex]);

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
  const handleZoomOut = () => setZoom((prev) => { const n = Math.max(prev - 0.5, 1); if (n === 1) setPan({ x: 0, y: 0 }); return n; });

  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoom > 1) { setIsPanning(true); panStartRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y }; }
  };
  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning && zoom > 1) {
      const maxPan = (zoom - 1) * 150;
      setPan({ x: Math.max(-maxPan, Math.min(maxPan, e.clientX - panStartRef.current.x)), y: Math.max(-maxPan, Math.min(maxPan, e.clientY - panStartRef.current.y)) });
    }
  };
  const handleMouseUp = () => setIsPanning(false);
  const handleWheel = (e: React.WheelEvent) => { if (isFullscreen) { e.preventDefault(); e.deltaY < 0 ? handleZoomIn() : handleZoomOut(); } };

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "ArrowLeft") goToPrevious();
    if (e.key === "ArrowRight") goToNext();
    if (e.key === "Escape") setIsFullscreen(false);
    if (e.key === "+" || e.key === "=") handleZoomIn();
    if (e.key === "-") handleZoomOut();
  }, [goToPrevious, goToNext]);

  const handleSelectIndex = (index: number) => {
    setIsAnimating(true);
    setSelectedIndex(index);
    resetZoom();
    setTimeout(() => setIsAnimating(false), 400);
  };

  return (
    <div className="space-y-4" onKeyDown={handleKeyDown} tabIndex={0}>
      {/* Main image */}
      <div className="relative group">
        <div className="absolute -inset-4 bg-gradient-to-br from-primary/5 via-transparent to-primary/5 rounded-3xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
        <div className="relative rounded-2xl overflow-hidden shadow-lg border border-border/30 group-hover:shadow-2xl group-hover:shadow-primary/10 group-hover:border-primary/20 transition-all duration-500">
          {/* Image view inline */}
          <div className="relative overflow-hidden aspect-[4/3] rounded-2xl bg-white"
            onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp} onWheel={handleWheel}
          >
            {!isVideo(selectedIndex) && <div className="absolute inset-0 bg-white" />}
            {isVideo(selectedIndex) ? (
              <video src={allMedia[selectedIndex]} controls className="w-full h-full object-contain animate-fade-in" poster={displayImages[0]} />
            ) : (
              <img
                src={getCdnUrl(allMedia[selectedIndex], 'large')}
                alt={`${productName} - Imagem ${selectedIndex + 1}`} title={productName}
                className={cn(
                  "w-full h-full object-contain transition-all duration-700 ease-out",
                  zoom > 1 && "cursor-grab", isPanning && "cursor-grabbing",
                  isAnimating && "scale-95 opacity-80",
                  isImageLoading ? "opacity-40 blur-md scale-105" : "opacity-100 blur-0 scale-100"
                )}
                style={{ transform: `scale(${zoom}) translate(${pan.x / zoom}px, ${pan.y / zoom}px)` }}
                draggable={false}
                onLoad={() => setIsImageLoading(false)}
                onError={(e) => { const img = e.currentTarget; if (!img.dataset.fallback) { img.dataset.fallback = '1'; img.src = allMedia[selectedIndex]; } }}
              />
            )}
          </div>

          {/* Play button */}
          {hasProductVideos && (
            <button onClick={() => setIsVideoPlayerOpen(true)}
              className={cn("absolute top-4 right-4 z-20 flex items-center gap-2 px-3 py-2 rounded-full bg-destructive hover:bg-destructive/90 text-destructive-foreground shadow-xl hover:shadow-2xl hover:scale-105 transition-all duration-300 animate-fade-in")}
            >
              <Play className="h-4 w-4 fill-white" />
              <span className="text-xs font-semibold">{productVideos.length > 1 ? `${productVideos.length} vídeos` : 'Vídeo'}</span>
            </button>
          )}

          {/* Nav arrows */}
          {allMedia.length > 1 && (
            <>
              <Button variant="secondary" size="icon"
                className={cn("absolute left-4 top-1/2 -translate-y-1/2 h-12 w-12 rounded-full bg-card/95 backdrop-blur-md shadow-xl border border-border/50 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 hover:bg-card hover:scale-110 hover:shadow-2xl transition-all duration-300")}
                onClick={goToPrevious} aria-label="Voltar"
              ><ChevronLeft className="h-6 w-6" /></Button>
              <Button variant="secondary" size="icon"
                className={cn("absolute right-4 top-1/2 -translate-y-1/2 h-12 w-12 rounded-full bg-card/95 backdrop-blur-md shadow-xl border border-border/50 opacity-0 translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 hover:bg-card hover:scale-110 hover:shadow-2xl transition-all duration-300")}
                onClick={goToNext} aria-label="Avançar"
              ><ChevronRight className="h-6 w-6" /></Button>
            </>
          )}

          {/* Controls */}
          <div className={cn("absolute bottom-4 right-4 flex gap-2 opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-300 delay-100")}>
            <Button variant="secondary" size="icon" aria-label="Maximizar"
              className="h-10 w-10 rounded-full bg-card/95 backdrop-blur-md shadow-xl border border-border/50 hover:bg-card hover:scale-110 transition-all duration-200"
              onClick={() => setIsFullscreen(true)}
            ><Maximize2 className="h-4 w-4" /></Button>
          </div>

          {/* Counter */}
          <div className={cn("absolute bottom-4 left-4 opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-300")}>
            <div className="flex items-center gap-2 px-3 py-2 rounded-full bg-card/95 backdrop-blur-md shadow-xl border border-border/50">
              <span className="text-sm font-medium">{selectedIndex + 1} / {allMedia.length}</span>
              <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-primary rounded-full transition-all duration-300" style={{ width: `${((selectedIndex + 1) / allMedia.length) * 100}%` }} />
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
          onColorSelect={(index) => { setSelectedIndex(0); resetZoom(); onColorSelect?.(index); }}
        />
      )}

      {/* Fullscreen Dialog */}
      <GalleryFullscreen
        open={isFullscreen} onOpenChange={setIsFullscreen}
        allMedia={allMedia} selectedIndex={selectedIndex} productName={productName}
        imageCount={displayImages.length} isVideo={isVideo}
        zoom={zoom} pan={pan} isPanning={isPanning} isImageLoading={isImageLoading} isAnimating={isAnimating}
        onZoomIn={handleZoomIn} onZoomOut={handleZoomOut} onResetZoom={resetZoom}
        onGoNext={goToNext} onGoPrevious={goToPrevious} onSelectIndex={handleSelectIndex}
        onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp}
        onWheel={handleWheel} onKeyDown={handleKeyDown}
      />

      {/* Video Player Dialog */}
      <GalleryVideoPlayer
        productVideos={productVideos} productName={productName}
        open={isVideoPlayerOpen} onOpenChange={setIsVideoPlayerOpen}
      />
    </div>
  );
}
