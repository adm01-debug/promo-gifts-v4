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
     *
     * Slugs canônicos atualmente cobertos pela UI:
     *   - "produtos"                     → /produtos (FiltersPage)
     *   - "favoritos"                    → /favoritos
     *   - "colecoes"                     → /colecoes
     *   - "carrinhos"                    → /carrinhos
     *   - "pedidos"                      → /pedidos
     *   - "clientes"                     → /clientes
     *   - "comparador"                   → /comparar
     *   - "tendencias"                   → /tendencias
     *   - "kits"                         → /kits
     *   - "magic-up"                     → /magic-up
     *   - "mockup-historico"             → /mockup-historico
     *   - "simulador"                    → /simulador (wizard)
     *   - "simulador-precos"             → /simulador-precos
     *   - "simulador-personalizacao"     → /simulador-personalizacao
     *   - "busca-avancada-preco"         → /busca-avancada-preco
     *   - "dashboard"                    → /
     *   - "dropbox"                      → /dropbox
     *   - "inteligencia-mercado"         → /inteligencia-mercado
     *   - "bi"                           → /bi
     *   - "match-produtos"               → /match-produtos
     *   - "orcamentos"                   → /orcamentos
     *   - "orcamentos-dashboard"         → /orcamentos/dashboard
     *   - "orcamentos-funil"             → /orcamentos/funil
     *   - "orcamentos-templates"         → /orcamentos/templates
     *   - "orcamento-novo"               → /orcamentos/novo
     *   - "404"                          → NotFound
     */
    title: (slug: PageSlug | string) => TID(`page-title-${slug}`),
  },

  // ---------- Catálogo / Produto ----------
  catalog: {
    /** Input da busca global do catálogo (SmartSearchInput). */
    searchInput: TID("catalog-search-input"),
  },
  product: {
    card: TID("product-card"),
    /** Nome no card do catálogo (ProductCard / EnhancedProductCard). */
    cardName: TID("product-card-name"),
    /** Nome na linha da view de tabela (ProductTableView). */
    rowName: TID("product-row-name"),
    /** Nome no item da view de lista (ProductListItem). */
    listName: TID("product-list-name"),
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
  },

  // ---------- Variant Picker ----------
  variant: {
    /** Botão "Sem cor específica" do SingleVariantPicker. */
    noVariant: TID("variant-picker-no-variant"),
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
    /** Totais. */
    summarySubtotal: TID("summary-subtotal-products"),
    summaryTotal: TID("summary-total"),
    summaryTotalValue: TID("summary-total-value"),
    /** Desconto: Input numérico (% ou R$, dependendo do toggle). */
    discountInput: TID("quote-discount-input"),
    /** Desconto: Toggle entre percentage (%) e amount (R$). */
    discountTypeSelect: TID("quote-discount-type-select"),
    /** Botão "Solicitar Aprovação" — aparece quando desconto > maxDiscountPercent. */
    requestApprovalButton: TID("quote-request-approval-button"),
    /** Dialog "Solicitar Aprovação de Desconto". */
    approvalDialog: TID("quote-approval-dialog"),
    /** Dentro do dialog: card "Seu Limite" (mostra maxDiscountPercent). */
    approvalLimit: TID("quote-approval-limit"),
    /** Dentro do dialog: card "Solicitado" (mostra discountValue). */
    approvalRequested: TID("quote-approval-requested"),
    /** Dentro do dialog: textarea de justificativa. */
    approvalJustification: TID("quote-approval-justification"),
    /** Dentro do dialog: botão "Enviar para Aprovação". */
    approvalSubmit: TID("quote-approval-submit"),
  },

  // ---------- Pedidos ----------
  order: {
    card: TID("order-card"),
  },

  // ---------- Favoritos ----------
  favorites: {
    list: TID("favorites-list"),
    item: TID("favorite-item"),
    remove: TID("favorite-remove"),
    title: TID("page-title-favoritos"),
    icon: TID("favorites-icon"),
    count: TID("favorites-count"),
    countItems: TID("favorites-count-items"),
    countLists: TID("favorites-count-lists"),
    emptyState: TID("favorites-empty-state"),
    emptyCta: TID("favorites-empty-cta"),
  },

  // ---------- Carrinho ----------
  cart: {
    trigger: TID("cart-trigger"),
    drawer: TID("cart-drawer"),
    /** Aba/empresa do carrinho. */
    tab: TID("cart-tab"),
    /** Contador de itens dentro da aba (data-count=N). */
    tabCount: TID("cart-tab-count"),
    /** Indicador de follow-up (sem movimento há X dias). */
    tabFollowUp: TID("cart-tab-followup"),
    /** Botão "+ Novo" para criar um novo carrinho. */
    tabNew: TID("cart-tab-new"),
    /** Card de item no carrinho. Tem também `data-cart-item-id` e `data-product-id`. */
    item: TID("cart-item"),
    /** Subcomponentes do item. */
    itemName: TID("cart-item-name"),
    itemSku: TID("cart-item-sku"),
    itemImage: TID("cart-item-image"),
    itemView: TID("cart-item-view"),
    itemColor: TID("cart-item-color"),
    itemColorName: TID("cart-item-color-name"),
    itemUnitPrice: TID("cart-item-unit-price"),
    itemTotal: TID("cart-item-total"),
    itemStockLow: TID("cart-item-stock-low"),
    itemStockOut: TID("cart-item-stock-out"),
    itemQtyStepper: TID("cart-item-qty-stepper"),
    itemNotesToggle: TID("cart-item-notes-toggle"),
    itemNotesInput: TID("cart-item-notes-input"),
    /** Menu de ações do item (Ver/Simular/Mover/Duplicar/Remover). */
    itemMenuTrigger: TID("cart-item-menu-trigger"),
    itemActionView: TID("cart-item-action-view"),
    itemActionSimulate: TID("cart-item-action-simulate"),
    itemActionMove: TID("cart-item-action-move"),
    itemActionDuplicate: TID("cart-item-action-duplicate"),
    itemActionRemove: TID("cart-item-action-remove"),
    /** Alvos dos submenus Mover/Duplicar — usam `data-target-cart-id`. */
    itemMoveTarget: TID("cart-item-move-target"),
    itemDuplicateTarget: TID("cart-item-duplicate-target"),
    /** Stepper de quantidade. `cart-qty-badge` expõe `data-qty=N`. */
    qtyBadge: TID("cart-qty-badge"),
    increment: TID("cart-qty-increment"),
    decrement: TID("cart-qty-decrement"),
    qtyDecrementIcon: TID("cart-qty-decrement-icon"),
    qtyRemoveIcon: TID("cart-qty-remove-icon"),
    checkoutCta: TID("cart-checkout-cta"),
    /**
     * Diálogo de confirmação do checkout (Gerar Orçamento). Renderizado pelo
     * ConfirmDialog com `testId="cart-confirm-dialog"` — o wrapper deriva
     * automaticamente os testids escopados abaixo.
     */
    confirmDialog: TID("cart-confirm-dialog"),
    confirmDialogTitle: TID("cart-confirm-dialog-title"),
    confirmDialogDescription: TID("cart-confirm-dialog-description"),
    confirmDialogYes: TID("cart-confirm-dialog-yes"),
    confirmDialogNo: TID("cart-confirm-dialog-no"),
    /** Diálogo "Limpar todos os itens?" do carrinho ativo. */
    clearDialog: TID("cart-clear-dialog"),
    clearDialogYes: TID("cart-clear-dialog-yes"),
    clearDialogNo: TID("cart-clear-dialog-no"),
    /** Diálogo "Excluir carrinho?" (DeleteConfirmDialog escopado). */
    deleteDialog: TID("cart-delete-dialog"),
    deleteDialogYes: TID("cart-delete-dialog-yes"),
    deleteDialogNo: TID("cart-delete-dialog-no"),
    /** Botão de seleção de empresa no CartCompanyPickerDialog. */
    companyPickerSelect: TID("cart-company-picker-select"),
  },

  // ---------- Diálogos genéricos (ConfirmDialog) ----------
  dialog: {
    /**
     * Botões/título genéricos. Use APENAS quando o diálogo for criado sem
     * `testId` próprio. Quando o consumidor passar `testId="x"`, prefira os
     * derivados `x-yes` / `x-no` / `x-title` / `x-description`.
     */
    confirmYes: TID("confirm-dialog-yes"),
    confirmNo: TID("confirm-dialog-no"),
    confirmTitle: TID("confirm-dialog-title"),
    confirmDescription: TID("confirm-dialog-description"),
    /** Helpers para diálogos escopados — combinam com qualquer `testId`. */
    yesFor: (testId: string) => TID(`${testId}-yes`),
    noFor: (testId: string) => TID(`${testId}-no`),
    titleFor: (testId: string) => TID(`${testId}-title`),
    descriptionFor: (testId: string) => TID(`${testId}-description`),
  },

  // ---------- App genérico ----------
  app: {
    /**
     * Toast da aplicação — usamos a lib `sonner`, cujo `data-sonner-toast` é
     * contrato público estável. Não há `app-toast` próprio em uso.
     */
    toast: "[data-sonner-toast]",
    errorBanner: TID("app-error-banner"),
    /** Tela 404 (NotFound page). */
    notFound: TID("app-not-found"),
    /** Tela de acesso negado (DevAccessDeniedPage). */
    accessDenied: TID("app-access-denied"),
    /**
     * Header global do MainLayout — sticky no topo do viewport.
     * Alias de `Sel.app.layout.header`, mantido para retrocompatibilidade.
     */
    header: TID("app-header"),
    /**
     * Sub-namespace do layout fixo (header + breadcrumb bar). Use estes
     * seletores em qualquer asserção de sticky/stacking. Fonte única:
     *  - `app-header`     → `<header>` global em `src/components/layout/Header.tsx`
     *  - `breadcrumb-bar` → wrapper sticky em `src/components/layout/MainLayout.tsx`
     *  - `breadcrumb`     → `<nav>` em `src/components/common/PersistentBreadcrumbs.tsx`
     */
    layout: {
      header: TID("app-header"),
      breadcrumbBar: TID("breadcrumb-bar"),
      breadcrumb: TID("breadcrumb"),
      /**
       * Botão flutuante "voltar ao topo" — `src/components/common/ScrollProgress.tsx`.
       * Aparece após `window.scrollY > threshold` (default 150 no MainLayout).
       */
      scrollToTop: TID("scroll-to-top"),
    },
  },

  // ---------- Bibliotecas externas (contratos estáveis) ----------
  ext: {
    /** Toast da lib `sonner` — atributo público da lib. */
    sonnerToast: "[data-sonner-toast]",
  },
} as const;
