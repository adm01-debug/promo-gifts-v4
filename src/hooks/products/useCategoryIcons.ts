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
 * Retorna a tabela category_icons completa para uso no getCategoryIcon().
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
    staleTime: 30 * 60 * 1000, // 30 min (dados estáveis)
  });
}

/**
 * Mapeamento palavra-chave → nome do ícone Lucide (fallback inteligente).
 *
 * Valores agora retornam nomes Lucide ("Coffee") em vez de emojis ("☕").
 * O componente CategoryIcon renderiza SVG para nomes conhecidos e
 * emoji/texto como fallback para dados legados no DB.
 *
 * Para adicionar uma nova categoria: incluir as palavras-chave relevantes
 * e o nome do ícone Lucide correspondente.
 */
const KEYWORD_ICONS: Record<string, string> = {
  // ─── Bar / Cozinha / Gourmet ───────────────────────────────
  copo: 'GlassWater',
  taça: 'Wine',
  caneca: 'Coffee',
  garrafa: 'Wine',
  squeeze: 'Droplets',
  térmica: 'Droplets',
  térm: 'Droplets',
  kit: 'Gift',
  vinho: 'Wine',
  cerveja: 'Beer',
  café: 'Coffee',
  churrasco: 'Beef',
  gourmet: 'ChefHat',
  caipirinha: 'Wine',

  // ─── Utensílios de Cozinha ─────────────────────────────────
  tábua: 'Utensils',
  faca: 'Scissors',
  talher: 'Utensils',
  pegador: 'Utensils',
  abridor: 'Wine',
  saca: 'Wine',
  colher: 'Utensils',
  garfo: 'Utensils',
  espátula: 'Utensils',

  // ─── Sulista / Chimarrão ──────────────────────────────────
  cuia: 'Coffee',
  chimarrão: 'Coffee',
  tereré: 'Coffee',
  bomba: 'Coffee',
  mateira: 'Coffee',

  // ─── Bolsas / Acessórios ──────────────────────────────────
  bolsa: 'ShoppingBag',
  mochila: 'Backpack',
  necessaire: 'ShoppingBag',
  carteira: 'Wallet',
  pochete: 'ShoppingBag',
  sacola: 'ShoppingBag',
  pasta: 'Briefcase',
  maleta: 'Briefcase',

  // ─── Vestuário ────────────────────────────────────────────
  camisa: 'Shirt',
  camiseta: 'Shirt',
  boné: 'Tag',
  chapéu: 'Tag',
  calça: 'Shirt',
  jaqueta: 'Shirt',
  avental: 'ChefHat',
  toalha: 'Layers',
  lenço: 'Tag',

  // ─── Escritório / Papelaria ───────────────────────────────
  caneta: 'PenLine',
  lápis: 'Pencil',
  caderno: 'Notebook',
  agenda: 'Calendar',
  bloco: 'Notebook',
  calculadora: 'ClipboardList',
  porta: 'Pencil',
  clips: 'Paperclip',

  // ─── Tecnologia ──────────────────────────────────────────
  cabo: 'Plug',
  carregador: 'Battery',
  fone: 'Headphones',
  mouse: 'Mouse',
  teclado: 'Keyboard',
  pendrive: 'HardDrive',
  'caixa de som': 'Speaker',
  'power bank': 'Battery',
  celular: 'Smartphone',
  suporte: 'Smartphone',
  ring: 'Smartphone',

  // ─── Ferramentas ─────────────────────────────────────────
  ferramenta: 'Wrench',
  chave: 'Key',
  lanterna: 'Flashlight',
  trena: 'Ruler',
  alicate: 'Wrench',
  martelo: 'Hammer',
  fita: 'Ruler',

  // ─── Esportes / Lazer ────────────────────────────────────
  bola: 'Circle',
  raquete: 'Zap',
  yoga: 'Heart',
  fitness: 'Dumbbell',
  esporte: 'Dumbbell',
  praia: 'Sun',
  piscina: 'Droplets',

  // ─── Jogos ───────────────────────────────────────────────
  jogo: 'Gamepad2',
  dominó: 'Dices',
  baralho: 'Dices',
  xadrez: 'Dices',
  brinquedo: 'Star',
  quebra: 'Layers',

  // ─── Casa / Decoração ────────────────────────────────────
  vela: 'Flame',
  'porta-retrato': 'Home',
  relógio: 'Watch',
  almofada: 'Home',
  organizador: 'Package',
  vaso: 'Flower2',
  decoração: 'Home',

  // ─── Saúde / Beleza / Higiene ─────────────────────────────
  espelho: 'Sparkles',
  escova: 'Sparkles',
  massageador: 'Heart',
  'kit higiene': 'Droplets',
  álcool: 'Droplets',
  máscara: 'Heart',
  sabonete: 'Droplets',
  perfume: 'Sparkles',

  // ─── Pet ─────────────────────────────────────────────────
  pet: 'PawPrint',
  cachorro: 'PawPrint',
  gato: 'PawPrint',
  coleira: 'PawPrint',
  comedouro: 'PawPrint',
  'brinquedo pet': 'PawPrint',

  // ─── Embalagens / Caixas ─────────────────────────────────
  embalagem: 'Package',
  caixa: 'Package',
  papel: 'Paperclip',

  // ─── Chaveiros ───────────────────────────────────────────
  chaveiro: 'Key',
  mosquetão: 'Key',

  // ─── Infantil ────────────────────────────────────────────
  infantil: 'Star',
  criança: 'Star',
  bebê: 'Heart',

  // ─── Premium / Corporativo / Premiações ──────────────────
  troféu: 'Trophy',
  medalha: 'Medal',
  placa: 'Award',
  pin: 'Tag',
  botton: 'Circle',

  // ─── Alimentos / Doces ───────────────────────────────────
  doce: 'Gift',
  chocolate: 'Heart',
  bombom: 'Gift',
  biscoito: 'Gift',
  comida: 'Utensils',
  alimento: 'Utensils',
  castanha: 'Leaf',

  // ─── Eco / Sustentável / Natureza ────────────────────────
  eco: 'Leaf',
  reciclado: 'Recycle',
  bambu: 'TreePine',
  sustentável: 'Leaf',
  madeira: 'TreePine',
  planta: 'Leaf',
  flor: 'Flower2',
};

/**
 * Retorna o ícone (nome Lucide ou emoji) de uma categoria pelo nome.
 *
 * ## Pipeline de resolução (4 passes)
 *
 * 1. **Busca exata** em category_icons por nome da categoria
 * 2. **Busca parcial** (contém) em category_icons
 * 3. **Keyword map** estático: ~140 palavras-chave → nome Lucide
 * 4. **Primeira palavra** significativa em category_icons
 * 5. Fallback final: '📦' (renderizado como emoji pelo CategoryIcon)
 *
 * Os valores retornados por esse função são consumidos pelo componente
 * CategoryIcon, que converte automaticamente nomes Lucide em SVG
 * e trata emojis/texto como fallback legado.
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

  return '📦'; // Padrão (CategoryIcon renderiza como emoji)
}
