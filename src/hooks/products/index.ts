// Exporting all hooks from products
export {
  useAdvancedFilters,
  defaultAdvancedFilters,
  STOCK_FILTER_OPTIONS,
  SORT_OPTIONS,
} from '@/hooks/products/useAdvancedFilters';
export type {
  CategoryOption,
  SupplierOption,
  TechniqueOption,
  ColorOption,
  ColorGroupData,
  TagData,
} from '@/types/advancedFilters';
export * from '@/hooks/products/useCartTemplates';
export * from '@/hooks/products/useCatalogFiltering';
export * from '@/hooks/products/useCatalogPrefetch';
export * from '@/hooks/products/useCatalogRealStats';
export * from '@/hooks/products/useCatalogState';
export * from '@/hooks/products/useCategories';
export * from '@/hooks/products/useCategoriesTree';
export * from '@/hooks/products/useCategoryIcons';
export * from '@/hooks/products/useColorEnrichment';
export * from '@/hooks/products/useColorSystem';
export * from '@/hooks/products/useExternalCategoriesQuery';
export * from '@/hooks/products/useExternalVariantStock';
export * from '@/hooks/products/useMaterialFilter';
export * from '@/hooks/products/useProductMatch';
export * from '@/hooks/products/useProducts';
export * from '@/hooks/products/useProductsByCategory';
export * from '@/hooks/products/usePrefetchProduct';
export * from '@/hooks/products/useProductsLightweight';
export * from '@/hooks/products/useReplenishments';
export * from '@/hooks/products/useStockAlerts';
export * from '@/hooks/products/useSupplierComparison';
export * from '@/hooks/products/useSupplierFiscalData';
export * from '@/hooks/products/useSupplierNames';
export * from '@/hooks/products/useSupplierSalesRanking';
export * from '@/hooks/products/useSupplierTrust';
export { useSuppliers } from '@/hooks/products/useSuppliers';
export * from '@/hooks/products/useVariantStock';
export * from '@/hooks/products/useVariantSupplierSources';
export * from '@/hooks/products/useVideoVariantLinks';
