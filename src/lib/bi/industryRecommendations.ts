/**
 * Recomendações empíricas por ramo de atividade.
 * Curadoria de especialista (mockada). No futuro, editável por admin.
 */

export interface IndustryRecommendation {
  ramo: string;
  /** Slugs/aliases possíveis para fazer match com `companies.ramo_atividade` */
  aliases: string[];
  categories: string[];
  rationale: string;
  /** Produtos sugeridos (mock) — { name, category, priceRange } */
  suggestedProducts: Array<{
    name: string;
    category: string;
    priceFrom: number;
    priceTo: number;
    reason: string;
  }>;
}

export const INDUSTRY_RECOMMENDATIONS: IndustryRecommendation[] = [
  {
    ramo: 'Seguros',
    aliases: ['seguros', 'seguradora', 'corretora de seguros', 'previdência'],
    categories: ['Garrafas Premium', 'Canetas Executivas', 'Agendas', 'Kits Escritório'],
    rationale:
      'Seguradoras valorizam itens premium duráveis para fidelizar corretores e brindar clientes corporativos.',
    suggestedProducts: [
      {
        name: 'Garrafa Térmica Inox 500ml',
        category: 'Garrafas',
        priceFrom: 35,
        priceTo: 75,
        reason: 'Brinde executivo de alto valor percebido',
      },
      {
        name: 'Caneta Metálica Premium',
        category: 'Canetas',
        priceFrom: 8,
        priceTo: 25,
        reason: 'Alta circulação, baixo CPM',
      },
      {
        name: 'Agenda Executiva Couro Sintético',
        category: 'Agendas',
        priceFrom: 40,
        priceTo: 90,
        reason: 'Uso diário, exposição constante da marca',
      },
      {
        name: 'Kit Escritório Premium',
        category: 'Kits',
        priceFrom: 80,
        priceTo: 180,
        reason: 'Para gerentes e diretores',
      },
    ],
  },
  {
    ramo: 'Farmacêutico',
    aliases: ['farmacêutico', 'farmaceutica', 'indústria farmacêutica', 'saúde', 'laboratório'],
    categories: ['Blocos', 'Canetas', 'Necessaires', 'Calendários'],
    rationale:
      'Setor farmacêutico distribui em alta escala para médicos e farmácias. Foco em utilitários do dia a dia.',
    suggestedProducts: [
      {
        name: 'Bloco de Anotações com Capa',
        category: 'Blocos',
        priceFrom: 4,
        priceTo: 12,
        reason: 'Distribuição massiva em consultórios',
      },
      {
        name: 'Caneta Plástica Personalizada',
        category: 'Canetas',
        priceFrom: 1.5,
        priceTo: 4,
        reason: 'Alto volume, baixo custo',
      },
      {
        name: 'Calendário de Mesa',
        category: 'Calendários',
        priceFrom: 6,
        priceTo: 18,
        reason: 'Presença anual no consultório',
      },
      {
        name: 'Necessaire Compacta',
        category: 'Necessaires',
        priceFrom: 12,
        priceTo: 35,
        reason: 'Brinde para representantes',
      },
    ],
  },
  {
    ramo: 'Tecnologia',
    aliases: ['tecnologia', 'ti', 'software', 'tech', 'startup', 'indústria eletrônicos'],
    categories: ['Mochilas', 'Power Banks', 'Pen Drives', 'Mouse Pads'],
    rationale:
      'Empresas de tech valorizam itens utilitários para colaboradores e brindes em eventos/conferências.',
    suggestedProducts: [
      {
        name: 'Mochila para Notebook 15.6"',
        category: 'Mochilas',
        priceFrom: 60,
        priceTo: 180,
        reason: 'Uso diário do colaborador',
      },
      {
        name: 'Power Bank 10000mAh',
        category: 'Eletrônicos',
        priceFrom: 35,
        priceTo: 95,
        reason: 'Brinde premium em eventos',
      },
      {
        name: 'Pen Drive 32GB Personalizado',
        category: 'Eletrônicos',
        priceFrom: 18,
        priceTo: 45,
        reason: 'Útil e branded',
      },
      {
        name: 'Mouse Pad Ergonômico',
        category: 'Escritório',
        priceFrom: 12,
        priceTo: 30,
        reason: 'Visibilidade contínua na mesa',
      },
    ],
  },
  {
    ramo: 'Construção',
    aliases: ['construção', 'construcao', 'indústria construção', 'engenharia', 'imobiliária'],
    categories: ['Kits Ferramentas', 'Capacetes', 'Garrafas Resistentes', 'Bonés'],
    rationale:
      'Construtoras e imobiliárias valorizam itens robustos para obra e materiais para clientes finais.',
    suggestedProducts: [
      {
        name: 'Kit Mini Ferramentas',
        category: 'Ferramentas',
        priceFrom: 25,
        priceTo: 80,
        reason: 'Brinde funcional para clientes',
      },
      {
        name: 'Boné com Proteção UV',
        category: 'Vestuário',
        priceFrom: 12,
        priceTo: 35,
        reason: 'EPI promocional para canteiro',
      },
      {
        name: 'Squeeze Resistente 750ml',
        category: 'Garrafas',
        priceFrom: 15,
        priceTo: 40,
        reason: 'Hidratação em obra',
      },
      {
        name: 'Trena 5m Personalizada',
        category: 'Ferramentas',
        priceFrom: 10,
        priceTo: 28,
        reason: 'Item profissional do dia a dia',
      },
    ],
  },
  {
    ramo: 'Educação',
    aliases: ['educação', 'educacao', 'escola', 'universidade', 'treinamento'],
    categories: ['Cadernos', 'Mochilas', 'Estojos', 'Réguas'],
    rationale:
      'Instituições de ensino brindam alunos no início do ano letivo e em eventos de captação.',
    suggestedProducts: [
      {
        name: 'Caderno Universitário',
        category: 'Cadernos',
        priceFrom: 8,
        priceTo: 22,
        reason: 'Uso semestral garantido',
      },
      {
        name: 'Mochila Estudantil',
        category: 'Mochilas',
        priceFrom: 45,
        priceTo: 120,
        reason: 'Brinde de matrícula',
      },
      {
        name: 'Estojo Escolar',
        category: 'Estojos',
        priceFrom: 8,
        priceTo: 25,
        reason: 'Acessório do dia a dia',
      },
      {
        name: 'Kit Régua + Lápis',
        category: 'Escolar',
        priceFrom: 5,
        priceTo: 15,
        reason: 'Distribuição em massa',
      },
    ],
  },
  {
    ramo: 'Financeiro',
    aliases: ['financeiro', 'banco', 'bancário', 'investimento', 'fintech'],
    categories: ['Carteiras', 'Pastas Executivas', 'Canetas Premium', 'Cartões'],
    rationale:
      'Bancos e fintechs investem em itens executivos de alto padrão para clientes private e gerentes.',
    suggestedProducts: [
      {
        name: 'Carteira Slim Couro',
        category: 'Carteiras',
        priceFrom: 35,
        priceTo: 95,
        reason: 'Brinde private banking',
      },
      {
        name: 'Pasta Executiva',
        category: 'Pastas',
        priceFrom: 60,
        priceTo: 200,
        reason: 'Para reuniões corporativas',
      },
      {
        name: 'Caneta Roller Metálica',
        category: 'Canetas',
        priceFrom: 25,
        priceTo: 75,
        reason: 'Sofisticação para assinaturas',
      },
      {
        name: 'Porta Cartão Alumínio',
        category: 'Acessórios',
        priceFrom: 15,
        priceTo: 40,
        reason: 'Item moderno e funcional',
      },
    ],
  },
];

const FALLBACK: IndustryRecommendation = {
  ramo: 'Geral',
  aliases: [],
  categories: ['Canetas', 'Blocos', 'Garrafas', 'Bonés', 'Chaveiros'],
  rationale: 'Produtos universais com alta aceitação em qualquer setor.',
  suggestedProducts: [
    {
      name: 'Caneta Personalizada',
      category: 'Canetas',
      priceFrom: 2,
      priceTo: 8,
      reason: 'Brinde clássico de alta circulação',
    },
    {
      name: 'Bloco de Anotações',
      category: 'Blocos',
      priceFrom: 5,
      priceTo: 18,
      reason: 'Útil em qualquer ambiente',
    },
    {
      name: 'Squeeze 500ml',
      category: 'Garrafas',
      priceFrom: 12,
      priceTo: 35,
      reason: 'Hidratação + branding',
    },
    {
      name: 'Boné Promocional',
      category: 'Vestuário',
      priceFrom: 10,
      priceTo: 28,
      reason: 'Eventos e ações de campo',
    },
  ],
};

/**
 * Resolve recomendação a partir do ramo de atividade da empresa.
 * Match case-insensitive contra `ramo` e `aliases`.
 */
export function resolveIndustryRecommendation(
  ramoAtividade?: string | null,
): IndustryRecommendation {
  if (!ramoAtividade) return FALLBACK;
  const needle = ramoAtividade.toLowerCase().trim();
  const match = INDUSTRY_RECOMMENDATIONS.find(
    (r) =>
      r.ramo.toLowerCase() === needle ||
      r.aliases.some((a) => needle.includes(a) || a.includes(needle)),
  );
  return match ?? FALLBACK;
}
