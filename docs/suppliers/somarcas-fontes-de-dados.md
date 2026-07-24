# Só Marcas — 5 Fontes de Dados

**Fornecedor:** Só Marcas · `supplier_id = 841cd690-210a-422a-908c-7676828db272`  
**Atualizado:** 2026-06-07  
**Arquitetura:** Medallion Bronze → Silver → Gold com SM Jina Scraping Pipeline v3

---

## Visão geral

A Só Marcas combina **5 fontes complementares**, cada uma entregando campos que as demais
não fornecem. A Fonte 1 (API) é o canal primário e cobre dados de produto, preço e estoque.
As Fontes 2 e 3 (site scraping) enriquecem o catálogo com galeria de fotos filtrada,
vídeos, spec técnica e tabela de preços por volume. As Fontes 4 e 5 são infraestrutura
de descoberta de URL — habilitam as Fontes 2 e 3 ao mapear o `site_id` numérico de cada
produto no site somarcas.com.br.

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│  FONTE 1          FONTE 2           FONTE 3          FONTE 4       FONTE 5      │
│  API REST         Site Público      Site Auth         Jina Search   Category     │
│  api.somarcas     Jina Reader       Jina + Cookie     s.jina.ai     Pages        │
│  (oficial)        (sem auth)        (SM session)      (discovery)   (discovery)  │
└──────┬──────────────┬─────────────────┬──────────────────┬─────────────┬────────┘
       │              │                 │                  │             │
       ▼              │                 │                  │             │
┌─────────────────────────────────────────────────────────────────────────────────┐
│                       supplier_products_raw (BRONZE)                            │
│   raw_data (JSONB)          site_data (JSONB)       sm_site_url_map             │
│   ← Fonte 1 (via API)       ← Fontes 2, 3           ← Fontes 4, 5              │
│   source_channel=api_rest   source_channel=          (tabela auxiliar           │
│                             site_scraping            de mapeamento URL)         │
└─────────────────────────────────────────────────────────────────────────────────┘
       │                        │
       ▼                        ▼
  fn_standardize_raw       fn_sm_site_promote
  + supplier_field_mappings  (Gold direto, sem Silver)
       │                        │
       └────────────┬───────────┘
                    ▼
           products (camada GOLD)
           + product_properties
```

---

## Fonte 1 — API REST oficial

**Host:** `api.somarcas.com.br` · **source_channel:** `api_rest`  
**Auth:** Credencial de revendedor (header) · **Rate limit:** sem limite documentado  
**Endpoint:** `/produtos` — 25 campos com **100% fill rate**  
**Automação:** pg_cron (padrão XBZ) — ingestão diária  
**Status:** ✅ 1.161 produtos no Bronze

### Campos capturados

| Campo raw | Destino Gold | Observação |
|---|---|---|
| `codigo` | `supplier_reference` | Autoritativo — formato AS-00610, BT-00333 |
| `titulo` | `products.name` | 100% preenchido |
| `descricao` | `products.description` | Descrição completa |
| `preco_sem_gravacao_sem_impostos` | custo base | Preço sem IPI, sem gravação |
| `preco_sem_gravacao_com_impostos` | preço referência | Preço com IPI, sem gravação |
| `preco_com_gravacao_sem_impostos` | — | Preço com gravação, sem IPI |
| `preco_com_gravacao_com_impostos` | — | Preço completo |
| `ncm` | `products.ncm_code` | 100% preenchido |
| `ipi` | `variant_supplier_sources.supplier_ipi_rate` | 100% preenchido |
| `estoque` | `product_variants.stock_quantity` | Posição de estoque |
| `tipo_gravacao` | `products.engraving_type` | Técnica de personalização |
| `dimensoes_do_produto` | `products.dimensions_text` | Texto composto (ex: 25,5xØ8,0 cm) |
| `peso_da_embalagem` | `products.weight_g` | Peso em gramas |
| `dimensoes_da_embalagem` | — | Dimensões da embalagem individual |
| `embalagem_do_produto` | — | Tipo de embalagem |
| `url_foto` | `products.primary_image_url` | Foto principal CDN |
| `matriz_de_fotos_adicionais` | — | Galeria extra da API |
| `matriz_de_categorias` | `supplier_category_mappings` | Pipe-delimited (ex: Copos\|Lançamentos) |
| `produtos_similares` | `sm_site_url_map` | Referências de variantes + site_id |
| `quantidade_minima_sugerida` | `products.minimum_quantity` | MOQ |
| `quantidade_calculo_preco` | — | Base de cálculo de preço |
| `garantia_do_produto` | — | Garantia em meses |
| `data_ultima_atualizacao` | `updated_at` | Watermark para ingestion incremental |
| `produto_ativo` | `products.is_active` | Status ativo/inativo |
| `estado` | — | Estado de disponibilidade |

### Limitações

- Apenas **1 preço por unidade** — tabela de preços por faixa de quantidade requer Fonte 3.
- Fotos da API são básicas — galeria completa (múltiplos ângulos) requer Fonte 2.
- `produtos_similares` entrega `site_id` de variantes relacionadas — explorado pela Fonte 5.

---

## Fonte 2 — Site Scraping Público via Jina Reader

**Host:** `r.jina.ai/somarcas.com.br/{site_id}/produto/{slug}`  
**source_channel:** `site_scraping` (endpoint: `r.jina.ai/somarcas.com.br[public]`)  
**Auth:** Jina API key no Vault (`jina_api_key`) · fallback free tier  
**Frequência:** cron `sm-site-scrape` a cada **5 minutos** · **ATIVO** ✅  
**Pré-requisito:** produto deve ter `site_id` mapeado em `sm_site_url_map`  
**Parser version:** `fn_parse_sm_site_markdown v3`

### Pipeline de execução (`fn_sm_site_tick`)

```
1. fn_sm_site_collect(20)   → lê respostas Jina da fila pg_net e parseia
2. fn_sm_site_enqueue(5)    → enfileira novas URLs via r.jina.ai (sem auth)
3. fn_sm_site_promote(50)   → promove site_data ao Gold (product_properties)
```

Cron: `SELECT public.fn_sm_site_tick(5, 20, 7, false)` (enqueue=5, collect=20, stale_days=7, auth=false)  
Watchdog: desbloqueia `processing` parados > 45 min. Máx 5 tentativas por produto.

### Campos capturados (`site_data` JSONB em `supplier_products_raw`)

| Campo | Exemplo | Destino Gold |
|---|---|---|
| `fotos_cdn` | Array de URLs `/g/` e `/p/` CDN | `product_properties.fotos_cdn_sm` |
| `spec_tecnica_url` | URL .jpg/.png ficha técnica | `product_properties.spec_tecnica_url` |
| `video_url` | `https://youtube.com/watch?v=...` | `product_properties.video_youtube_url` |
| `source_url` | URL canônica da página scrapeada | `products.supplier_product_url` |
| `relacionados` | Array `[{site_id, slug, codigo?}]` | `sm_site_url_map` (expande cobertura) |
| `scraped_at` | Timestamp do scrape | rastreabilidade |
| `is_authenticated` | `false` (sem auth) | flag de sessão |

> **Nota:** `fotos_cdn` filtra apenas prefixos `/g/` e `/p/` — thumbnails de produtos
> relacionados (prefixo `/m/`) são excluídos desde o parser v3 (Bug Fix 6).

> **Nota:** `spec_tecnica_url` aceita `.jpg` e `.png` desde o parser v3 (Bug Fix 7).

### Campos NÃO disponíveis sem autenticação

- Tabela de preços por faixa de quantidade (50/100/250/500/1000 un)
- Dimensões e peso da caixa master (logística)
- NCM/IPI validados pelo site
- Estoque em tempo real

---

## Fonte 3 — Site Scraping Autenticado (SM Session Cookie)

**Host:** `r.jina.ai/somarcas.com.br/{site_id}/produto/{slug}`  
**source_channel:** `site_scraping` (endpoint: `r.jina.ai/somarcas.com.br[auth]`)  
**Auth:** SM session cookie no Vault (`sm_session_cookie`) + Jina API key  
**Frequência:** cron `sm-site-scrape-auth` a cada **20 minutos**  
**Status:** ⚠️ Vault `sm_session_cookie` com placeholder — requer configuração  
**Pré-requisito:** cookie de sessão ativo do portal B2B somarcas.com.br

### Campos desbloqueados com autenticação

| Campo | Exemplo | Destino Gold |
|---|---|---|
| `price_tiers` | Array com 5 faixas `{qtd_label, preco_sem_ipi, preco_com_ipi}` | `product_properties.price_tiers_sm` |
| `caixa_master.dims` | `30x20x15 cm` | `product_properties.caixa_master_sm` |
| `caixa_master.qtd` | `24` (unidades por caixa) | `products.box_quantity` |
| `caixa_master.peso_kg` | `12.5` | `products.box_weight_kg` |
| `ncm_site` | `74182000` (validação) | `products.ncm_code` (fill-in) |
| `ipi_site` | `5.0` (validação) | `products.ipi_rate` (fill-in) |
| `estoque_site` | Estoque ao vivo | validação |
| `is_authenticated` | `true` | flag de sessão |

### Tabela de preços por volume (price_tiers)

Estrutura capturada via scraping autenticado:

```json
[
  { "qtd_label": "50 un",   "preco_sem_ipi": 12.50, "preco_com_ipi": 13.75 },
  { "qtd_label": "100 un",  "preco_sem_ipi": 11.20, "preco_com_ipi": 12.32 },
  { "qtd_label": "250 un",  "preco_sem_ipi": 10.00, "preco_com_ipi": 11.00 },
  { "qtd_label": "500 un",  "preco_sem_ipi":  9.30, "preco_com_ipi": 10.23 },
  { "qtd_label": "1000 un", "preco_sem_ipi":  8.80, "preco_com_ipi":  9.68 }
]
```

### Como configurar o cookie

1. Acessar `somarcas.com.br` e fazer login como revendedor
2. Copiar o cookie de sessão do browser (DevTools → Application → Cookies)
3. Atualizar o Vault Supabase: `UPDATE vault.secrets SET secret = '<cookie>' WHERE name = 'sm_session_cookie'`
4. O cron `sm-site-scrape-auth` passará o cookie no header `X-Set-Cookie` do Jina

---

## Fonte 4 — Jina Search (URL Discovery por produto)

**Host:** `s.jina.ai/site:somarcas.com.br+{codigo}`  
**source_channel:** `sm_url_discover` (em `sm_site_url_map.search_status`)  
**Auth:** Jina API key no Vault (`jina_api_key`) · ⚠️ placeholder — search limitada sem key  
**Frequência:** cron `sm-url-discover-search` a cada **10 minutos** (3 buscas/run)  
**Tabela destino:** `sm_site_url_map` (coluna `source = 'jina_search'`)  
**Status:** ⚠️ Dependente da API key — 0 descobertas sem autenticação

### Propósito

Mapear o `site_id` numérico para produtos do Bronze que **não aparecem** em nenhuma
página de produto scrapeada. Para cada `codigo` sem `site_id` em `sm_site_url_map`,
faz uma busca `site:somarcas.com.br AS-00610` no índice Jina e extrai a URL canônica.

### Pipeline de execução

```
1. fn_sm_url_discover_via_search(3)  → enfileira 3 buscas Jina Search
2. fn_sm_url_discover_collect(20)    → coleta resultados e extrai
                                       somarcas.com.br/{site_id}/produto/{slug}
3. sm_site_url_map atualizado        → site_id + slug → GENERATED site_url
4. produto elegível para Fonte 2/3   → próximo tick do sm-site-scrape o enfileira
```

### Estado atual

| Status | Entradas sem site_id |
|---|---|
| `null` (nunca buscado) | ~890 |
| `pending` (em voo) | 2 |
| `failed` (3 tentativas) | 5 |
| **Total sem site_id** | **~897** |

---

## Fonte 5 — Category Pages Scraping

**Host:** `r.jina.ai/somarcas.com.br/{category_id}/categorias/{slug}`  
**source_channel:** `sm_category_discover` (em `sm_category_pages.status`)  
**Auth:** Jina API key (opcional) · funciona sem key mas rate-limitado  
**Frequência:** cron `sm-category-enqueue` + `sm-category-collect` a cada **15 minutos**  
**Tabela destino:** `sm_site_url_map` (coluna `source = 'category_scrape'`)  
**Status:** ✅ 49 categorias seedadas · primeiras páginas em processamento

### Propósito

Cada página de categoria do site SM lista **todos os produtos** daquela categoria com
seus `site_id` e `slug`. Scrapeando as 49 categorias identificadas no Bronze, é possível
descobrir URLs em massa — cobrindo os ~897 produtos que a Fonte 4 não encontrou.

### Pipeline de execução

```
1. fn_sm_category_seed()           → 1x: popula sm_category_pages de matriz_de_categorias
2. fn_sm_category_enqueue(3)       → enfileira Jina Reader para cada categoria
3. fn_sm_category_collect(10)      → extrai (site_id, slug) de produtos na página
4. fn_sm_url_map_from_site_urls()  → slug-match com Bronze → atualiza sm_site_url_map
5. produto elegível para Fonte 2/3 → próximo tick do sm-site-scrape o enfileira
```

### Tabela `sm_category_pages`

| Coluna | Função |
|---|---|
| `name` | Nome da categoria (ex: Copos, Canecas, Squeezes e Garrafas) |
| `slug` | Slug slugificado da categoria |
| `category_id` | ID numérico no site SM (descoberto via scraping) |
| `site_url` | GENERATED: `somarcas.com.br/{category_id}/categorias/{slug}` |
| `status` | `pending` / `processing` / `done` / `failed` |
| `products_found` | Quantidade de produtos encontrados na página |

### Estado atual

| Status | Categorias |
|---|---|
| ✅ `done` | 0 (primeiras execuções em andamento) |
| 🔄 `processing` | 3 |
| ⏳ `pending` | 41 |
| ❌ `failed` | 0 |
| **Total** | **49** |

---

## Colunas `site_*` em `supplier_products_raw`

| Coluna | Função |
|---|---|
| `site_status` | `pending` / `processing` / `processed` / `failed` |
| `site_data` | JSONB completo capturado (Fontes 2 e 3) |
| `site_hash` | SHA-256 do `site_data` (detecta mudanças) |
| `site_scraped_at` / `site_processed_at` | Timestamps de scraping e processamento |
| `site_promoted_at` | Timestamp da última promoção ao Gold |
| `site_last_error` | Último erro (ex: cloudflare_challenge, resposta_curta) |
| `site_attempts` | Contador de tentativas (máx 5) |
| `site_fetch_req_id` | ID do request pg_net assíncrono |
| `site_source_url` | URL scrapeada (ex: somarcas.com.br/3458/produto/garrafa-...) |

---

## Tabela auxiliar `sm_site_url_map`

Mapeia `codigo` SM → `site_id` numérico → URL canônica do produto no site.
É a "ponte" que habilita as Fontes 2, 3 e 4.

| Coluna | Descrição |
|---|---|
| `codigo` | Código SM (ex: AS-00610) — FK para Bronze |
| `site_id` | ID numérico no site (ex: 3458) |
| `slug` | Slug da URL (ex: garrafa-em-aluminio-branco-600-ml) |
| `site_url` | GENERATED ALWAYS AS: `https://www.somarcas.com.br/{site_id}/produto/{slug}` |
| `source` | Como o mapeamento foi descoberto (`produtos_similares`, `related_products`, `category_scrape`, `jina_search`) |
| `confidence` | Confiança: `high` (products_similares, related) · `medium` (jina_search) |
| `validated` | `true` após 1º scrape bem-sucedido |

### Cobertura atual (2026-06-07)

| Source | Entradas com site_id | Método |
|---|---|---|
| `produtos_similares` | 155 | Parse do campo `produtos_similares` da API |
| `related_products` | 149 | Descoberto via scraping (cada página tem ~30 relacionados) |
| `category_scrape` | 40 | Pages de categoria |
| `jina_search` | 0 | Aguardando Jina API key |
| **Total com URL** | **344 / 1.215** | **28,3% de cobertura** |

---

## Comparativo das 5 fontes

| Informação | F1 API REST | F2 Site Público | F3 Site Auth | F4 Jina Search | F5 Categories |
|---|:---:|:---:|:---:|:---:|:---:|
| ID / código do produto | ✅ | — | — | — | — |
| Nome / Descrição | ✅ | — | — | — | — |
| Preço único (API) | ✅ | — | — | — | — |
| Preços por faixa de qtd | ❌ | ❌ | ✅ | — | — |
| NCM / IPI | ✅ | — | ✅ validado | — | — |
| Estoque | ✅ | — | ✅ ao vivo | — | — |
| Foto principal | ✅ | — | — | — | — |
| Galeria CDN completa (g/, p/) | ❌ | ✅ | ✅ | — | — |
| Spec técnica (.jpg/.png) | ❌ | ✅ | ✅ | — | — |
| Vídeo YouTube | ❌ | ✅ | ✅ | — | — |
| Dimensões caixa master | ❌ | ❌ | ✅ | — | — |
| URL canônica do produto | ❌ | ✅ | ✅ | — | — |
| Produtos relacionados | ⚠️ similares | ✅ | ✅ | — | — |
| site_id numérico do produto | ⚠️ via similares | ✅ via scraped | ✅ | ✅ | ✅ |
| Produtos de uma categoria | ❌ | ❌ | ❌ | ❌ | ✅ |
| Categorias do site | ⚠️ nome apenas | ❌ | ❌ | ❌ | ✅ |

---

## Situação de integração e próximos passos

| Fonte | Integrada | Automação | Ação |
|---|---|---|---|
| F1 · API REST | ✅ 1.161 produtos | ✅ pg_cron diário | Manter |
| F2 · Site Público | ✅ 48+ produtos | ✅ cron 5 min | Aguardar expansão da cobertura URL |
| F3 · Site Auth | ⚠️ pronta mas inativa | ✅ cron 20 min | **Configurar `sm_session_cookie` no Vault** |
| F4 · Jina Search | ⚠️ pronta mas limitada | ✅ cron 10 min | **Configurar `jina_api_key` no Vault** |
| F5 · Category Pages | ✅ 49 cats seedadas | ✅ cron 15 min | Aguardar primeiras execuções |

### Prioridade de configuração

1. **`sm_session_cookie`** → desbloqueia Fonte 3 → price_tiers e caixa_master para TODOS os scrapeados
2. **`jina_api_key`** → desbloqueia Fonte 4 → URL discovery para os ~897 produtos sem site_id
3. **`category_scrape` via Fonte 5** → rodando autonomamente → cobrirá os restantes em ~7 dias

---

## Histórico de mudanças

| Data | Versão | Mudança |
|---|---|---|
| 2026-06-07 | Pipeline v3 | Parser v3: filtra fotos /m/, aceita .jpg spec técnica, emite relacionados sem codigo |
| 2026-06-07 | — | fn_sm_url_map_from_site_urls v4: CTE (re-entrante) + ON CONFLICT só atualiza site_id IS NULL |
| 2026-06-07 | — | sm_category_pages criada: 49 categorias seedadas via fn_sm_category_seed |
| 2026-06-07 | — | fn_sm_pipeline_health: monitor JSON consolidado |
| 2026-06-07 | — | SECURITY DEFINER adicionado: fn_sm_site_collect, fn_sm_site_tick |
| 2026-06-07 | — | 10 bugs corrigidos (ver RELATORIO_TESTES_SM_2026-06-07.md) |
