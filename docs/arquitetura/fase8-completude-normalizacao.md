# Fase 8 — Completude da normalização no pipeline (de-para)

> Execução 2026-06-06. Projeto `doufsxqlfjyuvxuezpln`. Investigação ao vivo + aplicação MCP-first.
> Objetivo: levar **todos** os domínios de normalização ao pipeline unificado Bronze→Silver→Gold,
> com excelência e sem regressão.

## Resultado por domínio

| Item | Estado anterior | Ação | Resultado |
|---|---|---|---|
| **1. Dimensões** | Trigger Bronze paralelo (`trg_auto_sync_product_dimensions`) parseava CombinedSizes do SPOT → Gold direto | Relocado o MESMO parser (`fn_sync_single_product_dimensions`) para a **promoção** (`fn_promote_padronizacao`); **DROP** do trigger Bronze | ✅ Dimensões 100% via pipeline; E2E paridade OK (10×10×20 preservado) |
| **2. Estoque XBZ** | `fn_import_stock_xbz` (cron */15) escreve em `variant_supplier_sources` | Documentado como **fast-path canônico** (camada de sourcing, ADR 0007 §4) | ✅ Não é violação; cron saudável |
| **3. Categorias** | Sem auto-atribuição no pipeline novo (legado deprecado fazia) → produtos novos sem `category_id` | Cron **`pipeline-classify-categories`** */10 (fill-only, `fn_backfill_product_categories` → `fn_master_classify_product`) + backlog limpo | ✅ Asia 99% · SM 97% · SPOT 100% · XBZ 95% |
| **4. Materiais** | — | Verificado: **3 triggers em `products`** (não checam bulk_mode) processam material em toda promoção | ✅ Já integrado, 97% (6463/6649) |
| **6. Imagens** | — | Verificado: `primary_image_url` via de-para em **98,4%**; `product_images` 46k. `silver_images_queue`→CDN é subsistema de re-hospedagem (otimização), não normalização | ✅ Já coberto; CDN à parte |
| **5. Áreas de gravação** | **28%** (1854/6649); nenhuma função atual cria `print_area_techniques` (legado deprecado) | **Plano rigoroso (abaixo)** — não reconstruído às pressas por ser sistema de preços | ⚠️ Sub-projeto |

---

## Item 5 — Plano: áreas de gravação no de-para da Silver (alto risco)

**Por que não foi feito agora:** `print_area_techniques` alimenta a **calculadora de preço de gravação** (`fn_simular_combo_gravacao*`, `tabela_preco_gravacao_oficial`) — ou seja, **cotações ao cliente**. A normalização é fornecedor-específica e densa:
- **SPOT**: `CustomizationTypes{N}` (multi-valor: "Silk Screen, Laser CO2"), localizações, dimensões de área, `TableCodes{N}` → `tabela_preco_gravacao_oficial`, técnicas via `supplier_technique_mappings`.
- **Só Marcas**: técnica em texto descritivo ("Uma gravação a Laser") → mapear por keyword; multi-técnica por `;`.
- **XBZ/ASIA**: historicamente **sem** dados estruturados de gravação (cobertura natural = 0).

**Plano (fases, com teste de paridade obrigatório):**
1. **Modelo Silver**: criar `produtos_padronizacao_print_areas` (staging) espelhando `silver_print_areas` (component/location/área/técnica/`tabela_preco_id`/raw).
2. **Bronze→Silver**: `fn_standardize_print_areas(p_raw_id)` — porta a lógica testada do legado `fn_spot_to_silver`/`fn_sm_to_silver` (parte de gravação), de-para de técnica via `supplier_technique_mappings`, preço via `TableCodes`.
3. **Silver→Gold**: `fn_promote_print_areas_of_parent(supplier, parent)` → `print_area_techniques` (idempotente, fill/upsert), encadeado em `fn_promote_supplier`.
4. **Paridade**: comparar áreas/técnicas/preços gerados vs `silver_print_areas` legado (5.927) para uma amostra SPOT+SM; **gate de cotação** (preço de gravação inalterado) antes de ativar.
5. **Cutover**: ativar no pipeline; aposentar a parte de gravação do legado.

**Estimativa**: sub-projeto dedicado (não é tarefa de poucas queries). Risco: **alto** (preço/cotação) — exige janela + testes de paridade de preço.

---

## Migrations aplicadas (Fase 8)
- `20260606110000_fase8_01_dimensions_into_promotion_retire_bronze_trigger.sql`
- `20260606110100_fase8_02_document_xbz_stock_fastpath.sql`
- `20260606110200_fase8_03_pipeline_category_classification_cron.sql`

## Veredito
5 de 6 domínios **completos/verificados** no pipeline. O 6º (áreas de gravação) tem **plano rigoroso** e fica como sub-projeto por tocar diretamente em preços de cotação.
