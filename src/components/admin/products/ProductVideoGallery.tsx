/**
 * ProductVideoGallery — Refactored orchestrator.
 * Logic extracted to useProductVideoGallery hook.
 * UI decomposed into VideoGrid, VideoUploadArea, VideoMetaEditor sub-components.
 */
import { Loader2, Film, Filter, Palette, Video, Link2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { getCloudflareEmbedUrl } from '@/utils/cloudflare-stream';
import { useProductVideoGallery } from './video-gallery/useProductVideoGallery';
import { VideoGrid } from './video-gallery/VideoGrid';
import { VideoUploadArea } from './video-gallery/VideoUploadArea';
import { ConfirmDeleteDialog } from './image-gallery/ConfirmDeleteDialog';
import { VIDEO_TYPES, formatBytes } from './video-gallery/types';

interface ProductVideoGalleryProps {
  productId?: string;
}

export function ProductVideoGallery({ productId }: ProductVideoGalleryProps) {
  const g = useProductVideoGallery(productId);

  if (g.isLoading) {
    return (
      <div className="flex items-center justify-center py-8 text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Carregando vídeos...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      {g.videos.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border/30 bg-muted/20 p-2.5">
          <Filter className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <Select value={g.filterType} onValueChange={g.setFilterType}>
            <SelectTrigger className="h-7 w-[120px] text-[11px]">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">
                Todos os tipos
              </SelectItem>
              {VIDEO_TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value} className="text-xs">
                  <span className="flex items-center gap-1.5">
                    <t.icon className={`h-3 w-3 ${t.color}`} />
                    {t.label}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {g.variants.length > 0 && (
            <Select value={g.filterVariant} onValueChange={g.setFilterVariant}>
              <SelectTrigger className="h-7 w-[160px] text-[11px]">
                <SelectValue placeholder="Variação" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">
                  <span className="flex items-center gap-1.5">
                    <Palette className="h-3 w-3 text-muted-foreground" />
                    Todas as variações
                  </span>
                </SelectItem>
                <SelectItem value="general" className="text-xs">
                  <span className="flex items-center gap-1.5">
                    <Video className="h-3 w-3 text-muted-foreground" />
                    Sem variação (geral)
                  </span>
                </SelectItem>
                {g.variants.map((v) => (
                  <SelectItem key={v.id} value={v.id} className="text-xs">
                    <span className="flex items-center gap-1.5">
                      <span
                        className="h-3 w-3 shrink-0 rounded-full border border-border/60"
                        style={{ backgroundColor: v.color_hex || '#999' }}
                      />
                      {v.color_name || v.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {g.hasFilters && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 text-[10px] text-muted-foreground"
              onClick={() => {
                g.setFilterVariant('all');
                g.setFilterType('all');
              }}
            >
              Limpar filtros
            </Button>
          )}
          {g.videos.some((v) => !v.url_thumbnail && !v.source_youtube_id) && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 text-[10px] text-muted-foreground hover:text-primary"
                  onClick={g.bulkRegenerateThumbnails}
                  disabled={g.isBulkRegenerating}
                >
                  {g.isBulkRegenerating ? (
                    <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                  ) : (
                    <RefreshCw className="mr-1 h-3 w-3" />
                  )}
                  Gerar thumbnails
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                Gerar thumbnails para{' '}
                {g.videos.filter((v) => !v.url_thumbnail && !v.source_youtube_id).length} vídeo(s)
              </TooltipContent>
            </Tooltip>
          )}
          <span className="ml-auto text-[10px] text-muted-foreground">
            {g.filteredVideos.length}/{g.videos.length}
          </span>
        </div>
      )}

      {/* Video grid */}
      {g.filteredVideos.length > 0 && (
        <VideoGrid
          filteredVideos={g.filteredVideos}
          videoLinksMap={g.videoLinksMap}
          variantMap={g.variantMap}
          variants={g.variants}
          linkingVideoId={g.linkingVideoId}
          setLinkingVideoId={g.setLinkingVideoId}
          editingVideoId={g.editingVideoId}
          setEditingVideoId={g.setEditingVideoId}
          regeneratingId={g.regeneratingId}
          dragIndex={g.dragIndex}
          dragOverIndex={g.dragOverIndex}
          getThumbnail={g.getThumbnail}
          setPreviewVideo={g.setPreviewVideo}
          linkVideoToVariant={g.linkVideoToVariant}
          unlinkVideoFromVariant={g.unlinkVideoFromVariant}
          regenerateThumbnail={g.regenerateThumbnail}
          requestRemove={(id) => g.setDeleteConfirm(id)}
          updateVideoMeta={g.updateVideoMeta}
          handleDragStart={g.handleVideoDragStart}
          handleDragOver={g.handleVideoDragOver}
          handleDrop={g.handleVideoDrop}
          handleDragEnd={g.handleVideoDragEnd}
        />
      )}

      {/* Stats */}
      {g.videos.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border border-border/30 bg-muted/20 px-1 py-1.5 text-[11px] text-muted-foreground">
          <span className="font-medium text-foreground/70">{g.stats.total} vídeo(s)</span>
          <span className="flex items-center gap-1">
            <Link2 className="h-2.5 w-2.5" />
            {g.stats.linked} vinculado(s)
          </span>
        </div>
      )}

      {/* Upload area */}
      <VideoUploadArea
        productId={productId}
        variants={g.variants}
        uploadVideoType={g.uploadVideoType}
        setUploadVideoType={g.setUploadVideoType}
        uploadVariant={g.uploadVariant}
        setUploadVariant={g.setUploadVariant}
        isUploading={g.isUploading}
        uploadCount={g.uploadCount}
        uploadProgress={g.uploadProgress}
        isDragOver={g.isDragOver}
        fileInputRef={g.fileInputRef}
        handleFileSelect={g.handleFileSelect}
        handleDragOverZone={g.handleDragOverZone}
        handleDragLeaveZone={g.handleDragLeaveZone}
        handleDropZone={g.handleDropZone}
        youtubeUrl={g.youtubeUrl}
        setYoutubeUrl={g.setYoutubeUrl}
        addYoutubeVideo={g.addYoutubeVideo}
        isAddingYoutube={g.isAddingYoutube}
      />

      {/* Preview dialog */}
      <Dialog open={!!g.previewVideo} onOpenChange={() => g.setPreviewVideo(null)}>
        <DialogContent className="max-w-3xl p-2">
          {g.previewVideo && (
            <div className="space-y-2">
              <div className="aspect-video overflow-hidden rounded-md bg-black">
                {(() => {
                  const embedUrl = getCloudflareEmbedUrl(g.previewVideo.url_stream, {
                    autoplay: true,
                  });

                  return embedUrl ? (
                    <iframe
                      src={embedUrl}
                      className="h-full w-full"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                      sandbox="allow-scripts allow-presentation"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                      <Film className="h-8 w-8 opacity-40" />
                    </div>
                  );
                })()}
              </div>
              <div className="flex flex-wrap gap-2 px-2 pb-1 text-[11px] text-muted-foreground">
                {g.previewVideo.title && (
                  <span className="font-medium text-foreground/70">{g.previewVideo.title}</span>
                )}
                {g.previewVideo.video_type && (
                  <Badge variant="secondary" className="text-[10px]">
                    {VIDEO_TYPES.find((t) => t.value === g.previewVideo?.video_type)?.label ||
                      g.previewVideo.video_type}
                  </Badge>
                )}
                {(g.videoLinksMap.get(g.previewVideo.id) || []).map((link) => (
                  <Badge
                    key={link.id}
                    variant="outline"
                    className="flex items-center gap-1 text-[10px]"
                  >
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: link.variant_color_hex || '#999' }}
                    />
                    {link.variant_name}
                  </Badge>
                ))}
                {g.previewVideo.file_size_bytes && g.previewVideo.file_size_bytes > 0 && (
                  <span>{formatBytes(g.previewVideo.file_size_bytes)}</span>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Confirm delete dialog */}
      <ConfirmDeleteDialog
        open={!!g.deleteConfirm}
        onCancel={() => g.setDeleteConfirm(null)}
        onConfirm={() => {
          if (g.deleteConfirm) g.handleRemove(g.deleteConfirm);
          g.setDeleteConfirm(null);
        }}
        title="Remover vídeo"
        description="Tem certeza que deseja remover este vídeo? Esta ação não pode ser desfeita."
      />
    </div>
  );
}
