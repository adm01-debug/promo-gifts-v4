# Matriz rota↔teste (rotas críticas)

- Cobertura por rota (hit/miss): **54/56 = 96.4%**
- Gaps (miss): **2**

| Rota | Área | Feature | Status | Testes que exercitam |
|---|---|---|---|---|
| `/` | app | dashboard-home | ✅ hit | `e2e/admin-conexoes-credentials-active-products.spec.ts`<br>`e2e/admin-conexoes-zone-collapse.spec.ts`<br>`e2e/agente-permissions.spec.ts`<br>`e2e/auth-guard-redirect.spec.ts`<br>`e2e/auth.spec.ts`<br>`e2e/catalog.spec.ts` |
| `/dashboard` | app | dashboard-custom | ✅ hit | `e2e/auth-guard-redirect.spec.ts`<br>`e2e/flows/02-navigation.spec.ts`<br>`e2e/flows/04-quotes.spec.ts`<br>`e2e/flows/11-errors.spec.ts`<br>`e2e/flows/22-header-sticky.spec.ts`<br>`e2e/flows/23-scroll-to-top-button.spec.ts` |
| `/produtos` | app | catalog | ✅ hit | `e2e/auth-guard-redirect.spec.ts`<br>`e2e/catalog.spec.ts`<br>`e2e/deep-linking.spec.ts`<br>`e2e/editor-permissions.spec.ts`<br>`e2e/flows/02-navigation.spec.ts`<br>`e2e/flows/03-products.spec.ts` |
| `/filtros` | app | catalog-filters | ✅ hit | `e2e/super-filtro-exaustivo.spec.ts`<br>`e2e/visual-regression.spec.ts` |
| `/novidades` | app | news | ✅ hit | `e2e/flows/02-navigation.spec.ts`<br>`e2e/flows/26-non-dev-infra-leak.spec.ts`<br>`e2e/flows/catalog-resilience.spec.ts`<br>`e2e/novidades-exaustivo.spec.ts`<br>`e2e/routes/app/novidades.spec.ts` |
| `/reposicao` | app | restock | ✅ hit | `e2e/reposicao-exaustivo.spec.ts`<br>`e2e/routes/app/replenishments.spec.ts` |
| `/favoritos` | app | favorites | ✅ hit | `e2e/flows/02-navigation.spec.ts`<br>`e2e/flows/08-favorites.spec.ts`<br>`e2e/flows/09-favorite-from-detail.spec.ts`<br>`e2e/flows/10-favorites-persistence-storage.spec.ts`<br>`e2e/flows/13-favorites-empty-state.spec.ts`<br>`e2e/flows/14-favorites-remove-persistence.spec.ts` |
| `/carrinhos` | app | carts | ✅ hit | `e2e/flows/02-navigation.spec.ts`<br>`e2e/flows/12-cart-checkout.spec.ts`<br>`e2e/flows/21-feature-matrix.spec.ts`<br>`e2e/flows/catalog-resilience.spec.ts`<br>`e2e/flows/p0/04-checkout-blocked.spec.ts`<br>`e2e/protected-routes.spec.ts` |
| `/comparar` | app | comparison | ✅ hit | `e2e/flows/21-feature-matrix.spec.ts`<br>`e2e/flows/26-catalog-to-kit-flow.spec.ts`<br>`e2e/flows/catalog-resilience.spec.ts`<br>`e2e/routes/app/cliente-comparator.spec.ts`<br>`e2e/routes/app/comparar.spec.ts`<br>`e2e/routes/public/comparar-publica.spec.ts` |
| `/colecoes` | app | collections | ✅ hit | `e2e/colecoes-exaustivo.spec.ts`<br>`e2e/flows/02-navigation.spec.ts`<br>`e2e/flows/07-collections.spec.ts`<br>`e2e/flows/21-feature-matrix.spec.ts`<br>`e2e/flows/22-header-sticky.spec.ts`<br>`e2e/flows/23-scroll-to-top-button.spec.ts` |
| `/tendencias` | app | trends | ✅ hit | `e2e/flows/21-feature-matrix.spec.ts`<br>`e2e/routes/app/tendencias.spec.ts`<br>`tests/edge-functions/voice-agent.test.ts` |
| `/simulador` | app | simulator | ✅ hit | `e2e/flows/02-navigation.spec.ts`<br>`e2e/flows/09-simulator.spec.ts`<br>`e2e/flows/catalog-resilience.spec.ts`<br>`e2e/protected-routes.spec.ts`<br>`e2e/routes/app/simulador-precos.spec.ts`<br>`e2e/routes/app/simulador.spec.ts` |
| `/simulador-precos` | app | price-simulator | ✅ hit | `e2e/routes/app/simulador-precos.spec.ts` |
| `/estoque` | app | stock | ✅ hit | `e2e/estoque-exaustivo.spec.ts`<br>`e2e/flows/catalog-resilience.spec.ts`<br>`e2e/routes/app/stock-dashboard.spec.ts` |
| `/busca-preco` | app | price-search | ✅ hit | `e2e/routes/app/advanced-price-search.spec.ts` |
| `/montar-kit` | app | kit-builder | ✅ hit | `e2e/routes/app/kit-builder.spec.ts`<br>`e2e/spa-rewrite.spec.ts`<br>`tests/admin/skeleton-fallbacks-ref-warning.test.tsx`<br>`tests/admin/skeleton-navigation-integration.test.tsx`<br>`tests/admin/skeleton-snapshots.test.tsx` |
| `/meus-kits` | app | my-kits | ✅ hit | `e2e/routes/app/kit-library.spec.ts` |
| `/mockup-generator` | app | mockup-generator | ✅ hit | `e2e/flows/mockup-comprehensive.spec.ts`<br>`e2e/flows/mockup-generation-ia.spec.ts`<br>`e2e/flows/mockup-generator.spec.ts`<br>`e2e/flows/mockup-history-flow.spec.ts`<br>`e2e/flows/mockup-resilience.spec.ts`<br>`e2e/flows/mockup-upload-flow.spec.ts` |
| `/mockups/historico` | app | mockup-history | ✅ hit | `e2e/flows/21-feature-matrix.spec.ts`<br>`e2e/routes/app/mockup-history.spec.ts` |
| `/magic-up` | app | magic-up | ✅ hit | `e2e/flows/21-feature-matrix.spec.ts`<br>`e2e/mockup-generate.spec.ts`<br>`e2e/routes/app/magic-up.spec.ts`<br>`tests/a11y/onda5-a11y.test.tsx`<br>`tests/components/magic-up-onda5.test.tsx`<br>`tests/components/magic-up-result-panel-keyboard.test.tsx` |
| `/inteligencia-comercial` | app | commercial-intel | ✅ hit | `e2e/routes/app/comercial-intelligence.spec.ts` |
| `/ferramentas/bi` | app | bi | ✅ hit | `e2e/flows/21-feature-matrix.spec.ts`<br>`e2e/routes/app/business-intelligence.spec.ts`<br>`e2e/routes/app/cliente-comparator.spec.ts` |
| `/ferramentas/bi/comparar` | app | bi-compare | ✅ hit | `e2e/routes/app/cliente-comparator.spec.ts` |
| `/match` | app | match | ✅ hit | `e2e/routes/app/product-match.spec.ts` |
| `/dropbox` | app | dropbox | ✅ hit | `e2e/routes/app/dropbox.spec.ts` |
| `/orcamentos` | quotes | quotes-list | ✅ hit | `e2e/auth-guard-redirect.spec.ts`<br>`e2e/colecoes-exaustivo.spec.ts`<br>`e2e/editor-permissions.spec.ts`<br>`e2e/flows/02-navigation.spec.ts`<br>`e2e/flows/04-quotes.spec.ts`<br>`e2e/flows/04b-quote-create-end-to-end.spec.ts` |
| `/orcamentos/dashboard` | quotes | quotes-dashboard | ✅ hit | `e2e/flows/04-quotes.spec.ts`<br>`e2e/protected-routes.spec.ts`<br>`e2e/quote-create.spec.ts`<br>`e2e/routes/quotes/dashboard.spec.ts` |
| `/orcamentos/kanban` | quotes | quotes-kanban | ✅ hit | `e2e/flows/04-quotes.spec.ts`<br>`e2e/flows/25-quote-full-flow.spec.ts`<br>`e2e/protected-routes.spec.ts`<br>`e2e/quote-create.spec.ts`<br>`e2e/routes/quotes/kanban.spec.ts` |
| `/orcamentos/templates` | quotes | quotes-templates | ✅ hit | `e2e/flows/25-quote-full-flow.spec.ts`<br>`e2e/routes/quotes/templates.spec.ts` |
| `/orcamentos/novo` | quotes | quote-new | ✅ hit | `e2e/colecoes-exaustivo.spec.ts`<br>`e2e/flows/04-quotes.spec.ts`<br>`e2e/flows/04b-quote-create-end-to-end.spec.ts`<br>`e2e/flows/04c-quote-discount-approval.spec.ts`<br>`e2e/flows/12-cart-checkout.spec.ts`<br>`e2e/flows/21-feature-matrix.spec.ts` |
| `/admin/usuarios` | admin | admin-users | ✅ hit | `e2e/agente-permissions.spec.ts`<br>`e2e/deep-linking.spec.ts`<br>`e2e/discount-approval.spec.ts`<br>`e2e/editor-permissions.spec.ts`<br>`e2e/flows/10-admin.spec.ts`<br>`e2e/flows/24-rbac-navigation.spec.ts` |
| `/admin/limites-desconto` | admin | admin-discount-limits | ✅ hit | `e2e/routes/admin/limites-desconto.spec.ts` |
| `/admin/cadastros` | admin | admin-registrations | ✅ hit | `e2e/agente-permissions.spec.ts`<br>`e2e/editor-permissions.spec.ts`<br>`e2e/flows/24-rbac-navigation.spec.ts`<br>`e2e/rbac-navigation.spec.ts`<br>`e2e/routes/admin/cadastros.spec.ts`<br>`tests/lib/filter-dev-only-items.test.ts` |
| `/admin/permissoes` | admin | admin-permissions | ✅ hit | `e2e/rbac-navigation.spec.ts`<br>`e2e/routes/admin/permissions.spec.ts` |
| `/admin/roles` | admin | admin-roles | ✅ hit | `e2e/flows/27-admin-critical-routes.spec.ts`<br>`e2e/routes/admin/roles.spec.ts` |
| `/admin/role-permissoes` | admin | admin-role-permissions | ✅ hit | `e2e/routes/admin/role-permissions.spec.ts` |
| `/admin/temas` | admin | admin-themes | ✅ hit | `tests/admin/reduced-app-navigation.test.tsx`<br>`tests/admin/route-no-error-element.test.tsx` |
| `/admin/video-variantes` | admin | admin-video-variants | ✅ hit | `e2e/routes/admin/video-variants.spec.ts` |
| `/admin/kit-templates` | admin | admin-kit-templates | ❌ miss | - |
| `/admin/conexoes` | admin | admin-connections | ✅ hit | `e2e/admin-conexoes-credentials-active-products.spec.ts`<br>`e2e/admin-conexoes-zone-collapse.spec.ts`<br>`e2e/flows/24-rbac-navigation.spec.ts`<br>`e2e/flows/27-admin-critical-routes.spec.ts`<br>`e2e/flows/p0/05-admin-down.spec.ts`<br>`e2e/routes/admin/conexoes.spec.ts` |
| `/admin/seguranca` | admin | admin-security | ✅ hit | `e2e/agente-permissions.spec.ts`<br>`e2e/editor-permissions.spec.ts`<br>`e2e/flows/24-rbac-navigation.spec.ts`<br>`e2e/flows/27-admin-critical-routes.spec.ts`<br>`e2e/rbac-navigation.spec.ts`<br>`e2e/routes/admin/migracao-papeis.spec.ts` |
| `/admin/seguranca/chaves` | admin | admin-keys | ✅ hit | `e2e/routes/admin/seguranca-chaves.spec.ts`<br>`tests/components/DevRoute.test.tsx` |
| `/admin/seguranca/migracao-papeis` | admin | admin-role-migration | ✅ hit | `e2e/routes/admin/migracao-papeis.spec.ts` |
| `/admin/prompts-ia` | admin | admin-ai-prompts | ✅ hit | `e2e/routes/admin/prompts-ia.spec.ts`<br>`tests/lib/filter-dev-only-items.test.ts` |
| `/admin/validade-precos` | admin | admin-price-validity | ✅ hit | `e2e/routes/admin/price-freshness.spec.ts`<br>`tests/lib/filter-dev-only-items.test.ts` |
| `/admin/telemetria` | admin | admin-telemetry | ✅ hit | `e2e/agente-permissions.spec.ts`<br>`e2e/deep-linking.spec.ts`<br>`e2e/editor-permissions.spec.ts`<br>`e2e/rbac-navigation.spec.ts`<br>`e2e/routes/admin/telemetry.spec.ts`<br>`e2e/spa-rewrite.spec.ts` |
| `/admin/rate-limit` | admin | admin-rate-limit | ✅ hit | `e2e/flows/27-admin-critical-routes.spec.ts`<br>`e2e/routes/admin/rate-limit.spec.ts` |
| `/admin/workflows` | admin | admin-workflows | ✅ hit | `e2e/agente-permissions.spec.ts`<br>`e2e/editor-permissions.spec.ts`<br>`e2e/flows/27-admin-critical-routes.spec.ts`<br>`e2e/rbac-navigation.spec.ts`<br>`e2e/routes/admin/workflows.spec.ts`<br>`tests/lib/filter-dev-only-items.test.ts` |
| `/admin/login-attempts` | admin | admin-login-attempts | ✅ hit | `e2e/routes/admin/login-attempts.spec.ts`<br>`tests/components/DevRoute.test.tsx` |
| `/admin/consumo-ia` | admin | admin-ai-consumption | ✅ hit | `e2e/routes/admin/ai-usage.spec.ts` |
| `/admin/rls-denials` | admin | admin-rls-denials | ✅ hit | `e2e/flows/27-admin-critical-routes.spec.ts`<br>`e2e/routes/admin/rls-denials.spec.ts` |
| `/admin/auditoria-propriedade` | admin | admin-ownership-audit | ❌ miss | - |
| `/admin/rbac-rotas` | admin | admin-rbac-routes | ✅ hit | `tests/lib/filter-dev-only-items.test.ts`<br>`tests/lib/filter-restricted-items.test.ts` |
| `/status` | admin | admin-status | ✅ hit | `e2e/routes/admin/system-status.spec.ts`<br>`tests/admin/reduced-app-navigation.test.tsx`<br>`tests/admin/route-no-error-element.test.tsx`<br>`tests/components/DevRoute.test.tsx`<br>`tests/lib/external-db-invoke.test.ts`<br>`tests/lib/filter-restricted-items.test.ts` |
| `/login` | public | login | ✅ hit | `e2e/admin-conexoes-credentials-active-products.spec.ts`<br>`e2e/admin-conexoes-zone-collapse.spec.ts`<br>`e2e/auth.spec.ts`<br>`e2e/deep-linking.spec.ts`<br>`e2e/discount-approval.spec.ts`<br>`e2e/editor-permissions.spec.ts` |
| `/reset-password` | public | reset-password | ✅ hit | `e2e/flows/20-all-features-smoke.spec.ts`<br>`e2e/flows/24-rbac-navigation.spec.ts`<br>`e2e/flows/25-password-reset-smoke.spec.ts`<br>`e2e/flows/p0/08-password-recovery.spec.ts`<br>`e2e/protected-routes.spec.ts`<br>`e2e/routes/public/reset-password.spec.ts` |
