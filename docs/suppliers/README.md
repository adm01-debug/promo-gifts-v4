# Pipelines de Fornecedores

Documentação dos pipelines de ingestão de dados de cada fornecedor ativo na plataforma Promo Gifts.

## Arquitetura geral de ingestão

```
[Fonte de dados do fornecedor]
       │
       ▼
[supplier_products_raw]   → BRONZE (raw_data JSONB + site_data JSONB)
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
| [Só Marcas](./somarcas-fontes-de-dados.md) | `841cd690-…` | `fn_process_raw_v2` + Jina Pipeline | **5** | ✅ Ativo |
| [Asia Import](./asia-import-fontes-de-dados.md) | `d2734e23-…` | `fn_process_staged_product` | **5** | ⚠️ Parcial (C1 inativo) |
| 88 Brindes | — | — | — | ❌ Fora de escopo (manual) |

## Convenção de `source_channel`

O campo `source_channel` em `supplier_products_raw` identifica a origem de cada linha:

| Valor | Origem |
|---|---|
| `api_clientes` | API oficial `/api/clientes/` (XBZ) |
| `api_ruiz` | Portal `/api/ruiz/` (XBZ) |
| `api_carrinho` | Portal `/api/carrinho/` (XBZ) |
| `site_scraping` | Scraping headless via Jina AI Reader |
| `api_xml` | Webservice SSL de catálogo (Spot) |
| `api_rest` | API REST genérica (Só Marcas, Asia) |
| `file_upload` | Upload manual |
| `n8n_workflow` | Workflow n8n automatizado |
| `edge_function` | Edge Function Supabase |

### Valores de `source_endpoint` em `supplier_products_raw` (Só Marcas)

| Valor | Descrição |
|---|---|
| `api.somarcas.com.br/produtos` | API REST oficial (Fonte 1) |
| `r.jina.ai/somarcas.com.br[public]` | Jina Reader sem autenticação (Fonte 2) |
| `r.jina.ai/somarcas.com.br[auth]` | Jina Reader com SM session cookie (Fonte 3) |

## Arquivos de documentação

| Arquivo | Fornecedor | Conteúdo |
|---|---|---|
| [xbz-fontes-de-dados.md](./xbz-fontes-de-dados.md) | XBZ Brindes | 4 fontes: APIs oficiais, portal e scraping |
| [spot-fontes-de-dados.md](./spot-fontes-de-dados.md) | Spot / Stricker | 3 canais: Webservice (6 feeds), portal público, portal autenticado |
| [somarcas-fontes-de-dados.md](./somarcas-fontes-de-dados.md) | Só Marcas | 5 fontes: API REST, site público, site auth, Jina Search, category pages |
| [asia-import-fontes-de-dados.md](./asia-import-fontes-de-dados.md) | Asia Import | 5 canais: API pública, portal WooCommerce e feeds auxiliares |
