# XBZ Brindes — 4 Fontes de Dados

**Fornecedor:** XBZ Brindes · `supplier_id = d6718a29-e954-4c1b-bd84-03ea24884900`
**Atualizado:** 2026-06-06

---

## Visão geral

A XBZ é o fornecedor com a arquitetura de ingestão mais rica da plataforma. Seus dados chegam
por **4 fontes complementares**, cada uma cobrindo campos que as demais não fornecem.

```
┌─────────────────────────────────────────────────────────────────────┐
│  FONTE 1          FONTE 2         FONTE 3         FONTE 4           │
│  /api/clientes/   /api/ruiz/      /api/carrinho/  Site scraping     │
│  (oficial)        (portal)        (portal)        xbzbrindes.com.br │
└──────┬───────────────┬───────────────┬───────────────┬──────────────┘
       │               │               │               │
       ▼               ▼               ▼               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    supplier_products_raw                            │
│   raw_data (JSONB)   source_channel    site_data (JSONB)            │
│   ← Fontes 1, 2, 3   ← identifica     ← Fonte 4                   │
└─────────────────────────────────────────────────────────────────────┘
       │                                               │
       ▼                                               ▼
  fn_process_staged_product                  fn_site_to_silver_all
  + supplier_field_mappings                  fn_site_promote_to_gold
       │                                               │
       └───────────────────┬───────────────────────────┘
                           ▼
                  products / product_variants
                       (camada GOLD)
```

---

## Fonte 1 — API Oficial `/api/clientes/`

**Host:** `api.minhaxbz.com.br` · **source_channel:** `api_clientes`
**Auth:** CNPJ + token (header) · **Rate limit:** 36 req/dia
**Endpoint:** `/GetListaDeProdutos` — 30 campos
**Status:** ingestão via upload manual (`_source = file_upload`) · n8n **INATIVO**

### Campos capturados

| Campo raw | Destino | Observação |
|---|---|---|
| `CodigoAmigavel` | `supplier_reference` (pai) | Autoritativo — 100% preenchido |
| `CodigoComposto` | `supplier_sku` / `sku` variante | Formato `<ref>-<corCodigo>` |
| `CodigoXbz` | referência interna XBZ | — |
| `IdProduto` | referência interna XBZ | — |
| `Nome` | `products.name` | — |
| `Descricao` | `products.description` | Descrição básica |
| `Ncm` | `products.ncm_code` | 100% preenchido |
| `Peso` | `products.weight_g` | Vem em kg — de-para converte para g |
| `Altura` | `products.height_cm` | ⚠️ Frequentemente **0** |
| `Largura` | `products.width_cm` | ⚠️ Frequentemente **0** |
| `Profundidade` | `products.length_cm` | ⚠️ Frequentemente **0** |
| `CorWebPrincipal` | `product_variants.color_name` | Nome da cor |
| `CorWebPrincipalId` | — | ID da cor (23 cores catalogadas) |
| `QuantidadeDisponivel` | `product_variants.stock_quantity` | Estoque por variante |
| `PrecoVenda` | `products.suggested_price` | Preço tabela (≠ custo real) |
| `ImageLink` | `products.primary_image_url` | CDN XBZ |
| `SiteLink` | — | URL da página (regra inativa) |
| `WebTipo` / `WebSubTipo` | — | ⚠️ Frequentemente vazio → categorização fraca |

### Limitações

- Dimensões chegam como **zero** na maioria dos produtos → coberto pela Fonte 4.
- `CorWebSecundaria` (bicolores, 99% dos produtos) **não capturada**.
- Campos comerciais ausentes: `Multiplos`, `IpiTaxa`, `Disponivel` → Fonte 3.

---

## Fonte 2 — Portal `/api/ruiz/`

**Host:** `api.minhaxbz.com.br` · **source_channel:** `api_ruiz`
**Auth:** usuário + senha · **Rate limit:** sem limite
**Status:** MCP disponível · **não integrado ao pipeline raw**

### Endpoints relevantes

| Endpoint | Dados |
|---|---|
| `consultaEstoque` | Catálogo com disponibilidade real, mínimos de compra |
| `getSt` | Dados fiscais: **ICMS-ST, IPI%, NCM**, base de cálculo |
| `produtosCores` | Tabela mestra das 23 cores (Id, NomeCor, SiglaCor) |
| `consultaPedidos` | Histórico de pedidos |

> As regras de `supplier_field_mappings` para `Multiplos`, `Disponivel` e `IpiTaxa` já existem
> — falta apenas os dados entrarem no `raw_data` via esta fonte.

---

## Fonte 3 — Portal `/api/carrinho/`

**Host:** `api.minhaxbz.com.br` · **source_channel:** `api_carrinho`
**Auth:** usuário + senha · **Rate limit:** sem limite
**Status:** MCP disponível · **não integrado ao pipeline raw**

### Campos comerciais disponíveis

| Campo | Destino no pipeline | Situação |
|---|---|---|
| `Multiplos` | `variant_supplier_sources.sale_multiplier` | Regra existe, campo vazio |
| `Disponivel` | `variant_supplier_sources.supplier_availability_status` | Regra existe, campo vazio |
| `IpiTaxa` | `variant_supplier_sources.supplier_ipi_rate` | Regra existe, campo vazio |

---

## Fonte 4 — Scraping do site `xbzbrindes.com.br`

**source_channel:** `site_scraping`
**Tecnologia:** Jina AI Reader (`r.jina.ai`) — renderização headless, bypass Cloudflare
**Auth:** API key no Vault (`jina_api_key`) · fallback free tier
**Frequência:** cron `xbz-site-scrape` a cada **2 minutos** · **ATIVO** ✅
**Parser version:** `2.2-html`

### Pipeline de execução (`fn_xbz_site_tick`)

```
1. fn_xbz_site_collect(40)      → lê respostas HTML da fila pg_net e parseia
2. fn_xbz_site_enqueue(10, 7)   → enfileira novas URLs via r.jina.ai
3. fn_site_to_silver_all()      → padroniza e normaliza os dados capturados
4. fn_site_flag_divergent()     → detecta divergências de integridade
5. fn_site_promote_to_gold()    → promove somente novos ao gold (products)
```

Cron: `SELECT public.fn_xbz_site_tick(10, 40, 7)` (enqueue=10, collect=40, stale_days=7)
Watchdog: desbloqueia `processing` parados > 30 min. Máx 5 tentativas por produto.

### Campos capturados (`site_data` JSONB em `supplier_products_raw`)

| Campo | Exemplo |
|---|---|
| `nome` | `Bloco de Anotações Ecológico com Caneta` |
| `descricao` | Texto completo com materiais e especificações |
| `modo_de_uso` | Instruções de uso extraídas da página |
| `dimensoes.altura_cm` | — |
| `dimensoes.largura_cm` | `9` |
| `dimensoes.profundidade_cm` | — |
| `dimensoes.circunferencia_cm` | Para itens cilíndricos |
| `dimensoes.diametro_cm` | Para itens circulares |
| `peso_g` | `74` |
| `gravacao.medida_texto` | `11,7 cm x 8,8 cm / Caneta - 3 cm x 0,7 cm` |
| `gravacao.comprimento_cm` | `11.7` |
| `gravacao.largura_cm` | `8.8` |
| `gravacao.local` | Local de aplicação |
| `cores` | Array com nome + swatch_url de todas as cores |
| `imagens` | Galeria ordenada (principal + galeria) |
| `video` | YouTube embed quando presente |
| `ficha_tecnica_pdf` | Link PDF do produto |
| `categorias` | Hierarquia nível 1 e 2 com path e URL |
| `relacionados` | Códigos de produtos relacionados |

### Colunas `site_*` em `supplier_products_raw`

| Coluna | Função |
|---|---|
| `site_status` | `pending` / `processing` / `processed` / `failed` |
| `site_data` | JSONB completo capturado |
| `site_hash` | SHA-256 do `site_data` (detecta mudanças) |
| `site_scraped_at` / `site_processed_at` | Timestamps |
| `site_last_error` | Último erro |
| `site_attempts` | Contador (máx 5) |
| `site_fetch_req_id` | ID do request pg_net assíncrono |
| `site_source_url` | URL raspada |

### Status (2026-06-06)

| Status | Linhas | Produtos únicos |
|---|---|---|
| ✅ `processed` | 1.570 | 394 (~12%) |
| ⏳ `pending` | 9.774 | 3.232 |
| 🔄 `processing` | 27 | 10 |
| ❌ `failed` | 287 | 114 (esgotaram 5 tentativas) |

---

## Comparativo das 4 fontes

| Informação | F1 `/api/clientes/` | F2 `/api/ruiz/` | F3 `/api/carrinho/` | F4 Scraping |
|---|:---:|:---:|:---:|:---:|
| ID produto-pai | ✅ | ✅ | — | ✅ |
| SKU da variante | ✅ | ✅ | — | — |
| Nome / Descrição | ✅ básica | — | — | ✅ completa |
| Modo de uso | ❌ | ❌ | ❌ | ✅ |
| NCM | ✅ | ✅ fiscal | — | — |
| ICMS-ST / IPI% | ❌ | ✅ | — | — |
| Dimensões reais | ⚠️ zeros | — | — | ✅ |
| Peso (gramas) | ⚠️ impreciso | — | — | ✅ |
| Área de gravação | ❌ | ❌ | ❌ | ✅ |
| Cor principal | ✅ | — | — | — |
| Todas as cores + swatch | ⚠️ só 1 | ✅ | — | ✅ |
| Estoque | ✅ | ✅ real | — | — |
| Preço tabela | ✅ | — | — | — |
| Múltiplos de venda | ❌ | ✅ | ✅ | — |
| Disponibilidade real | ❌ | ✅ | ✅ | — |
| Taxa IPI | ❌ | ✅ | ✅ | — |
| Galeria de imagens | ⚠️ só 1 | — | — | ✅ ordenada |
| Vídeo YouTube | ❌ | ❌ | ❌ | ✅ |
| Ficha técnica PDF | ❌ | ❌ | ❌ | ✅ |
| Categorias hierárquicas | ⚠️ vazio | — | — | ✅ nível 1+2 |
| Produtos relacionados | ❌ | ❌ | ❌ | ✅ |

---

## Situação de integração e próximos passos

| Fonte | Integrada | Automação | Ação |
|---|---|---|---|
| F1 · `/api/clientes/` | ✅ | ⚠️ n8n inativo | Reativar workflow n8n |
| F2 · `/api/ruiz/` | ❌ | ❌ | Integrar `consultaEstoque` + `getSt` ao `raw_data` |
| F3 · `/api/carrinho/` | ❌ | ❌ | Integrar campos VSS (regras já existem no de-para) |
| F4 · Site scraping | ✅ | ✅ cron 2min | Acompanhar conclusão (~88% pendente) |
