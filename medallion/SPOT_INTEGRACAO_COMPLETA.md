# SPOT/Stricker — Integração Completa
**Data:** 2026-06-06 | **Revisão:** v2.0

## Workflows em produção

| Workflow | ID | Cadência | Feeds |
|---|---|---|---|
| ING-SPOT-STOCK | dppXHdvrBhA8UXKk | 15min 07:05–19:50 | stock |
| ING-SPOT-PRICES | CHPGOgPxGnyeQCfJ | 1h 07:05–19:05 | products |
| ING-SPOT-FULL | AF0p45RVqCQZvGTC | Diário 06:00 | products + stock + mark_absent |
| ING-SPOT-SUPPLEMENTS | FaHmF8iQbGHc3GTV | Semanal Dom 05:00 | customization + colors |
| OP-SPOT-ORDERS | YpN6XVVEJFR4UDmg | Manual on-demand | OrdersV1 |

## Novidades 2026-06-06

- ING-SPOT-FULL atualizado: Fase 3 mark_absent (produtos descontinuados = is_active=false)
- ING-SPOT-SUPPLEMENTS criado: CustomizationTables (289) + Colors (52)
- OP-SPOT-ORDERS criado: PROCESSING + WAITING_STOCK + SHIPPED consolidados
- fn_ingest_colors_batch criado: upsert idempotente em supplier_colors

## Mapa 51 endpoints SPOT

### Canal A REST (19)
- AuthenticateClient: ativo (todos os workflows)
- OptionalsComplete: ativo — ING-SPOT-PRICES, ING-SPOT-FULL
- Stocks: ativo — ING-SPOT-STOCK, ING-SPOT-FULL
- CustomizationTables: ativo — ING-SPOT-SUPPLEMENTS
- Colors: ativo — ING-SPOT-SUPPLEMENTS
- CanceledProducts: ativo via mark_absent — ING-SPOT-FULL
- OrdersV1: ativo — OP-SPOT-ORDERS
- Products / Optionals / OptionalsPrice / ProductsTree: SKIP (subconjunto de OptionalsComplete)
- CustomizationOptions: Phase 2 (46MB, tabela ja existe)
- ProductTypes: Phase 2 (referencia estatica)
- OrderV1 / ServiceOrderV1 / CancelOrderV1 / OrderDetailsV1: Phase 2 (design Bitrix24)
- ValidateSession / CloseSession: utilitarios, nao necessarios

### Canal A — protocolos alternativos
- SOAP: SKIP (REST superior)
- Download direto XML/JSON: FALLBACK apenas (cota esgotada)
- Download direto CSV: SKIP

### Canal B — portal publico (4): SKIP (redundante)
### Canal C — portal auth (28): SKIP (web session fragil)

## Consumo cota

- Dia normal: other=14/22, stocks=53/96
- Domingo: other=16/22, stocks=53/96

## Tabelas Bronze SPOT

- supplier_products_raw: 3612 rows — diaria
- supplier_customization_raw: 289 rows apos primeiro run — semanal
- supplier_colors: 52 rows apos primeiro run — semanal
- supplier_customization_options_raw: 0 rows — Phase 2

## Phase 2

1. OrderV1 + CancelOrderV1 — fluxo completo Bitrix24
2. ServiceOrderV1 — envio de arte base64
3. CustomizationOptions — download direto + batching especial (46MB)
4. OrderDetailsV1 — complemento OP-SPOT-ORDERS
