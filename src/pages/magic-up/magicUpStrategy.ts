export type MagicUpBrief = {
  objective: string;
  channel: string;
  audience: string;
  tone: string;
  cta: string;
  occasion: string;
};

export type MagicUpCreativeControls = {
  creativeMode: string;
  composition: string;
  aspectRatio: string;
  qualityMode: string;
  negativePrompt: string[];
};

export type MagicUpRefinement = {
  id: string;
  label: string;
  instruction: string;
  creativePatch?: Partial<MagicUpCreativeControls>;
};

export type MagicUpBatchVariant = {
  id: string;
  label: string;
  scenePrompt?: string;
  channel?: string;
  tone?: string;
  aspectRatio?: string;
  refinementInstruction?: string;
};

export type MagicUpQualityScore = {
  total: number;
  label: string;
  checks: Array<{ label: string; passed: boolean }>;
};

export type MagicUpQualityCriterion = {
  id: string;
  label: string;
  score: number;
  passed: boolean;
  weight: number;
  recommendation: string;
};

export type MagicUpQualityDiagnosis = {
  total: number;
  label: string;
  summary: string;
  criteria: MagicUpQualityCriterion[];
  strengths: string[];
  risks: string[];
  recommendations: string[];
  source: 'heuristic' | 'ai';
};

export type MagicUpCurationStatus =
  | 'draft'
  | 'good'
  | 'favorite'
  | 'internal-approved'
  | 'sent-to-client'
  | 'client-approved'
  | 'client-rejected'
  | 'needs-adjustment';

export type MagicUpCopyPack = {
  whatsapp: string;
  instagram: string;
  linkedin: string;
  email: string;
  cta: string;
};

export type MagicUpCampaignStatus = 'draft' | 'review' | 'sent' | 'approved' | 'rejected';

export type MagicUpCampaign = MagicUpBrief & {
  id: string | null;
  title: string;
  status: MagicUpCampaignStatus;
  clientId: string | null;
  clientName: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export type MagicUpBrandLogo = {
  id: string;
  label: string;
  url: string;
  variant: 'principal' | 'colorida' | 'branca' | 'preta' | 'horizontal' | 'vertical' | 'icone';
  isPrimary: boolean;
};

export type MagicUpBrandKit = {
  id: string | null;
  clientId: string | null;
  clientName: string | null;
  primaryLogoUrl: string | null;
  logoUrls: MagicUpBrandLogo[];
  primaryColor: string | null;
  secondaryColor: string | null;
  toneOfVoice: string;
  visualStyle: string;
  requiredWords: string[];
  forbiddenWords: string[];
  notes: string;
  updatedAt?: string;
};

export const DEFAULT_BRIEF: MagicUpBrief = {
  objective: 'orcamento-rapido',
  channel: 'whatsapp',
  audience: 'compras-rh',
  tone: 'premium',
  cta: 'Solicite seu orçamento',
  occasion: 'campanha-corporativa',
};

export const DEFAULT_CAMPAIGN: MagicUpCampaign = {
  ...DEFAULT_BRIEF,
  id: null,
  title: 'Campanha Magic Up',
  status: 'draft',
  clientId: null,
  clientName: null,
};

export const DEFAULT_BRAND_KIT: MagicUpBrandKit = {
  id: null,
  clientId: null,
  clientName: null,
  primaryLogoUrl: null,
  logoUrls: [],
  primaryColor: null,
  secondaryColor: null,
  toneOfVoice: 'premium-consultivo',
  visualStyle: 'limpo-corporativo',
  requiredWords: [],
  forbiddenWords: [],
  notes: '',
};

export const DEFAULT_CREATIVE_CONTROLS: MagicUpCreativeControls = {
  creativeMode: 'produto-heroi',
  composition: 'centro-limpo',
  aspectRatio: '1:1',
  qualityMode: 'pro-final',
  negativePrompt: ['Sem texto na imagem', 'Sem logo distorcido', 'Sem fundo poluído'],
};

export const BRIEF_PRESETS = [
  {
    label: 'WhatsApp rápido',
    objective: 'orcamento-rapido',
    channel: 'whatsapp',
    audience: 'compras-rh',
    tone: 'consultivo',
    cta: 'Solicite seu orçamento',
    occasion: 'campanha-corporativa',
  },
  {
    label: 'LinkedIn premium',
    objective: 'reconhecimento',
    channel: 'linkedin',
    audience: 'diretoria',
    tone: 'premium',
    cta: 'Conheça as opções',
    occasion: 'cliente-corporativo',
  },
  {
    label: 'Fim de ano',
    objective: 'sazonal',
    channel: 'instagram-feed',
    audience: 'colaboradores',
    tone: 'emocional',
    cta: 'Personalize para sua equipe',
    occasion: 'fim-de-ano',
  },
  {
    label: 'Feira/evento',
    objective: 'evento',
    channel: 'banner',
    audience: 'marketing',
    tone: 'impactante',
    cta: 'Peça uma proposta',
    occasion: 'feira-evento',
  },
];

export const BRIEF_OPTIONS = {
  objective: ['orcamento-rapido', 'reconhecimento', 'lancamento', 'pos-venda', 'evento', 'sazonal'],
  channel: [
    'whatsapp',
    'instagram-feed',
    'instagram-story',
    'linkedin',
    'catalogo',
    'orcamento',
    'email',
    'banner',
  ],
  audience: ['compras-rh', 'marketing', 'diretoria', 'estudantes', 'colaboradores', 'clientes-vip'],
  tone: [
    'premium',
    'consultivo',
    'institucional',
    'divertido',
    'minimalista',
    'promocional',
    'emocional',
    'impactante',
  ],
};

export const CREATIVE_MODES = [
  'produto-heroi',
  'lifestyle',
  'flatlay',
  'premium',
  'social-ads',
  'catalogo',
  'evento',
  'kit-combinacao',
  'mockup-realista',
];
export const COMPOSITIONS = [
  'centro-limpo',
  'produto-esquerda',
  'produto-direita',
  'close-up',
  'ambiente-aberto',
  'com-pessoas',
  'com-props',
];
export const ASPECT_RATIOS = ['1:1', '4:5', '9:16', '16:9', 'A4', 'WhatsApp'];
export const QUALITY_MODES = ['rascunho', 'alta-qualidade', 'pro-final', 'variacao-rapida'];
export const NEGATIVE_PROMPTS = [
  'Sem texto na imagem',
  'Sem mãos deformadas',
  'Sem logo distorcido',
  'Sem produto duplicado',
  'Sem marca concorrente',
  'Sem fundo poluído',
  'Sem rosto em destaque',
  'Sem aparência artificial',
];
export const BRAND_LOGO_VARIANTS: MagicUpBrandLogo['variant'][] = [
  'principal',
  'colorida',
  'branca',
  'preta',
  'horizontal',
  'vertical',
  'icone',
];

export const REFINEMENT_ACTIONS: MagicUpRefinement[] = [
  {
    id: 'premium',
    label: 'Mais premium',
    instruction:
      'Elevar a percepção de valor com iluminação sofisticada, materiais nobres, composição editorial e acabamento de campanha premium.',
    creativePatch: { creativeMode: 'premium', qualityMode: 'pro-final' },
  },
  {
    id: 'minimalista',
    label: 'Mais minimalista',
    instruction:
      'Reduzir elementos visuais, usar fundo limpo, mais respiro e foco absoluto no produto e no logo.',
    creativePatch: {
      composition: 'centro-limpo',
      negativePrompt: ['Sem texto na imagem', 'Sem fundo poluído', 'Sem produto duplicado'],
    },
  },
  {
    id: 'humano',
    label: 'Mais humano',
    instruction:
      'Adicionar contexto humano natural, mãos ou pessoas em segundo plano sem roubar protagonismo do produto.',
    creativePatch: { composition: 'com-pessoas' },
  },
  {
    id: 'corporativo',
    label: 'Mais corporativo',
    instruction:
      'Direcionar para ambiente B2B profissional, mesa executiva, evento ou escritório moderno com linguagem institucional.',
    creativePatch: { creativeMode: 'mockup-realista' },
  },
  {
    id: 'vibrante',
    label: 'Mais vibrante',
    instruction:
      'Aumentar energia visual com cores vivas controladas, contraste comercial e sensação de campanha social ads.',
    creativePatch: { creativeMode: 'social-ads' },
  },
  {
    id: 'realista',
    label: 'Mais realista',
    instruction:
      'Priorizar fotografia hiper-realista, luz natural, textura fiel do produto e aplicação do logo sem aparência artificial.',
    creativePatch: {
      creativeMode: 'mockup-realista',
      negativePrompt: ['Sem aparência artificial', 'Sem logo distorcido'],
    },
  },
  {
    id: 'foco-produto',
    label: 'Mais foco no produto',
    instruction:
      'Aproximar câmera e hierarquia visual para o produto ser o herói inequívoco da peça.',
    creativePatch: { composition: 'close-up' },
  },
  {
    id: 'menos-elementos',
    label: 'Menos elementos',
    instruction:
      'Remover distrações, props excessivos e fundos complexos, mantendo apenas elementos que reforcem a venda.',
    creativePatch: {
      negativePrompt: ['Sem fundo poluído', 'Sem produto duplicado', 'Sem marca concorrente'],
    },
  },
  {
    id: 'trocar-fundo',
    label: 'Trocar fundo',
    instruction:
      'Manter produto e logo intactos, mas substituir o fundo por uma ambientação mais forte e coerente com o briefing.',
  },
  {
    id: 'mudar-cenario',
    label: 'Mudar cenário',
    instruction:
      'Preservar produto, cor e logo; criar uma nova variação de cenário com outra atmosfera comercial.',
  },
];

export const BATCH_PRESETS: Array<{ id: string; label: string; variants: MagicUpBatchVariant[] }> =
  [
    {
      id: 'cenas',
      label: '3 variações de cena',
      variants: [
        {
          id: 'scene-office',
          label: 'Escritório premium',
          scenePrompt: 'Ambiente corporativo moderno com luz natural e foco comercial B2B.',
        },
        {
          id: 'scene-event',
          label: 'Evento corporativo',
          scenePrompt: 'Cenário de evento, feira ou ação promocional com atmosfera profissional.',
        },
        {
          id: 'scene-gift',
          label: 'Mesa de presente',
          scenePrompt:
            'Composição de gifting corporativo organizada, elegante e pronta para apresentação ao cliente.',
        },
      ],
    },
    {
      id: 'canais',
      label: '3 variações de canal',
      variants: [
        { id: 'channel-whatsapp', label: 'WhatsApp', channel: 'whatsapp', aspectRatio: 'WhatsApp' },
        {
          id: 'channel-instagram',
          label: 'Instagram',
          channel: 'instagram-feed',
          aspectRatio: '1:1',
        },
        { id: 'channel-linkedin', label: 'LinkedIn', channel: 'linkedin', aspectRatio: '4:5' },
      ],
    },
    {
      id: 'tons',
      label: '3 variações de tom',
      variants: [
        {
          id: 'tone-premium',
          label: 'Premium',
          tone: 'premium',
          refinementInstruction: 'Tornar a peça mais sofisticada, aspiracional e refinada.',
        },
        {
          id: 'tone-consultivo',
          label: 'Consultiva',
          tone: 'consultivo',
          refinementInstruction:
            'Transmitir confiança, clareza comercial e solução para compras corporativas.',
        },
        {
          id: 'tone-impactante',
          label: 'Impactante',
          tone: 'impactante',
          refinementInstruction:
            'Criar uma peça com maior contraste, energia e chamada visual forte.',
        },
      ],
    },
    {
      id: 'pacote-completo',
      label: 'Pacote completo',
      variants: [
        { id: 'pack-whatsapp', label: 'WhatsApp', channel: 'whatsapp', aspectRatio: 'WhatsApp' },
        { id: 'pack-instagram', label: 'Instagram', channel: 'instagram-feed', aspectRatio: '1:1' },
        { id: 'pack-linkedin', label: 'LinkedIn', channel: 'linkedin', aspectRatio: '4:5' },
        { id: 'pack-orcamento', label: 'Orçamento', channel: 'orcamento', aspectRatio: 'A4' },
      ],
    },
  ];

export const CAMPAIGN_STATUSES: Array<{ value: MagicUpCampaignStatus; label: string }> = [
  { value: 'draft', label: 'Rascunho' },
  { value: 'review', label: 'Em revisão' },
  { value: 'sent', label: 'Enviada' },
  { value: 'approved', label: 'Aprovada' },
  { value: 'rejected', label: 'Rejeitada' },
];

export const CURATION_STATUSES: Array<{ value: MagicUpCurationStatus; label: string }> = [
  { value: 'draft', label: 'Rascunho' },
  { value: 'good', label: 'Boa' },
  { value: 'favorite', label: 'Favorita' },
  { value: 'internal-approved', label: 'Aprovada internamente' },
  { value: 'sent-to-client', label: 'Enviada ao cliente' },
  { value: 'client-approved', label: 'Aprovada pelo cliente' },
  { value: 'client-rejected', label: 'Rejeitada' },
  { value: 'needs-adjustment', label: 'Precisa ajuste' },
];

export const toHuman = (value: string) =>
  value.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

export function campaignFromBrief(input: {
  brief: MagicUpBrief;
  clientId?: string | null;
  clientName?: string | null;
  productName?: string | null;
}): MagicUpCampaign {
  const channel = toHuman(input.brief.channel);
  const product = input.productName ? ` · ${input.productName}` : '';
  return {
    ...input.brief,
    id: null,
    title: `${channel}${product}`,
    status: 'draft',
    clientId: input.clientId ?? null,
    clientName: input.clientName ?? null,
  };
}

export function buildMagicScore(input: {
  hasProduct: boolean;
  hasLogo: boolean;
  hasClient: boolean;
  hasTechnique: boolean;
  hasBrief: boolean;
  channel: string;
}): MagicUpQualityScore {
  const checks = [
    { label: 'Produto claro', passed: input.hasProduct },
    { label: 'Logo disponível', passed: input.hasLogo },
    { label: 'Canal definido', passed: input.hasBrief && !!input.channel },
    { label: 'Cliente contextualizado', passed: input.hasClient },
    { label: 'Técnica informada', passed: input.hasTechnique },
    { label: 'Pronto para venda', passed: input.hasProduct && input.hasLogo && input.hasBrief },
  ];
  const total = Math.min(98, 58 + checks.filter((c) => c.passed).length * 7);
  return {
    total,
    label:
      total >= 88 ? 'Excelente para envio' : total >= 75 ? 'Boa peça comercial' : 'Precisa revisão',
    checks,
  };
}

export function buildQualityDiagnosis(score: MagicUpQualityScore): MagicUpQualityDiagnosis {
  const criteria = score.checks.map((check, index) => ({
    id:
      check.label
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '') || `criterio-${index + 1}`,
    label: check.label,
    score: check.passed ? 92 : 58,
    passed: check.passed,
    weight: index < 2 ? 5 : 3,
    recommendation: check.passed
      ? 'Critério pronto para envio comercial.'
      : 'Revise este ponto antes de enviar ao cliente.',
  }));
  const risks = criteria
    .filter((criterion) => !criterion.passed)
    .map((criterion) => criterion.label);
  return {
    total: score.total,
    label: score.label,
    summary: risks.length
      ? `Peça promissora, mas revise: ${risks.join(', ')}.`
      : 'Peça consistente para uso comercial e apresentação ao cliente.',
    criteria,
    strengths: criteria
      .filter((criterion) => criterion.passed)
      .slice(0, 4)
      .map((criterion) => criterion.label),
    risks,
    recommendations: risks.length
      ? risks.map((risk) => `Melhorar ${risk.toLowerCase()} na próxima variação.`)
      : ['Usar como versão candidata e adaptar copy ao canal.'],
    source: 'heuristic',
  };
}

export function buildCopyPack(input: {
  productName?: string;
  clientName?: string;
  cta: string;
  tone: string;
  channel: string;
}): MagicUpCopyPack {
  const product = input.productName || 'produto personalizado';
  const client = input.clientName ? `${input.clientName}, ` : '';
  return {
    whatsapp: `${client}preparei uma ideia visual para ${product}. ${input.cta}?`,
    instagram: `${product} personalizado para campanhas corporativas com acabamento ${toHuman(input.tone).toLowerCase()}. ${input.cta}.`,
    linkedin: `Uma proposta visual ${toHuman(input.tone).toLowerCase()} para transformar ${product} em uma ação de marca memorável.`,
    email: `Olá! Segue uma sugestão criativa para ${product}, pensada para ${toHuman(input.channel).toLowerCase()}. ${input.cta}.`,
    cta: input.cta,
  };
}

export function buildBrandKitNotes(kit: MagicUpBrandKit): string {
  return [
    kit.toneOfVoice ? `Tom de voz: ${toHuman(kit.toneOfVoice)}` : null,
    kit.visualStyle ? `Estilo visual: ${toHuman(kit.visualStyle)}` : null,
    kit.primaryColor ? `Cor primária: ${kit.primaryColor}` : null,
    kit.secondaryColor ? `Cor secundária: ${kit.secondaryColor}` : null,
    kit.requiredWords.length ? `Termos obrigatórios: ${kit.requiredWords.join(', ')}` : null,
    kit.forbiddenWords.length ? `Evitar termos: ${kit.forbiddenWords.join(', ')}` : null,
    kit.notes.trim() || null,
  ]
    .filter(Boolean)
    .join('\n');
}
