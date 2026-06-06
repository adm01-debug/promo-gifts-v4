# Asia Import — 5 Fontes de Dados

**Fornecedor:** Asia Import · `supplier_id = d2734e23-d633-4819-bb15-e51aa44e2118`
**Atualizado:** 2026-06-06

---

## Visão geral

A Asia Import disponibiliza **5 canais de dados distintos**. Atualmente o pipeline consome apenas
o Canal 1 (API Pública) de forma parcial. Os Canais 3 e 4 foram descobertos via exploração ao
vivo do WP REST API e contêm informações complementares ainda não aproveitadas.

```
┌──────────────────────────────────────────────────────────────────────┐
│  CANAL 1          CANAL 2          CANAL 3/4/5                       │
│  API Pública      Portal           WP REST API                       │
│  asia.ajung.site  s.asiaimport     s.asiaimport                      │
│  (sem auth)       (login/senha)    hg/products · hg/atributes        │
└──────┬──────────────────┬──────────────────┬───────────────────────┘
       │                  │                  │
       ▼                  ▼                  ▼
┌──────────────────────────────────────────────────────────────────────┐
│                       supplier_products_raw                          │
│   raw_data (JSONB) ← Canal 1 (produto + estoque + reposição)         │
│   + campos complementares ← Canais 3 e 4 (a integrar)               │
└──────────────────────────────────────────────────────────────────────┘
       │
       ▼
  fn_standardize_supplier (fn_asia_to_silver)
       │
       ▼
  products / product_variants
       (camada GOLD)
```

---

## Canal 1 — API Pública `asia.ajung.site`

**Host:** `asia.ajung.site` · **source_channel:** `api_rest`
**Auth:** nenhuma — endpoint público · **Rate limit:** sem limite conhecido
**Endpoint:** `GET /api/products` — produto-pai com variações, estoque e reposição embutidos
**Status:** ingestão parcial via MySQL/legado · **n8n INATIVO**

### Dimensão do catálogo (ao vivo, jun/2026)

455 produtos-pai · 1.333 SKUs · 7.083.662 unidades em estoque · R$ 0,48 → R$ 310,00

### Campos capturados — produto-pai

| Campo raw | Destino | Observação |
|---|---|---|
| `referencia` | `supplier_reference` (pai) | Autoritativo — 100% preenchido |
| `nome` | `products.name` | — |
| `descricao` | `products.description` | Texto longo com componentes |
| `preco` | `products.suggested_price` | Preço tabela |
| `promocao` | flag | ⚠️ boolean nativo |
| `status` | `is_active` | ⚠️ chega como string `"true"`/`"false"` — coerção obrigatória |
| `origem_faturamento` | `supplier_branches` | `SP` ou `SC` |
| `imagem` | `products.primary_image_url` | URL absoluta |
| `dimensoes_cm.{altura,largura,comprimento}` | `products.{height,width,length}_cm` | Estruturado |
| `peso_kg` | `products.weight_g` | Converter ×1000 para gramas |
| `ncm` | `products.ncm_code` | Com ponto (`4820.20.00`) — `fn_normalize_ncm` trata |
| `categorias[].{id, nome}` | `supplier_category_mappings` | Array com id interno |
| `tags[].{id, nome}` | tags | Array com id interno |
| `embalagem.{tipo, quant_por_caixa, dimensao_caixa, peso_caixa}` | embalagem | Objeto estruturado |
| `galeria[]` | galeria | Array de URLs absolutas |
| `video` | `products.video_url` | URL embed YouTube simples |

### Campos capturados — variação/SKU

| Campo raw | Destino | Observação |
|---|---|---|
| `sku` | `supplier_sku` (chave natural base) | Formato `{referencia}-{sigla_cor}` (ex: `CAD005-AZ`) |
| `cor` | `product_variants.color_name` | Nome da cor |
| `cor_hex` | `product_variants.color_hex` | Código hex |
| `color_id` | — | ⚠️ Sempre vazio — não confiável |
| `preco` | `variant_supplier_sources.unit_price` | Preço da variação |
| `qtd_estoque` | `product_variants.stock_quantity` | Estoque total |
| `qtd_estoque_em_sp` | trilha SP | Estoque em SP (pode ser 0) |
| `capacidade` | `products.capacity` | Preenchido em garrafas/squeezes |
| `volume` | `products.volume` | Idem |
| `previsao_entrega[].{data, quantidade}` | reposição | ⚠️ `quantidade` é string — parsear para int |

### Chave natural no Bronze

```
supplier_sku = "referencia|COR"    (ex: "CAD005|Azul")
```
> ⚠️ **Gotcha crítico:** usar apenas `referencia` como chave (sem a cor) causa loop
> infinito no `fn_asia_batch_to_silver`. A cor é parte obrigatória da chave composta.

---

## Canal 2 — Portal WooCommerce `s.asiaimport.com.br`

**Host:** `s.asiaimport.com.br` · Plataforma: WordPress + WooCommerce
**Auth:** login/senha → cookie WordPress (`wordpress_logged_in_*`) · Renovação: ~25 min
**Conta:** `adm01@promobrindes.com.br`
**Status:** MCP disponível · **não integrado ao pipeline raw**

### Áreas disponíveis

| Área | O que entrega | Status |
|---|---|---|
| Integrações | Chaves de API (`api_key` + chave secundária) | ⚠️ Encontradas; propósito a confirmar |
| Pedidos | Histórico de encomendas | ❌ 0 pedidos nesta conta |
| Fotos de Produtos | ZIPs por categoria com imagens em alta | ❌ 0 pacotes disponíveis |

---

## Canal 3 — WP REST API `hg/products` ⭐

**Host:** `s.asiaimport.com.br` · **Namespace:** `hg/products` (plugin customizado)
**Auth:** cookie WordPress (sessão autenticada)
**Endpoints:** `GET /wp-json/hg/products` (455 produtos) · `GET /wp-json/hg/products/variations/{id}`
**Status:** MCP disponível · **não integrado ao pipeline raw**

### Campos exclusivos (ausentes no Canal 1)

| Campo | Tipo | Exemplo | Utilidade |
|---|---|---|---|
| `id` | int | `19574` | ID interno WooCommerce do produto-pai |
| `susceptible_product` | bool | `true` | Produto suscetível a danos no transporte |
| `active_stock_sp` | bool | `false` | Se rastreamento de estoque em SP está ativo |
| `sale_price` | string | `""` | Preço promocional separado do preço regular |
| `stock_quantity` | string | `"92.944"` | Estoque total formatado (todas as variações) |
| `characteristics_images.featured_image` | URL | — | Imagem de características do produto |
| `video_product[].src` | URL | URL thumbnail | Miniatura do vídeo |
| `video_product[].embedUrl[]` | URL | `youtube.com/embed/…` | URL de embed já formatada para `<iframe>` |
| `tags[].color_bg` | hex | `#1e73be` | Cor de fundo da tag (para UI/badges) |
| `tags[].color_text` | hex | `#ffffff` | Cor do texto da tag |
| `tags[].hidden` | bool | `false` | Se a tag deve ser exibida |
| `variations[].id` | int | `19576` | ID interno WooCommerce da variação |
| `variations[].colors.slug` | string | `"azul"` | Slug canônico da cor |
| `variations[].colors.type` | string | `"color"` / `"-1"` | Sólida vs. material/textura |

---

## Canal 4 — WP REST API `hg/atributes` ⭐

**Host:** `s.asiaimport.com.br` · **Namespace:** `hg/atributes`
**Auth:** cookie WordPress (sessão autenticada)
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

### Cores com `photo` (materiais especiais)

Cromado · Inox · Madeira · Prata · Transparente — estas cores usam imagem em vez de hex.

### Outros endpoints disponíveis

`/hg/atributes/color/{slug}` · `/hg/atributes/category/colors/{slug}` ·
`/hg/atributes/category/capacity/{slug}` · `/hg/atributes/tag/volume/{slug}`

---

## Canal 5 — WP REST API `hg/bisa`

**Host:** `s.asiaimport.com.br` · **Namespace:** `hg/bisa`
**Auth:** cookie WordPress (sessão autenticada)
**Endpoints:** `GET /wp-json/hg/bisa` (discovery) · `POST /wp-json/hg/bisa/update`
**Status:** ❓ propósito desconhecido — **não usar antes de confirmar com a Asia Import**

> ⚠️ O método `POST /update` pode ter efeitos colaterais no sistema da fornecedora.
> Hipótese: webhook de sincronização B2B ou trigger de atualização de estoque.
> Ação: acionar equipe técnica da Asia Import para confirmar antes de qualquer uso.

---

## Comparativo dos 5 canais

| Informação | C1 API Pública | C2 Portal WC | C3 hg/products | C4 hg/atributes | C5 hg/bisa |
|---|:---:|:---:|:---:|:---:|:---:|
| Catálogo de produtos | ✅ | — | ✅ | — | — |
| Estoque por variante | ✅ | — | ✅ | — | — |
| Previsão de reposição | ✅ | — | — | — | — |
| Preço tabela | ✅ | — | ✅ | — | — |
| Preço promocional separado | — | — | ✅ | — | — |
| ID interno WooCommerce | — | — | ✅ | — | — |
| `susceptible_product` | — | — | ✅ | — | — |
| `active_stock_sp` | — | — | ✅ | — | — |
| Tags com estilo visual (hex) | — | — | ✅ | — | — |
| URL embed vídeo pronta | — | — | ✅ | — | — |
| Tabela canônica de cores | — | — | — | ✅ | — |
| Slug de cor (para URLs/filtros) | — | — | — | ✅ | — |
| Count de SKUs por cor | — | — | — | ✅ | — |
| Foto para cores materiais | — | — | — | ✅ | — |
| NCM | ✅ | — | — | — | — |
| Origem fiscal (SP/SC) | ✅ | — | — | — | — |
| Dimensões do produto | ✅ | — | — | — | — |
| Galeria de imagens | ✅ | — | ✅ | — | — |
| Histórico de pedidos | — | ✅ | — | — | — |
| Chaves de integração | — | ✅ | — | — | — |
| Fotos ZIP por categoria | — | ✅ | — | — | — |

---

## Situação de integração e próximos passos

| Canal | Integrado | Automação | Ação |
|---|---|---|---|
| C1 · API Pública | ⚠️ Parcial | ❌ MySQL/legado inativo | Implementar `ING-ASIA-PRODUCTS` no n8n |
| C2 · Portal WooCommerce | ❌ | ❌ | Confirmar uso das chaves; consumir fotos ZIP quando disponíveis |
| C3 · `hg/products` | ❌ | ❌ | Mapear `susceptible_product`, `active_stock_sp`, tags com estilo para Silver |
| C4 · `hg/atributes` | ❌ | ❌ | Enriquecer `supplier_colors` com id canônico, slug, count e photo |
| C5 · `hg/bisa` | ❌ | ❌ | ⚠️ Confirmar propósito com Asia Import antes de qualquer uso |
