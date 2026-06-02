# QA Recon Report — promo-gifts-v4
> Generated: 2026-06-02

## 1. Stack Confirmed
React 18.3.1 + Vite 5 + TypeScript + Tailwind + shadcn/ui + Supabase (Postgres + Auth + RLS + Edge Functions). Deploy: Vercel. Tests: Playwright + Vitest.

## 2. Route Tree (68 routes)

### Public (no auth)
| Path | Component |
|---|---|
| `/auth`, `/login` | Auth |
| `/reset-password` | ResetPassword |
| `/forgot-password-confirmation` | ForgotPasswordConfirmation |
| `/auth/callback` | SSOCallbackPage |
| `/unauthorized` | Unauthorized |
| `/termos` | TermsPage |
| `/privacidade` | PrivacyPage |
| `/debug/images` | OptimizedImageDemo |
| `*` | NotFound (404) |

### Protected (auth required)
| Path | Component | Module |
|---|---|---|
| `/` | Index | Home |
| `/dashboard` | CustomizableDashboard | Dashboard |
| `/produtos`, `/filtros` | FiltersPage | Catálogo |
| `/produto/:id` | ProductDetail | Catálogo |
| `/novidades` | NoveltiesPage | Catálogo |
| `/reposicao` | ReplenishmentsPage | Catálogo |
| `/favoritos` | FavoritesPage | Catálogo |
| `/carrinhos`, `/carrinhos/:cartId` | SellerCartsPage | Catálogo |
| `/comparar` | ComparePage | Catálogo |
| `/colecoes`, `/colecoes/:id` | CollectionsPage/Detail | Catálogo |
| `/clientes` | ClientsPage | CRM |
| `/clientes/:id` | ClientDetailPage | CRM |
| `/orcamentos` | QuotesListPage | Cotação |
| `/orcamentos/dashboard` | QuotesDashboardPage | Cotação |
| `/orcamentos/kanban` | QuotesKanbanPage | Cotação |
| `/orcamentos/templates` | QuoteTemplatesPage | Cotação |
| `/orcamentos/novo` | QuoteBuilderPage | Cotação |
| `/orcamentos/:id/editar` | QuoteBuilderPage | Cotação |
| `/orcamentos/:id` | QuoteViewPage | Cotação |
| `/simulador` | SimuladorWizard | Ferramentas |
| `/simulador-precos` | PriceSimulatorPage | Ferramentas |
| `/estoque` | StockDashboardPage | Ferramentas |
| `/busca-preco` | AdvancedPriceSearchPage | Ferramentas |
| `/montar-kit` | KitBuilderPage | Ferramentas |
| `/meus-kits` | MeusKitsPage | Ferramentas |
| `/mockup-generator` | MockupGenerator | Ferramentas |
| `/mockups/historico` | MockupHistoryPage | Ferramentas |
| `/magic-up` | MagicUp | Ferramentas |
| `/inteligencia-comercial` | CommercialIntelligencePage | BI |
| `/ferramentas/bi` | BusinessIntelligencePage | BI |
| `/ferramentas/bi/comparar` | ClientComparatorPage | BI |
| `/match` | ProductMatchPage | Ferramentas |
| `/dropbox` | DropboxBrowserPage | Ferramentas |
| `/simulacao` | SimulationPage | Ferramentas |
| `/ferramentas/cobertura` | CoverageInsightsDashboardPage | BI |
| `/raio-x` | VisualSearchPage | Ferramentas |
| `/promoflix-playground` | PromoFlixPlayground | Ferramentas |
| `/tendencias` | TrendsPage | BI |

### Admin (auth + DevRoute guard)
| Path | Component |
|---|---|
| `/admin/usuarios` | AdminUsuariosPage |
| `/admin/usuarios/promover` | AdminPromoverUsuarioPage |
| `/admin/limites-desconto` | SellerDiscountLimitsAdminPage |
| `/admin/rls-denials` | RlsDenialsAdminPage |
| `/admin/auditoria-propriedade` | OwnershipAuditAdminPage |
| `/admin/cadastros` | AdminCadastrosPage |
| `/admin/cadastros/produto/:id` | AdminProductFormPage |
| `/admin/permissoes` | PermissionsPage |
| `/admin/roles` | RolesPage |
| `/admin/role-permissoes` | RolePermissionsPage |
| `/admin/seguranca` | AdminSegurancaPage |
| `/admin/seguranca-acesso` | AdminSegurancaAcessoPage |
| `/admin/seguranca/chaves` | AdminSegurancaChavesPage |
| `/admin/telemetria` | AdminTelemetriaPage |
| `/admin/conexoes` | AdminConexoesPage |
| `/admin/status` | SystemStatusPage |
| ... (+12 more admin routes) |

## 3. Functional Modules

| Module | Key Files | Tables |
|---|---|---|
| **Auth** | `src/components/auth/`, `src/hooks/auth/`, `src/lib/auth/`, `src/pages/auth/` | profiles, users, permissions, role_permissions, login_attempts |
| **Cadastro** | `src/components/admin/`, `src/pages/admin/AdminCadastrosPage` | companies, contacts, suppliers, carriers, customers |
| **Catálogo** | `src/components/products/`, `src/components/catalog/`, `src/pages/products/`, `src/pages/filters/` | products, search_products_cache |
| **Cotação/Proposta** | `src/components/quotes/`, `src/components/pdf/`, `src/pages/quotes/`, `src/logic/quotes/` | deals, proposals, deal_items |
| **Logística/Frete** | `src/hooks/simulation/`, `src/components/simulator/` | carriers, carrier_evaluations |
| **Dashboard** | `src/components/dashboard/`, `src/pages/admin/` | seller_daily_metrics, sales_goals |
| **BI** | `src/components/bi/`, `src/pages/bi/`, `src/pages/trends/` | company_rfm_scores, rfm_analysis |
| **CRM/Clientes** | `src/components/clients/`, `src/pages/clients/` | companies, customers, interactions, contacts |

## 4. Edge Functions (80+)
Key functions: `health-check`, `cnpj-lookup`, `generate-mockup`, `semantic-search`, `visual-search`, `quote-sync`, `sync-external-db`, `send-notification`, `rls-audit`, `secrets-manager`, `secure-upload`, `validate-access`, `webhook-dispatcher`

## 5. Env Vars
**Used in code but NOT in .env.example:**
- `VITE_GRAVACAO_API_KEY` — engraving API key (potentially sensitive)
- `VITE_AUTH_DEBUG` — auth debugging flag
- `VITE_TOOLTIP_DELAY` — UI config
- `VITE_USE_CANVAS_STARFIELD` — visual effect toggle
- `VITE_PUBLIC_URL` — public URL

**In .env.example but NOT directly used:**
- `VITE_SUPABASE_PUBLISHABLE_KEY` — code uses `VITE_SUPABASE_ANON_KEY` instead

## 6. Supabase Schema
- **170+ tables** in public schema, ALL with RLS enabled
- Key tables: companies (57K rows), customers (48K), contacts (4.5K), audit_log (241K), company_rfm_scores (48K)
- Many SINGU module tables with 0 rows (not yet populated)
- FK relationships extensive (companies→customers, companies→contacts, etc.)

## 7. Vercel Config
- Rewrites: SPA fallback to index.html
- Security headers: HSTS, X-Content-Type-Options, X-Frame-Options, Referrer-Policy, Permissions-Policy, CSP (comprehensive)
- Asset caching: immutable for static files, no-cache for index.html
- Build: `vite build` (confirmed in package.json)

## 8. Risk Priority Order (attack plan)
1. **P0 — Type safety** (337 TS errors) — products, novelties, search modules have wrong types that could cause runtime crashes
2. **P0 — Auth/RLS** — verify IDOR protection, session handling, role isolation
3. **P1 — Catálogo** (most used module) — ProductCard variable-before-declaration bug, status badge type mismatch
4. **P1 — Cotação/PDF** — PDF generation, quote calculations
5. **P1 — Navigation/UX** — 68 routes to verify, responsive, a11y
6. **P2 — Cadastro** — CRUD flows, validation
7. **P2 — Logística/Integrações** — external API error handling
8. **P2 — Performance** — large bundles (9 chunks >350KB), potential N+1 queries
9. **P3 — NF/Bling** — invoice integration
10. **P3 — Env var hygiene** — VITE_SUPABASE_PUBLISHABLE_KEY vs ANON_KEY mismatch
