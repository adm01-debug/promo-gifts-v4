/**
 * Domain Types: Simulator Wizard v2
 *
 * Novo fluxo: Produto → Local → Especificações → Comparativo
 *
 * O vendedor configura PRIMEIRO (cores, tamanho, tiragem),
 * depois vê TODAS as técnicas possíveis com preços para comparar.
 * Suporta múltiplas personalizações por produto.
 */

// ============================================
// STEPS DO WIZARD (4 passos)
// ============================================

export type WizardStep =
  | 'product' // Passo 1: Selecionar produto + quantidade
  | 'location' // Passo 2: Selecionar local de gravação
  | 'specs' // Passo 3: Configurar cores, tamanho
  | 'comparison'; // Passo 4: Comparativo de técnicas com preços

export const WIZARD_STEPS: WizardStep[] = ['product', 'location', 'specs', 'comparison'];

export interface WizardStepConfig {
  step: WizardStep;
  label: string;
  shortLabel: string;
  icon: string;
  description: string;
}

export const WIZARD_STEP_CONFIG: Record<WizardStep, WizardStepConfig> = {
  product: {
    step: 'product',
    label: 'Selecionar Produto',
    shortLabel: 'Produto',
    icon: 'Package',
    description: 'Escolha o produto e quantidade',
  },
  location: {
    step: 'location',
    label: 'Local de Gravação',
    shortLabel: 'Local',
    icon: 'MapPin',
    description: 'Selecione onde será aplicada a personalização',
  },
  specs: {
    step: 'specs',
    label: 'Especificações',
    shortLabel: 'Especificações',
    icon: 'SlidersHorizontal',
    description: 'Configure cores e tamanho da gravação',
  },
  comparison: {
    step: 'comparison',
    label: 'Comparativo',
    shortLabel: 'Comparativo',
    icon: 'BarChart3',
    description: 'Compare técnicas e escolha a melhor opção',
  },
};

// ============================================
// PRODUTO SELECIONADO
// ============================================

export interface ProductColorVariant {
  name: string;
  hex: string;
  code?: string;
  sku?: string;
  stock?: number;
  image?: string;
}

export interface SelectedProduct {
  id: string;
  name: string;
  sku: string;
  price: number;
  imageUrl?: string | null;
  categoryName?: string | null;
  brand?: string | null;
  colors?: ProductColorVariant[];
}

// ============================================
// LOCAL DE GRAVAÇÃO
// ============================================

export interface EngravingLocation {
  id: string;
  componentId: string;
  componentCode: string;
  componentName: string;
  locationCode: string;
  locationName: string;
  maxWidthCm: number | null;
  maxHeightCm: number | null;
  maxAreaCm2: number | null;
  areaImageUrl: string | null;
  isFromGroup: boolean;
  availableTechniques: AvailableTechnique[];
}

export interface AvailableTechnique {
  id: string;
  printAreaId: string; // ID da print area = p_area_id para fn_get_customization_price
  techniqueId: string; // Mesmo que printAreaId (cada área = 1 técnica)
  techniqueName: string;
  techniqueCode: string;
  maxColors: number | null;
  isDefault: boolean;
  isCurved?: boolean;
  hasPricing?: boolean; // true se tem customization_price_table_id
  // Dimensões específicas da área (para exibição em cards agrupados)
  areaMaxWidth?: number;
  areaMaxHeight?: number;
  // Info da tabela de preço (para exibição)
  grupoTecnica?: string;
  cobraPorCor?: boolean;
  // v6 fields
  usaDimensao?: boolean; // se precisa informar dimensões
  efetivaLarguraMax?: number; // MIN(max_width, gravacao_largura_max)
  efetivaAlturaMax?: number; // MIN(max_height, gravacao_altura_max)
  variacaoLabel?: string; // label da variação
  shape?: 'rectangle' | 'circle';
}

// ============================================
// ESPECIFICAÇÕES DA GRAVAÇÃO (Passo 3)
// ============================================

export interface EngravingSpecs {
  colors: number;
  width: number;
  height: number;
}

// ============================================
// RESULTADO DE COMPARAÇÃO (Passo 4)
// ============================================

export interface TechniqueComparisonResult {
  techniqueId: string;
  techniqueName: string;
  techniqueCode: string;
  printAreaId: string; // = p_area_id usado na RPC
  maxColors: number | null;

  // Status
  isAvailable: boolean;
  unavailableReason?: string;

  // Preços (do RPC fn_get_customization_price v5.9)
  unitPrice: number;
  setupPrice: number;
  subtotal: number;
  totalPrice: number;
  costPerUnit: number;
  minimumApplied: boolean;

  // Código de orçamento
  budgetCode: string;

  // Prazo
  productionDays: number | null;

  // Markup
  markupPercent: number;
  marginPercent: number;

  // Faixa
  tierUsed: number;
  tierMinQty: number;
  tierMaxQty: number;

  // Badges
  isCheapest?: boolean;
  isFastest?: boolean;

  // Dados completos do RPC (para uso posterior)
  rawData?: Record<string, unknown>;
}

// ============================================
// PERSONALIZAÇÃO CONFIRMADA
// ============================================

export interface Personalization {
  id: string;
  index: number;
  location: EngravingLocation;
  technique: {
    id: string;
    code: string;
    name: string;
  };
  specs: EngravingSpecs;
  pricing: {
    unitPrice: number;
    setupPrice: number;
    subtotal: number;
    totalPrice: number;
    costPerUnit: number;
    budgetCode: string;
    productionDays: number | null;
    // Marcador interno: preço precisa ser recalculado (após SET_QUANTITY/DUPLICATE).
    // Lido por useWizardPricing, opcional para não impactar contrato externo.
    _needsRecalc?: boolean;
  };
}

// ============================================
// ESTADO COMPLETO DO WIZARD
// ============================================

export interface SimulatorWizardState {
  // Navegação
  currentStep: WizardStep;

  // Passo 1: Produto
  selectedProduct: SelectedProduct | null;
  quantity: number;

  // Personalizações confirmadas
  personalizations: Personalization[];
  currentPersonalizationIndex: number;
  isEditingPersonalization: boolean;

  // Passo 2: Local
  availableLocations: EngravingLocation[];
  selectedLocation: EngravingLocation | null;

  // Passo 3: Especificações
  engravingSpecs: EngravingSpecs;

  // Passo 4: Comparativo
  comparisonResults: TechniqueComparisonResult[];
  selectedComparison: TechniqueComparisonResult | null;

  // UI State
  isCalculating: boolean;
  error: string | null;
}

// ============================================
// ACTIONS
// ============================================

export type WizardAction =
  | { type: 'SET_STEP'; payload: WizardStep }
  | { type: 'SELECT_PRODUCT'; payload: SelectedProduct | null }
  | {
      type: 'LOAD_DRAFT';
      payload: { product: SelectedProduct; quantity: number; personalizations: Personalization[] };
    }
  | { type: 'SET_QUANTITY'; payload: number }
  | { type: 'SET_AVAILABLE_LOCATIONS'; payload: EngravingLocation[] }
  | { type: 'SELECT_LOCATION'; payload: EngravingLocation | null }
  | { type: 'UPDATE_SPECS'; payload: Partial<EngravingSpecs> }
  | { type: 'SET_COMPARISON_RESULTS'; payload: TechniqueComparisonResult[] }
  | { type: 'SELECT_COMPARISON'; payload: TechniqueComparisonResult | null }
  | { type: 'ADD_PERSONALIZATION'; payload: Personalization }
  | { type: 'UPDATE_PERSONALIZATION'; payload: { index: number; personalization: Personalization } }
  | { type: 'REMOVE_PERSONALIZATION'; payload: string }
  | { type: 'REMOVE_ALL_PERSONALIZATIONS' }
  | { type: 'EDIT_PERSONALIZATION'; payload: number }
  | { type: 'START_NEW_PERSONALIZATION' }
  | { type: 'CANCEL_PERSONALIZATION' }
  | { type: 'SET_CALCULATING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | {
      type: 'RECALC_PERSONALIZATION_PRICING';
      payload: { personalizationId: string; pricing: Personalization['pricing'] };
    }
  | {
      type: 'DUPLICATE_PERSONALIZATION';
      payload: { sourceId: string; targetLocation: EngravingLocation };
    }
  | { type: 'RESET_WIZARD' };

// ============================================
// HELPERS
// ============================================

export const getStepIndex = (step: WizardStep): number => {
  return WIZARD_STEPS.indexOf(step);
};

export const getNextStep = (currentStep: WizardStep): WizardStep | null => {
  const index = getStepIndex(currentStep);
  if (index < WIZARD_STEPS.length - 1) {
    return WIZARD_STEPS[index + 1];
  }
  return null;
};

export const getPreviousStep = (currentStep: WizardStep): WizardStep | null => {
  const index = getStepIndex(currentStep);
  if (index > 0) {
    return WIZARD_STEPS[index - 1];
  }
  return null;
};

export const isStepComplete = (step: WizardStep, state: SimulatorWizardState): boolean => {
  switch (step) {
    case 'product':
      return state.selectedProduct !== null && state.quantity > 0;
    case 'location':
      return state.selectedLocation !== null;
    case 'specs':
      return (
        state.engravingSpecs.colors > 0 &&
        state.engravingSpecs.width > 0 &&
        state.engravingSpecs.height > 0
      );
    case 'comparison':
      return state.selectedComparison !== null;
    default:
      return false;
  }
};

export const canNavigateToStep = (targetStep: WizardStep, state: SimulatorWizardState): boolean => {
  const targetIndex = getStepIndex(targetStep);
  const currentIndex = getStepIndex(state.currentStep);

  // Sempre pode voltar
  if (targetIndex <= currentIndex) return true;

  // Se já tem personalizações, pode ir direto ao comparativo (resumo)
  if (targetStep === 'comparison' && state.personalizations.length > 0) return true;

  for (let i = 0; i < targetIndex; i++) {
    if (!isStepComplete(WIZARD_STEPS[i], state)) {
      return false;
    }
  }

  return true;
};
