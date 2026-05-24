# Edge Functions — Catálogo

> Documento gerado em 2026-05-09 pela auditoria da Faxina F1.
> Catálogo de **78 edge functions** ativas no Supabase deste repo.

## 📋 Visão geral por categoria

| Categoria | Qtd | Descrição |
|---|---|---|
| **public** | 15 | Chamável sem autenticação (rotas públicas, webhooks, health, image-proxy) |
| **authenticated** | 25 | Exige JWT válido, qualquer role logada |
| **supervisor** | 4 | Exige role >= supervisor (admin/dev) |
| **dev** | 13 | Exige role dev (debugging, secrets, MCP keys) |
| **service** | 15 | Server-to-server (cron / outras edges) — não invocada pelo front |
| **scoped** | 5 | Auth custom (HMAC, MCP scope, webhook signature) |

A categoria de cada função é a fonte de verdade em `_shared/edge-authz-manifest.ts` e o gate de CI `scripts/check-edge-authorization.mjs` falha se houver função sem entrada no manifest.

## 🚨 Funções potencialmente órfãs

Edges `authenticated` ou `supervisor` com **zero invocações no front** (`functions.invoke('nome')`). Candidatas a investigação — podem ser código morto, ou podem ser chamadas por mecanismos que esta busca não pega (outros edges, cron, webhooks externos).

| Função | Categoria | Rationale |
|---|---|---|
| `ai-recommendations` | authenticated | Recomendações IA do user logado |
| `bitrix-sync` | supervisor | Sync no CRM externo — admin/dev |
| `elevenlabs-tts` | authenticated | TTS do user |
| `expert-chat` | authenticated | Chat IA do user |
| `generate-mockup-nanobanana` | authenticated | Mockup IA do user |
| `magic-up-score` | authenticated | Scoring criativo do user |
| `voice-agent` | authenticated | Voice agent do user |

_Total potencialmente órfãs: **7**_


## 🌐 Públicas (sem autenticação) (15)

| Função | Propósito | LOC | Callers (front) |
|---|---|---:|---:|
| `analyze-logo-colors` | Extração de cores via foto pública | 180 | 1 |
| `categories-api` | Catálogo de categorias público | 242 | 2 |
| `cnpj-lookup` | Lookup CNPJ via API pública | 127 | 1 |
| `commemorative-dates` | Calendário público | 143 | 1 |
| `detect-new-device` | Anti-fraude pré-login | 144 | 1 |
| `dropbox-list` | Listagem pública de arquivos curados | 144 | 2 |
| `get-visitor-info` | Geo/IP do visitante para anti-fraude | 45 | 2 |
| `health-check` | Health endpoint para uptime monitors | 134 | — (não chamada do front por design) |
| `image-proxy` | Proxy de imagens (anti-hotlink CDN externos) | 125 | — (não chamada do front por design) |
| `log-login-attempt` | Telemetria de login (anti-bruteforce) | 84 | 2 |
| `materials-api` | Catálogo de materiais público | 448 | — (não chamada do front por design) |
| `rate-limit-check` | Rate-limit consult anonymous | 134 | — (não chamada do front por design) |
| `semantic-search` | Busca semântica (anônima) | 392 | 1 |
| `verify-email` | Verificação de email no signup público | 77 | — (não chamada do front por design) |
| `visual-search` | Busca por imagem (anônima) | 221 | 1 |

## 🔐 Autenticadas (qualquer user logado) (25)

| Função | Propósito | LOC | Callers (front) |
|---|---|---:|---:|
| `ai-recommendations` | Recomendações IA do user logado | 188 | **0 ⚠️** |
| `bi-copilot` | BI copilot | 112 | 1 |
| `comparison-ai-advisor` | Conselheiro IA na comparação | 146 | 1 |
| `elevenlabs-scribe-token` | Token TTS do user | 74 | 1 |
| `elevenlabs-tts` | TTS do user | 137 | **0 ⚠️** |
| `expert-chat` | Chat IA do user | 1302 | **0 ⚠️** |
| `external-db-bridge` | Bridge para BD externo (RBAC interno) | 1909 | 89 |
| `force-global-logout` | Logout global do próprio user | 109 | 1 |
| `generate-ad-image` | Magic Up Ads do user | 271 | 1 |
| `generate-ad-prompt` | Magic Up Ads do user | 208 | 1 |
| `generate-mockup` | Mockup IA do user | 294 | 2 |
| `generate-mockup-nanobanana` | Mockup IA do user | 9 | **0 ⚠️** |
| `generate-product-seo` | SEO de produto do user | 163 | 1 |
| `kit-ai-builder` | Kit IA do user | 135 | 1 |
| `kit-identity-suggest` | Sugestão visual do user | 142 | 1 |
| `magic-up-score` | Scoring criativo do user | 120 | **0 ⚠️** |
| `market-intelligence-insights` | BI insights | 413 | 1 |
| `quote-sync` | Sync do orçamento do próprio vendedor | 344 | 2 |
| `secure-upload` | Upload com scan VirusTotal anti-malware — exige JWT (uso de SERVICE_ROLE_KEY interno; auditoria em file_scan_logs com user_id obrigatório) | 196 | 2 |
| `send-transactional-email` | Envio de e-mail trans (user logado) | 201 | 1 |
| `step-up-verify` | MFA step-up — quem está fazendo | 369 | 4 |
| `sync-quote-bitrix` | Sync do orçamento do vendedor | 319 | 2 |
| `trends-insights` | Insights do BI | 200 | 1 |
| `validate-access` | Validação de acesso pós-login | 229 | 1 |
| `voice-agent` | Voice agent do user | 121 | **0 ⚠️** |

## 👑 Supervisor / Admin (4)

| Função | Propósito | LOC | Callers (front) |
|---|---|---:|---:|
| `bitrix-sync` | Sync no CRM externo — admin/dev | 637 | **0 ⚠️** |
| `block-ip-temporarily` | Bloqueio de IP — has_role inline | 94 | 1 |
| `manage-users` | Gestão de usuários via has_role inline | 267 | 3 |
| `ownership-repair` | Reparo de órfãos — has_role inline + dry-run | 90 | 1 |

## 🛠 Dev-only (13)

| Função | Propósito | LOC | Callers (front) |
|---|---|---:|---:|
| `connection-tester` | is_dev() inline check | 332 | 5 |
| `e2e-cleanup` | Cleanup E2E — JWT + service-role + e2e-shared-secret | 668 | **0 ⚠️** |
| `external-db-inspect` | is_dev() inline check | 187 | 2 |
| `full-op-diagnostics` | Diagnóstico — has_role(dev) inline | 333 | 1 |
| `github-credentials-test` | is_dev() inline check | 297 | 1 |
| `mcp-keys-issue` | MCP keys — has_role(dev) + step-up token | 396 | 2 |
| `mcp-keys-revoke` | MCP keys — has_role(dev) inline | 227 | 2 |
| `mcp-keys-rotate` | MCP keys — has_role(dev) + step-up token | 331 | **0 ⚠️** |
| `mcp-keys-update` | MCP keys — has_role(dev) inline | 333 | 2 |
| `rls-audit` | Auditoria via service-role + has_role inline | 368 | **0 ⚠️** |
| `rls-integration-tests` | Testes RLS — dev/cron only | 322 | **0 ⚠️** |
| `rls-matrix-export` | Export matriz — has_role inline | 242 | **0 ⚠️** |
| `secrets-manager` | is_dev() inline check | 427 | 5 |

## ⚙️ Service / Cron (15)

| Função | Propósito | LOC | Callers (front) |
|---|---|---:|---:|
| `cleanup-notifications` | pg_cron diário | 48 | — (não chamada do front por design) |
| `cleanup-novelties` | pg_cron diário | 161 | — (não chamada do front por design) |
| `collections-watcher` | pg_cron — price drop watcher | 136 | — (não chamada do front por design) |
| `comparison-price-watcher` | pg_cron — price drop watcher | 113 | — (não chamada do front por design) |
| `connections-auto-test` | pg_cron — auto-test connections | 180 | — (não chamada do front por design) |
| `connections-health-check` | pg_cron — health connections | 204 | — (não chamada do front por design) |
| `connections-hub-audit` | pg_cron diário — auditoria | 218 | 1 |
| `favorites-watcher` | pg_cron — price drop watcher | 134 | — (não chamada do front por design) |
| `ownership-audit` | pg_cron diário — auditoria órfãos | 96 | 1 |
| `process-queue` | pg_cron — fila de jobs | 73 | — (não chamada do front por design) |
| `process-scheduled-reports` | pg_cron — relatórios | 188 | — (não chamada do front por design) |
| `quote-followup-reminders` | pg_cron — followup orçamentos | 93 | — (não chamada do front por design) |
| `send-digest` | pg_cron — digest semanal | 64 | — (não chamada do front por design) |
| `send-notification` | Disparo interno entre edges | 86 | — (não chamada do front por design) |
| `send-scheduled-reports` | pg_cron — envio batch | 185 | — (não chamada do front por design) |

## 🎫 Scoped (auth custom) (5)

| Função | Propósito | LOC | Callers (front) |
|---|---|---:|---:|
| `crm-db-bridge` | JWT + RBAC custom interno | 1003 | 4 |
| `mcp-server` | Token MCP com escopos read/write/admin | 505 | — (não chamada do front por design) |
| `product-webhook` | Token shared-secret no header | 299 | — (não chamada do front por design) |
| `webhook-dispatcher` | Disparo via service-role / cron | 256 | 2 |
| `webhook-inbound` | HMAC-SHA256 inline | 108 | — (não chamada do front por design) |

## ❓ Sem entrada no manifest (1)

| Função | Propósito | LOC | Callers (front) |
|---|---|---:|---:|
| `cors-audit` | (sem entrada no manifest) | 152 | **0 ⚠️** |

## 📊 Top 10 maiores funções por LOC

| Função | LOC | Categoria |
|---|---:|---|
| `external-db-bridge` | 1909 | authenticated |
| `expert-chat` | 1302 | authenticated |
| `crm-db-bridge` | 1003 | scoped |
| `e2e-cleanup` | 668 | dev |
| `bitrix-sync` | 637 | supervisor |
| `mcp-server` | 505 | scoped |
| `materials-api` | 448 | public |
| `secrets-manager` | 427 | dev |
| `market-intelligence-insights` | 413 | authenticated |
| `mcp-keys-issue` | 396 | dev |

## 🔥 Top 10 funções mais invocadas (no front)

| Função | Callers | Categoria |
|---|---:|---|
| `external-db-bridge` | 89 | authenticated |
| `connection-tester` | 5 | dev |
| `secrets-manager` | 5 | dev |
| `crm-db-bridge` | 4 | scoped |
| `step-up-verify` | 4 | authenticated |
| `manage-users` | 3 | supervisor |
| `categories-api` | 2 | public |
| `dropbox-list` | 2 | public |
| `external-db-inspect` | 2 | dev |
| `generate-mockup` | 2 | authenticated |

## 🏗 Convenções

- **Estrutura**: `supabase/functions/<nome>/index.ts`
- **Fonte de verdade da autorização**: `_shared/edge-authz-manifest.ts` — toda edge nova precisa ser adicionada aqui no mesmo PR.
- **Gate de CI**: `scripts/check-edge-authorization.mjs` falha se houver função em `supabase/functions/<name>/index.ts` ausente do manifest.
- **Testes de bypass**: `tests/security/edge-authz-bypass.test.ts` valida que cada edge respeita sua categoria declarada.

## 🔍 Como investigar uma função

1. Ler `supabase/functions/<nome>/index.ts` (o handler)
2. Ler `_shared/edge-authz-manifest.ts` (categoria + rationale)
3. Buscar callers no front: `grep -r "functions.invoke('<nome>')" src/`
4. Verificar logs em produção: dashboard Supabase → Functions → `<nome>` → Logs

---

_Doc gerado automaticamente. Pra atualizar: `node scripts/gen-edges-readme.mjs` (script preservado em `scripts/`)._



## Mecanismos de autenticação aceitos por endpoint

- `webhook-dispatcher`:
  - `x-dispatcher-secret: <WEBHOOK_DISPATCHER_SECRET>` **ou**
  - `Authorization: Bearer <JWT de usuário válido>` com role mínima (`supervisor` por padrão).
  - `Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>` **não é aceito** como credencial de transporte.
- Endpoints de cron que usam `authorizeCron`:
  - `x-cron-secret: <CRON_SECRET>` (vault/env).
  - `Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>` **não é aceito**.
- Helpers compartilhados de usuário (ex.: `authenticateRequest`):
  - Apenas `Authorization: Bearer <JWT de usuário válido>`.
  - Fast-path com `SUPABASE_SERVICE_ROLE_KEY`/`SIMULATION_BYPASS_KEY` foi removido.
