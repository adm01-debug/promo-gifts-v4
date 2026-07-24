# Execução das Correções da Auditoria Medallion — 2026-06-10

**Contexto:** execução completa do plano de ação da `AUDITORIA_ARQUITETURA_MEDALLION_DB_2026-06-10.md` (PR #694), aplicada diretamente no banco de produção `doufsxqlfjyuvxuezpln` via 11 migrações, com simulação prévia de cenários, verificação item a item e canários pós-mudança.

## Metodologia

Antes de cada mudança: simulação read-only sobre dados reais (censo de volatilidade em 8.000 pares de versões consecutivas do histórico; recomputação de hash canônico nas 18.427 linhas do Bronze; enumeração de grants × queries reais do front via grep no `src/` e logs da API; dry-runs). Depois de cada mudança: teste funcional no banco vivo (idempotência, transições de estado, REST com a chave `anon` real).

## Descobertas NOVAS feitas durante a simulação (além da auditoria)

1. **`content_hash` era `GENERATED ALWAYS`** (`sha256(raw_data)` cheio) — a atribuição de hash dentro de `fn_spr_before_write` **sempre foi código morto** (Postgres recomputa a expressão gerada após o BEFORE trigger). Todo o mecanismo de change-detection "com strip de metadados" descrito nas migrações antigas nunca funcionou de fato.
2. **Flip-flop diário de tipos JSON**: `fn_xbz_enrich_stock_batch` gravava `PrecoVenda`/`IdProduto`/`VendaMinima`/`Multiplos`/`IpiTaxa` como *string* (`item->>`), e o ingest de catálogo restaurava como *número* → 33% dos pares de versões eram flip de tipo puro (2.665/8.000 pares amostrados).
3. **`fn_ingest_supplier_raw` resetava `status='pending'` incondicionalmente** em todo upsert (sem comparar hash) — re-pendurava feeds inteiros sem mudança (evidência: 300 raws SOMARCAS já processados re-pendurados às 12:16 com payload idêntico).
4. Mudança real de estoque XBZ: apenas **~1%** dos ciclos (63/8.000 pares) — 99% do volume de histórico era ruído de `_ruiz_sync_at`.

## Migrações aplicadas (espelhadas em `supabase/migrations/`)

| # | Versão | Nome | O quê |
|---|--------|------|-------|
| 1 | 20260610120511 | `p0_carrossel_01_hash_canonico_e_enrich_tipado` | `supplier_settings.hash_excluded_fields` (XBZ: 5 campos de estoque); enrich v2 com tipos preservados, espelho em `stock_data`, guarda no-op, sem `_ruiz_sync_at` |
| 2 | 20260610120708 | `p0_carrossel_02_fix_digest_schema` | `fn_spr_before_write` v3 final: strip de toda chave `_%`, hash canônico via `extensions.digest` |
| 3 | 20260610121302 | `p0_carrossel_03_content_hash_drop_expression` | `content_hash` deixa de ser coluna gerada (DROP EXPRESSION); trigger assume de verdade |
| — | (one-shot em lotes) | descontaminação | remoção de `_ruiz_sync_at` + coerção numérica em 11.415 linhas; recálculo do hash canônico nas 18.427 linhas (com `trg_spr_history` desabilitado na janela) |
| 4 | 20260610121713 | `p0_quarentena_01_promote_failures_marcam_bronze` | falha de standardize/promote grava `process_errors` no raw (→`failed`→`quarantined` em 5 tentativas); `fn_spr_requeue_failed` + cron horário `spr-requeue-failed-hourly` |
| 5 | 20260610122207 | `p0_seguranca_01_fecha_anon_bronze_custos_e_fns` | DROP `spr_select_anon`; REVOKE anon/PUBLIC de ~400 funções `fn_*` (preservando authenticated/service_role; exceção `fn_video_queue_*`); 8 tabelas `_bkp/_deprecated` → schema `backup` |
| 6 | 20260610122350 | `p0_seguranca_02_products_grants_por_coluna_anon` | anon perde grant de tabela em `products`; recebe lista explícita de colunas (todas exceto `cost_price`, `ipi_rate`) |
| 7 | 20260610122504 | `p0_estoque_01_fn_reconcile_stock_gold` | reconciliação VSS→variants→products (idempotente, dry-run, advisory lock, `bulk_import_mode`); cron diário 05:10 |
| 8 | 20260610122909 | `p1_historico_01_particionamento_mensal` | histórico particionado por mês (rename → `_legacy`; purga por DROP PARTITION; auto-criação de partições futuras) |
| 9 | 20260610123120 | `p1_gold_01_invariantes_indices_e_equivalencias_mortas` | UNIQUE parcial `products(supplier_id, supplier_reference)`; CHECK `chk_products_active_has_identity` (validado); índice FK `color_id_2`; 2 índices duplicados removidos; 3 tabelas de-para mortas → `backup` |
| 10 | 20260610123210 | `p1_health_01_fn_pipeline_health_v2` | health com failed/quarantine, backlogs imagens/estoque/site, divergência de estoque, taxa do histórico, qualidade visível |
| 11 | 20260610123510 | `p1_ingest_01_fn_ingest_supplier_raw_reset_condicional` | reset de `pending` só quando o hash canônico muda |

## Resultados medidos (antes → depois)

| Métrica | Antes | Depois |
|---------|-------|--------|
| Histórico gravado por dia | **~375.000 linhas/dia** (3,16M em 7 dias, 5 GB) | **~0** (3 linhas em 24h, todas de teste) — verificado por `fn_pipeline_health.history_rows_24h` |
| Carrossel XBZ (pending↔processed) | 4.263 raws re-promovidos em loop; 6.558 reprocessos/24h | morto na raiz: mudança de estoque **não** altera hash (testado); re-ingestão idêntica **não** re-pendura (testado) |
| Backlog `pending` | 4.703 (estagnado há dias) | 1.641 e drenando de verdade (processed permanece processed) |
| Erro recorrente `chk_vss_cost_price_not_zero` | re-tentado a cada 10 min, para sempre | 6 raws marcados `failed` (attempts=1) com erro registrado; requeue/h e quarentena automática em 5 tentativas |
| `anon` lê Bronze (custos de fornecedor) | `USING (true)` | policy removida; REST retorna `[]` (verificado com a chave anon) |
| `anon` lê `products.cost_price`/`ipi_rate` | sim (grant de tabela) | **42501 permission denied** em REST; campo some do schema GraphQL (verificado); colunas seguras e `v_products_public` intactas (verificado) |
| Funções de pipeline executáveis por `anon` | ~93 SECDEF | `permission denied` (verificado em `fn_pipeline_promote_tick`); authenticated/service_role preservados; canário: ciclo de estoque XBZ via VPS seguiu rodando às 12:30 |
| Estoque Gold divergente | 3.931 variantes (21%) / 515 products | corrigidos 3.797 + 182; divergência pós-reconciliação = **0**; cron diário + métrica contínua no health |
| Purga do histórico | DELETE em tabela única de 5 GB | DROP PARTITION mensal; legado (3,18M) mingua por DELETE diário até setembro e some |
| Duplicatas/invariantes Gold | sem constraint (sorte operacional) | UNIQUE parcial + CHECK validado; guard "fantasmas" virou cinto, não muleta |

## Decisão registrada: migrações `silver_depara_01..06` (PR #693) NÃO aplicadas ao banco

As 6 migrações estão mergeadas no repositório mas **não** foram aplicadas no banco (verificado em `supabase_migrations.schema_migrations`). Decisão desta execução: **não aplicar**, porque a `silver_depara_05` (reescrita de `fn_standardize_variant`) regrediria produção:

1. Não popula `capacity_ml`, `cost_price_1..5`, `min_qty_1..5`, `next_*`, `sale_multiplier`, `supplier_thumbnail/images/videos` (a versão viva popula);
2. `ON CONFLICT` sobrescreve `color_id` sem o `COALESCE(EXCLUDED.color_id, pv.color_id)` que preserva cor canônica;
3. **Desfaria o hotfix `spot_canonical_code_guard_in_standardize_variant` aplicado em produção hoje (10/06 10:53)** — o guard de código 3 dígitos SPOT não existe na versão do PR.

O objetivo "de-para 100%" continua válido (ADR-0007 follow-up), mas exige rebase da `silver_depara_05` sobre a função viva + nova rodada do parity check (`silver_depara_06`). Fica para a sessão/dona do PR #693.

## Pendências conscientes (não executadas, com justificativa)

- **264 índices não usados**: remoção em massa exige janela de observação de uso (stats acumuladas desde o início do cluster); os 2 duplicados exatos foram removidos e os índices das tabelas movidas saíram do `public` junto. Script de revisão pode ser gerado sob demanda.
- **Refatorações estruturais** (1NF dos tiers na Silver, split da God-table `products` com 170 colunas/41 índices/~25 triggers, `organization_id` em Silver/Bronze): mudanças multi-sprint que exigem coordenação com o front; registradas como dívida arquitetural na auditoria, sem ação imprudente agora.
- **`supplier_products_raw_history_legacy`**: dropar manualmente quando esvaziar (~set/2026), ou antes se decidirem abrir mão do histórico-ruído da era `_ruiz` (3,18M linhas, ~99,99% ruído comprovado).

## Como monitorar (operação)

```sql
SELECT public.fn_pipeline_health();
-- history_rows_24h        → regime saudável: dezenas/centenas. >50k/dia = hash poluído de novo
-- raw_failed_by_supplier  → quarentenas em formação
-- estoque_divergente_variantes → drift entre reconciliações (fecha às 05:10)
SELECT public.fn_reconcile_stock_gold(true);  -- dry-run de divergência a qualquer momento
```
