// ============================================
// SIMULATION DOMAIN TYPES
// ============================================

export interface SimulationProduct {
  id: string;
  name: string;
  sku: string;
  price: number;
  image_url?: string;
  stock?: number;
  images?: string[];
  category?: { id: string; name: string };
  supplier?: { id: string; name: string };
  colors?: SimulatorProductColor[];
}

/** @deprecated Use ProductColor from @/types/product */
interface SimulatorProductColor {
  code: string;
  name: string;
  hex?: string;
  stock?: number;
}

export interface SimulationClient {
  id: string;
  name: string;
  company?: string;
  email?: string;
  phone?: string;
  cnpj?: string;
}

/** Per-technique inputs collected in the wizard (keyed by techniqueId upstream). */
export interface TechniqueSettings {
  colors: number;
  width: number;
  height: number;
  positions: number;
}

/**
 * Computed pricing option produced by `simulationPriceFetcher` (one per technique).
 * Mirrors the object literals built there — the source of truth for the simulator UI.
 */
export interface SimulationOption {
  id: string;
  techniqueId: string;
  techniqueName: string;
  techniqueCode: string;
  colors: number;
  width: number;
  height: number;
  positions: number;
  unitCost: number;
  setupCost: number;
  totalPersonalizationCost: number;
  costPerUnit: number;
  estimatedDays: number;
  productUnitPrice: number;
  totalProductCost: number;
  grandTotal: number;
  grandTotalPerUnit: number;
  priceSource: 'legacy-fallback' | 'rpc' | 'unavailable';
  unavailableReason?: string;
  fallbackReason?: string;
  calculatedAt: string;
  rpcAvailable: boolean;
}

/** Row of `public.personalization_simulations` (snake_case as stored in Supabase). */
export interface SavedSimulation {
  id: string;
  seller_id?: string;
  client_id?: string | null;
  client_name?: string | null;
  product_id: string;
  product_name?: string;
  product_sku?: string;
  quantity: number;
  product_unit_price: number;
  simulation_data: SimulationOption[];
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
}

export type SimulatorStep = 'product' | 'results' | 'techniques';

export interface SimulatorState {
  step: SimulatorStep;
  selectedProduct: SimulationProduct | null;
  selectedClient: SimulationClient | null;
  techniques: TechniqueSettings[];
  quantity: number;
  isLoading: boolean;
  error: string | null;
}

export interface SimulationScenario {
  id: string;
  name: string;
  product: SimulationProduct;
  techniques: TechniqueSettings[];
  quantity: number;
  totalPrice: number;
}

export interface SimulationResult {
  scenario: SimulationScenario;
  breakdown: {
    productTotal: number;
    techniquesTotal: number;
    setupTotal: number;
    grandTotal: number;
    unitPrice: number;
  };
}
