/**
 * categoryResolver — fonte única para categorização de produtos no módulo BI.
 *
 * Estratégia em 3 camadas:
 *  1) category_name explícito (passado pelo caller — vindo de products.category_id → categories.name)
 *  2) Heurística regex unificada (substitui as 3 cópias dispersas em hooks)
 *  3) Fallback "Outros"
 *
 * Mantém slugs e cores estáveis para uso em chips, charts e ícones.
 */

export type BICategorySlug =
  | 'garrafas'
  | 'canetas'
  | 'mochilas'
  | 'agendas'
  | 'eletronicos'
  | 'blocos'
  | 'vestuario'
  | 'kits'
  | 'necessaires'
  | 'outros';

export interface BICategoryMeta {
  slug: BICategorySlug;
  label: string;
  /** classe Tailwind para acento (ex.: text-emerald-600) — opcional */
  accentClass?: string;
}

const REGEX_RULES: Array<{ test: RegExp; meta: BICategoryMeta }> = [
  { test: /garrafa|squeeze|t[eé]rmic/i, meta: { slug: 'garrafas', label: 'Garrafas e Squeezes' } },
  { test: /caneta|lapiseira|roller/i, meta: { slug: 'canetas', label: 'Canetas Premium' } },
  { test: /mochila|bolsa|sling/i, meta: { slug: 'mochilas', label: 'Mochilas e Bolsas' } },
  { test: /agenda|planner|caderno/i, meta: { slug: 'agendas', label: 'Agendas' } },
  {
    test: /power\s*bank|carregador|wireless|bluetooth|fone|caixa\s*de\s*som|eletr[oô]n/i,
    meta: { slug: 'eletronicos', label: 'Brindes Tecnológicos' },
  },
  { test: /bloco|notas/i, meta: { slug: 'blocos', label: 'Blocos e Notas' } },
  {
    test: /camis|polo|jaqueta|moletom|bone|bon[eé]/i,
    meta: { slug: 'vestuario', label: 'Vestuário' },
  },
  { test: /kit/i, meta: { slug: 'kits', label: 'Kits' } },
  { test: /necessaire|nec[eé]ssaire/i, meta: { slug: 'necessaires', label: 'Necessaires' } },
];

const FALLBACK: BICategoryMeta = { slug: 'outros', label: 'Outros' };

/**
 * Resolve a categoria BI a partir do nome do produto e (opcional) categoria explícita.
 *
 * @param productName Nome canônico do produto
 * @param explicitCategoryName Nome da categoria real (ex.: products.category_id → categories.name)
 */
export function resolveBICategory(
  productName: string,
  explicitCategoryName?: string | null,
): BICategoryMeta {
  // 1) Categoria real explícita — tenta casar o nome dela contra as regras (não o nome do produto)
  if (explicitCategoryName?.trim()) {
    for (const rule of REGEX_RULES) {
      if (rule.test.test(explicitCategoryName)) return rule.meta;
    }
    // Categoria real existe mas não casou nenhuma regra → usa o próprio nome dela como label
    const cleaned = explicitCategoryName.trim();
    return {
      slug: 'outros',
      label: cleaned.charAt(0).toUpperCase() + cleaned.slice(1),
    };
  }

  // 2) Heurística por nome do produto
  for (const rule of REGEX_RULES) {
    if (rule.test.test(productName)) return rule.meta;
  }

  // 3) Fallback
  return FALLBACK;
}

/** Atalho conveniente — devolve apenas o label (compat com `deriveCategory` antigo) */
export function resolveBICategoryLabel(
  productName: string,
  explicitCategoryName?: string | null,
): string {
  return resolveBICategory(productName, explicitCategoryName).label;
}
