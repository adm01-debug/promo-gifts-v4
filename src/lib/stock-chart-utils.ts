/**
 * Utilitários compartilhados entre StockHistoryChart e SupplierRiskPanel.
 * Elimina ~198 linhas de duplicação.
 */
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { IntelligenceFlag, ProductIntelligenceData } from '@/hooks/intelligence';
import {
  Flame,
  AlertTriangle,
  Zap,
  Moon,
  DollarSign,
  RefreshCw,
  Star,
  Trophy,
  Eye,
} from 'lucide-react';

// ---------- Deterministic random ----------

export function seededRandom(seed: number): number {
  const x = Math.sin(seed + 1) * 10000;
  return x - Math.floor(x);
}

export function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

// ---------- Safe velocity helpers ----------

export function safeVelocityTrend(trend: number | null | undefined): number | null {
  if (trend === null || trend === undefined || !Number.isFinite(trend)) return null;
  return trend;
}

export function safeNumber(value: number | null | undefined): number | null {
  if (value === null || value === undefined || !Number.isFinite(value)) return null;
  return value;
}

// ---------- Mock data generation ----------

export interface MockChartPoint {
  date: string;
  stockClose: number;
  depleted: number;
  restocked: number;
  restockDetected: boolean;
  costPriceClose: number;
  dateFormatted: string;
  fullDate: string;
}

export function generateMockStockData(productId: string, days: number): MockChartPoint[] {
  const baseSeed = hashCode(productId);
  const data: MockChartPoint[] = [];
  const now = new Date();
  let stock = 850 + Math.floor(seededRandom(baseSeed) * 200);

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const dayIdx = days - 1 - i;
    const depleted = Math.floor(seededRandom(baseSeed + dayIdx * 3) * 25) + 3;
    const isRestock = seededRandom(baseSeed + dayIdx * 3 + 1) < 0.08;
    const restocked = isRestock
      ? Math.floor(seededRandom(baseSeed + dayIdx * 3 + 2) * 200) + 100
      : 0;
    stock = Math.max(50, stock - depleted + restocked);
    data.push({
      date: format(d, 'yyyy-MM-dd'),
      stockClose: stock,
      depleted,
      restocked,
      restockDetected: isRestock,
      costPriceClose: 4.5 + seededRandom(baseSeed + dayIdx * 5) * 0.3,
      dateFormatted: format(d, 'dd/MM', { locale: ptBR }),
      fullDate: format(d, 'dd/MM/yyyy', { locale: ptBR }),
    });
  }
  return data;
}

// ---------- Mock intelligence (consistent with chart data) ----------

const MOCK_SUPPLIER_NAMES = [
  'Spot Promo',
  'Asia Import',
  'Brasil Brindes',
  'Premium Gifts',
  'Master Promo',
];

export interface MockVelocityData {
  variant_supplier_source_id: string;
  supplier_id: string;
  product_id: string;
  variant_id: string;
  current_stock: number;
  avg_daily_depletion_7d: number;
  avg_daily_depletion_30d: number;
  avg_daily_depletion_90d: number;
  velocity_trend: number;
  days_to_stockout: number | null;
  total_depleted_7d: number;
  total_depleted_30d: number;
  total_depleted_90d: number;
  total_restocked_30d: number;
  restock_events_30d: number;
  avg_days_between_restocks: number | null;
  price_changes_30d: number;
  active_days_7d: number;
  active_days_30d: number;
  active_days_90d: number;
}

export function generateMockVelocity(productId: string): MockVelocityData {
  return generateMockVelocities(productId)[0];
}

/**
 * Generates mock velocity data for multiple suppliers (2-4).
 */
export function generateMockVelocities(productId: string): MockVelocityData[] {
  const baseSeed = hashCode(productId);
  const supplierCount = 2 + Math.floor(seededRandom(baseSeed + 300) * 3); // 2-4 suppliers
  const velocities: MockVelocityData[] = [];

  for (let i = 0; i < supplierCount; i++) {
    const seed = baseSeed + 100 + i * 50;
    // First supplier has highest velocity, others progressively less
    const velocityFactor = 1 - i * 0.25;
    const depletion7d = (8 + seededRandom(seed) * 12) * velocityFactor;
    const depletion30d = (6 + seededRandom(seed + 1) * 10) * velocityFactor;
    const currentStock = Math.floor(
      (200 + seededRandom(seed + 2) * 400) * (1 + seededRandom(seed + 3) * 0.5),
    );
    const daysToStockout = depletion7d > 0.5 ? Math.round(currentStock / depletion7d) : null;

    velocities.push({
      variant_supplier_source_id: `mock-vss-${productId.slice(0, 8)}-${i}`,
      supplier_id: `mock-supplier-${i}`,
      product_id: productId,
      variant_id: `mock-variant-${productId.slice(0, 8)}`,
      current_stock: currentStock,
      avg_daily_depletion_7d: Math.round(depletion7d * 10) / 10,
      avg_daily_depletion_30d: Math.round(depletion30d * 10) / 10,
      avg_daily_depletion_90d: Math.round(depletion30d * 0.9 * 10) / 10,
      velocity_trend: 0.7 + seededRandom(seed + 4) * 0.8,
      days_to_stockout: daysToStockout,
      total_depleted_7d: Math.round(depletion7d * 7),
      total_depleted_30d: Math.round(depletion30d * 30),
      total_depleted_90d: Math.round(depletion30d * 90 * 0.9),
      total_restocked_30d: Math.round(depletion30d * 30 * 1.1),
      restock_events_30d: Math.floor(seededRandom(seed + 5) * 4),
      avg_days_between_restocks: 7 + Math.floor(seededRandom(seed + 6) * 14),
      price_changes_30d: Math.floor(seededRandom(seed + 7) * 3),
      active_days_7d: 5 + Math.floor(seededRandom(seed + 8) * 2),
      active_days_30d: 20 + Math.floor(seededRandom(seed + 9) * 10),
      active_days_90d: 60 + Math.floor(seededRandom(seed + 10) * 30),
    });
  }

  return velocities;
}

/**
 * Returns mock supplier names map for demo mode.
 */
export function generateMockSupplierNames(productId: string): Map<string, string> {
  const baseSeed = hashCode(productId);
  const count = 2 + Math.floor(seededRandom(baseSeed + 300) * 3);
  const map = new Map<string, string>();
  for (let i = 0; i < count; i++) {
    const nameIdx =
      Math.floor(seededRandom(baseSeed + 400 + i) * MOCK_SUPPLIER_NAMES.length) %
      MOCK_SUPPLIER_NAMES.length;
    map.set(`mock-supplier-${i}`, MOCK_SUPPLIER_NAMES[nameIdx]);
  }
  return map;
}

export interface MockIntelligenceData {
  _isMock: true;
  product_id: string;
  supplier_count: number;
  total_current_stock: number;
  total_depleted_7d: number;
  total_depleted_30d: number;
  total_depleted_90d: number;
  total_restocked_30d: number;
  avg_velocity_7d: number;
  avg_velocity_30d: number;
  max_velocity_trend: number;
  min_days_to_stockout: number | null;
  turnover_score: number;
  abc_classification: 'A' | 'B' | 'C';
  is_hot_product: boolean;
  is_stockout_risk: boolean;
  is_stagnant: boolean;
  is_negotiation_opportunity: boolean;
  has_frequent_restock: boolean;
}

export function generateMockIntelligence(productId: string): MockIntelligenceData {
  const baseSeed = hashCode(productId);
  const vels = generateMockVelocities(productId);
  const vel = vels[0]; // best velocity
  const abcRoll = seededRandom(baseSeed + 200);
  const abc: 'A' | 'B' | 'C' = abcRoll < 0.2 ? 'A' : abcRoll < 0.5 ? 'B' : 'C';
  const totalStock = vels.reduce((sum, v) => sum + v.current_stock, 0);

  return {
    _isMock: true as const,
    product_id: productId,
    supplier_count: vels.length,
    total_current_stock: totalStock,
    total_depleted_7d: vels.reduce((sum, v) => sum + v.total_depleted_7d, 0),
    total_depleted_30d: vels.reduce((sum, v) => sum + v.total_depleted_30d, 0),
    total_depleted_90d: vels.reduce((sum, v) => sum + v.total_depleted_90d, 0),
    total_restocked_30d: vels.reduce((sum, v) => sum + v.total_restocked_30d, 0),
    avg_velocity_7d: vel.avg_daily_depletion_7d,
    avg_velocity_30d: vel.avg_daily_depletion_30d,
    max_velocity_trend: vel.velocity_trend,
    min_days_to_stockout: vel.days_to_stockout,
    turnover_score: Math.round(seededRandom(baseSeed + 202) * 100),
    abc_classification: abc,
    is_hot_product: abc === 'A' && vel.velocity_trend > 1.1,
    is_stockout_risk: vel.days_to_stockout !== null && vel.days_to_stockout < 14,
    is_stagnant: vel.avg_daily_depletion_7d < 2,
    is_negotiation_opportunity: vel.avg_daily_depletion_7d < 3 && vel.current_stock > 500,
    has_frequent_restock: seededRandom(baseSeed + 203) > 0.6,
  };
}

// ---------- Flag configs ----------

interface FlagConfig {
  icon: typeof Flame;
  label: string;
  colors: string;
  description: string;
}

/** Flags com foco COMERCIAL (página de produto) */
export const COMMERCIAL_FLAG_CONFIG: Record<IntelligenceFlag, FlagConfig> = {
  'hot-product': {
    icon: Flame,
    label: 'Sucesso no Mercado',
    colors: 'bg-destructive/15 text-destructive border-destructive/30',
    description: 'Alta saída no fornecedor — seus concorrentes estão vendendo bastante',
  },
  'stockout-risk': {
    icon: Zap,
    label: 'Esgotando Rápido',
    colors: 'bg-amber-500/15 text-amber-600 border-amber-500/30',
    description: 'Demanda do mercado está consumindo o estoque — feche antes que acabe',
  },
  stagnant: {
    icon: Eye,
    label: 'Baixa Procura',
    colors: 'bg-muted text-muted-foreground border-border',
    description: 'Pouca movimentação no mercado — avalie se vale incluir na oferta',
  },
  'negotiation-opportunity': {
    icon: DollarSign,
    label: 'Negocie Preço',
    colors: 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30',
    description: 'Estoque parado no fornecedor — momento ideal para negociar desconto',
  },
  'frequent-restock': {
    icon: RefreshCw,
    label: 'Demanda Confirmada',
    colors: 'bg-primary/15 text-primary border-primary/30',
    description: 'Fornecedor reabastece frequentemente — o mercado compra de forma recorrente',
  },
  'class-a': {
    icon: Trophy,
    label: 'Best-Seller',
    colors: 'bg-amber-500/15 text-amber-600 border-amber-500/30',
    description: 'Top 20% em vendas no mercado — produto essencial no portfólio',
  },
};

/** Flags com foco OPERACIONAL (dashboard de risco) */
export const OPERATIONAL_FLAG_CONFIG: Record<IntelligenceFlag, FlagConfig> = {
  'hot-product': {
    icon: Flame,
    label: 'Produto Quente',
    colors: 'bg-destructive/15 text-destructive border-destructive/30',
    description: 'Vendendo rápido no fornecedor — pode acabar em breve',
  },
  'stockout-risk': {
    icon: AlertTriangle,
    label: 'Risco de Ruptura',
    colors: 'bg-destructive/15 text-destructive border-destructive/30',
    description: 'Menos de 7 dias de estoque restante no fornecedor',
  },
  stagnant: {
    icon: Moon,
    label: 'Estagnado',
    colors: 'bg-muted text-muted-foreground border-border',
    description: 'Baixa saída nos últimos 30 dias com estoque alto',
  },
  'negotiation-opportunity': {
    icon: DollarSign,
    label: 'Oportunidade de Desconto',
    colors: 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30',
    description: 'Estoque encalhado no fornecedor — bom momento para pedir desconto',
  },
  'frequent-restock': {
    icon: RefreshCw,
    label: 'Alta Demanda',
    colors: 'bg-primary/15 text-primary border-primary/30',
    description: 'Fornecedor reabastece frequentemente — demanda confirmada',
  },
  'class-a': {
    icon: Star,
    label: 'Classe A',
    colors: 'bg-amber-500/15 text-amber-600 border-amber-500/30',
    description: 'Top 20% em giro de estoque no fornecedor',
  },
};

// ---------- Trend display helpers ----------

export function formatVelocityTrendOperational(trend: number | null): {
  value: string;
  label: string;
} {
  if (trend === null) return { value: '—', label: '' };
  const pct = (trend - 1) * 100;
  if (!Number.isFinite(pct)) return { value: '—', label: '' };
  return {
    value: `${pct > 0 ? '+' : ''}${pct.toFixed(0)}%`,
    label:
      trend > 1.5
        ? 'acelerando!'
        : trend > 1
          ? 'crescendo'
          : trend > 0.5
            ? 'desacelerando'
            : 'caindo',
  };
}

export function formatVelocityTrendCommercial(trend: number | null): {
  value: string;
  sub: string;
  isPositive: boolean;
} {
  if (trend === null) return { value: '—', sub: '', isPositive: false };
  const pct = (trend - 1) * 100;
  if (!Number.isFinite(pct)) return { value: '—', sub: '', isPositive: false };
  return {
    value: `${pct > 0 ? '+' : ''}${pct.toFixed(0)}%`,
    sub:
      trend > 1.5
        ? 'acelerando forte!'
        : trend > 1
          ? 'demanda crescente'
          : trend > 0.5
            ? 'desacelerando'
            : 'queda de interesse',
    isPositive: trend > 1,
  };
}

// ---------- Safe date formatting ----------

export function safeParseDateForChart(
  dateStr: string,
): { dateFormatted: string; fullDate: string } | null {
  try {
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return null;
    return {
      dateFormatted: format(d, 'dd/MM', { locale: ptBR }),
      fullDate: format(d, 'dd/MM/yyyy', { locale: ptBR }),
    };
  } catch {
    return null;
  }
}

// ---------- Safe price_changes extraction (#3/#12 fix) ----------

/**
 * Safely extracts price_changes_30d from velocity data
 * without unsafe double casts.
 */
export function safePriceChanges(velocityData: unknown): number {
  if (velocityData === null || typeof velocityData !== 'object') return 0;
  const record = velocityData as Record<string, unknown>;
  const val = record.price_changes_30d;
  if (typeof val === 'number' && Number.isFinite(val)) return val;
  return 0;
}

// ---------- Intelligence type guard ----------

export function isRealIntelligence(data: unknown): data is ProductIntelligenceData {
  return (
    data !== null &&
    typeof data === 'object' &&
    'product_id' in data &&
    'abc_classification' in data &&
    'is_hot_product' in data &&
    // Discriminate from MockIntelligenceData: real data comes from DB and has these numeric aggregation fields
    'turnover_score' in data &&
    !('_isMock' in data)
  );
}
