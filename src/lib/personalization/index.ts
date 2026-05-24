<<<<<<< HEAD
/**
 * Domain Layer: Personalização / Gravação
 *
 * Regras de negócio puras, sem dependências de React ou side effects.
 * Este módulo é o SSOT para cálculos e validações de personalização.
 *
 * ARQUITETURA:
 * ├── types/          - Tipos de domínio
 * ├── calculators/    - Funções de cálculo
 * ├── validators/     - Funções de validação
 * ├── selectors/      - Funções de seleção
 * ├── transformers/   - Transformação de dados
 * ├── repositories/   - Acesso a dados (BD externo)
 * └── services/       - Orquestração de negócio
 *
 * USO:
 * - Hooks devem importar transformadores daqui
 * - Componentes devem usar services para lógica complexa
 * - Repositories abstraem acesso ao BD
 * - Nunca duplicar lógica de transformação nos hooks
 */

export * from './types';
export * from './calculators';
export * from './validators';
export * from './selectors';
export * from './transformers';
export * from './repositories';
export * from './services';

// Re-export principais transformadores para facilitar imports
=======
// Personalization Library - Main Export
export {
  fetchTechniquesList,
  fetchTechniqueById,
  fetchPriceTables,
  fetchPriceTablesByTechnique,
} from './repositories/technique.repository';

>>>>>>> origin/main
export {
  transformRawToTecnicas,
  transformRawToTabelas,
} from './transformers';

// Re-export principais repositórios
// TechniqueRepository functions available via repositories/index
export { PriceTableRepository } from './repositories/priceTable.repository';

// Re-export principais serviços
export { PricingService } from './services/pricing.service';
