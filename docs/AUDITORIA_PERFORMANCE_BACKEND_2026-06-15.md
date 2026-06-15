# Auditoria & Estabilização de Performance do Backend — 2026-06-15

**Sintoma de entrada:** banner laranja *"Backend instável — algumas operações podem falhar momentaneamente"* + lentidão geral no app.
**Instância:** Supabase `doufsxqlfjyuvxuezpln` (Postgres 17.6, plano Small, ~`max_connections=90`).
**Escopo:** diagnóstico de causa-raiz + correções de banco (não-destrutivas/reversíveis) + 1 PR de frontend.
**Resultado:** causa-raiz tratada; banner deve cessar. 2 decisões de alto impacto (disco e semântica de escrita) ficam **explicitamente para o Joaquim** — documentadas abaixo com SQL e trade-off.

---

## 1. TL;DR

A lentidão **não** estava na leitura do catálogo pelo usuário (vitrine lê de `analytics.mv_product_cards`, matview com refresh CONCURRENTLY a cada 30 min — rápido e isolado). A causa era **saturação intermitente da instância** pelo pipeline de ingestão: ~80 cron jobs disparando juntos no minuto `:00` + a tabela Bronze `supplier_products_raw` em **76% de bloat** sob upsert concorrente (1.353 ms/linha de contenção), agravada por uma publicação realtime com 9,9M escritas/0 assinantes e por um loop de re-sondagem do próprio banner no frontend.

O banner é honesto: vem de 3 sondas (auth/bridge/rest, timeout 5s) e só acende em `degraded` quando **auth + rest** falham juntas — sinal real de saturação.

---

## 2. Diagnóstico (causa-raiz)

| Vetor | Evidência | Impacto |
|---|---|---|
| **Herd de cron no `:00`** | ~80 jobs com schedules `*/2`, `*/5`, `*/10`, `*/15` coincidindo no minuto cheio | Picos de concorrência que estouram conexões/CPU |
| **Bronze `supplier_products_raw` em bloat** | 563 MB p/ 18,5k linhas vivas + 59,7k mortas (76%); upsert `ON CONFLICT` a 1.353 ms/linha (min 0,6 / max 29s / stddev 1.370 — assinatura de contenção, não de lentidão estrutural) | Era ~20× o custo do realtime; gargalo dominante |
| **Realtime sem consumidor** | `variant_supplier_sources` na publicação `supabase_realtime`: 9,9M escritas, 0 assinantes | ~18% do tempo de banco desperdiçado |
| **Loop de re-sondagem do banner** | `useCloudStatus` re-sondava a cada 5/10/15s com `force=true` (ignora cache de 15s) | Carga auto-infligida multiplicada por aba aberta durante o pico |
| **Triggers caros sem guarda** | snapshot de estoque (~1,37M invocações/dia) e history da raw (~346k/dia) disparando e no-opando | CPU inline desperdiçada |

**Vitrine confirmada isolada:** matviews reais vivem em `analytics` (`mv_product_cards`, `mv_product_intelligence`, `mv_stock_velocity`, etc.). A `pingHealth()` da bridge é stub (`ok=true`) desde a aposentadoria da bridge (PRs #230-232).

---

## 3. Correções aplicadas (todas verificadas ao vivo)

> Padrão de segurança em toda mutação: capturar definição atual → simular/provar equivalência → checar escritores ativos (`pg_stat_activity`) → executar 1 statement (autocommit) → verificar resultado. Nada destrutivo sem prova dupla.

| # | Ação | Ganho | Status | Rollback |
|---|---|---|---|---|
| 1 | `ALTER PUBLICATION supabase_realtime DROP TABLE public.variant_supplier_sources` | −~18% tempo de banco | ✅ vivo (10 tabelas restantes, VSS ausente) | `ALTER PUBLICATION supabase_realtime ADD TABLE variant_supplier_sources;` |
| 2 | `fn_cron_guard(bigint,text)` (advisory xact lock, pula tick se anterior rodando) + reagendamento escalonado de 9 jobs p/ minutos fora do `:00` | Elimina o herd das `:00` | ✅ vivo (schedules escalonados; guard no job 54) | Restaurar schedules originais: 54 `*/15`, 55 `*/10`, 56 `*/2`, 59 `*/10`, 63 `*/5`, 76 `*/2`, 77 `*/5`, 78 `*/2`, 88 `*/5` |
| 3 | `DROP INDEX CONCURRENTLY` de 8 índices frios em `products` | 60→45 MB de índices; menos overhead de escrita | ✅ vivo (53 índices/45 MB) | Recriar c/ `CREATE INDEX CONCURRENTLY` (defs no transcript da sessão; eram GIN `jsonb_path_ops` e btree parciais) |
| 4 | PR #751 — `useCloudStatus` `DEGRADED_BACKOFF` `[5s,10s,15s]`→`[20s,40s,60s]` | ~4× menos carga de re-sondagem | ✅ **merged** (`6da817a8`) | Reverter o PR |
| 5 | Autovacuum agressivo (`scale_factor=0.05`, `threshold=50`) + `VACUUM ANALYZE` em 4 tabelas churny (`product_properties`, `product_kit_components`, `stock_daily_summary`, `product_customization_prices`) | 16-19%→0% mortos | ✅ vivo | `ALTER TABLE ... RESET (...)` |
| 6 | `WHEN` guard no trigger de snapshot de estoque (espelha guard interno) | evita ~1,37M invocações/dia | ✅ vivo (`trg_capture_stock_snapshot` com WHEN) | Recriar trigger sem `WHEN` |
| 7 | `WHEN (NEW.content_hash IS DISTINCT FROM OLD.content_hash)` em `trg_spr_history` | evita ~346k disparos/dia no-op | ✅ vivo | `CREATE TRIGGER trg_spr_history AFTER UPDATE ON supplier_products_raw FOR EACH ROW EXECUTE FUNCTION fn_spr_history();` |
| 8 | `WHEN (NEW.supplier_id = <XBZ>)` em `trg_xbz_propagate_site_to_silver` (já `AFTER UPDATE OF site_status`) | guarda de defesa | ✅ vivo | Recriar sem `WHEN`, mantendo `OF site_status` |
| 9 | `DROP INDEX CONCURRENTLY idx_supplier_products_raw_import_batch_id` (3,4 MB, 17 scans/7d) | índice frio removido | ✅ vivo | `CREATE INDEX CONCURRENTLY idx_supplier_products_raw_import_batch_id ON public.supplier_products_raw (import_batch_id);` |
| 10 | `VACUUM (FULL, ANALYZE) supplier_products_raw` (0 escritores; `lock_timeout` curto nos clientes; fora da vitrine) | **559 → 69 MB (−88%)** | ✅ vivo (69 MB, 1 morto) | n/a (reclaim de espaço; não reversível nem necessário reverter) |
| C | `VACUUM (FULL, ANALYZE) supplier_customization_options_raw` | 68 → 65 MB | ✅ executado | n/a |

### Nota sobre o item C (premissa corrigida)
A tabela **não estava vazia** como uma leitura de `pg_stat` (estimativa `n_live_tup=0`, nunca analisada) sugeria — tem **35.832 linhas reais** (heap 60 MB legítimo). O VACUUM FULL foi inofensivo (sem escritores, fora da vitrine) e só compactou ~4% de bloat real; o `ANALYZE` corrigiu as estatísticas. **Lição:** estimativas de `pg_stat_user_tables` em tabelas nunca analisadas mentem — sempre confirmar com `count(*)` antes de agir.

### Itens que se resolveram sozinhos / já estavam prontos
- **`products` bloat (~12%):** autovacuum rodou às 11:46 e zerou os mortos (0% agora). VACUUM manual seria no-op — **não executado** (evita risco desnecessário). Disco permanece 133 MB (VACUUM simples não encolhe; e **nunca** usar VACUUM FULL em `products` — `ACCESS EXCLUSIVE` derrubaria a vitrine).
- **Autovacuum da `supplier_products_raw`:** **já estava agressivo** (`vacuum_scale_factor=0.05`, `analyze_scale_factor=0.02`, `cost_limit=2000`, `fillfactor=90`) e dando conta (dead=1 após 1.534 autovacuums). Nenhuma ação adicional necessária.

---

## 4. Verificação as-built (estado ao vivo em 2026-06-15)

- Publicação `supabase_realtime` = exatamente 10 tabelas de produto/pedido; **`variant_supplier_sources` ausente**. ✅
- Triggers com `WHEN`: `trg_capture_stock_snapshot`, `trg_spr_history`, `trg_xbz_propagate_site_to_silver`. ✅
- Cron 54/55/56/59/63/76/77/78/88 todos escalonados fora do `:00`. ✅
- `supplier_products_raw` = 69 MB (era 559). ✅
- `products` = 133 MB, 0 mortos. ✅

---

## 5. Decisões pendentes (alto impacto — requerem aprovação do Joaquim)

### 5.1 🔴 `supplier_products_raw_history_legacy` — 5.080 MB (maior objeto do banco)

**Fatos:**
- Tabela comum (`relkind='r'`), **não** é partição. **0% morto** (0 bloat → só `DROP`/`TRUNCATE` reclama os 5 GB; VACUUM não devolve nada).
- **3.184.307 linhas**, todas entre **2026-06-05 e 2026-06-10**. **0 escritas nas últimas 24h** (linha mais recente há ~5 dias). Padrão de **burst de migração/backfill** que começou e parou (≈636k linhas/dia naquela janela = assinatura do history antigo sem guarda).
- É o **store de histórico pré-migração**, hoje substituído pelo esquema **particionado** ativo `supplier_products_raw_history` (parent + partições mensais; junho = `..._p2026_06`, 171 MB / 116.970 linhas / saudável).
- **Mantida** pela retenção: cron job 51 `purge-spr-history-daily` (03:30) → `fn_purge_spr_history(90)` faz `DELETE ... WHERE captured_at < now()-90d`. Como os dados têm ≤11 dias, **o purge não apaga nada dela por ~80 dias** — e mesmo então, `DELETE` não reclama disco sem `VACUUM FULL`.
- Referenciada apenas por leitura: `fn_pipeline_health` (monitoramento) e `fn_purge_spr_history` (purge). **Zero FKs.**

**Decisão necessária:** os 3,18M registros de histórico pré-migração (05–10/06) ainda têm valor de auditoria? 
- **Se NÃO:** `DROP TABLE public.supplier_products_raw_history_legacy;` reclama **5 GB** imediatamente (e `fn_purge_spr_history` já tem guarda `IF to_regclass(...) IS NOT NULL`, então segue funcionando). **Irreversível.**
- **Se SIM mas pode sair do quente:** exportar para storage frio (dump comprimido) e então dropar.
- **Não é causa da lentidão** — é **espaço em disco** (relevante para folga de uma instância Small, mas não afeta o banner).

### 5.2 Supressão de UPDATEs no-op na `supplier_products_raw` (durabilidade)

**Achado:** **42.523.553 updates** acumulados (7 dias), só **17,4% HOT**. Grande parte é provavelmente no-op (mesmos dados re-aterrissando a cada ciclo de sync), gerando WAL, replicação e trabalho de autovacuum à toa, além da contenção por linha que era o sintoma original.

**Por que NÃO foi aplicado às cegas:** o trigger `fn_spr_before_write` faz **`NEW.updated_at := now()` incondicional** em todo UPDATE. Ou seja, `updated_at` funciona como **heartbeat** de *"fornecedor reconfirmou esta linha em T"*. Suprimir no-ops mudaria a semântica de `updated_at` (de "último upsert" para "última mudança real") e **pode quebrar lógica de frescor/descontinuação de forma silenciosa**. Pelo esquema sozinho **não é possível provar segurança** — depende de como `updated_at` é consumido no pipeline/n8n. Dada a tolerância zero a corrupção/falha silenciosa, isto é decisão consciente, não mutação cega.

**Mitigação já em vigor:** o VACUUM FULL (item 10) + autovacuum agressivo já mantêm a tabela enxuta (69 MB, dead=1). A supressão é otimização de durabilidade, **não emergência**.

**Opções (se aprovado), em ordem de risco:**
1. **Validar primeiro** se `updated_at` é consumido como heartbeat em queries/edge functions/n8n. Se **não** for load-bearing → seguro suprimir.
2. **DB-side:** trigger `BEFORE UPDATE` que faz `RETURN NULL` quando `NEW` não é distinto de `OLD` em nenhuma coluna **exceto `updated_at`** (dry-run com bateria adversarial: muda só estoque / só site / só `raw_data` / nada / transições NULL).
3. **App-side:** tornar o sync que toca todas as linhas sensível a mudança (só UPDATE quando o dado mudou) — caminho mais invasivo.

---

## 6. Plano de validação (24–48h)

1. `SELECT pg_stat_statements_reset();` para baseline limpo (as estatísticas atuais acumulam desde 2026-06-08, dominadas pelo período **pré-fix**).
2. Re-medir em 24–48h: confirmar queda do tempo de banco do upsert da raw e do realtime; confirmar que o banner *"Backend instável"* cessou.
3. `stock_snapshots` (578 MB, ~3,5% morto): alavanca é **retenção** (14d), não VACUUM — apenas observar.

---

## 7. Oportunidades menores (baixa prioridade, não executadas)

- **Guardar com `fn_cron_guard` os demais jobs de alta frequência** (88 a cada 5 min; scrapers/uploaders) para blindar contra pile-up — o escalonamento já quebrou o herd; o guard adiciona proteção contra sobreposição. Additivo/reversível.
- **`products`:** 2 triggers de `updated_at` aparentemente redundantes (`set_updated_at`/`update_timestamp`) — ler corpos e dry-run antes de remover um.
- **Índices redundantes em `products`** (active/name/sale_price sobrepostos) — exige análise de uso por query antes de remover.

---

*Laudo gerado em 2026-06-15. Mutações de banco executadas via MCP `SUPABASE - GESTÃO DE PRODUTOS` (service role). Convenção do repo: `execute_sql` para DDL/DML imediato; `apply_migration` apenas registra histórico.*
