# Pipelines de Fornecedores

Documentação dos pipelines de ingestão de dados de cada fornecedor ativo na plataforma Promo Gifts.

## Arquitetura geral de ingestão

```
[Fonte de dados do fornecedor]
       │
       ▼
[supplier_products_raw]   → BRONZE (raw_data JSONB)
       │
       ▼
[fn_process_staged_product / fn_process_raw_v2]
       │
       ▼
[products + product_variants]   → GOLD
```

## Fornecedores ativos

| Fornecedor | supplier_id | Processador | Fontes | Status |
|---|---|---|:---:|---|
| [XBZ Brindes](./xbz-fontes-de-dados.md) | `d6718a29-…` | `fn_process_staged_product` | **4** | ✅ Ativo |
| [Spot / Stricker](./spot-fontes-de-dados.md) | `bcfc0d02-…` | `fn_process_raw_v2` | **3** | ✅ Ativo |
| Só Marcas | — | `fn_process_staged_product` | 1 | ✅ Ativo |
| [Asia Import](./asia-import-fontes-de-dados.md) | `d2734e23-…` | `fn_process_staged_product` | **5** | ⚠️ Parcial (C1 inativo) |
| 88 Brindes | — | — | — | ❌ Fora de escopo (manual) |

## Convenção de `source_channel`

O campo `source_channel` em `supplier_products_raw` identifica a origem de cada linha:

| Valor | Origem |
|---|---|
| `api_clientes` | API oficial `/api/clientes/` (XBZ) |
| `api_ruiz` | Portal `/api/ruiz/` (XBZ) |
| `api_carrinho` | Portal `/api/carrinho/` (XBZ) |
| `site_scraping` | Scraping headless via Jina AI |
| `api_xml` | Webservice SSL de catálogo (Spot) |
| `api_rest` | API REST genérica |
| `file_upload` | Upload manual |
| `n8n_workflow` | Workflow n8n automatizado |
| `edge_function` | Edge Function Supabase |

## Arquivos de documentação

| Arquivo | Fornecedor | Conteúdo |
|---|---|---|
| [xbz-fontes-de-dados.md](./xbz-fontes-de-dados.md) | XBZ Brindes | 4 fontes de dados: APIs, portal e scraping |
| [spot-fontes-de-dados.md](./spot-fontes-de-dados.md) | Spot / Stricker | 3 canais: Webservice API (6 feeds), portal público e portal autenticado |
| [asia-import-fontes-de-dados.md](./asia-import-fontes-de-dados.md) | Asia Import | 5 canais: API pública, portal WooCommerce, hg/products, hg/atributes e hg/bisa |
