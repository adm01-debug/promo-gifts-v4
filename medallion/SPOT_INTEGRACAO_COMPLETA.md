# SPOT/Stricker — Integração Completa
**Data:** 2026-06-07 | **Revisão:** v3.0

## Workflows em produção

| Workflow | ID | Projeto | Cadência | Feeds |
|---|---|---|---|---|
| ING-SPOT-STOCK | dppXHdvrBhA8UXKk | Atomica BR | 15min 07:05–19:50 | stock |
| ING-SPOT-PRICES | CHPGOgPxGnyeQCfJ | Atomica BR | 1h 07:05–19:05 | products |
| ING-SPOT-FULL | AF0p45RVqCQZvGTC | Atomica BR | Diário 06:00 | products + stock + mark_absent |
| ING-SPOT-SUPPLEMENTS | FaHmF8iQbGHc3GTV | Atomica BR | Semanal Dom 05:00 | customization + colors |
| ING-SPOT-CUSTOMIZATION-OPTIONS | 1uKqFK3xbAWf8ycU | Atomica BR | Mensal dia 1 04:30 | customization_options (HotSpots) |
| OP-SPOT-ORDERS | YpN6XVVEJFR4UDmg | Atomica BR | Manual on-demand | OrdersV1 |

> **Nota de projeto/credencial:** todos os workflows SPOT vivem no projeto n8n **Atomica BR** (`K1sOP2Gf9sQt2U7P`), porque a credencial Supabase `kite` (`SIoFliQ0FzfJBD0Z` → doufsxqlfjyuvxuezpln) pertence só a esse projeto. Workflows criados via MCP caem no projeto pessoal por padrão e **não** enxergam a `kite` — sempre passar `projectId: K1sOP2Gf9sQt2U7P` ao criar.

## Novidades 2026-06-07

- **ING-SPOT-CUSTOMIZATION-OPTIONS criado e validado** — último feed de PRODUTO faltante.
  - 1 chamada bulk (~46MB) → lotes de 400 → `supplier_customization_options_raw`.
  - Resultado: **35.936 linhas processadas, 35.832 combinações únicas, 1.197 produtos, 100% com HotSpot, 0 erros, 42s.**
  - `fn_ingest_customization_options_batch` criado (upsert idempotente pela chave natural).
  - `fn_ingestion_run_open` e a CHECK constraint `ingestion_run_log_feed_check` estendidos para aceitar `customization_options`.
- **Cobertura de dados de PRODUTO do site: 100%** (HotSpot do editor visual era a última peça).

## Mapa 51 endpoints SPOT

### Canal A REST (19)
- AuthenticateClient: ativo (todos os workflows)
- OptionalsComplete: ativo — ING-SPOT-PRICES, ING-SPOT-FULL
- Stocks: ativo — ING-SPOT-STOCK, ING-SPOT-FULL
- CustomizationTables: ativo — ING-SPOT-SUPPLEMENTS
- Colors: ativo — ING-SPOT-SUPPLEMENTS
- CanceledProducts: ativo via mark_absent — ING-SPOT-FULL
- **CustomizationOptions: ativo — ING-SPOT-CUSTOMIZATION-OPTIONS (bulk 46MB, mensal)**
- OrdersV1: ativo — OP-SPOT-ORDERS
- Products / Optionals / OptionalsPrice / ProductsTree: SKIP (subconjunto de OptionalsComplete)
- ProductTypes: Phase 2 (referencia estatica, baixa prioridade)
- OrderV1 / ServiceOrderV1 / CancelOrderV1 / OrderDetailsV1: Phase 2 (design Bitrix24)
- ValidateSession / CloseSession: utilitarios, nao necessarios

### Estrutura real do feed CustomizationOptions (descoberta via curl)
- Resposta é OBJETO envelopado: `{"CustomizationOptions":[...]}` (não array nu).
- Parâmetro `ref` é IGNORADO — sempre retorna o feed bulk completo (~36k linhas). Per-ref inviável.
- ServiceCode é granular (ex. `11103.18.23.SCR1-01-01`) → unicidade garantida.
- **NÃO existe campo único "HotSpot"** — são `HotSpot1Type/OriginX/OriginY/Top/Left/Width/Height` (+ HotSpot2*). Montados em jsonb na coluna `hotspot`.
- `TableMaxAreaCM2` usa **vírgula decimal** (ex. `9980,01`) → tratar com `replace(',','.')` antes do cast numeric.

### Canal A — protocolos alternativos
- SOAP: SKIP (REST superior)
- Download direto XML/JSON: FALLBACK apenas (cota esgotada)
- Download direto CSV: SKIP

### Canal B — portal publico (4): SKIP (redundante)
### Canal C — portal auth (28): SKIP (web session fragil)

## Consumo cota

- Dia normal: other=14/22, stocks=53/96
- Domingo: other=16/22, stocks=53/96
- Dia 1 do mês (+ CustomizationOptions): other≈15/22 (ou ≈17/22 se cair domingo)

## Tabelas Bronze SPOT

- supplier_products_raw: 3612 rows — diaria
- supplier_customization_raw: 289 rows apos primeiro run — semanal
- supplier_colors: 52 rows apos primeiro run — semanal
- **supplier_customization_options_raw: 35.832 rows (1.197 produtos, 100% HotSpot) — mensal**

## Phase 2 (pendente, requer design)

1. OrderV1 + CancelOrderV1 — fluxo completo Bitrix24
2. ServiceOrderV1 — envio de arte base64
3. OrderDetailsV1 — complemento OP-SPOT-ORDERS
4. ProductTypes — referencia estatica (baixa prioridade)
