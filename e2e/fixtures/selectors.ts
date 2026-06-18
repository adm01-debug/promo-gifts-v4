/**
 * SSOT de seletores E2E.
 *
 * Política (10/10):
 *  - **Apenas `data-testid`** para elementos do nosso app. Não use texto, role,
 *    aria-label, classes ou ids de DOM como seletor — são frágeis e quebram
 *    em refactors de UI/i18n.
 *  - **Exceção controlada**: bibliotecas externas que expõem data-attributes
 *    estáveis como contrato público (ex.: `data-sonner-toast` da lib `sonner`)
 *    são aceitos. Estão isolados em `Sel.ext.*`.
 *  - Convenção de nomes: `kebab-case` + sufixo do papel
 *    (`-input`, `-submit`, `-toggle`, `-list`, `-item`, `-card`, `-cta`).
 *  - Para grupos dinâmicos (ex.: itens indexados) use prefixo:
 *    `quote-item-${i}`. No spec consulte com `Sel.quote.items` (prefix match)
 *    ou `Sel.quote.item(i)` para um índice específico.
 *  - Sempre que adicionar um seletor novo, primeiro adicione o `data-testid`
 *    no componente React correspondente.
 *
 * Uso:
 *   import { Sel, TID } from "../fixtures/selectors";
 *   await page.fill(Sel.login.email, "user@x.com");
 *   await page.locator(Sel.login.submit).click();
 */

export const TID = (id: string): string => `[data-testid="${id}"]`;
export const TID_PREFIX = (prefix: string): string => `[data-testid^="${prefix}"]`;

/**
 * Slugs canônicos das páginas com `data-testid="page-title-<slug>"`.
 * Mantenha em sincronia com a JSDoc de `Sel.page.title` e os componentes de página.
 */
export type PageSlug =
  | "produtos"
  | "favoritos"
  | "colecoes"
  | "carrinhos"
  | "pedidos"
  | "clientes"
  | "clientes-detalhe"
  | "comparador"
  | "tendencias"
  | "kits"
  | "magic-up"
  | "mockup-historico"
  | "simulador"
  | "simulador-precos"
  | "simulador-personalizacao"
  | "busca-avancada-preco"
  | "dashboard"
  | "dropbox"
  | "inteligencia-mercado"
  | "bi"
  | "match-produtos"
  | "orcamentos"
  | "orcamentos-dashboard"
  | "orcamentos-funil"
  | "orcamentos-templates"
  | "orcamento-novo"
  | "novidades"
  | "estoque"
  | "detalhe-produto"
  | "admin-produto"
  | "cadastros"
  | "termos"
  | "privacidade"
  | "404";

export const Sel = {
  // ---------- Login ----------
  login: {
    form: TID("login-form"),
    email: TID("login-email-input"),
    password: TID("login-password-input"),
    submit: TID("login-submit"),
    toggle: TID("login-password-toggle"),
    forgot: TID("login-forgot-link"),
    /** Mensagem de erro de validação (email inválido, etc.) */
    errorMsg: TID("login-error-msg"),
    /** Tela de "Esqueceu sua senha?" (após clicar em forgot). */
    forgotScreen: TID("forgot-password-screen"),
  },

  // ---------- Sidebar / Navegação ----------
  sidebar: {
    /** Link da sidebar por slug (ex.: "produtos"). */
    link: (slug: string) => TID(`sidebar-link-${slug}`),
  },

  // ---------- Headings de páginas ----------
  page: {
    /**
     * Title proxy de uma página por slug. Convenção: `data-testid="page-title-<slug>"`
     * no `<h1>` (ou `<h2>` principal) da página. Os specs SEMPRE devem usar este
     * helper — nunca `getByRole("heading", { name })` ou `getByText`.
     */
    title: (slug: PageSlug | string) => TID(`page-title-${slug}`),
  },

  // ---------- Catálogo / Produto ----------
  catalog: {
    /** Input da busca global do catálogo (SmartSearchInput). */
    searchInput: TID("catalog-search-input"),
    /** Trigger do <Select> de ordenação (CatalogToolbar + FiltersPage). */
    sortTrigger: TID("catalog-sort-trigger"),
    /** Item específico do dropdown de ordenação (kebab-case do value). */
    sortItem: (value: string) => TID(`catalog-sort-item-${value}`),
    /** Qualquer item do dropdown (prefix match — útil para contagem). */
    sortItems: TID_PREFIX("catalog-sort-item-"),
  },

  product: {
    card: TID("product-card"),
    /** Nome no card do catálogo (ProductCard / EnhancedProductCard). */
    cardName: TID("product-card-name"),
    /** Nome na linha da view de tabela (ProductTableView). */
    rowName: TID("product-row-name"),
    /** Nome no item da view de lista (ProductListItem). */
    listName: TID("product-list-name"),
    /** Thumb clicável na view de lista (abre QuickView). */
    listItemThumb: TID("product-list-item-thumb"),
    /** Thumb clicável na view de tabela (abre QuickView). */
    tableRowThumb: TID("product-table-row-thumb"),
    /** Nome no QuickView (ProductQuickView). */
    quickViewName: TID("product-quickview-name"),
    /** Nome no detalhe do produto (ProductDetailHero h1). */
    name: TID("product-name"),
    /** Qualquer nome de produto (catálogo + detalhe + lista + tabela + quickview). */
    anyName: [
      TID("product-card-name"),
      TID("product-row-name"),
      TID("product-list-name"),
      TID("product-quickview-name"),
      TID("product-name"),
    ].join(", "),
    /**
     * Botão de favoritar — testid estável presente em:
     *  - card do catálogo (ProductCardActions: product-card-favorite)
     *  - detalhe Hero/Sticky/Mobile, QuickView, ListItem, TableRow (product-favorite)
     */
    favorite: `${TID("product-card-favorite")}, ${TID("product-favorite")}`,
    /** Apenas o botão do detalhe do produto. */
    detailFavorite: TID("product-favorite"),
    favoriteRemove: TID("favorite-remove"),
    /** Trigger de adicionar ao carrinho (atualmente o botão do header). */
    cartTrigger: TID("cart-trigger"),
    /** Toggle "Ações rápidas" do card do catálogo (ProductCardActions). */
    actionsToggle: TID("product-card-actions-toggle"),
    /** Botão final "Adicionar ao Carrinho" dentro do popover QuickAddToQuote. */
    cardAddToCart: TID("product-card-add-to-cart"),
    /** Botão "Adicionar" no quick-add inline do EnhancedProductCard. */
    cardQuickAdd: TID("product-card-quick-add"),
    /** Botão "Adicionar ao Orçamento" do QuickView. */
    quickViewAddToQuote: TID("product-quickview-add-to-quote"),
    /** Qualquer CTA de adicionar ao carrinho/orçamento em superfícies de produto. */
    anyAddToCart: [
      TID("product-card-add-to-cart"),
      TID("product-card-quick-add"),
      TID("product-quickview-add-to-quote"),
    ].join(", "),
    /** Badge de personalização no detalhe do produto. */
    personalizationBadge: TID("product-personalization-badge"),
    /** Badge de mockup no detalhe do produto. */
    mockupBadge: TID("product-mockup-badge"),
    /** Badge de kit no detalhe do produto. */
    kitBadge: TID("product-kit-badge"),
    /** SKU no detalhe do produto (ProductInfoBar). */
    sku: TID("product-sku"),
  },

  // ---------- Admin / Cadastros ----------
  admin: {
    /** Botão de criar novo recurso na listagem (Produtos, Fornecedores, Técnicas). */
    createBtn: TID("admin-create-btn"),
    /** Modal/Dialog de formulário. */
    form: TID("admin-form"),
    /** Input de nome no formulário. */
    nameInput: TID("admin-name-input"),
    /** Input de código/SKU no formulário. */
    codeInput: TID("admin-code-input"),
    /** Botão de salvar no formulário. */
    saveBtn: TID("admin-save-btn"),
    /** Tabela de listagem. */
    table: TID("admin-table"),
    /** Linha da tabela (prefixo). */
    row: (id: string) => TID(`admin-row-${id}`),
    /** Botão de deletar na linha. */
    deleteBtn: TID("admin-delete-btn"),
    /** Dialog de confirmação de deleção. */
    confirmDeleteDialog: TID("admin-confirm-delete-dialog"),
    /** Botão de confirmar deleção. */
    confirmDeleteBtn: TID("admin-confirm-delete-btn"),
    /** Input de busca. */
    searchInput: TID("admin-search-input"),
    /** Tabs de cadastro (products, suppliers, personalizacao). */
    tab: (id: string) => TID(`admin-tab-${id}`),
  },

  // ---------- Orçamentos ----------
  quote: {
    newButton: TID("quote-new-button"),
    wizard: TID("quote-wizard"),
    /** Itens do wizard são indexados: quote-item-0, quote-item-1, ... */
    items: TID_PREFIX("quote-item"),
    item: (index: number) => TID(`quote-item-${index}`),
    /** Step 1 — Cliente: opção "Sem empresa" no CompanySearchDropdown. */
    noCompanyOption: TID("no-company-option"),
    /** Step 3 — Itens: botão "Produto" que abre o ProductSearch dialog. */
    addProductButton: TID("quote-add-product-button"),
    /** ProductSearch dialog: input de busca. */
    productSearchInput: TID("product-search-input"),
    /** ProductSearch dialog: opção de produto (indexado pelo id). */
    productSearchOption: TID_PREFIX("product-search-option-"),
    /** ColorSelector: botão "Adicionar sem cor específica". */
    addWithoutColor: TID("product-add-without-color"),
    /** Persistir como rascunho (não exige todos os campos). */
    saveDraft: TID("quote-save-draft"),
    /** Submeter completo (status 'pending'). */
    saveFinal: TID("quote-save-final"),
    /** Wizard nav. */
    next: TID("wizard-next-button"),
    prev: TID("wizard-prev-button"),
  },

  // ---------- Estoque (Stock Dashboard) ----------
  stock: {
    /** Botão dedicado "Em Estoque / Estoque Futuro" no toolbar. */
    futureStockToggleButton: TID("future-stock-toggle-button"),
    /** Switch dentro do popover do botão dedicado. */
    futureStockSwitch: TID("future-stock-switch"),
    /** Pílulas de janela (7/15/30 dias). */
    futureStockWindow: (d: 7 | 15 | 30) => TID(`future-stock-window-${d}`),
    /** Grid de cards de estatística do dashboard de estoque. */
    statCard: TID("stock-stat-card"),
    statCardBySlug: (slug: string) => `[data-testid="stock-stat-card"][data-stat-slug="${slug}"]`,
    statCardTitle: TID("stock-stat-card-title"),
    statCardValue: TID("stock-stat-card-value"),
    statCardSubtitle: TID("stock-stat-card-subtitle"),
    statCardTrend: TID("stock-stat-card-trend"),
  },


  // ---------- App genérico ----------
  app: {
    toast: "[data-sonner-toast]",
    errorBanner: TID("app-error-banner"),
    notFound: TID("app-not-found"),
    accessDenied: TID("app-access-denied"),
    header: TID("app-header"),
    layout: {
      header: TID("app-header"),
      scrollToTop: TID("scroll-to-top"),
      teleport: TID("app-teleport-btn"),
      teleportTooltip: TID("app-teleport-tooltip"),
    },
  },
} as const;
