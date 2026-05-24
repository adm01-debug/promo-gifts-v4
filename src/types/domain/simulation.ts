// ============================================
// SIMULATION DOMAIN TYPES
// ============================================

export interface SimulationProduct {
  id: string;
  name: string;
  sku: string;
  price: number;
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

export interface TechniqueSettings {
  techniqueId: string;
  techniqueName: string;
  techniqueCode: string;
  colors: number;
  width?: number;
  height?: number;
  position?: string;
}

export interface SimulationOption {
  id: string;
  product: SimulationProduct;
  client: SimulationClient;
  techniques: TechniqueSettings[];
  quantity: number;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface SavedSimulation {
  id: string;
  name: string;
  options: SimulationOption[];
  totalPrice: number;
  status: 'draft' | 'sent' | 'approved' | 'rejected';
  createdAt: Date;
  updatedAt: Date;
}

export type SimulatorStep = 'product' | 'techniques' | 'results';

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
