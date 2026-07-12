# Magazine — Entrega 2026-07-12 (parte 2)

## O que foi entregue no sandbox

### ✅ Teste de regressão `publish()` async
Arquivo: `src/pages/magazine/__tests__/publishAwait.regression.test.ts` — 5 cenários:
- resolve com `Magazine` atualizada (status/publicToken corretos);
- estado do hook reflete o resultado após `await`;
- **antes** do flush, estado permanece `draft` (prova o contrato assíncrono);
- respeita latência do service;
- idempotência: dois `publish()` seguidos.

### ✅ Testes de dedup + UNIQUE draft
- Migração draft: `qa/migrations-draft/2026-07-12_magazine_items_unique_product.sql`
  - `CREATE UNIQUE INDEX CONCURRENTLY` + `ALTER TABLE ... ADD CONSTRAINT ... USING INDEX`
  - Inclui pré-checagem de duplicatas existentes e rollback.
- Testes: `src/services/__tests__/magazineAddProductsUnique.test.ts` — 3 cenários:
  - produto já presente não é reinserido;
  - batch com duplicata + novo insere apenas o novo (1 row);
  - `23505` do BD é tratado (não lança).

**Status testes**: 8/8 verdes no vitest.

## O que precisa ser executado no GitHub Actions (fora do sandbox)

### ⚠️ E2E smoke em staging
Sandbox sem `.env.e2e` (`LOVABLE_BROWSER_AUTH_STATUS=signed_out`). Para rodar:
1. Preencher `.env.e2e` com `E2E_USER_EMAIL`, `E2E_USER_PASSWORD`, opcionalmente `MAGAZINE_PUBLIC_TOKEN`.
2. `npx playwright test e2e/flows/magazine-smoke.spec.ts --project=chromium-smoke`.
3. Ou disparar via workflow `.github/workflows/playwright.yml` com secrets configurados.

### ⚠️ Regenerar `types.ts` + remover `untypedFrom`
Sandbox sem `SUPABASE_ACCESS_TOKEN`. Para executar:
1. Actions → **Regenerate Supabase Types** → Run workflow → branch `main`.
2. O workflow já regenera contra `doufsxqlfjyuvxuezpln`, promove o lint a required e abre PR.
3. Após merge do types.ts, substituir em `src/services/magazineService.ts`:
   - `untypedFrom<MagazineRow>('magazines')` → `supabase.from('magazines')`
   - `untypedFrom<MagazineItemRow>('magazine_items')` → `supabase.from('magazine_items')`
   - Remover interfaces locais `MagazineRow`/`MagazineItemRow` em favor de `Database['public']['Tables']['magazines']['Row']`.

### ⚠️ Aplicar UNIQUE no BD Gold
Rodar `qa/migrations-draft/2026-07-12_magazine_items_unique_product.sql` no painel Supabase (`doufsxqlfjyuvxuezpln`) — não via ferramenta interna (essa aponta para `pqpdolkaeqlyzpdpbizo` e é bloqueada por REGRA #1 do CLAUDE.md).
