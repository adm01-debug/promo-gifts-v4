# Auditoria Exaustiva — 200 commits / Estado Vivo (SSOT + Vercel + GitHub)

**Data:** 2026-06-20
**Escopo solicitado:** análise investigativa dos últimos 200 commits + estado
vivo do banco SSOT `doufsxqlfjyuvxuezpln`, busca exaustiva de falhas/gaps e
correção das que forem **seguras e de alta confiança**.
**Postura de engenharia:** *first, do no harm*. Em banco de **produção**, não se
aplica cegamente a saída de um linter. Cada correção abaixo foi validada como
segura, behavior-preserving e de valor real. Os achados de maior risco estão
documentados com a remediação exata, para PR revisado e dedicado.

---

## 1. Sumário executivo

| Eixo | Resultado |
|---|---|
| **Histórico real** | 126 commits (a janela "200" cobre 100% do repo) |
| **SSOT (REGRA #1)** | ✅ Íntegro. `client.ts` = `doufsxqlfjyuvxuezpln`. **0** referências ao projeto proibido em código executável. **Todos os ~90 cron jobs vivos** apontam para o projeto canônico (o drift do cron `connections-auto-test` já fora corrigido em #983). |
| **Build / Deploy gate** | ✅ `npm run build` (guard + validate + vite) verde em 34 s |
| **TypeScript** | ✅ 0 erros (`tsc -p tsconfig.app.json`) |
| **ESLint baseline** | ✅ 0 erros |
| **REGRA #2 (Product)** | ✅ `price`/`sale_price`/`shortDescription`/`category_id`/`category_name` presentes |
| **REGRA #4 (types.ts)** | ⚠️ **Gap real**: `personalization_techniques` existe no banco mas falta em `types.ts` → 4 call-sites usam `untypedFrom(...)`. Documentado (item 5.A). |
| **DB Security advisors** | 1.500 lints. **4 ERROR `rls_disabled_in_public` CORRIGIDOS**; 78 ERROR `security_definer_view` são by-design (Medallion). |
| **DB Performance advisors** | 369 lints. **`auth_rls_initplan` user-facing CORRIGIDO**; "unindexed FK"/"unused index" majoritariamente falso-positivo (ver 5.C). |

---

## 2. Metodologia

1. Verificação do invariante SSOT (REGRA #1) em código **e no banco vivo**
   (cron jobs + definição de funções via `pg_get_functiondef`).
2. Baseline de qualidade local: `build`, `tsc`, `eslint`, suíte `vitest`.
3. Extração e parsing **integral** dos advisors do Supabase
   (security = 1.438.394 chars / 1.500 lints; performance = 256.124 chars /
   369 lints), categorizados por tipo, nível e objeto afetado.
4. Para cada achado: triagem **risco × valor × reversibilidade** antes de agir.
5. Correções seguras aplicadas em produção via `apply_migration` (idempotentes)
   e espelhadas em `supabase/migrations/`.

---

## 3. O que foi verificado e está SAUDÁVEL

- **REGRA #1 — SSOT:** `CURRENT_PROJECT_ID = "doufsxqlfjyuvxuezpln"`,
  `validateEnv()`/fallback canônico intactos. Scan de `cron.job` (90+ jobs):
  **nenhum** referencia `pqpdolkaeqlyzpdpbizo`. Scan de `pg_proc`
  (`prokind='f'`): **nenhuma** função hardcoda o projeto proibido. As ocorrências
  do ID proibido restantes são só **texto histórico** em migrations/docs/guards.
- **Pipeline de deploy:** build verde; `guard-canonical-project.mjs` e
  `validate-supabase-config.mjs` passam.
- **Tipos do domínio (REGRA #2):** campos críticos do `Product` presentes.

---

## 4. O que foi CORRIGIDO (aplicado em produção + migration)

Migration: `supabase/migrations/20260620110923_security_advisors_remediation_rls_initplan.sql`
(prod `schema_migrations` version `20260620110923`).

### 4.1 🔴→🟢 `category_ancestors` — buraco de DML anônimo (ERROR 0013)
Tabela **viva** do catálogo estava com **RLS desabilitado** e `GRANT` de
`INSERT/UPDATE/DELETE` para `anon`. Um visitante **não autenticado** podia
corromper a árvore de categorias pela Data API. O frontend nunca a lê direto
(confirmado por grep). **Correção:** `ENABLE RLS` + policy `SELECT` pública
(taxonomia é pública) + `REVOKE` de escrita de anon/authenticated. O cron de
repopulação roda como owner → não afetado. **Verificado:** `relrowsecurity=true`.

### 4.2 🔴→🟢 3 tabelas de backup esquecidas em `public.*` (ERROR 0013)
`_backup_stock_daily_summary_20260618` (202k linhas, `authenticated` lia),
`_bkp_kit_dims_20260619` e `_bkp_orphan_active_variants_20260619` (DML anônimo
aberto). **Correção:** `ENABLE RLS` + `REVOKE ALL` de anon/authenticated →
invisíveis na Data API. Dados preservados. *Candidatas a DROP futuro.*

### 4.3 🟡→🟢 `auth_rls_initplan` user-facing (PERF 0003)
`product_views` (2 policies) e `quote_history` (2 policies) reavaliavam
`auth.uid()` por linha. Reescritas para `(SELECT auth.uid())` — **idêntico
em comportamento**, avaliado uma vez por query. **Verificado** via
`pg_get_expr`.

---

## 5. Achados NÃO auto-corrigidos (remediação documentada)

> Critério: cada item abaixo é **arriscado, ambíguo ou de baixo valor** demais
> para aplicação autônoma em produção dentro de uma varredura ampla. Merecem PR
> dedicado e revisado.

### 5.A ⚠️ `types.ts` desatualizado — `personalization_techniques` (REGRA #4)
- **Fato:** `personalization_techniques` é tabela `public` viva, mas **ausente**
  de `src/integrations/supabase/types.ts`. Consequência: `MockupPromptManager.tsx`,
  `useGroupPersonalization.ts`, `usePersonalizationManager.ts`,
  `usePersonalizationData.ts` usam `untypedFrom('personalization_techniques')`.
- **Por que não corrigi agora:** regenerar `types.ts` é a operação **mais
  explicitamente alertada** do repo (REGRA #4 + incidente `158c142`). Feito às
  cegas, pode **dropar** outras tabelas. Exige diff verificado, não cabe numa
  varredura ampla.
- **Remediação (PR dedicado):**
  1. `grep -c "Row:" src/integrations/supabase/types.ts` → anotar (157).
  2. Regenerar (MCP `generate_typescript_types` ou `npx supabase gen types`).
  3. **Diff dos table-keys** old×new: confirmar que `personalization_techniques`
     foi **adicionada** e que **nenhuma** das 157 sumiu (REGRA #4).
  4. Confirmar `products`, `product_variants`, `suppliers` presentes.
     (`supplier_products_raw` é Bronze — `NUNCA ler no frontend` — pode
     legitimamente ficar fora.)
  5. Trocar os 4 `untypedFrom('personalization_techniques')` por `.from(...)`
     tipado. Rodar `tsc` (manter 0 erros).

### 5.B 🟠 `security_definer_view` × 78 (ERROR 0010) — **majoritariamente by-design**
São as views `*_public` do Medallion (Gold) que expõem colunas curadas ao
`anon` (`v_products_public`, `v_variant_sale_prices_public`,
`v_product_images_cdn`, etc.). O linter marca **toda** SECURITY DEFINER view
como ERROR, mas trocar para `security_invoker=on` exige RLS de SELECT nas tabelas
base — que estão (corretamente) bloqueadas — e **quebraria o catálogo público**.
- **Ação:** auditar a lista por **necessidade de exposição** (especialmente views
  operacionais/health: `v_db_health_audit`, `vw_seo_dashboard`,
  `vw_spot_price_alerts`, `v_n8n_sync_errors`). Para as não-públicas, `REVOKE
  SELECT FROM anon, authenticated`. As `*_public` devem permanecer.

### 5.C 🟢 "Unindexed FK" × 131 / "Unused index" × 168 — **não criar/dropar às cegas**
Análise PhD: das 131 "FK sem índice", a esmagadora maioria é **falso-positivo**
ou irrelevante:
- ~17 em `archive.*`/`backup.*` (dropar as tabelas, não indexar).
- Tabelas-alvo **minúsculas** (`quotes`=9, `order_items`=0, `markup_configurations`=2,
  `b2b_collections`=7…): Postgres faz **seqscan** de qualquer forma; índice só
  adiciona custo de escrita.
- `product_images` (72k linhas) **já tem** índice em `product_id`, `variant_id`,
  `color_id`, `image_type_id`, `canonical_image_id` (parciais/compostos que o
  linter ignora). Único FK realmente sem índice: `organization_id` —
  baixa cardinalidade, **não vale**.
- **Conclusão: criar índices novos seria net-negativo** (write-amplification numa
  tabela quente de 146 MB sem ganho de leitura). **Nenhum índice criado.**
- "Unused index" (168): ~81 em schemas não-prod (dropar livre, fora de escopo
  desta sessão); nos `public` quentes, validar contra features futuras antes de
  dropar (um índice pode parecer "unused" por estatística jovem/sazonalidade).

### 5.D 🟠 `rls_policy_always_true` × 6 (WARN 0024)
Policies de escrita com `WITH CHECK (true)`:
`color_synonym_map`, `product_qa_image_alerts`, `qa_image_coverage_log`
(ALL/authenticated), `kit_component_enrichment_raw`/`kit_component_padronizacao`
(INSERT, sem papel explícito), `archive.stock_movements`.
- **Por que não corrigi:** podem ser intencionais (ferramentas internas/pipeline).
  Restringir sem conhecer o modelo de acesso quebra tooling.
- **Remediação:** substituir `true` por predicado de papel
  (ex.: `is_coord_or_above((SELECT auth.uid()))` ou role de serviço).

### 5.E 🟠 SECURITY DEFINER RPC executável por anon (×46) / authenticated (×264)
Inclui superfície sensível: `submit_quote_response(_token,...)`,
`get_quote_token_by_value(_token)`, `check_login_rate_limit`,
`fn_check_login_allowed`. Muitos são chamados **legitimamente** pelo frontend.
- **Remediação por-função:** confirmar caller pretendido; senão `REVOKE EXECUTE`
  de anon/authenticated ou migrar para `SECURITY INVOKER`. O repo já tem
  `fn_auto_revoke_secdef_public_execute` — usar/estender essa automação.

### 5.F 🟡 `function_search_path_mutable` × 53 (WARN 0011)
Hardening contra search-path injection (relevante em SECURITY DEFINER).
- **Remediação:** `ALTER FUNCTION ... SET search_path = public, pg_temp;` em
  lote, validando que nenhuma resolve objetos fora de `public` por search_path
  herdado. Fazer em "onda" testada (padrão já existente no repo).

### 5.G 🟡 Outros
- `multiple_permissive_policies` × 29 (24 em `kit_component_*`): consolidar
  policies sobrepostas por ação reduz ~24 lints.
- `public_bucket_allows_listing` (`mockup-assets`): restringir o `SELECT` amplo
  em `storage.objects` (URL pública não precisa de listing).
- `materialized_view_in_api` (`mv_product_leaf_category`): revogar acesso de API
  se não-intencional.
- `rls_enabled_no_policy` × 26: maioria em `archive/backup/cf_recon` — confirmar
  lockdown intencional.
- **Housekeeping de alto impacto:** ~24% de todos os lints vêm de
  `archive.*`/`backup.*`/`_bkp_*`/`*_deprecated_*`/partições `*_history_p2026_*`.
  Remover essas tabelas dos schemas expostos limparia ~1/4 do ruído de uma vez.

---

## 6. Inventário dos advisors (referência)

**Security (1.500):** `pg_graphql_authenticated_table_exposed` 564 · `pg_graphql_anon_table_exposed` 457 · `authenticated_security_definer_function_executable` 264 · **`security_definer_view` 78 (ERROR)** · `function_search_path_mutable` 53 · `anon_security_definer_function_executable` 46 · `rls_enabled_no_policy` 26 · `rls_policy_always_true` 6 · **`rls_disabled_in_public` 4 (ERROR — CORRIGIDO)** · `materialized_view_in_api` 1 · `public_bucket_allows_listing` 1.

**Performance (369):** `unused_index` 168 · `unindexed_foreign_keys` 131 · `no_primary_key` 31 · `multiple_permissive_policies` 29 · **`auth_rls_initplan` 9 (user-facing CORRIGIDO)** · `auth_db_connections_absolute` 1.

Remediação base de cada lint: `https://supabase.com/docs/guides/database/database-linter?lint=<código>`.

---

## 7. Próximos passos priorizados

1. **(P1)** PR dedicado para `types.ts` (item 5.A) — remove dívida de tipo e os `untypedFrom`.
2. **(P1)** Revisar exposição `anon` das 78 SECURITY DEFINER views não-públicas (5.B).
3. **(P2)** Onda de `function_search_path_mutable` (5.F) e revogação de EXECUTE secdef (5.E).
4. **(P3)** Housekeeping: dropar/realocar tabelas `archive/backup/_bkp` dos schemas expostos (5.G).
5. **(P3)** Trocar estratégia de conexão do Auth para percentual antes do próximo resize de instância.
