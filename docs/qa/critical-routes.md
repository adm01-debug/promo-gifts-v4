# Rotas críticas de negócio (P0/P1/P2)

Levantamento das rotas e endpoints com maior impacto operacional/comercial em **auth, checkout, pagamento, upload, webhooks, perfil e admin**.

## Critérios de criticidade
- **P0**: quebra impede operação principal (login, criação/fechamento de orçamento, integrações transacionais, segurança).
- **P1**: alto impacto em produtividade/controle, com workaround parcial.
- **P2**: relevante para governança/monitoramento, mas não bloqueia fluxo core de venda no curto prazo.

## Inventário

| Prioridade | Domínio | Path | Método HTTP | Dependências principais | Criticidade |
|---|---|---|---|---|---|
| P0 | Auth (web) | `/auth` | GET (SPA) | `publicRoutes`, página `Auth`, `AuthProvider`/Supabase Auth | Porta de entrada do sistema; indisponível = usuários sem acesso. |
| P0 | Auth callback (web) | `/auth/callback` | GET (SPA) | `SSOCallbackPage`, sessão Supabase | Falha aqui quebra SSO/retorno de OAuth. |
| P0 | Perfil/autorização (edge/shared) | `authenticateRequest` + `requireRole` (consumido por funções críticas) | N/A (middleware interno) | `_shared/auth.ts`, JWT Supabase, roles (`agente/supervisor/dev`) | Base de autorização dos fluxos críticos (sync, upload, admin técnico). |
| P0 | Checkout/orçamento (web) | `/orcamentos/novo` | GET (SPA) | `QuoteBuilderPage`, `quoteRoutes`, persistência em `quotes`/`quote_items` | Fluxo principal de geração de proposta comercial. |
| P0 | Checkout edição (web) | `/orcamentos/:id/editar` | GET (SPA) | `QuoteBuilderPage`, carregamento de quote existente | Impacta renegociação/continuidade de venda. |
| P0 | Pagamento (dados do orçamento) | `/orcamentos/novo` e `/orcamentos/:id/editar` (campos `payment_method`, `payment_terms`) | GET/PUT lógico via UI+DB | `useQuoteBuilderState`, `useQuotes`, colunas de pagamento em `quotes` | Erros nestes campos afetam fechamento financeiro/comercial. |
| P0 | Upload seguro | `/functions/v1/secure-upload` | POST/OPTIONS | `authenticateRequest`, Supabase Storage (`personalization-images`/`quarantine`), `file_scan_logs`, VirusTotal | Upload de arte/logo com varredura; falha bloqueia personalização e proteção anti-malware. |
| P0 | Webhook dispatcher | `/functions/v1/webhook-dispatcher` | POST/OPTIONS | `authorizeDispatcher`, `outbound_webhooks`, `webhook_deliveries`, HMAC (`WEBHOOK_DISPATCHER_SECRET`) | Integrações de saída e replay/teste; falha interrompe automações externas. |
| P0 | Webhook inbound | `/functions/v1/webhook-inbound?slug=...` | POST/OPTIONS | `runBotProtection`, validação HMAC, `inbound_webhook_endpoints`, `inbound_webhook_events` | Entrada de eventos externos; falha gera perda de eventos ou superfície de abuso. |
| P0 | Webhook produtos | `/functions/v1/product-webhook` | POST/OPTIONS | assinatura (`x-webhook-signature`), nonce/timestamp, `webhook_request_nonces`, upsert catálogo | Pipeline de atualização de catálogo; impacto direto em venda e dados de produto. |
| P0 | Sync orçamento (pagamento/checkout para CRM) | `/functions/v1/quote-sync` | POST/OPTIONS | `authenticateRequest`+`requireRole('agente')`, CRM creds (`integration_credentials`/env), n8n/Bitrix/SalesPro | Fluxo pós-checkout para CRM; falha quebra continuidade comercial/operacional. |
| P1 | Admin base | `/admin` → `/admin/usuarios` | GET (SPA) | `AdminRoute`, `adminRoutes`, roles | Hub administrativo; afeta governança de acesso e operação diária. |
| P1 | Admin usuários | `/admin/usuarios` | GET (SPA) | `AdminUsuariosPage`, gestão de usuários/perfis | Gestão de equipe, permissões e fluxo interno. |
| P1 | Admin permissões/roles | `/admin/permissoes`, `/admin/roles`, `/admin/role-permissoes` | GET (SPA) | `AdminRoute`, páginas de RBAC | Erros causam risco de acesso indevido ou bloqueio operacional. |
| P1 | Admin conexões/integrations | `/admin/conexoes` | GET (SPA) | `DevRoute`, credenciais de integrações, testes de conexão | Afeta capacidade de manter integrações de missão crítica. |
| P1 | Admin segurança | `/admin/seguranca`, `/admin/seguranca-acesso`, `/admin/seguranca/chaves` | GET (SPA) | `DevRoute`, telemetria/auditoria/chaves | Resposta a incidentes e hardening operacional. |
| P1 | Sync Bitrix direto | `/functions/v1/bitrix-sync` | POST/OPTIONS | `authorize(requireRole: supervisor)`, webhook Bitrix24, circuit breaker | Integração CRM estratégica; indisponibilidade degrada operação comercial. |
| P2 | Admin observabilidade | `/admin/telemetria`, `/admin/status`, `/admin/rate-limit`, `/admin/workflows`, `/admin/login-attempts` | GET (SPA) | `DevRoute`, consultas de observabilidade | Importante para SRE/segurança, mas com workaround manual temporário. |
| P2 | Rotas públicas legais | `/termos`, `/privacidade` | GET (SPA) | `publicRoutes` | Baixo impacto transacional imediato. |

## Observações rápidas
- Em frontend React Router, o “método HTTP” efetivo da rota SPA é **GET** (entrega de `index.html` + roteamento client-side).
- Nos endpoints de Edge Functions, o padrão crítico é **POST** (e **OPTIONS** para CORS/preflight).
- O domínio **pagamento** no produto atual está principalmente embutido no fluxo de **orçamentos/checkout** (campos de pagamento no objeto de quote), não em um endpoint dedicado de “payments checkout”.
