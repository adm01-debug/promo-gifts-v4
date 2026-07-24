# Asia Import — Fontes de Dados

**Fornecedor:** Asia Import · `supplier_id = d2734e23-d633-4819-bb15-e51aa44e2118`
**Atualizado:** 2026-06-07

---

## Visão geral

A Asia Import disponibiliza **2 fontes integradas ao pipeline** (F1 e F2) e **4 canais auxiliares**
(consulta via MCP / integração futura). Os dados chegam por endpoints distintos e são consolidados
em `supplier_products_raw` antes de subirem para Silver e Gold.

```
┌──────────────────────────────────────────────────────────────────────────────┐
│   F1 — API Oficial          F2 — WC Store API        F3/C4/C5/C6 (aux)      │
│   api.asiaimport.com.br     s.asiaimport.com.br       s.asiaimport.com.br    │
│   POST form-urlencoded      /wp-json/wc/store/v1      hg/* / portal          │
│   api_key + secret_key      (público)                 (sessão autenticada)   │
└────────┬────────────────────────────┬──────────────────────────┬─────────────┘
         │                            │                          │
         ▼                            ▼                          ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                         supplier_products_raw                                │
│   raw_data (JSONB)  ← F1 (produto-pai + variações + estoque + reposição)    │
│   site_data (JSONB) ← F2 (preço promo, categorias WC, slug, imagens)        │
│   source_channel    ← identifica a origem de cada trilha                    │
└──────────────────────────────────────────────────────────────────────────────┘
         │
         ▼
  fn_standardize_supplier → fn_asia_to_silver → fn_process_raw_v2
         │
         ▼
  fn_site_to_silver_all → fn_asia_site_promote_to_gold
         │
         ▼
  products / product_variants  (camada GOLD)
```

**Workflow n8n:** `mG0X1FPmDMBXfrQK` · ASIA - GESTÃO DE PRODUTOS · **21 nós · ATIVO**
Schedule: a cada 30 min · F1 e F2 executam em paralelo

---

## F1 — API Oficial `api.asiaimport.com.br` ✅ ATIVO

**Host:** `api.asiaimport.com.br` (Cloudflare — IPs `104.21.56.185` / `172.67.155.73`)
**source_channel:** `api_oficial`
**Método:** `POST` · **Content-Type:** `application/x-www-form-urlencoded`
**Auth:** `api_key + secret_key` passados no body (não em header)
**Endpoint:** `https://api.asiaimport.com.br/` · **Função:** `listarProdutos2`
**Paginação:** `por_pagina=100` → 5 páginas (455 produtos-pai)
**Rate limit:** sem limite conhecido
**Status:** ✅ **ATIVO** — 5 páginas × 100 produtos via workflow n8n (desbloqueado 2026-06-07)

> **Histórico:** O endpoint `asia.ajung.site` (Oracle Cloud, IP `144.22.175.182`) estava
> bloqueado pelo Docker Swarm. O endpoint oficial `api.asiaimport.com.br` (Cloudflare)
> nunca teve restrição de IP e foi ativado em 2026-06-07.

### Credenciais (Vault / n8n)

| Chave | Valor |
|---|---|
| `api_key` | `6da9003b743b65f4c0ccd295cc484e57` |
| `secret_key` | `UrNgxMCMffttptllWr92dB6...bJI2` (128 chars) |
| Documentação | https://documenter.getpostman.com/view/4852314/2s9YJXa5nC |
| Contato API | rubens@asiaimport.com.br |

### Dimensão do catálogo (jun/2026)

455 produtos-pai · ~1.333 SKUs · R$ 0,48 → R$ 310,00

### RPC de ingestão

`fn_ingest_asia_api_batch(p_produtos jsonb)` — UPSERT no Bronze com hash guard.
Grain: **1 linha por produto-pai** (`supplier_sku = supplier_reference = referencia`).
Só atualiza `raw_data` e re-dispara `status='pending'` se `content_hash` mudou.

### Campos capturados — produto-pai

| Campo raw | Destino | Observação |
|---|---|---|
| `referencia` | `supplier_sku` / `supplier_reference` | Chave natural — formato `MC511P` (termina em P) |
| `nome` | `products.name` | — |
| `descricao` | `products.description` | Texto longo |
| `preco` | `products.suggested_price` | Preço tabela (string → float) |
| `promocao` | flag | `1` ou `0` |
| `status` | `is_active` | `1` ativo / `0` desativado |
| `origem_faturamento` | `supplier_branches` | `SP` ou `SC` |
| `imagem` | `products.primary_image_url` | URL absoluta |
| `galeria[]` | galeria | Array de URLs absolutas |
| `video` | `products.video_url` | URL embed YouTube |
| `altura` / `largura` / `comprimento` | `products.{height,width,length}_cm` | Centímetros |
| `peso` | `products.weight_g` | Vem em kg — converter ×1000 |
| `categorias{id: nome}` | `supplier_category_mappings` | Dict id→nome |
| `propriedades{chave: valor}` | propriedades | Dimensões, NCM, embalagem |
| `propriedades2{chave: valor}` | propriedades por extenso | Complementa propriedades |

### Campos capturados — variação/SKU

| Campo raw | Destino | Observação |
|---|---|---|
| `referencia` | `supplier_sku` variante | Formato `MC511` (sem P) |
| `nome` | `product_variants.name` | — |
| `preco` | `variant_supplier_sources.unit_price` | Preço da variação |
| `qtd_estoque` | `product_variants.stock_quantity` | Estoque total |
| `qtd_estoque_em_sp` | trilha SP | Estoque em SP (pode ser 0) |
| `ncm` | `products.ncm_code` | Por variação — `fn_normalize_ncm` trata |
| `imagem` | imagem da variante | URL absoluta |
| `color_id` | — | ⚠️ Frequentemente vazio — não confiável |
| `atributos.cor.{name, value, hexadecimal}` | `color_name` / `color_hex` | Hex confiável |
| `atributos.volume-litros.value` | `products.volume` | Ex: `29L` |
| `previsao_entrega[].{data, quantidade}` | reposição | ⚠️ `quantidade` é string — parsear para int |

> ⚠️ **Gotcha arquitetural (produto-pai × variação):**
> `MC511P` é o produto-pai (Bronze, `supplier_reference`).
> `MC511` é a variação (SKU, `supplier_sku`).
> O "P" no final diferencia os dois níveis — nunca confundir.

---

## F2 — WooCommerce Store API `s.asiaimport.com.br` ✅ ATIVO

**Host:** `s.asiaimport.com.br` · **Namespace:** `wc/store/v1` (WooCommerce Store API pública)
**source_channel:** detectado pelo n8n via `fn_upsert_asia_wp_batch`
**Auth:** pública (sem autenticação)
**Endpoint:** `GET /wp-json/wc/store/v1/products?per_page=100&page={n}`
**Paginação:** 5 páginas × 100 produtos
**Status:** ✅ **ATIVO** — mesmo workflow `mG0X1FPmDMBXfrQK`

> Dados do F2 são gravados em `site_data` (trilha separada de `raw_data`).
> A RPC `fn_upsert_asia_wp_batch` faz o grain bridge: 1 produto WC → N variantes Bronze
> via `raw_data->>'referencia'`.

### RPC de ingestão

`fn_upsert_asia_wp_batch(p_items jsonb)` — bridge WC→Bronze com md5 hash guard.
`fn_asia_wp_to_canonical(p_wp jsonb)` — converte payload WP Store API → shape canônico PT-keyed.

### Campos exclusivos (ausentes no F1)

| Campo WC | Destino Silver/Gold | Observação |
|---|---|---|
| `id` | — | ID interno WooCommerce |
| `prices.regular_price` | `regular_price` | Preço regular (minor units / 100) |
| `prices.sale_price` | `sale_price` | Preço promocional |
| `on_sale` | `is_on_sale` | Boolean |
| `categories[].name` / `.slug` | `supplier_category_mappings` | Hierarquia de categorias WC |
| `brands[].name` | `brand` | Marca do produto |
| `min_cart_quantity` | `moq` / `min_order_quantity` | Pedido mínimo |
| `slug` | — | Slug canônico para URL |
| `images[]` | galeria complementar | URLs absolutas |
| `attributes[pa_cor]` | `cores` (via F2) | Cores por term_id WC |

---

## F3 — WP REST API `hg/products` ⭐ (MCP disponível, não integrado)

**Host:** `s.asiaimport.com.br` · **Namespace:** `hg/products` (plugin customizado)
**Auth:** cookie WordPress (`wordpress_logged_in_*`) — sessão autenticada
**Endpoints:** `GET /wp-json/hg/products` · `GET /wp-json/hg/products/variations/{id}`
**Status:** MCP disponível (`ASIA IMPORT - MCP:portal_fetch`) · **não integrado ao pipeline raw**

### Campos exclusivos (ausentes em F1 e F2)

| Campo | Tipo | Exemplo | Utilidade |
|---|---|---|---|
| `susceptible_product` | bool | `true` | Produto suscetível a danos no transporte |
| `active_stock_sp` | bool | `false` | Rastreamento de estoque em SP ativo |
| `video_product[].embedUrl[]` | URL | `youtube.com/embed/…` | URL embed pronta para `<iframe>` |
| `tags[].color_bg` | hex | `#1e73be` | Cor de fundo da tag (UI/badges) |
| `tags[].color_text` | hex | `#ffffff` | Cor do texto da tag |
| `variations[].colors.slug` | string | `"azul"` | Slug canônico da cor |
| `variations[].colors.type` | string | `"color"` / `"-1"` | Sólida vs. material/textura |

---

## C4 — WP REST API `hg/atributes` ⭐ (MCP disponível, não integrado)

**Host:** `s.asiaimport.com.br` · **Namespace:** `hg/atributes`
**Auth:** cookie WordPress
**Endpoint principal:** `GET /wp-json/hg/atributes/products/colors` — tabela de 50 cores
**Status:** MCP disponível · **não integrado ao pipeline raw**

### Campos de cada cor

| Campo | Exemplo | Utilidade |
|---|---|---|
| `id` | `27` | ID canônico WooCommerce — chave estável para de-para |
| `slug` | `"azul"` | Para filtros e construção de URLs |
| `name` | `"Azul"` | Nome de exibição |
| `count` | `180` | Quantidade de SKUs nessa cor |
| `type` | `"color"` / `"-1"` | Sólida vs. material/textura |
| `color` | `"#0060d6"` | Código hexadecimal |
| `photo` | URL png 32×32 | Para cores materiais sem hex representativo |

Cores com `photo` (sem hex): Cromado · Inox · Madeira · Prata · Transparente.

---

## C5 — Portal WooCommerce `s.asiaimport.com.br` (MCP disponível)

**Auth:** login/senha → cookie WordPress · Renovação: ~25 min
**Conta:** `adm01@promobrindes.com.br`
**Status:** MCP disponível (`ASIA IMPORT - MCP:portal_*`) · **dados operacionais**

| Área | O que entrega | Status |
|---|---|---|
| Integrações | Chaves de API (`api_key` + `secret_key`) | ✅ Confirmadas |
| Pedidos | Histórico de encomendas da conta | ❌ 0 pedidos nesta conta |
| Fotos de Produtos | ZIPs por categoria com imagens em alta | ❌ 0 pacotes disponíveis |

---

## C6 — WP REST API `hg/bisa` (propósito desconhecido)

**Endpoints:** `GET /wp-json/hg/bisa` (discovery) · `POST /wp-json/hg/bisa/update`
**Status:** ❓ propósito desconhecido — **não usar antes de confirmar com a Asia Import**

> ⚠️ O método `POST /update` pode ter efeitos colaterais no sistema da fornecedora.
> Hipótese: webhook de sincronização B2B ou trigger de atualização de estoque.
> Ação: confirmar com rubens@asiaimport.com.br antes de qualquer uso.

---

## Comparativo das fontes

| Informação | F1 API Oficial | F2 WC Store API | F3 hg/products | C4 hg/atributes | C5 Portal |
|---|:---:|:---:|:---:|:---:|:---:|
| Catálogo de produtos | ✅ | ✅ | ✅ | — | — |
| Estoque por variante | ✅ | — | ✅ | — | — |
| Previsão de reposição | ✅ | — | — | — | — |
| Preço tabela | ✅ | ✅ | ✅ | — | — |
| Preço promocional separado | — | ✅ | ✅ | — | — |
| Origem fiscal (SP/SC) | ✅ | — | — | — | — |
| Estoque em SP | ✅ | — | — | — | — |
| NCM | ✅ | — | — | — | — |
| Dimensões físicas | ✅ | — | — | — | — |
| Peso | ✅ | — | — | — | — |
| Propriedades (embalagem, caixa) | ✅ | — | — | — | — |
| Galeria de imagens | ✅ | ✅ | ✅ | — | — |
| Vídeo YouTube | ✅ | — | ✅ embed pronto | — | — |
| Marca (brand) | — | ✅ | — | — | — |
| MOQ (mínimo de compra) | — | ✅ | — | — | — |
| Categorias hierárquicas | ✅ dict | ✅ WC | — | — | — |
| Cor + hex por variante | ✅ | — | ✅ slug | — | — |
| Tabela canônica de cores | — | — | — | ✅ 50 cores | — |
| Slug de cor (URLs/filtros) | — | — | ✅ | ✅ | — |
| `susceptible_product` | — | — | ✅ | — | — |
| Tags com estilo visual (hex) | — | — | ✅ | — | — |
| Foto para cores materiais | — | — | — | ✅ | — |
| Histórico de pedidos | — | — | — | — | ✅ |
| Chaves de integração API | — | — | — | — | ✅ |
| Fotos ZIP por categoria | — | — | — | — | ✅ |

---

## Pipeline de execução (estado atual)

```
Schedule 30min / Manual Trigger
  ├─► F1: Check Last F1 Sync → Calcular horas → IF ≥ 6h
  │       YES: F1 Gerar Páginas (1..5)
  │             → F1 Buscar Página API (POST api.asiaimport.com.br, form-urlencoded)
  │             → F1 Formatar Página (extrai produtos[])
  │             → F1 Upsert Bronze (fn_ingest_asia_api_batch)
  │             → F1 Resumo
  │       NO: F1 Resumo ─────────────────────────────────────┐
  │                                                           │
  ├─► F2: F2 Gerar Páginas (1..5)                            ▼
  │       → F2 Buscar Página WP (WC Store API pública)   Merge 3 Fontes (append)
  │       → F2 Formatar Página (extrai products[])            │
  │       → F2 RPC Upsert Site Data (fn_upsert_asia_wp_batch) │
  │       → F2 Resumo ──────────────────────────────────────┘ │
  │                                                            │
  └─► F3: F3 Cores WP (skipped_redundante) ─────────────────┘ │
                                                               ▼
                                              Process Staging Gold via RPC
                                                (fn_process_raw_v2)
                                                               │
                                                               ▼
                                              Site Silver: fn_site_to_silver_all
                                                               │
                                                               ▼
                                              Site Gold: fn_asia_site_promote_to_gold
                                                               │
                                                               ▼
                                                        Resumo Final
```

---

## Situação de integração e próximos passos

| Fonte | Integrada | Automação | Ação |
|---|---|---|---|
| F1 · API Oficial (`api.asiaimport.com.br`) | ✅ | ✅ n8n 30min | **ATIVO** — desbloqueado 2026-06-07 |
| F2 · WC Store API (`wc/store/v1`) | ✅ | ✅ n8n 30min | **ATIVO** — dados complementares (site_data) |
| F3 · `hg/products` | ❌ | ❌ | Mapear `susceptible_product`, tags com estilo, embed vídeo |
| C4 · `hg/atributes` | ❌ | ❌ | Enriquecer `supplier_colors` com id canônico, slug, count e photo |
| C5 · Portal WooCommerce | ❌ | ❌ | Consumir fotos ZIP quando disponíveis; confirmar uso das chaves |
| C6 · `hg/bisa` | ❌ | ❌ | ⚠️ Confirmar propósito com Asia Import antes de qualquer uso |

---

## Status do Bronze (referência)

| Métrica | Valor (jun/2026) |
|---|---|
| Total registros ASIA | 1.245 |
| Via F1 `source_channel=api_oficial` | 0 (primeiro ciclo em andamento) |
| Via F2 `site_status=processed` | ~MC511P, CAD004 (canários) |
| Pendentes site_data | ~1.241 |

> O primeiro ciclo completo do F1 ocorrerá no próximo tick do schedule (a cada 30 min).
> Os 455 produtos-pai serão processados em 5 lotes de 100 via `fn_ingest_asia_api_batch`.
