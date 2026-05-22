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
export {
  rawToTecnicaUnificada,
  rawToTabelaPrecoTecnica,
  transformRawToTecnicas,
  transformRawToTabelas,
} from './transformers';

// Re-export principais repositórios
export { TechniqueRepository } from './repositories/technique.repository';
export { PriceTableRepository } from './repositories/priceTable.repository';

// Re-export principais serviços
export { PricingService } from './services/pricing.service';
