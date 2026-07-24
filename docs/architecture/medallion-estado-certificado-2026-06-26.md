# Medallion (Bronze → Prata → Ouro) — Estado Certificado 2026-06-26

> **Fonte de verdade do catálogo de produtos.** Documento datado e auditado.
> Banco autoritativo: projeto Supabase `doufsxqlfjyuvxuezpln` (conector **SUPABASE - GESTÃO DE PRODUTOS**).
> Este documento **substitui/atualiza** descrições divergentes em `medallion/PIPELINE_COMPLETO.md`
> e no fluxo descrito em `docs/suppliers/README.md` (ver seção "Documentos obsoletos").

---

## 1. Modelo real das 3 camadas

| Camada | Tabela(s) | Conteúdo | Status (enum) |
|---|---|---|---|
| **Bronze** | `supplier_products_raw` | Payload cru por fornecedor (1 linha por referência) | `pending` → `processed` / `skipped` / `quarantined` |
| **Prata** | `produtos_padronizacao` (pais) + `produtos_padronizacao_variantes` (variantes) | Registro padronizado/normalizado, ainda não soberano | `standardized` → `promoted` |
| **Ouro** | `products` + `product_variants` | Catálogo soberano servido ao site (respeita `locked_fields`) | `is_active` (NOT NULL) |

> ⚠️ **NÃO existem** `silver_products` / `silver_variants` nem `fn_silver_to_gold`.
> A camada Prata é `produtos_padronizacao(_variantes)`. Qualquer doc que cite `silver_products` está obsoleto.

### Funções por etapa (verificadas em `pg_proc`, 2026-06-26)

**Bronze → Prata (standardize):**
`fn_standardize_supplier(p_supplier_id, p_limit)` · `fn_standardize_raw(p_raw_id, ...)` ·
`fn_standardize_parent(...)` · `fn_standardize_variant(p_raw_id)` · `fn_standardize_kit_component(p_raw_id)`

**Prata → Ouro (promote, MERGE soberano respeitando `products.locked_fields`):**
`fn_promote_supplier(p_supplier_id, p_limit)` · `fn_promote_padronizacao(p_id)` (insere no Ouro) ·
`fn_promote_variants_of_parent(p_supplier_id, p_parent_reference)` · `fn_promote_kit_component_padronizacao(p_pad_id)`

**Escritor único do Ouro:** `insert_or_update_product(p_supplier_id, p_supplier_reference, p_product_data, p_organization_id)`.

**Classificação de categoria:** é **trigger-driven** em `products`
(`trg_auto_classify_product`/`fn_trigger_auto_classify_product`, `trg_classify_packing`, `trg_auto_classify_kit`),
não mais um cron batch.

**Depreciada:** `fn_silver_to_gold__deprecated_20260606` (não usar).

**Caminho "site" (fornecedores raspados, paralelo ao de API):**
`fn_site_promote_to_gold(...)`, `fn_asia_site_promote_to_gold(...)`, `fn_sm_site_promote(...)`.

---

## 2. Orquestração (pg_cron) — estado pós-M6

| jobid | jobname | schedule | chama | papel |
|---|---|---|---|---|
| **273** | process-pending-products | `*/5` | `fn_cron_safe_run(88, 'SELECT public.process_pending_batches();', …)` | standardize+promote por fornecedor com `auto_sync`, **+ Fase 9** (promove variantes órfãs cujo pai já está `promoted`) |
| **275** | medallion-promote-tick | `*/10` | `fn_cron_safe_run(59, 'SELECT public.fn_pipeline_promote_tick(300);', …)` | tick canônico: advisory lock próprio + respeita `pipeline_control.promote_tick` + grava `pipeline_run_log` |
| 274 | pipeline-classify-categories | — | **DESABILITADO** | alvo `fn_pipeline_classify_pending_products` foi removido; classificação virou trigger-driven |
| 217 | process-queue | `*/10` | edge function `/functions/v1/process-queue` | orquestrador externo complementar |
| 277 / 265 / 58 | xbz / spot / asia stock-sync | `*/15`–`*/15` | `fn_xbz_stock_fast_sync_v3` · `fn_spot_stock_fast_sync` · `fn_process_asia_stock_pending` | atualiza estoque/preço de produtos **existentes** |
| 266 | xbz-enrich-gold-extractors | `*/10` | `fn_xbz_enrich_gold_extractors` | enriquecimento pós-promoção |
| 90 / 85 | medallion-coverage / reconcile-stock-gold | diário | `fn_snapshot_medallion_coverage` · `fn_reconcile_stock_gold` | observabilidade/reconciliação |

> **`fn_cron_safe_run(p_key, p_sql, p_timeout_ms, p_label)`**: wrapper com advisory lock + `statement_timeout`.
> **Atenção**: ele **captura e engole** exceções (inclusive `42883 function does not exist`) retornando texto.
> Logo um cron pode aparecer `succeeded` mesmo com a função interna falhando — ver M6 e o alerta de stall.

---

## 3. Melhorias aplicadas (M1–M6) — todas com prova

- **M1 — Cascas mortas removidas.** `DROP` de `product_seo` e `product_ai` (backups `_archive_product_seo_20260626` / `_archive_product_ai_20260626`, 6.610 linhas cada).
- **M2 — Decisão de dual-write documentada.** Mantidas (com razão registrada em comentário de tabela): `product_packaging` (fonte SILVER lida por `fn_promote_packaging_to_gold`), `product_physical` (buffer WRITE-ONLY sincronizado por `trg_sync_product_physical`), `supplier_price_tiers` (fonte de precificação lida por `get_variant_price`).
- **M3 — Frescor de preço XBZ honesto.** `fn_import_stock_xbz` PASSO 4 passou a gravar `price_last_verified_at = now()` (ao lado de `price_verified_at`); backfill de 224 produtos XBZ falsamente "stale". `fix_version = price_freshness_honest_v1`. Resultado: badge `is_price_stale` correto, auto-curável pelo cron `xbz-stock-sync`.
- **M4 — Guarda anti-drift de schema (bot Lovable).** `fn_check_schema_signature_drift` (`fix_version schema_drift_local_guard_v3`) + baseline `certified_baseline_20260626` + cron jobid 245 (`11 2 * * *`) + alerta `SCHEMA_DRIFT_DETECTED` em `v_system_alerts`.
- **M5 — Este documento** (consolidação + aposentadoria de docs divergentes).
- **M6 — Restauração do subsistema de promoção (halt silencioso).** Ver seção 4.

---

## 4. M6 em detalhe — o halt silencioso do medallion

**Sintoma:** `products.created_at` congelado em 2026-06-20 (6 dias sem produto novo), 98 raws Bronze `pending` acumulados desde 23/06, 2 pais + 8 variantes Prata `standardized` órfãos.

**Causa-raiz:** em ~2026-06-23 18:36 três funções foram renomeadas/removidas, mas os **comandos dos crons não foram atualizados**:

| cron chamava (inexistente) | função real |
|---|---|
| `fn_medallion_promote_tick()` | `fn_pipeline_promote_tick(integer)` |
| `fn_process_pending_products()` | `process_pending_batches()` |
| `fn_pipeline_classify_pending_products(integer)` | *(removida — classificação virou trigger)* |

Como `fn_cron_safe_run` engole `42883`, os jobs reportavam `succeeded / "1 row"` mascarando o halt.

**Correção (migration `m6_restore_medallion_promotion_crons_repoint_20260626`):**
repoint de 273 → `process_pending_batches()`, 275 → `fn_pipeline_promote_tick(300)`, e **desativação** de 274 (obsoleto).

**Prova (dry-run `BEGIN…ROLLBACK` + execução real):** Bronze 98→0, órfãos 10→0, **+22 produtos** criados (`products` 7.586→7.608), `erros=0`. Confirmado que o **próprio cron** voltou a logar `promote_tick status=ok erros=0` em `pipeline_run_log`.

**Blindagem (migration `m6_add_silver_promote_stalled_alert_20260626`):** novo alerta **`SILVER_PROMOTE_STALLED`** em `v_system_alerts` — dispara quando há pais `standardized` há >2h **ou** variantes órfãs cujo pai já está `promoted` (o sinal exato que ficou 3 dias invisível). O `IMPORT_STALLED` preexistente só cobre o Bronze.

---

## 5. Resíduos conhecidos (não bloqueiam)

- `SUPPLIER_SYNC_STALE` para XBZ pode oscilar ~4h: `suppliers.last_full_sync_at` é carimbado pelo full-import (`fn_import_stock_xbz`), não pelo fast-sync. Polimento futuro: estender o heartbeat ao caminho de fast-sync.
- `STOCK_CRITICAL_LOW` (~3,7k variantes estoque zero): normal para catálogo B2B.
- 460 variantes órfãs sem foto de fornecedor (irredutível — sem imagem de origem).
- `supplier_settings`: 5 linhas (4 com `auto_sync_enabled`) — necessário para os orquestradores iterarem fornecedores.

---

## 6. Anti-regressão (bot Lovable `gpt-engineer-app[bot]`)

O bot reescreve funções críticas removendo `SET search_path` e renomeia funções sem atualizar crons. **Após qualquer merge do bot, reverificar:**

1. Comandos dos crons 273/275 ainda apontam para `process_pending_batches()` / `fn_pipeline_promote_tick(300)` (e **não** para `fn_medallion_promote_tick`/`fn_process_pending_products`).
2. `v_system_alerts` ainda contém as CTEs `schema_drift` e `silver_promote_stalled`.
3. Funções `SECURITY DEFINER` mantêm `SET search_path`.
4. `v_system_alerts` sem `CRITICAL`; `SILVER_PROMOTE_STALLED`/`IMPORT_STALLED`/`SCHEMA_DRIFT_DETECTED` silenciosos.

---

## 7. Documentos obsoletos (substituídos por este)

- `medallion/PIPELINE_COMPLETO.md` — descreve `silver_products`/`fn_silver_to_gold`, que **não existem**.
- `docs/suppliers/README.md` (seção de fluxo) — descreve `fn_process_staged_product`/`fn_process_raw_v2 → products` sem a camada `produtos_padronizacao`.
- Mapas dispersos de pipeline por fornecedor (project-knowledge): úteis para a **camada de ingestão**, mas a topologia canônica Bronze→Prata→Ouro é a deste documento.
