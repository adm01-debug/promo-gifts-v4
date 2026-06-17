/**
 * Hook: All state and handlers for ProductImageGallery.
 * P0 fixes: handleRemove now soft-deletes + cleans storage. handleSetPrimary persists.
 * P1 improvements: isDragOver, upload progress tracking.
 */
import { useState, useRef, useCallback, useMemo, type ChangeEvent, type DragEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { dbInvoke } from '@/lib/db/postgrest';
import { untypedFrom } from '@/lib/supabase-untyped';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';
import {
  IMAGE_TYPES,
  type ExternalImage,
  type FilterMode,
  type VariantInfo,
  type GalleryStats,
} from './types';

interface UseProductImageGalleryProps {
  images: string[];
  onChange: (images: string[]) => void;
  folder: string;
  productId?: string;
}

export function useProductImageGallery({
  images,
  onChange,
  folder,
  productId,
}: UseProductImageGalleryProps) {
  const queryClient = useQueryClient();
  const [isUploading, setIsUploading] = useState(false);
  const [uploadCount, setUploadCount] = useState(0);
  const [uploadProgress, setUploadProgress] = useState(0); // current file index
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [uploadVariant, setUploadVariant] = useState<string>('none');
  const [uploadImageType, setUploadImageType] = useState<string>('gallery');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedUrls, setSelectedUrls] = useState<Set<string>>(new Set());
  const [bulkMode, setBulkMode] = useState(false);
  const [isBulkUpdating, setIsBulkUpdating] = useState(false);
  const [isDragOverZone, setIsDragOverZone] = useState(false);

  // Delete confirmation state
  const [deleteConfirm, setDeleteConfirm] = useState<{
    type: 'single' | 'bulk';
    url?: string;
  } | null>(null);

  // Fetch external images
  const { data: externalImages = [], isLoading: isLoadingExt } = useQuery<ExternalImage[]>({
    queryKey: ['product-images-ext', productId],
    queryFn: async () => {
      try {
        const { records } = await dbInvoke<ExternalImage>({
          table: 'product_images',
          operation: 'select',
          filters: { product_id: productId, is_active: true },
          limit: 200,
          orderBy: { column: 'display_order', ascending: true },
        });
        return records;
      } catch {
        return [];
      }
    },
    enabled: !!productId,
    staleTime: 2 * 60 * 1000,
  });

  // Fetch variants
  const { data: variants = [] } = useQuery<VariantInfo[]>({
    queryKey: ['product-variants-for-gallery', productId],
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

  const extImageMap = useMemo(() => {
    const map = new Map<string, ExternalImage>();
    externalImages.forEach((img) => {
      const url = img.url_cdn || img.url_original || img.url || '';
      if (url) map.set(url, img);
    });
    return map;
  }, [externalImages]);

  const stats: GalleryStats = useMemo(() => {
    const byType = new Map<string, number>();
    const byVariant = new Map<string, number>();
    let withAlt = 0;
    let withoutVariant = 0;
    let cfVerified = 0;
    let cfPending = 0;
    let withBlurhash = 0;
    externalImages.forEach((img) => {
      byType.set(img.image_type || 'untyped', (byType.get(img.image_type || 'untyped') || 0) + 1);
      const varKey = img.supplier_code || img.variant_id;
      if (varKey) byVariant.set(varKey, (byVariant.get(varKey) || 0) + 1);
      else withoutVariant++;
      if (img.alt_text) withAlt++;
      if (img.cf_sync_status === 'verified') cfVerified++;
      else if (!img.cf_sync_status || img.cf_sync_status === 'pending') cfPending++;
      if (img.blurhash) withBlurhash++;
    });
    return {
      byType,
      byVariant,
      withAlt,
      withoutVariant,
      total: externalImages.length,
      cfVerified,
      cfPending,
      withBlurhash,
    };
  }, [externalImages]);

  const variantMap = useMemo(() => {
    const map = new Map<string, VariantInfo>();
    variants.forEach((v) => {
      if (v.id) map.set(v.id, v);
      if (v.supplier_code) map.set(v.supplier_code, v);
    });
    return map;
  }, [variants]);

  // Count images per variant for upload selector
  const variantImageCounts = useMemo(() => {
    const counts = new Map<string, number>();
    externalImages.forEach((img) => {
      const key = img.supplier_code || img.variant_id;
      if (key) counts.set(key, (counts.get(key) || 0) + 1);
    });
    return counts;
  }, [externalImages]);

  const filteredImages = useMemo(() => {
    let filtered = [...images];
    if (typeFilter !== 'all' || filterMode !== 'all') {
      filtered = filtered.filter((url) => {
        const ext = extImageMap.get(url);
        if (!ext) return filterMode === 'all' && typeFilter === 'all';
        if (typeFilter !== 'all' && (ext.image_type || 'untyped') !== typeFilter) return false;
        if (filterMode === 'general') return !ext.supplier_code && !ext.variant_id;
        if (filterMode === 'by-variant') return !!(ext.supplier_code || ext.variant_id);
        if (filterMode !== 'all')
          return ext.supplier_code === filterMode || ext.variant_id === filterMode;
        return true;
      });
    }
    return filtered;
  }, [images, filterMode, typeFilter, extImageMap]);

  const activeTypes = useMemo(() => {
    const types = new Set<string>();
    externalImages.forEach((img) => types.add(img.image_type || 'untyped'));
    return types;
  }, [externalImages]);

  // Handlers
  const updateExternalImageMeta = useCallback(
    async (imgUrl: string, data: { alt_text: string; image_type: string; caption: string }) => {
      const ext = extImageMap.get(imgUrl);
      if (!ext?.id) {
        toast.error('Imagem não encontrada no banco externo');
        return;
      }
      try {
        const { error } = await untypedFrom('product_images')
          .update({
            alt_text: data.alt_text.trim() || null,
            image_type: data.image_type || 'main',
            caption: data.caption.trim() || null,
          })
          .eq('id', ext.id);
        if (error) throw new Error(error.message);
        toast.success('Metadados atualizados');
        setEditingIndex(null);
        if (productId)
          queryClient.invalidateQueries({ queryKey: ['product-images-ext', productId] });
      } catch {
        toast.error('Erro ao atualizar');
      }
    },
    [extImageMap, productId, queryClient],
  );

  const uploadFile = useCallback(
    async (file: File): Promise<string | null> => {
      if (!file.type.startsWith('image/')) {
        toast.error(`"${file.name}" não é uma imagem válida`);
        return null;
      }
      if (file.size > 5 * 1024 * 1024) {
        toast.error(`"${file.name}" excede 5MB`);
        return null;
      }

      // Validate minimum dimensions
      const minDim = await new Promise<boolean>((resolve) => {
        const img = new Image();
        img.onload = () => {
          URL.revokeObjectURL(img.src);
          resolve(img.width >= 200 && img.height >= 200);
        };
        img.onerror = () => {
          URL.revokeObjectURL(img.src);
          resolve(true);
        }; // allow if can't check
        img.src = URL.createObjectURL(file);
      });
      if (!minDim) {
        toast.error(`"${file.name}" tem resolução muito baixa (mínimo 200×200px)`);
        return null;
      }

      const fileExt = file.name.split('.').pop();
      const fileName = `${folder}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const { data, error } = await supabase.storage
        .from('personalization-images')
        .upload(fileName, file, { cacheControl: '3600', upsert: false });
      if (error) {
        toast.error(`Erro ao enviar "${file.name}"`);
        return null;
      }
      const { data: urlData } = supabase.storage
        .from('personalization-images')
        .getPublicUrl(data.path);
      return urlData.publicUrl;
    },
    [folder],
  );

  const removeStorageFileByUrl = useCallback(async (url: string) => {
    const parts = url.split('/personalization-images/');
    if (parts.length < 2) return;
    await supabase.storage.from('personalization-images').remove([decodeURIComponent(parts[1])]);
  }, []);

  const createExternalImageRecord = useCallback(
    async (
      url: string,
      variantCode: string,
      imageType: string,
      shouldBePrimary: boolean,
    ): Promise<{ ok: true } | { ok: false; error: string }> => {
      if (!productId) return { ok: true };
      try {
        const variant = variantCode !== 'none' ? variantMap.get(variantCode) : null;
        const nextOrder =
          externalImages.length > 0
            ? Math.max(...externalImages.map((i) => i.display_order || 0)) + 1
            : 0;
        const { error } = await untypedFrom('product_images').insert({
          product_id: productId,
          url_cdn: url,
          url_original: url,
          image_type: imageType,
          is_primary: shouldBePrimary,
          is_og_image: false,
          display_order: nextOrder,
          is_active: true,
          supplier_code: variant?.supplier_code || null,
          variant_id: variant?.id || null,
          alt_text: null,
        });
        if (error) throw new Error(error.message || 'Falha ao registrar imagem no banco externo');
        return { ok: true };
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao criar registro no BD externo';
        logger.warn('Erro ao criar registro no BD externo:', message);
        return { ok: false, error: message };
      }
    },
    [productId, variantMap, externalImages],
  );

  const processUploadBatch = useCallback(
    async (files: File[]) => {
      if (files.length === 0) return;
      setIsUploading(true);
      setUploadCount(files.length);
      setUploadProgress(0);
      try {
        const uploadedUrls: string[] = [];
        for (let i = 0; i < files.length; i++) {
          setUploadProgress(i + 1);
          const url = await uploadFile(files[i]);
          if (url) uploadedUrls.push(url);
        }
        if (uploadedUrls.length === 0) return;
        const variantLabel =
          uploadVariant !== 'none'
            ? variantMap.get(uploadVariant)?.color_name ||
              variantMap.get(uploadVariant)?.name ||
              uploadVariant
            : null;
        const typeLabel =
          IMAGE_TYPES.find((t) => t.value === uploadImageType)?.label || uploadImageType;
        if (!productId) {
          onChange([...images, ...uploadedUrls]);
          toast.success(`${uploadedUrls.length} imagem(ns) enviada(s) (${typeLabel})`);
          return;
        }
        const hasPrimaryAlready = externalImages.some((img) => img.is_primary);
        const persistResults = await Promise.all(
          uploadedUrls.map(async (url, index) => ({
            url,
            result: await createExternalImageRecord(
              url,
              uploadVariant,
              uploadImageType,
              uploadImageType === 'main' && !hasPrimaryAlready && index === 0,
            ),
          })),
        );
        const successUrls = persistResults.filter((item) => item.result.ok).map((item) => item.url);
        const failedItems = persistResults.filter((item) => !item.result.ok) as Array<{
          url: string;
          result: { ok: false; error: string };
        }>;
        if (failedItems.length > 0)
          await Promise.all(failedItems.map((item) => removeStorageFileByUrl(item.url)));
        if (successUrls.length > 0) {
          onChange([...images, ...successUrls]);
          queryClient.invalidateQueries({ queryKey: ['product-images-ext', productId] });
        }
        if (failedItems.length === 0)
          toast.success(
            `${successUrls.length} imagem(ns) enviada(s)${variantLabel ? ` → ${variantLabel}` : ''} (${typeLabel})`,
          );
        else if (successUrls.length > 0)
          toast.warning(
            `${successUrls.length} imagem(ns) enviada(s), ${failedItems.length} falharam no vínculo (${typeLabel})`,
          );
        else
          toast.error(
            `Falha ao vincular imagens: ${failedItems[0]?.result.error || 'erro desconhecido'}`,
          );
      } finally {
        setIsUploading(false);
        setUploadCount(0);
        setUploadProgress(0);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    },
    [
      images,
      onChange,
      productId,
      uploadVariant,
      uploadImageType,
      variantMap,
      createExternalImageRecord,
      externalImages,
      queryClient,
      removeStorageFileByUrl,
      uploadFile,
    ],
  );

  const handleFilesChange = async (e: ChangeEvent<HTMLInputElement>) => {
    await processUploadBatch(Array.from(e.target.files ?? []));
  };

  // P0 FIX: handleRemove now soft-deletes in external DB + cleans storage
  const handleRemove = useCallback(
    async (url: string) => {
      // Remove from local array
      onChange(images.filter((i) => i !== url));

      // Soft-delete in external DB
      const ext = extImageMap.get(url);
      if (ext?.id && productId) {
        try {
          await untypedFrom('product_images').update({ is_active: false }).eq('id', ext.id);
          queryClient.invalidateQueries({ queryKey: ['product-images-ext', productId] });
        } catch (err) {
          logger.warn('Erro ao desativar imagem no BD externo:', err);
        }
      }

      // Clean storage
      await removeStorageFileByUrl(url);
      toast.success('Imagem removida');
    },
    [images, onChange, extImageMap, productId, queryClient, removeStorageFileByUrl],
  );

  // P0 FIX: handleSetPrimary now persists is_primary in external DB
  const handleSetPrimary = useCallback(
    async (url: string) => {
      const idx = images.indexOf(url);
      if (idx <= 0) return;
      const newImages = [...images];
      const [moved] = newImages.splice(idx, 1);
      newImages.unshift(moved);
      onChange(newImages);

      if (productId) {
        try {
          // Clear is_primary from all images for this product
          const currentPrimary = externalImages.find((img) => img.is_primary);
          if (currentPrimary?.id) {
            await untypedFrom('product_images')
              .update({ is_primary: false })
              .eq('id', currentPrimary.id);
          }
          // Set new primary
          const newPrimaryExt = extImageMap.get(url);
          if (newPrimaryExt?.id) {
            await untypedFrom('product_images')
              .update({ is_primary: true, display_order: 0 })
              .eq('id', newPrimaryExt.id);
          }
          queryClient.invalidateQueries({ queryKey: ['product-images-ext', productId] });
        } catch (err) {
          logger.warn('Erro ao persistir imagem principal:', err);
        }
      }
      toast.success('Imagem principal definida');
    },
    [images, onChange, productId, externalImages, extImageMap, queryClient],
  );

  const persistDisplayOrder = useCallback(
    async (reorderedUrls: string[]) => {
      if (!productId) return;
      const updates: Array<{ id: string; display_order: number }> = [];
      reorderedUrls.forEach((url, index) => {
        const ext = extImageMap.get(url);
        if (ext?.id) updates.push({ id: ext.id, display_order: index });
      });
      if (updates.length === 0) return;
      try {
        await Promise.all(
          updates.map(({ id, display_order: displayOrder }) =>
            untypedFrom('product_images').update({ display_order: displayOrder }).eq('id', id),
          ),
        );
        queryClient.invalidateQueries({ queryKey: ['product-images-ext', productId] });
        toast.success('Ordem salva automaticamente');
      } catch (err) {
        logger.warn('Erro ao persistir ordem:', err);
        toast.error('Erro ao salvar nova ordem');
      }
    },
    [productId, extImageMap, queryClient],
  );

  const handleDragStart = (index: number) => setDragIndex(index);
  const handleDragOver = (e: DragEvent, index: number) => {
    e.preventDefault();
    setDragOverIndex(index);
  };
  const handleDrop = (e: DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (dragIndex === null || dragIndex === dropIndex) {
      setDragIndex(null);
      setDragOverIndex(null);
      return;
    }
    const newImages = [...images];
    const [moved] = newImages.splice(dragIndex, 1);
    newImages.splice(dropIndex, 0, moved);
    onChange(newImages);
    setDragIndex(null);
    setDragOverIndex(null);
    persistDisplayOrder(newImages);
  };
  const handleDragEnd = () => {
    setDragIndex(null);
    setDragOverIndex(null);
  };

  const toggleSelect = useCallback((url: string) => {
    setSelectedUrls((prev) => {
      const next = new Set(prev);
      if (next.has(url)) next.delete(url);
      else next.add(url);
      return next;
    });
  }, []);
  const selectAll = useCallback(() => setSelectedUrls(new Set(filteredImages)), [filteredImages]);
  const clearSelection = useCallback(() => {
    setSelectedUrls(new Set());
    setBulkMode(false);
  }, []);

  const createMissingExternalRecords = useCallback(
    async (
      urls: string[],
      resolveData: (url: string) => {
        image_type: string;
        supplier_code: string | null;
        variant_id: string | null;
      },
    ): Promise<number> => {
      if (!productId || urls.length === 0) return 0;
      const results = await Promise.all(
        urls.map((url) => {
          const d = resolveData(url);
          return untypedFrom('product_images').insert({
            product_id: productId,
            url_cdn: url,
            url_original: url,
            image_type: d.image_type,
            is_primary: Math.max(images.indexOf(url), 0) === 0,
            is_og_image: false,
            display_order: Math.max(images.indexOf(url), 0),
            is_active: true,
            supplier_code: d.supplier_code,
            variant_id: d.variant_id,
            alt_text: null,
          });
        }),
      );
      return results.filter(({ error }) => !error).length;
    },
    [images, productId],
  );

  const bulkUpdateType = useCallback(
    async (newType: string) => {
      if (selectedUrls.size === 0 || !productId) {
        if (!productId) toast.error('Salve o produto antes de classificar imagens em lote');
        return;
      }
      setIsBulkUpdating(true);
      try {
        const selectedList = Array.from(selectedUrls);
        const updates = selectedList
          .map((url) => extImageMap.get(url))
          .filter((ext): ext is ExternalImage => !!ext?.id);
        const missingUrls = selectedList.filter((url) => !extImageMap.get(url)?.id);
        const updateResults = await Promise.all(
          updates.map((ext) =>
            untypedFrom('product_images').update({ image_type: newType }).eq('id', ext.id),
          ),
        );
        const updateErrors = updateResults.filter((r) => r.error);
        if (updateErrors.length > 0) {
          throw new Error(updateErrors[0].error?.message || 'Erro ao atualizar tipo em lote');
        }
        const insertedCount = await createMissingExternalRecords(missingUrls, () => ({
          image_type: newType,
          supplier_code: null,
          variant_id: null,
        }));
        queryClient.invalidateQueries({ queryKey: ['product-images-ext', productId] });
        const affectedCount = updates.length + insertedCount;
        const label = IMAGE_TYPES.find((t) => t.value === newType)?.label || newType;
        if (affectedCount === 0)
          toast.warning('Nenhuma imagem elegível para classificação em lote');
        else toast.success(`${affectedCount} imagem(ns) classificada(s) como "${label}"`);
        clearSelection();
      } catch {
        toast.error('Erro ao atualizar tipo em lote');
      } finally {
        setIsBulkUpdating(false);
      }
    },
    [
      selectedUrls,
      productId,
      extImageMap,
      createMissingExternalRecords,
      queryClient,
      clearSelection,
    ],
  );

  const bulkUpdateVariant = useCallback(
    async (variantCode: string) => {
      if (selectedUrls.size === 0 || !productId) {
        if (!productId) toast.error('Salve o produto antes de vincular variações em lote');
        return;
      }
      setIsBulkUpdating(true);
      try {
        const variant = variantCode !== 'none' ? variantMap.get(variantCode) : null;
        const selectedList = Array.from(selectedUrls);
        const updates = selectedList
          .map((url) => extImageMap.get(url))
          .filter((ext): ext is ExternalImage => !!ext?.id);
        const missingUrls = selectedList.filter((url) => !extImageMap.get(url)?.id);
        const updateResults = await Promise.all(
          updates.map((ext) =>
            untypedFrom('product_images')
              .update({
                supplier_code: variant?.supplier_code || null,
                variant_id: variant?.id || null,
              })
              .eq('id', ext.id),
          ),
        );
        const updateErrors = updateResults.filter((r) => r.error);
        if (updateErrors.length > 0) {
          throw new Error(updateErrors[0].error?.message || 'Erro ao atualizar variação em lote');
        }
        const insertedCount = await createMissingExternalRecords(missingUrls, (url) => ({
          image_type: images.indexOf(url) === 0 ? 'main' : 'gallery',
          supplier_code: variant?.supplier_code || null,
          variant_id: variant?.id || null,
        }));
        queryClient.invalidateQueries({ queryKey: ['product-images-ext', productId] });
        const affectedCount = updates.length + insertedCount;
        const label = variant ? variant.color_name || variant.name : 'Geral (sem cor)';
        if (affectedCount === 0) toast.warning('Nenhuma imagem elegível para vínculo em lote');
        else toast.success(`${affectedCount} imagem(ns) vinculada(s) a "${label}"`);
        clearSelection();
      } catch {
        toast.error('Erro ao atualizar variação em lote');
      } finally {
        setIsBulkUpdating(false);
      }
    },
    [
      selectedUrls,
      productId,
      extImageMap,
      variantMap,
      images,
      createMissingExternalRecords,
      queryClient,
      clearSelection,
    ],
  );

  const bulkDelete = useCallback(async () => {
    if (selectedUrls.size === 0) return;
    setIsBulkUpdating(true);
    try {
      const toRemove = Array.from(selectedUrls);
      await Promise.all(toRemove.map((url) => removeStorageFileByUrl(url)));
      const extUpdates = toRemove
        .map((url) => extImageMap.get(url))
        .filter((ext): ext is ExternalImage => !!ext?.id);
      const deactivateResults = await Promise.all(
        extUpdates.map((ext) =>
          untypedFrom('product_images').update({ is_active: false }).eq('id', ext.id),
        ),
      );
      const deactivateErrors = deactivateResults.filter((r) => r.error);
      if (deactivateErrors.length > 0) {
        throw new Error(deactivateErrors[0].error?.message || 'Erro ao desativar imagens no banco');
      }
      onChange(images.filter((url) => !selectedUrls.has(url)));
      if (productId) queryClient.invalidateQueries({ queryKey: ['product-images-ext', productId] });
      toast.success(`${toRemove.length} imagem(ns) removida(s)`);
      clearSelection();
    } catch {
      toast.error('Erro ao remover imagens em lote');
    } finally {
      setIsBulkUpdating(false);
    }
  }, [
    selectedUrls,
    extImageMap,
    images,
    onChange,
    productId,
    queryClient,
    removeStorageFileByUrl,
    clearSelection,
  ]);

  const handleDropZone = useCallback(
    async (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOverZone(false);
      await processUploadBatch(
        Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith('image/')),
      );
    },
    [processUploadBatch],
  );

  const handleDropZoneDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    setIsDragOverZone(true);
  }, []);

  const handleDropZoneDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault();
    setIsDragOverZone(false);
  }, []);

  // Bulk update alt_text with template
  const bulkUpdateAltText = useCallback(
    async (template: string) => {
      if (selectedUrls.size === 0 || !productId) return;
      setIsBulkUpdating(true);
      try {
        const selectedList = Array.from(selectedUrls);
        const updates = selectedList
          .map((url) => extImageMap.get(url))
          .filter((ext): ext is ExternalImage => !!ext?.id);
        const altResults = await Promise.all(
          updates.map((ext, i) => {
            const typeLabel =
              IMAGE_TYPES.find((t) => t.value === ext.image_type)?.label ||
              ext.image_type ||
              'Imagem';
            const variantLabel =
              ext.supplier_code || ext.variant_id
                ? variantMap.get(ext.supplier_code || ext.variant_id || '')?.color_name || ''
                : '';
            const altText = template
              .replace('{tipo}', typeLabel)
              .replace('{cor}', variantLabel)
              .replace('{n}', String(i + 1));
            return untypedFrom('product_images')
              .update({ alt_text: altText.trim() || null })
              .eq('id', ext.id);
          }),
        );
        const altErrors = altResults.filter((r) => r.error);
        if (altErrors.length > 0) {
          throw new Error(altErrors[0].error?.message || 'Erro ao atualizar alt text em lote');
        }
        queryClient.invalidateQueries({ queryKey: ['product-images-ext', productId] });
        toast.success(`Alt text atualizado em ${updates.length} imagem(ns)`);
        clearSelection();
      } catch {
        toast.error('Erro ao atualizar alt text em lote');
      } finally {
        setIsBulkUpdating(false);
      }
    },
    [selectedUrls, productId, extImageMap, variantMap, queryClient, clearSelection],
  );

  return {
    // State
    isUploading,
    uploadCount,
    uploadProgress,
    dragIndex,
    dragOverIndex,
    previewUrl,
    editingIndex,
    filterMode,
    typeFilter,
    uploadVariant,
    uploadImageType,
    fileInputRef,
    selectedUrls,
    bulkMode,
    isBulkUpdating,
    isLoadingExt,
    isDragOverZone,
    deleteConfirm,
    setDeleteConfirm,
    // Data
    externalImages,
    variants,
    extImageMap,
    stats,
    variantMap,
    variantImageCounts,
    filteredImages,
    activeTypes,
    // Setters
    setPreviewUrl,
    setEditingIndex,
    setFilterMode,
    setTypeFilter,
    setUploadVariant,
    setUploadImageType,
    setBulkMode,
    setSelectedUrls,
    // Handlers
    updateExternalImageMeta,
    handleFilesChange,
    handleRemove,
    handleSetPrimary,
    handleDragStart,
    handleDragOver,
    handleDrop,
    handleDragEnd,
    handleDropZone,
    handleDropZoneDragOver,
    handleDropZoneDragLeave,
    toggleSelect,
    selectAll,
    clearSelection,
    bulkUpdateType,
    bulkUpdateVariant,
    bulkDelete,
    bulkUpdateAltText,
  };
}
