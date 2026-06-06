# Pipelines de Fornecedores

Documentação dos pipelines de ingestão de dados de cada fornecedor ativo na plataforma Promo Gifts.

## Arquitetura geral de ingestão

```
[Fonte de dados do fornecedor]
        │
        ▼
[supplier_products_raw]   ← BRONZE (raw_data JSONB)
        │
        ▼
[fn_process_staged_product / fn_process_raw_v2]
        │
        ▼
[products + product_variants]   ← GOLD
```

## Fornecedores ativos

| Fornecedor | supplier_id | Processador | Fontes | Status |
|---|---|---|:---:|---|
| [XBZ Brindes](./xbz-fontes-de-dados.md) | `d6718a29-…` | `fn_process_staged_product` | **4** | ✅ Ativo |
| Spot / Stricker | `bcfc0d02-…` | `fn_process_raw_v2` | 1 | ✅ Ativo |
| Só Marcas | — | `fn_process_staged_product` | 1 | ✅ Ativo |
| Asia Import | — | `fn_process_staged_product` | 1 | ⏳ Aguardando re-ingestão |
| 88 Brindes | — | — | — | ❌ Fora de escopo (manual) |

## Convenção de `source_channel`

O campo `source_channel` em `supplier_products_raw` identifica a origem de cada linha:

| Valor | Origem |
|---|---|
| `api_clientes` | API oficial `/api/clientes/` (XBZ) |
| `api_ruiz` | Portal `/api/ruiz/` (XBZ) |
| `api_carrinho` | Portal `/api/carrinho/` (XBZ) |
| `site_scraping` | Scraping headless via Jina AI |
| `api_xml` | API XML de catálogo (Spot) |
| `api_rest` | API REST genérica |
| `file_upload` | Upload manual |
| `n8n_workflow` | Workflow n8n automatizado |
| `edge_function` | Edge Function Supabase |

## Arquivos de documentação

| Arquivo | Fornecedor | Conteúdo |
|---|---|---|
| [xbz-fontes-de-dados.md](./xbz-fontes-de-dados.md) | XBZ Brindes | 4 fontes de dados: APIs, portal e scraping |
