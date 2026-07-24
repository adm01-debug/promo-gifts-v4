# Pipeline Completo — Arquitetura Medallion PromoGifts

## Fluxo Bronze → Silver → Gold

```
                       ┌─────────────────────────────────────────────────────┐
                       │              UTILITÁRIOS DE NORMALIZAÇÃO            │
                       │                                                     │
                       │  fn_normalize_ncm()         fn_clean_spot_name()   │
                       │  classify_xbz_category()    extract_xbz_material_primary()│
                       │  normalize_unit()           color_equivalences     │
                       └────────────────────┬────────────────────────────────┘
                                            │ chamados por
                                            ▼
┌──────────────┐    fn_spot_to_silver()    ┌──────────────────────────────────┐
│              │    fn_xbz_to_silver()     │                                  │
│   BRONZE     │    fn_asia_to_silver()    │           SILVER                 │
│ (raw_data)   │──────────────────────────▶│  silver_products                 │
│              │    fn_sm_to_silver()      │  silver_variants                 │
│ 16.464 rec.  │                           │  silver_print_areas              │
└──────────────┘    BATCH:                 │  silver_images_queue             │
                    fn_spot_batch_to_silver │                                  │
                    fn_xbz_batch_to_silver │  7.569 produtos │ 16.462 vars    │
                    fn_asia_batch_to_silver │                                  │
                    fn_sm_batch_to_silver  └───────────────┬──────────────────┘
                    fn_bronze_to_silver_all               │
                                                          │ fn_silver_to_gold()
                                                          │ fn_silver_batch_to_gold()
                                                          ▼
                                              ┌────────────────────┐
                                              │       GOLD         │
                                              │  products          │
                                              │  product_variants  │
                                              │  product_images    │
                                              └────────────────────┘
```

## Funções do Pipeline

### 🔄 Transformação Bronze→Silver (1 por fornecedor)

| Função | Fornecedor | Recursos Integrados |
|--------|------------|--------------------|
| `fn_spot_to_silver(bronze_id)` | SPOT/Stricker | fn_normalize_ncm, fn_clean_spot_name, color_equivalences |
| `fn_xbz_to_silver(bronze_id)` | XBZ Brindes | + classify_xbz_category, extract_xbz_material_primary |
| `fn_asia_to_silver(bronze_id)` | ASIA Import | + capacity_ml de atributos.volume-litros |
| `fn_sm_to_silver(bronze_id)` | Só Marcas | multi-técnica nativa (loop FOREACH ";") |

### 📦 Batch Bronze→Silver

| Função | Fornecedor | Default batch |
|--------|------------|---------------|
| `fn_spot_batch_to_silver(500)` | SPOT | 500 registros/chamada |
| `fn_xbz_batch_to_silver(500)` | XBZ | 500 registros/chamada |
| `fn_asia_batch_to_silver(500)` | ASIA | 500 registros/chamada |
| `fn_sm_batch_to_silver(500)` | SM | 500 registros/chamada |

### 🎯 Orquestradores

| Função | Descrição |
|--------|-----------|
| `fn_bronze_to_silver_all(500)` | Processa todos os 4 fornecedores em sequência |
| `fn_normalize_silver_all()` | Re-normaliza todos os Silver existentes (idempotente) |
| `fn_silver_to_gold(silver_id)` | Promove 1 produto Silver→Gold |
| `fn_silver_batch_to_gold(supplier, 100)` | Promove lote de produtos Silver→Gold |

### 🔑 Utilitários Integrados

| Função | Propósito | Chamada em |
|--------|-----------|------------|
| `fn_normalize_ncm(raw_ncm)` | 8 dígitos sem pontos, corrige O→0 | Todas as 4 transformações |
| `fn_clean_spot_name(nome)` | ALLCAPS → sentence case | Todas as 4 transformações |
| `classify_xbz_category(nome)` | Categoria L3 granular por nome | fn_xbz_to_silver, fn_asia_to_silver |
| `extract_xbz_material_primary(nome, desc)` | Material primário por keyword | fn_xbz_to_silver |
| `color_equivalences` | Cor normalizada via supplier_colors | Todas as variantes |

## Qualidade dos Dados Silver (Junho 2026)

| Fornecedor | Produtos | NCM | Categoria | Material | Cor | Confidence |
|------------|----------|-----|-----------|----------|-----|------------|
| STRICKER | 1.200 | 100% | 98.0% | 71.7% | 100% | 0.939 |
| SOMARCAS | 1.215 | 100% | 79.8% | 89.0% | N/A | 0.937 |
| XBZ | 4.722 | 98.9% | 78.7% | 70.5% | 99% | 0.862 |
| ASIA | 432 | 100% | 89.8% | 48.4% | 99.8% | 0.776 |

## Uso Típico

```sql
-- Reprocessar TODOS os Bronze (incremental — pula já processados)
SELECT fn_bronze_to_silver_all();

-- Re-normalizar Silver existente (idempotente — seguro rodar sempre)
SELECT fn_normalize_silver_all();

-- Promover lote de Silver→Gold (STRICKER, 50 produtos de maior confidence)
SELECT fn_silver_batch_to_gold('STRICKER', 50);

-- Promover TODOS os Silver normalizados
SELECT fn_silver_batch_to_gold(NULL, 500);

-- Processar 1 produto específico manualmente
SELECT fn_spot_to_silver(id) FROM supplier_products_raw
WHERE raw_data->>'ProdReference' = '11104' LIMIT 1;
```
