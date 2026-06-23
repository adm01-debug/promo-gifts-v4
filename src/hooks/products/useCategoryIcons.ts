import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface CategoryIcon {
  id: string;
  category_name: string;
  icon: string;
  description?: string | null;
}

export function useCategoryIcons() {
  return useQuery<CategoryIcon[]>({
    queryKey: ['category-icons'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('category_icons')
        .select('id, category_name, icon, description')
        .eq('is_active', true);

      if (error) throw new Error(`Failed to fetch category icons: ${error.message}`);
      return data || [];
    },
    staleTime: 30 * 60 * 1000,
  });
}

/**
 * Mapeamento palavra-chave → nome do ícone Lucide.
 *
 * Usado como fallback no pass 3 de `getCategoryIcon()`, quando o nome
 * da categoria não encontra match no banco de dados.
 *
 * ### Regras críticas de ordenamento
 * - Keywords COMPOSTAS (multi-palavra) devem vir **antes** das simples
 *   que causariam match incorreto, pois `Object.entries()` preserva ordem
 *   de inserção e o primeiro match vence.
 * - Property names com hífen DEVEM usar aspas simples: `'guarda-chuva'`
 *
 * @see src/components/ui/CategoryIcon.tsx — ICON_MAP
 * @see docs/CATEGORY_ICONS_GUIDE.md — guia completo
 */
const KEYWORD_ICONS: Record<string, string> = {

  // ── COMPOSTOS / ESPECÍFICOS — devem preceder keywords genéricas (♡ ordem importa!) ──
  // REGRA: `Object.entries()` usa ordem de inserção. Keywords compostas primeiro.
  //
  // Conflitos corrigidos:
  //   'kit viagem'      antes de  'kit'       (Gift seria errado para Kit Viagem)
  //   'kit higiene'     antes de  'kit'       (Gift seria errado para Kit Higiene)
  //   'kit churrasco'   antes de  'kit'       (Gift seria errado para Kit Churrasco)
  //   'bolsa viagem'    antes de  'bolsa'     (ShoppingBag seria errado)
  //   'brinquedo pet'   antes de  'brinquedo' (Star seria errado para produto pet)
  //   'roupão'          antes de  'roupa'     (Shirt seria errado para roupão/bata)
  //   FIX v2: 'roup\u00e3o' corrigido (era 'roupaão' — encoding errada, extra 'a')
  'kit viagem':      'Luggage',    // antes de 'kit' → Gift
  'kit higiene':     'Droplets',   // antes de 'kit' → Gift
  'kit churrasco':   'Flame',      // antes de 'kit' → Gift (NOVO)
  'bolsa viagem':    'Luggage',    // antes de 'bolsa' → ShoppingBag
  'brinquedo pet':   'PawPrint',   // antes de 'brinquedo' → Star
  'roupão':          'Layers',     // FIX: era 'roupaão' (typo); roupão = Layers
  'power bank':      'Battery',
  'pen drive':       'HardDrive',
  'porta-retrato':   'Image',
  'guarda-chuva':    'Umbrella',
  'guarda-sol':      'Umbrella',
  'anti furto':      'Lock',
  'berço':           'Package',
  'caixa de som':    'Speaker',

  // ── BAR / COZINHA / GOURMET ─────────────────────────────────
  copo:              'GlassWater',
  taça:              'Wine',
  caneca:            'Coffee',
  xícara:            'Coffee',
  garrafa:           'Wine',
  squeeze:           'Droplets',
  térmica:           'Thermometer',
  térm:              'Thermometer',
  cooler:            'Thermometer',
  iso:               'Thermometer',
  kit:               'Gift',        // genérico; compostos acima têm prioridade
  vinho:             'Wine',
  cerveja:           'Beer',
  café:              'Coffee',
  chá:               'Coffee',
  xícaras:           'Coffee',
  chimarrão:         'Coffee',
  cuia:              'Coffee',
  tereré:            'Coffee',
  mateira:           'Coffee',
  erva:              'Coffee',
  churrasco:         'Flame',
  gourmet:           'ChefHat',
  caipirinha:        'Wine',
  fondue:            'ChefHat',
  queijo:            'ChefHat',
  drink:             'Wine',
  bar:               'Wine',
  coquetel:          'Wine',
  shakeira:          'Wine',

  // ── UTENSÍLIOS DE COZINHA ───────────────────────────────
  tábua:             'Utensils',
  faca:              'Scissors',
  cutelaria:         'Scissors',
  canivete:          'Scissors',
  talher:            'Utensils',
  pegador:           'Utensils',
  abridor:           'Wine',
  colher:            'Utensils',
  garfo:             'Utensils',
  espátula:          'Utensils',
  bowl:              'Utensils',
  petisqueira:       'Utensils',
  pizza:             'Utensils',
  alimentos:         'Utensils',
  comida:            'Utensils',

  // ── BOLSAS / ACESSÓRIOS / VIAGEM ─────────────────────────
  bolsa:             'ShoppingBag',
  mochila:           'Backpack',
  sacochila:         'Backpack',
  necessaire:        'ShoppingBag',
  frasqueira:        'ShoppingBag',
  carteira:          'Wallet',
  pochete:           'ShoppingBag',
  sacola:            'Recycle',
  pasta:             'Briefcase',
  maleta:            'Briefcase',
  mala:              'Luggage',
  viagem:            'Luggage',

  // ── VESTUÁRIO / CALÇADOS ─────────────────────────────────
  camisa:            'Shirt',
  camiseta:          'Shirt',
  boné:              'Tag',
  chapéu:            'Sun',
  calça:             'Shirt',
  jaqueta:           'Shirt',
  colete:            'Shirt',
  moletão:           'Shirt',
  avental:           'ChefHat',
  toalha:            'Layers',
  manta:             'Layers',
  cobertor:          'Layers',
  lenço:             'Tag',
  óculos:            'Glasses',
  viseira:           'Sun',
  chinelo:           'Dumbbell',
  calçado:           'Dumbbell',
  botína:            'Dumbbell',
  sandália:          'Dumbbell',
  roupa:             'Shirt',

  // ── ESCRITÓRIO / PAPELARIA ────────────────────────────────
  caneta:            'PenLine',
  lápis:             'Pencil',
  lapiseira:         'Pencil',
  caderno:           'Notebook',
  caderneta:         'Notebook',
  bloco:             'Notebook',
  agenda:            'Calendar',
  calendário:        'Calendar',
  calculadora:       'Calculator',
  clips:             'Paperclip',
  papelaria:         'Notebook',

  // ── TECNOLOGIA ────────────────────────────────────────────
  cabo:              'Plug',
  carregador:        'Battery',
  powerbank:         'Battery',
  fone:              'Headphones',
  mouse:             'Mouse',
  teclado:           'Keyboard',
  pendrive:          'HardDrive',
  celular:           'Smartphone',
  smartphone:        'Smartphone',
  notebook:          'Laptop',
  laptop:            'Laptop',
  tecnologia:        'Cpu',

  // ── FERRAMENTAS ───────────────────────────────────────────
  ferramenta:        'Wrench',
  chave:             'Key',
  chaveiro:          'Key',
  mosquetão:         'Key',
  lanterna:          'Flashlight',
  luminária:         'Lamp',
  lâmpada:           'Lamp',
  trena:             'Ruler',
  alicate:           'Wrench',
  martelo:           'Hammer',
  fita:              'Ruler',
  cadeado:           'Lock',
  trava:             'Lock',
  pin:               'Pin',
  botton:            'Pin',
  broche:            'Pin',

  // ── ESPORTES / LAZER ─────────────────────────────────────
  bola:              'CircleDot',
  futebol:           'CircleDot',
  vôlei:             'CircleDot',
  basquete:          'CircleDot',
  raquete:           'Dumbbell',
  yoga:              'Heart',
  fitness:           'Dumbbell',
  academia:          'Dumbbell',
  esporte:           'Dumbbell',
  corrida:           'Dumbbell',
  praia:             'Sun',
  piscina:           'Droplets',
  guarda:            'Umbrella',
  chuva:             'Umbrella',

  // ── SAÚDE / BELEZA ───────────────────────────────────────
  espelho:           'Sparkles',
  escova:            'Scissors',
  pente:             'Scissors',
  manicure:          'Scissors',
  massageador:       'Heart',
  massagem:          'Heart',
  álcool:            'Droplets',
  máscara:           'Heart',
  sabonete:          'Droplets',
  perfume:           'Sparkles',
  beleza:            'Sparkles',
  maquiagem:         'Sparkles',
  comprimido:        'Pill',
  remédio:           'Pill',
  farmácia:          'Pill',
  medicamento:       'Pill',
  spa:               'Droplets',
  banho:             'Droplets',

  // ── JOGOS ────────────────────────────────────────────────
  jogo:              'Gamepad2',
  dominó:            'Dices',
  baralho:           'Dices',
  xadrez:            'Dices',
  brinquedo:         'Star',
  quebra:            'Layers',

  // ── CASA / DECORAÇÃO ─────────────────────────────────────
  vela:              'Flame',
  retrato:           'Image',
  relógio:           'Clock',
  almofada:          'Layers',
  organizador:       'Package',
  vaso:              'Flower2',
  planta:            'Leaf',
  decoração:        'Home',
  despertador:       'AlarmClock',

  // ── PET ────────────────────────────────────────────────
  pet:               'PawPrint',
  cachorro:          'PawPrint',
  gato:              'PawPrint',
  coleira:           'PawPrint',
  comedouro:         'PawPrint',
  bebedouro:         'PawPrint',
  ração:             'PawPrint',
  cama:              'PawPrint',
  casinha:           'PawPrint',

  // ── EMBALAGENS / CAIXAS ─────────────────────────────────
  embalagem:         'Package',
  caixa:             'Package',
  estojo:            'Package',
  papel:             'Paperclip',
  marmita:           'Package',
  lancheira:         'Package',

  // ── INFANTIL ────────────────────────────────────────────
  infantil:          'Star',
  criança:           'Star',
  bebê:              'Heart',

  // ── PREMIUM / PREMIAÇÕES ────────────────────────────────
  troféu:            'Trophy',
  medalha:           'Medal',
  placa:             'Award',
  certificado:       'Award',
  premiação:         'Award',
  motivação:         'Award',
  premium:           'Crown',
  vip:               'Crown',
  executivo:         'Crown',
  festas:            'Sparkles',
  evento:            'Sparkles',

  // ── ALIMENTOS / DOCES ─────────────────────────────────
  doce:              'Gift',
  chocolate:         'Heart',
  bombom:            'Gift',
  biscoito:          'Gift',
  alimento:          'Utensils',
  castanha:          'Leaf',

  // ── ECO / SUSTENTÁVEL / AGRO ────────────────────────────
  eco:               'Leaf',
  ecológico:         'Leaf',
  reciclado:         'Recycle',
  bambu:             'TreePine',
  sustentável:       'Leaf',
  madeira:           'TreePine',
  cortiça:           'TreePine',
  flor:              'Flower2',
  agro:              'Sprout',
  cultivo:           'Sprout',
  semente:           'Sprout',
  broto:             'Sprout',
  muda:              'Sprout',

  // ── IDENTIFICAÇÃO / CRACHÁ ──────────────────────────────
  crachá:            'CreditCard',
  credencial:        'CreditCard',
  identificação:     'CreditCard',
  cordão:            'CreditCard',

  // ── VEÍCULOS / AUTOMOTIVO ──────────────────────────────
  veículo:           'Car',
  carro:             'Car',
  automotivo:        'Car',
  moto:              'Car',
};

export function getCategoryIcon(
  categoryName: string | null | undefined,
  icons: CategoryIcon[],
): string {
  if (!categoryName) return '📦';

  const nameLower = categoryName.toLowerCase();

  // 1. Busca exata no banco
  const exact = icons.find((i) => i.category_name?.toLowerCase() === nameLower);
  if (exact) return exact.icon;

  // 2. Busca parcial (contém) no banco
  const partial = icons.find((i) => {
    const n = i.category_name?.toLowerCase();
    return n && (nameLower.includes(n) || n.includes(nameLower));
  });
  if (partial) return partial.icon;

  // 3. Busca por palavras-chave (primeiro match vence — keywords compostas estão no topo)
  for (const [keyword, iconName] of Object.entries(KEYWORD_ICONS)) {
    if (nameLower.includes(keyword)) {
      return iconName;
    }
  }

  // 4. Busca por primeira palavra significativa no banco
  const firstWord = nameLower.split(/[\s|]/)[0];
  if (firstWord.length > 2) {
    const firstWordMatch = icons.find((i) =>
      i.category_name?.toLowerCase().includes(firstWord),
    );
    if (firstWordMatch) return firstWordMatch.icon;
  }

  return '📦';
}
