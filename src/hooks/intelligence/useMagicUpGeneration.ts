/**
 * Generation + download/share/favorite handlers extracted from useMagicUpState
 */
import { useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { sanitizeError } from '@/lib/security/sanitize-error';
import type { Json, TablesInsert } from '@/integrations/supabase/types';
import {
  type VariationItem,
  type MagicUpProduct,
  type Technique,
  type SelectedClient,
  type ProductColor,
} from '@/hooks/intelligence/useMagicUpState';
import type { ScenePrompt } from '@/components/magic-up/PromptBank';
import type { GenerationHistoryItem } from '@/components/magic-up/AdImageResult';
import {
  buildQualityDiagnosis,
  type MagicUpBatchVariant,
  type MagicUpBrandKit,
  type MagicUpBrief,
  type MagicUpCampaign,
  type MagicUpCopyPack,
  type MagicUpCreativeControls,
  type MagicUpCurationStatus,
  type MagicUpQualityDiagnosis,
  type MagicUpQualityScore,
  type MagicUpRefinement,
} from '@/pages/magic-up/magicUpStrategy';
import { createClientLogger } from '@/lib/telemetry/structuredLogger';

import { logger } from '@/lib/logger';
const toJson = (value: unknown): Json => value as Json;
const toJsonRecord = (value: Json | null | undefined): Record<string, Json> =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, Json>)
    : {};

interface GenerationDeps {
  selectedProduct: MagicUpProduct | null;
  currentImage: string | null;
  logoPreview: string | null;
  effectivePrompt: string;
  selectedColor: ProductColor | null;
  selectedTechnique: Technique | null;
  selectedLocationName: string | null;
  selectedScene: ScenePrompt | null;
  selectedClient: SelectedClient | null;
  userId: string | undefined;
  brief: MagicUpBrief;
  creativeControls: MagicUpCreativeControls;
  qualityScore: MagicUpQualityScore;
  copyPack: MagicUpCopyPack;
  fullPromptPreview: string;
  activeCampaign: MagicUpCampaign | null;
  brandKit: MagicUpBrandKit;
  brandNotes: string;
  activeRefinement: MagicUpRefinement | null;
  /**
   * Magic Up modo de geração:
   * - 'pro' (default): Gemini 3 Pro Image Preview, qualidade máxima
   * - 'fast': Gemini 2.5 Flash Image Preview ("nano-banana"), mais rápido/barato
   *   para iterações e refinamentos
   */
  imageModel?: 'fast' | 'pro';
}

export function useMagicUpGeneration(deps: GenerationDeps) {
  const queryClient = useQueryClient();
  const [generating, setGenerating] = useState(false);
  const [variations, setVariations] = useState<VariationItem[]>([]);
  const [activeVariation, setActiveVariation] = useState(0);
  const [qualityDiagnosis, setQualityDiagnosis] = useState<MagicUpQualityDiagnosis>(() =>
    buildQualityDiagnosis(deps.qualityScore),
  );
  const [curationStatus, setCurationStatus] = useState<MagicUpCurationStatus>('draft');

  const canGenerate = !!(
    deps.selectedProduct &&
    deps.currentImage &&
    deps.logoPreview &&
    deps.effectivePrompt
  );
  const currentVariation = variations[activeVariation] || null;

  const analyzeQuality = useCallback(
    async (
      imageUrl: string,
      variantBrief: MagicUpBrief,
      variantControls: MagicUpCreativeControls,
    ): Promise<MagicUpQualityDiagnosis> => {
      const fallback = buildQualityDiagnosis(deps.qualityScore);
      const log = createClientLogger('magicUp.score');
      log.info('score_start', { channel: variantBrief.channel });
      try {
        const { data, error } = await supabase.functions.invoke<MagicUpQualityDiagnosis>(
          'magic-up-score',
          {
            body: {
              imageUrl,
              productName: deps.selectedProduct?.name,
              clientName: deps.selectedClient?.name || deps.activeCampaign?.clientName,
              campaignBrief: variantBrief,
              brandKit: deps.brandKit,
              creativeControls: variantControls,
              promptText: deps.fullPromptPreview || deps.effectivePrompt,
              channel: variantBrief.channel,
              aspectRatio: variantControls.aspectRatio,
            },
            headers: log.headers(),
          },
        );
        if (error || !data) throw error || new Error('Score indisponível');
        log.info('score_ok', { total: data.total, source: data.source });
        return { ...data, source: data.source || 'ai' };
      } catch (error) {
        log.warn('score_fallback', { err: error });
        return fallback;
      }
    },
    [deps],
  );

  const handleGenerate = useCallback(
    async (batchVariant?: MagicUpBatchVariant) => {
      if (!canGenerate) return;
      const selectedProduct = deps.selectedProduct;
      const logoPreview = deps.logoPreview;
      if (!selectedProduct || !logoPreview) return;

      setGenerating(true);
      const log = createClientLogger('magicUp.generate', {
        base: { productId: deps.selectedProduct?.id, channel: deps.brief.channel },
      });
      log.info('generate_start', { batch: batchVariant?.id ?? null });
      try {
        const isLogoUrl = logoPreview.startsWith('http');
        const variantBrief = batchVariant
          ? {
              ...deps.brief,
              channel: batchVariant.channel || deps.brief.channel,
              tone: batchVariant.tone || deps.brief.tone,
            }
          : deps.brief;
        const variantControls = batchVariant?.aspectRatio
          ? { ...deps.creativeControls, aspectRatio: batchVariant.aspectRatio }
          : deps.creativeControls;
        const variantPrompt = [
          batchVariant?.scenePrompt || deps.effectivePrompt,
          batchVariant?.refinementInstruction || deps.activeRefinement?.instruction,
        ]
          .filter(Boolean)
          .join('\n\nREFINEMENT INSTRUCTION: ');
        const { data, error } = await supabase.functions.invoke('generate-ad-image', {
          headers: log.headers(),
          body: {
            productImageUrl: deps.currentImage,
            logoBase64: isLogoUrl ? undefined : logoPreview,
            logoUrl: isLogoUrl ? logoPreview : undefined,
            productName: selectedProduct.name,
            productColor: deps.selectedColor?.name || null,
            techniqueName: deps.selectedTechnique?.name || null,
            locationName: deps.selectedLocationName || null,
            scenePrompt: variantPrompt,
            sceneCategory: deps.selectedScene?.category || batchVariant?.id || 'custom',
            brandColorHex: deps.selectedClient?.cor_primaria_hex || null,
            brandColorName: deps.selectedClient?.cor_primaria_nome || null,
            campaignBrief: variantBrief,
            outputChannel: variantBrief.channel,
            aspectRatio: variantControls.aspectRatio,
            qualityMode: variantControls.qualityMode,
            compositionMode: variantControls.composition,
            creativeMode: variantControls.creativeMode,
            negativePrompt: variantControls.negativePrompt,
            brandKit: {
              primaryColor: deps.brandKit.primaryColor,
              secondaryColor: deps.brandKit.secondaryColor,
              toneOfVoice: deps.brandKit.toneOfVoice,
              visualStyle: deps.brandKit.visualStyle,
              requiredWords: deps.brandKit.requiredWords,
              forbiddenWords: deps.brandKit.forbiddenWords,
              notes: deps.brandNotes,
            },
            refinementInstruction:
              batchVariant?.refinementInstruction || deps.activeRefinement?.instruction || null,
            batchVariant: batchVariant || null,
            imageModel: deps.imageModel ?? 'pro',
          },
        });
        if (error) throw error;
        if (data?.imageUrl) {
          let genId: string | null = null;
          const diagnosis = await analyzeQuality(data.imageUrl, variantBrief, variantControls);
          setQualityDiagnosis(diagnosis);
          setCurationStatus('draft');
          if (deps.userId) {
            const generationPayload: TablesInsert<'magic_up_generations'> = {
              user_id: deps.userId,
              campaign_id: deps.activeCampaign?.id || null,
              product_name: selectedProduct.name,
              product_id: selectedProduct.id,
              product_sku: selectedProduct.sku,
              scene_title: deps.selectedScene?.title || null,
              scene_category: deps.selectedScene?.category || batchVariant?.id || 'custom',
              generated_image_url: data.imageUrl,
              client_name: deps.selectedClient?.name || deps.activeCampaign?.clientName || null,
              prompt_text: deps.fullPromptPreview || deps.effectivePrompt,
              model: data.model || 'magic-up-pro',
              channel: data.outputChannel || variantBrief.channel,
              aspect_ratio: data.aspectRatio || variantControls.aspectRatio,
              quality_score: diagnosis.total,
              status: 'draft',
              tags: [
                variantBrief.channel,
                variantBrief.objective,
                variantBrief.tone,
                batchVariant?.id,
              ].filter((tag): tag is string => Boolean(tag)),
              copy_pack: deps.copyPack,
              export_presets: ['png', 'jpg-whatsapp', variantControls.aspectRatio],
              metadata: {
                brief: variantBrief,
                creativeControls: variantControls,
                qualityScore: diagnosis.total,
                qualityDiagnosis: diagnosis,
                qualitySource: diagnosis.source,
                curation: { status: 'draft', selectedAt: new Date().toISOString() },
                campaign: deps.activeCampaign,
                brandKit: deps.brandKit,
                brandNotes: deps.brandNotes,
                refinement: deps.activeRefinement,
                batch: batchVariant || null,
                functionResult: {
                  qualityMode: data.qualityMode,
                  aspectRatio: data.aspectRatio,
                  creativeMode: data.creativeMode,
                  compositionMode: data.compositionMode,
                },
              },
            };
            const { data: inserted, error: insertError } = await supabase
              .from('magic_up_generations')
              .insert(generationPayload)
              .select('id')
              .single();
            if (insertError) {
              toast.warning('Imagem gerada, mas não foi salva no histórico.');
              logger.error('Magic Up history insert error:', insertError);
            }
            if (inserted) genId = inserted.id;
            queryClient.invalidateQueries({ queryKey: ['magic-up-history'] });
          }
          const newVariation: VariationItem = {
            id: genId,
            imageUrl: data.imageUrl,
            isFavorite: false,
            qualityScore: diagnosis.total,
            qualityDiagnosis: diagnosis,
            curationStatus: 'draft',
          };
          setVariations((prev) => {
            setActiveVariation(prev.length);
            return [...prev, newVariation];
          });
          log.info('generate_ok', { qualityScore: diagnosis.total, hasGenId: !!genId });
          toast.success('🎉 Imagem publicitária gerada com sucesso!');
        } else {
          throw new Error(data?.error || 'Nenhuma imagem retornada');
        }
      } catch (err: unknown) {
        log.error('generate_failed', { err });
        toast.error('Erro ao gerar imagem', { description: sanitizeError(err) });
      } finally {
        setGenerating(false);
      }
    },
    [analyzeQuality, canGenerate, deps, queryClient],
  );

  const handleRunQualityScore = useCallback(async () => {
    if (!currentVariation?.imageUrl) return;
    const diagnosis = await analyzeQuality(
      currentVariation.imageUrl,
      deps.brief,
      deps.creativeControls,
    );
    setQualityDiagnosis(diagnosis);
    setVariations((prev) =>
      prev.map((variation, index) =>
        index === activeVariation
          ? { ...variation, qualityScore: diagnosis.total, qualityDiagnosis: diagnosis }
          : variation,
      ),
    );
    if (currentVariation.id) {
      const { data: existing } = await supabase
        .from('magic_up_generations')
        .select('metadata,status')
        .eq('id', currentVariation.id)
        .maybeSingle();
      const metadata = toJsonRecord(existing?.metadata);
      const status = (existing?.status as MagicUpCurationStatus | null) || curationStatus;
      await supabase
        .from('magic_up_generations')
        .update({
          quality_score: diagnosis.total,
          metadata: {
            ...metadata,
            qualityScore: diagnosis.total,
            qualityDiagnosis: toJson(diagnosis),
            qualitySource: diagnosis.source,
            curation: toJson({
              ...toJsonRecord(metadata.curation),
              status,
              scoreUpdatedAt: new Date().toISOString(),
            }),
          },
        })
        .eq('id', currentVariation.id);
      queryClient.invalidateQueries({ queryKey: ['magic-up-history'] });
    }
    toast.success('Magic Score atualizado');
  }, [
    activeVariation,
    analyzeQuality,
    currentVariation,
    curationStatus,
    deps.brief,
    deps.creativeControls,
    queryClient,
  ]);

  const handleSetCurationStatus = useCallback(
    async (status: MagicUpCurationStatus) => {
      setCurationStatus(status);
      setVariations((prev) =>
        prev.map((variation, index) =>
          index === activeVariation ? { ...variation, curationStatus: status } : variation,
        ),
      );
      if (currentVariation?.id) {
        const { data: existing } = await supabase
          .from('magic_up_generations')
          .select('metadata')
          .eq('id', currentVariation.id)
          .maybeSingle();
        const metadata = toJsonRecord(existing?.metadata);
        await supabase
          .from('magic_up_generations')
          .update({
            status,
            metadata: {
              ...metadata,
              curation: toJson({
                ...toJsonRecord(metadata.curation),
                status,
                updatedAt: new Date().toISOString(),
              }),
            },
          })
          .eq('id', currentVariation.id);
        queryClient.invalidateQueries({ queryKey: ['magic-up-history'] });
      }
    },
    [activeVariation, currentVariation?.id, queryClient],
  );

  const handleSelectWinningVariation = useCallback(
    (index: number) => {
      setActiveVariation(index);
      const selected = variations[index];
      if (selected?.qualityDiagnosis) setQualityDiagnosis(selected.qualityDiagnosis);
      if (selected?.curationStatus) setCurationStatus(selected.curationStatus);
      setVariations((prev) =>
        prev.map((variation, i) => ({ ...variation, isWinner: i === index })),
      );
      toast.success(`Variação ${index + 1} marcada como vencedora`);
    },
    [variations],
  );

  const handleDownload = useCallback(
    async (format: 'jpg' | 'png' = 'png') => {
      if (!currentVariation?.imageUrl) return;
      try {
        const resp = await fetch(currentVariation.imageUrl);
        const blob = await resp.blob();
        let finalBlob = blob;
        if (format === 'jpg' && blob.type !== 'image/jpeg') {
          const canvas = document.createElement('canvas');
          const img = new Image();
          img.crossOrigin = 'anonymous';
          const imageUrl = URL.createObjectURL(blob);
          await new Promise<void>((resolve, reject) => {
            img.onload = () => {
              canvas.width = img.width;
              canvas.height = img.height;
              const ctx = canvas.getContext('2d');
              if (!ctx) {
                reject(new Error('Canvas 2D context is unavailable'));
                return;
              }
              ctx.fillStyle = '#FFFFFF';
              ctx.fillRect(0, 0, canvas.width, canvas.height);
              ctx.drawImage(img, 0, 0);
              canvas.toBlob(
                (b) => {
                  if (!b) {
                    reject(new Error('Failed to convert image to JPEG'));
                    return;
                  }
                  finalBlob = b;
                  resolve();
                },
                'image/jpeg',
                0.85,
              );
            };
            img.onerror = () => reject(new Error('Failed to load image for JPEG conversion'));
            img.src = imageUrl;
          }).finally(() => {
            URL.revokeObjectURL(imageUrl);
          });
        }
        const url = URL.createObjectURL(finalBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `magic-up-${deps.selectedProduct?.sku || 'ad'}-${Date.now()}.${format}`;
        a.click();
        URL.revokeObjectURL(url);
      } catch {
        toast.error('Erro ao baixar imagem');
      }
    },
    [currentVariation, deps.selectedProduct],
  );

  const handleShare = useCallback(() => {
    if (!currentVariation?.imageUrl) return;
    const clientGreeting = deps.selectedClient ? `Olá ${deps.selectedClient.name}! ` : '';
    const text =
      deps.copyPack.whatsapp ||
      `${clientGreeting}✨ Confira a imagem publicitária: ${deps.selectedProduct?.name}${deps.selectedColor ? ` (${deps.selectedColor.name})` : ''} com ${deps.selectedTechnique?.name || 'personalização'}`;
    window.open(
      `https://wa.me/?text=${encodeURIComponent(`${text}\n${currentVariation.imageUrl}`)}`,
      '_blank',
    );
  }, [currentVariation, deps]);

  const handleToggleFavorite = useCallback(async () => {
    if (!currentVariation?.id) return;
    const newVal = !currentVariation.isFavorite;
    setVariations((prev) =>
      prev.map((v, i) => (i === activeVariation ? { ...v, isFavorite: newVal } : v)),
    );
    // BUG-MAGICUP-FAVORITE-SILENT-FAIL FIX: bare await swallowed RLS errors;
    // on failure the optimistic UI update above was not rolled back.
    const { error: favErr } = await supabase
      .from('magic_up_generations')
      .update({ is_favorite: newVal })
      .eq('id', currentVariation.id);
    if (favErr) logger.warn('[magic-up] Toggle favorite failed:', favErr);
    queryClient.invalidateQueries({ queryKey: ['magic-up-history'] });
  }, [currentVariation, activeVariation, queryClient]);

  const handleToggleHistoryFavorite = useCallback(
    async (id: string, current: boolean) => {
      // BUG-MAGICUP-HISTORY-FAVORITE-SILENT-FAIL FIX: bare await swallowed errors.
      const { error: favErr } = await supabase
        .from('magic_up_generations')
        .update({ is_favorite: !current })
        .eq('id', id);
      if (favErr) logger.warn('[magic-up] Toggle history favorite failed:', favErr);
      queryClient.invalidateQueries({ queryKey: ['magic-up-history'] });
    },
    [queryClient],
  );

  const handleDeleteHistory = useCallback(
    async (id: string) => {
      // BUG-MAGICUP-DELETE-SILENT-FAIL FIX: bare await swallowed RLS denials;
      // the success toast fired even when the DB row was not deleted.
      const { error: delErr } = await supabase
        .from('magic_up_generations')
        .delete()
        .eq('id', id);
      if (delErr) {
        logger.warn('[magic-up] Delete history failed:', delErr);
        return;
      }
      queryClient.invalidateQueries({ queryKey: ['magic-up-history'] });
      toast.success('Imagem removida do histórico');
    },
    [queryClient],
  );

  const handleSelectHistory = useCallback((item: GenerationHistoryItem) => {
    const diagnosis = item.metadata?.qualityDiagnosis;
    const newVar: VariationItem = {
      id: item.id,
      imageUrl: item.generated_image_url,
      isFavorite: item.is_favorite,
      qualityScore: item.quality_score || undefined,
      qualityDiagnosis: diagnosis,
      curationStatus: item.status as MagicUpCurationStatus,
    };
    setVariations([newVar]);
    setActiveVariation(0);
    if (diagnosis) setQualityDiagnosis(diagnosis);
    if (item.status) setCurationStatus(item.status as MagicUpCurationStatus);
  }, []);

  return {
    generating,
    variations,
    activeVariation,
    setActiveVariation,
    currentVariation,
    canGenerate,
    setVariations,
    qualityDiagnosis,
    curationStatus,
    handleGenerate,
    handleDownload,
    handleShare,
    handleRunQualityScore,
    handleSetCurationStatus,
    handleSelectWinningVariation,
    handleToggleFavorite,
    handleToggleHistoryFavorite,
    handleDeleteHistory,
    handleSelectHistory,
  };
}
