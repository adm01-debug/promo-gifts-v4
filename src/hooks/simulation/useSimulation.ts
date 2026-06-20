import { dbInvoke } from '@/lib/db/postgrest';
import { type ExternalTechnique } from '@/types/external-db';
// src/hooks/useSimulation.ts
// Hook centralizado para lógica do simulador — refactored

import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { untypedFrom } from '@/lib/supabase-untyped';
import type { Json } from '@/integrations/supabase/types';
import { fetchPromobrindProducts, getProductPrice, getProductImageUrl } from '@/lib/external-db';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';
import { useMultipleTechniquePricing } from '@/hooks/simulation/useTechniquePricingOptions';
import { useSimulatorPreferences } from '@/hooks/simulation/useSimulatorPreferences';
import { fetchAllOptions } from '@/hooks/simulation/simulationPriceFetcher';
import {
  copyOptionToClipboard,
  copyAllOptionsToClipboard,
} from '@/hooks/simulation/simulationClipboard';
import type {
  Product,
  Client,
  Technique,
  TechniqueSettings,
  SimulationOption,
  SavedSimulation,
  SimulatorStep,
} from '@/types/simulation';
import type { SimulationScenario } from '@/components/simulator/ScenarioComparison';

export function useSimulation() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const {
    preferences,
    isLoaded: preferencesLoaded,
    setLastQuantity,
    setLastProductId,
    setLastTechniques,
    setLastTechniqueSettings,
    setPreferredView,
    saveCurrentSession: _saveCurrentSession,
  } = useSimulatorPreferences();

  // Wizard state
  const [currentStep, setCurrentStep] = useState<SimulatorStep>('product');

  // Core state
  const [selectedProductId, setSelectedProductIdState] = useState<string | null>(null);
  const [quantity, setQuantityState] = useState<number>(100);
  const [customProductPrice, setCustomProductPrice] = useState<string>('');
  const [selectedTechniques, setSelectedTechniquesState] = useState<string[]>([]);
  const [techniqueSettings, setTechniqueSettingsState] = useState<
    Record<string, TechniqueSettings>
  >({});
  const [simulationOptions, setSimulationOptions] = useState<SimulationOption[]>([]);

  // Load preferences on mount
  useEffect(() => {
    if (preferencesLoaded) {
      if (preferences.lastQuantity) setQuantityState(preferences.lastQuantity);
      if (preferences.lastProductId) setSelectedProductIdState(preferences.lastProductId);
      if (preferences.lastTechniques?.length)
        setSelectedTechniquesState(preferences.lastTechniques);
      if (
        preferences.lastTechniqueSettings &&
        Object.keys(preferences.lastTechniqueSettings).length > 0
      ) {
        setTechniqueSettingsState(preferences.lastTechniqueSettings);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preferencesLoaded]);

  // Wrapped setters with persistence
  const setSelectedProductId = useCallback(
    (id: string | null) => {
      setSelectedProductIdState(id);
      setLastProductId(id);
    },
    [setLastProductId],
  );
  const setQuantity = useCallback(
    (qty: number) => {
      setQuantityState(qty);
      setLastQuantity(qty);
    },
    [setLastQuantity],
  );

  // Scenarios
  const [scenarioA, setScenarioA] = useState<SimulationScenario | null>(null);
  const [scenarioB, setScenarioB] = useState<SimulationScenario | null>(null);

  // UI state
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [simulationNotes, setSimulationNotes] = useState('');
  const [viewSimulation, setViewSimulation] = useState<SavedSimulation | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [sellingPrice, setSellingPrice] = useState<string>('');
  const [targetMargin, setTargetMargin] = useState<string>('30');
  const [selectedLocation, setSelectedLocation] = useState<{
    locationId: string;
    componentName: string;
    locationName: string;
    maxWidth: number;
    maxHeight: number;
    maxArea: number;
    techniqueId: string | null;
    techniqueName: string | null;
    maxColors: number | null;
  } | null>(null);
  const [filterClientId, setFilterClientId] = useState<string | null>(null);
  const [filterProductSearch, setFilterProductSearch] = useState('');

  // ─── Data queries ─────────────────────────────────────────
  const { data: products, isLoading: productsLoading } = useQuery({
    queryKey: ['simulator-products-promobrind'],
    queryFn: async () => {
      const raw = await fetchPromobrindProducts({ limit: 500 });
      return raw
        .filter((p) => p.active && p.is_active)
        .map((p) => ({
          id: p.id,
          name: p.name,
          sku: p.sku,
          price: getProductPrice(p),
          image_url: getProductImageUrl(p),
        })) as Product[];
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: clients } = useQuery({
    queryKey: ['simulator-clients'],
    queryFn: async () => {
      const { selectCrm } = await import('@/lib/crm-db');
      const companies = await selectCrm<{
        id: string;
        razao_social?: string;
        nome_fantasia?: string;
        ramo?: string;
        nicho?: string;
        logo_url?: string;
      }>('companies', {
        select: 'id, razao_social, nome_fantasia, ramo, nicho, logo_url',
        filters: { deleted_at: null },
        orderBy: { column: 'razao_social', ascending: true },
        limit: 500,
      });
      return companies.map((c) => ({
        id: c.id,
        name: c.nome_fantasia || c.razao_social || '',
        ramo: c.ramo,
        nicho: c.nicho,
        logo_url: c.logo_url,
      })) as Client[];
    },
  });

  const { data: techniques, isLoading: techniquesLoading } = useQuery({
    queryKey: ['simulator-techniques-external'],
    queryFn: async () => {
      const result = await dbInvoke<Technique>({
        table: 'personalization_techniques',
        operation: 'select',
        filters: { is_active: true },
        orderBy: { column: 'name', ascending: true },
        limit: 100,
      });
      return result.records.map((t) => {
        const ext = t as unknown as ExternalTechnique;
        return {
          ...t,
          setup_cost: ext.setup_price ?? t.setup_cost,
          unit_cost: ext.handling_price ?? t.unit_cost,
        };
      });
    },
  });

  const techniqueCodes = useMemo(
    () => techniques?.map((t) => t.code).filter(Boolean) ?? [],
    [techniques],
  );
  const { isLoading: pricingLoading, getPricingInfo } = useMultipleTechniquePricing(techniqueCodes);

  const { data: _savedSimulations, isLoading: savedSimulationsLoading } = useQuery({
    queryKey: ['saved-simulations'],
    queryFn: async () => {
      const { data, error } = await untypedFrom('personalization_simulations')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data || []).map((item) => ({
        ...item,
        simulation_data: item.simulation_data as unknown as SimulationOption[],
      }));
    },
  });
  const savedSimulations = (_savedSimulations ?? []) as unknown as SavedSimulation[];

  // ─── Derived ──────────────────────────────────────────────
  const selectedProduct = useMemo(
    () => products?.find((p) => p.id === selectedProductId),
    [products, selectedProductId],
  );
  const effectiveProductPrice = useMemo(() => {
    if (customProductPrice && parseFloat(customProductPrice) > 0)
      return parseFloat(customProductPrice);
    return selectedProduct?.price || 0;
  }, [customProductPrice, selectedProduct]);

  const bestOption = useMemo(
    () =>
      simulationOptions.length === 0
        ? null
        : simulationOptions.reduce((b, c) => (c.grandTotal < b.grandTotal ? c : b)),
    [simulationOptions],
  );
  const fastestOption = useMemo(
    () =>
      simulationOptions.length === 0
        ? null
        : simulationOptions.reduce((f, c) => (c.estimatedDays < f.estimatedDays ? c : f)),
    [simulationOptions],
  );

  // ─── Helpers ──────────────────────────────────────────────
  const needsColorInput = useCallback(
    (code: string) => {
      const info = getPricingInfo(code);
      if (info.hasPriceByColor) return true;
      const c = code?.toUpperCase() ?? '';
      return (
        c.includes('SILK') ||
        c.includes('SERIGRAFIA') ||
        c.includes('BORD') ||
        c.includes('EMBROID')
      );
    },
    [getPricingInfo],
  );

  const needsSizeInput = useCallback(
    (code: string) => {
      const info = getPricingInfo(code);
      if (info.hasPriceByArea) return true;
      const c = code?.toUpperCase() ?? '';
      return (
        c.includes('DTF') ||
        c.includes('SUB') ||
        c.includes('TRANSFER') ||
        c.includes('BORD') ||
        c.includes('EMBROID') ||
        c.includes('LASER')
      );
    },
    [getPricingInfo],
  );

  // ─── Actions ──────────────────────────────────────────────
  const handleTechniqueToggle = useCallback(
    (techniqueId: string) => {
      setSelectedTechniquesState((prev) => {
        let next: string[];
        if (prev.includes(techniqueId)) {
          next = prev.filter((id) => id !== techniqueId);
        } else {
          if (!techniqueSettings[techniqueId]) {
            setTechniqueSettingsState((s) => {
              const u = { ...s, [techniqueId]: { colors: 1, width: 10, height: 10, positions: 1 } };
              setLastTechniqueSettings(u);
              return u;
            });
          }
          next = [...prev, techniqueId];
        }
        setLastTechniques(next);
        return next;
      });
    },
    [techniqueSettings, setLastTechniques, setLastTechniqueSettings],
  );

  const updateTechniqueSetting = useCallback(
    (techniqueId: string, field: keyof TechniqueSettings, value: number) => {
      setTechniqueSettingsState((prev) => {
        const u = { ...prev, [techniqueId]: { ...prev[techniqueId], [field]: value } };
        setLastTechniqueSettings(u);
        return u;
      });
    },
    [setLastTechniqueSettings],
  );

  const fallbackToastShownRef = useRef(false);
  const calculateSimulation = useCallback(async () => {
    if (!selectedProduct || selectedTechniques.length === 0) {
      toast.error('Selecione um produto e pelo menos uma técnica');
      return;
    }
    setIsCalculating(true);
    try {
      const options = await fetchAllOptions({
        selectedTechniqueIds: selectedTechniques,
        techniques,
        techniqueSettings,
        quantity,
        productUnitPrice: effectiveProductPrice,
        productId: selectedProduct.id,
      });
      setSimulationOptions(options);
      setCurrentStep('results');
      const available = options.filter((o) => o.priceSource === 'rpc').length;
      const fallback = options.filter((o) => o.priceSource === 'legacy-fallback').length;
      const unavailable = options.filter((o) => o.priceSource === 'unavailable').length;
      if (fallback > 0) {
        // Toast inicial só uma vez por sessão — o badge persistente no card
        // é a fonte de verdade visual a partir daí.
        if (!fallbackToastShownRef.current) {
          fallbackToastShownRef.current = true;
          toast.warning(
            `Cálculo oficial indisponível para ${fallback} técnica(s). Os valores marcados são estimativas — revise antes de fechar.`,
            { duration: 7000, id: 'simulation-fallback-warning' },
          );
        }
      } else if (unavailable > 0) {
        toast.success(`Simulação calculada: ${available} ok, ${unavailable} indisponível(is)`);
      } else {
        toast.success(`Simulação calculada para ${options.length} técnica(s)`);
      }
    } catch (err) {
      logger.warn('[useSimulation] calculateSimulation falhou', err);
      toast.error('Erro ao calcular simulação');
    } finally {
      setIsCalculating(false);
    }
  }, [
    selectedProduct,
    selectedTechniques,
    techniques,
    techniqueSettings,
    quantity,
    effectiveProductPrice,
  ]);

  // Auto-recalcular quando settings mudam (debounce + cancelamento de stale).
  const autoCalcAbortRef = useRef(0);
  useEffect(() => {
    if (!selectedProduct || selectedTechniques.length === 0 || quantity <= 0) return;
    const myToken = ++autoCalcAbortRef.current;
    const timer = setTimeout(async () => {
      try {
        const options = await fetchAllOptions({
          selectedTechniqueIds: selectedTechniques,
          techniques,
          techniqueSettings,
          quantity,
          productUnitPrice: effectiveProductPrice,
          productId: selectedProduct.id,
        });
        if (myToken !== autoCalcAbortRef.current) return; // stale
        if (options.length > 0) setSimulationOptions(options);
      } catch (err) {
        logger.warn('[useSimulation] auto-recalc falhou', err);
      }
    }, 500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    selectedProduct?.id,
    selectedTechniques,
    techniques,
    techniqueSettings,
    quantity,
    effectiveProductPrice,
  ]);

  const clearSimulation = useCallback(() => {
    setSimulationOptions([]);
    setSelectedTechniquesState([]);
    setTechniqueSettingsState({});
    setLastTechniques([]);
    setLastTechniqueSettings({});
    setCurrentStep('product');
  }, [setLastTechniques, setLastTechniqueSettings]);

  const copyToClipboard = useCallback(
    async (option: SimulationOption) => {
      await copyOptionToClipboard(option, quantity, setCopiedId);
    },
    [quantity],
  );

  const copyAllOptions = useCallback(async () => {
    await copyAllOptionsToClipboard(
      simulationOptions,
      selectedProduct,
      effectiveProductPrice,
      quantity,
    );
  }, [simulationOptions, selectedProduct, effectiveProductPrice, quantity]);

  const loadSavedSimulation = useCallback(
    (simulation: SavedSimulation) => {
      setSelectedProductIdState(simulation.product_id);
      setLastProductId(simulation.product_id);
      setQuantityState(simulation.quantity);
      setLastQuantity(simulation.quantity);
      setCustomProductPrice(simulation.product_unit_price.toString());
      setSimulationOptions(simulation.simulation_data);
      const techIds = simulation.simulation_data.map((s) => s.techniqueId);
      setSelectedTechniquesState(techIds);
      setLastTechniques(techIds);
      const settings: Record<string, TechniqueSettings> = {};
      simulation.simulation_data.forEach((opt) => {
        settings[opt.techniqueId] = {
          colors: opt.colors,
          width: opt.width,
          height: opt.height,
          positions: opt.positions,
        };
      });
      setTechniqueSettingsState(settings);
      setLastTechniqueSettings(settings);
      setCurrentStep('results');
      setViewSimulation(null);
      toast.success('Simulação carregada!');
    },
    [setLastProductId, setLastQuantity, setLastTechniques, setLastTechniqueSettings],
  );

  const calculateForProduct = useCallback(
    async (product: Product): Promise<SimulationOption[]> => {
      if (!product || selectedTechniques.length === 0) return [];
      return fetchAllOptions({
        selectedTechniqueIds: selectedTechniques,
        techniques,
        techniqueSettings,
        quantity,
        productUnitPrice: product.price,
        productId: product.id,
        idSuffix: product.id,
      });
    },
    [techniques, techniqueSettings, selectedTechniques, quantity],
  );

  const handleAddToQuote = useCallback((selectedOptions: SimulationOption[]) => {
    toast.success(`${selectedOptions.length} técnica(s) adicionadas ao orçamento!`);
    logger.log('Opções selecionadas para orçamento:', selectedOptions);
  }, []);

  // ─── Mutations ────────────────────────────────────────────
  const saveSimulationMutation = useMutation({
    mutationFn: async () => {
      if (!user || !selectedProduct || simulationOptions.length === 0)
        throw new Error('Dados incompletos');
      const { error } = await untypedFrom('personalization_simulations').insert([
        {
          seller_id: user.id,
          client_id: selectedClientId,
          product_id: selectedProduct.id,
          product_name: selectedProduct.name,
          product_sku: selectedProduct.sku,
          quantity,
          product_unit_price: effectiveProductPrice,
          simulation_data: structuredClone(simulationOptions) as unknown as Json,
          notes: simulationNotes || null,
        },
      ]);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Simulação salva com sucesso!');
      setSaveDialogOpen(false);
      setSelectedClientId(null);
      setSimulationNotes('');
      queryClient.invalidateQueries({ queryKey: ['saved-simulations'] });
    },
    onError: () => {
      toast.error('Erro ao salvar simulação');
    },
  });

  const deleteSimulationMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await untypedFrom('personalization_simulations').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Simulação excluída');
      queryClient.invalidateQueries({ queryKey: ['saved-simulations'] });
    },
    onError: () => {
      toast.error('Erro ao excluir simulação');
    },
  });

  // ─── Scenarios ────────────────────────────────────────────
  const saveAsScenario = useCallback(
    (name: 'A' | 'B') => {
      if (!selectedProduct || simulationOptions.length === 0) {
        toast.error('Nenhuma simulação para salvar');
        return;
      }
      const scenario: SimulationScenario = {
        id: `${name}-${Date.now()}`,
        name: `Cenário ${name}`,
        productName: selectedProduct.name,
        quantity,
        options: [...simulationOptions],
        bestOption,
        createdAt: new Date(),
      };
      if (name === 'A') setScenarioA(scenario);
      else setScenarioB(scenario);
      toast.success(`Simulação salva como Cenário ${name}`);
    },
    [selectedProduct, simulationOptions, quantity, bestOption],
  );

  const clearScenario = useCallback((name: 'A' | 'B') => {
    if (name === 'A') setScenarioA(null);
    else setScenarioB(null);
    toast.success(`Cenário ${name} removido`);
  }, []);

  return {
    products,
    clients,
    techniques,
    savedSimulations,
    selectedProduct,
    effectiveProductPrice,
    bestOption,
    fastestOption,
    simulationOptions,
    productsLoading,
    techniquesLoading,
    savedSimulationsLoading,
    isCalculating,
    pricingLoading,
    currentStep,
    setCurrentStep,
    selectedProductId,
    setSelectedProductId,
    quantity,
    setQuantity,
    customProductPrice,
    setCustomProductPrice,
    selectedTechniques,
    techniqueSettings,
    preferredView: preferences.preferredView,
    setPreferredView,
    scenarioA,
    scenarioB,
    saveAsScenario,
    clearScenario,
    copiedId,
    saveDialogOpen,
    setSaveDialogOpen,
    selectedClientId,
    setSelectedClientId,
    simulationNotes,
    setSimulationNotes,
    viewSimulation,
    setViewSimulation,
    sellingPrice,
    setSellingPrice,
    targetMargin,
    setTargetMargin,
    selectedLocation,
    setSelectedLocation,
    filterClientId,
    setFilterClientId,
    filterProductSearch,
    setFilterProductSearch,
    needsColorInput,
    needsSizeInput,
    getPricingInfo,
    handleTechniqueToggle,
    updateTechniqueSetting,
    calculateSimulation,
    clearSimulation,
    copyToClipboard,
    copyAllOptions,
    loadSavedSimulation,
    calculateForProduct,
    handleAddToQuote,
    saveSimulationMutation,
    deleteSimulationMutation,
  };
}

// Re-export for backward compatibility with legacy simulator imports.
// Keep the source of truth in the shared formatter module to avoid runtime
// module-export errors during Vite ESM loading.
export { formatCurrency } from '@/lib/format';
