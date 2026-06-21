/**
 * useWizardPricing - Price comparison & recalculation logic for simulator wizard
 */

import { useCallback, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { invokeExternalRpc } from '@/lib/external-rpc';
import type { CustomizationPriceResponse } from '@/hooks/simulation';
import { adaptPriceResponse } from '@/lib/personalization/adapters';
import type {
  SimulatorWizardState,
  WizardAction,
  TechniqueComparisonResult,
  Personalization,
} from '@/types/domain/simulator-wizard';
import { logger } from '@/lib/logger';

interface UseWizardPricingParams {
  state: SimulatorWizardState;
  dispatch: React.Dispatch<WizardAction>;
}

export function useWizardPricing({ state, dispatch }: UseWizardPricingParams) {
  // ============================================
  // EFEITO: Recalcular preços ao mudar quantidade
  // ============================================

  const recalcTimerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    const persToRecalc = state.personalizations.filter((p) => p.pricing._needsRecalc === true);
    if (persToRecalc.length === 0) return;

    if (recalcTimerRef.current) clearTimeout(recalcTimerRef.current);

    recalcTimerRef.current = setTimeout(async () => {
      for (const pers of persToRecalc) {
        try {
          const tech = state.availableLocations
            .flatMap((loc) => loc.availableTechniques)
            .find((t) => t.printAreaId === pers.technique.id);

          const usaDimensao = tech?.usaDimensao !== false;
          const cobraPorCor = tech?.cobraPorCor !== false;
          const effectiveColors =
            !cobraPorCor || (tech?.maxColors ?? 0) <= 1 ? 1 : pers.specs.colors;

          const rpcParams: Record<string, unknown> = {
            p_area_id: pers.technique.id,
            p_quantidade: state.quantity,
            p_num_cores: effectiveColors,
          };

          if (usaDimensao && pers.specs.width > 0 && pers.specs.height > 0) {
            rpcParams.p_largura_cm = pers.specs.width;
            rpcParams.p_altura_cm = pers.specs.height;
          }

          const result = await invokeExternalRpc<CustomizationPriceResponse>(
            'fn_get_customization_price',
            rpcParams,
          );

          if (result?.success) {
            const flat = adaptPriceResponse(result);
            dispatch({
              type: 'RECALC_PERSONALIZATION_PRICING',
              payload: {
                personalizationId: pers.id,
                pricing: {
                  unitPrice: flat.unit_price,
                  setupPrice: flat.faturamento_minimo_gravacao,
                  subtotal: flat.subtotal_pecas,
                  totalPrice: flat.total_price,
                  costPerUnit: state.quantity > 0 ? flat.total_price / state.quantity : 0,
                  budgetCode: flat.codigo_orcamento,
                  productionDays: flat.production_days,
                },
              },
            });
          }
        } catch (err) {
          logger.warn(`Erro ao recalcular preço para ${pers.technique.name}:`, err);
        }
      }
      toast.success('Preços recalculados para nova tiragem!');
    }, 600);

    return () => {
      if (recalcTimerRef.current) clearTimeout(recalcTimerRef.current);
    };
  }, [state.personalizations, state.quantity, state.availableLocations, dispatch]);

  // ============================================
  // COMPARAÇÃO DE PREÇOS
  // ============================================

  const fetchComparisonPrices = useCallback(async () => {
    if (!state.selectedLocation) {
      toast.error('Selecione um local primeiro');
      return;
    }

    const techniques = state.selectedLocation.availableTechniques;
    if (techniques.length === 0) {
      toast.warning('Nenhuma técnica disponível para este local');
      return;
    }

    dispatch({ type: 'SET_CALCULATING', payload: true });
    dispatch({ type: 'SET_ERROR', payload: null });

    try {
      const allResults: TechniqueComparisonResult[] = [];

      const promises = techniques.map(async (tech) => {
        if (tech.hasPricing === false) {
          allResults.push(createUnavailableResult(tech, 'Preço sob consulta'));
          return;
        }

        if (
          tech.maxColors !== null &&
          tech.maxColors > 0 &&
          state.engravingSpecs.colors > tech.maxColors
        ) {
          allResults.push(
            createUnavailableResult(
              tech,
              `Máximo ${tech.maxColors} ${tech.maxColors === 1 ? 'cor' : 'cores'}`,
            ),
          );
          return;
        }

        const cobraPorCor = tech.cobraPorCor !== false;
        const effectiveColors =
          !cobraPorCor || tech.maxColors === 0 || tech.maxColors === 1
            ? 1
            : state.engravingSpecs.colors;

        try {
          const usaDimensao = tech.usaDimensao !== false;
          const rpcParams: Record<string, unknown> = {
            p_area_id: tech.printAreaId,
            p_quantidade: state.quantity,
            p_num_cores: effectiveColors,
          };

          if (usaDimensao && state.engravingSpecs.width > 0 && state.engravingSpecs.height > 0) {
            rpcParams.p_largura_cm = state.engravingSpecs.width;
            rpcParams.p_altura_cm = state.engravingSpecs.height;
          }

          const result = await invokeExternalRpc<CustomizationPriceResponse>(
            'fn_get_customization_price',
            rpcParams,
          );

          if (!result?.success) {
            allResults.push(createUnavailableResult(tech, 'Erro no cálculo de preço'));
            return;
          }

          const flat = adaptPriceResponse(result);

          allResults.push({
            techniqueId: tech.techniqueId,
            techniqueName: flat.technique || tech.techniqueName,
            techniqueCode: flat.tabela_codigo_curto || tech.techniqueCode,
            printAreaId: tech.printAreaId,
            maxColors: flat.max_cores ?? tech.maxColors,
            isAvailable: true,
            unitPrice: flat.unit_price,
            setupPrice: flat.faturamento_minimo_gravacao,
            subtotal: flat.subtotal_pecas,
            totalPrice: flat.total_price,
            costPerUnit: state.quantity > 0 ? flat.total_price / state.quantity : 0,
            minimumApplied: flat.minimum_applied,
            budgetCode: flat.codigo_orcamento,
            productionDays: flat.production_days,
            markupPercent: flat.markup_percent,
            marginPercent: flat.margin_percent,
            tierUsed: flat.tier_used,
            tierMinQty: flat.tier_min_qty,
            tierMaxQty: flat.tier_max_qty,
            rawData: result as unknown as Record<string, unknown>,
          });
        } catch (err) {
          logger.warn(`Erro ao calcular preço para ${tech.techniqueName}:`, err);
          allResults.push(createUnavailableResult(tech, 'Erro ao calcular preço'));
        }
      });

      await Promise.all(promises);

      const available = allResults.filter((r) => r.isAvailable);
      if (available.length > 0) {
        const cheapest = [...available].sort((a, b) => a.totalPrice - b.totalPrice)[0];
        const fastest = [...available].sort(
          (a, b) => (a.productionDays || 999) - (b.productionDays || 999),
        )[0];

        allResults.forEach((r) => {
          if (r.isAvailable) {
            r.isCheapest = r.printAreaId === cheapest.printAreaId;
            r.isFastest = r.printAreaId === fastest.printAreaId && available.length > 1;
          }
        });
      }

      const sorted = [
        ...available.sort((a, b) => a.totalPrice - b.totalPrice),
        ...allResults.filter((r) => !r.isAvailable),
      ];

      dispatch({ type: 'SET_COMPARISON_RESULTS', payload: sorted });
      dispatch({ type: 'SET_STEP', payload: 'comparison' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro ao comparar técnicas';
      dispatch({ type: 'SET_ERROR', payload: message });
      toast.error(message);
    } finally {
      dispatch({ type: 'SET_CALCULATING', payload: false });
    }
  }, [state.selectedLocation, state.quantity, state.engravingSpecs, dispatch]);

  // Confirmar técnica selecionada → cria personalização
  const confirmTechnique = useCallback(
    (comparison: TechniqueComparisonResult) => {
      if (!state.selectedLocation || !comparison.isAvailable) return;

      dispatch({ type: 'SELECT_COMPARISON', payload: comparison });

      const personalization: Personalization = {
        // techniqueId in the id keeps it unique when several techniques are confirmed
        // in one synchronous loop (Date.now() alone collides within the same ms).
        // The reducer re-indexes `index`, so the value here is just a provisional hint.
        id: `pers-${Date.now()}-${comparison.techniqueId}`,
        index: state.isEditingPersonalization
          ? state.currentPersonalizationIndex + 1
          : state.personalizations.length + 1,
        location: state.selectedLocation,
        technique: {
          id: comparison.techniqueId,
          code: comparison.techniqueCode,
          name: comparison.techniqueName,
        },
        specs: { ...state.engravingSpecs },
        pricing: {
          unitPrice: comparison.unitPrice,
          setupPrice: comparison.setupPrice,
          subtotal: comparison.subtotal,
          totalPrice: comparison.totalPrice,
          costPerUnit: comparison.costPerUnit,
          budgetCode: comparison.budgetCode,
          productionDays: comparison.productionDays,
        },
      };

      if (state.isEditingPersonalization) {
        dispatch({
          type: 'UPDATE_PERSONALIZATION',
          payload: { index: state.currentPersonalizationIndex, personalization },
        });
        toast.success(`Gravação ${personalization.index} atualizada`);
      } else {
        dispatch({ type: 'ADD_PERSONALIZATION', payload: personalization });
        toast.success(`${comparison.techniqueName} adicionada`);
      }
    },
    [state, dispatch],
  );

  return { fetchComparisonPrices, confirmTechnique };
}

// ============================================
// HELPERS
// ============================================

function createUnavailableResult(
  tech: {
    techniqueId: string;
    techniqueName: string;
    techniqueCode: string;
    printAreaId: string;
    maxColors: number | null;
  },
  reason: string,
): TechniqueComparisonResult {
  return {
    techniqueId: tech.techniqueId,
    techniqueName: tech.techniqueName,
    techniqueCode: tech.techniqueCode,
    printAreaId: tech.printAreaId,
    maxColors: tech.maxColors,
    isAvailable: false,
    unavailableReason: reason,
    unitPrice: 0,
    setupPrice: 0,
    subtotal: 0,
    totalPrice: 0,
    costPerUnit: 0,
    minimumApplied: false,
    budgetCode: '',
    productionDays: null,
    markupPercent: 0,
    marginPercent: 0,
    tierUsed: 0,
    tierMinQty: 0,
    tierMaxQty: 0,
  };
}
