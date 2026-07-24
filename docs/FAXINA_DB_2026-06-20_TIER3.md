# Faxina do Banco de Dados — 2026-06-20 · Tier 3 (views + funções)

**Projeto:** `doufsxqlfjyuvxuezpln` · Continuação de `docs/FAXINA_DB_2026-06-20.md` (Tier 1, já mergeado).
**Decisão do usuário:** prosseguir com "Tier 3 seguro" + confirmou **sem consumidores externos** ao
repositório (logo, referências no código = prova completa de uso).

---

## 1. O que foi arquivado nesta fase

| Tipo | Qtd | Antes → Depois (public) |
|---|---|---|
| Views | **113** | 171 → **58** |
| Funções | **11** | 1170 → **1159** |

**Total acumulado da faxina (Tier 1 + Tier 3): 149 objetos** movidos para `archive`, todos
registrados em `archive._cleanup_manifest` e **100% reversíveis** (`scripts/faxina-rollback.sql`).

### Views (113)
Recomputadas e movidas via `ALTER VIEW … SET SCHEMA archive` com os gates:
0 views dependentes · 0 refs em funções · 0 refs em crons · 0 refs em políticas RLS ·
0 refs no código (`.ts/.tsx/.js/.mjs` em src/edge/tests/e2e/scripts) · **nunca** uma view `*_public`
(reservadas para exposição via PostgREST). Ex.: dashboards/monitor obsoletos (`v_db_health_*`,
`v_blurhash_*`, `vw_asia_products_*`, `vw_xbz_*`, `vw_somarcas_*`, `v_media_statistics`, etc.).

### Funções (11) — conjunto estreito e de alta confiança
`fn_silver_to_gold__deprecated_20260606`, `fn_silver_batch_to_gold__deprecated_20260606`,
`debug_automations`, `debug_link_material`, `fn_test_dimension_parsers`, `fn_test_guc_visibility`,
`test_classify_batch`, `fn_dryrun_raw_v2`, `fn_dryrun_standardize_supplier`,
`fn_ingest_asia_hg_batch_debug`, `fn_ingest_asia_hg_debug_sample`.
O repo-gate **excluiu corretamente** `e2e_cleanup_check_rate_limit`, `seed_discount_test_users` e
`cleanup_discount_test_data` (usadas por edge/tests).

---

## 2. Descoberta importante sobre FUNÇÕES (por que paramos em 11)

A análise estrutural encontrou **583 funções "mortas pelo lado do banco"** (0 refs em outras
funções, crons, triggers, policies, views e defaults). **Porém**, validação direcionada provou que
funções como `has_permission`, `is_org_member`, `get_category_tree`, `search_products_fulltext`,
`mark_notification_read` têm **0 refs no banco** mas são chamadas pelo **frontend via `.rpc()`** —
ou seja, estão **vivas**. Arquivá-las em massa quebraria RPCs de produção.

➡️ **Conclusão:** funções exigem um **gate adicional obrigatório** (`.rpc('nome')` + strings no
código) antes de arquivar. Por isso movemos apenas o resíduo inequívoco (deprecated/debug/test).

### Próximo lote sugerido (Tier 3b — funções)
Pipeline para as ~570 restantes, **em lotes pequenos e revisáveis**:
1. Extrair o conjunto de `*.rpc('…')` usados em `src/` + `supabase/functions/`.
2. `mortas_db` − `rpc_usadas_no_repo` − `strings_no_repo` = candidatas reais.
3. Priorizar duplicatas versionadas (`*_v2` com `_v3` existente), `classify_*` legadas, helpers de
   ingestão de fornecedores desativados. Arquivar em lotes com `manifest` + verificação pós-lote.

---

## 3. Roadmap restante (inalterado, fora deste PR)
- **Tier 2** — features "ligadas mas não usadas" (decisão de produto).
- **Tier 3b** — ~570 funções DB-side-dead (com repo `.rpc()` gate, em lotes).
- **Tier 4** — schema `backup` (42 tabelas), partições vazias, consolidação de duplicatas.

## 4. Verificação
- `public`: **309 tabelas · 58 views · 1159 funções** (era 334 · 171 · 1170).
- Amostra de RPCs vivas preservadas: `has_permission`, `is_org_member`, `get_category_tree`,
  `convert_quote_to_order` → **4/4 em public** ✓
- Amostra de views `*_public`/keep preservadas → **7/7 em public** ✓
- `client.ts` intacto (Gate 0 SSOT verde).

## 5. Rollback
`scripts/faxina-rollback.sql` restaura tabelas, views e funções da sessão a partir do manifesto
(`archive._cleanup_manifest`, `session = 'claude-faxina-2026-06-20'`).
