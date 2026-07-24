/**
 * Domain Layer: Personalizacao / Gravacao
 *
 * Pure business rules for personalization calculations, validation,
 * transformations, repositories, and services.
 */

export type * from './types';
export * from './calculators';
export * from './validators';
export * from './selectors';
export * from './transformers';
export * from './repositories';
export * from './services';

export {
  findAll as fetchTechniquesList,
  findById as fetchTechniqueById,
} from './repositories/technique.repository';
export {
  findAll as fetchPriceTables,
  findByTechniqueName as fetchPriceTablesByTechnique,
} from './repositories/priceTable.repository';

export { transformRawToTecnicas, transformRawToTabelas } from './transformers';

export { PriceTableRepository } from './repositories/priceTable.repository';
export { PricingService } from './services/pricing.service';
