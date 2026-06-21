// ============================================
// TIPOS PARA GESTÃO DE ESTOQUE GRANULAR
// Por Cor/Variação/SKU
// ============================================

// ============================================
// ESTOQUE POR VARIAÇÃO
// ============================================

/**
 * Campos canônicos de negócio de uma variação de estoque.
 * Contém apenas dados de quantidade, status e temporalidade — sem dependência
 * da camada de apresentação. Funções de cálculo, filtragem e agregação devem
 * receber `VariantStockCore` em vez de `VariantStock` para explicitar que não
 * precisam de enriquecimento visual.
 */
export interface VariantStockCore {
  id: string;
  productId: string;
  variantId: string;
  variantSku: string;

  // Identificação da variação
  colorId?: string;
  colorName?: string;
  sizeName?: string;
  sizeCode?: string;
  attributeValues?: Record<string, string>;

  // Estoque atual
  currentStock: number;
  minStock: number;
  maxStock?: number;

  // Reservas e disponibilidade
  reservedStock: number; // Reservado em pedidos pendentes
  inTransitStock: number; // Em trânsito (pedido ao fornecedor)
  availableStock: number; // Disponível para venda (current - reserved)

  // Estoque futuro/previsão
  futureStock?: number;
  futureStockDate?: string;
  expectedReplenishDate?: string;
  /**
   * Reposições futuras granulares (quantidade × data) quando a fonte expõe
   * múltiplas chegadas com datas distintas (ex.: next_quantity_1..3 /
   * next_date_1..3 em `variant_supplier_sources`).
   *
   * Por quê: `futureStock` é um total único atrelado a `futureStockDate`
   * (uma só data). Quando uma variação tem 3 chegadas em datas diferentes,
   * colapsá-las numa única data faz o filtro de janela ("Estoque Futuro
   * dentro de N dias") superestimar (conta chegadas distantes dentro de uma
   * janela curta) ou subestimar (ignora uma chegada cuja 2ª/3ª data está na
   * janela, mas a 1ª não). Com os segmentos, a janela soma APENAS as
   * chegadas com data ≤ corte. Opcional — consumidores caem no comportamento
   * de data única quando ausente.
   */
  futureSegments?: Array<{ quantity: number; date: string }>;

  // Status calculado
  status: StockStatus;

  // Métricas
  daysUntilStockout?: number;
  avgDailySales?: number;
  lastSaleDate?: string;
  lastRestockDate?: string;

  // Metadados
  updatedAt: string;
  notes?: string;
}

/**
 * Campos de enriquecimento visual de uma variação — adicionados pela camada
 * de busca a partir de tabelas auxiliares (product_images, paleta de cores).
 * Não fazem parte da lógica de negócio: cálculos de estoque, alertas e
 * filtros de quantidade operam apenas sobre `VariantStockCore`.
 */
export interface VariantStockUIFields {
  /** URL de imagem da variação (do product_images, ou fallback do produto pai). */
  imageUrl?: string;
  /** Código hex para swatch de cor (#RRGGBB). Uso exclusivo de apresentação. */
  colorHex?: string;
  /** Agrupamento visual de cor (ex.: "Azuis", "Vermelhos") para chips de filtro. */
  colorGroup?: string;
}

/**
 * Dados completos de estoque por variação (cor/tamanho/SKU).
 *
 * União de dados de negócio (`VariantStockCore`) com enriquecimento visual
 * (`VariantStockUIFields`). Tipo de uso geral — backward-compatible com todos
 * os consumidores existentes. Prefira `VariantStockCore` em funções de cálculo
 * e filtragem que não precisam de campos de apresentação.
 */
export type VariantStock = VariantStockCore & VariantStockUIFields;

/** Status de disponibilidade de uma variação de estoque. */
export type StockStatus =
  | 'in_stock' // Estoque OK
  | 'low_stock' // Abaixo do mínimo
  | 'critical' // Crítico (< 25% do mínimo)
  | 'out_of_stock' // Sem estoque
  | 'overstocked' // Excesso de estoque
  | 'incoming'; // Estoque chegando

// ============================================
// PRODUTO COM ESTOQUE DETALHADO
// ============================================

/** Resumo de estoque de um produto com todas as suas variações agregadas. */
export interface ProductStockSummary {
  productId: string;
  productName: string;
  productSku: string;
  productImageUrl?: string;
  categoryId?: string;
  categoryName?: string;
  supplierName?: string;

  // Totais agregados
  totalCurrentStock: number;
  totalMinStock: number;
  totalReservedStock: number;
  totalInTransitStock: number;
  totalAvailableStock: number;

  // Status geral do produto
  overallStatus: StockStatus;

  // Contagens por status
  variantsInStock: number;
  variantsLowStock: number;
  variantsCritical: number;
  variantsOutOfStock: number;

  // Total de variações
  totalVariants: number;

  // Variações detalhadas
  variants: VariantStock[];

  // Cores únicas disponíveis
  availableColors: ColorStockInfo[];

  // Previsões
  nextRestockDate?: string;
  daysUntilFullStockout?: number;
}

/** Disponibilidade de estoque para uma cor específica do produto. */
export interface ColorStockInfo {
  colorId?: string;
  colorName: string;
  colorHex?: string;
  totalStock: number;
  availableStock: number;
  status: StockStatus;
  variants: VariantStock[];
}

// ============================================
// ESTOQUE FUTURO / PREVISÃO
// ============================================

/** Previsão de chegada de estoque futuro (pedido de compra, produção ou transferência). */
export interface FutureStockEntry {
  id: string;
  productId: string;
  productName?: string;
  productSku?: string;
  variantId?: string;
  colorName?: string;

  // Quantidade esperada
  expectedQuantity: number;

  // Datas
  expectedDate: string;
  orderDate?: string;

  // Origem
  source: 'purchase_order' | 'production' | 'transfer' | 'manual';
  sourceReference?: string; // ID do pedido de compra, etc.

  // Status
  status: 'pending' | 'confirmed' | 'in_transit' | 'partial' | 'completed' | 'cancelled';

  // Fornecedor
  supplierId?: string;
  supplierName?: string;

  // Notas
  notes?: string;

  createdAt: string;
  updatedAt: string;
}

// ============================================
// MOVIMENTAÇÕES DE ESTOQUE
// ============================================

/** Registro de movimentação de estoque (entrada, saída, ajuste, transferência). */
export interface StockMovement {
  id: string;
  productId: string;
  variantId?: string;
  colorName?: string;

  // Tipo e quantidade
  type: StockMovementType;
  quantity: number;
  previousStock: number;
  newStock: number;

  // Referência
  reason: string;
  reference?: string; // ID do pedido, nota fiscal, etc.
  referenceType?: 'order' | 'purchase' | 'adjustment' | 'transfer' | 'return';

  // Custo
  unitCost?: number;
  totalCost?: number;

  // Rastreamento
  createdAt: string;
  createdBy?: string;
  createdByName?: string;
}

/** Categoria de movimentação de estoque. */
export type StockMovementType =
  | 'in' // Entrada
  | 'out' // Saída (venda)
  | 'adjustment' // Ajuste de inventário
  | 'transfer' // Transferência entre locais
  | 'return' // Devolução
  | 'reserved' // Reserva para pedido
  | 'released'; // Liberação de reserva

// ============================================
// ALERTAS DE ESTOQUE
// ============================================

/** Alerta de estoque gerado quando um produto atinge um limiar crítico. */
export interface StockAlert {
  id: string;
  type: StockAlertType;
  severity: 'info' | 'warning' | 'error';

  // Produto/Variação afetada
  productId: string;
  productName: string;
  productSku: string;
  variantId?: string;
  colorName?: string;

  // Mensagem
  title: string;
  message: string;

  // Dados
  currentStock: number;
  threshold: number;

  // Ação sugerida
  suggestedAction?: string;
  actionUrl?: string;

  // Metadados
  createdAt: string;
  dismissedAt?: string;
  dismissedBy?: string;
}

/** Categoria de alerta de estoque. */
export type StockAlertType =
  | 'out_of_stock'
  | 'critical'
  | 'low_stock'
  | 'restock_needed'
  | 'overstock'
  | 'incoming_delayed'
  | 'stockout_predicted';

// ============================================
// FILTROS E ORDENAÇÃO
// ============================================

/** Critérios de filtro, ordenação e agrupamento do dashboard de estoque. */
export interface StockFilters {
  // Filtros de status
  status: StockStatus | 'all';

  // Filtros de produto
  productId?: string;
  categoryId?: string;
  supplierId?: string;

  // Filtros de cor/variação
  colorGroup?: string;
  colorName?: string;

  // Quantidade mínima necessária (smart filter)
  minQuantityNeeded?: number;
  // Quando true, soma o Estoque Futuro (dentro da janela) ao pool da régua
  // "Preciso de X un". Padrão: false (estrito sobre disponível agora).
  minQtyIncludesFutureStock?: boolean;

  // Estoque futuro — quando true, soma futureStock dentro da janela
  includeFutureStock?: boolean;
  futureStockWindowDays?: 7 | 15 | 30;

  // Busca
  search: string;

  // Ordenação
  sortBy: StockSortOption;
  sortDirection: 'asc' | 'desc';

  // Agrupamento
  groupBy: StockGroupOption;

  // Flags
  showOnlyWithVariants: boolean;
  showOnlyWithAlerts: boolean;
}

/** Critérios de ordenação disponíveis no dashboard de estoque. */
export type StockSortOption =
  | 'name'
  | 'sku'
  | 'stock_quantity'
  | 'available_stock'
  | 'days_remaining';

/** Opções de agrupamento de produtos no dashboard de estoque. */
export type StockGroupOption =
  | 'none'
  | 'product'
  | 'color'
  | 'color_group'
  | 'status'
  | 'category'
  | 'supplier';

/** Filtros padrão aplicados ao abrir o dashboard de estoque. */
export const defaultStockFilters: StockFilters = {
  status: 'all',
  search: '',
  sortBy: 'stock_quantity',
  sortDirection: 'asc',
  groupBy: 'product',
  showOnlyWithVariants: false,
  showOnlyWithAlerts: false,
  includeFutureStock: false,
  futureStockWindowDays: 15,
};

// ============================================
// RESUMO GERAL DE ESTOQUE
// ============================================

/** Totais agregados exibidos nos cards do dashboard de estoque. */
export interface StockDashboardSummary {
  // Contagens
  totalProducts: number;
  totalVariants: number;
  totalColors: number;

  // Por status
  productsInStock: number;
  productsLowStock: number;
  productsCritical: number;
  productsOutOfStock: number;

  variantsInStock: number;
  variantsLowStock: number;
  variantsCritical: number;
  variantsOutOfStock: number;

  // Valores
  totalStockValue: number;
  totalAvailableValue: number;

  // Métricas
  averageDaysOfStock: number;
  stockTurnoverRate: number;

  // Alertas
  totalAlerts: number;
  criticalAlerts: number;

  // Estoque futuro
  incomingStockValue: number;
  nextRestockDate?: string;
}

// ============================================
// HELPERS DE CÁLCULO
// ============================================

/** Classifica o status de estoque de uma variação com base em estoque atual, máximo e em trânsito. */
export function calculateStockStatus(
  current: number,
  _min: number,
  max?: number,
  inTransit?: number,
): StockStatus {
  // NOTA: a régua histórica baseada em `min` (low_stock/critical) foi
  // descontinuada na UI por gerar confusão. O parâmetro é mantido por
  // compatibilidade de contrato. O nível "Risco de Ruptura" agora é
  // calculado exclusivamente pela camada preditiva (rupture-risk.ts),
  // que usa média de baixa real × horizonte × alvo do vendedor.
  if (current <= 0) {
    if (inTransit && inTransit > 0) return 'incoming';
    return 'out_of_stock';
  }
  if (max && current > max * 1.5) return 'overstocked';
  return 'in_stock';
}

/** Estima dias até o esgotamento com base no estoque atual e na média diária de vendas. */
export function calculateDaysUntilStockout(
  currentStock: number,
  avgDailySales = 2,
): number | undefined {
  // Guarda defensiva: NaN, Infinity, negativos e zero → indefinido.
  if (!Number.isFinite(currentStock) || !Number.isFinite(avgDailySales)) return undefined;
  if (avgDailySales <= 0 || currentStock <= 0) return undefined;
  return Math.floor(currentStock / avgDailySales);
}

/** Retorna o estoque disponível (atual menos reservado, mínimo 0). */
export function calculateAvailableStock(currentStock: number, reservedStock = 0): number {
  return Math.max(0, currentStock - reservedStock);
}

/** Agrega múltiplas variações em totais consolidados de produto (sem metadados de identificação). */
export function aggregateVariantsToProduct(
  variants: VariantStock[],
): Omit<
  ProductStockSummary,
  | 'productId'
  | 'productName'
  | 'productSku'
  | 'productImageUrl'
  | 'categoryId'
  | 'categoryName'
  | 'supplierName'
> {
  const totalCurrentStock = variants.reduce((sum, v) => sum + v.currentStock, 0);
  const totalMinStock = variants.reduce((sum, v) => sum + v.minStock, 0);
  const totalReservedStock = variants.reduce((sum, v) => sum + v.reservedStock, 0);
  const totalInTransitStock = variants.reduce((sum, v) => sum + v.inTransitStock, 0);
  const totalAvailableStock = variants.reduce((sum, v) => sum + v.availableStock, 0);

  // #13 fix: single-loop variant status counting (O(n) instead of O(4n))
  let variantsInStock = 0;
  let variantsLowStock = 0;
  let variantsCritical = 0;
  let variantsOutOfStock = 0;
  for (const v of variants) {
    switch (v.status) {
      case 'in_stock':
      case 'incoming':
      case 'overstocked':
        variantsInStock++;
        break;
      case 'low_stock':
        variantsLowStock++;
        break;
      case 'critical':
        variantsCritical++;
        break;
      case 'out_of_stock':
        variantsOutOfStock++;
        break;
    }
  }

  // Agrupar por cor
  const colorMap = new Map<string, VariantStock[]>();
  variants.forEach((v) => {
    const colorKey = v.colorName || 'Sem cor';
    if (!colorMap.has(colorKey)) {
      colorMap.set(colorKey, []);
    }
    colorMap.get(colorKey)?.push(v);
  });

  const availableColors: ColorStockInfo[] = Array.from(colorMap.entries()).map(
    ([colorName, colorVariants]) => {
      const totalStock = colorVariants.reduce((sum, v) => sum + v.currentStock, 0);
      const availableStock = colorVariants.reduce((sum, v) => sum + v.availableStock, 0);
      const minStock = colorVariants.reduce((sum, v) => sum + v.minStock, 0);

      return {
        colorId: colorVariants[0]?.colorId,
        colorName,
        colorHex: colorVariants[0]?.colorHex,
        totalStock,
        availableStock,
        status: calculateStockStatus(totalStock, minStock),
        variants: colorVariants,
      };
    },
  );

  // Contagem de variantes com estoque chegando
  const variantsIncoming = variants.filter(
    (v) => v.status === 'incoming' || v.inTransitStock > 0,
  ).length;

  // Status geral - prioridade: incoming > out_of_stock > critical > low_stock > in_stock
  let overallStatus: StockStatus = 'in_stock';
  if (variants.length === 0) {
    // Edge case: no variants — report as in_stock (nothing to alert on)
    overallStatus = 'in_stock';
  } else if (variantsIncoming > 0 && (variantsOutOfStock > 0 || totalCurrentStock === 0)) {
    overallStatus = 'incoming';
  } else if (variantsOutOfStock === variants.length) {
    overallStatus = 'out_of_stock';
  } else if (variantsCritical > 0 || variantsOutOfStock > 0) {
    overallStatus = 'critical';
  } else if (variantsLowStock > 0) {
    overallStatus = 'low_stock';
  }

  return {
    totalCurrentStock,
    totalMinStock,
    totalReservedStock,
    totalInTransitStock,
    totalAvailableStock,
    overallStatus,
    variantsInStock,
    variantsLowStock,
    variantsCritical,
    variantsOutOfStock,
    totalVariants: variants.length,
    variants,
    availableColors,
  };
}
