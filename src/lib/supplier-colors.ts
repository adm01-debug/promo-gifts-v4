/**
 * Sistema de cores por fornecedor
 * Cores específicas para badges de cada fornecedor
 */

export interface SupplierColorConfig {
  bg: string;
  text: string;
  border?: string;
  hex: string; // cor hex pura para estilos inline
}

// Mapeamento de cores por fornecedor (baseado em palavras-chave no nome)
const SUPPLIER_COLORS: Record<string, SupplierColorConfig> = {
  // XBZ - Azul Royal (Escurecido para contraste no light mode)
  xbz: {
    bg: 'bg-[#1E40AF]/15',
    text: 'text-[#1E40AF]',
    border: 'border-[#1E40AF]/30',
    hex: '#1E40AF',
  },
  // SPOT / Stricker - Verde Escuro (Contrastado)
  spot: {
    bg: 'bg-[#065F46]/15',
    text: 'text-[#065F46]',
    border: 'border-[#065F46]/30',
    hex: '#065F46',
  },
  stricker: {
    bg: 'bg-[#065F46]/15',
    text: 'text-[#065F46]',
    border: 'border-[#065F46]/30',
    hex: '#065F46',
  },
  // Asia Import - Vermelho Escuro
  asia: {
    bg: 'bg-[#991B1B]/15',
    text: 'text-[#991B1B]',
    border: 'border-[#991B1B]/30',
    hex: '#991B1B',
  },
  // Fallback - Laranja Escuro para badges
  default: {
    bg: 'bg-[#9A3412]/15',
    text: 'text-[#9A3412]',
    border: 'border-[#9A3412]/30',
    hex: '#9A3412',
  },
};

/**
 * Retorna as classes de cor para um fornecedor específico
 * @param supplierName Nome do fornecedor
 * @returns Configuração de cores do fornecedor
 */
export function getSupplierColors(supplierName: string): SupplierColorConfig {
  const nameLower = supplierName.toLowerCase();

  // Verifica cada palavra-chave
  if (nameLower.includes('xbz')) {
    return SUPPLIER_COLORS.xbz;
  }
  if (nameLower.includes('spot') || nameLower.includes('stricker')) {
    return SUPPLIER_COLORS.spot;
  }
  if (nameLower.includes('asia')) {
    return SUPPLIER_COLORS.asia;
  }

  // Retorna laranja como padrão
  return SUPPLIER_COLORS.default;
}

/**
 * Retorna as classes CSS combinadas para o badge do fornecedor
 * @param supplierName Nome do fornecedor
 * @returns String com classes Tailwind
 */
export function getSupplierBadgeClasses(supplierName: string): string {
  const colors = getSupplierColors(supplierName);
  return `${colors.bg} ${colors.text} ${colors.border ?? ''} border`;
}
