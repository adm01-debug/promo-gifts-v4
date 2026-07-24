# Validação Exaustiva das Correções Medallion — 2026-06-10/11

**Contexto:** bateria de testes contra as 11 migrações do PR #700 (`EXECUCAO_CORRECOES_MEDALLION_2026-06-10.md`), executada diretamente no banco de produção `doufsxqlfjyuvxuezpln`: simulações funcionais com asserts, recomputação de hash, testes de constraint, verificação de grants/policies com os roles reais, inspeção de `pg_stat_statements` e confronto com a API XBZ ao vivo.

## Resultado geral

**Os 11 sistemas implementados passaram em todos os testes.** A investigação dos gaps levou a 1 correção adicional aplicada (migração 12, abaixo) e a **1 descoberta operacional grave pré-existente** que requer ação fora do banco (worker de estoque XBZ no VPS).

## Prova definitiva do anti-carrossel

| Métrica | Antes | Validado em produção |
|---|---|---|
| `_ruiz_sync_at` em `raw_data` | ~100% das linhas XBZ | **0 linhas** (todos fornecedores) |
| Histórico gravado / 24h | ~375.000 | **6 linhas** (todas de teste) |
| Sync VPS → reset de status | 6.558 reprocessos/24h | **10.630 syncs → 0 resets** (status `processed` permaneceu) |
| Backlog `pending` | 4.703 estagnado | **600 e drenando** |
| Tipos JSON XBZ (`PrecoVenda` etc.) | flip string↔number diário | **100% `number`** em 10.238 amostras |
| `content_hash` | `GENERATED ALWAYS` (trigger morto) | `is_generated = NEVER`; hash do trigger **bate** com recomputação manual |

Simulações de hash: estoque muda → hash **idêntico**; preço muda → hash **diferente**. Re-ingestão idêntica preserva `processed`; preço novo re-pende; estoque novo (campos excluídos XBZ) não re-pende — 6/6 asserts.

## Testes por sistema (resumo)

- **Quarentena:** `process_errors` novo → `attempts` auto-incrementa; 5ª falha → `quarantined` (testado iterativamente). `fn_spr_requeue_failed` só repõe `failed` com `attempts < 5` e idade > 60min, `FOR UPDATE SKIP LOCKED`. Cron `25 * * * *` ativo.
- **Segurança:** Bronze sem policy `anon` (0); `anon` sem EXECUTE nas 8 funções de pipeline testadas (authenticated/service_role preservados); `anon` sem SELECT em `cost_price`/`ipi_rate` (resta só REFERENCES, inócuo p/ REST); exceção `fn_video_queue_*` (5 funções) intacta; 38 tabelas no schema `backup`.
- **Estoque Gold:** `fn_reconcile_stock_gold` com advisory lock + dry-run; cron `10 5 * * *` ativo. Divergência intra-dia (~3,9k variantes) é o drift documentado entre reconciliações (products fica fresco via trigger `trg_sync_stock_from_vss`; variants fecham às 05:10).
- **Histórico particionado:** 5 partições (jun–out/2026); linhas novas caem na partição do mês; `fn_purge_spr_history` dropa por `upper_bound <= cutoff` e auto-cria 4 partições futuras; nenhuma partição seria dropada hoje (retenção 90d). Legacy: 3.184.347 linhas drenando.
- **Invariantes Gold:** UNIQUE parcial bloqueou duplicata (testado com exceção capturada); CHECK bloqueou ativo sem identidade; inativo sem identidade e ativo com SKU passam. `idx_padvar_color_id_2` criado; duplicados removidos.
- **Health v2:** todos os campos novos presentes e coerentes com queries diretas.
- **`fn_standardize_variant` (hotfix preservado):** guard SPOT `length(v_code)=3 AND COALESCE(length(v_fcode),0)<3` presente; `color_id = COALESCE(EXCLUDED.color_id, pv.color_id)` presente; tiers/capacity_ml/mídia presentes. Decisão do ADR 0009 (não aplicar `silver_depara_05`) revalidada.

## Gap encontrado e corrigido (migração 12)

### `fn_xbz_enrich_stock_batch`: guard assimétrico re-escrevia 91% da tabela XBZ por ciclo

Evidência: timestamp único `23:45:13.710604` em **10.636 linhas** (um único statement por ciclo); confronto com a API ao vivo (`/api/ruiz/consultaEstoque`) provou que o payload **não carrega** `QuantidadeDisponivel`/`QuantidadeDisponivelEstoquePrincipal`/`ReposicaoDataPrevista`/`StatusConfiabilidade`. O guard antigo (`raw_data->campo IS DISTINCT FROM item->campo`) dava "diferente" para sempre quando o raw tem o campo e o item não — e a escrita (`jsonb_strip_nulls`) nunca resolvia a diferença. Resultado: ~1M row-versions/dia de updates vazios (dead tuples + sha256 recomputado por linha no trigger), sem nenhum byte alterado.

**Fix (`20260611012422_p2_xbz_01_enrich_guard_simetrico_e_stock_synced_at_honesto`):**
1. Guard simétrico com a escrita: `NOT (raw_data @> patch)` onde `patch = jsonb_strip_nulls(campos do item)`. Merge que não muda nada é pulado.
2. Enrich **não carimba mais `stock_synced_at`** (não escreve quantidade); o campo volta a ser marcador honesto de escrita real de `stock_data`.
3. `updated_at` fica por conta do trigger.

Validação: 15/15 asserts (no-op real, preço muda→1 linha+tipo number+status intacto, idempotência, campo excluído não muda hash, espelho stock_data, SKU inexistente); ensaio com payload real de 300 linhas → `updated: 0, skipped_noop: 300`. ACL preservada (anon sem EXECUTE).

## ⚠️ Descoberta operacional GRAVE (pré-existente, fora do escopo do banco)

**O canal de quantidade de estoque XBZ está congelado.** O `stock_data` (chaves inglesas `Quantity`/`QuantityMainWarehouse`/`Reliability`...) não recebe escrita de nenhum statement desde antes do reset do `pg_stat_statements` (2026-06-08 12:04) — o worker do VPS que consultava o endpoint de estoque detalhado morreu (linha fora do feed tem carimbo de 2026-06-05). Consequências medidas:

- `fn_import_stock_xbz` (roda a cada ciclo) re-afirma as quantidades **congeladas** no VSS, vencendo a `fn_xbz_stock_fast_sync_v3` (que propaga o canal PT do catálogo, sujeito a lixo: `-58194`, `99999`). VSS == canal congelado em 98,4% das linhas; 4.169 linhas divergem entre canais.
- Exemplo confirmado na API ao vivo: `06047` está `Disponivel: SIM` na XBZ, mas VSS/variants = 0 (esgotado para o cliente → venda perdida). O inverso (estoque fantasma) também é possível.
- O carimbo falso de `stock_synced_at` pelo enrich antigo mascarava o problema ("sincronizado às 23:45" com dados de ≤08/06). Com a migração 12, `max(stock_synced_at)` congela e vira dead-man switch.

**Ação requerida (VPS, não banco):** reviver o worker de estoque detalhado XBZ (o que gravava `stock_data` EN via `upsert_supplier_stock_raw` ou equivalente). Monitorar com:

```sql
SELECT max(stock_synced_at) FROM supplier_products_raw
WHERE supplier_id = 'd6718a29-e954-4c1b-bd84-03ea24884900';
-- parado no tempo = worker de estoque morto; avançando = revivido
```

Nota: o congelamento NÃO foi causado pelas migrações de 10/06 (zero statements de escrita EN no período 08–10/06, anterior aos revokes de 12:22).

## Gaps menores documentados (sem ação)

- `raw_failed_by_supplier` no health soma `failed`+`quarantined` (nome sugere só failed) — intencional para monitoramento, mas pode confundir; renomear custaria recablar consumidores.
- `fn_block_unauthorized_product_deactivation` força `is_active=true` em INSERT sem aprovação — trigger pré-existente que conflita com testes de produto inativo; em produção o promote sempre fornece identidade, sem impacto.
