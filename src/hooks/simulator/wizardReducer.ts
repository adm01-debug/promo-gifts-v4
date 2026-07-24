/**
 * Wizard reducer extracted from useSimulatorWizard
 */
import type { SimulatorWizardState, WizardAction } from '@/types/domain/simulator-wizard';

export const initialState: SimulatorWizardState = {
  currentStep: 'product',
  selectedProduct: null,
  quantity: 100,
  personalizations: [],
  currentPersonalizationIndex: 0,
  isEditingPersonalization: false,
  availableLocations: [],
  selectedLocation: null,
  engravingSpecs: { colors: 1, width: 5, height: 5 },
  comparisonResults: [],
  selectedComparison: null,
  isCalculating: false,
  error: null,
};

export function wizardReducer(
  state: SimulatorWizardState,
  action: WizardAction,
): SimulatorWizardState {
  switch (action.type) {
    case 'SET_STEP':
      return { ...state, currentStep: action.payload };

    case 'SELECT_PRODUCT':
      return {
        ...state,
        selectedProduct: action.payload,
        personalizations: [],
        currentPersonalizationIndex: 0,
        isEditingPersonalization: false,
        selectedLocation: null,
        availableLocations: [],
        comparisonResults: [],
        selectedComparison: null,
      };

    case 'LOAD_DRAFT': {
      // Restore a saved draft ATOMICALLY (product + quantity + personalizations).
      // Must NOT go through SELECT_PRODUCT, which wipes personalizations — that was
      // the bug where drafts saved personalizations but could never restore them.
      const pers = action.payload.personalizations ?? [];
      return {
        ...state,
        selectedProduct: action.payload.product,
        quantity: action.payload.quantity,
        personalizations: pers.map((p, idx) => ({ ...p, index: idx + 1 })),
        currentPersonalizationIndex: pers.length > 0 ? pers.length - 1 : 0,
        isEditingPersonalization: false,
        selectedLocation: null,
        availableLocations: [],
        comparisonResults: [],
        selectedComparison: null,
        currentStep: pers.length > 0 ? 'comparison' : 'location',
      };
    }

    case 'SET_QUANTITY':
      return {
        ...state,
        quantity: action.payload,
        comparisonResults: [],
        selectedComparison: null,
        personalizations: state.personalizations.map((p) => ({
          ...p,
          pricing: { ...p.pricing, _needsRecalc: true },
        })),
      };

    case 'SET_AVAILABLE_LOCATIONS':
      return { ...state, availableLocations: action.payload };

    case 'SELECT_LOCATION':
      return {
        ...state,
        selectedLocation: action.payload,
        comparisonResults: [],
        selectedComparison: null,
        engravingSpecs: {
          colors: 1,
          width: Math.min(5, action.payload?.maxWidthCm || 50),
          height: Math.min(5, action.payload?.maxHeightCm || 50),
        },
      };

    case 'UPDATE_SPECS':
      return {
        ...state,
        engravingSpecs: { ...state.engravingSpecs, ...action.payload },
        comparisonResults: [],
        selectedComparison: null,
      };

    case 'SET_COMPARISON_RESULTS':
      return { ...state, comparisonResults: action.payload };

    case 'SELECT_COMPARISON':
      return { ...state, selectedComparison: action.payload };

    case 'ADD_PERSONALIZATION': {
      // Re-index from the reducer's own array (not the caller's payload.index): when
      // several techniques are confirmed in one synchronous loop (Selecionar Todas →
      // Confirmar), every confirmTechnique reads the same stale closure and would
      // otherwise emit identical indices. Re-mapping here keeps them 1..N.
      const personalizations = [...state.personalizations, action.payload].map((p, idx) => ({
        ...p,
        index: idx + 1,
      }));
      return {
        ...state,
        personalizations,
        currentPersonalizationIndex: personalizations.length - 1,
        isEditingPersonalization: false,
        selectedLocation: null,
        selectedComparison: null,
        comparisonResults: [],
        engravingSpecs: { colors: 1, width: 5, height: 5 },
        currentStep: 'comparison',
      };
    }

    case 'REMOVE_PERSONALIZATION': {
      const newPersonalizations = state.personalizations
        .filter((p) => p.id !== action.payload)
        .map((p, idx) => ({ ...p, index: idx + 1 }));
      return { ...state, personalizations: newPersonalizations };
    }

    case 'REMOVE_ALL_PERSONALIZATIONS':
      return { ...state, personalizations: [] };

    case 'UPDATE_PERSONALIZATION': {
      const { index: editIndex, personalization: updatedPers } = action.payload;
      const updatedPersonalizations = [...state.personalizations];
      updatedPersonalizations[editIndex] = updatedPers;
      return {
        ...state,
        personalizations: updatedPersonalizations.map((p, idx) => ({ ...p, index: idx + 1 })),
        isEditingPersonalization: false,
        selectedLocation: null,
        selectedComparison: null,
        comparisonResults: [],
        engravingSpecs: { colors: 1, width: 5, height: 5 },
        currentStep: 'comparison',
      };
    }

    case 'EDIT_PERSONALIZATION': {
      const pers = state.personalizations[action.payload];
      if (!pers) return state;
      return {
        ...state,
        currentPersonalizationIndex: action.payload,
        isEditingPersonalization: true,
        selectedLocation: pers.location,
        engravingSpecs: pers.specs,
        comparisonResults: [],
        selectedComparison: null,
        currentStep: 'location',
      };
    }

    case 'START_NEW_PERSONALIZATION':
      return {
        ...state,
        currentPersonalizationIndex: state.personalizations.length,
        isEditingPersonalization: false,
        selectedLocation: null,
        selectedComparison: null,
        comparisonResults: [],
        engravingSpecs: { colors: 1, width: 5, height: 5 },
        currentStep: 'location',
      };

    case 'CANCEL_PERSONALIZATION':
      return {
        ...state,
        isEditingPersonalization: false,
        selectedLocation: null,
        selectedComparison: null,
        currentStep: state.personalizations.length > 0 ? 'comparison' : 'product',
      };

    case 'SET_CALCULATING':
      return { ...state, isCalculating: action.payload };

    case 'SET_ERROR':
      return { ...state, error: action.payload };

    case 'RECALC_PERSONALIZATION_PRICING': {
      const { personalizationId, pricing } = action.payload;
      return {
        ...state,
        personalizations: state.personalizations.map((p) =>
          p.id === personalizationId ? { ...p, pricing } : p,
        ),
      };
    }

    case 'DUPLICATE_PERSONALIZATION': {
      const { sourceId, targetLocation } = action.payload;
      const source = state.personalizations.find((p) => p.id === sourceId);
      if (!source) return state;
      const newPers = {
        ...source,
        id: `pers-${Date.now()}-dup-${targetLocation.id}`,
        index: state.personalizations.length + 1,
        location: targetLocation,
        pricing: { ...source.pricing, _needsRecalc: true },
      };
      return {
        ...state,
        personalizations: [...state.personalizations, newPers],
        currentStep: 'comparison' as const,
      };
    }

    case 'RESET_WIZARD':
      return initialState;

    default:
      return state;
  }
}
