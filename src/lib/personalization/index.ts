// Personalization Library - Main Export
export {
  fetchTechniquesList,
  fetchTechniqueById,
  fetchPriceTables,
  fetchPriceTablesByTechnique,
} from './repositories/technique.repository';

export {
  transformRawToTecnicas,
  transformRawToTabelas,
} from './transformers';

// Re-export principais repositórios
// TechniqueRepository functions available via repositories/index
export { PriceTableRepository } from './repositories/priceTable.repository';

// Re-export principais serviços
export { PricingService } from './services/pricing.service';
