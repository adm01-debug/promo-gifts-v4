/**
 * Catálogo de constantes de negócio (categorias, fornecedores, públicos, datas).
 *
 * Reduzido de 812 → ~110 linhas em 09/05/2026 (Faxina F1 Onda E):
 * - Removidos: Product, ProductVariation, ProductColor, KitItem, Client,
 *   PurchaseHistory, PurchaseItem (interfaces nunca importadas daqui — duplicavam
 *   tipos de @/types/product-catalog).
 * - Removidos: COLORS, NICHOS, FAIXAS_PRECO, MATERIAIS, PRODUCTS, CLIENTS
 *   (mock data órfão, sem callers).
 *
 * Mantidos os símbolos efetivamente importados pelo app:
 *   - Category (interface)
 *   - Supplier (interface)
 *   - CATEGORIES, SUPPLIERS, PUBLICO_ALVO, DATAS_COMEMORATIVAS, ENDOMARKETING
 */

export interface Category {
  id: number;
  name: string;
  parentId?: number;
  icon?: string;
}

export interface Supplier {
  id: string;
  name: string;
  logo?: string;
}

export const CATEGORIES: Category[] = [
  { id: 192, name: 'AGRO', icon: '🌾' },
  { id: 554, name: 'ALIMENTOS E BEBIDAS', icon: '🍔' },
  { id: 556, name: 'ARTIGOS | SULISTAS', icon: '🧉' },
  { id: 124, name: 'BAR | COZINHA', icon: '🍷' },
  { id: 558, name: 'BRINDES | CRESOL', icon: '🧡' },
  { id: 560, name: 'BRINDES | SICOOB', icon: '💚' },
  { id: 562, name: 'BRINDES | SICREDI', icon: '💚' },
  { id: 564, name: 'BRINDES | UNIMED', icon: '🏥' },
  { id: 194, name: 'CHAVEIROS', icon: '🔑' },
  { id: 196, name: 'ECOLOGIA', icon: '🌿' },
  { id: 198, name: 'EMBALAGENS', icon: '📦' },
  { id: 202, name: 'ESPORTES | AVENTURA | LAZER | VIAGEM', icon: '⚽' },
  { id: 126, name: 'FERRAMENTAS | UTILIDADES', icon: '🔧' },
  { id: 204, name: 'FESTAS | EVENTOS', icon: '🎉' },
  { id: 566, name: 'GRAVAÇÕES | PERSONALIZAÇÃO', icon: '✨' },
  { id: 206, name: 'JOGOS E BRINQUEDOS', icon: '🎮' },
  { id: 210, name: 'KIT GOURMET', icon: '🍳' },
  { id: 568, name: 'MATÉRIA | PRIMA', icon: '🧶' },
  { id: 570, name: 'MOTIVACIONAL | PREMIAÇÕES', icon: '🏆' },
  { id: 214, name: 'PAPELARIA | ESCRITÓRIO', icon: '📝' },
  { id: 216, name: 'PET CARE', icon: '🐾' },
  { id: 572, name: 'PORTA CANETA', icon: '✏️' },
  { id: 220, name: 'ROUPAS | CALÇADOS | ACESSÓRIOS', icon: '👕' },
  { id: 222, name: 'SAÚDE | BELEZA | BEM ESTAR', icon: '💆' },
  { id: 574, name: 'SUPRIMENTOS | INSUMOS', icon: '📦' },
  { id: 224, name: 'TECNOLOGIA | ELETRÔNICOS', icon: '📱' },
  { id: 552, name: 'TOALHAS | PRAIA', icon: '🏖️' },
  { id: 226, name: 'UTENSÍLIOS | DECORAÇÃO', icon: '🏠' },
  { id: 228, name: 'VEÍCULOS', icon: '🚗' },
];

// Fornecedores
export const SUPPLIERS: Supplier[] = [
  { id: 'xbz', name: 'XBZ Brindes' },
  { id: 'stricker', name: 'Stricker Brasil' },
  { id: 'asia', name: 'Asia Import' },
  { id: 'somarcas', name: 'Só Marcas' },
];

// Marketing — público-alvo
export const PUBLICO_ALVO = [
  'HOMEM',
  'MULHER',
  'CRIANÇA',
  'UNISSEX',
  'MÉDICO',
  'ADVOGADO',
  'ENGENHEIRO',
  'CONTADOR',
  'SECRETÁRIA',
  'EXECUTIVO',
  'PROFESSOR',
  'ENFERMEIRO',
  'PRODUTOR RURAL',
  'VETERINÁRIO',
  'DENTISTA',
];

// Marketing — datas comemorativas
export const DATAS_COMEMORATIVAS = [
  'DIA DOS PAIS',
  'DIA DAS MÃES',
  'DIA DAS CRIANÇAS',
  'NATAL',
  'PÁSCOA',
  'ANO NOVO',
  'DIA DO MÉDICO',
  'DIA DO ADVOGADO',
  'DIA DO ENGENHEIRO',
  'DIA DA SECRETÁRIA',
  'DIA DO PROFESSOR',
  'DIA DO CONTADOR',
  'DIA DO TRABALHADOR',
  'DIA DA MULHER',
  'DIA DO HOMEM',
  'NOVEMBRO AZUL',
  'OUTUBRO ROSA',
  'SETEMBRO AMARELO',
  'CARNAVAL',
  'FESTA JUNINA',
  'DIA DOS NAMORADOS',
];

// Marketing — endomarketing
export const ENDOMARKETING = [
  'ONBOARDING | KIT BOAS-VINDAS',
  'TEMPO DE CASA | ANIVERSÁRIO EMPRESA',
  'CIPA | SIPAT',
  'PREMIAÇÃO | INCENTIVO',
  'RECONHECIMENTO',
  'INTEGRAÇÃO | TEAM BUILDING',
  'TREINAMENTO | CAPACITAÇÃO',
  'FIM DE ANO | CONFRATERNIZAÇÃO',
  'QUALIDADE DE VIDA',
  'CAMPANHA INTERNA',
  'CONVENÇÃO DE VENDAS',
];
