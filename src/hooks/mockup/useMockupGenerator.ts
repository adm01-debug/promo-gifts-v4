/**
 * useMockupGenerator — Core business logic hook for MockupGenerator page
 *
 * Performance Optimized:
 * - Lazy initialization of techniques and history.
 * - Memoized computed values (historyClients, productLocations).
 * - Debounced position history persistence.
 *
 * Fixes (audit 26/05/2026):
 * T1: 7 async handlers wrapped in useCallback → useMemo output is now truly stable.
 * T2: Correct dependency arrays eliminate stale-closure bugs.
 * T3: historyPushTimeout and draftNoticeTimeoutRef cleaned up on unmount (no memory leaks).
 * T5: Batch DB saves parallelised with Promise.allSettled (was sequential waterfall).
 * T6: deleteMockupFromDb receives userId → owner-scoped DELETE.
 * T9: URL param cleanup only removes processed keys, preserves unrelated params.
 */

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
import { invokeWithRetry, extractFunctionErrorMessage } from '@/lib/external-db/invoke';
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

// Re-export types for consumers
export type { Technique, GeneratedMockup };

export function useMockupGenerator() {
  const { user } = useAuth();
  const {
    saveDraft,
    loadDraft,
    clearDraft,
    isSaving: isDraftSaving,
    lastSaved,
    error: draftError,
  } = useMockupDraft();
  const { getProductById } = useProductsContext();

  // Data state
  const [techniques, setTechniques] = useState<Technique[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);

  // Selection state
  const [productSelection, setProductSelection] = useState<MockupProductSelection | null>(null);
  const [selectedTechnique, setSelectedTechnique] = useState<
    Technique | TechniqueWithLimits | null
  >(null);
  const [selectedClient, setSelectedClient] = useState<MockupClient | null>(null);

  // Multi-area
  const [personalizationAreas, setPersonalizationAreas] = useState<PersonalizationArea[]>([
    createDefaultArea(),
  ]);
  const [activeAreaId, setActiveAreaId] = useState<string | null>(null);

  // Generation
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

  // Technique color configuration
  const [techniqueColorConfig, setTechniqueColorConfig] = useState<TechniqueColorConfig | null>(
    null,
  );

  // History
  const [mockupHistory, setMockupHistory] = useState<GeneratedMockup[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [mockupToDelete, setMockupToDelete] = useState<string | null>(null);
  const [lastSavedRecordId, setLastSavedRecordId] = useState<string | null>(null);
  const [lastSavedMockupUrl, setLastSavedMockupUrl] = useState<string | null>(null);
  const [lastSavedLayoutMode, setLastSavedLayoutMode] = useState<'ai' | 'static'>('ai');

  // Draft
  const [hasDraftRestored, setHasDraftRestored] = useState(false);
  const [showDraftRestoredNotice, setShowDraftRestoredNotice] = useState(false);
  const isRestoringDraft = useRef(false);

  // T3 FIX: refs for debounced timeouts — cleaned up on unmount to prevent memory leaks.
  const historyPushTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const draftNoticeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Tab & positioning
  const [activeTab, setActiveTab] = useState<'generator' | 'history'>('generator');
  const [hasUserInteractedPosition, setHasUserInteractedPosition] = useState(false);

  // Logo color analysis
  const logoColorAnalysis = useLogoColorAnalysis();

  // Undo/Redo
  const positionHistory = usePositionHistory({ enabled: true });

  useEffect(() => {
    positionHistory.setOnApply((state) => {
      if (!activeAreaId) return;
      setPersonalizationAreas((prev) =>
        prev.map((area) => (area.id === activeAreaId ? { ...area, ...state } : area)),
      );
      // BUG-08 FIX: labels now reflect the action ALREADY performed, not the future action.
      // canRedo=true means we just applied an undo -> show "Desfeito"; otherwise -> "Refeito".
      toast.info(positionHistory.canRedo ? 'Desfeito' : 'Refeito', { duration: 1000 });
    });
  }, [activeAreaId, positionHistory]);

  // T3 FIX: cleanup historyPushTimeout on unmount.
  useEffect(() => {
    return () => {
      if (historyPushTimeout.current) clearTimeout(historyPushTimeout.current);
    };
  }, []);

  // T3 FIX: cleanup draftNoticeTimeoutRef on unmount.
  useEffect(() => {
    return () => {
      if (draftNoticeTimeoutRef.current) clearTimeout(draftNoticeTimeoutRef.current);
    };
  }, []);

  // Derived state

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
    for (let i = 0; i < mockupHistory.length; i++) {
      const m = mockupHistory[i];
      const clientKey = m.client_id || m.client_name;
      if (clientKey && m.client_name && !map.has(clientKey)) {
        map.set(clientKey, { id: m.client_id || m.client_name, name: m.client_name });
      }
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

  // Effects

  // BUG-05 FIX: guard with hasDraftRestored so a product selection made BEFORE draft restoration
  // completes does not stomp the restored areas.
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

  // BUG-03 FIX: removed fetchHistory() from here to avoid double call on mount.
  useEffect(() => {
    fetchData();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (selectedTechnique && filteredTechniques.length > 0) {
      if (!filteredTechniques.some((t) => t.id === selectedTechnique.id))
        setSelectedTechnique(null);
    }
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

  // Draft restoration
  useEffect(() => {
    const restoreDraft = async () => {
      if (isLoadingData || hasDraftRestored || isRestoringDraft.current) return;
      isRestoringDraft.current = true;
      try {
        const draft = await loadDraft();
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
          // T3 FIX: cancel any previous timer before scheduling a new one.
          if (draftNoticeTimeoutRef.current) clearTimeout(draftNoticeTimeoutRef.current);
          draftNoticeTimeoutRef.current = setTimeout(
            () => setShowDraftRestoredNotice(false),
            5000,
          );
        }
      } catch (err) {
        console.error('Erro ao restaurar rascunho:', err);
      } finally {
        setHasDraftRestored(true);
        isRestoringDraft.current = false;
      }
    };
    restoreDraft();
  }, [isLoadingData, techniques, loadDraft, hasDraftRestored, getProductById]);

  // URL param pre-selection
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

  // Auto-save with debounce
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

  // Data fetching

  const fetchData = useCallback(async () => {
    try {
      const { data: techniquesRes, error: techniquesErr } = await invokeWithRetry({
        table: 'tabela_preco_gravacao_oficial',
        operation: 'select',
        filters: { ativo: true },
        limit: 100,
        countMode: 'none',
      });
      if (techniquesErr) {
        const msg = await extractFunctionErrorMessage(techniquesErr);
        console.error('Error fetching techniques:', msg);
        toast.error('Erro ao carregar tecnicas. Tente recarregar a pagina.');
        return;
      }
      const res = techniquesRes as
        | { data?: { records?: Record<string, unknown>[] }; records?: Record<string, unknown>[] }
        | null
        | undefined;
      const records = adaptTabelaPrecoRows(res?.data?.records || res?.records || []);
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
      console.error('Error fetching data:', error);
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
      console.error('Error fetching history:', error);
    } finally {
      setIsLoadingHistory(false);
    }
  }, [user?.id]);

  // Handlers

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
            if (current) {
              positionHistory.pushState({
                positionX: current.positionX,
                positionY: current.positionY,
                logoWidth: current.logoWidth,
                logoHeight: current.logoHeight,
                logoRotation: current.logoRotation ?? 0,
                logoScale: current.logoScale ?? 100,
              });
            }
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
        toast.error('Por favor, selecione uma imagem valida');
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        toast.error('A imagem deve ter no maximo 5MB');
        return;
      }

      let processedFile = file;
      if (needsConversion(file)) {
        try {
          toast.info(`Convertendo ${file.name} para PNG...`);
          processedFile = await ensureSupportedFormat(file);
          toast.success('Imagem convertida para PNG com sucesso!');
        } catch (err) {
          console.error('Conversion error:', err);
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

  // T1/T2 FIX: wrapped in useCallback with correct deps.
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

  // T1/T2 FIX: wrapped in useCallback.
  const downloadMockup = useCallback(
    async (url?: string) => {
      const mockupUrl = url || generatedMockup;
      if (!mockupUrl) return;
      await downloadMockupAsPdf(mockupUrl, selectedProduct?.sku, selectedTechnique?.name);
    },
    [generatedMockup, selectedProduct, selectedTechnique],
  );

  // T1/T2 FIX: wrapped in useCallback.
  // T5 FIX: batch DB saves parallelised with Promise.allSettled.
  const generateMockup = useCallback(async () => {
    const areasWithLogos = personalizationAreas.filter((a) => a.logoPreview);
    if (!selectedClient || !productSelection || !selectedTechnique || areasWithLogos.length === 0) {
      toast.error('Selecione empresa, produto, tecnica e faca upload de pelo menos um logo');
      return;
    }
    const productImage = getProductImage();
    if (!productImage) {
      toast.error('O produto selecionado nao possui imagem');
      return;
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
        // T5 FIX: parallel DB writes instead of sequential waterfall.
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
        setGeneratedMockup(result.batchResults[0]?.url || result.singleUrl);
        setGeneratedBatchMockups(result.batchResults);
        toast.success(`${result.batchResults.length} mockups gerados com sucesso!`);
      }
    } catch (error: unknown) {
      console.error('Error generating mockup:', error);
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
  ]);

  // T1/T2/T6 FIX: wrapped in useCallback; passes user?.id for owner-scoped DELETE.
  const deleteMockup = useCallback(async () => {
    if (!mockupToDelete) return;
    try {
      await deleteMockupFromDb(mockupToDelete, user?.id);
      setMockupHistory((prev) => prev.filter((m) => m.id !== mockupToDelete));
      toast.success('Mockup excluido');
    } catch (error) {
      console.error('Error deleting mockup:', error);
      toast.error('Erro ao excluir mockup');
    } finally {
      setDeleteDialogOpen(false);
      setMockupToDelete(null);
    }
  }, [mockupToDelete, user]);

  // T1/T2 FIX: wrapped in useCallback.
  const resetForm = useCallback(() => {
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
    clearDraft();
    logoColorAnalysis.clearAnalysis();
  }, [positionHistory, clearDraft, logoColorAnalysis]);

  // T1/T2 FIX: wrapped in useCallback — pure function, no state deps.
  const handleShareMockup = useCallback((mockup: GeneratedMockup) => {
    const text = `Confira o mockup: ${mockup.product_name} com ${mockup.technique_name}`;
    window.open(
      `https://wa.me/?text=${encodeURIComponent(text + '\n' + mockup.mockup_url)}`,
      '_blank',
    );
  }, []);

  // T1/T2 FIX: wrapped in useCallback with correct deps.
  const loadFromHistory = useCallback(
    (mockup: GeneratedMockup) => {
      const product = mockup.product_id ? getProductById(mockup.product_id) : null;
      const technique = mockup.technique_id
        ? techniques.find((t) => t.id === mockup.technique_id)
        : null;
      if (product)
        setProductSelection({
          product,
          variant: null,
          imageUrl: product.images?.[0] || '/placeholder.svg',
        });
      else setProductSelection(null);
      setSelectedTechnique(technique || null);
      setSelectedClient(
        mockup.client_id ? { id: mockup.client_id, name: mockup.client_name || 'Cliente' } : null,
      );
      const restoredArea: PersonalizationArea = {
        id: crypto.randomUUID(),
        name: 'Frente',
        positionX: mockup.position_x ?? 50,
        positionY: mockup.position_y ?? 50,
        logoWidth: mockup.logo_width_cm ?? 5,
        logoHeight: mockup.logo_height_cm ?? 3,
        logoRotation: 0,
        logoScale: 100,
        logoPreview: mockup.logo_url,
      };
      setPersonalizationAreas([restoredArea]);
      setActiveAreaId(restoredArea.id);
      setGeneratedMockup(null);
      setHasUserInteractedPosition(true);
      positionHistory.clear();
      setActiveTab('generator');
      if (mockup.logo_url) logoColorAnalysis.analyzeImage(mockup.logo_url);
      // BUG-04 FIX: clear stale draft so the auto-save effect does not overwrite the just-loaded
      // history configuration ~1 second after this function returns.
      clearDraft();
      toast.success('Configuracoes carregadas!');
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
