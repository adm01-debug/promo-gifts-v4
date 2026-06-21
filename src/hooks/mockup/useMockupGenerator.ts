/**
 * useMockupGenerator — Core business logic hook for MockupGenerator page
 *
 * Sprint 1 fixes: T1-T10 (see previous commits)
 * Sprint 2 fixes (audit 26/05/2026):
 * BUG-F: resetForm is now async and awaits clearDraft().
 * BUG-J: isDraftLoading now exposed in return object.
 */

import { dbInvoke } from '@/lib/db/postgrest';
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { toast } from 'sonner';
import { needsConversion, ensureSupportedFormat } from '@/lib/image-converter';
import { useAuth } from '@/contexts/AuthContext';
import {
  useFilteredTechniques,
  useProductCustomizationOptionsForMockup,
  type CustomizationOption,
  type TechniqueWithLimits,
} from './useMockupTechniques';
import { useMockupDraft } from './useMockupDraft';
import { useLogoColorAnalysis, usePositionHistory } from '@/hooks/simulation';
import { useProductsContext } from '@/contexts/ProductsContext';
import { getMockupWizardStep } from '@/components/mockup/mockupWizardStep';
import { showMockupSuccessToast } from '@/components/mockup/MockupSuccessToast';
import type { TechniqueColorConfig } from '@/components/mockup/techniqueColorUtils';
import { adaptTabelaPrecoRows } from '@/lib/personalization/adapters';
import type { PersonalizationArea } from '@/components/mockup/MultiAreaManager';
import type { MockupProductSelection } from '@/components/mockup/MockupProductSelector';
import type { MockupClient } from '@/components/mockup/MockupConfigPanel';
import type { ArtFileAttachment } from '@/components/mockup/ArtFileUpload';
import {
  type Technique,
  type GeneratedMockup,
  createDefaultArea,
  fetchMockupHistory,
  saveMockupToDb,
  generateMockupApi,
  downloadMockupAsPdf,
  deleteMockupFromDb,
} from '@/hooks/mockup/mockupGenerationService';

import { logger } from '@/lib/logger';
export type { Technique, GeneratedMockup };

export function useMockupGenerator() {
  const { user } = useAuth();
  const {
    saveDraft,
    loadDraft,
    clearDraft,
    isSaving: isDraftSaving,
    isLoading: isDraftLoading,
    lastSaved,
    error: draftError,
  } = useMockupDraft();
  const { getProductById } = useProductsContext();

  const [techniques, setTechniques] = useState<Technique[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [productSelection, setProductSelection] = useState<MockupProductSelection | null>(null);
  const [selectedTechnique, setSelectedTechnique] = useState<
    Technique | TechniqueWithLimits | null
  >(null);
  const [selectedClient, setSelectedClient] = useState<MockupClient | null>(null);
  const [personalizationAreas, setPersonalizationAreas] = useState<PersonalizationArea[]>([
    createDefaultArea(),
  ]);
  const [activeAreaId, setActiveAreaId] = useState<string | null>(null);
  const [generatedMockup, setGeneratedMockup] = useState<string | null>(null);
  const [generatedBatchMockups, setGeneratedBatchMockups] = useState<
    { areaName: string; url: string }[]
  >([]);
  const [artAttachments, setArtAttachments] = useState<ArtFileAttachment[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [mockupAnnotations, setMockupAnnotations] = useState<
    { id: string; x: number; y: number; text: string }[]
  >([]);
  const [beforeImage, setBeforeImage] = useState<string | null>(null);
  const [techniqueColorConfig, setTechniqueColorConfig] = useState<TechniqueColorConfig | null>(
    null,
  );
  const [mockupHistory, setMockupHistory] = useState<GeneratedMockup[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [mockupToDelete, setMockupToDelete] = useState<string | null>(null);
  const [lastSavedRecordId, setLastSavedRecordId] = useState<string | null>(null);
  const [lastSavedMockupUrl, setLastSavedMockupUrl] = useState<string | null>(null);
  const [lastSavedLayoutMode, setLastSavedLayoutMode] = useState<'ai' | 'static'>('ai');
  const [hasDraftRestored, setHasDraftRestored] = useState(false);
  const [showDraftRestoredNotice, setShowDraftRestoredNotice] = useState(false);
  const isRestoringDraft = useRef(false);
  const historyPushTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const draftNoticeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [activeTab, setActiveTab] = useState<'generator' | 'history'>('generator');
  const [hasUserInteractedPosition, setHasUserInteractedPosition] = useState(false);

  const logoColorAnalysis = useLogoColorAnalysis();
  const positionHistory = usePositionHistory({ enabled: true });

  useEffect(() => {
    positionHistory.setOnApply((state) => {
      if (!activeAreaId) return;
      setPersonalizationAreas((prev) =>
        prev.map((area) => (area.id === activeAreaId ? { ...area, ...state } : area)),
      );
      toast.info(positionHistory.canRedo ? '↩️ Desfeito' : '↪️ Refeito', { duration: 1000 });
    });
  }, [activeAreaId, positionHistory]);

  useEffect(() => {
    return () => {
      if (historyPushTimeout.current) clearTimeout(historyPushTimeout.current);
    };
  }, []);
  useEffect(() => {
    return () => {
      if (draftNoticeTimeoutRef.current) clearTimeout(draftNoticeTimeoutRef.current);
    };
  }, []);

  const activeArea =
    personalizationAreas.find((a) => a.id === activeAreaId) || personalizationAreas[0];
  const selectedProduct = productSelection?.product ?? null;
  const filteredTechniques = useFilteredTechniques(techniques, selectedProduct);
  const { data: customizationOptions } = useProductCustomizationOptionsForMockup(
    selectedProduct?.id,
  );
  const hasLogo = personalizationAreas.some((a) => !!a.logoPreview);

  const historyClients = useMemo(() => {
    if (!mockupHistory.length) return [];
    const map = new Map<string, { id: string; name: string }>();
    for (const m of mockupHistory) {
      const clientKey = m.client_id || m.client_name;
      if (clientKey && m.client_name && !map.has(clientKey))
        map.set(clientKey, { id: m.client_id || m.client_name, name: m.client_name });
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [mockupHistory]);

  const productLocations = useMemo(() => {
    if (!customizationOptions?.locations?.length) return null;
    return customizationOptions.locations.map((loc) => {
      const opts = loc.options || [];
      const widths = opts
        .map((o: CustomizationOption) => o.efetiva_largura_max || o.max_width || 0)
        .filter(Boolean);
      const heights = opts
        .map((o: CustomizationOption) => o.efetiva_altura_max || o.max_height || 0)
        .filter(Boolean);
      const colors = opts.map((o: CustomizationOption) => o.max_cores || 0).filter(Boolean);
      return {
        code: loc.location_code,
        name: loc.location_name,
        order: loc.location_order,
        maxWidthCm: widths.length ? Math.max(...widths) : null,
        maxHeightCm: heights.length ? Math.max(...heights) : null,
        maxColors: colors.length ? Math.max(...colors) : null,
        isCurved: opts.some((o: CustomizationOption) => o.is_curved === true),
        techniquesAvailable: opts.length,
      };
    });
  }, [customizationOptions]);

  useEffect(() => {
    if (!productLocations || isRestoringDraft.current || !hasDraftRestored) return;
    const newAreas: PersonalizationArea[] = productLocations
      .sort((a, b) => a.order - b.order)
      .map((loc) => ({
        id: crypto.randomUUID(),
        name: loc.name,
        positionX: 50,
        positionY: 50,
        logoWidth: 5,
        logoHeight: 3,
        logoScale: 100,
        logoPreview: null,
        maxWidthCm: loc.maxWidthCm,
        maxHeightCm: loc.maxHeightCm,
        maxColors: loc.maxColors,
        isCurved: loc.isCurved,
        techniquesAvailable: loc.techniquesAvailable,
      }));
    if (newAreas.length > 0) {
      setPersonalizationAreas(newAreas);
      setActiveAreaId(newAreas[0].id);
    }
  }, [productLocations, hasDraftRestored]);

  useEffect(() => {
    if (!activeAreaId && personalizationAreas.length > 0)
      setActiveAreaId(personalizationAreas[0].id);
  }, [activeAreaId, personalizationAreas]);

  useEffect(() => {
    fetchData();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (selectedTechnique && filteredTechniques.length > 0)
      if (!filteredTechniques.some((t) => t.id === selectedTechnique.id))
        setSelectedTechnique(null);
  }, [filteredTechniques, selectedTechnique]);

  useEffect(() => {
    if (!selectedTechnique) return;
    const mw =
      'maxWidth' in selectedTechnique ? (selectedTechnique as TechniqueWithLimits).maxWidth : null;
    const mh =
      'maxHeight' in selectedTechnique
        ? (selectedTechnique as TechniqueWithLimits).maxHeight
        : null;
    if ((!mw || mw <= 0) && (!mh || mh <= 0)) return;
    setPersonalizationAreas((prev) =>
      prev.map((area) => {
        const areaW = area.maxWidthCm && area.maxWidthCm > 0 ? area.maxWidthCm : null;
        const areaH = area.maxHeightCm && area.maxHeightCm > 0 ? area.maxHeightCm : null;
        const effW = mw && areaW ? Math.min(mw, areaW) : mw || areaW;
        const effH = mh && areaH ? Math.min(mh, areaH) : mh || areaH;
        if (!effW || !effH) return area;
        const clampedW = Math.min(area.logoWidth, effW);
        const clampedH = Math.min(area.logoHeight, effH);
        return clampedW !== area.logoWidth || clampedH !== area.logoHeight
          ? { ...area, logoWidth: clampedW, logoHeight: clampedH }
          : area;
      }),
    );
  }, [selectedTechnique]);

  useEffect(() => {
    let isMounted = true;
    const restoreDraft = async () => {
      if (isLoadingData || hasDraftRestored || isRestoringDraft.current) return;
      isRestoringDraft.current = true;
      try {
        const draft = await loadDraft();
        if (!isMounted) return;
        if (
          draft &&
          (draft.productId ||
            draft.techniqueId ||
            draft.personalizationAreas.some((a) => a.logoPreview))
        ) {
          if (draft.productId) {
            const product = getProductById(draft.productId);
            if (product)
              setProductSelection({
                product,
                variant: null,
                imageUrl: product.images?.[0] || '/placeholder.svg',
              });
          }
          if (draft.techniqueId) {
            const technique = techniques.find((t) => t.id === draft.techniqueId);
            if (technique) setSelectedTechnique(technique);
          }
          if (draft.clientId && draft.clientName)
            setSelectedClient({ id: draft.clientId, name: draft.clientName });
          if (draft.personalizationAreas.length > 0) {
            setPersonalizationAreas(draft.personalizationAreas);
            setActiveAreaId(draft.personalizationAreas[0].id);
          }
          setShowDraftRestoredNotice(true);
          if (draftNoticeTimeoutRef.current) clearTimeout(draftNoticeTimeoutRef.current);
          draftNoticeTimeoutRef.current = setTimeout(() => setShowDraftRestoredNotice(false), 5000);
        }
      } catch (err) {
        if (!isMounted) return;
        logger.error('Erro ao restaurar rascunho:', err);
      } finally {
        if (isMounted) setHasDraftRestored(true);
        isRestoringDraft.current = false;
      }
    };
    restoreDraft();
    return () => {
      isMounted = false;
    };
  }, [isLoadingData, techniques, loadDraft, hasDraftRestored, getProductById]);

  const urlParamsApplied = useRef(false);
  useEffect(() => {
    if (urlParamsApplied.current || isLoadingData || !hasDraftRestored) return;
    const params = new URLSearchParams(window.location.search);
    const productId = params.get('product_id');
    if (!productId) return;
    urlParamsApplied.current = true;
    const product = getProductById(productId);
    if (product)
      setProductSelection({
        product,
        variant: null,
        imageUrl: product.images?.[0] || '/placeholder.svg',
      });
    const techniqueName = params.get('technique');
    if (techniqueName && techniques.length > 0) {
      const technique = techniques.find(
        (t) => t.name.toLowerCase() === techniqueName.toLowerCase(),
      );
      if (technique) setSelectedTechnique(technique);
    }
    // T9 FIX: only remove the params we processed — preserve everything else.
    const newParams = new URLSearchParams(window.location.search);
    newParams.delete('product_id');
    newParams.delete('technique');
    const newSearch = newParams.toString();
    window.history.replaceState(
      {},
      '',
      window.location.pathname + (newSearch ? `?${newSearch}` : ''),
    );
  }, [isLoadingData, hasDraftRestored, techniques, getProductById]);

  useEffect(() => {
    if (!hasDraftRestored || isRestoringDraft.current) return;
    const timeout = setTimeout(() => {
      saveDraft({
        productId: productSelection?.product?.id || null,
        productName: productSelection?.product?.name || null,
        techniqueId: selectedTechnique?.id || null,
        techniqueName: selectedTechnique?.name || null,
        clientId: selectedClient?.id || null,
        clientName: selectedClient?.name || null,
        personalizationAreas,
        updatedAt: new Date().toISOString(),
      });
    }, 1000);
    return () => clearTimeout(timeout);
  }, [
    productSelection,
    selectedTechnique,
    selectedClient,
    personalizationAreas,
    saveDraft,
    hasDraftRestored,
  ]);

  useEffect(() => {
    if (user?.id) fetchHistory();
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchData = useCallback(async () => {
    try {
      // MIGRAÇÃO REST-NATIVO (2026-05-30): dbInvoke (REST-native-first, silencioso
      // quando o kill-switch `edge_external_db_bridge` está OFF) em vez do invokeWithRetry
      // legado, que disparava o banner de "catálogo indisponível" no estado OFF esperado.
      // `tabela_preco_gravacao_oficial` está na whitelist do REST nativo e possui coluna `ativo`.
      const { records: rawRecords } = await dbInvoke<Record<string, unknown>>({
        table: 'tabela_preco_gravacao_oficial',
        operation: 'select',
        filters: { ativo: true },
        limit: 100,
        countMode: 'none',
      });
      const records = adaptTabelaPrecoRows(rawRecords ?? []);
      const techniquesData = records.map((r) => ({
        id: r.id,
        name: r.name ?? r.nome ?? '',
        code: r.codigo_curto ?? r.codigo_tabela ?? r.code ?? r.codigo ?? null,
      }));
      techniquesData.sort((a: Technique, b: Technique) =>
        (a.name || '').localeCompare(b.name || ''),
      );
      setTechniques(techniquesData);
    } catch (error) {
      logger.error('Error fetching data:', error);
      toast.error('Erro ao carregar dados. Tente novamente.');
    } finally {
      setIsLoadingData(false);
    }
  }, []);

  const fetchHistory = useCallback(async () => {
    setIsLoadingHistory(true);
    try {
      const data = await fetchMockupHistory(user?.id);
      setMockupHistory(data);
    } catch (error) {
      logger.error('Error fetching history:', error);
    } finally {
      setIsLoadingHistory(false);
    }
  }, [user?.id]);

  const updateActiveArea = useCallback(
    (updates: Partial<PersonalizationArea>) => {
      if (!activeAreaId) return;
      setPersonalizationAreas((prev) => {
        const areaIndex = prev.findIndex((a) => a.id === activeAreaId);
        if (areaIndex === -1) return prev;
        const currentArea = prev[areaIndex];
        const hasChanges = Object.entries(updates).some(
          ([key, value]) => currentArea[key as keyof PersonalizationArea] !== value,
        );
        if (!hasChanges) return prev;
        const newAreas = [...prev];
        newAreas[areaIndex] = { ...currentArea, ...updates };
        return newAreas;
      });
      const isPositioningUpdate =
        'positionX' in updates ||
        'positionY' in updates ||
        'logoWidth' in updates ||
        'logoHeight' in updates ||
        'logoRotation' in updates ||
        'logoScale' in updates;
      if (isPositioningUpdate) {
        setHasUserInteractedPosition(true);
        if (historyPushTimeout.current) clearTimeout(historyPushTimeout.current);
        historyPushTimeout.current = setTimeout(() => {
          setPersonalizationAreas((currentAreas) => {
            const current = currentAreas.find((a) => a.id === activeAreaId);
            if (current)
              positionHistory.pushState({
                positionX: current.positionX,
                positionY: current.positionY,
                logoWidth: current.logoWidth,
                logoHeight: current.logoHeight,
                logoRotation: current.logoRotation ?? 0,
                logoScale: current.logoScale ?? 100,
              });
            return currentAreas;
          });
        }, 300);
      }
    },
    [activeAreaId, positionHistory],
  );

  const handleAreaLogoUpload = useCallback(
    async (areaId: string, file: File) => {
      if (!file.type.startsWith('image/')) {
        toast.error('Por favor, selecione uma imagem válida');
        return;
      }
      // BUG-SVG-UPLOAD FIX: reject SVGs at upload time — the edge function
      // (assertNotSvg) rejects them at generation, but early rejection gives cleaner UX.
      if (file.type === 'image/svg+xml') {
        toast.error('Logos SVG não são suportados. Converta para PNG ou JPG e tente novamente.');
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        toast.error('A imagem deve ter no máximo 10MB');
        return;
      }
      let processedFile = file;
      if (needsConversion(file)) {
        try {
          toast.info(`Convertendo ${file.name} para PNG...`);
          processedFile = await ensureSupportedFormat(file);
          toast.success('Imagem convertida para PNG com sucesso!');
        } catch (err) {
          logger.error('Conversion error:', err);
          toast.error('Erro ao converter imagem. Tente usar PNG ou JPG.');
          return;
        }
      }
      const reader = new FileReader();
      reader.onload = (e) => {
        const logoData = e.target?.result as string;
        setPersonalizationAreas((prev) =>
          prev.map((area) => (area.id === areaId ? { ...area, logoPreview: logoData } : area)),
        );
        logoColorAnalysis.analyzeImage(logoData);
      };
      reader.onerror = (e) => {
        logger.error('[useMockupGenerator] FileReader error ao ler imagem:', e);
        toast.error('Erro ao ler o arquivo de imagem. Tente novamente.');
      };
      reader.readAsDataURL(processedFile);
    },
    [logoColorAnalysis],
  );

  const getProductImage = useCallback((): string | null => {
    if (productSelection?.imageUrl) {
      const url = productSelection.imageUrl;
      return url.endsWith('/thumbnail') ? url.replace('/thumbnail', '') : url;
    }
    return selectedProduct?.images?.[0] || null;
  }, [productSelection, selectedProduct]);

  const saveMockupToHistory = useCallback(
    async (
      mockupUrl: string,
      area: PersonalizationArea,
      extra?: { layoutUrl?: string; locationName?: string; colorsCount?: number },
    ): Promise<string | null> => {
      if (!user || !selectedProduct || !selectedTechnique || !area.logoPreview) return null;
      return saveMockupToDb({
        userId: user.id,
        product: selectedProduct,
        technique: selectedTechnique,
        client: selectedClient,
        area,
        mockupUrl,
        annotations: mockupAnnotations,
        extra,
      });
    },
    [user, selectedProduct, selectedTechnique, selectedClient, mockupAnnotations],
  );

  const downloadMockup = useCallback(
    async (url?: string) => {
      const mockupUrl = url || generatedMockup;
      if (!mockupUrl) return;
      await downloadMockupAsPdf(
        mockupUrl,
        { sku: selectedProduct?.sku ?? null },
        selectedTechnique as Technique,
      );
    },
    [generatedMockup, selectedProduct, selectedTechnique],
  );

  const generateMockup = useCallback(async () => {
    const areasWithLogos = personalizationAreas.filter((a) => a.logoPreview);
    if (!selectedClient || !productSelection || !selectedTechnique || areasWithLogos.length === 0) {
      toast.error('Selecione empresa, produto, técnica e faça upload de pelo menos um logo');
      return;
    }
    const productImage = getProductImage();
    if (!productImage) {
      toast.error('O produto selecionado não possui imagem');
      return;
    }
    // BUG-NO-DIM-VALIDATION FIX: warn if any logo exceeds the technique/area limit.
    // Non-blocking — we still generate; the server will composite what it receives.
    for (const area of areasWithLogos) {
      const techW =
        selectedTechnique && 'maxWidth' in selectedTechnique
          ? (selectedTechnique as TechniqueWithLimits).maxWidth
          : null;
      const techH =
        selectedTechnique && 'maxHeight' in selectedTechnique
          ? (selectedTechnique as TechniqueWithLimits).maxHeight
          : null;
      const maxW = area.maxWidthCm ?? techW;
      const maxH = area.maxHeightCm ?? techH;
      if (maxW && area.logoWidth > maxW + 0.5) {
        toast.warning(
          `"${area.name}": logo ${area.logoWidth.toFixed(1)} cm excede o limite de ${maxW} cm de largura.`,
          { duration: 5000 },
        );
      }
      if (maxH && area.logoHeight > maxH + 0.5) {
        toast.warning(
          `"${area.name}": logo ${area.logoHeight.toFixed(1)} cm excede o limite de ${maxH} cm de altura.`,
          { duration: 5000 },
        );
      }
    }

    setIsLoading(true);
    setGeneratedMockup(null);
    setGeneratedBatchMockups([]);
    setGenerationError(null);
    setMockupAnnotations([]);
    setBeforeImage(productImage);
    try {
      const result = await generateMockupApi({
        productImage,
        productName: selectedProduct?.name ?? '',
        technique: selectedTechnique,
        areas: personalizationAreas,
        // Same derivation the preview uses (LogoPositionEditor) so the generated
        // mockup matches the on-screen logo size (WYSIWYG); null ⇒ edge /20 fallback.
        productWidthCm:
          selectedProduct?.dimensions?.width_cm ??
          selectedProduct?.dimensions?.diameter_cm ??
          (selectedProduct?.metadata?.width_mm ? selectedProduct.metadata.width_mm / 10 : null),
        productHeightCm:
          selectedProduct?.dimensions?.height_cm ??
          (selectedProduct?.metadata?.height_mm ? selectedProduct.metadata.height_mm / 10 : null),
      });
      if (result.singleUrl && result.batchResults.length === 0) {
        setGeneratedMockup(result.singleUrl);
        const recordId = await saveMockupToHistory(result.singleUrl, areasWithLogos[0]);
        if (recordId) {
          setLastSavedMockupUrl(result.singleUrl);
          setLastSavedLayoutMode('ai');
          setLastSavedRecordId(recordId);
        }
        showMockupSuccessToast({
          mockupUrl: result.singleUrl,
          productName: selectedProduct?.name ?? '',
          techniqueName: selectedTechnique.name,
          onDownload: () => downloadMockup(result.singleUrl ?? undefined),
        });
      } else {
        // T5 FIX: parallel DB writes.
        const batchSaveResults = await Promise.allSettled(
          result.batchResults.map((r, i) => {
            const area = areasWithLogos.find((a) => a.name === r.areaName) || areasWithLogos[i];
            return saveMockupToHistory(r.url, area).then((recordId) => ({ recordId, r }));
          }),
        );
        const lastFulfilled = batchSaveResults
          .filter(
            (
              res,
            ): res is PromiseFulfilledResult<{
              recordId: string | null;
              r: { areaName: string; url: string };
            }> => res.status === 'fulfilled',
          )
          .pop();
        if (lastFulfilled?.value.recordId) {
          setLastSavedMockupUrl(lastFulfilled.value.r.url);
          setLastSavedLayoutMode('ai');
          setLastSavedRecordId(lastFulfilled.value.recordId);
        }
        setGeneratedMockup(result.batchResults[0]?.url || result.singleUrl || null);
        setGeneratedBatchMockups(result.batchResults);
        toast.success(`${result.batchResults.length} mockups gerados com sucesso!`);
      }
      // BUG-3 FIX: history panel was stale after generation because fetchHistory() was
      // only called once on mount. Refresh it now so the new record appears immediately.
      fetchHistory();
    } catch (error: unknown) {
      logger.error('Error generating mockup:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erro ao gerar mockup';
      setGenerationError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [
    selectedClient,
    productSelection,
    selectedTechnique,
    personalizationAreas,
    getProductImage,
    saveMockupToHistory,
    selectedProduct,
    downloadMockup,
    fetchHistory,
  ]);

  const deleteMockup = useCallback(async () => {
    if (!mockupToDelete) return;
    try {
      await deleteMockupFromDb(mockupToDelete, user?.id);
      setMockupHistory((prev) => prev.filter((m) => m.id !== mockupToDelete));
      toast.success('Mockup excluído');
    } catch (error) {
      logger.error('Error deleting mockup:', error);
      toast.error('Erro ao excluir mockup');
    } finally {
      setDeleteDialogOpen(false);
      setMockupToDelete(null);
    }
  }, [mockupToDelete, user]);

  // BUG-F FIX: async + await clearDraft() to prevent race with 1s auto-save debounce.
  const resetForm = useCallback(async () => {
    setProductSelection(null);
    setSelectedTechnique(null);
    setSelectedClient(null);
    setPersonalizationAreas([createDefaultArea()]);
    setActiveAreaId(null);
    setGeneratedMockup(null);
    setGeneratedBatchMockups([]);
    setArtAttachments([]);
    setGenerationError(null);
    setMockupAnnotations([]);
    setBeforeImage(null);
    setHasUserInteractedPosition(false);
    setTechniqueColorConfig(null);
    setLastSavedRecordId(null);
    setLastSavedMockupUrl(null);
    setLastSavedLayoutMode('ai');
    positionHistory.clear();
    await clearDraft();
    logoColorAnalysis.clearAnalysis();
  }, [positionHistory, clearDraft, logoColorAnalysis]);

  const handleShareMockup = useCallback((mockup: GeneratedMockup) => {
    const text = `Confira o mockup: ${mockup.product_name} com ${mockup.technique_name}`;
    window.open(
      `https://wa.me/?text=${encodeURIComponent(`${text}\n${mockup.mockup_url}`)}`,
      '_blank',
    );
  }, []);

  const loadFromHistory = useCallback(
    async (mockup: GeneratedMockup) => {
      const product = mockup.product_id ? getProductById(mockup.product_id) : null;
      // BUG-11 FIX: technique_id is now always null (BUG-10 fix) because the FK points to
      // personalization_techniques but the UI loads from tabela_preco_gravacao_oficial.
      // Fall back to name-matching so the technique is correctly pre-selected when loading from history.
      const technique =
        (mockup.technique_id && techniques.find((t) => t.id === mockup.technique_id)) ||
        (mockup.technique_name &&
          techniques.find((t) => t.name.toLowerCase() === mockup.technique_name?.toLowerCase())) ||
        null;
      if (product)
        setProductSelection({
          product,
          variant: null,
          imageUrl: product.images?.[0] || '/placeholder.svg',
        });
      else setProductSelection(null);
      setSelectedTechnique(technique || null);
      // BUG-LOADFROMHISTORY-CLIENT FIX: client_id was always null (BUG-CLIENT-ID) so
      // the client was never restored. Use client_name as fallback for old rows.
      // After migration 20260620000001, new rows have a real client_id.
      setSelectedClient(
        mockup.client_id || mockup.client_name
          ? {
              id: mockup.client_id ?? mockup.client_name ?? '',
              name: mockup.client_name || 'Cliente',
            }
          : null,
      );
      const restoredArea: PersonalizationArea = {
        id: crypto.randomUUID(),
        name: mockup.location_name ?? 'Frente',
        positionX: mockup.position_x ?? 50,
        positionY: mockup.position_y ?? 50,
        logoWidth: mockup.logo_width_cm ?? 5,
        logoHeight: mockup.logo_height_cm ?? 3,
        logoRotation: mockup.logo_rotation ?? 0,
        logoScale: mockup.logo_scale ?? 100,
        logoPreview: mockup.logo_url,
      };
      setPersonalizationAreas([restoredArea]);
      setActiveAreaId(restoredArea.id);
      setGeneratedMockup(null);
      setHasUserInteractedPosition(true);
      positionHistory.clear();
      setActiveTab('generator');
      if (mockup.logo_url) logoColorAnalysis.analyzeImage(mockup.logo_url);
      // BUG-04 FIX: clear stale draft.
      // BUG-F-LOADHISTORY FIX: await clearDraft() — same race as resetForm (BUG-F).
      // Without await, the 1 s auto-save debounce can fire and re-persist the old draft.
      await clearDraft();
      toast.success('Configurações carregadas!');
    },
    [techniques, getProductById, logoColorAnalysis, clearDraft, positionHistory],
  );

  const wizardStep = getMockupWizardStep({
    hasClient: !!selectedClient,
    hasProduct: !!selectedProduct,
    hasTechnique: !!selectedTechnique,
    hasLogo,
    hasPositioned: hasUserInteractedPosition,
    hasGenerated: !!generatedMockup,
  });

  return useMemo(
    () => ({
      user,
      techniques,
      isLoadingData,
      productSelection,
      setProductSelection,
      selectedProduct,
      selectedTechnique,
      setSelectedTechnique,
      selectedClient,
      setSelectedClient,
      personalizationAreas,
      setPersonalizationAreas,
      activeAreaId,
      setActiveAreaId,
      activeArea,
      updateActiveArea,
      handleAreaLogoUpload,
      productLocations,
      generatedMockup,
      setGeneratedMockup,
      generatedBatchMockups,
      artAttachments,
      setArtAttachments,
      isLoading,
      generationError,
      setGenerationError,
      generateMockup,
      downloadMockup,
      mockupAnnotations,
      setMockupAnnotations,
      beforeImage,
      mockupHistory,
      isLoadingHistory,
      deleteDialogOpen,
      setDeleteDialogOpen,
      mockupToDelete,
      setMockupToDelete,
      deleteMockup,
      loadFromHistory,
      handleShareMockup,
      historyClients,
      lastSavedRecordId,
      setLastSavedRecordId,
      lastSavedMockupUrl,
      setLastSavedMockupUrl,
      lastSavedLayoutMode,
      setLastSavedLayoutMode,
      isDraftSaving,
      isDraftLoading,
      lastSaved,
      draftError,
      showDraftRestoredNotice,
      activeTab,
      setActiveTab,
      wizardStep,
      hasLogo,
      hasUserInteractedPosition,
      positionHistory,
      logoColorAnalysis,
      techniqueColorConfig,
      setTechniqueColorConfig,
      filteredTechniques,
      getProductImage,
      resetForm,
      saveMockupToHistory,
      fetchHistory,
    }),
    [
      user,
      techniques,
      isLoadingData,
      productSelection,
      selectedProduct,
      selectedTechnique,
      selectedClient,
      personalizationAreas,
      activeAreaId,
      activeArea,
      updateActiveArea,
      handleAreaLogoUpload,
      productLocations,
      generatedMockup,
      generatedBatchMockups,
      artAttachments,
      isLoading,
      generationError,
      generateMockup,
      downloadMockup,
      mockupAnnotations,
      beforeImage,
      mockupHistory,
      isLoadingHistory,
      deleteDialogOpen,
      mockupToDelete,
      deleteMockup,
      loadFromHistory,
      handleShareMockup,
      historyClients,
      lastSavedRecordId,
      lastSavedMockupUrl,
      lastSavedLayoutMode,
      isDraftSaving,
      isDraftLoading,
      lastSaved,
      draftError,
      showDraftRestoredNotice,
      activeTab,
      wizardStep,
      hasLogo,
      hasUserInteractedPosition,
      positionHistory,
      logoColorAnalysis,
      techniqueColorConfig,
      filteredTechniques,
      getProductImage,
      resetForm,
      saveMockupToHistory,
      fetchHistory,
    ],
  );
}
