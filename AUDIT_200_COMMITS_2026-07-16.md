# Auditoria Exaustiva — promo-gifts-v4 (últimos 200 commits)

**Data:** 2026-07-16 · **Projeto Supabase (SSOT):** `doufsxqlfjyuvxuezpln` (Gold/Medallion)
**Escopo:** GitHub (code scanning, secret scanning, dependabot, CI), Supabase (advisors segurança+performance, RLS/grants ao vivo), Vercel (deployments/runtime), varredura dos 200 commits + invariantes do CLAUDE.md.
**Fontes vivas:** 2.141 advisories de segurança (112 ERROR) + 527 de performance; 30 alertas CodeQL abertos; 1 alerta de secret scanning aberto; 11/30 gates de CI vermelhos no `main`.

---

## 🟢 O que está SÓLIDO (invariantes do CLAUDE.md intactos)

- **SSOT Supabase**: `client.ts` preserva `CURRENT_PROJECT_ID='doufsxqlfjyuvxuezpln'`, `validateEnv()` e `CANONICAL_ANON_KEY`. `validate-supabase-config.mjs` passa. Gate "SSOT Supabase Guard" **verde** no CI.
- **Campos críticos do `Product`**: `price, sale_price, shortDescription, category_id, category_name` presentes. `check-product-type-fields.mjs` passa.
- **types.ts**: todas as tabelas exigidas presentes (`personalization_techniques`, `products`, `product_variants`, `suppliers`, `supplier_products_raw`).
- **Dependabot**: 0 alertas. **CodeQL**: 0 critical / 0 error. **Vercel runtime**: 0 erros em 7 dias. Segredos hardcoded em `src/` = apenas a anon key canônica (pública por design).

---

## 🔴 P0 — Exposição crítica ativa (corrigir HOJE)

### P0-1. `magazine_public_view_events_2026_07..10`: anon lê/grava/apaga PII sem RLS
Confirmado ao vivo no banco (`pg_class` + `information_schema.role_table_grants`):

| Partição | RLS | Policies | Grants a `anon` |
|---|---|---|---|
| `magazine_public_view_events` (pai) | ✅ on | 3 | — |
| `_2026_07` / `_08` / `_09` / `_10` | ❌ **off** | **0** | **SELECT, INSERT, UPDATE, DELETE** |

As partições guardam `session_id` (PII) e `token_hash` (hash do token de acesso à revista — há índice `token_hash_viewed_at_idx`). Como cada partição é exposta individualmente no PostgREST/GraphQL, um atacante **não autenticado** pode, direto em `/rest/v1/magazine_public_view_events_2026_07`:
- **SELECT** → vazar `session_id` + `token_hash` de todos os leitores;
- **INSERT** → forjar métricas de visualização;
- **UPDATE/DELETE** → adulterar ou apagar todo o histórico de views.

Marcado 2× pelo linter Supabase: `rls_disabled_in_public` (ERROR) + `sensitive_columns_exposed` (ERROR). A partição `_default` tem RLS ligado (mas 0 policies → nega tudo) — ou seja, o trigger de particionamento datado ficou **sem herdar o hardening**. Introduzido pelo trabalho recente de magazine ("Criou trigger de token magazine" / "Persistiu public_token").
**Fix:** `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` + `REVOKE ALL ... FROM anon, authenticated` em cada partição e no template de partição futura; idealmente escrever via edge function `service_role` apenas.

---

## 🟠 P1 — Alto risco

### P1-1. Service_role key vazada no histórico git (repo PÚBLICO)
Secret scanning **alerta #1, ABERTO**, `publicly_leaked: true`, `secret_type: supabase_service_key`.
- Local histórico: `scripts/contract-testing.mjs:5` (commit `b0cc98c1…`). Removida do HEAD, mas **permanece no histórico de um repo público**.
- É a **service_role** (BYPASSRLS, admin total) do projeto `pqpdolkaeqlyzpdpbizo`, JWT válido até **2036** (`exp: 2094447057`).
- Ainda que o CLAUDE.md trate esse projeto como "vazio", uma service_role pública = controle administrativo total dele.
**Fix:** rotacionar a chave no painel do projeto `pqpdolkaeqlyzpdpbizo`, resolver o alerta, e (opcional) purgar do histórico.

### P1-2. 380 funções `SECURITY DEFINER` executáveis por `anon` (+422 por `authenticated`)
`anon_security_definer_function_executable` (0028). Via `/rest/v1/rpc/<fn>` sem login:
- **`check_login_rate_limit(_email,_ip)`** → sondagem/abuso do rate-limit de autenticação sem sessão;
- funções administrativas/pipeline: `fn_admin_sync_external_connections`, `execute_role_migration_batch`, `fn_asia_*_promote_to_gold`, dezenas de `fn_asia_*` de ingestão.
**Fix:** `REVOKE EXECUTE ... FROM anon, authenticated` nas funções não-públicas e/ou converter para `SECURITY INVOKER`.

### P1-3. 104 `security_definer_view` (ERROR) expõem catálogo com privilégios do criador
Inclui `v_products_public`, `v_suppliers_public`, `v_variant_sale_prices_public`, `mv_product_cards`, `mv_product_intelligence`. Rodam ignorando o RLS do usuário.
**Fix:** recriar com `security_invoker=on` onde o consumo é por usuário autenticado; manter DEFINER só onde há justificativa e ACL restrita.

### P1-4. CI vermelho no `main` — deploy de produção não é bloqueado pelos gates
No HEAD `c2e2c2d` (produção), **11 de 30 workflows falharam**: E2E (Playwright), E2E Tests, Full CI, Magazine Unit Tests, Magazine typed-queries dry-run, Swatch/Thumb QuickView, Edge Integration Tests, **Credentials Audit**, Replenishment Quality, Delivery Quality. Mesmo assim **"Deploy to Vercel" passou e publicou** → os gates de teste não são required/bloqueantes para o deploy. (SSOT Guard, Supabase Linter Gate, Security Scan, CodeQL ficaram verdes.)
**Fix:** tornar E2E/Full CI/Credentials Audit "required checks" para o deploy, ou investigar as 11 falhas (o `fix(magazine)` mais recente deixou fixtures/tests quebrados).

### P1-5. CodeQL — 6 achados HIGH em código de runtime
Dos 30 alertas (25 high, 0 critical), os relevantes em runtime (não scripts/testes):
- `src/lib/security/sanitize.ts:71` — `incomplete-multi-character-sanitization`: *"may still contain `<script`"* — falha **no próprio sanitizador** (vetor XSS).
- `src/pages/magazine/hooks/useMagazineReaderState.ts:119` — `insecure-randomness`: `Math.random()` em **contexto de segurança** (geração ligada ao token de revista).
- `src/lib/logger.ts:27` — `remote-property-injection` (5 fluxos): nome de propriedade escrito a partir de valor do usuário.
- `imageProxy.ts:113`, `OptimizedImage.tsx:53/68`, `public/sw.js:224`, `PromoFlixPlayer.tsx:275` — `incomplete-url-substring-sanitization` / `missing-regexp-anchor`: host allowlist por substring → `imagedelivery.net`/`unsplash.com`/`cloudflarestream.com` podem aparecer em qualquer parte da URL (bypass de host).

### P1-6. Migrations hardcodam o projeto PROIBIDO em SQL executável (risco de replay DR)
`pqpdolkaeqlyzpdpbizo.supabase.co` embutido em funções/cron:
- `20260514112149_edge_function_secrets_callers_hardening.sql:68,126,212`
- `20260602020000_fix_hardcoded_api_key_cron.sql:21` (+ `20260601140100`, `20260530173000`, `20260530174500`)
- snapshot `migrations-snapshot/ALL_IN_ONE.sql:73954,74012,74098,88096`

A própria `20260619210000_fix_cron_...canonical_url.sql` alerta que "um replay limpo reintroduziria a URL proibida". Num rebuild DR/branch novo há janela apontando para o projeto Lovable vazio → risco de reincidência do incidente 401.
**Fix:** migration idempotente final que canoniza todas essas funções/cron para o projeto Gold.

### P1-7. `webhook-inbound`: público + HMAC fail-open
`config.toml`: `verify_jwt=false`. O próprio código documenta que, **sem `WEBHOOK_INBOUND_SIGNING_SECRET` setado, a verificação é fail-open** — qualquer origem grava eventos forjados em `webhook_events`.
**Fix:** confirmar o secret em produção; tornar a verificação HMAC obrigatória (fail-closed).

---

## 🟡 P2 — Médio / higiene

- **Exposição em massa no Data API/GraphQL**: 494 objetos visíveis a `anon` e 632 a `authenticated`, incluindo `archive.*`/`backup.*` sensíveis (`archive.auth_login_attempts`, `archive.audit_log`). `REVOKE SELECT` de `anon`/`authenticated` nesses schemas (não deveriam estar na API).
- **RLS permissiva `USING(true)`/`WITH CHECK(true)` com comando ALL** (escrita irrestrita a `authenticated`): `public.color_synonym_map`, `public.product_qa_image_alerts`, `public.qa_image_coverage_log` (+ `kcer/kcpad_pipeline_insert`, `archive.stock_movements`).
- **Storage**: bucket público `mockup-assets` permite **listar** todos os arquivos (policy "Anyone can view mockup assets").
- **Gate `as any` não confiável**: `check-any-type-baseline.mjs` conta 10 vs baseline 2 — parte é regressão real (`rpc-overrides.ts`, `rest-client.ts` com `: any`) e parte é **falso-positivo** (o detector casa a substring `: any` no nome de variável `anyErr` em `mapRestoreCartError.ts`). Endurecer o regex (`:\s*any\b`, `\bas\s+any\b`) e resolver os casts reais.
- **Arquivos-lixo na raiz do repo público**: `test_hardcoded_key.ts`, `check_external_*.ts`, `whitelist_external_ip.ts`, `clear_external_blocks.ts`, `reset_external_attempts.ts`, `verify-external.ts` — hacks operacionais (whitelist de IP `138.255.213.165`, limpeza de blocks/rate-limit) contra um projeto Supabase **externo** via `EXTERNAL_SUPABASE_SERVICE_ROLE_KEY`. Sem segredo hardcoded, mas expõem IP/infra e não deveriam estar versionados. Mover para runbook privado. (Também vazios/mortos: `_check.ps1`, `CHANGES_SUMMARY.md`, `FINAL_STATUS.md`.)
- **`MockupPromptManager.tsx:77`**: comentário "não está no types" desatualizado — `personalization_techniques` **já está** em `types.ts`; migrar de `untypedFrom` para `supabase.from()` tipado.
- **Dívida congelada**: `.eslint-baseline.json` = **196** erros; `.tsc-baseline.json` = **13** erros TS em 7 arquivos de produção; **163** `eslint-disable` em `src/`+`functions/`. Plano de queima recomendado.
- **CORS `*` inline** em `asia-ingestion` e `product-webhook` (têm auth por cron-secret/HMAC → OK) e `const corsHeaders='*'` morto em `webhook-inbound:23` (remover).

## 🔵 Performance (527 advisories — otimização de banco)

- **25 `auth_rls_initplan`** (re-avalia `auth.<fn>()` por linha): trocar por `(select auth.uid())`. Prioridade em tabelas de tráfego: `product_views`, `quote_history`, `magazines`, `content_articles`, `magazine_public_view_events`.
- **34 `multiple_permissive_policies`**: ~24 concentrados em `kit_component_enrichment_raw`/`kit_component_padronizacao` (mesma dupla replicada em 6 roles) + `magazines` (4 ações) e `product_views` (3 SELECT redundantes). Consolidar.
- **4 `duplicate_index`** (WARN, ação trivial): dropar o redundante em `kit_component_enrichment_raw`/`padronizacao` (`idx_kcer_component` vs `idx_kit_component_enrichment_raw_kit_component_id`, etc.).
- **2 `unindexed_foreign_keys` acionáveis** em `public`: `magazine_templates_template_id_fkey`, `magazines_template_id_fk` (os outros 16 estão em `archive`/`backup`).
- **Higiene de schema (grande volume, baixo risco)**: 40 `no_primary_key` + ~103 `unused_index` fora de `public` são quase todos tabelas `_backup_*`/`_bkp_*`/`cutover_*`/`sfm_*` datadas (jun/2026). **DROP dessas temporárias** limpa dezenas de lints. ⚠️ `backup.xbz_suppliers_cred_bkp_20260605` contém credenciais — remover com atenção. Os 302 `unused_index` em `public` de produção: validar `idx_scan` real antes de dropar (muitos são FKs `idx_fk_*` que convém manter).

---

## Prioridade de execução sugerida
1. **P0-1** — RLS + REVOKE nas partições `magazine_public_view_events_2026_*` (exposição ativa de PII/token).
2. **P1-1** — rotacionar service_role vazada + fechar alerta.
3. **P1-2/P1-3** — REVOKE anon/authenticated em funções DEFINER e converter views para invoker.
4. **P1-4** — tornar E2E/Full CI/Credentials Audit bloqueantes e consertar as 11 falhas.
5. **P1-5/P1-6/P1-7** — sanitizer/URL-allowlist/Math.random; canonizar migrations; fail-closed no webhook.
6. **P2 + performance** — em ondas, começando por `duplicate_index`, `auth_rls_initplan` e DROP das tabelas de backup.
