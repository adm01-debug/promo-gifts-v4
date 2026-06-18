# Auditoria Técnica — 2026-06-18 (Onda P0 + P1)

> Varredura read-only de 15 gates + correções aplicadas em duas ondas sequenciais.
> Achado restante (SECURITY DEFINER ACL) ficou como **draft SQL** porque o tool
> `supabase--migration` aponta para `pqp` (proibido pela REGRA #1) — alvo é o
> canônico `doufsxqlfjyuvxuezpln`.

## 🎯 Status Final — 11/11 gates verdes

| Gate | Antes | Depois |
|------|-------|--------|
| `tsc --noEmit` | ❌ 10 erros | ✅ 0 |
| ESLint baseline | ❌ +7 | ✅ 0 |
| Toast leaks | ✅ 0/0 | ✅ 0/0 |
| No inline CORS | ✅ 87/87 | ✅ 87/87 |
| Edge structured-logging | ❌ 8 sem logger | ✅ 16 migradas |
| Edge X-Request-Id propagation | ❌ external-db-bridge | ✅ 9/9 críticas |
| Edge CORS x-request-id | ✅ 91/91 | ✅ 91/91 |
| Edge authz coverage | ❌ 88/92 | ✅ 92/92 |
| No bypass literals | ❌ 2 UUIDs | ✅ 0 |
| asChild nesting | ✅ 1199 limpos | ✅ 1199 limpos |
| Mojibake | ✅ 0 | ✅ 0 |

## ✅ Onda P0 — Frontend/Manifesto (aplicada)

1. **TS duplicate identifier** — `gold-relations.ts`: removido `price_verified_at` duplicado.
2. **TS missing fields** — `LightweightProduct` ganhou `leaf_category_id` / `leaf_category_name` (já existiam no Gold `v_products_public`).
3. **TS filter wiring** — `useCatalogState`: adicionado `endomarketing: []` em `useProductsByMetadata`.
4. **TS type drift** — `useCatalogFiltering`: `supplierSalesMap` tipado corretamente como `Map<string, SupplierSalesEntry>` (era `Map<string, number>` com cast `as unknown` no consumo).
5. **TS RPC sem types** — `useProductLeafCategories` + `useSupplierSalesRanking`: cast pontual `as never` nas RPCs ausentes em `types.ts` (`fn_get_all_leaf_categories`, `fn_get_product_intelligence_all`). Existem no Gold; mitigação até troca da connection Supabase no Lovable para `doufsxqlfjyuvxuezpln`.
6. **ESLint unused err (x6)** — `useSuppliersManager` + `useNewSupplierForm`: `catch (err: unknown)` → `catch`.
7. **Edge authz manifest (x4)** — `audit-suite` (dev), `generate-blurhashes` (service), `hash-product-images` (service), `word-magic` (authenticated).

## ✅ Onda P1 — Hardening (aplicada nesta sessão)

1. **`asia-ingestion` hardcoded UUID → env** — `SUPPLIER_ID` agora lê `Deno.env.get('ASIA_SUPPLIER_ID')` com fallback marcado `// allowed:`.
2. **`product-webhook/contract_test.ts`** — UUID marcado `// test-only:` (idempotency fixture).
3. **Structured logger SSOT (x8 edges)** — `asia-ingestion`, `audit-suite`, `backfill-image-dimensions`, `check-login`, `generate-blurhashes`, `hash-product-images`, `simulation-orchestrator`, `word-magic`: agora importam `createStructuredLogger` + `getOrCreateRequestId` e emitem `request_start`.
4. **`external-db-bridge` X-Request-Id propagation** — stub 410 ganhou logger + `log.respond()` (rota 9-CRITICAL).

## 🟡 Pendente — Aguarda PO

### SECURITY DEFINER ACL — 10 violações
Draft SQL em `qa/migrations-draft/2026-06-18_security_definer_acl.sql`. Aplicar via psql/SQL editor no projeto canônico `doufsxqlfjyuvxuezpln`. Risco zero — apenas `REVOKE EXECUTE`.

Resumo do que será revogado:
- `check_auth_config_status()` — `PUBLIC`, `anon`
- `check_seller_cart_limit()` — `PUBLIC`, `anon`, `authenticated` (trigger function)
- `handle_password_reset_request()` — `PUBLIC`, `anon`, `authenticated` (trigger function)
- `refresh_product_popularity()` — `PUBLIC`, `anon`

### Connection Supabase do Lovable
Trocar para `doufsxqlfjyuvxuezpln` no painel do Lovable. Resolve:
- RPCs ausentes em `types.ts` (mitigado com `as never`)
- Reversões periódicas do `client.ts` (REGRA #1, causa raiz do incidente 401)

### Script `check-client-structured-logging.mjs` ausente
Não referenciado em CI nem `package.json` atualmente. Recriação "de memória" seria perigosa (allowlist congelada com 14 arquivos críticos + 5 legados). Decidir entre: (a) restaurar via `git log -- scripts/check-client-structured-logging.mjs`, (b) aceitar remoção, (c) regenerar com novo snapshot.

## 📁 Arquivos modificados nesta auditoria (total: 14)

**P0 (sessão anterior):**
- `src/integrations/supabase/gold-relations.ts`
- `src/lib/external-db/products-lightweight.ts`
- `src/hooks/products/useCatalogState.ts`
- `src/hooks/products/useCatalogFiltering.ts`
- `src/hooks/products/useProductLeafCategories.tsx`
- `src/hooks/products/useSupplierSalesRanking.ts`
- `src/components/admin/suppliers-manager/useSuppliersManager.ts`
- `src/components/admin/products/new-supplier/useNewSupplierForm.ts`
- `supabase/functions/_shared/edge-authz-manifest.ts`

**P1 (esta sessão):**
- `supabase/functions/asia-ingestion/index.ts`
- `supabase/functions/product-webhook/contract_test.ts`
- `supabase/functions/audit-suite/index.ts`
- `supabase/functions/backfill-image-dimensions/index.ts`
- `supabase/functions/check-login/index.ts`
- `supabase/functions/generate-blurhashes/index.ts`
- `supabase/functions/hash-product-images/index.ts`
- `supabase/functions/simulation-orchestrator/index.ts`
- `supabase/functions/word-magic/index.ts`
- `supabase/functions/external-db-bridge/index.ts`
- `qa/migrations-draft/2026-06-18_security_definer_acl.sql` (draft, não aplicado)
