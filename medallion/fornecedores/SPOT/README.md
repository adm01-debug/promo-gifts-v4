# SPOT / Stricker — Índice de Fontes de Informação

> **Supplier ID:** `bcfc0d02-44c6-48ae-8472-12b1a3f3d8e0`  
> **Projeto:** promo-gifts-v4 · Supabase `doufsxqlfjyuvxuezpln`  
> **Classificação:** USO INTERNO — não publicar

---

## ⚠️ O SPOT não é uma fonte — são TRÊS fontes distintas

O SPOT/Stricker possui **3 canais de dados** com autenticações, propósitos e restrições completamente diferentes. Confundir um canal com outro gera bugs silenciosos e acesso ao dado errado.

```
SPOT / Stricker (spotgifts.com.br)
├── Canal A: Webservice API         → ✅ ÚNICO canal que alimenta o Bronze
│   URL: ws.spotgifts.com.br/api/v1SSL
│   Auth: AccessKey → token
│   Dados: catálogo completo (~230 campos), estoque, personalização
│
├── Canal B: Portal Web Público     → ⚠️ Complementar / não usado no pipeline
│   URL: www.spotgifts.com.br (sem auth)
│   Dados: busca rápida, estoque por armazém (redundante com Canal A)
│
└── Canal C: Portal Web Autenticado → ❌ Fora do escopo do catálogo
    URL: www.spotgifts.com.br (login/senha → PHPSESSID)
    Dados: pedidos, faturas, simulador de personalização, carrinho
```

---

## Canal A — Webservice API (o que alimenta o Bronze)

**URL base:** `https://ws.spotgifts.com.br/api/v1SSL`  
**Auth:** `POST /AuthenticateClient` com `AccessKey` → token de sessão  
**Segredo:** Vault Supabase `SPOT_ACCESS_KEY` → `fn_get_spot_access_key()` (service_role only)

| Feed | Chave | Volume | Limite/dia | Cadência | Destino Bronze |
|---|---|---|---|---|---|
| `OptionalsComplete` | `Sku` | ~27 MB | **22** | 1×/dia 03:00 | `supplier_products_raw.raw_data` |
| `Stocks` | `Sku` | leve | **96** | */30 min | `supplier_products_raw.stock_data` |
| `CustomizationTables` | `TableCodeOption` | ~289 linhas | 22 | Dom 04:00 | `supplier_customization_raw` |
| `Colors` | `ColorCode` | 52 linhas | 22 | Dom 04:00 | `supplier_colors` (de-para) |
| `ProductTypes` | `TypeCode` | 31 linhas | 22 | Dom 04:00 | `supplier_category_mappings` |
| `CanceledProducts` | ref | variável | 22 | pós full-pull | `is_active=false` |

> **Cuidado com a cota:** o `OptionalsComplete` tem limite de **22 chamadas/dia** — uma falha sem retry planejado perde a janela diária.

### Campos do OptionalsComplete (~230 campos por SKU)

Documentação completa em [`SPOT_CATALOGO_CAMPOS_API.md`](./SPOT_CATALOGO_CAMPOS_API.md).

Resumo por grupo:

| Grupo | Campos-chave | Fill% típico |
|---|---|---|
| Identidade | `Sku`, `ProdReference`, `Multiplier` | 100% |
| Nome/Descrição | `Name`, `ShortDescription`, `Description` | 100% |
| Cor | `ColorCode`, `ColorDesc1`, `ColorHex1` | 100% |
| Preço (5 faixas) | `MinQt1..5` / `Price1..5` | 84–100% |
| Físico | `CombinedSizes`, `Weight`, `BoxWeightKG` | 100% |
| Categorias | `Type`/`TypeCode`, `SubType`, `Catalogs` | 100% |
| Personalização (8 posições) | `Area1..8`, `CustomizationTypes1..8` | 99.7% (pos.1) → 22.4% (pos.8) |
| Imagens | `MainImage`, `AllImageList`, `BoxImage` | Main: 100% |
| Vídeo | `VideoLink` (YouTube) | 9.1% |
| Tags/Flags | `KeyWords`, `IsTextil`, `IsStockOut` | 98–100% |

### Gotchas críticos do ETL (Canal A)

| # | Regra |
|---|---|
| 1 | `WeightGr` ≠ peso — é gramatura têxtil (g/m²). Peso real = `Weight` |
| 2 | `HasCapacitys` sempre `false` — usar `Capacity` (texto) não-vazio |
| 3 | Cores com código duplicado: `03` e `103` = "Preto" — normalizar no de-para |
| 4 | `BoxSizeM` usa metros como string (`0.39` = 39cm) — preferir `Box*MM` |
| 5 | `YourPrice` esparso (9%) — fallback via `Price{n}` + condição comercial |
| 6 | Cota crítica: **22 chamadas/dia** no OptionalsComplete |
| 7 | Mojibake: `Ã˜` → `Ø` — sanitizar UTF-8 na padronização (Silver) |
| 8 | Só 5 faixas de preço ativas no BR (`MinQt6..10`/`Price6..10` vazias) |

---

## Canal B — Portal Web Público (complementar)

**URL base:** `https://www.spotgifts.com.br`  
**Auth:** nenhuma — endpoints abertos ao público  
**Status no pipeline:** ⚠️ não usado / redundante com Canal A

| Endpoint | O que entrega | Uso |
|---|---|---|
| `GET /pt/catalogo/ajax/pesquisar.php` | Busca rápida (até 5 resultados) | ❌ Não usado |
| `POST /pt/catalogo/catalogo.ajax.php` (getStockWarehouses) | Estoque por armazém físico | ⚠️ Opcional |
| `GET /pt/produto/ajax/carregaPersonalizacoes.php` | HTML de personalização | ❌ Não usado |

> O `getStockWarehouses` é o único endpoint útil deste canal, e ainda assim é redundante com o feed `Stocks` do Canal A.

Documentação técnica completa em [`SPOT_ANALISE_PORTAL_WEB.md`](./SPOT_ANALISE_PORTAL_WEB.md) — seções 6 e 8.

---

## Canal C — Portal Web Autenticado (fora do escopo)

**URL base:** `https://www.spotgifts.com.br`  
**Auth:** `POST /pt/area-reservada/login/` → cookie `PHPSESSID`  
**Status no pipeline:** ❌ fora do escopo — dados operacionais, não de catálogo

| Módulo | O que contém |
|---|---|
| `/pt/loja/*` | Carrinho, checkout, cálculo de frete |
| `/pt/simulador/*` | Simulador de personalização (rascunhos, maquetas) |
| `/pt/clientes/*` | Pedidos, faturas, notas fiscais |
| `/pt/orcamentos/*` | Orçamentos comparativos |
| Semáforo (`getSemaforo`) | Disponibilidade visual (verde/amarelo/vermelho) |

### ⚠️ Alertas do Canal C

| Criticidade | Alerta |
|---|---|
| 🔴 | **Bloqueio geolocalizado** — IP fora do Brasil bloqueia a conta ("acesso simultâneo de países diferentes") |
| 🔴 | Sem 2FA — nenhum segundo fator de autenticação |
| 🔴 | Sessão por cookie `PHPSESSID` — expira ao fechar o browser |
| 🟡 | Endpoints POST sem proteção CSRF |
| 🟡 | HTTP 500 retornado para erros de validação (não confiável para monitoramento) |

Documentação técnica completa (28 endpoints, auth, segurança, módulos JS) em [`SPOT_ANALISE_PORTAL_WEB.md`](./SPOT_ANALISE_PORTAL_WEB.md).

---

## Documentos de referência

| Documento | Conteúdo |
|---|---|
| [`SPOT_CATALOGO_CAMPOS_API.md`](./SPOT_CATALOGO_CAMPOS_API.md) | ~230 campos do webservice com fill-rate por campo, feeds, gotchas ETL |
| [`SPOT_ANALISE_PORTAL_WEB.md`](./SPOT_ANALISE_PORTAL_WEB.md) | Análise completa do portal (28 endpoints, auth, JS, segurança) |
| [`../FONTES_DE_INFORMACAO.md`](../FONTES_DE_INFORMACAO.md) | Visão geral de todos os 5 fornecedores |
| [`../PLANO_INGESTAO_N8N.md`](../PLANO_INGESTAO_N8N.md) | Arquitetura Medallion + plano n8n completo |
| [`../../medallion/SPOT_INTEGRACAO_COMPLETA.md`](../../medallion/SPOT_INTEGRACAO_COMPLETA.md) | Status da integração SPOT no pipeline |

---

*Última atualização: jun/2026 · Revisão da análise cirúrgica do portal v2.0 (2026-03-08)*
