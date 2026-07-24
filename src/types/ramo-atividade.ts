// ============================================================
// TIPOS - RAMOS DE ATIVIDADE (Nichos/Segmentos)
// ============================================================

// Categoria Pai (Ramo de Atividade)
export interface RamoAtividade {
  id: string;
  nome: string;
  slug: string;
  descricao?: string | null;
  icone: string;
  cor: string;
  ativo: boolean;
  ordem: number;
  created_at?: string;
  updated_at?: string;
  // Relacionamento expandido
  filhos?: RamoAtividadeFilho[];
  _count?: {
    filhos: number;
  };
}

// Categoria Filha (Segmento)
export interface RamoAtividadeFilho {
  id: string;
  ramo_atividade_id: string;
  nome: string;
  slug: string;
  descricao?: string | null;
  icone?: string | null;
  ativo: boolean;
  ordem: number;
  created_at?: string;
  updated_at?: string;
  // Relacionamento expandido
  ramo_atividade?: RamoAtividade;
}

// Ligação Produto ↔ Ramo Atividade
export interface ProdutoRamoAtividade {
  id: string;
  produto_id: string;
  ramo_atividade_filho_id: string;
  created_at?: string;
  // Relacionamentos expandidos
  ramo_atividade_filho?: RamoAtividadeFilho;
}

// Input types para criação/edição
export type RamoAtividadeInput = Omit<
  RamoAtividade,
  '_count' | 'created_at' | 'filhos' | 'id' | 'updated_at'
>;
export type RamoAtividadeFilhoInput = Omit<
  RamoAtividadeFilho,
  'created_at' | 'id' | 'ramo_atividade' | 'updated_at'
>;

// Filtros de busca
export interface RamoAtividadeFilters {
  search?: string;
  ativo?: boolean;
}

// Estado do filtro hierárquico (similar ao MaterialFilterState)
export interface RamoAtividadeFilterState {
  selectedRamos: string[]; // slugs dos ramos pai selecionados
  selectedSegmentos: string[]; // slugs dos segmentos selecionados
  searchTerm: string;
}

// Estrutura hierárquica para exibição
export interface RamoAtividadeHierarquia {
  pai: RamoAtividade;
  filhos: RamoAtividadeFilho[];
}

// Grupo completo com estatísticas (similar ao MaterialGroup)
export interface RamoAtividadeGroup {
  group_id: string;
  group_name: string;
  group_slug: string;
  group_description: string | null;
  group_hex_code: string | null;
  group_icon: string | null;
  display_order: number;
  total_segmentos: number;
  products_using?: number;
}

// Segmento completo com dados do pai (similar ao MaterialComplete)
export interface SegmentoComplete {
  segmento_id: string;
  segmento_name: string;
  segmento_slug: string;
  segmento_description: string | null;
  segmento_icon: string | null;
  segmento_display_order: number;
  ramo_id: string;
  ramo_name: string;
  ramo_slug: string;
  ramo_description: string | null;
  ramo_hex_code: string | null;
  ramo_icon: string | null;
  ramo_display_order: number;
}
