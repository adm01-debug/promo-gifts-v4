/**
 * useSimulatorWizard v6 - Hook central do simulador (refatorado)
 *
 * Reducer extraído para ./wizardReducer.ts
 */

import { useCallback, useMemo, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { invokeExternalRpc } from '@/lib/external-rpc';
import type { CustomizationOptionsResponse, GravacaoLocation } from '@/types/customization';
import {
  type WizardStep,
  type SelectedProduct,
  type EngravingLocation,
  type EngravingSpecs,
  type AvailableTechnique,
  WIZARD_STEPS,
  getStepIndex,
  getNextStep,
  getPreviousStep,
  isStepComplete,
  canNavigateToStep,
} from '@/types/domain/simulator-wizard';
import { useWizardPricing } from '@/hooks/simulator/useWizardPricing';
import {
  useWizardPersistence,
  loadSession,
  clearSession,
} from '@/hooks/simulator/useWizardPersistence';
import { useUndoableReducer } from '@/hooks/simulator/useUndoRedo';
import { logger } from '@/lib/logger';
import { wizardReducer, initialState } from '@/hooks/simulator/wizardReducer';

export function useSimulatorWizard() {
  const savedSession = useRef(loadSession());
  const { state, dispatch, undo, redo, canUndo, canRedo } = useUndoableReducer(
    wizardReducer,
    initialState,
    (init) => (savedSession.current ? { ...init, ...savedSession.current } : init),
  );

  // Query: áreas + técnicas (v6)
  const { data: locationsData, isLoading: locationsLoading } = useQuery({
    queryKey: ['wizard-locations-v6', state.selectedProduct?.id],
    queryFn: async (): Promise<EngravingLocation[]> => {
      if (!state.selectedProduct?.id) return [];
      try {
        const result = await invokeExternalRpc<CustomizationOptionsResponse>(
          'fn_get_product_customization_options',
          { p_product_id: state.selectedProduct.id },
        );
        if (result?.locations?.length) return mapV6LocationsToWizard(result.locations);
      } catch (err) {
        logger.warn('Falha ao buscar opções de personalização v6:', err);
      }
      return [];
    },
    enabled: !!state.selectedProduct?.id,
    staleTime: 10 * 60 * 1000,
  });

  useEffect(() => {
    if (locationsData) dispatch({ type: 'SET_AVAILABLE_LOCATIONS', payload: locationsData });
  }, [locationsData, dispatch]);

  const { fetchComparisonPrices, confirmTechnique } = useWizardPricing({ state, dispatch });
  useWizardPersistence(state);

  // Actions
  const setStep = useCallback(
    (step: WizardStep) => {
      if (canNavigateToStep(step, state)) dispatch({ type: 'SET_STEP', payload: step });
      else toast.warning('Complete os passos anteriores primeiro');
    },
    [state, dispatch],
  );

  const nextStep = useCallback(() => {
    const next = getNextStep(state.currentStep);
    if (next && isStepComplete(state.currentStep, state))
      dispatch({ type: 'SET_STEP', payload: next });
  }, [state, dispatch]);

  const previousStep = useCallback(() => {
    const prev = getPreviousStep(state.currentStep);
    if (prev) dispatch({ type: 'SET_STEP', payload: prev });
  }, [state.currentStep, dispatch]);

  const selectProduct = useCallback(
    (product: SelectedProduct | null) => {
      dispatch({ type: 'SELECT_PRODUCT', payload: product });
      if (product) dispatch({ type: 'SET_STEP', payload: 'location' });
    },
    [dispatch],
  );

  const setQuantity = useCallback(
    (quantity: number) => {
      const newQty = Math.max(1, quantity);
      dispatch({ type: 'SET_QUANTITY', payload: newQty });
      if (state.personalizations.length > 0 && newQty !== state.quantity)
        toast.info('Recalculando preços para nova tiragem...', { duration: 2000 });
    },
    [state.personalizations.length, state.quantity, dispatch],
  );

  const selectLocation = useCallback(
    (location: EngravingLocation | null) => {
      dispatch({ type: 'SELECT_LOCATION', payload: location });
      if (location) dispatch({ type: 'SET_STEP', payload: 'specs' });
    },
    [dispatch],
  );

  const updateSpecs = useCallback(
    (specs: Partial<EngravingSpecs>) => {
      dispatch({ type: 'UPDATE_SPECS', payload: specs });
    },
    [dispatch],
  );
  const removePersonalization = useCallback(
    (id: string) => {
      dispatch({ type: 'REMOVE_PERSONALIZATION', payload: id });
      toast.info('Gravação removida');
    },
    [dispatch],
  );
  const removeAllPersonalizations = useCallback(() => {
    dispatch({ type: 'REMOVE_ALL_PERSONALIZATIONS' });
    toast.info('Todas as gravações removidas');
  }, [dispatch]);
  const editPersonalization = useCallback(
    (index: number) => {
      dispatch({ type: 'EDIT_PERSONALIZATION', payload: index });
    },
    [dispatch],
  );

  const startNewPersonalization = useCallback(() => {
    const usedIds = new Set(state.personalizations.map((p) => p.location.id));
    if (state.availableLocations.filter((loc) => !usedIds.has(loc.id)).length === 0) {
      toast.warning('Todos os locais já foram personalizados');
      return;
    }
    dispatch({ type: 'START_NEW_PERSONALIZATION' });
  }, [state.personalizations, state.availableLocations, dispatch]);

  const cancelPersonalization = useCallback(() => {
    dispatch({ type: 'CANCEL_PERSONALIZATION' });
  }, [dispatch]);

  const duplicatePersonalization = useCallback(
    (sourceId: string, targetLocationId: string) => {
      const targetLocation = state.availableLocations.find((loc) => loc.id === targetLocationId);
      if (!targetLocation) {
        toast.error('Local de destino não encontrado');
        return;
      }
      if (new Set(state.personalizations.map((p) => p.location.id)).has(targetLocationId)) {
        toast.warning('Este local já possui uma personalização');
        return;
      }
      dispatch({ type: 'DUPLICATE_PERSONALIZATION', payload: { sourceId, targetLocation } });
      toast.success(`Personalização duplicada para ${targetLocation.locationName}`);
    },
    [state.availableLocations, state.personalizations, dispatch],
  );

  const resetWizard = useCallback(() => {
    dispatch({ type: 'RESET_WIZARD' });
    clearSession();
  }, [dispatch]);

  // Computed
  const effectivePrice = useMemo(() => state.selectedProduct?.price ?? 0, [state.selectedProduct]);
  const stepProgress = useMemo(
    () => ((getStepIndex(state.currentStep) + 1) / WIZARD_STEPS.length) * 100,
    [state.currentStep],
  );
  const canProceed = useMemo(() => isStepComplete(state.currentStep, state), [state]);
  const canGoBack = useMemo(() => getStepIndex(state.currentStep) > 0, [state.currentStep]);

  const availableLocationsFiltered = useMemo(() => {
    const usedIds = new Set(state.personalizations.map((p) => p.location.id));
    if (
      state.isEditingPersonalization &&
      state.personalizations[state.currentPersonalizationIndex]
    ) {
      const currentId = state.personalizations[state.currentPersonalizationIndex].location.id;
      return state.availableLocations.filter((loc) => !usedIds.has(loc.id) || loc.id === currentId);
    }
    return state.availableLocations.filter((loc) => !usedIds.has(loc.id));
  }, [
    state.availableLocations,
    state.personalizations,
    state.isEditingPersonalization,
    state.currentPersonalizationIndex,
  ]);

  const hasAvailableLocations = useMemo(() => {
    const usedIds = new Set(state.personalizations.map((p) => p.location.id));
    return state.availableLocations.filter((loc) => !usedIds.has(loc.id)).length > 0;
  }, [state.availableLocations, state.personalizations]);

  const totals = useMemo(() => {
    const productTotal = effectivePrice * state.quantity;
    const customizationTotal = state.personalizations.reduce(
      (sum, p) => sum + p.pricing.totalPrice,
      0,
    );
    const grandTotal = productTotal + customizationTotal;
    const grandTotalPerUnit = state.quantity > 0 ? grandTotal / state.quantity : 0;
    const maxDays =
      state.personalizations.length > 0
        ? Math.max(...state.personalizations.map((p) => p.pricing.productionDays ?? 0))
        : 0;
    return { productTotal, customizationTotal, grandTotal, grandTotalPerUnit, maxDays };
  }, [effectivePrice, state.quantity, state.personalizations]);

  const maxColorsForLocation = useMemo(() => {
    if (!state.selectedLocation) return 4;
    const maxColors = state.selectedLocation.availableTechniques
      .map((t) => t.maxColors)
      .filter((c): c is number => c !== null && c > 0);
    return maxColors.length > 0 ? Math.max(...maxColors) : 4;
  }, [state.selectedLocation]);

  return {
    ...state,
    locationsLoading,
    effectivePrice,
    stepProgress,
    canProceed,
    canGoBack,
    availableLocationsFiltered,
    hasAvailableLocations,
    totals,
    maxColorsForLocation,
    undo,
    redo,
    canUndo,
    canRedo,
    setStep,
    nextStep,
    previousStep,
    selectProduct,
    setQuantity,
    selectLocation,
    updateSpecs,
    fetchComparisonPrices,
    confirmTechnique,
    removePersonalization,
    removeAllPersonalizations,
    editPersonalization,
    startNewPersonalization,
    cancelPersonalization,
    duplicatePersonalization,
    resetWizard,
    isStepComplete: (step: WizardStep) => isStepComplete(step, state),
    canNavigateToStep: (step: WizardStep) => canNavigateToStep(step, state),
  };
}

export type UseSimulatorWizardReturn = ReturnType<typeof useSimulatorWizard>;

// v6 MAPPER
function mapV6LocationsToWizard(locations: GravacaoLocation[]): EngravingLocation[] {
  return locations
    .sort((a, b) => a.location_order - b.location_order)
    .map((loc) => {
      /**
       * BUG-19 FIX: Math.max(...[]) returns -Infinity when the spread argument is
       * an empty array. Guard with a ternary so dimensions default to 0 when
       * loc.options is empty (e.g. newly-created product with no techniques yet).
       * Without this fix, maxWidth and maxHeight propagate as -Infinity to downstream
       * dimension validations in the simulator wizard.
       */
      const widths = loc.options.map((t) => t.efetiva_largura_max || t.max_width || 0);
      const heights = loc.options.map((t) => t.efetiva_altura_max || t.max_height || 0);
      const maxWidth = widths.length > 0 ? Math.max(...widths) : 0;
      const maxHeight = heights.length > 0 ? Math.max(...heights) : 0;
      const availableTechniques: AvailableTechnique[] = loc.options.map((t) => ({
        id: t.technique_id,
        printAreaId: t.technique_id,
        techniqueId: t.technique_id,
        techniqueName: t.tecnica_nome,
        techniqueCode: t.codigo_tabela,
        maxColors: t.max_cores,
        isDefault: false,
        isCurved: t.is_curved,
        hasPricing: true,
        areaMaxWidth: t.efetiva_largura_max,
        areaMaxHeight: t.efetiva_altura_max,
        grupoTecnica: t.grupo_tecnica,
        cobraPorCor: t.cobra_por_cor,
        usaDimensao: t.usa_dimensao,
        efetivaLarguraMax: t.efetiva_largura_max,
        efetivaAlturaMax: t.efetiva_altura_max,
        variacaoLabel: t.variacao_label,
        shape: t.shape,
      }));
      return {
        id: loc.location_code,
        componentId: loc.location_code,
        componentCode: loc.location_code,
        componentName: loc.location_name,
        locationCode: loc.location_code,
        locationName: loc.location_name,
        maxWidthCm: maxWidth,
        maxHeightCm: maxHeight,
        maxAreaCm2: null,
        areaImageUrl: null,
        isFromGroup: false,
        availableTechniques,
      };
    });
}
