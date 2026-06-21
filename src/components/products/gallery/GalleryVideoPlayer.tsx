/**
 * GalleryVideoPlayer — Dialog para reprodução de vídeos do produto.
 * Usa PromoFlixPlayer (player Netflix-like) quando o vídeo é Cloudflare Stream ou MP4 direto.
 * Mantém iframe para YouTube.
 */

import { useEffect, useState } from 'react';
import { Play, X } from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import {
  extractCloudflareStreamId,
  getCloudflareHlsUrl,
  getCloudflareThumbnailUrl,
} from '@/utils/cloudflare-stream';
import { PromoFlixPlayer } from './PromoFlixPlayer';

/**
 * True só quando o HOST da URL é (sub)domínio de vimeo.com — valida o hostname
 * parseado em vez de `includes(...)`, que aceitaria `https://evil.com/vimeo.com`.
 */
function isVimeoUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const { hostname } = new URL(url);
    return hostname === 'vimeo.com' || hostname.endsWith('.vimeo.com');
  } catch {
    return false;
  }
}

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
  /** Dados de venda para o pitch via WhatsApp */
  productId?: string | null;
  productPrice?: number | null;
  productSku?: string | null;
  productMinQuantity?: number | null;
  shareUrl?: string | null;
}

export function GalleryVideoPlayer({
  productVideos,
  productName,
  open,
  onOpenChange,
  productId,
  productPrice,
  productSku,
  productMinQuantity,
  shareUrl,
}: GalleryVideoPlayerProps) {
  const [activeVideoIndex, setActiveVideoIndex] = useState(0);
  const [useFallback, setUseFallback] = useState(false);
  const v = productVideos[activeVideoIndex];

  // Reset do fallback ao trocar de vídeo ou reabrir o dialog: sem isso, um vídeo
  // que falhou e ativou o fallback forçaria o fallback no próximo vídeo selecionado
  // (mesmo que o Cloudflare Stream dele funcione), ou mostraria "indisponível".
  useEffect(() => {
    setUseFallback(false);
  }, [v?.id, open]);

  const cloudflareId = extractCloudflareStreamId(v?.url_stream);
  const hlsUrl = v?.url_hls ?? getCloudflareHlsUrl(v?.url_stream);
  const directUrl = v?.url_original ?? null;
  const youtubeId = v?.source_youtube_id ?? null;

  // Fallback embed: usa source_youtube_id quando Cloudflare falha.
  // Detecta Vimeo pelo url_original para montar embed correto.
  const isVimeoSource = isVimeoUrl(v?.url_original);
  const fallbackEmbedSrc = youtubeId
    ? isVimeoSource
      ? `https://player.vimeo.com/video/${youtubeId}?autoplay=1&title=0&byline=0&portrait=0`
      : `https://www.youtube.com/embed/${youtubeId}?autoplay=1&rel=0`
    : null;

  const posterUrl =
    getCloudflareThumbnailUrl(v?.url_stream, { time: '1s', height: 720 }) ??
    v?.url_thumbnail ??
    null;

  const playerSrc = hlsUrl ?? directUrl;
  const isHls = Boolean(hlsUrl);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* max-w-[44.8rem] = 70% de max-w-5xl (64rem) → redução de 30% proporcional AxL */}
      <DialogContent className="w-full max-w-[44.8rem] overflow-hidden border-none bg-black p-0 [&>button.absolute]:hidden">
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
                  sandbox="allow-scripts allow-presentation allow-popups"
                />
              </div>
            ) : playerSrc && !useFallback ? (
              <PromoFlixPlayer
                src={playerSrc}
                isHls={isHls}
                posterUrl={posterUrl}
                title={v?.title || undefined}
                productName={productName}
                autoPlay
                productId={productId}
                productPrice={productPrice}
                productSku={productSku}
                productMinQuantity={productMinQuantity}
                shareUrl={shareUrl}
                onUnrecoverableError={fallbackEmbedSrc ? () => setUseFallback(true) : undefined}
              />
            ) : fallbackEmbedSrc ? (
              <div className="aspect-video w-full">
                <iframe
                  src={fallbackEmbedSrc}
                  title={v?.title || `Vídeo do produto ${productName}`}
                  className="h-full w-full"
                  allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                  allowFullScreen
                  sandbox="allow-scripts allow-presentation allow-popups"
                />
              </div>
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
                    aria-label={`Ver vídeo ${idx + 1}: ${pv.title || 'sem título'}`}
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
