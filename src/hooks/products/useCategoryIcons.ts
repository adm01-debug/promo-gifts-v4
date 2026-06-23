import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface CategoryIcon {
  id: string;
  category_name: string;
  icon: string;
  description?: string | null;
}

/**
 * Hook para buscar ícones das categorias do Supabase.
 *
 * Retorna a tabela `category_icons` completa para uso no `getCategoryIcon()`.
 * Resultados ficam em cache por 30 min (dados muito estáveis).
 *
 * @see docs/CATEGORY_ICONS_GUIDE.md
 */
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
 * ### Regras
 * - Valores SEMPRE em PascalCase: nomes válidos do ICON_MAP em CategoryIcon.tsx
 * - Palavras-chave em português (minúsculas, sem acentos is OK)
 * - Ordenar por tipo de produto para facilitar manutenção
 *
 * @see src/components/ui/CategoryIcon.tsx — ICON_MAP com todos os ícones disponíveis
 * @see docs/CATEGORY_ICONS_GUIDE.md — guia completo
 */
const KEYWORD_ICONS: Record<string, string> = {

  // ── BAR / COZINHA / GOURMET ─────────────────────────────────
  copo:           'GlassWater',
  taça:           'Wine',
  caneca:         'Coffee',
  xícara:         'Coffee',
  garrafa:        'Wine',
  squeeze:        'Droplets',
  térmica:        'Thermometer',
  térm:           'Thermometer',
  cooler:         'Thermometer',
  iso:            'Thermometer',
  vinho:          'Wine',
  cerveja:        'Beer',
  café:           'Coffee',
  'crachá':      'CreditCard', // fix: before 'chá' (substring)
  chá:            'Coffee',
  xícaras:        'Coffee',
  chimarrão:      'Coffee',
  cuia:           'Coffee',
  tereré:         'Coffee',
  mateira:        'Coffee',
  erva:           'Coffee',
  churrasco:      'Flame',
  gourmet:        'ChefHat',
  caipirinha:     'Wine',
  fondue:         'ChefHat',
  queijo:         'ChefHat',
  drink:          'Wine',
  baralho:        'Dices',        // fix: before 'bar' (Wine) — bar is substring of baralho
  bar:            'Wine',
  coquetel:       'Wine',
  shakeira:       'Wine',

  // ── UTENSÍLIOS DE COZINHA ───────────────────────────────
  tábua:          'Utensils',
  faca:           'Scissors',
  cutelaria:      'Scissors',
  canivete:       'Scissors',
  talher:         'Utensils',
  pegador:        'Utensils',
  abridor:        'Wine',
  colher:         'Utensils',
  garfo:          'Utensils',
  espátula:       'Utensils',
  bowl:           'Utensils',
  petisqueira:    'Utensils',
  pizza:          'Utensils',
  alimentos:      'Utensils',
  comida:         'Utensils',

  // ── BOLSAS / ACESSÓRIOS ────────────────────────────────
  'bolsa de viagem': 'Luggage',  // fix: 'Bolsa de Viagem' → Luggage (before 'bolsa'→ShoppingBag)
  bolsa:          'ShoppingBag',
  mochila:        'Backpack',
  sacochila:      'Backpack',
  necessaire:     'ShoppingBag',
  frasqueira:     'ShoppingBag',
  carteira:       'Wallet',
  pochete:        'ShoppingBag',
  sacola:         'Recycle',
  pasta:          'Briefcase',
  maleta:         'Briefcase',
  mala:           'Luggage',
  viagem:         'Luggage',
  'kit viagem':   'Luggage',
  'bolsa viagem': 'Luggage',

  // ── VESTUÁRIO / CALÇADOS ───────────────────────────────
  camisa:         'Shirt',
  camiseta:       'Shirt',
  boné:           'Tag',
  chapéu:         'Sun',
  calça:          'Shirt',
  jaqueta:        'Shirt',
  colete:         'Shirt',
  moletão:        'Shirt',
  avental:        'ChefHat',
  toalha:         'Layers',
  manta:          'Layers',
  cobertor:       'Layers',
  lenço:          'Tag',
  óculos:         'Glasses',
  viseira:        'Sun',
  chinelo:        'Dumbbell',
  calçado:        'Dumbbell',
  botína:         'Dumbbell',
  sandália:       'Dumbbell',

  // ── ESCRITÓRIO / PAPELARIA ────────────────────────────
  caneta:         'PenLine',
  lápis:          'Pencil',
  lapiseira:      'Pencil',
  caderno:        'Notebook',
  caderneta:      'Notebook',
  bloco:          'Notebook',
  agenda:         'Calendar',
  calendário:     'Calendar',
  calculadora:    'Calculator',
  clips:          'Paperclip',
  papelaria:      'Notebook',

  // ── TECNOLOGIA ───────────────────────────────────────
  cabo:           'Plug',
  carregador:     'Battery',
  powerbank:      'Battery',
  'power bank':   'Battery',
  fone:           'Headphones',
  mouse:          'Mouse',
  teclado:        'Keyboard',
  pendrive:       'HardDrive',
  'pen drive':    'HardDrive',
  'caixas de som': 'Speaker', // fix: plural form (before 'caixa de som' and 'caixa')
  'caixa de som': 'Speaker',
  celular:        'Smartphone',
  smartphone:     'Smartphone',
  notebook:       'Laptop',
  laptop:         'Laptop',
  tecnologia:     'Cpu',

  // ── FERRAMENTAS ──────────────────────────────────────
  ferramenta:     'Wrench',
  chave:          'Key',
  chaveiro:       'Key',
  mosquetão:      'Key',
  lanterna:       'Flashlight',
  luminária:      'Lamp',
  lâmpada:        'Lamp',
  trena:          'Ruler',
  alicate:        'Wrench',
  martelo:        'Hammer',
  fita:           'Ruler',
  'anti furto':   'Lock',
  cadeado:        'Lock',
  trava:          'Lock',
  pin:            'Pin',
  botton:         'Pin',
  broche:         'Pin',

  // ── ESPORTES / LAZER ────────────────────────────────
  bola:           'CircleDot',
  futebol:        'CircleDot',
  vôlei:          'CircleDot',
  basquete:       'CircleDot',
  raquete:        'Dumbbell',
  yoga:           'Heart',
  fitness:        'Dumbbell',
  academia:       'Dumbbell',
  esporte:        'Dumbbell',
  corrida:        'Dumbbell',
  praia:          'Sun',
  piscina:        'Droplets',
  guarda:         'Umbrella',
  chuva:          'Umbrella',
  'guarda-chuva':   'Umbrella',
  'guarda-sol':     'Umbrella',

  // ── SAÚDE / BELEZA ─────────────────────────────────
  espelho:        'Sparkles',
  escova:         'Scissors',
  pente:          'Scissors',
  manicure:       'Scissors',
  massageador:    'Heart',
  massagem:       'Heart',
  'kit higiene':  'Droplets',
  álcool:         'Droplets',
  máscara:        'Heart',
  sabonete:       'Droplets',
  perfume:        'Sparkles',
  beleza:         'Sparkles',
  maquiagem:      'Sparkles',
  comprimido:     'Pill',
  remédio:        'Pill',
  farmácia:       'Pill',
  medicamento:    'Pill',
  spa:            'Droplets',
  banho:          'Droplets',
  roupa:          'Droplets',

  // ── JOGOS ─────────────────────────────────────────
  jogo:           'Gamepad2',
  dominó:         'Dices',
  xadrez:         'Dices',
  'brinquedo pet': 'PawPrint', // fix: must precede 'brinquedo'→Star
  brinquedo:      'Star',
  quebra:         'Layers',

  // ── CASA / DECORAÇÃO ──────────────────────────────
  vela:           'Flame',
  'porta-retrato': 'Image',
  retrato:        'Image',
  relógio:        'Clock',
  almofada:       'Layers',
  organizador:    'Package',
  vaso:           'Flower2',
  planta:         'Leaf',
  decoração:     'Home',
  despertador:    'AlarmClock',

  // ── PET ────────────────────────────────────────────
  pet:            'PawPrint',
  cachorro:       'PawPrint',
  gato:           'PawPrint',
  coleira:        'PawPrint',
  comedouro:      'PawPrint',
  bebedouro:      'PawPrint',
  ração:          'PawPrint',
  cama:           'PawPrint',
  casinha:        'PawPrint',

  // ── EMBALAGENS / CAIXAS ─────────────────────────────
  embalagem:      'Package',
  caixa:          'Package',
  estojo:         'Package',
  'berço':         'Package',
  papel:          'Paperclip',
  marmita:        'Package',
  lancheira:      'Package',

  // ── INFANTIL ───────────────────────────────────────
  infantil:       'Star',
  criança:        'Star',
  bebê:           'Heart',

  // ── PREMIUM / PREMIAÇÕES ────────────────────────────
  troféu:         'Trophy',
  medalha:        'Medal',
  placa:          'Award',
  certificado:    'Award',
  premiação:      'Award',
  motivação:      'Award',
  premium:        'Crown',
  vip:            'Crown',
  executivo:      'Crown',
  festas:         'Sparkles',
  evento:         'Sparkles',

  // ── ALIMENTOS / DOCES ─────────────────────────────
  doce:           'Gift',
  chocolate:      'Heart',
  bombom:         'Gift',
  biscoito:       'Gift',
  alimento:       'Utensils',
  castanha:       'Leaf',

  // ── ECO / SUSTENTÁVEL / AGRO ────────────────────────
  eco:            'Leaf',
  ecológico:      'Leaf',
  reciclado:      'Recycle',
  bambu:          'TreePine',
  sustentável:    'Leaf',
  madeira:        'TreePine',
  cortiça:        'TreePine',
  flor:           'Flower2',
  agro:           'Sprout',
  cultivo:        'Sprout',
  semente:        'Sprout',
  broto:          'Sprout',
  muda:           'Sprout',

  // ── IDENTIFICAÇÃO / CACHÉ ───────────────────────────
  credencial:     'CreditCard',
  identificação: 'CreditCard',
  cordão:         'CreditCard',

  // ── VEÍCULOS / AUTOMOTIVO ───────────────────────────
  veículo:        'Car',
  carro:          'Car',
  automotivo:     'Car',
  moto:           'Car',

  // ── FALLBACK GENÉRICO (deve ficar ÚLTIMO — é substring de muitas palavras) ─
  kit:            'Gift',            // fix: moved to end — 'Kit X' resolves to X's icon first
};

/**
 * Retorna o ícone (nome Lucide ou emoji) de uma categoria pelo nome.
 *
 * ## Pipeline de resolução (4 passes)
 *
 * | Pass | Fonte                        | Exemplo                          |
 * |------|------------------------------|----------------------------------|
 * | 1    | Busca exata em category_icons  | "Canecas" → "Coffee"            |
 * | 2    | Busca parcial (contém)         | "Canecas | Vidro" → "Coffee"    |
 * | 3    | KEYWORD_ICONS (mapa estático)  | "caneca" → "Coffee"             |
 * | 4    | Primeira palavra no banco      | "Kit" → busca no banco          |
 * | -    | Fallback                       | '📦' (Package como emoji)          |
 *
 * ## Valores retornados
 *
 * - Nome Lucide: `"Coffee"`, `"Luggage"`, `"CircleDot"` → CategoryIcon renderiza SVG
 * - Emoji legado: `"☕"` (se ainda no DB) → CategoryIcon renderiza como `<span>`
 * - Fallback: `"📦"` → CategoryIcon renderiza como `<span>` com Package emoji
 *
 * @param categoryName Nome da categoria (ex: "Canecas | Porcelana")
 * @param icons Lista de ícones do banco (via useCategoryIcons)
 * @returns String com nome Lucide ou emoji/fallback
 *
 * @see src/components/ui/CategoryIcon.tsx — renderizador final
 * @see docs/CATEGORY_ICONS_GUIDE.md — guia completo
 */
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

  // 3. Busca por palavras-chave no mapa estático (retorna nome Lucide)
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

  return '📦'; // Fallback final — CategoryIcon renderiza como emoji Package
}