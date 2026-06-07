# SPOT/Stricker — Integração Completa
**Data:** 2026-06-07 | **Revisão:** v4.2

## Workflows em produção (TODOS no projeto Atomica BR `K1sOP2Gf9sQt2U7P`)

| Workflow | ID | Cadência | Feeds |
|---|---|---|---|
| ING-SPOT-STOCK | dppXHdvrBhA8UXKk | 15min 07:05–19:50 | stock |
| ING-SPOT-PRICES | CHPGOgPxGnyeQCfJ | 1h 07:05–19:05 | products |
| ING-SPOT-FULL | AF0p45RVqCQZvGTC | Diário 06:00 | products + stock + mark_absent |
| ING-SPOT-SUPPLEMENTS | bhoevJqxei1DsqGN | Semanal Dom 05:00 | customization + colors |
| SPOT - GESTÃO DE PERSONALIZAÇÃO | 1uKqFK3xbAWf8ycU | Mensal dia 1 04:30 | customization_options (HotSpots) |
| SPOT - GESTÃO DE PEDIDOS | 2PvnD15sj7AhsOgB | Manual on-demand (não publicável) | OrdersV1 |

> **Nota de projeto/credencial (CRÍTICO):** a credencial Supabase `kite` (`SIoFliQ0FzfJBD0Z` → doufsxqlfjyuvxuezpln) pertence só ao projeto **Atomica BR** (`K1sOP2Gf9sQt2U7P`). Workflows criados via MCP caem no projeto **pessoal** (`RfQyNbnUYI7xnBrM`) por padrão e **não** enxergam a `kite` — seus crons falham silenciosamente. **Sempre criar com `projectId: K1sOP2Gf9sQt2U7P`.**
>
> **Órfãos a apagar manualmente (UI):** `ddARcGMBeMyjGuNR`, `FaHmF8iQbGHc3GTV`, `YpN6XVVEJFR4UDmg` — todos no projeto pessoal, despublicados/inertes.

## Novidades 2026-06-07

- **SPOT - GESTÃO DE PERSONALIZAÇÃO** (ex-ING-SPOT-CUSTOMIZATION-OPTIONS) — ingestão mensal do mapa completo de personalização (~46MB, ~36k linhas, HotSpots do editor visual). **35.832 combinações únicas / 1.197 produtos / 100% com HotSpot / 0 erros / 42s.**
- **ING-SPOT-SUPPLEMENTS corrigido:** estava no projeto pessoal (cron quebrado). Recriado no Atomica BR — customization 8 → **309**, colors 49 → **52**.
- **SPOT - GESTÃO DE PEDIDOS** (ex-OP-SPOT-ORDERS) — consulta on-demand de pedidos em aberto (PROCESSING / WAITING_STOCK / SHIPPED). Consolidação robusta via `$('nó').first()`.
- **Cobertura de dados de PRODUTO do site: 100%.**

## Mapa 51 endpoints SPOT

### Canal A REST (19)
- AuthenticateClient: ativo (todos os workflows)
- OptionalsComplete: ativo — ING-SPOT-PRICES, ING-SPOT-FULL
- Stocks: ativo — ING-SPOT-STOCK, ING-SPOT-FULL
- CustomizationTables: ativo — ING-SPOT-SUPPLEMENTS
- Colors: ativo — ING-SPOT-SUPPLEMENTS
- CanceledProducts: ativo via mark_absent — ING-SPOT-FULL
- CustomizationOptions: ativo — SPOT - GESTÃO DE PERSONALIZAÇÃO (bulk 46MB, mensal)
- OrdersV1: ativo — SPOT - GESTÃO DE PEDIDOS
- Products / Optionals / OptionalsPrice / ProductsTree: SKIP (subconjunto de OptionalsComplete)
- ProductTypes: Phase 2 (referencia estatica, baixa prioridade)
- OrderV1 / ServiceOrderV1 / CancelOrderV1 / OrderDetailsV1: Phase 2 (design Bitrix24)
- ValidateSession / CloseSession: utilitarios, nao necessarios

### Estruturas reais descobertas (via curl / execução)
- **CustomizationOptions**: resposta OBJETO `{"CustomizationOptions":[...]}` (não array nu); `ref` é IGNORADO (sempre bulk ~36k); HotSpot vem em `HotSpot1Type/OriginX/OriginY/Top/Left/Width/Height` (+HotSpot2*), montados em jsonb; `TableMaxAreaCM2` usa vírgula decimal (`9980,01`) → `replace(',','.')`.
- **OrdersV1**: resposta `{"OrdersDetails":[...], "Count":N, ...}` — a lista vem em `OrdersDetails` (não `Orders`).

### Canal A — protocolos alternativos
- SOAP: SKIP (REST superior)
- Download direto XML/JSON: FALLBACK apenas (cota esgotada)
- Download direto CSV: SKIP

### Canal B — portal publico (4): SKIP (redundante)
### Canal C — portal auth (28): SKIP (web session fragil)

## Consumo cota

- Dia normal: other≈14/22, stocks≈53/96
- Domingo (+SUPPLEMENTS): other≈16/22
- Dia 1 do mês (+Gestão de Personalização): other≈15/22
- OBS: `spot_ws_status` (MCP) só conta chamadas via MCP; chamadas do n8n vão diretas e não aparecem nesse contador (o limite server-side é compartilhado).

## Tabelas Bronze SPOT

- supplier_products_raw: 3612 rows — diaria
- supplier_customization_raw: **309 rows** — semanal
- supplier_colors: **52 rows** — semanal
- supplier_customization_options_raw: **35.832 rows** (1.197 produtos, 100% HotSpot) — mensal

## Phase 2 (pendente, requer design)

1. OrderV1 + CancelOrderV1 — fluxo completo Bitrix24
2. ServiceOrderV1 — envio de arte base64
3. OrderDetailsV1 — complemento SPOT - GESTÃO DE PEDIDOS
4. ProductTypes — referencia estatica (baixa prioridade)
