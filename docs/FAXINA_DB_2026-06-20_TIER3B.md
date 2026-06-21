# Faxina do Banco de Dados — 2026-06-20 · Tier 1c + 3b + 1d (tabelas órfãs + funções mortas em massa)

**Projeto:** `doufsxqlfjyuvxuezpln` (Gestão de Produtos — SSOT de produção)
**Continuação de:** `docs/FAXINA_DB_2026-06-20.md` (Tier 1) e `docs/FAXINA_DB_2026-06-20_TIER3.md` (Tier 3 views + 11 funções).
**Mesma sessão/manifesto/rollback:** `archive._cleanup_manifest` (`session='claude-faxina-2026-06-20'`), `scripts/faxina-rollback.sql`.

---

## 1. Resumo executivo

Esta entrega completa o **Tier 3b** (as ~570 funções "mortas pelo lado do banco" que a fase anterior
deixou para um lote gateado por `.rpc()`) e aproveita o efeito de segunda ordem para limpar mais tabelas.

| Objeto | Antes (início desta sessão) | Depois | Δ |
|---|---|---|---|
| `public` **funções** | 1142 | **676** | **−466** |
| `public` funções `SECURITY DEFINER` | 432¹ | **280** | **−152** |
| `public` **tabelas** | 309 | **298** | **−12 (movidas)²** |
| `archive` funções | 33 | **499** | +466 |
| `archive` tabelas | 77 | **89** | +12 |

¹ valor do inventário inicial (`docs/FAXINA_DB_2026-06-20.md`). ² `analytics_events` foi **preservada**
pelo gate em runtime (recebeu escritas → telemetria viva); 22 candidatas do Tier 1d foram **preservadas**
porque uma view/função viva ainda as referencia.

**Total movido nesta sessão: 478 objetos** (12 tabelas + 466 funções), **100% reversível**
(`ALTER … SET SCHEMA archive`, sem `DROP`), cada um com linha de evidência no manifesto.

> Princípio inalterado: mover um objeto **em uso** para `archive` quebra produção como um `DROP`.
> Nada foi movido sem **prova de morte** por múltiplos sinais independentes.

---

## 2. Metodologia — gates obrigatórios (re-verificados em runtime na própria migration)

### 2a. Funções (Tier 3b) — 6 gates
Uma função só foi arquivada se passou em **todos**:
1. **Não é de extensão** (`pg_depend deptype='e'` = 0).
2. **0 dependentes estruturais** em `pg_depend` (triggers, policies, views, defaults, constraints, colunas geradas).
3. **0 referências no corpo de qualquer outra função `public`** (`pg_proc.prosrc`).
4. **0 referências em comandos de cron** (`cron.job.command`).
5. **0 referências em expressões de RLS policy** + **não é função de trigger anexada** (defesa em profundidade).
6. **0 referências no repositório** — `\b<nome>\b` em `src/ + supabase/functions/ + tests/ + e2e/ + scripts/`,
   **excluindo** `types.ts` gerado (que lista TODA função, viva ou morta).

➡️ O gate #6 é decisivo: 554 funções eram "mortas pelo lado do banco", mas **89** estão **vivas via
`.rpc()`** no frontend/edge (ex.: `has_role`, `search_products_semantic`, `fn_global_search`,
`request_step_up_challenge`, `validate_mcp_key`). Estas foram **preservadas**. Restaram **466** mortas reais.

**Exemplos de duplicidade/resíduo arquivado:** `has_permission` (substituída por `has_role`),
`vault_get_secret/_set/_delete` (substituídas por `get_edge_function_secret`), API antiga de step-up
(`start_step_up_challenge`, `verify_step_up_password`…), `generate_order_number(_v3)`,
`fn_*_v2/_v3` superados, dezenas de `classify_*` legados, helpers de ingestão de fornecedores desativados
(`fn_asia_legacy_*`, `fn_cf_*_legacy_*`, `fn_*_to_silver/_gold` órfãos), `fn_handle_new_user` (trigger removido).

### 2b. Tabelas (Tier 1c + 1d) — gates estruturais + uso + repo
0 escritas em toda a vida do banco (`pg_stat` nunca resetado), não está em `supabase_realtime`,
0 FK de entrada de tabela **ativa**, 0 refs em view/função `public`/cron/policy, 0 refs no repo,
**não é partição** (parent/child). A migration **re-verifica tudo em runtime e pula na menor dúvida**.

---

## 3. O que foi arquivado

- **Tier 1c (5 tabelas):** `attribute_definitions`, `attribute_groups`, `category_target_audiences`,
  `company_email_patterns`, `target_audiences` (subsistema "attributes/target audiences" abandonado;
  os referenciadores remanescentes já estavam em `archive`/`backup`).
  `analytics_events` foi **preservada** (gate de escrita).
- **Tier 3b (466 funções):** ver migration `20260620190500_faxina_tier3b_archive_dead_functions_bulk.sql`
  e manifesto (`evidence->>'phase' = 'tier3b_function'`).
- **Tier 1d (7 tabelas, liberadas após a remoção das funções):** `category_accessory_categories`,
  `classify_functions_registry`, `edge_function_invocations`, `enrichment_log`, `magic_up_reactions`,
  `quote_drafts`, `supplier_customization_options_raw`.

Migrations (espelham o que foi aplicado em produção via MCP):
`20260620190000_faxina_tier1c_archive_orphan_tables.sql`,
`20260620190500_faxina_tier3b_archive_dead_functions_bulk.sql`,
`20260620191000_faxina_tier1d_archive_orphan_tables.sql`.

---

## 4. Verificação pós-execução

- **Integridade:** 0 objetos em `public` (view/matview) referenciando qualquer objeto arquivado nesta sessão ✓
- **RPCs vivas preservadas:** amostra de 15/15 ainda em `public` (`has_role`, `fn_global_search`,
  `search_products_semantic`, `request_step_up_challenge`, `consume_step_up_token`, `validate_mcp_key`,
  `audit_ownership_orphans`, …) ✓
- **Funções de cron preservadas:** 7/7 (`fn_import_stock_xbz`, `fn_pipeline_promote_tick`,
  `fn_aggregate_stock_daily`, `fn_process_asia_stock_pending`, `fn_sm_site_tick`, `fn_cf_recon_dispatch`,
  `fn_sync_product_novelties`) ✓
- **Mortas conhecidas removidas de `public`:** `has_permission`, `convert_quote_to_order`, `vault_get_secret`,
  `is_org_member`, `fn_handle_new_user` → todas em `archive` ✓
- **Tabelas protegidas pelo `CLAUDE.md` intactas:** 8/8 (`products`, `product_variants`, `suppliers`,
  `supplier_products_raw`, `personalization_techniques`, `categories`, `product_images`, `tags`) ✓
- `client.ts` / `validate-supabase-config.mjs` **não tocados** (Gate 0 SSOT verde) ✓

---

## 5. Rollback

Tudo coberto por `scripts/faxina-rollback.sql` (mesma `session='claude-faxina-2026-06-20'`), que restaura
tabelas/views/funções a partir do `archive._cleanup_manifest`. Restauração pontual:
`ALTER TABLE archive.<t> SET SCHEMA public;` · `ALTER FUNCTION archive.<f>(<args>) SET SCHEMA public;`

---

## 6. O que permanece (roadmap)

- **Tier 2** — features "ligadas mas não usadas" (tabelas referenciadas pelo frontend): **decisão de produto**,
  não arquivadas (arquivá-las = remover a feature).
- **Funções vivas via `.rpc()` porém "db-side dead"** (as 89 preservadas): podem incluir features inativas;
  só o time decide aposentá-las.
- **Tier 4** — schema `backup` (42 tabelas), partições vazias `supplier_products_raw_history_p2026_07..10`,
  consolidação de dados duplicados em tabelas canônicas.
- **types.ts** — pode ser regenerado para refletir os objetos arquivados (opcional; sem impacto de runtime,
  pois nada no código referencia os objetos removidos). Não regenerado aqui para manter o PR focado e evitar
  conflito com o fluxo do Lovable.
