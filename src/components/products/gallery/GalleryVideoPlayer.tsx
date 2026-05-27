/**
 * GalleryVideoPlayer — Dialog para reprodução de vídeos do produto.
 * Usa PromoFlixPlayer (player Netflix-like) quando o vídeo é Cloudflare Stream ou MP4 direto.
 * Mantém iframe para YouTube.
 */

import { useState } from 'react';
import { Play, X } from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import {
  extractCloudflareStreamId,
  getCloudflareHlsUrl,
  getCloudflareThumbnailUrl,
} from '@/utils/cloudflare-stream';
import { PromoFlixPlayer } from './PromoFlixPlayer';

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
  const v = productVideos[activeVideoIndex];

  const cloudflareId = extractCloudflareStreamId(v?.url_stream);
  const hlsUrl = v?.url_hls ?? getCloudflareHlsUrl(v?.url_stream);
  const directUrl = v?.url_original ?? null;
  const youtubeId = v?.source_youtube_id ?? null;

  const posterUrl =
    getCloudflareThumbnailUrl(v?.url_stream, { time: '1s', height: 720 }) ??
    v?.url_thumbnail ??
    null;

  const playerSrc = hlsUrl ?? directUrl;
  const isHls = Boolean(hlsUrl);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full max-w-5xl overflow-hidden border-none bg-black p-0 [&>button.absolute]:hidden">
        <div className="relative w-full">
          {/* Header (apenas para multi-video info + close) */}
          <div className="pointer-events-none absolute left-0 right-0 top-0 z-50 flex items-center justify-between p-4">
            <div className="pointer-events-auto flex items-center gap-2">
              {productVideos.length > 1 && (
                <span className="rounded-full bg-black/60 px-3 py-1 text-xs font-medium text-white/90 backdrop-blur-md">
                  {activeVideoIndex + 1} de {productVideos.length}
                </span>
              )}
            </div>
            <button
              aria-label="Fechar"
              className="pointer-events-auto flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-md transition-colors hover:bg-white/20"
              onClick={() => onOpenChange(false)}
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Player */}
          <div className="w-full bg-black">
            {youtubeId && !cloudflareId ? (
              <div className="aspect-video w-full">
                <iframe
                  src={`https://www.youtube.com/embed/${youtubeId}?autoplay=1&rel=0`}
                  title={v?.title || `Vídeo do produto ${productName}`}
                  className="h-full w-full"
                  allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                  allowFullScreen
                />
              </div>
            ) : playerSrc ? (
              <PromoFlixPlayer
                src={playerSrc}
                isHls={isHls}
                posterUrl={posterUrl}
                title={v?.title || undefined}
                productName={productName}
                autoPlay
              />
            ) : (
              <div className="flex aspect-video w-full items-center justify-center text-sm text-white/60">
                Vídeo indisponível
              </div>
            )}
          </div>

          {/* Multi-video thumbnails */}
          {productVideos.length > 1 && (
            <div className="flex gap-2 overflow-x-auto bg-black/95 p-3">
              {productVideos.map((pv, idx) => {
                const thumbnailUrl =
                  getCloudflareThumbnailUrl(pv.url_stream, { time: '1s', height: 270 }) ??
                  pv.url_thumbnail;
                return (
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
                    {thumbnailUrl ? (
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
                    )}
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Play className="h-5 w-5 fill-white/50 text-primary-foreground drop-shadow-lg" />
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
