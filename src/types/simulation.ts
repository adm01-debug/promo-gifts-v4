/**
 * Types: Simulation
 * 
 * @deprecated Use tipos de src/types/domain/simulation
 * Este arquivo mantém compatibilidade com código legado.
 */

// Re-export dos tipos de domínio
export type {
  SimulationProduct as Product,
  SimulationClient as Client,
  TechniqueSettings,
  SimulationOption,
  SavedSimulation,
  SimulatorStep,
  SimulatorState,
  SimulationScenario,
  SimulationResult,
} from './domain';
export type { ProductColor } from './product';

// ============================================
// TIPOS LEGADOS (para compatibilidade)
// ============================================

/**
 * @deprecated Use Technique de src/types/domain/personalization
 */
export interface Technique {
  id: string;
  code: string;
  name: string;
  description: string | null;
  unit_cost: number;
  setup_cost: number;
  estimated_days: number;
  min_quantity: number;
}
