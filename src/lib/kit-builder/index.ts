/**
 * Kit Builder Module
 * Exportações centralizadas
 */

// Types
export * from './types';
export { mmToCm } from './types';

// Mock data
export { MOCK_BOXES, MOCK_ITEMS } from './mock-data';

// Volume Calculator
export {
  calculateVolume,
  calculateUsableVolume,
  calculateTotalItemsVolume,
  calculateVolumeUsagePercent,
  checkItemFits,
  isNearCapacity,
  isAtCapacity,
  formatVolume,
  formatDimensions,
  getVolumeStatusColor,
  getVolumeStatusLabel,
  parseDimensionsString,
  extractProductDimensions,
  estimateDefaultDimensions,
} from './volume-calculator';

// Price Calculator
export {
  calculateBoxPrice,
  calculateItemsPrice,
  calculatePersonalizationPrice,
  calculateTotalKitPrice,
  calculateSavings,
  formatCurrency,
  formatUnitPrice,
  generatePriceBreakdown,
} from './price-calculator';
