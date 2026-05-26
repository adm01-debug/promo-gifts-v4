# Catálogo técnico de Edge Functions

> Endpoint base Supabase: `/functions/v1/{functionName}`.

## Índice consolidado

| Função | Endpoint | Método | Autenticação requerida | Esquema de entrada | Esquema de saída | Erros conhecidos |
|---|---|---|---|---|---|---|
| `ai-recommendations` | `/functions/v1/ai-recommendations` | `POST` | Public (verify_jwt=false + defesa interna) | Zod (recomendações) | JSON recomendações | rate-limit/validação IA |
| `analyze-logo-colors` | `/functions/v1/analyze-logo-colors` | `POST` | JWT (padrão Supabase, salvo override) | Ver `index.ts`/Zod local | JSON (`success`/`data`/`error`) | não mapeado formalmente |
| `bi-copilot` | `/functions/v1/bi-copilot` | `POST` | JWT (padrão Supabase, salvo override) | Ver `index.ts`/Zod local | JSON (`success`/`data`/`error`) | não mapeado formalmente |
| `bitrix-sync` | `/functions/v1/bitrix-sync` | `POST` | JWT (padrão Supabase, salvo override) | Ver `index.ts`/Zod local | JSON (`success`/`data`/`error`) | não mapeado formalmente |
| `block-ip-temporarily` | `/functions/v1/block-ip-temporarily` | `POST` | JWT (padrão Supabase, salvo override) | Ver `index.ts`/Zod local | JSON (`success`/`data`/`error`) | não mapeado formalmente |
| `bulk-random-passwords` | `/functions/v1/bulk-random-passwords` | `POST` | JWT (padrão Supabase, salvo override) | Ver `index.ts`/Zod local | JSON (`success`/`data`/`error`) | não mapeado formalmente |
| `categories-api` | `/functions/v1/categories-api` | `POST` | JWT (padrão Supabase, salvo override) | Ver `index.ts`/Zod local | JSON (`success`/`data`/`error`) | não mapeado formalmente |
| `cleanup-notifications` | `/functions/v1/cleanup-notifications` | `POST` | JWT (padrão Supabase, salvo override) | Ver `index.ts`/Zod local | JSON (`success`/`data`/`error`) | não mapeado formalmente |
| `cleanup-novelties` | `/functions/v1/cleanup-novelties` | `POST` | JWT (padrão Supabase, salvo override) | Ver `index.ts`/Zod local | JSON (`success`/`data`/`error`) | não mapeado formalmente |
| `cnpj-lookup` | `/functions/v1/cnpj-lookup` | `POST` | JWT (padrão Supabase, salvo override) | Ver `index.ts`/Zod local | JSON (`success`/`data`/`error`) | não mapeado formalmente |
| `collections-watcher` | `/functions/v1/collections-watcher` | `POST` | JWT (padrão Supabase, salvo override) | Ver `index.ts`/Zod local | JSON (`success`/`data`/`error`) | não mapeado formalmente |
| `commemorative-dates` | `/functions/v1/commemorative-dates` | `POST` | JWT (padrão Supabase, salvo override) | Ver `index.ts`/Zod local | JSON (`success`/`data`/`error`) | não mapeado formalmente |
| `comparison-ai-advisor` | `/functions/v1/comparison-ai-advisor` | `POST` | JWT (padrão Supabase, salvo override) | Ver `index.ts`/Zod local | JSON (`success`/`data`/`error`) | não mapeado formalmente |
| `comparison-price-watcher` | `/functions/v1/comparison-price-watcher` | `POST` | JWT (padrão Supabase, salvo override) | Ver `index.ts`/Zod local | JSON (`success`/`data`/`error`) | não mapeado formalmente |
| `connection-tester` | `/functions/v1/connection-tester` | `POST` | JWT (padrão Supabase, salvo override) | Ver `index.ts`/Zod local | JSON (`success`/`data`/`error`) | não mapeado formalmente |
| `connections-auto-test` | `/functions/v1/connections-auto-test` | `POST` | JWT (padrão Supabase, salvo override) | Ver `index.ts`/Zod local | JSON (`success`/`data`/`error`) | não mapeado formalmente |
| `connections-health-check` | `/functions/v1/connections-health-check` | `POST` | JWT (padrão Supabase, salvo override) | Ver `index.ts`/Zod local | JSON (`success`/`data`/`error`) | não mapeado formalmente |
| `connections-hub-audit` | `/functions/v1/connections-hub-audit` | `POST` | JWT (padrão Supabase, salvo override) | Ver `index.ts`/Zod local | JSON (`success`/`data`/`error`) | não mapeado formalmente |
| `cors-audit` | `/functions/v1/cors-audit` | `POST` | JWT (padrão Supabase, salvo override) | Ver `index.ts`/Zod local | JSON (`success`/`data`/`error`) | não mapeado formalmente |
| `crm-db-bridge` | `/functions/v1/crm-db-bridge` | `POST` | Public com defesa interna | Zod bridge CRM | dados/erro padronizado | superfície elevada sem JWT nativo |
| `detect-new-device` | `/functions/v1/detect-new-device` | `POST` | JWT (padrão Supabase, salvo override) | Ver `index.ts`/Zod local | JSON (`success`/`data`/`error`) | não mapeado formalmente |
| `dropbox-list` | `/functions/v1/dropbox-list` | `POST` | JWT (padrão Supabase, salvo override) | Ver `index.ts`/Zod local | JSON (`success`/`data`/`error`) | não mapeado formalmente |
| `e2e-cleanup` | `/functions/v1/e2e-cleanup` | `POST` | JWT (padrão Supabase, salvo override) | Ver `index.ts`/Zod local | JSON (`success`/`data`/`error`) | não mapeado formalmente |
| `elevenlabs-scribe-token` | `/functions/v1/elevenlabs-scribe-token` | `POST` | JWT (padrão Supabase, salvo override) | Ver `index.ts`/Zod local | JSON (`success`/`data`/`error`) | não mapeado formalmente |
| `elevenlabs-tts` | `/functions/v1/elevenlabs-tts` | `POST` | JWT (padrão Supabase, salvo override) | Ver `index.ts`/Zod local | JSON (`success`/`data`/`error`) | não mapeado formalmente |
| `expert-chat` | `/functions/v1/expert-chat` | `POST` | JWT (padrão Supabase, salvo override) | Ver `index.ts`/Zod local | JSON (`success`/`data`/`error`) | não mapeado formalmente |
| `external-db-bridge` | `/functions/v1/external-db-bridge` | `POST` | JWT/Service (defesa interna) | Zod bridge query | dados/erro padronizado | risco bypass legacy SEC-001 histórico |
| `external-db-inspect` | `/functions/v1/external-db-inspect` | `POST` | JWT (padrão Supabase, salvo override) | Ver `index.ts`/Zod local | JSON (`success`/`data`/`error`) | não mapeado formalmente |
| `favorites-watcher` | `/functions/v1/favorites-watcher` | `POST` | JWT (padrão Supabase, salvo override) | Ver `index.ts`/Zod local | JSON (`success`/`data`/`error`) | não mapeado formalmente |
| `force-global-logout` | `/functions/v1/force-global-logout` | `POST` | JWT (padrão Supabase, salvo override) | Ver `index.ts`/Zod local | JSON (`success`/`data`/`error`) | não mapeado formalmente |
| `full-op-diagnostics` | `/functions/v1/full-op-diagnostics` | `POST` | JWT (padrão Supabase, salvo override) | Ver `index.ts`/Zod local | JSON (`success`/`data`/`error`) | não mapeado formalmente |
| `generate-ad-image` | `/functions/v1/generate-ad-image` | `POST` | JWT (padrão Supabase, salvo override) | Ver `index.ts`/Zod local | JSON (`success`/`data`/`error`) | não mapeado formalmente |
| `generate-ad-prompt` | `/functions/v1/generate-ad-prompt` | `POST` | JWT (padrão Supabase, salvo override) | Ver `index.ts`/Zod local | JSON (`success`/`data`/`error`) | não mapeado formalmente |
| `generate-mockup` | `/functions/v1/generate-mockup` | `POST` | JWT (padrão Supabase, salvo override) | Ver `index.ts`/Zod local | JSON (`success`/`data`/`error`) | não mapeado formalmente |
| `generate-product-seo` | `/functions/v1/generate-product-seo` | `POST` | JWT (padrão Supabase, salvo override) | Ver `index.ts`/Zod local | JSON (`success`/`data`/`error`) | não mapeado formalmente |
| `get-visitor-info` | `/functions/v1/get-visitor-info` | `GET` | Public | Sem body | geo/ip JSON | dependência GeoIP |
| `github-credentials-test` | `/functions/v1/github-credentials-test` | `POST` | JWT (padrão Supabase, salvo override) | Ver `index.ts`/Zod local | JSON (`success`/`data`/`error`) | não mapeado formalmente |
| `health-check` | `/functions/v1/health-check` | `GET` | Public | Sem body | status JSON | nenhum crítico |
| `image-proxy` | `/functions/v1/image-proxy` | `POST` | JWT (padrão Supabase, salvo override) | Ver `index.ts`/Zod local | JSON (`success`/`data`/`error`) | não mapeado formalmente |
| `kit-ai-builder` | `/functions/v1/kit-ai-builder` | `POST` | JWT (padrão Supabase, salvo override) | Ver `index.ts`/Zod local | JSON (`success`/`data`/`error`) | não mapeado formalmente |
| `kit-identity-suggest` | `/functions/v1/kit-identity-suggest` | `POST` | JWT (padrão Supabase, salvo override) | Ver `index.ts`/Zod local | JSON (`success`/`data`/`error`) | não mapeado formalmente |
| `log-login-attempt` | `/functions/v1/log-login-attempt` | `POST` | JWT (padrão Supabase, salvo override) | Ver `index.ts`/Zod local | JSON (`success`/`data`/`error`) | não mapeado formalmente |
| `magic-up-score` | `/functions/v1/magic-up-score` | `POST` | JWT (padrão Supabase, salvo override) | Ver `index.ts`/Zod local | JSON (`success`/`data`/`error`) | não mapeado formalmente |
| `manage-users` | `/functions/v1/manage-users` | `POST` | JWT (padrão Supabase, salvo override) | Ver `index.ts`/Zod local | JSON (`success`/`data`/`error`) | não mapeado formalmente |
| `market-intelligence-insights` | `/functions/v1/market-intelligence-insights` | `POST` | JWT (padrão Supabase, salvo override) | Ver `index.ts`/Zod local | JSON (`success`/`data`/`error`) | não mapeado formalmente |
| `materials-api` | `/functions/v1/materials-api` | `POST` | JWT (padrão Supabase, salvo override) | Ver `index.ts`/Zod local | JSON (`success`/`data`/`error`) | não mapeado formalmente |
| `mcp-keys-issue` | `/functions/v1/mcp-keys-issue` | `POST` | JWT (padrão Supabase, salvo override) | Ver `index.ts`/Zod local | JSON (`success`/`data`/`error`) | não mapeado formalmente |
| `mcp-keys-revoke` | `/functions/v1/mcp-keys-revoke` | `POST` | JWT (padrão Supabase, salvo override) | Ver `index.ts`/Zod local | JSON (`success`/`data`/`error`) | não mapeado formalmente |
| `mcp-keys-rotate` | `/functions/v1/mcp-keys-rotate` | `POST` | JWT (padrão Supabase, salvo override) | Ver `index.ts`/Zod local | JSON (`success`/`data`/`error`) | não mapeado formalmente |
| `mcp-keys-update` | `/functions/v1/mcp-keys-update` | `POST` | JWT (padrão Supabase, salvo override) | Ver `index.ts`/Zod local | JSON (`success`/`data`/`error`) | não mapeado formalmente |
| `mcp-server` | `/functions/v1/mcp-server` | `POST` | JWT (padrão Supabase, salvo override) | Ver `index.ts`/Zod local | JSON (`success`/`data`/`error`) | não mapeado formalmente |
| `ownership-audit` | `/functions/v1/ownership-audit` | `POST` | JWT (padrão Supabase, salvo override) | Ver `index.ts`/Zod local | JSON (`success`/`data`/`error`) | não mapeado formalmente |
| `ownership-repair` | `/functions/v1/ownership-repair` | `POST` | JWT (padrão Supabase, salvo override) | Ver `index.ts`/Zod local | JSON (`success`/`data`/`error`) | não mapeado formalmente |
| `process-queue` | `/functions/v1/process-queue` | `POST` | JWT (padrão Supabase, salvo override) | Ver `index.ts`/Zod local | JSON (`success`/`data`/`error`) | não mapeado formalmente |
| `process-scheduled-reports` | `/functions/v1/process-scheduled-reports` | `POST` | JWT (padrão Supabase, salvo override) | Ver `index.ts`/Zod local | JSON (`success`/`data`/`error`) | não mapeado formalmente |
| `product-webhook` | `/functions/v1/product-webhook` | `POST` | Public (assinatura/webhook) | Zod webhook produto | ack + resultado | falha assinatura/payload inválido |
| `quote-followup-reminders` | `/functions/v1/quote-followup-reminders` | `POST` | JWT (padrão Supabase, salvo override) | Ver `index.ts`/Zod local | JSON (`success`/`data`/`error`) | não mapeado formalmente |
| `quote-sync` | `/functions/v1/quote-sync` | `POST` | JWT (padrão Supabase, salvo override) | Ver `index.ts`/Zod local | JSON (`success`/`data`/`error`) | não mapeado formalmente |
| `rate-limit-check` | `/functions/v1/rate-limit-check` | `POST` | JWT | Zod | status limite | bloqueio 429 |
| `rls-audit` | `/functions/v1/rls-audit` | `POST` | JWT (padrão Supabase, salvo override) | Ver `index.ts`/Zod local | JSON (`success`/`data`/`error`) | não mapeado formalmente |
| `rls-integration-tests` | `/functions/v1/rls-integration-tests` | `POST` | JWT (padrão Supabase, salvo override) | Ver `index.ts`/Zod local | JSON (`success`/`data`/`error`) | não mapeado formalmente |
| `rls-matrix-export` | `/functions/v1/rls-matrix-export` | `POST` | JWT (padrão Supabase, salvo override) | Ver `index.ts`/Zod local | JSON (`success`/`data`/`error`) | não mapeado formalmente |
| `secrets-manager` | `/functions/v1/secrets-manager` | `POST` | JWT (padrão Supabase, salvo override) | Ver `index.ts`/Zod local | JSON (`success`/`data`/`error`) | não mapeado formalmente |
| `secure-upload` | `/functions/v1/secure-upload` | `POST` | JWT (padrão Supabase, salvo override) | Ver `index.ts`/Zod local | JSON (`success`/`data`/`error`) | não mapeado formalmente |
| `semantic-search` | `/functions/v1/semantic-search` | `POST` | JWT (padrão Supabase, salvo override) | Ver `index.ts`/Zod local | JSON (`success`/`data`/`error`) | não mapeado formalmente |
| `send-digest` | `/functions/v1/send-digest` | `POST` | JWT (padrão Supabase, salvo override) | Ver `index.ts`/Zod local | JSON (`success`/`data`/`error`) | não mapeado formalmente |
| `send-notification` | `/functions/v1/send-notification` | `POST` | JWT (padrão Supabase, salvo override) | Ver `index.ts`/Zod local | JSON (`success`/`data`/`error`) | não mapeado formalmente |
| `send-scheduled-reports` | `/functions/v1/send-scheduled-reports` | `POST` | JWT (padrão Supabase, salvo override) | Ver `index.ts`/Zod local | JSON (`success`/`data`/`error`) | não mapeado formalmente |
| `send-transactional-email` | `/functions/v1/send-transactional-email` | `POST` | JWT (padrão Supabase, salvo override) | Ver `index.ts`/Zod local | JSON (`success`/`data`/`error`) | não mapeado formalmente |
| `simulation-orchestrator` | `/functions/v1/simulation-orchestrator` | `POST` | JWT (padrão Supabase, salvo override) | Ver `index.ts`/Zod local | JSON (`success`/`data`/`error`) | não mapeado formalmente |
| `step-up-verify` | `/functions/v1/step-up-verify` | `POST` | JWT (padrão Supabase, salvo override) | Ver `index.ts`/Zod local | JSON (`success`/`data`/`error`) | não mapeado formalmente |
| `sync-external-db` | `/functions/v1/sync-external-db` | `POST` | JWT (padrão Supabase, salvo override) | Ver `index.ts`/Zod local | JSON (`success`/`data`/`error`) | não mapeado formalmente |
| `sync-quote-bitrix` | `/functions/v1/sync-quote-bitrix` | `POST` | JWT (padrão Supabase, salvo override) | Ver `index.ts`/Zod local | JSON (`success`/`data`/`error`) | não mapeado formalmente |
| `test-contract-orchestrator` | `/functions/v1/test-contract-orchestrator` | `POST` | JWT (padrão Supabase, salvo override) | Ver `index.ts`/Zod local | JSON (`success`/`data`/`error`) | não mapeado formalmente |
| `test-inventory-orchestrator` | `/functions/v1/test-inventory-orchestrator` | `POST` | JWT (padrão Supabase, salvo override) | Ver `index.ts`/Zod local | JSON (`success`/`data`/`error`) | não mapeado formalmente |
| `trends-insights` | `/functions/v1/trends-insights` | `POST` | JWT (padrão Supabase, salvo override) | Ver `index.ts`/Zod local | JSON (`success`/`data`/`error`) | não mapeado formalmente |
| `validate-access` | `/functions/v1/validate-access` | `POST` | JWT (padrão Supabase, salvo override) | Ver `index.ts`/Zod local | JSON (`success`/`data`/`error`) | não mapeado formalmente |
| `verify-email` | `/functions/v1/verify-email` | `POST` | JWT (padrão Supabase, salvo override) | Ver `index.ts`/Zod local | JSON (`success`/`data`/`error`) | não mapeado formalmente |
| `visual-search` | `/functions/v1/visual-search` | `POST` | JWT (padrão Supabase, salvo override) | Ver `index.ts`/Zod local | JSON (`success`/`data`/`error`) | não mapeado formalmente |
| `voice-agent` | `/functions/v1/voice-agent` | `POST` | JWT (padrão Supabase, salvo override) | Ver `index.ts`/Zod local | JSON (`success`/`data`/`error`) | não mapeado formalmente |
| `webhook-dispatcher` | `/functions/v1/webhook-dispatcher` | `POST` | Service/secret | Zod dispatcher | resultado dispatch | fallback legacy_no_auth (audit SEC-003) |
| `webhook-inbound` | `/functions/v1/webhook-inbound` | `POST` | Public (assinatura/webhook) | Zod webhook inbound | ack + id evento | HMAC inválido |

## Notas de QA
- Para funções sem contrato explícito no SSOT, validar manualmente `index.ts` e (quando existir) schemas em `supabase/functions/_shared/contracts/schemas/`.
- Achados críticos de segurança já documentados: `SEC-001`, `SEC-002`, `SEC-003` na auditoria de 2026-05-22.
