import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import {
  Film,
  Play,
  Link2,
  Trash2,
  Unlink,
  Loader2,
  ImagePlus,
  GripVertical,
  Type,
} from 'lucide-react';
import {
  type ExternalVideo,
  type VariantLink,
  type VideoVariant,
  VIDEO_TYPES,
  formatBytes,
} from './types';
import { VideoMetaEditor } from './VideoMetaEditor';

interface Props {
  filteredVideos: ExternalVideo[];
  videoLinksMap: Map<string, VariantLink[]>;
  variantMap: Map<string, VideoVariant>;
  variants: VideoVariant[];
  linkingVideoId: string | null;
  setLinkingVideoId: (id: string | null) => void;
  editingVideoId: string | null;
  setEditingVideoId: (id: string | null) => void;
  regeneratingId: string | null;
  dragIndex: number | null;
  dragOverIndex: number | null;
  getThumbnail: (video: ExternalVideo) => string | null;
  setPreviewVideo: (video: ExternalVideo | null) => void;
  linkVideoToVariant: (videoId: string, variantId: string) => void;
  unlinkVideoFromVariant: (linkId: string) => void;
  regenerateThumbnail: (video: ExternalVideo) => void;
  requestRemove: (videoId: string) => void;
  updateVideoMeta: (
    videoId: string,
    data: { title?: string; description?: string; video_type?: string },
  ) => void;
  handleDragStart: (index: number) => void;
  handleDragOver: (e: React.DragEvent, index: number) => void;
  handleDrop: (e: React.DragEvent, index: number) => void;
  handleDragEnd: () => void;
}

export function VideoGrid({
  filteredVideos,
  videoLinksMap,
  variantMap: _variantMap,
  variants,
  linkingVideoId,
  setLinkingVideoId,
  editingVideoId,
  setEditingVideoId,
  regeneratingId,
  dragIndex,
  dragOverIndex,
  getThumbnail,
  setPreviewVideo,
  linkVideoToVariant,
  unlinkVideoFromVariant,
  regenerateThumbnail,
  requestRemove,
  updateVideoMeta,
  handleDragStart,
  handleDragOver,
  handleDrop,
  handleDragEnd,
}: Props) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {filteredVideos.map((video, index) => {
        const thumbnail = getThumbnail(video);
        const typeInfo = VIDEO_TYPES.find((t) => t.value === video.video_type);
        const links = videoLinksMap.get(video.id) || [];

        return (
          <div
            key={video.id}
            draggable
            onDragStart={() => handleDragStart(index)}
            onDragOver={(e) => handleDragOver(e, index)}
            onDrop={(e) => handleDrop(e, index)}
            onDragEnd={handleDragEnd}
            className={cn(
              'group relative aspect-video cursor-pointer overflow-hidden rounded-lg border-2 transition-all',
              video.is_primary ? 'border-primary ring-1 ring-primary/30' : 'border-border/60',
              dragIndex === index && 'scale-95 opacity-50',
              dragOverIndex === index && dragIndex !== index && 'border-dashed border-primary',
            )}
            onClick={() => editingVideoId !== video.id && setPreviewVideo(video)}
          >
            {thumbnail ? (
              <img
                src={thumbnail}
                alt={video.title || 'Vídeo'}
                className="h-full w-full object-cover"
                loading="lazy"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-muted/30">
                <Film className="h-8 w-8 text-muted-foreground/40" />
              </div>
            )}

            {/* Play overlay */}
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-black/60 opacity-80 transition-opacity group-hover:opacity-100">
                <Play className="ml-0.5 h-5 w-5 text-primary-foreground" />
              </div>
            </div>

            {/* Top-left badges */}
            <div className="absolute left-1.5 top-1.5 flex flex-col gap-0.5">
              {video.is_primary && (
                <Badge className="bg-primary px-1 py-0 text-[9px] text-primary-foreground">
                  Principal
                </Badge>
              )}
              {typeInfo && (
                <Badge
                  variant="outline"
                  className="bg-background/80 px-1 py-0 text-[8px] backdrop-blur-sm"
                >
                  {typeInfo.label}
                </Badge>
              )}
            </div>

            {/* Variant color dots */}
            {links.length > 0 && (
              <div className="absolute bottom-7 left-1.5 flex gap-0.5">
                {links.map((link) => (
                  <Tooltip key={link.id}>
                    <TooltipTrigger asChild>
                      <span
                        className="h-3.5 w-3.5 rounded-full border border-white/60 shadow-sm"
                        style={{ backgroundColor: link.variant_color_hex || '#999' }}
                      />
                    </TooltipTrigger>
                    <TooltipContent>{link.variant_name || 'Variação'}</TooltipContent>
                  </Tooltip>
                ))}
              </div>
            )}

            {/* Bottom info bar */}
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent px-2 py-1.5">
              <div className="flex items-center justify-between">
                <span className="max-w-[70%] truncate text-[10px] text-primary-foreground/80">
                  {video.title || 'Vídeo'}
                </span>
                {video.file_size_bytes && video.file_size_bytes > 0 && (
                  <span className="text-[9px] text-primary-foreground/60">
                    {formatBytes(video.file_size_bytes)}
                  </span>
                )}
              </div>
            </div>

            {/* Action buttons */}
            <div className="absolute right-1.5 top-1.5 flex gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
              <GripVertical className="h-4 w-4 cursor-grab text-primary-foreground/70" />
              {/* Edit meta */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    size="icon"
                    aria-label="Type"
                    variant="ghost"
                    className="h-6 w-6 bg-foreground/50 text-primary-foreground hover:bg-primary"
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingVideoId(editingVideoId === video.id ? null : video.id);
                    }}
                  >
                    <Type className="h-3 w-3" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Editar metadados</TooltipContent>
              </Tooltip>
              {variants.length > 0 && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      size="icon"
                      aria-label="Link2"
                      variant="ghost"
                      className="h-6 w-6 bg-foreground/50 text-primary-foreground hover:bg-primary"
                      onClick={(e) => {
                        e.stopPropagation();
                        setLinkingVideoId(linkingVideoId === video.id ? null : video.id);
                      }}
                    >
                      <Link2 className="h-3 w-3" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Vincular a variação</TooltipContent>
                </Tooltip>
              )}
              {!video.url_thumbnail && !video.source_youtube_id && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      size="icon"
                      aria-label={regeneratingId === video.id ? 'Gerando miniatura...' : 'Gerar miniatura'}
                      variant="ghost"
                      className="h-6 w-6 bg-foreground/50 text-primary-foreground hover:bg-warning"
                      disabled={regeneratingId === video.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        regenerateThumbnail(video);
                      }}
                    >
                      {regeneratingId === video.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <ImagePlus className="h-3 w-3" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Gerar thumbnail</TooltipContent>
                </Tooltip>
              )}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    size="icon"
                    aria-label="Excluir"
                    variant="ghost"
                    className="h-6 w-6 bg-foreground/50 text-primary-foreground hover:bg-destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      requestRemove(video.id);
                    }}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Remover vídeo</TooltipContent>
              </Tooltip>
            </div>

            {/* Meta editor overlay */}
            {editingVideoId === video.id && (
              <VideoMetaEditor
                video={video}
                onSave={(data) => updateVideoMeta(video.id, data)}
                onCancel={() => setEditingVideoId(null)}
              />
            )}

            {/* Linking panel */}
            {linkingVideoId === video.id && (
              <div
                className="absolute inset-0 z-10 flex flex-col gap-1 bg-black/85 p-2 backdrop-blur-sm"
                onClick={(e) => e.stopPropagation()}
              >
                <span className="text-[10px] font-medium text-primary-foreground/80">
                  Vincular a variação:
                </span>
                <div className="flex-1 space-y-0.5 overflow-y-auto">
                  {variants.map((v) => {
                    const isLinked = links.some((l) => l.variant_id === v.id);
                    const existingLink = links.find((l) => l.variant_id === v.id);
                    return (
                      <button
                        key={v.id}
                        type="button"
                        className={cn(
                          'flex w-full items-center gap-1.5 rounded px-1.5 py-1 text-[10px] transition-colors',
                          isLinked
                            ? 'bg-primary/30 text-primary-foreground'
                            : 'text-primary-foreground/70 hover:bg-white/10',
                        )}
                        onClick={() =>
                          isLinked && existingLink
                            ? unlinkVideoFromVariant(existingLink.id)
                            : linkVideoToVariant(video.id, v.id)
                        }
                      >
                        <span
                          className="h-3 w-3 shrink-0 rounded-full border border-white/40"
                          style={{ backgroundColor: v.color_hex || '#999' }}
                        />
                        <span className="truncate">{v.color_name || v.name}</span>
                        {isLinked && (
                          <Unlink className="ml-auto h-2.5 w-2.5 shrink-0 text-primary-foreground/60" />
                        )}
                      </button>
                    );
                  })}
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-5 text-[9px] text-primary-foreground/60 hover:text-primary-foreground"
                  onClick={() => setLinkingVideoId(null)}
                >
                  Fechar
                </Button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
