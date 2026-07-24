/**
 * stockAlerts — Geração de alertas de estoque extraída do useVariantStock
 */
import type { ProductStockSummary, StockAlert } from '@/types/stock';

/** Percorre todos os produtos e variações para gerar alertas de estoque crítico, baixo e chegando. */
export function generateStockAlerts(products: ProductStockSummary[]): StockAlert[] {
  const alerts: StockAlert[] = [];

  products.forEach((product) => {
    product.variants.forEach((variant) => {
      const baseAlert = {
        productId: product.productId,
        productName: product.productName,
        productSku: product.productSku,
        variantId: variant.variantId,
        colorName: variant.colorName,
        currentStock: variant.currentStock,
        threshold: variant.minStock,
        createdAt: new Date().toISOString(),
      };

      if (variant.status === 'out_of_stock') {
        alerts.push({
          id: `alert-${variant.id}-out`,
          type: 'out_of_stock',
          severity: 'error',
          title: 'Sem Estoque',
          message: `${variant.colorName || 'Variação'} está sem estoque!`,
          suggestedAction: 'Fazer pedido ao fornecedor',
          ...baseAlert,
        });
      } else if (variant.status === 'critical') {
        alerts.push({
          id: `alert-${variant.id}-critical`,
          type: 'critical',
          severity: 'error',
          title: 'Estoque Crítico',
          message: `${variant.colorName || 'Variação'}: apenas ${variant.currentStock} unidades (mínimo: ${variant.minStock})`,
          suggestedAction: 'Reabastecer urgentemente',
          ...baseAlert,
        });
      } else if (variant.status === 'low_stock') {
        alerts.push({
          id: `alert-${variant.id}-low`,
          type: 'low_stock',
          severity: 'warning',
          title: 'Estoque Baixo',
          message: `${variant.colorName || 'Variação'}: ${variant.currentStock}/${variant.minStock} mínimo`,
          suggestedAction: 'Planejar reposição',
          ...baseAlert,
        });
      }

      if (
        variant.daysUntilStockout !== undefined &&
        variant.daysUntilStockout <= 7 &&
        variant.status !== 'out_of_stock'
      ) {
        alerts.push({
          id: `alert-${variant.id}-predict`,
          type: 'stockout_predicted',
          severity: 'warning',
          title: 'Esgotamento Previsto',
          message: `${variant.colorName || 'Variação'} deve esgotar em ${variant.daysUntilStockout} dias`,
          suggestedAction: 'Antecipar pedido de reposição',
          ...baseAlert,
        });
      }
    });
  });

  return alerts.sort((a, b) => {
    const severityOrder = { error: 0, warning: 1, info: 2 };
    return severityOrder[a.severity] - severityOrder[b.severity];
  });
}
