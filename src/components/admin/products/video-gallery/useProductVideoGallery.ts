/**
 * Hook: All state and handlers for ProductVideoGallery.
 */
import { useState, useCallback, useMemo, useRef, type ChangeEvent, type DragEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { dbInvoke } from '@/lib/db/postgrest';
import { untypedFrom } from '@/lib/supabase-untyped';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';
import {
  ACCEPTED_VIDEO_TYPES,
  MAX_FILE_SIZE,
  extractThumbnailFromVideo,
  parseYouTubeId,
  type ExternalVideo,
  type VariantLink,
  type VideoVariant,
} from './types';

export function useProductVideoGallery(productId?: string) {
  const queryClient = useQueryClient();
  const [previewVideo, setPreviewVideo] = useState<ExternalVideo | null>(null);
  const [uploadVideoType, setUploadVideoType] = useState('product_video');
  const [uploadVariant, setUploadVariant] = useState('none');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadCount, setUploadCount] = useState(0);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [filterVariant, setFilterVariant] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');
  const [linkingVideoId, setLinkingVideoId] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null);
  const [isBulkRegenerating, setIsBulkRegenerating] = useState(false);
  const [editingVideoId, setEditingVideoId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [isAddingYoutube, setIsAddingYoutube] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch videos
  const { data: videos = [], isLoading } = useQuery<ExternalVideo[]>({
    queryKey: ['product-videos-ext', productId],
    queryFn: async () => {
      try {
        const { records } = await dbInvoke<ExternalVideo>({
          table: 'product_videos',
          operation: 'select',
          filters: { product_id: productId, is_active: true },
          orderBy: { column: 'display_order', ascending: true },
          limit: 50,
        });
        return records;
      } catch {
        return [];
      }
    },
    enabled: !!productId,
    staleTime: 5 * 60 * 1000,
  });

  // Fetch variants
  const { data: variants = [] } = useQuery<VideoVariant[]>({
    queryKey: ['product-variants-for-videos', productId],
    queryFn: async () => {
      let records: Record<string, unknown>[] = [];
      try {
        const result = await dbInvoke<Record<string, unknown>>({
          table: 'product_variants',
          operation: 'select',
          select: 'id, name, color_name, color_hex, color_code',
          filters: { product_id: productId, is_active: true },
          limit: 200,
          orderBy: { column: 'name', ascending: true },
        });
        records = result.records;
      } catch {
        return [];
      }
      return records.map((r: Record<string, unknown>) => ({
        id: String(r.id),
        name: String(r.name ?? r.color_name ?? 'Variação'),
        color_name: (r.color_name as string) ?? null,
        color_hex: (r.color_hex as string) ?? null,
        supplier_code: r.color_code !== null ? String(r.color_code) : undefined,
      }));
    },
    enabled: !!productId,
    staleTime: 5 * 60 * 1000,
  });

  // Fetch variant links
  const { data: variantLinks = [] } = useQuery<VariantLink[]>({
    queryKey: ['video-variant-links', productId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('video_variant_links')
        .select('*')
        .eq('product_id', productId ?? '');
      if (error) return [];
      return data ?? [];
    },
    enabled: !!productId,
    staleTime: 2 * 60 * 1000,
  });

  // Lookup maps
  const videoLinksMap = useMemo(() => {
    const map = new Map<string, VariantLink[]>();
    variantLinks.forEach((link) => {
      const existing = map.get(link.video_id) ?? [];
      existing.push(link);
      map.set(link.video_id, existing);
    });
    return map;
  }, [variantLinks]);

  const variantMap = useMemo(() => {
    const map = new Map<string, VideoVariant>();
    variants.forEach((v) => {
      map.set(v.id, v);
      if (v.supplier_code) map.set(v.supplier_code, v);
    });
    return map;
  }, [variants]);

  // Filtered videos
  const filteredVideos = useMemo(() => {
    return videos.filter((video) => {
      if (filterType !== 'all' && (video.video_type || 'product_video') !== filterType)
        return false;
      if (filterVariant === 'all') return true;
      if (filterVariant === 'general')
        return !videoLinksMap.has(video.id) || (videoLinksMap.get(video.id)?.length ?? 0) === 0;
      const links = videoLinksMap.get(video.id) ?? [];
      return links.some((l) => l.variant_id === filterVariant || l.supplier_code === filterVariant);
    });
  }, [videos, filterType, filterVariant, videoLinksMap]);

  // Stats
  const stats = useMemo(() => {
    const linkedCount = videos.filter(
      (v) => videoLinksMap.has(v.id) && (videoLinksMap.get(v.id)?.length ?? 0) > 0,
    ).length;
    return { total: videos.length, linked: linkedCount, unlinked: videos.length - linkedCount };
  }, [videos, videoLinksMap]);

  const hasFilters = filterVariant !== 'all' || filterType !== 'all';

  // Link/unlink
  const linkVideoToVariant = useCallback(
    async (videoId: string, variantId: string) => {
      if (!productId) {
        toast.error('Produto não identificado');
        return;
      }
      const variant = variantMap.get(variantId);
      if (!variant) return;
      try {
        const { error } = await supabase.from('video_variant_links').insert({
          video_id: videoId,
          variant_id: variant.id,
          variant_name: variant.color_name || variant.name,
          variant_color_hex: variant.color_hex,
          supplier_code: variant.supplier_code || null,
          product_id: productId,
        });
        if (error) throw error;
        queryClient.invalidateQueries({ queryKey: ['video-variant-links', productId] });
        toast.success(`Vídeo vinculado a ${variant.color_name || variant.name}`);
      } catch {
        toast.error('Erro ao vincular vídeo');
      }
      setLinkingVideoId(null);
    },
    [productId, variantMap, queryClient],
  );

  const unlinkVideoFromVariant = useCallback(
    async (linkId: string) => {
      try {
        const { error } = await supabase.from('video_variant_links').delete().eq('id', linkId);
        if (error) throw error;
        queryClient.invalidateQueries({ queryKey: ['video-variant-links', productId] });
        toast.success('Vínculo removido');
      } catch {
        toast.error('Erro ao desvincular');
      }
    },
    [productId, queryClient],
  );

  // Upload
  const uploadFile = useCallback(
    async (
      file: File,
    ): Promise<{ url: string; size: number; thumbnailUrl: string | null } | null> => {
      if (!ACCEPTED_VIDEO_TYPES.includes(file.type)) {
        toast.error(`"${file.name}" não é um formato suportado`);
        return null;
      }
      if (file.size > MAX_FILE_SIZE) {
        toast.error(`"${file.name}" excede 100MB`);
        return null;
      }
      const fileExt = file.name.split('.').pop() || 'mp4';
      const baseName = `${Date.now()}-${Math.random().toString(36).slice(7)}`;
      const videoPath = `videos/${productId || 'new'}/${baseName}.${fileExt}`;
      const { data, error } = await supabase.storage
        .from('product-videos')
        .upload(videoPath, file, { cacheControl: '3600', upsert: false });
      if (error) {
        toast.error(`Erro no upload de "${file.name}"`);
        return null;
      }
      const { data: urlData } = supabase.storage.from('product-videos').getPublicUrl(data.path);

      let thumbnailUrl: string | null = null;
      try {
        const thumbBlob = await extractThumbnailFromVideo(file);
        if (thumbBlob) {
          const thumbPath = `thumbnails/${productId || 'new'}/${baseName}.jpg`;
          const { data: td, error: te } = await supabase.storage
            .from('product-videos')
            .upload(thumbPath, thumbBlob, {
              contentType: 'image/jpeg',
              cacheControl: '86400',
              upsert: false,
            });
          if (!te && td) {
            const { data: tu } = supabase.storage.from('product-videos').getPublicUrl(td.path);
            thumbnailUrl = tu.publicUrl;
          }
        }
      } catch (e) {
        logger.warn('Thumbnail generation failed:', e);
      }

      return { url: urlData.publicUrl, size: file.size, thumbnailUrl };
    },
    [productId],
  );

  const createExternalVideoRecord = useCallback(
    async (
      url: string,
      fileSize: number,
      fileName: string,
      thumbnailUrl: string | null,
      youtubeId?: string,
    ): Promise<string | null> => {
      if (!productId) return null;
      const nextOrder =
        videos.length > 0 ? Math.max(...videos.map((v) => v.display_order ?? 0)) + 1 : 0;
      const { data, error } = await untypedFrom<{ id: string }>('product_videos')
        .insert({
          product_id: productId,
          url_original: url,
          url_stream: url,
          url_thumbnail: thumbnailUrl,
          source_youtube_id: youtubeId || null,
          video_type: uploadVideoType,
          display_order: nextOrder,
          is_primary: videos.length === 0,
          is_active: true,
          title: fileName,
          file_size_bytes: fileSize,
        })
        .select('id')
        .single();
      if (error || !data) return null;
      return (data as { id?: string }).id || null;
    },
    [productId, uploadVideoType, videos],
  );

  const processUploadBatch = useCallback(
    async (files: File[]) => {
      if (!files.length) return;
      if (!productId) {
        toast.error('Salve o produto antes de enviar vídeos');
        return;
      }
      setIsUploading(true);
      setUploadCount(files.length);
      setUploadProgress(0);
      try {
        let successCount = 0;
        for (let i = 0; i < files.length; i++) {
          setUploadProgress(i + 1);
          const result = await uploadFile(files[i]);
          if (!result) continue;
          const videoId = await createExternalVideoRecord(
            result.url,
            result.size,
            files[i].name,
            result.thumbnailUrl,
          );
          if (videoId && uploadVariant !== 'none') {
            const variant = variantMap.get(uploadVariant);
            if (variant) {
              await supabase.from('video_variant_links').insert({
                video_id: videoId,
                variant_id: variant.id,
                variant_name: variant.color_name || variant.name,
                variant_color_hex: variant.color_hex,
                supplier_code: variant.supplier_code || null,
                product_id: productId,
              });
            }
          }
          successCount++;
        }
        if (successCount > 0) {
          queryClient.invalidateQueries({ queryKey: ['product-videos-ext', productId] });
          queryClient.invalidateQueries({ queryKey: ['video-variant-links', productId] });
          toast.success(`${successCount} vídeo(s) enviado(s)!`);
        }
      } catch {
        toast.error('Erro ao enviar vídeos');
      } finally {
        setIsUploading(false);
        setUploadCount(0);
        setUploadProgress(0);
      }
    },
    [productId, uploadFile, createExternalVideoRecord, uploadVariant, variantMap, queryClient],
  );

  // Add YouTube video
  const addYoutubeVideo = useCallback(async () => {
    const ytId = parseYouTubeId(youtubeUrl);
    if (!ytId) {
      toast.error('URL ou ID do YouTube inválido');
      return;
    }
    if (!productId) {
      toast.error('Salve o produto antes de adicionar vídeos');
      return;
    }
    setIsAddingYoutube(true);
    try {
      const thumbUrl = `https://img.youtube.com/vi/${ytId}/mqdefault.jpg`;
      const videoId = await createExternalVideoRecord(
        `https://www.youtube.com/watch?v=${ytId}`,
        0,
        `YouTube: ${ytId}`,
        thumbUrl,
        ytId,
      );
      if (videoId && uploadVariant !== 'none') {
        const variant = variantMap.get(uploadVariant);
        if (variant) {
          await supabase.from('video_variant_links').insert({
            video_id: videoId,
            variant_id: variant.id,
            variant_name: variant.color_name || variant.name,
            variant_color_hex: variant.color_hex,
            supplier_code: variant.supplier_code || null,
            product_id: productId,
          });
        }
      }
      queryClient.invalidateQueries({ queryKey: ['product-videos-ext', productId] });
      queryClient.invalidateQueries({ queryKey: ['video-variant-links', productId] });
      toast.success('Vídeo do YouTube adicionado!');
      setYoutubeUrl('');
    } catch {
      toast.error('Erro ao adicionar vídeo do YouTube');
    } finally {
      setIsAddingYoutube(false);
    }
  }, [youtubeUrl, productId, createExternalVideoRecord, uploadVariant, variantMap, queryClient]);

  // Remove
  const handleRemove = useCallback(
    async (videoId: string) => {
      try {
        await supabase.from('video_variant_links').delete().eq('video_id', videoId);
        const { error } = await untypedFrom('product_videos')
          .update({ is_active: false })
          .eq('id', videoId);
        if (error) throw new Error(error.message || 'Erro ao remover vídeo');
        queryClient.invalidateQueries({ queryKey: ['product-videos-ext', productId] });
        queryClient.invalidateQueries({ queryKey: ['video-variant-links', productId] });
        toast.success('Vídeo removido');
      } catch {
        toast.error('Erro ao remover vídeo');
      }
    },
    [productId, queryClient],
  );

  // Update video metadata
  const updateVideoMeta = useCallback(
    async (
      videoId: string,
      data: { title?: string; description?: string; video_type?: string },
    ) => {
      try {
        const { error } = await untypedFrom('product_videos').update(data).eq('id', videoId);
        if (error) throw new Error(error.message || 'Erro ao atualizar metadados');
        queryClient.invalidateQueries({ queryKey: ['product-videos-ext', productId] });
        toast.success('Metadados do vídeo atualizados');
        setEditingVideoId(null);
      } catch {
        toast.error('Erro ao atualizar metadados');
      }
    },
    [productId, queryClient],
  );

  // Reorder
  const handleVideoDragStart = useCallback((index: number) => setDragIndex(index), []);
  const handleVideoDragOver = useCallback((e: DragEvent, index: number) => {
    e.preventDefault();
    setDragOverIndex(index);
  }, []);
  const handleVideoDrop = useCallback(
    async (e: DragEvent, dropIndex: number) => {
      e.preventDefault();
      if (dragIndex === null || dragIndex === dropIndex) {
        setDragIndex(null);
        setDragOverIndex(null);
        return;
      }
      const reordered = [...filteredVideos];
      const [moved] = reordered.splice(dragIndex, 1);
      reordered.splice(dropIndex, 0, moved);
      setDragIndex(null);
      setDragOverIndex(null);
      // Persist order
      try {
        const results = await Promise.all(
          reordered.map((v, i) =>
            untypedFrom('product_videos').update({ display_order: i }).eq('id', v.id),
          ),
        );
        const firstError = results.find((r) => r.error);
        if (firstError?.error) throw new Error(firstError.error.message || 'Erro ao salvar ordem');
        queryClient.invalidateQueries({ queryKey: ['product-videos-ext', productId] });
        toast.success('Ordem dos vídeos salva');
      } catch {
        toast.error('Erro ao salvar ordem');
      }
    },
    [dragIndex, filteredVideos, productId, queryClient],
  );
  const handleVideoDragEnd = useCallback(() => {
    setDragIndex(null);
    setDragOverIndex(null);
  }, []);

  // Regenerate thumbnail
  const regenerateThumbnail = useCallback(
    async (video: ExternalVideo) => {
      const videoUrl = video.url_original || video.url_stream;
      if (!videoUrl || !productId) {
        toast.error('URL do vídeo não disponível');
        return;
      }
      setRegeneratingId(video.id);
      try {
        const response = await fetch(videoUrl);
        if (!response.ok) throw new Error('Falha ao baixar vídeo');
        const blob = await response.blob();
        const file = new File([blob], 'video.mp4', { type: blob.type || 'video/mp4' });
        const thumbBlob = await extractThumbnailFromVideo(file);
        if (!thumbBlob) {
          toast.error('Não foi possível extrair frame');
          return;
        }
        const baseName = `${Date.now()}-${Math.random().toString(36).slice(7)}`;
        const thumbPath = `thumbnails/${productId}/${baseName}.jpg`;
        const { data: td, error: te } = await supabase.storage
          .from('product-videos')
          .upload(thumbPath, thumbBlob, {
            contentType: 'image/jpeg',
            cacheControl: '86400',
            upsert: false,
          });
        if (te || !td) {
          toast.error('Erro ao salvar thumbnail');
          return;
        }
        const { data: tu } = supabase.storage.from('product-videos').getPublicUrl(td.path);
        const { error: updateError } = await untypedFrom('product_videos')
          .update({ url_thumbnail: tu.publicUrl })
          .eq('id', video.id);
        if (updateError) throw new Error(updateError.message || 'Erro ao salvar thumbnail');
        queryClient.invalidateQueries({ queryKey: ['product-videos-ext', productId] });
        toast.success('Thumbnail regenerada!');
      } catch (err: unknown) {
        toast.error(
          `Erro ao regenerar thumbnail: ${err instanceof Error ? err.message : 'desconhecido'}`,
        );
      } finally {
        setRegeneratingId(null);
      }
    },
    [productId, queryClient],
  );

  const bulkRegenerateThumbnails = useCallback(async () => {
    const withoutThumb = videos.filter(
      (v) => !v.url_thumbnail && !v.source_youtube_id && (v.url_original || v.url_stream),
    );
    if (withoutThumb.length === 0) {
      toast.info('Todos os vídeos já possuem thumbnail');
      return;
    }
    setIsBulkRegenerating(true);
    let successCount = 0;
    for (const video of withoutThumb) {
      try {
        await regenerateThumbnail(video);
        successCount++;
      } catch {
        /* empty */
      }
    }
    setIsBulkRegenerating(false);
    if (successCount > 0) toast.success(`${successCount} thumbnail(s) regenerada(s)`);
  }, [videos, regenerateThumbnail]);

  const getThumbnail = (video: ExternalVideo): string | null => {
    if (video.url_thumbnail) return video.url_thumbnail;
    if (video.source_youtube_id)
      return `https://img.youtube.com/vi/${video.source_youtube_id}/mqdefault.jpg`;
    return null;
  };

  // Drop zone handlers
  const handleDragOverZone = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);
  const handleDragLeaveZone = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);
  const handleDropZone = useCallback(
    async (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);
      const files = [...e.dataTransfer.files].filter((f) => ACCEPTED_VIDEO_TYPES.includes(f.type));
      if (files.length > 0) await processUploadBatch(files);
      else toast.error('Nenhum arquivo de vídeo válido encontrado');
    },
    [processUploadBatch],
  );

  const handleFileSelect = useCallback(
    async (e: ChangeEvent<HTMLInputElement>) => {
      const files = [...(e.target.files ?? [])];
      if (files.length > 0) await processUploadBatch(files);
      if (fileInputRef.current) fileInputRef.current.value = '';
    },
    [processUploadBatch],
  );

  return {
    // State
    previewVideo,
    setPreviewVideo,
    uploadVideoType,
    setUploadVideoType,
    uploadVariant,
    setUploadVariant,
    isUploading,
    uploadCount,
    uploadProgress,
    filterVariant,
    setFilterVariant,
    filterType,
    setFilterType,
    linkingVideoId,
    setLinkingVideoId,
    isDragOver,
    regeneratingId,
    isBulkRegenerating,
    editingVideoId,
    setEditingVideoId,
    deleteConfirm,
    setDeleteConfirm,
    dragIndex,
    dragOverIndex,
    youtubeUrl,
    setYoutubeUrl,
    isAddingYoutube,
    fileInputRef,
    // Data
    videos,
    isLoading,
    variants,
    variantLinks,
    videoLinksMap,
    variantMap,
    filteredVideos,
    stats,
    hasFilters,
    // Handlers
    linkVideoToVariant,
    unlinkVideoFromVariant,
    handleRemove,
    updateVideoMeta,
    handleVideoDragStart,
    handleVideoDragOver,
    handleVideoDrop,
    handleVideoDragEnd,
    regenerateThumbnail,
    bulkRegenerateThumbnails,
    getThumbnail,
    handleDragOverZone,
    handleDragLeaveZone,
    handleDropZone,
    handleFileSelect,
    processUploadBatch,
    addYoutubeVideo,
  };
}
