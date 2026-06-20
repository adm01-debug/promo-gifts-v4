# Faxina do Banco de Dados — 2026-06-20 · Tier 3b (funções + views, lote 1)

**Projeto:** `doufsxqlfjyuvxuezpln` (Gestão de Produtos — SSOT de produção)
**Continuação de:** `FAXINA_DB_2026-06-20.md` (Tier 1) e `FAXINA_DB_2026-06-20_TIER3.md` (Tier 3).
**Migration:** `supabase/migrations/20260620190000_faxina_tier3b_b1_archive_dead_fns_views.sql`
**Reversão:** `scripts/faxina-rollback.sql` (dirigida por `archive._cleanup_manifest`).

---

## 1. O que foi arquivado neste lote (11 objetos)

| Tipo | Qtd | public antes → depois |
|---|---|---|
| Funções | **8** | 676 → **668** |
| Views | **3** | 58 → **55** |

**Funções (8):** `fn_simular_combo_gravacao_v10`, `fn_simular_combo_gravacao_v11`
(superadas por `_v12`, que permanece viva no public), `classify_headphone`,
`classify_powerbank`, `classify_speaker` (classificadores legados, superados pelo cron
`pipeline-classify-categories` → `fn_backfill_product_categories`),
`fn_asia_legacy_dispatch_batch`, `fn_asia_legacy_harvest_batch`, `fn_asia_wp_to_canonical`
(caminho de ingestão Asia legado, superado pelo edge fn `asia-ingestion` + crons atuais).

**Views (3):** `v_audit_paradoxos_gravacao`, `v_product_videos_ready`, `vw_color_mapping`
(views internas órfãs; nenhuma `*_public`).

> Verificação pós-move: `v_products_public`, `v_variant_sale_prices_public`, `products` e a
> base `fn_simular_combo_gravacao` continuam no `public`; os objetos movidos resolvem `NULL`
> em `public` e existem em `archive`. **Zero dano colateral.**

### Lote 2 (migration `20260620191500_…b2_archive_legacy_supplier_fns.sql`) — +19 funções

Helpers legados de ingestão/fornecedor (DB-orphan + code-absent, corpos confirmados como
wrappers órfãos ou versões superadas). `public` funções **668 → 649**.

`fn_ingest_asia_api_batch`, `fn_ingest_asia_product`, `fn_classify_spot_image`,
`fn_spot_process_batch`, `comparar_precos_spot`, `fn_resolve_supplier`,
`fn_color_link_all_suppliers`, `fn_tag_product_complete`, `fn_import_product_properties`,
`extract_xbz_image_metadata`, `fn_get_asia_api_key`, `fn_get_asia_secret_key`,
`fn_get_cf_credentials`, `fn_extract_color_from_name`, `fn_extract_material_from_name`,
`fn_recomendar_tecnica`, `fn_list_deactivation_requests`, `create_material_with_equivalence`,
`fn_expire_novelties` (superada por `fn_expire_novelties_with_stats`).

Sucessores vivos preservados: `fn_process_asia_stock_pending`, `fn_spot_stock_fast_sync`,
`fn_apply_auto_tag_rules`, edge fn `asia-ingestion`, `materials-api`.

**Acumulado Tier 3b (lotes 1+2): 30 objetos** (27 funções + 3 views). `public`: 300 tabelas ·
55 views · **649 funções**.

---

## 2. Metodologia (6 gates — endurecida vs. Tier 3)

Reproduzimos os 5 gates do Tier 3 e **fechamos uma falha de detecção** que o lote anterior
não cobria explicitamente para funções:

1. **Estrutural / DB-orphan** — 0 refs em: corpos de função (`pg_proc.prosrc`), defs de
   views/matviews, `cron.job.command`, **`pg_policies` (qual + with_check)**,
   **defaults (`pg_attrdef`, inclui colunas geradas)**, **constraints (`pg_get_constraintdef`)**,
   **índices (`pg_get_indexdef`)** e triggers (`pg_trigger`).
   → *Sem este gate, helpers de RLS como `has_org_role`, `user_belongs_to_org`,
   `is_org_owner_or_admin` apareciam como "órfãos" e sua remoção quebraria o RLS.*
2. **code-absent** — 0 ocorrências como string em `src/`, `supabase/functions/`, `tests/`,
   `e2e/`, `scripts/` (ignorando apenas `supabase/migrations/`, `types.ts`, `*.md`).
   Usuário confirmou **sem consumidores externos** → code-absent = prova completa.
3. **Perfil de resíduo inequívoco** — versionado-superado / legacy / classify / view interna.
4. **Sem overload vivo** — cada nome tem 1 overload, todos cobertos pelo gate 1.
5. **Não-`*_public`** — views `*_public` nunca são movidas (superfície PostgREST).
6. **Reversível + manifesto** — `ALTER … SET SCHEMA archive`, registrado objeto-a-objeto.

### Armadilhas reais encontradas (e evitadas)
- **`n_live_tup` mente em tabelas particionadas:** `supplier_products_raw_history` reportava
  `0 linhas / 0 bytes` mas tem **215.889 linhas** (pai de partição mensal, escrito por trigger
  + cron de purga). Teria sido um falso-positivo catastrófico.
- **`organization_members`** reportava 0 scans (acesso via funções SECURITY DEFINER) mas é
  tabela multi-tenant viva (17 linhas, RLS, 4 policies, 64 arquivos no repo).
- **`fn_spot_reconcile_variant_to_legacy`** (nome "legacy") tinha `db_refs=1` → **excluído**.
- **Bug de método no `ripgrep`:** `--glob '!x' '!y'` (espaço) falha silenciosamente e faz
  *tudo* parecer code-absent. Forma correta: `--glob='!x'`. Todos os candidatos foram
  re-verificados com a forma correta.
- **`track_functions = 'none'`:** não há contagem de chamadas em runtime para funções —
  por isso o gate `code-absent` (com "sem consumidores externos") é o sinal decisivo.

---

## 3. Estado atual do `public` (pós-lote)

`public`: **300 tabelas · 55 views · 668 funções.**
Inventário completo do banco (para contexto): `archive` (89→100+ objetos), `backup` (42 tabelas),
`supplier_stricker` (17), `cf_recon`, `prod_audit`, `analytics` (7 MV), além de **102 crons
ativos** e **~98 edge functions** (todos preservados — são a espinha dorsal do pipeline Medallion).

---

## 4. Pool de candidatos para os próximos lotes (NÃO movidos — requerem 1 verificação extra)

Conjunto DB-orphan **e** code-absent restante (após este lote), a tratar em lotes pequenos com
verificação pós-lote. Antes de mover cada um: confirmar que não é chamado dinamicamente por uma
função viva (`EXECUTE format(... %I ...)`) e que existe um sucessor vivo.

- **Helpers de ingestão de fornecedores (legado):** `fn_ingest_asia_api_batch`,
  `fn_ingest_asia_product`, `fn_classify_spot_image`, `fn_spot_process_batch`,
  `comparar_precos_spot`, `fn_resolve_supplier`, `fn_color_link_all_suppliers`,
  `fn_tag_product_complete`, `fn_import_product_properties`, `extract_xbz_image_metadata`.
- **Secret-fetchers (verificar pipeline ativo antes):** `fn_get_asia_api_key`,
  `fn_get_asia_secret_key`, `fn_get_cf_credentials`.
- **Optimization queue (feature possivelmente desativada):** `claim_next_optimization`,
  `complete_optimization`, `enqueue_optimization`, `reset_optimization_queue`.
- **Outros DB-orphan + code-absent** (~100): revisar por subsistema (step-up, telemetria,
  rate-limit legados, etc.). Lista completa reproduzível com a query do gate 1 + repo-gate.

### Sub-lote pré-verificado code-absent (batch B — 15 nomes) — confirmar corpo/sucessor antes de mover
`generate_variant_sku`, `get_cost_for_quantity`, `get_sale_price_for_quantity`, `get_variant_price`
(provável: cálculo migrou para a view `v_variant_sale_prices_public` — **confirmar**),
`insert_supplier_product_raw`, `upsert_supplier_customization_raw`, `upsert_supplier_stock_raw`
(helpers de bronze — provável sucessor no pipeline atual),
`log_login_attempt` (provável: superado pelo **edge fn** `log-login-attempt`),
`log_step_up_audit`, `log_voice_command`, `mcp_audit_actor`, `mcp_audit_violation`,
`step_up_user_settings_get`, `step_up_user_settings_set`, `user_can_skip_step_up`.
> ⚠️ Apesar de DB-orphan + code-absent, vários "soam" críticos (preço/auth). Regra CLAUDE.md:
> não classificar como morto sem verificar. Mover só após ler o corpo e confirmar sucessor vivo.

### Fora de escopo (decisão de produto / risco) — **mantidos**
- **Tier 2:** tabelas vazias mas referenciadas pelo frontend (features "ligadas, não usadas").
- **`*_public` views** code-absent (ex.: `v_tags_public`, `v_product_properties_public`) —
  superfície de API; só remover com confirmação de que nenhum cliente PostgREST as consome.
- **`backup` schema (42 tabelas)** — Tier 4 (decisão DROP vs. manter como arquivo morto).

---

## 5. Rollback

```sql
\i scripts/faxina-rollback.sql   -- restaura tudo desta sessão a partir do manifesto
-- ou, individual:
ALTER FUNCTION archive.classify_speaker(text) SET SCHEMA public;
ALTER VIEW     archive.vw_color_mapping        SET SCHEMA public;
```
