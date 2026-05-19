import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface CategoryIcon {
  id: string;
  category_name: string;
  icon: string;
  description?: string;
}

/**
 * Hook para buscar ícones das categorias do Supabase
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

// Mapeamento de palavras-chave para ícones (fallback inteligente)
const KEYWORD_ICONS: Record<string, string> = {
  // Bar / Cozinha / Gourmet
  copo: '🥤', taça: '🍷', caneca: '☕', garrafa: '🍾', squeeze: '💧',
  térmica: '🧊', térm: '🧊', kit: '🎁', vinho: '🍷', cerveja: '🍺',
  café: '☕', churrasco: '🥩', gourmet: '🍽️', caipirinha: '🍹',
  // Utensílios
  tábua: '🪵', faca: '🔪', talher: '🍴', pegador: '🥢', abridor: '🍾',
  saca: '🍾', colher: '🥄', garfo: '🍴', espátula: '🍳',
  // Sulista / Chimarrão
  cuia: '🧉', chimarrão: '🧉', tereré: '🧉', bomba: '🧉', mateira: '🧉',
  // Bolsas / Acessórios
  bolsa: '👜', mochila: '🎒', necessaire: '👝', carteira: '👛', 
  pochete: '👜', sacola: '🛍️', pasta: '💼', maleta: '💼',
  // Roupas
  camisa: '👔', camiseta: '👕', boné: '🧢', chapéu: '🎩', 
  calça: '👖', jaqueta: '🧥', avental: '👨‍🍳', toalha: '🏖️', lenço: '🧣',
  // Escritório / Papelaria
  caneta: '🖊️', lápis: '✏️', caderno: '📓', agenda: '📅', 
  bloco: '📝', calculadora: '🧮', porta: '✏️', clips: '📎',
  // Tecnologia
  cabo: '🔌', carregador: '🔋', fone: '🎧', mouse: '🖱️', 
  teclado: '⌨️', pendrive: '💾', 'caixa de som': '🔊', 'power bank': '🔋',
  celular: '📱', suporte: '📱', ring: '📱',
  // Ferramentas
  ferramenta: '🔧', chave: '🔩', lanterna: '🔦', trena: '📏', 
  alicate: '🔧', martelo: '🔨', fita: '📐',
  // Esportes / Lazer
  bola: '⚽', raquete: '🏸', yoga: '🧘', fitness: '💪', 
  esporte: '🏃', praia: '🏖️', piscina: '🏊',
  // Jogos
  jogo: '🎮', dominó: '🎲', baralho: '🃏', xadrez: '♟️', 
  brinquedo: '🧸', quebra: '🧩',
  // Casa / Decoração
  vela: '🕯️', 'porta-retrato': '🖼️', relógio: '⏰', almofada: '🛋️',
  organizador: '📦', vaso: '🌱', decoração: '🏠',
  // Saúde / Beleza
  espelho: '🪞', escova: '🪥', massageador: '💆', 'kit higiene': '🧴',
  álcool: '🧴', máscara: '😷', sabonete: '🧼', perfume: '🌸',
  // Pet
  pet: '🐾', cachorro: '🐕', gato: '🐈', coleira: '🐾', 
  comedouro: '🐾', 'brinquedo pet': '🐾',
  // Embalagens
  embalagem: '📦', caixa: '📦', papel: '📄',
  // Chaveiros
  chaveiro: '🔑', mosquetão: '🔗',
  // Infantil
  infantil: '👶', criança: '🧒', bebê: '👶',
  // Premium / Corporativo
  troféu: '🏆', medalha: '🥇', placa: '🏅', pin: '📌', botton: '📌',
  // Alimentos
  doce: '🍫', chocolate: '🍫', bombom: '🍬', biscoito: '🍪', 
  comida: '🍔', alimento: '🍎', castanha: '🥜',
  // Eco / Sustentável
  eco: '🌿', reciclado: '♻️', bambu: '🎋', sustentável: '🌱', madeira: '🪵',
};

/**
 * Função utilitária para obter o ícone de uma categoria pelo nome
 * Usa busca fuzzy com correspondência de palavras-chave
 */
export function getCategoryIcon(
  categoryName: string | undefined | null, 
  icons: CategoryIcon[]
): string {
  if (!categoryName) return '📦';
  
  const nameLower = categoryName.toLowerCase();
  
  // 1. Busca exata no banco
  const exact = icons.find(
    i => i.category_name.toLowerCase() === nameLower
  );
  if (exact) return exact.icon;
  
  // 2. Busca parcial (contém) no banco
  const partial = icons.find(
    i => nameLower.includes(i.category_name.toLowerCase()) ||
         i.category_name.toLowerCase().includes(nameLower)
  );
  if (partial) return partial.icon;
  
  // 3. Busca por palavras-chave no mapa estático
  for (const [keyword, icon] of Object.entries(KEYWORD_ICONS)) {
    if (nameLower.includes(keyword)) {
      return icon;
    }
  }
  
  // 4. Busca por primeira palavra significativa no banco
  const firstWord = nameLower.split(/[\s|]/)[0];
  if (firstWord.length > 2) {
    const firstWordMatch = icons.find(
      i => i.category_name.toLowerCase().includes(firstWord)
    );
    if (firstWordMatch) return firstWordMatch.icon;
  }
  
  return '📦'; // Padrão
}
