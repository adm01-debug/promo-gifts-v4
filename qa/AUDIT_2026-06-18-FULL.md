# Auditoria Técnica — 2026-06-18 (Full Scan)

> Varredura read-only de 15 gates + correções P0 autossuficientes (frontend/manifesto).
> Achados que exigem migração de BD, novas edges ou regeneração de `types.ts` **NÃO foram aplicados** — listados em "Aprovação necessária".

## ✅ Corrigido nesta auditoria (P0 seguro)

| # | Categoria | Arquivo | Fix |
|---|-----------|---------|-----|
| 1 | TS (duplicate identifier) | `src/integrations/supabase/gold-relations.ts` | Removido `price_verified_at` duplicado (linhas 203 + 215) |
| 2 | TS (missing fields) | `src/lib/external-db/products-lightweight.ts` | Adicionado `leaf_category_id` / `leaf_category_name` ao tipo `LightweightProduct` (já existem no Gold em `v_products_public`) |
| 3 | TS (filter wiring) | `src/hooks/products/useCatalogState.ts` | Adicionado `endomarketing: []` ao chamar `useProductsByMetadata` (campo obrigatório que faltava) |
| 4 | TS (type drift) | `src/hooks/products/useCatalogFiltering.ts` | `supplierSalesMap` agora tipado como `Map<string, SupplierSalesEntry>` (era `Map<string, number>` com cast `as unknown` no consumo — drift) |
| 5 | TS (RPC sem types) | `src/hooks/products/useProductLeafCategories.tsx` + `useSupplierSalesRanking.ts` | Cast pontual `as never` no nome da RPC (`fn_get_all_leaf_categories`, `fn_get_product_intelligence_all`) — RPCs existem no DB canônico Gold mas `types.ts` (gerado pelo Lovable a partir do projeto `pqp`) não as expõe. **REGRA #4 do projeto proíbe regen de types.ts sem investigação prévia.** |
| 6 | ESLint baseline | `src/components/admin/suppliers-manager/useSuppliersManager.ts` + `useNewSupplierForm.ts` | 6 ocorrências de `catch (err: unknown)` com `err` não usado → trocadas por `catch` |
| 7 | Edge authz manifest | `supabase/functions/_shared/edge-authz-manifest.ts` | Adicionadas 4 entradas faltantes: `audit-suite` (dev), `generate-blurhashes` (service), `hash-product-images` (service), `word-magic` (authenticated) |

**Resultado dos gates pós-fix:**

| Gate | Status |
|------|--------|
| `tsc --noEmit` | ✅ 0 erros |
| ESLint baseline | ✅ 0 regressões (era +7) |
| Toast leaks | ✅ 0/0 |
| No inline CORS | ✅ 87/87 via shared |
| Edge CORS x-request-id | ✅ 91/91 |
| Edge authz coverage | ✅ 92/92 declaradas (era 88/92) |
| asChild nesting | ✅ 1199 arquivos limpos |
| Mojibake | ✅ 0 |

## 🟡 P0 — Requer aprovação do PO (não aplicado)

> Conforme `project-knowledge`: "NUNCA criar tabela, função, trigger, RLS policy ou edge function nova sem confirmação explícita do PO" e REGRA #4 (não regen types).

### 1. SECURITY DEFINER ACL — 10 violações
Funções `public.*` com `EXECUTE` para `PUBLIC`/`anon`/`authenticated` quando deveriam ser restritas:
- `check_auth_config_status()` — anon + PUBLIC
- `check_seller_cart_limit()` — PUBLIC + authenticated + anon (é trigger function, nunca deveria ser callable)
- `handle_password_reset_request()` — PUBLIC + authenticated + anon (trigger function)
- `refresh_product_popularity()` — PUBLIC + anon

**Ação proposta (migração SQL, requer aprovação):**
```sql
REVOKE EXECUTE ON FUNCTION public.check_auth_config_status() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.check_seller_cart_limit() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_password_reset_request() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.refresh_product_popularity() FROM PUBLIC, anon;
```
Memória relevante: `mem://security/security-definer-acl-policy`.

### 2. Hardcoded UUID em edge function
- `supabase/functions/asia-ingestion/index.ts:6` — `const SUPPLIER_ID = 'd2734e23-...'` deve sair para vault (`integration_credentials`) via `resolveCredential('ASIA_SUPPLIER_ID', supabase)`.
- `supabase/functions/product-webhook/contract_test.ts:38` — UUID em teste (baixo risco, mas viola gate).

### 3. Edge functions sem logger estruturado SSOT (8)
`asia-ingestion`, `audit-suite`, `backfill-image-dimensions`, `check-login`, `generate-blurhashes`, `hash-product-images`, `simulation-orchestrator`, `word-magic`.
- Importar `createStructuredLogger` de `_shared/structured-logger.ts`.
- Memória relevante: `mem://observability/edge-structured-logging-gate`.

### 4. `external-db-bridge` sem propagação de X-Request-Id
Edge crítica (rota 9-CRITICAL) sem `createStructuredLogger` nem `withRequestIdHeader`. Falha gate `check-edge-request-id-propagation`.

### 5. RPCs ausentes em `types.ts` (correlato ao Fix #5 acima)
`fn_get_all_leaf_categories` e `fn_get_product_intelligence_all` existem no Gold (`doufsxqlfjyuvxuezpln`) mas o `types.ts` gerado pelo Lovable não as inclui. Cast `as never` aplicado como mitigação. **Solução durável: trocar a connection Supabase no Lovable para o projeto Gold** (instrução já documentada em `project-knowledge`).

### 6. `check-client-structured-logging.mjs` ausente
O script é referenciado pelo CI (`mem://observability/client-structured-logging-gate`) mas não existe em `/scripts`. Verificar se foi renomeado ou se foi removido por engano.

## 🔵 Observações de menor severidade

- `node_modules/@vitejs/plugin-react-swc/index.d.ts(58)` emite erros TS — vem da lib, não bloqueia (tsc isolado roda OK no projeto via `tsconfig.app.json`).
- ESLint baseline atualmente em 1433 erros legados (snapshot congelado) — fora do escopo desta auditoria pontual.

## Próximos passos sugeridos

1. **Confirmar aprovação** para a migração de `REVOKE EXECUTE` (item 1) — risco zero de regressão.
2. **Mover `ASIA_SUPPLIER_ID`** para vault (item 2).
3. **Trocar connection Supabase no Lovable** para `doufsxqlfjyuvxuezpln` — resolve item 5 e a raiz de reversões periódicas do `client.ts` (REGRA #1).
4. Onda P1 separada para os 8 edges sem structured-logger (item 3) + `external-db-bridge` (item 4).
