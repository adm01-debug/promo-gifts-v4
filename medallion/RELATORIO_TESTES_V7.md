# Relatório de Testes V7 — Lambda Architecture SPOT

**Data:** 2026-06-07
**Sessão:** Implementação da Arquitetura Lambda para SPOT/Stricker
**Executor:** Claude (Anthropic) + Pink e Cerébro

---

## Resumo Executivo

Sessão de implementação da Lambda Architecture para o fornecedor SPOT/Stricker no Supabase (`doufsxqlfjyuvxuezpln`). Todos os objetivos atingidos. 3 novos fluxos criados, 2 funções PostgreSQL criadas, 4 melhorias no Sync Full. 3 workflows legados desativados.

**Resultado final: 10/10** ✅

---

## PRÉ-REQUISITO: Remoção do Driver Legado

| Verificação | Resultado |
|---|---|
| `process-pending-products` (jobid=1) desativado | ✅ `cron.unschedule()` = true |
| `medallion-promote-tick` (jobid=59) mantido ativo | ✅ active=true, schedule=*/10 |

---

## STEP 1: `fn_spot_direct_stock_gold`

### Cenários Testados

| Cenário | Entrada | Resultado Esperado | Resultado Real |
|---|---|---|---|
| SKU válido com reposição | `57340-103`, qty=999, NextQty1=200, NextDate1=2026-07-15 | VSS e PV atualizados | ✅ quantity=999, next_quantity_1=200, next_date_1=2026-07-15 |
| SKU válido com NextDate=vazio | qty=100, NextDate2="" | next_date_2=NULL | ✅ NULL (não erro) |
| SKU inexistente | `SKU-INEXISTENTE-XYZ` | skipped | ✅ skipped |
| Sku nulo | `{"Sku":null,"Quantity":5}` | skipped | ✅ skipped |
| Source correto | — | source='hot_path_stock' | ✅ |
| product_variants atualizado | 57340-103 | stock_quantity=999 | ✅ |

### Validação de Integridade

```sql
SELECT supplier_sku, quantity, stock_main_warehouse, next_quantity_1, next_date_1, source
FROM variant_supplier_sources
WHERE supplier_sku = '57340-103' AND supplier_id = 'bcfc0d02-...';
-- quantity=999 ✅  stock_main_warehouse=999 ✅  next_date_1=2026-07-15 ✅  source=hot_path_stock ✅
```

---

## STEP 2: `fn_spot_direct_prices_gold`

### Cenários Testados

| Cenário | Entrada | Resultado Esperado | Resultado Real |
|---|---|---|---|
| 5 faixas completas | 57340-103, Price1..5 | Todas 5 atualizadas | ✅ cost_price=38.74, cost_price_5=27.00 |
| YourPrice ausente | YourPrice=null | COALESCE preserva existente | ✅ null preservado |
| Price1=null | `{"Sku":"57340-103","Price1":null}` | skipped (guard) | ✅ skipped |
| SKU fake | `{"Sku":"SKU-FAKE-999","Price1":1.0}` | skipped | ✅ skipped |
| price_updated_at setado | — | timestamp presente | ✅ 2026-06-07T12:02:27 |
| source correto | — | source='hot_path_prices' | ✅ |

### Validação de Integridade

```sql
SELECT cost_price, cost_price_1..5, min_qty_1..5, source, price_updated_at
FROM variant_supplier_sources WHERE supplier_sku = '57340-103';
-- 5 faixas ✅  source=hot_path_prices ✅  price_updated_at=não nulo ✅
```

---

## STEP 3: SPOT - Sync Estoque (workflow `xOzV2EOv3uJUgKyJ`)

### Execução de Validação

| Métrica | Valor |
|---|---|
| Execution ID | 1051316 |
| Status | success ✅ |
| Runtime | 23 segundos |
| SKUs atualizados | **3612** (100% do catálogo SPOT) |
| Skipped | 0 |
| Errors | 0 |

### Validação DB Pós-execução

```sql
SELECT source, COUNT(*), MAX(last_synced_at)
FROM variant_supplier_sources
WHERE supplier_id = 'bcfc0d02-...' AND source = 'hot_path_stock';
-- 3612 rows ✅  ultima_atualizacao=2026-06-07 12:09:56 ✅
```

**Ação:** Workflow publicado ✅ / ING-SPOT-STOCK (`dppXHdvrBhA8UXKk`) desativado ✅

---

## STEP 4: SPOT - Sync Precos (workflow `8Cjg3eY2neYBH4Yb`)

### Execução de Validação

| Métrica | Valor |
|---|---|
| Execution ID | 1051320 |
| Status | success ✅ |
| Runtime | 20 segundos |
| Items extraídos do OptionalsComplete | 3610 |
| Preços atualizados | **3610** |
| Skipped | 0 |
| Errors | 0 |

**Otimização aplicada:** Extração apenas dos 13 campos de preço reduz payload de ~27MB para ~230KB antes de POSTar ao Supabase.

### Validação DB Pós-execução

```sql
SELECT supplier_sku, cost_price, cost_price_5, min_qty_5, source, price_updated_at
FROM variant_supplier_sources
WHERE supplier_id = 'bcfc0d02-...' AND source = 'hot_path_prices'
ORDER BY price_updated_at DESC LIMIT 3;
-- 3610 rows ✅  5 faixas por SKU ✅  price_updated_at presente ✅
```

**Ação:** Workflow publicado ✅ / ING-SPOT-PRICES (`CHPGOgPxGnyeQCfJ`) desativado ✅

---

## STEP 5: SPOT - Sync Full atualizado (`AF0p45RVqCQZvGTC`)

### Melhorias Aplicadas

| Melhoria | Antes | Depois |
|---|---|---|
| Cron | 06:00 | **04:00** |
| Guard mark_absent | Ausente (risco: wipe catálogo) | **IF fetched >= 3000 → executa** |
| Fase Customizações | Workflow separado (ING-SPOT-SUPPLEMENTS) | **Absorvido (Fase 4)** |
| Fase Cores | Workflow separado | **Absorvido (Fase 5)** |
| Total de nós | 19 | **36** |

### Estrutura Final

```
Fase 1: Produtos (OptionalsComplete → Bronze batch 500)
Fase 2: Estoque (Stocks → Bronze)
Fase 3: Mark Absent (guarded: IF fetched >= 3000)
Fase 4: Customizações (CustomizationOptions → Bronze batch 500) [NOVO]
Fase 5: Cores (Colors → Bronze) [NOVO]
```

**Ação:** Workflow atualizado e republicado ✅ / ING-SPOT-SUPPLEMENTS (arquivado) ✅

---

## Cota Final Validada

| Tipo | Uso | Limite | Status |
|---|---|---|---|
| Stocks | ~53/dia | 96 | ✅ 55% livre |
| Other | ~16/dia | 22 | ✅ 27% livre |

---

## Tabela de Estado Final dos Workflows SPOT

| Workflow | ID | Status | Cron |
|---|---|---|---|
| SPOT - Sync Full | AF0p45RVqCQZvGTC | ✅ Ativo | 04:00 diário |
| SPOT - Sync Estoque | xOzV2EOv3uJUgKyJ | ✅ Ativo | */15min |
| SPOT - Sync Precos | 8Cjg3eY2neYBH4Yb | ✅ Ativo | Horário |
| SPOT - GESTÃO DE PERSONALIZAÇÃO | 1uKqFK3xbAWf8ycU | ✅ Ativo | On-demand |
| SPOT - GESTÃO DE PEDIDOS | 2PvnD15sj7AhsOgB | ✅ Ativo | On-demand |
| ING-SPOT-PRICES | CHPGOgPxGnyeQCfJ | ❌ Desativado | — |
| ING-SPOT-STOCK | dppXHdvrBhA8UXKk | ❌ Desativado | — |
| ING-SPOT-SUPPLEMENTS | bhoevJqxei1DsqGN | ❌ Arquivado | — |

---

## Validação de Integridade Final (DB)

```sql
-- Cobertura do hot-path
SELECT source, COUNT(*), MAX(last_synced_at) AS ultima_att
FROM variant_supplier_sources
WHERE supplier_id = 'bcfc0d02-44c6-48ae-8472-12b1a3f3d8e0'
GROUP BY source;
-- hot_path_stock: 3612 ✅
-- hot_path_prices: 3610 ✅ (2 sem Price1 = produtos descontinuados)

-- job único de driver ativo
SELECT jobid, jobname, active FROM cron.job WHERE jobname = 'medallion-promote-tick';
-- jobid=59, active=true ✅
-- process-pending-products: ausente ✅
```

---

## Bugs Prevenidos nesta Sessão

| Bug | Risco | Mitigação Implementada |
|---|---|---|
| mark_absent wipando catálogo | CRÍTICO — API retorna <3000 items por timeout | Guard: `IF fetched >= 3000` no workflow |
| COALESCE-to-zero em preços | Apaga preços válidos quando feed é esparso | COALESCE preserva valor existente em todos os campos de faixas |
| OptionalsComplete 27MB → payload overflow Supabase | POST de 27MB rejeita na API | Extração projeta apenas 13 campos (~230KB) antes de POST |
| Double-driver conflict | jobid=1 conflitava com jobid=59 | process-pending-products removido definitivamente |
| Token expirado mid-run | Customizations corre depois de Stocks | Token SPOT válido 60min; run total ~7min → dentro do limite |
