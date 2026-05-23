# Edge Functions — Catálogo Completo

> Última atualização: 2026-05-22 · **81 funções ativas** (24 com `verify_jwt = false`, todas com defesa interna validada — ver auditoria back-end sênior de 2026-05-22)
> A tabela abaixo é histórica e cobre as ~50 funções originais — o inventário completo de 81 está em `audit/ANALISE_BACKEND_SENIOR_2026-05-22.md` (Seção 1).

## Convenções

- **Auth**: `JWT` (verifica via `Authorization: Bearer`), `Public` (sem auth — webhook ou view pública), `Service` (apenas service-role)
- **CORS**: `Restrita` (allowlist em `_shared/cors.ts`) ou `Pública` (apenas `get-visitor-info`)
- **Validação**: `Zod` (schema), `Manual` (checks ad-hoc), `N/A` (sem body)
- **Rate Limit**: `RPC check_rate_limit` (DB) ou `RateLimiter` (in-memory) ou `Não`

## Tabela de endpoints

| Função | Auth | CORS | Validação | Rate Limit | Descrição |
|---|---|---|---|---|---|
| `ai-recommendations` | Public | Restrita | Zod | DB | Recomendações de produtos via Lovable AI |
| `analyze-logo-colors` | JWT | Restrita | Zod | RateLimiter | Extrai paleta de cores dominante de um logo |
| `bitrix-sync` | JWT | Restrita | Zod | Não | Sincroniza orçamento ↔ Bitrix24 CRM |
| `categories-api` | JWT | Restrita | Zod | Não | CRUD de categorias do catálogo externo |
| `cleanup-notifications` | Service | Restrita | N/A | Não | Job pg_cron — apaga notificações > 90d lidas |
| `cleanup-novelties` | Service | Restrita | N/A | Não | Job pg_cron — limpa flags de novidade |
| `cnpj-lookup` | JWT | Restrita | Zod | RateLimiter | Consulta CNPJ via CNPJa API |
| `commemorative-dates` | JWT | Restrita | Zod | Não | Lista datas comemorativas para campanhas |
| `crm-db-bridge` | Public | Restrita | Zod | RateLimiter | Ponte para Supabase secundário (CRM) |
| `detect-new-device` | JWT | Restrita | Zod | DB | Marca dispositivos novos no login |
| `dropbox-list` | JWT | Restrita | Zod | RateLimiter | Lista arquivos de pasta Dropbox |
| `elevenlabs-scribe-token` | JWT | Restrita | N/A | RateLimiter | Token efêmero para STT em tempo real |
| `elevenlabs-tts` | JWT | Restrita | Zod | RateLimiter | Síntese de voz |
| `expert-chat` | JWT | Restrita | Zod | DB (ai) | Chat com IA especialista (Lovable AI) |
| `external-db-bridge` | JWT | Restrita | Zod | DB | Ponte para banco Promobrind (catálogo) |
| `external-db-inspect` | Public | Restrita | Zod | Não | Inspeção de schemas externos (debug) |
| `generate-ad-image` | JWT | Restrita | Zod | DB (ai) | Gera imagem publicitária (Magic Up) |
| `generate-ad-prompt` | JWT | Restrita | Zod | DB (ai) | Gera prompt para campanha |
| `generate-mockup` | JWT | Restrita | Zod | DB (ai) | Mockup via Gemini 2.5 Pro |
| `generate-mockup-nanobanana` | JWT | Restrita | Zod | DB (ai) | Mockup via Gemini 3 Flash Image |
| `generate-product-seo` | JWT | Restrita | Zod | DB (ai) | Gera meta description SEO |
| `get-visitor-info` | Public | **Pública** | N/A | Não | Geo-IP do visitante |
| `github-fix-config` | JWT | Restrita | N/A | Não | Tool dev — corrige tsconfig via API GitHub |
| `health-check` | Public | Restrita | N/A | Não | Liveness probe |
| `image-proxy` | Public | Restrita | URL allowlist | RateLimiter | Proxy anti-hotlink p/ imagens externas |
| `kit-public-view` | Public | Restrita | Zod (token) | RateLimiter | Visualização pública de kit |
| `log-login-attempt` | Public | Restrita | Zod | DB | Loga tentativas de login (brute-force) |
| `manage-users` | JWT (admin) | Restrita | Zod | Não | CRUD de usuários (admin only) |
| `materials-api` | JWT | Restrita | Zod | Não | CRUD de materiais do catálogo |
| `process-queue` | Service | Restrita | N/A | Não | Job pg_cron — processa fila genérica |
| `process-scheduled-reports` | Service | Restrita | N/A | Não | Job pg_cron — relatórios agendados |
| `product-webhook` | Public | Restrita | Zod | DB | Webhook do ERP — atualiza catálogo |
| `quote-public-view` | Public | Restrita | Zod (token) | RateLimiter | Visualização pública de orçamento |
| `quote-sync` | JWT | Restrita | Zod | Não | Sync de orçamento (interno) |
| `rate-limit-check` | JWT | Restrita | Zod | In-memory | Endpoint genérico de rate-limit |
| `semantic-search` | JWT | Restrita | Zod | DB (search) | Busca semântica via pg_trgm + IA |
| `send-digest` | Service | Restrita | N/A | Não | Job pg_cron — digest diário |
| `send-notification` | JWT | Restrita | Zod | Não | Dispara notificação workspace |
| `send-scheduled-reports` | Service | Restrita | N/A | Não | Envia relatórios agendados |
| `send-transactional-email` | JWT | Restrita | Zod | RateLimiter | Email transacional |
| `sync-quote-bitrix` | JWT | Restrita | Zod | Não | Sync orçamento → Bitrix |
| `tests` | Service | Restrita | N/A | Não | Smoke tests |
| `trends-insights` | JWT | Restrita | Zod | DB (ai) | Insights de tendências do mercado |
| `validate-access` | JWT | Restrita | Zod | DB | Valida permissões de feature/recurso |
| `verify-email` | Public | Restrita | Zod | DB | Verificação de email no signup |
| `visual-search` | JWT | Restrita | Zod | DB (ai) | Busca visual por similaridade |
| `voice-agent` | JWT | Restrita | Zod | DB (ai) | Agente de voz multimodal |
| `webhook-dispatcher` | Service | Restrita | Zod | Não | Despacha webhooks para terceiros |

## Helpers compartilhados

Localizados em `supabase/functions/_shared/`:

- **`cors.ts`** — `getCorsHeaders(req)` (allowlist) e `publicCorsHeaders` (legacy `*` apenas para `get-visitor-info`)
- **`zod-validate.ts`** — `parseBodyWithSchema(req, schema, corsHeaders)` + schemas reutilizáveis (`uuidSchema`, `emailSchema`, `tokenSchema`, etc.)
- **`rate-limiter.ts`** — `RateLimiter` in-memory com presets (`ai`, `search`, `approval`)
- **`bot-protection.ts`** — `runBotProtection(req, opts)` — UA check + rate-limit por IP + log em `bot_detection_log`
- **`auth.ts`** — `requireAuth(req)` — extrai JWT e retorna usuário autenticado

## Padrões obrigatórios

1. **Sempre** importar CORS de `_shared/cors.ts` — nunca declarar inline.
2. **Sempre** validar entrada com Zod quando há body/query parameters.
3. **Sempre** retornar `corsHeaders` em **todas** as respostas (200 e erros).
4. **Sempre** registrar erros com `console.error` (capturado pelo Logflare).
5. **Nunca** expor stack traces ou mensagens internas — retornar mensagem genérica + log do detalhe.
6. **Nunca** confiar em `service_role` em endpoints públicos sem rate-limit + bot protection.

## Como testar

```bash
# Via Supabase tools (preferencial)
curl_edge_functions(path="/cnpj-lookup", method="POST", body='{"cnpj":"00000000000000"}')

# Via shell local (precisa do anon key do .env)
curl -X POST "$VITE_SUPABASE_URL/functions/v1/cnpj-lookup" \
  -H "Authorization: Bearer $VITE_SUPABASE_PUBLISHABLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"cnpj":"00000000000000"}'
```
