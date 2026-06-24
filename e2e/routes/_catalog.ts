/**
 * Catálogo central de rotas do app — fonte única para a suíte smoke
 * `e2e/flows/20-all-features-smoke.spec.ts` e para gerar specs de rota
 * (`e2e/routes/app|admin|quotes|public/*.spec.ts`).
 *
 * IMPORTANTE: rotas dinâmicas usam tokens fixos (`SAMPLE_ID`/`SAMPLE_TOKEN`)
 * para que mocks possam interceptar de forma determinística.
 */

export const SAMPLE_ID = "00000000-0000-0000-0000-000000000001";
export const SAMPLE_TOKEN = "VALID_TOKEN";

export interface RouteEntry {
  /** Path final (já com IDs/tokens substituídos quando dinâmico). */
  path: string;
  /** Categoria — usada por playwright filter/tag. */
  area: "public" | "app" | "admin" | "quotes";
  /** Slug do `data-testid="page-title-<slug>"` quando disponível. */
  titleSlug?: string;
  /** Marca rotas que precisam de role admin. */
  requiresAdmin?: boolean;
  /** Marca rotas que requerem role dev. */
  requiresDev?: boolean;
  /**
   * Identificador estável da feature — usado como CHAVE pela suíte smoke
   * para garantir cobertura. DEVE ser único entre rotas marcadas `smoke: true`.
   * Convenção: kebab-case, escopo no domínio (ex: "catalog", "quotes-list").
   */
  feature?: string;
  /**
   * `true` se a rota é parte do gate smoke determinístico (1 teste/feature).
   * O test de governança em `flows/20-all-features-smoke.spec.ts` falha se
   * alguma rota com `smoke: true` não estiver coberta pelo `SMOKE_COVERAGE`.
   */
  smoke?: boolean;
  /**
   * Descrição humana curta — usada no relatório de governança e em logs
   * de falha do gate (ex: "Catálogo de produtos com busca e filtros").
   */
  description?: string;
}

/* ============================================================
 * Públicas (sem auth)
 * ============================================================ */
export const PUBLIC_ROUTES: RouteEntry[] = [
  { path: "/login", area: "public", feature: "login", description: "Tela de login" },
  { path: "/reset-password", area: "public", feature: "reset-password", description: "Recuperação de senha" },
  { path: `/approve/${SAMPLE_TOKEN}`, area: "public", feature: "quote-public-approval" },
  { path: `/proposta/${SAMPLE_TOKEN}`, area: "public", feature: "quote-public-proposal" },
  { path: `/kit/${SAMPLE_TOKEN}`, area: "public", feature: "kit-public" },
  { path: `/colecao-publica/${SAMPLE_TOKEN}`, area: "public", feature: "collection-public" },
  { path: `/comparar-publica/${SAMPLE_TOKEN}`, area: "public", feature: "comparison-public" },
  { path: `/dossie/${SAMPLE_TOKEN}`, area: "public", feature: "dossier-public" },
];

/* ============================================================
 * App autenticado (qualquer role)
 * ============================================================ */
export const APP_ROUTES: RouteEntry[] = [
  { path: "/", area: "app", titleSlug: "dashboard", feature: "dashboard-home", smoke: true, description: "Dashboard inicial" },
  { path: "/dashboard", area: "app", titleSlug: "dashboard", feature: "dashboard-custom", smoke: true, description: "Dashboard customizável" },
  { path: "/produtos", area: "app", titleSlug: "produtos", feature: "catalog", smoke: true, description: "Catálogo de produtos" },
  { path: "/filtros", area: "app", titleSlug: "produtos", feature: "catalog-filters", smoke: true, description: "Filtros avançados" },
  { path: `/produto/${SAMPLE_ID}`, area: "app", feature: "product-detail" },
  { path: "/novidades", area: "app", feature: "news", smoke: true, description: "Novidades" },
  { path: "/reposicao", area: "app", feature: "restock", smoke: true, description: "Reposição" },
  { path: "/favoritos", area: "app", titleSlug: "favoritos", feature: "favorites", smoke: true, description: "Favoritos" },
  { path: "/carrinhos", area: "app", titleSlug: "carrinhos", feature: "carts", smoke: true, description: "Carrinhos do vendedor" },
  { path: "/comparar", area: "app", titleSlug: "comparador", feature: "comparison", smoke: true, description: "Comparador de produtos" },
  { path: "/colecoes", area: "app", titleSlug: "colecoes", feature: "collections", smoke: true, description: "Coleções" },
  { path: `/colecoes/${SAMPLE_ID}`, area: "app", feature: "collection-detail" },
  { path: "/tendencias", area: "app", titleSlug: "tendencias", feature: "trends", smoke: true, description: "Tendências" },
  { path: "/simulador", area: "app", titleSlug: "simulador", feature: "simulator", smoke: true, description: "Simulador (wizard)" },
  { path: "/simulador-precos", area: "app", titleSlug: "simulador-precos", feature: "price-simulator", smoke: true, description: "Simulador de preços" },
  { path: "/estoque", area: "app", feature: "stock", smoke: true, description: "Estoque" },
  { path: "/busca-preco", area: "app", titleSlug: "busca-avancada-preco", feature: "price-search", smoke: true, description: "Busca avançada de preço" },
  { path: "/montar-kit", area: "app", feature: "kit-builder", smoke: true, description: "Kit Builder" },
  { path: "/meus-kits", area: "app", titleSlug: "kits", feature: "my-kits", smoke: true, description: "Meus Kits" },
  { path: "/mockup-generator", area: "app", feature: "mockup-generator", smoke: true, description: "Gerador de Mockup" },
  { path: "/mockups/historico", area: "app", titleSlug: "mockup-historico", feature: "mockup-history", smoke: true, description: "Histórico de Mockups" },
  { path: "/magic-up", area: "app", titleSlug: "magic-up", feature: "magic-up", smoke: true, description: "Magic Up (publicidade IA)" },
  { path: "/inteligencia-comercial", area: "app", titleSlug: "inteligencia-mercado", feature: "commercial-intel", smoke: true, description: "Inteligência comercial" },
  { path: "/ferramentas/bi", area: "app", titleSlug: "bi", feature: "bi", smoke: true, description: "Business Intelligence" },
  { path: "/ferramentas/bi/comparar", area: "app", feature: "bi-compare", smoke: true, description: "BI — Comparador de clientes" },
  { path: "/match", area: "app", titleSlug: "match-produtos", feature: "match", smoke: true, description: "Match de produtos" },
  { path: "/dropbox", area: "app", titleSlug: "dropbox", feature: "dropbox", smoke: true, description: "Dropbox browser" },
];

/* ============================================================
 * Orçamentos (autenticado)
 * ============================================================ */
export const QUOTES_ROUTES: RouteEntry[] = [
  { path: "/orcamentos", area: "quotes", titleSlug: "orcamentos", feature: "quotes-list", smoke: true, description: "Lista de orçamentos" },
  { path: "/orcamentos/dashboard", area: "quotes", titleSlug: "orcamentos-dashboard", feature: "quotes-dashboard", smoke: true, description: "Dashboard de orçamentos" },
  { path: "/orcamentos/lista", area: "quotes", titleSlug: "orcamentos", feature: "quotes-list-alt" },
  { path: "/orcamentos/kanban", area: "quotes", titleSlug: "orcamentos-funil", feature: "quotes-kanban", smoke: true, description: "Funil (Kanban) de orçamentos" },
  
  { path: "/orcamentos/novo", area: "quotes", titleSlug: "orcamento-novo", feature: "quote-new", smoke: true, description: "Criar novo orçamento (wizard)" },
  { path: `/orcamentos/${SAMPLE_ID}`, area: "quotes", feature: "quote-detail" },
  { path: `/orcamentos/${SAMPLE_ID}/editar`, area: "quotes", feature: "quote-edit" },
];

/* ============================================================
 * Admin (requer role supervisor/dev)
 * ============================================================ */
export const ADMIN_ROUTES: RouteEntry[] = [
  { path: "/admin/usuarios", area: "admin", requiresAdmin: true, feature: "admin-users" },
  { path: "/admin/limites-desconto", area: "admin", requiresAdmin: true, feature: "admin-discount-limits" },
  { path: "/admin/cadastros", area: "admin", requiresAdmin: true, feature: "admin-registrations" },
  { path: "/admin/permissoes", area: "admin", requiresAdmin: true, feature: "admin-permissions" },
  { path: "/admin/roles", area: "admin", requiresAdmin: true, feature: "admin-roles" },
  { path: "/admin/role-permissoes", area: "admin", requiresAdmin: true, feature: "admin-role-permissions" },
  { path: "/admin/temas", area: "admin", requiresAdmin: true, feature: "admin-themes" },
  { path: "/admin/video-variantes", area: "admin", requiresAdmin: true, feature: "admin-video-variants" },
  { path: "/admin/kit-templates", area: "admin", requiresAdmin: true, feature: "admin-kit-templates" },
  { path: "/admin/conexoes", area: "admin", requiresAdmin: true, feature: "admin-connections" },
  { path: "/admin/seguranca", area: "admin", requiresDev: true, feature: "admin-security" },
  { path: "/admin/seguranca/chaves", area: "admin", requiresDev: true, feature: "admin-keys" },
  { path: "/admin/seguranca/migracao-papeis", area: "admin", requiresDev: true, feature: "admin-role-migration" },
  { path: "/admin/prompts-ia", area: "admin", requiresDev: true, feature: "admin-ai-prompts" },
  { path: "/admin/validade-precos", area: "admin", requiresDev: true, feature: "admin-price-validity" },
  { path: "/admin/telemetria", area: "admin", requiresDev: true, feature: "admin-telemetry" },
  { path: "/admin/rate-limit", area: "admin", requiresDev: true, feature: "admin-rate-limit" },
  { path: "/admin/workflows", area: "admin", requiresDev: true, feature: "admin-workflows" },
  { path: "/admin/login-attempts", area: "admin", requiresDev: true, feature: "admin-login-attempts" },
  { path: "/admin/consumo-ia", area: "admin", requiresDev: true, feature: "admin-ai-consumption" },
  { path: "/admin/rls-denials", area: "admin", requiresDev: true, feature: "admin-rls-denials" },
  { path: "/admin/auditoria-propriedade", area: "admin", requiresDev: true, feature: "admin-ownership-audit" },
  { path: "/admin/rbac-rotas", area: "admin", requiresDev: true, feature: "admin-rbac-routes" },
  { path: "/status", area: "admin", requiresDev: true, feature: "admin-status" },
];

/* ============================================================
 * União (para iteração no smoke aggregator)
 * ============================================================ */
export const ALL_ROUTES: RouteEntry[] = [
  ...PUBLIC_ROUTES,
  ...APP_ROUTES,
  ...QUOTES_ROUTES,
  ...ADMIN_ROUTES,
];

/** Rotas autenticadas que NÃO exigem admin/dev (rodam com user comum). */
export const AUTHED_USER_ROUTES: RouteEntry[] = [...APP_ROUTES, ...QUOTES_ROUTES];

/* ============================================================
 * Helpers de cobertura — usados pelo smoke gate
 * ============================================================ */

/** Todas as rotas marcadas como `smoke: true`, com `feature` obrigatório. */
export const SMOKE_ROUTES: RouteEntry[] = ALL_ROUTES.filter(
  (r): r is RouteEntry & { feature: string } => r.smoke === true && !!r.feature,
);

/** Set de features que o smoke DEVE cobrir (validado em runtime). */
export const SMOKE_REQUIRED_FEATURES: ReadonlySet<string> = new Set(
  SMOKE_ROUTES.map((r) => r.feature!),
);

/**
 * Retorna features marcadas `smoke: true` que NÃO estão presentes na lista
 * `covered` informada pelo spec smoke. Usado por test de governança que
 * quebra o build quando alguém adiciona feature ao catálogo e esquece de
 * adicionar test correspondente.
 */
export function findSmokeCoverageGaps(covered: Iterable<string>): string[] {
  const set = new Set(covered);
  return [...SMOKE_REQUIRED_FEATURES].filter((f) => !set.has(f)).sort();
}

/**
 * Inverso: retorna features cobertas pelo spec que NÃO existem no catálogo
 * (typos, features removidas).
 */
export function findUnknownCoveredFeatures(covered: Iterable<string>): string[] {
  return [...covered].filter((f) => !SMOKE_REQUIRED_FEATURES.has(f)).sort();
}
