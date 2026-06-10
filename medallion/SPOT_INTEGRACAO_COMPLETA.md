# SPOT / Stricker — Integração Completa v5.3

**Arquitetura:** Lambda Architecture (Batch + Speed Layer)
**Supplier ID:** `bcfc0d02-44c6-48ae-8472-12b1a3f3d8e0`
**Atualizado em:** 2026-06-07
**Decisão arquitetural aprovada por:** Pink e Cerébro

---

## Visão Geral da Arquitetura Lambda

```
BATCH LAYER (madrugada 04:00)            SPEED LAYER (horário comercial)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━       ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SPOT API → Bronze → Silver → Gold        */15min: Stocks → Gold direto
(Medallion completo — produtos,          */60min: OptionalsComplete → Gold direto
 estoque, mark_absent,
 customizações, cores)
```

**Princípio:** O SPOT - GESTÃO DE PRODUTOS de madrugada estabelece a linha de base. Os hot-paths intraday mantêm estoque e preços frescos sem pressionar o Medallion. O SPOT - GESTÃO DE PRODUTOS reconcilia tudo a cada 24h.

---

## Workflows Ativos

| Workflow | ID | Cron | Função |
|---|---|---|---|
| **SPOT - GESTÃO DE PRODUTOS** | `AF0p45RVqCQZvGTC` | `0 0 4 * * *` (04:00) | Medallion completo: produtos+estoque+mark_absent+customizações+cores |
| **SPOT - ATUALIZAÇÃO ESTOQUE** | `xOzV2EOv3uJUgKyJ` | `0,15,30,45 * * * *` | Hot-path: Stocks → `fn_spot_direct_stock_gold` |
| **SPOT - ATUALIZAÇÃO PREÇOS** | `8Cjg3eY2neYBH4Yb` | `0 * * * *` | Hot-path: OptionalsComplete → `fn_spot_direct_prices_gold` |

### Workflows Operacionais (mantidos)

| Workflow | ID | Tipo |
|---|---|---|
| SPOT - GESTÃO DE PERSONALIZAÇÃO | `1uKqFK3xbAWf8ycU` | Manual / on-demand |
| SPOT - GESTÃO DE PEDIDOS | `2PvnD15sj7AhsOgB` | Manual / on-demand |

### Workflows Desativados / Excluídos (legado)

| Workflow | ID | Substituído por |
|---|---|---|
| ING-SPOT-PRICES | `CHPGOgPxGnyeQCfJ` | SPOT - ATUALIZAÇÃO PREÇOS |
| ING-SPOT-STOCK | `dppXHdvrBhA8UXKk` | SPOT - ATUALIZAÇÃO ESTOQUE *(excluído)* |
| SPOT - ATUALIZAÇÃO ESTOQUE (legado Bronze) | `6j92ZC6didDgGrGD` | SPOT - ATUALIZAÇÃO ESTOQUE *(excluído)* |
| ING-SPOT-SUPPLEMENTS | `bhoevJqxei1DsqGN` | Absorvido pelo SPOT - GESTÃO DE PRODUTOS |

---

## Funções PostgreSQL do Hot-Path

### `fn_spot_direct_stock_gold(p_items jsonb)`

**Propósito:** Atualiza estoque direto no Gold sem passar pelo Medallion.

**Tabelas escritas:**
- `variant_supplier_sources`: `quantity`, `stock_main_warehouse`, `next_quantity_1..6`, `next_date_1..6`, `source='hot_path_stock'`, `last_synced_at`
- `product_variants`: `stock_quantity`, `last_sync_at`

**Join:** `variant_supplier_sources.supplier_sku = Sku AND supplier_id = STRICKER`

**Guard:** Sku null/vazio → skip; Sku sem match Gold → skip

**Retorna:** `{feed, supplier, updated, skipped, errors, error_samples, updated_at}`

**Segurança:** `SECURITY DEFINER`, somente `service_role`

---

### `fn_spot_direct_prices_gold(p_items jsonb)`

**Propósito:** Atualiza faixas de preço direto no Gold sem passar pelo Medallion.

**Tabelas escritas:**
- `variant_supplier_sources`: `cost_price` (= Price1), `cost_price_1..5`, `min_qty_1..5`, `your_price` (COALESCE preserva se ausente), `price_updated_at`, `source='hot_path_prices'`, `last_synced_at`

**Guard obrigatório:** `Price1 IS NULL` → skip

**Retorna:** `{feed, supplier, updated, skipped, errors, error_samples, updated_at}`

**Segurança:** `SECURITY DEFINER`, somente `service_role`

---

## Fases do SPOT - GESTÃO DE PRODUTOS (04:00)

```
Fase 1 — PRODUTOS
  OptionalsComplete (27MB) → batches de 500 → fn_ingest_bronze_batch('products')

Fase 2 — ESTOQUE
  Stocks (~3.6k items) → fn_ingest_bronze_batch('stock')

Fase 3 — MARK ABSENT (guarded)
  Guard: IF Agregar Produtos.fetched >= 3000 → fn_bronze_mark_absent
  Guard FALSE → log skip, continua pipeline (catálogo protegido)

Fase 4 — CUSTOMIZAÇÕES
  CustomizationOptions (46MB) → batches de 500 → fn_ingest_bronze_batch('customization')

Fase 5 — CORES
  Colors (~52 items) → fn_ingest_bronze_batch('colors')
```

---

## Cota SPOT API (validada)

| Categoria | Limite diário | Uso atual |
|---|---|---|
| Stocks | 96/dia | ~53/dia (1 GESTÃO DE PRODUTOS + ~52 ATUALIZAÇÃO ESTOQUE) |
| Other (todos demais) | 22/dia | ~16/dia (1 OptionalsComplete Full + 12 ATUALIZAÇÃO PREÇOS + 2 custom/colors + 1 auth) |

**Margem de segurança:** Stocks 55%, Other 27%

---

## Estrutura de Dados — variant_supplier_sources

| Campo | Fonte | Hot-path |
|---|---|---|
| `quantity` | Stocks.Quantity | ✅ ATUALIZAÇÃO ESTOQUE |
| `stock_main_warehouse` | Stocks.Quantity | ✅ ATUALIZAÇÃO ESTOQUE |
| `next_quantity_1..6` / `next_date_1..6` | Stocks.NextQuantity/NextDate | ✅ ATUALIZAÇÃO ESTOQUE |
| `cost_price` | OptionalsComplete.Price1 | ✅ ATUALIZAÇÃO PREÇOS |
| `cost_price_1..5` / `min_qty_1..5` | OptionalsComplete.Price1..5 | ✅ ATUALIZAÇÃO PREÇOS |
| `your_price` | OptionalsComplete.YourPrice | ✅ ATUALIZAÇÃO PREÇOS |
| `source` | 'hot_path_stock' / 'hot_path_prices' / 'silver' | — |
| `last_synced_at` / `price_updated_at` | now() | — |

---

## Variáveis de Ambiente

- `SPOT_ACCESS_KEY` — Supabase Vault (`efa0d6b9`), via `fn_get_spot_access_key()` (SECURITY DEFINER)
- Credencial n8n: `kite` (`SIoFliQ0FzfJBD0Z`) no projeto Atomica BR (`K1sOP2Gf9sQt2U7P`)

---

## Invariantes de Qualidade

1. **Medallion não violado:** hot-path escreve em `variant_supplier_sources`, não nos campos canônicos de produto
2. **COALESCE-to-zero banido:** nunca `COALESCE(silver_value, 0)` — preservar NULL existente
3. **Mark absent guarded:** só roda se `fetched >= 3000` — evita wipe do catálogo
4. **process-pending-products removido:** `medallion-promote-tick` (jobid=59, */10min) é o único driver ativo
5. **Reconciliação garantida:** SPOT - GESTÃO DE PRODUTOS 04:00 sempre reconcilia hot-path

---

## Histórico de Versões

| Versão | Data | Mudança |
|---|---|---|
| v1.0 | 2026-01-xx | Pipeline inicial Bronze→Silver→Gold |
| v2.0 | 2026-03-xx | fn_upsert_stock_to_bronze, fn_sync_stock_bronze_to_gold |
| v3.0 | 2026-06-06 | COALESCE bug fix, VSS FASE 9 |
| v4.0 | 2026-06-06 | ING-SPOT-FULL criado, ING-SPOT-STOCK separado |
| **v5.0** | **2026-06-07** | **Lambda Architecture: hot-path direto ao Gold** |
| **v5.1** | **2026-06-07** | **SPOT - Sync Full → SPOT - GESTÃO DE PRODUTOS** |
| **v5.2** | **2026-06-07** | **SPOT - Sync Precos → SPOT - ATUALIZAÇÃO PREÇOS** |
| **v5.3** | **2026-06-07** | **SPOT - Sync Estoque → SPOT - ATUALIZAÇÃO ESTOQUE. Legado Bronze excluído (6j92ZC6didDgGrGD).** |
