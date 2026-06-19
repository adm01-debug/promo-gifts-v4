/**
 * Constantes e helpers do Sistema de Gravação
 * Extraído de useGravacaoV2.ts
 */

import type { TabelaPrecoOficial, FaixaPrecoOficial } from '@/hooks/gravacao/gravacao-types';

// ============================================
// CONSTANTES
// ============================================

export const TECHNIQUE_COLORS: Record<string, string> = {
  SERIGRAFIA: 'bg-blue-600/10 text-blue-800 dark:bg-blue-400/20 dark:text-blue-300',
  SERITEX: 'bg-blue-600/10 text-blue-800 dark:bg-blue-400/20 dark:text-blue-300',
  LASER: 'bg-red-600/10 text-red-800 dark:bg-red-400/20 dark:text-red-300',
  FIBER: 'bg-red-600/10 text-red-800 dark:bg-red-400/20 dark:text-red-300',
  LASER_CO2: 'bg-red-600/10 text-red-800 dark:bg-red-400/20 dark:text-red-300',
  CO2: 'bg-red-600/10 text-red-800 dark:bg-red-400/20 dark:text-red-300',
  LASER_UV: 'bg-red-600/10 text-red-800 dark:bg-red-400/20 dark:text-red-300',
  UV_DIGITAL: 'bg-purple-600/10 text-purple-800 dark:bg-purple-400/20 dark:text-purple-300',
  DIGITAL: 'bg-purple-600/10 text-purple-800 dark:bg-purple-400/20 dark:text-purple-300',
  TAMPOGRAFIA: 'bg-emerald-600/10 text-emerald-800 dark:bg-emerald-400/20 dark:text-emerald-300',
  TAMPO: 'bg-emerald-600/10 text-emerald-800 dark:bg-emerald-400/20 dark:text-emerald-300',
  BORDADO: 'bg-amber-600/10 text-amber-800 dark:bg-amber-400/20 dark:text-amber-300',
  SUBLIMACAO: 'bg-pink-600/10 text-pink-800 dark:bg-pink-400/20 dark:text-pink-300',
  SUBLI: 'bg-pink-600/10 text-pink-800 dark:bg-pink-400/20 dark:text-pink-300',
  HOT_STAMPING:
    'bg-brand-primary-600/10 text-brand-primary-800 dark:bg-brand-primary-400/20 dark:text-brand-primary-300',
  STAMP:
    'bg-brand-primary-600/10 text-brand-primary-800 dark:bg-brand-primary-400/20 dark:text-brand-primary-300',
  TRANSFER_DIGITAL: 'bg-cyan-600/10 text-cyan-800 dark:bg-cyan-400/20 dark:text-cyan-300',
  DTF: 'bg-cyan-600/10 text-cyan-800 dark:bg-cyan-400/20 dark:text-cyan-300',
  ADESIVO: 'bg-indigo-600/10 text-indigo-800 dark:bg-indigo-400/20 dark:text-indigo-300',
  DOMING: 'bg-indigo-600/10 text-indigo-800 dark:bg-indigo-400/20 dark:text-indigo-300',
  ETIQUETA: 'bg-slate-600/10 text-slate-800 dark:bg-slate-400/20 dark:text-slate-300',
  HEAT_TRANSFER: 'bg-rose-600/10 text-rose-800 dark:bg-rose-400/20 dark:text-rose-300',
  FILME_RECORTE: 'bg-teal-600/10 text-teal-800 dark:bg-teal-400/20 dark:text-teal-300',
  DECALQUE: 'bg-amber-700/10 text-amber-900 dark:bg-amber-500/20 dark:text-amber-400',
  EMBORRACHADO: 'bg-lime-700/10 text-lime-900 dark:bg-lime-500/20 dark:text-lime-400',
};

export const TECHNIQUE_ICONS: Record<string, string> = {
  SERIGRAFIA: '🖌️',
  SERITEX: '🖌️',
  LASER: '⚡',
  FIBER: '⚡',
  LASER_CO2: '⚡',
  CO2: '⚡',
  LASER_UV: '⚡',
  UV_DIGITAL: '🎨',
  DIGITAL: '🎨',
  TAMPOGRAFIA: '📘',
  TAMPO: '📘',
  BORDADO: '🧵',
  SUBLIMACAO: '🌈',
  SUBLI: '🌈',
  HOT_STAMPING: '✨',
  STAMP: '✨',
  TRANSFER_DIGITAL: '📋',
  DTF: '📋',
  ADESIVO: '🏷️',
  DOMING: '🏷️',
  ETIQUETA: '🏷️',
  HEAT_TRANSFER: '🔥',
  FILME_RECORTE: '✂️',
  DECALQUE: '🔥',
  EMBORRACHADO: '🔲',
};

export const AREA_SHAPES = {
  rectangle: 'Retângulo',
  circle: 'Círculo',
  oval: 'Oval',
  triangle: 'Triângulo',
  custom: 'Customizado',
} as const;

export const QUANTITY_TIERS_REFERENCE = [
  { min: 1, max: 9, label: '1-9 un' },
  { min: 10, max: 24, label: '10-24 un' },
  { min: 25, max: 49, label: '25-49 un' },
  { min: 50, max: 99, label: '50-99 un' },
  { min: 100, max: 249, label: '100-249 un' },
  { min: 250, max: 499, label: '250-499 un' },
  { min: 500, max: 999, label: '500-999 un' },
  { min: 1000, max: null, label: '1000+ un' },
];

// ============================================
// HELPERS
// ============================================

function matchByPrefix(codigo: string, map: Record<string, string>): string | undefined {
  const prefix = codigo.split('-')[0]?.split('_')[0]?.toUpperCase();
  return prefix ? map[prefix] : undefined;
}

export function getTechniqueColor(codigo: string): string {
  return (
    TECHNIQUE_COLORS[codigo] ||
    matchByPrefix(codigo, TECHNIQUE_COLORS) ||
    'bg-gray-100 text-gray-800'
  );
}

export function getTechniqueIcon(codigo: string): string {
  return TECHNIQUE_ICONS[codigo] || matchByPrefix(codigo, TECHNIQUE_ICONS) || '🔧';
}

export function formatPrice(value: number | null | undefined): string {
  if (value === null || value === undefined) return '-';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

// ============================================
// CALCULATORS
// ============================================

export function calculateTotalWithColorDiscount(
  basePrice: number,
  numCores: number,
  tabela: TabelaPrecoOficial,
): number {
  if (!tabela.cobra_por_cor || numCores <= 1) return basePrice;
  let discount = 0;
  if (numCores === 2 && tabela.desconto_segunda_cor) discount = tabela.desconto_segunda_cor;
  else if (numCores === 3 && tabela.desconto_terceira_cor) discount = tabela.desconto_terceira_cor;
  else if (numCores >= 4 && tabela.desconto_quarta_cor_mais)
    discount = tabela.desconto_quarta_cor_mais;
  return basePrice * (1 - discount) * numCores;
}

export function calculateSetupCost(numCores: number, tabela: TabelaPrecoOficial): number {
  if (!tabela.custo_setup) return 0;
  return tabela.custo_setup_por_cor ? tabela.custo_setup * numCores : tabela.custo_setup;
}

export function findPriceTier(
  quantidade: number,
  faixas: FaixaPrecoOficial[],
): FaixaPrecoOficial | null {
  for (const faixa of faixas) {
    if (
      quantidade >= faixa.quantidade_minima &&
      (faixa.quantidade_maxima === null || quantidade <= faixa.quantidade_maxima)
    ) {
      return faixa;
    }
  }
  return faixas.at(-1) ?? null;
}

export function calculateCustomizationTotal(
  quantidade: number,
  numCores: number,
  tabela: TabelaPrecoOficial,
  faixas: FaixaPrecoOficial[],
  markupPercent = 115,
) {
  const faixa = findPriceTier(quantidade, faixas);
  const markupMultiplier = 1 + markupPercent / 100;

  if (!faixa) {
    return {
      faixa: null,
      custoUnitarioBase: 0,
      custoUnitarioTotal: 0,
      custoSetup: 0,
      custoManuseio: 0,
      custoTotalPecas: 0,
      precoUnitario: 0,
      precoMinimoUnitario: 0,
      subtotalPecas: 0,
      faturamentoMinimoGravacao: tabela.faturamento_minimo || 0,
      minimumApplied: false,
      total: 0,
      margemPercent: 0,
      prazoDias: null as number | null,
    };
  }

  const custoUnitarioBase = faixa.preco_unitario;
  const custoUnitarioTotal = calculateTotalWithColorDiscount(custoUnitarioBase, numCores, tabela);
  const custoSetup = calculateSetupCost(numCores, tabela);
  const custoManuseio = tabela.custo_manuseio_por_peca
    ? (tabela.custo_manuseio || 0) * quantidade
    : tabela.custo_manuseio || 0;
  const custoTotalPecas = custoUnitarioTotal * quantidade;

  let precoUnitario = custoUnitarioTotal * markupMultiplier;
  const precoMinimoUnitario = 1.0;
  if (precoUnitario < precoMinimoUnitario) precoUnitario = precoMinimoUnitario;

  const subtotalPecas = precoUnitario * quantidade;
  const faturamentoMinimoGravacao = custoSetup * markupMultiplier;

  const minimumApplied = subtotalPecas < faturamentoMinimoGravacao;
  const total = minimumApplied ? faturamentoMinimoGravacao : subtotalPecas;

  const custoTotal = custoTotalPecas + custoManuseio;
  const margemPercent = custoTotal > 0 ? ((total - custoTotal) / custoTotal) * 100 : 0;

  return {
    faixa,
    custoUnitarioBase,
    custoUnitarioTotal,
    custoSetup,
    custoManuseio,
    custoTotalPecas,
    precoUnitario,
    precoMinimoUnitario,
    subtotalPecas,
    faturamentoMinimoGravacao,
    minimumApplied,
    total,
    margemPercent,
    prazoDias: faixa.prazo_dias,
  };
}
