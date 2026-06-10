# Mapeamento de Fontes de Informação — Promo Brindes
> **Projeto:** promo-gifts-v4 · Supabase `doufsxqlfjyuvxuezpln` (PG 17, sa-east-1)  
> **Escopo:** todos os fornecedores e canais de dados que alimentam o catálogo  
> **Versão:** 1.1 · **Data:** jun/2026  
> **Classificação:** USO INTERNO

> 📁 **Documentação detalhada por fornecedor:** [`SPOT/README.md`](./SPOT/README.md) · [`SPOT/SPOT_ANALISE_PORTAL_WEB.md`](./SPOT/SPOT_ANALISE_PORTAL_WEB.md) · [`SPOT/SPOT_CATALOGO_CAMPOS_API.md`](./SPOT/SPOT_CATALOGO_CAMPOS_API.md)

---

## 1. Visão Geral

O catálogo Promo Brindes é alimentado por **5 fornecedores distintos**, cada um com seu próprio canal, protocolo de autenticação, formato e cadência de dados. Além disso, o fornecedor principal (SPOT) possui **3 subcanais** com características diferentes.

### Fornecedores ativos

| # | Fornecedor | Supplier ID | Status atual | Volume estimado |
|---|---|---|---|---|
| 1 | **SPOT / Stricker** | `bcfc0d02-44c6-48ae-8472-12b1a3f3d8e0` | ✅ Bronze populado (~3.612 SKUs) | 1.200 produtos-pai |
| 2 | **XBZ** | `d6718a29-e954-4c1b-bd84-03ea24884900` | ✅ Ativo via pg_cron | ~11.600 SKUs |
| 3 | **Asia Import** | `d2734e23-d633-4819-bb15-e51aa44e2118` | ⚠️ Parcial | ~1.200 produtos-pai |
| 4 | **Só Marcas** | `841cd690-210a-422a-908c-7676828db272` | ⚠️ Parcial | ~1.200 SKUs |
| 5 | **88 Brindes** | — | 🔴 Órfão (40 linhas, sem ingestão ativa) | 40 linhas |

---

## 2. SPOT / Stricker — 3 Canais Distintos

O SPOT é o fornecedor mais complexo: possui **3 canais de dados com autenticações e propósitos diferentes**.

> 📁 **Documentação completa do SPOT:** [`SPOT/README.md`](./SPOT/README.md)

### 2.1 Canal A — Webservice API (AccessKey → Token)

**URL base:** `https://ws.spotgifts.com.br/api/v1SSL`  
**Autenticação:** `POST /AuthenticateClient` com `AccessKey` → retorna token de sessão  
**Segredo:** `SPOT_ACCESS_KEY` (Vault Supabase + getter `fn_get_spot_access_key()`)  
**Propósito:** ✅ **Alimenta o Bronze — único canal de ingestão de catálogo**

| Feed | Chave | O que entrega | Volume | Limite/dia | Cadência |
|---|---|---|---|---|---|
| `OptionalsComplete` | `Sku` | **TUDO sobre o produto** (~230 campos por SKU) | ~27 MB | **22** | 1×/dia 03:00 |
| `Stocks` | `Sku` | Estoque atual + 6 janelas de reposição futura | leve | **96** | */30 min |
| `CustomizationTables` | `TableCodeOption` | Preços de personalização (15 faixas + SLA) | ~289 linhas | 22 | 1×/semana |
| `Colors` | `ColorCode` | Tabela de 52 cores (código → descrição → hex) | 52 linhas | 22 | 1×/semana |
| `ProductTypes` | `TypeCode` | Taxonomia (31 tipos + subtipos) | 31 linhas | 22 | 1×/semana |
| `CanceledProducts` | ref | Produtos descontinuados → `is_active=false` | variável | 22 | ao fim de cada full-pull |

#### O que o `OptionalsComplete` entrega (feed-mãe):

```
OptionalsComplete — 1 linha por SKU ({ProdReference}-{ColorCode})
  │
  ├── IDENTIDADE     → Sku, WebSku, ProdReference, Multiplier, UpdateDate
  ├── NOME/DESCRIÇÃO → Name, ShortDescription, Description, SEO*
  ├── COR            → ColorCode, ColorDesc1, ColorHex1
  ├── PREÇO          → MinQt1..5 / Price1..5 (5 faixas de quantidade)
  ├── FÍSICO         → CombinedSizes, Weight, BoxWeightKG, BoxVolume
  ├── CATEGORIAS     → Type/TypeCode, SubType/SubTypeCode, Catalogs
  ├── EMBALAGEM      → Packing, Repacking, BoxInnerQty, BoxQuantity
  ├── PERSONALIZAÇÃO → CustomizationTypes, Area1..8, Component1..8,
  │                    Location1..8, TableCodesOptions1..8 (8 posições)
  ├── IMAGENS        → MainImage, AllImageList, BoxImage, Area{n}Image,
  │                    Component{n}Image, Location{n}Image
  ├── VÍDEO          → VideoLink (YouTube), VideoLinkVimeo, Video360
  └── TAGS/FLAGS     → KeyWords, Properties, Certificates, IsTextil,
                       IsStockOut, NewProduct, PvcFree, NoReplenishment
```

> 📄 Catálogo completo com fill-rate por campo: [`SPOT/SPOT_CATALOGO_CAMPOS_API.md`](./SPOT/SPOT_CATALOGO_CAMPOS_API.md)

#### Onde cada feed aterra no Bronze:

| Feed | Tabela destino | Campo / trilha |
|---|---|---|
| `OptionalsComplete` | `supplier_products_raw` | `raw_data` (jsonb, as-is) |
| `Stocks` | `supplier_products_raw` | `stock_data` (trilha separada) |
| `CustomizationTables` | `supplier_customization_raw` | 1 linha por `table_code_option` |
| `Colors` | `supplier_colors` | de-para |
| `ProductTypes` | `supplier_category_mappings` | de-para |
| `CanceledProducts` | `supplier_products_raw` | `is_active = false` |

---

### 2.2 Canal B — Portal Web Público (sem autenticação)

**URL base:** `https://www.spotgifts.com.br`  
**Autenticação:** nenhuma — endpoints abertos ao público  
**Propósito:** ⚠️ **Complementar / não usado no pipeline principal**

| Endpoint | O que entrega | Uso no pipeline |
|---|---|---|
| `GET /pt/catalogo/ajax/pesquisar.php` | Busca rápida (até 5 resultados) | ❌ Não usado |
| `POST /pt/catalogo/catalogo.ajax.php` (getStockWarehouses) | Estoque por armazém físico | ⚠️ Opcional/complementar |
| `GET /pt/produto/ajax/carregaPersonalizacoes.php` | HTML de personalização do produto | ❌ Não usado |
| `GET /pt/produto/ajax/carregaRelacionados.php` | Produtos relacionados | ❌ Não usado |

> **Nota:** o `getStockWarehouses` é o único endpoint deste canal com alguma utilidade para dados — e mesmo assim é redundante com o feed `Stocks` do webservice.

---

### 2.3 Canal C — Portal Web Autenticado (login + senha → PHPSESSID)

**URL base:** `https://www.spotgifts.com.br`  
**Autenticação:** `POST /pt/area-reservada/login/` → cookie `PHPSESSID`  
**Propósito:** ❌ **Dados operacionais — fora do escopo do catálogo**

| Endpoint | O que entrega |
|---|---|
| `getSemaforo` | Semáforo de disponibilidade (verde/amarelo/vermelho) |
| `/pt/loja/*` | Carrinho, checkout, cálculo de frete |
| `/pt/simulador/*` | Simulador de personalização |
| `/pt/clientes/*` | Pedidos, faturas, notas fiscais |
| `/pt/maquetas_guardadas/*` | Layouts salvos de personalização |
| `/pt/orcamentos/*` | Orçamentos comparativos |

#### ⚠️ Alertas do Canal C:

| Alerta | Detalhe |
|---|---|
| 🔴 Bloqueio geolocalizado | Acesso de IP fora do Brasil pode bloquear a conta |
| 🔴 Sem 2FA | Nenhum segundo fator de autenticação |
| 🟡 Sem CSRF Token | Endpoints POST sem proteção CSRF |
| 🟡 Sessão por cookie | `PHPSESSID` expira ao fechar o browser |

> 📄 Análise técnica completa (28 endpoints, 19 módulos JS, segurança): [`SPOT/SPOT_ANALISE_PORTAL_WEB.md`](./SPOT/SPOT_ANALISE_PORTAL_WEB.md)

---

## 3. XBZ — API REST + pg_cron

**URL base:** `https://api.minhaxbz.com.br:5001`  
**Autenticação:** token em header (⚠️ hoje exposto na query string — corrigir)  
**Mecanismo atual:** Supabase **pg_cron** (não n8n)  
**Propósito:** ✅ Alimenta o Bronze — ingestão ativa e fresca

| Job pg_cron | Cadência | O que faz |
|---|---|---|
| `xbz-site-scrape` | */2 min | Scraping dos produtos XBZ → Bronze |
| `xbz-stock-sync` | periódico | Sincronização de estoque |
| `xbz-enrich` | periódico | Enriquecimento de dados |

**Chave natural:** `referencia` + variação (a confirmar formato exato)

**Status de migração:** 🟡 Manter no pg_cron. Migrar para n8n por ÚLTIMO, após shadow run de ≥ 3–5 dias confirmando paridade.

---

## 4. Asia Import — API REST

**URL base:** `https://asia.ajung.site/api/products`  
**Autenticação:** a confirmar  
**Mecanismo atual:** ⚠️ parcial (MySQL/parcial)

**Chave natural:** `referencia|COR` (composto)
> ⚠️ **Gotcha crítico:** usar só `referencia` como chave (sem a cor) causa loop infinito no batch de deduplicação.

---

## 5. Só Marcas — API REST

**URL base:** `https://www.somarcas.com.br/api-lista-preco-revenda-v1-0-0.php`  
**Autenticação:** a confirmar  
**Mecanismo atual:** ⚠️ parcial (MySQL/parcial)  
**Cadência alvo:** 1×/dia 04:00 (com stagger)

---

## 6. 88 Brindes — A Descobrir

**Status:** 🔴 Órfão — 40 linhas no Bronze sem ingestão ativa. API a descobrir.

---

## 7. Matriz Consolidada — Todos os Canais

| Fornecedor | Canal | Auth | Formato | Tabela destino | Status pipeline |
|---|---|---|---|---|---|
| SPOT | Webservice API (`ws.spotgifts.com.br`) | AccessKey → token | JSON | `supplier_products_raw` + `supplier_customization_raw` | ✅ Bronze populado |
| SPOT | Portal público (`www.spotgifts.com.br`) | Nenhuma | HTML/JSON | — | ⚠️ Complementar |
| SPOT | Portal autenticado (`www.spotgifts.com.br`) | login/senha → PHPSESSID | HTML/JSON | — | ❌ Fora do escopo de catálogo |
| XBZ | API REST | token (header) | JSON | `supplier_products_raw` | ✅ Ativo via pg_cron |
| Asia Import | API REST | a confirmar | JSON | `supplier_products_raw` | ⚠️ Parcial |
| Só Marcas | API REST | a confirmar | JSON/CSV | `supplier_products_raw` | ⚠️ Parcial |
| 88 Brindes | A descobrir | a definir | — | `supplier_products_raw` | 🔴 Órfão |

---

## 8. Fluxo Consolidado (estado-alvo)

```
┌─────────────────────────────────────────────────────────────┐
│                    FONTES DE DADOS                          │
├──────────────────┬──────────────────┬───────────────────────┤
│  SPOT Webservice │  XBZ API REST    │  Asia / SóMarcas /    │
│  (AccessKey)     │  (pg_cron)       │  88Brindes (n8n)      │
│  6 feeds         │  2 jobs          │  1 endpoint cada      │
└────────┬─────────┴────────┬─────────┴──────────┬────────────┘
         │                  │                     │
         ▼                  ▼                     ▼
┌─────────────────────────────────────────────────────────────┐
│              n8n — EXTRACT + LOAD (Bronze only)             │
│  ING-SPOT-PRODUCTS  ING-SPOT-STOCK  ING-SPOT-CUSTOMIZATION  │
│  ING-ASIA-PRODUCTS  ING-SOMARCAS-PRODUCTS  ING-88BRINDES   │
│  [XBZ mantém pg_cron até shadow run confirmar paridade]     │
│                                                             │
│  ↓ via RPC fn_ingest_bronze_batch (UPSERT idempotente)     │
└─────────────────────────────────────────────────────────────┘
         │
         ▼
BRONZE → SILVER → GOLD (fn_pipeline_promote_tick */10 min)
```

---

## 9. Cadência de Ingestão (estado-alvo com stagger)

| Horário | Fornecedor | Feed | Frequência |
|---|---|---|---|
| 03:00 | SPOT | OptionalsComplete (produtos) | 1×/dia |
| 03:20 | XBZ | GetListaDeProdutos | 1×/dia |
| 03:40 | Asia Import | api/products | 1×/dia |
| 04:00 | Só Marcas | api-lista-preco-revenda | 1×/dia |
| */30 min | SPOT | Stocks (estoque) | A cada 30 min |
| */20 min | XBZ | Estoque | A cada 20 min |
| Dom 04:00 | SPOT | CustomizationTables | 1×/semana |
| Dom 04:00 | SPOT | Colors + ProductTypes | 1×/semana |
| Fim de pull | SPOT | CanceledProducts (sweep) | A cada full-pull OK |

---

## 10. Regras de Negócio por Fonte

### SPOT — Gotchas críticos do ETL

| # | Regra | Detalhe |
|---|---|---|
| 1 | `WeightGr` ≠ peso unitário | É gramatura têxtil (g/m²). Peso real = `Weight` |
| 2 | `HasCapacitys` sempre `false` | Não usar como flag. Usar `Capacity` (texto) não-vazio |
| 3 | Cores com código duplicado | `03` e `103` = "Preto". Normalizar no de-para `supplier_colors` |
| 4 | `BoxSizeM` usa metros como string | `0.39` = 39 cm. Preferir campos `Box*MM` numéricos |
| 5 | `YourPrice` esparso (9% dos SKUs) | Fallback via `Price{n}` + condição comercial |
| 6 | Cota crítica no OptionalsComplete | Apenas **22 chamadas/dia**. Falha sem retry planejado perde a janela |
| 7 | Mojibake em textos de área | `Ã˜` → `Ø`. Sanitizar UTF-8 na padronização (Silver) |
| 8 | Só 5 faixas de preço ativas no BR | `MinQt6..10` / `Price6..10` são sempre vazias |

### ASIA — Gotcha crítico

| # | Regra | Detalhe |
|---|---|---|
| 1 | Chave natural composta | Usar `referencia\|COR`, nunca só `referencia` — causa loop infinito |

### XBZ — Gotcha crítico

| # | Regra | Detalhe |
|---|---|---|
| 1 | Token na query string | Token exposto na URL. Mover para header antes da migração para n8n |

---

## 11. Estado Atual × Estado-Alvo

| Item | Estado Atual | Estado-Alvo |
|---|---|---|
| SPOT → Bronze | ✅ Bronze populado (~3.612 SKUs, snapshot dez/2025) | ✅ Ingestão n8n diária com watermark `UpdateDate` |
| XBZ → Bronze | ✅ pg_cron ativo e fresco | ✅ Manter cron até shadow run; migrar n8n por último |
| Asia → Bronze | ⚠️ Parcial (MySQL/parcial) | ✅ ING-ASIA-PRODUCTS no n8n |
| Só Marcas → Bronze | ⚠️ Parcial (MySQL/parcial) | ✅ ING-SOMARCAS-PRODUCTS no n8n |
| 88 Brindes → Bronze | 🔴 40 linhas órfãs, sem ingestão | ✅ Descobrir API → ING-88BRINDES-PRODUCTS |
| MySQL intermediário | ⚠️ Landing fantasma fora do Supabase | 🗑️ Eliminado — n8n vai direto para Bronze via RPC |
| Workflows n8n SPOT | ⚠️ ~4 versões duplicadas, caóticas | ✅ 1 versão por feed (ING-SPOT-PRODUCTS, ING-SPOT-STOCK, ING-SPOT-CUSTOMIZATION) |

---

## 12. Princípio Cardinal (a regra que não se quebra)

> **n8n = Extract + Load no Bronze. Só escreve no Bronze, e só via RPC.**  
> **Nunca escreve em Silver (`produtos_padronizacao*`) nem em Gold (`products`/`product_variants`).**

```
[n8n]  → supplier_products_raw (status = 'pending')
                    │
              [FRONTEIRA DE CONTRATO]
                    │
[Postgres tick */10] → Silver → Gold
```

---

*v1.1 · jun/2026 · `adm01-debug/promo-gifts-v4` · `medallion/fornecedores/FONTES_DE_INFORMACAO.md`*
