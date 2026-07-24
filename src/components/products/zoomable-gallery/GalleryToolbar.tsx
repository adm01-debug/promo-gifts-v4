import { Button } from '@/components/ui/button';
import { ZoomIn, ZoomOut, RotateCcw, Grid3X3, Share2, Download, X } from 'lucide-react';

interface GalleryToolbarProps {
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onRotate: () => void;
  onReset: () => void;
  onClose: () => void;
  onShare?: () => void;
  onDownload?: () => void;
}

export function GalleryToolbar({
  zoom,
  onZoomIn,
  onZoomOut,
  onRotate,
  onReset,
  onClose,
  onShare,
  onDownload,
}: GalleryToolbarProps) {
  return (
    <div className="absolute left-0 right-0 top-0 z-50 flex items-center justify-between bg-gradient-to-b from-background/80 to-transparent p-4">
      <div className="flex items-center gap-2">
        <Button
          variant="secondary"
          size="icon"
          className="h-10 w-10 rounded-full bg-card/90 shadow-lg"
          onClick={onZoomOut}
          disabled={zoom <= 1}
          aria-label="Reduzir"
        >
          <ZoomOut className="h-4 w-4" />
        </Button>
        <div className="min-w-[60px] rounded-full bg-card/90 px-3 py-1.5 text-center text-sm font-medium">
          {Math.round(zoom * 100)}%
        </div>
        <Button
          variant="secondary"
          size="icon"
          className="h-10 w-10 rounded-full bg-card/90 shadow-lg"
          onClick={onZoomIn}
          disabled={zoom >= 5}
          aria-label="Ampliar"
        >
          <ZoomIn className="h-4 w-4" />
        </Button>
        <Button
          variant="secondary"
          size="icon"
          className="h-10 w-10 rounded-full bg-card/90 shadow-lg"
          onClick={onRotate}
          aria-label="Rotacionar"
        >
          <RotateCcw className="h-4 w-4" />
        </Button>
        <Button
          variant="secondary"
          size="icon"
          className="h-10 w-10 rounded-full bg-card/90 shadow-lg"
          onClick={onReset}
          aria-label="Reset"
        >
          <Grid3X3 className="h-4 w-4" />
        </Button>
      </div>
      <div className="flex items-center gap-2">
        {onShare && (
          <Button
            variant="secondary"
            size="icon"
            className="h-10 w-10 rounded-full bg-card/90 shadow-lg"
            onClick={onShare}
            aria-label="Compartilhar"
          >
            <Share2 className="h-4 w-4" />
          </Button>
        )}
        {onDownload && (
          <Button
            variant="secondary"
            size="icon"
            className="h-10 w-10 rounded-full bg-card/90 shadow-lg"
            onClick={onDownload}
            aria-label="Download"
          >
            <Download className="h-4 w-4" />
          </Button>
        )}
        <Button
          variant="secondary"
          size="icon"
          className="h-10 w-10 rounded-full bg-card/90 shadow-lg"
          onClick={onClose}
          aria-label="Fechar"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
