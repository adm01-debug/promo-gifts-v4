/**
 * GalleryVideoPlayer — Dialog para reprodução de vídeos do produto
 */

import { useState } from 'react';
import { Play, X } from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { getCloudflareEmbedUrl, getCloudflareThumbnailUrl } from '@/utils/cloudflare-stream';

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

interface GalleryVideoPlayerProps {
  productVideos: ProductVideo[];
  productName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function GalleryVideoPlayer({
  productVideos,
  productName,
  open,
  onOpenChange,
}: GalleryVideoPlayerProps) {
  const [activeVideoIndex, setActiveVideoIndex] = useState(0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full max-w-4xl overflow-hidden border-none bg-black p-0 [&>button.absolute]:hidden">
        <div className="relative w-full">
          {/* Header */}
          <div className="absolute left-0 right-0 top-0 z-50 flex items-center justify-between bg-gradient-to-b from-black/80 to-transparent p-4">
            <div className="flex items-center gap-2">
              {productVideos.length > 1 && (
                <span className="text-sm font-medium text-primary-foreground/80">
                  Vídeo {activeVideoIndex + 1} de {productVideos.length}
                </span>
              )}
              {productVideos[activeVideoIndex]?.title && (
                <span className="text-sm text-primary-foreground/60">
                  — {productVideos[activeVideoIndex].title}
                </span>
              )}
            </div>
            <button
              aria-label="Fechar"
              className="flex h-9 w-9 items-center justify-center rounded-full text-white transition-colors hover:bg-white/20"
              onClick={() => onOpenChange(false)}
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Video player */}
          <div className="aspect-video w-full bg-black">
            {(() => {
              const v = productVideos[activeVideoIndex];
              const posterUrl =
                getCloudflareThumbnailUrl(v?.url_stream, { time: '1s', height: 720 }) ??
                v?.url_thumbnail ??
                null;
              const embedUrl = getCloudflareEmbedUrl(v?.url_stream, {
                autoplay: true,
                poster: posterUrl,
              });
              if (!embedUrl) return null;
              return (
                <iframe
                  src={embedUrl}
                  title={v?.title || `Vídeo do produto ${productName}`}
                  className="h-full w-full"
                  allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              );
            })()}
          </div>

          {/* Multi-video thumbnails */}
          {productVideos.length > 1 && (
            <div className="flex gap-2 overflow-x-auto bg-black/95 p-3">
              {productVideos.map((pv, idx) => (
                <button
                  key={pv.id}
                  onClick={() => setActiveVideoIndex(idx)}
                  className={cn(
                    'relative aspect-video w-24 shrink-0 overflow-hidden rounded-lg transition-all duration-200',
                    activeVideoIndex === idx
                      ? 'scale-105 ring-2 ring-primary'
                      : 'opacity-60 hover:opacity-100',
                  )}
                >
                  {(() => {
                    const thumbnailUrl =
                      getCloudflareThumbnailUrl(pv.url_stream, { time: '1s', height: 270 }) ??
                      pv.url_thumbnail;
                    return thumbnailUrl ? (
                      <img
                        src={thumbnailUrl}
                        alt={pv.title || `Vídeo ${idx + 1}`}
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-muted">
                        <Play className="h-4 w-4 text-foreground" />
                      </div>
                    );
                  })()}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Play className="h-5 w-5 fill-white/50 text-primary-foreground drop-shadow-lg" />
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
