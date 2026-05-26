# Auditoria Exaustiva: Código × Infraestrutura Supabase
**Sistema:** promo-gifts-v4 | **Projeto Supabase:** `doufsxqlfjyuvxuezpln` (supabase-fuchsia-kite, sa-east-1)
**Data:** 2026-05-25 | **Metodologia:** 50 tarefas cobrindo DB live, Edge Functions, Frontend, Segurança e Observabilidade

---

## Scorecard Geral

| Grupo | Tarefas | 🔴 Crítico | ⚠️ Atenção | ✅ OK |
|---|---|---|---|---|
| A — Schema DB ao vivo | T01–T10 | 1 | 5 | 4 |
| B — Edge Functions | T11–T20 | 5 | 4 | 1 |
| C — Frontend | T21–T30 | 1 | 5 | 4 |
| D — Segurança | T31–T40 | 0 | 8 | 2 |
| E — Performance/Obs. | T41–T50 | 1 | 4 | 5 |
| **TOTAL** | **50** | **8** | **26** | **16** |

---

## Top 10 Achados de Maior Risco

| # | ID | Achado | Severidade |
|---|---|---|---|
| 1 | T32+T39 | CSP com `unsafe-inline`+`unsafe-eval` + sessão em localStorage → roubo de sessão via XSS | 🔴 P0 |
| 2 | T42 | `user_roles` 96% seq_scan (101k), `quotes` e `integration_credentials` 100% seq_scan | 🔴 P0 |
| 3 | T12 | `get-visitor-info` público sem auth/rate limit faz lookup em ip-api.com com IP controlável | 🔴 P1 |
| 4 | T19 | Apenas 1 kill switch no DB (`external-db-bridge`); 13 funções críticas sem contenção rápida | 🔴 P1 |
| 5 | T17 | Circuit breaker em apenas 1/20 funções com chamadas externas — cascata sem proteção | 🔴 P1 |
| 6 | T22 | 85 `select('*')` incluindo `security_settings`, `ip_whitelist`, `password_reset_requests` | 🔴 P1 |
| 7 | T15 | 10% das edge functions usam logger estruturado — rastreabilidade de produção comprometida | 🔴 P2 |
| 8 | T18 | 84% das edge functions não propagam `x-request-id` — traces distribuídos impossíveis | 🔴 P2 |
| 9 | T38 | `SIMULATION_BYPASS_KEY` ativo em `external-db-bridge` com bypass JWT real | ⚠️ P1 |
| 10 | T34 | 15+ funções leem segredos via `Deno.env.get()` bypassando `credentials.ts` — rotação impossível sem redeploy | ⚠️ P1 |

---

## Grupo A — Schema do DB ao Vivo (T01–T10)

### T01 — Tabelas ao Vivo vs Migrations Locais ⚠️

**Números reais coletados:**
- **296 tabelas** no schema `public` (todas com `rowsecurity = true`)
- **841 arquivos** de migration locais
- **314 migrations stub** (<200 bytes) = **37,3% do total**
- **Última migration no DB:** `20260525193202` — mais recente que qualquer arquivo local (mais recente local: `20260525132458`)

**Evidências:**
```
56 bytes: 20260416181632_ba3b340a.sql   (stub puro)
56 bytes: 20260426130701_c4f052a8.sql   (stub puro)
76 bytes: 20260517142926_pqp_alias_*    (~14 arquivos de alias/workaround)
1,05 MB:  20260513000000_reconcile_orphan_functions_from_prod.sql  (reconciliação de funções criadas direto no prod)
```

**Diagnóstico:** Migration `20260525193202` (`sync_user_organizations_to_organization_members`) foi aplicada diretamente no Supabase sem arquivo local correspondente. Evidência de drift ativo.

**Ação:** Exportar e comitar a migration faltante; adotar política de "local-first" para toda DDL.

---

### T02 — Cobertura de RLS por Tabela ⚠️

**Números reais:**
- 296 tabelas com `rowsecurity = true` — **100% habilitado** ✅
- **0 tabelas sem nenhuma política** ✅
- **120+ políticas com `roles = {public}`** ⚠️

**Políticas de risco real:**

| Tabela | Política | Cmd | Risco |
|---|---|---|---|
| `analytics_events` | `ae_insert_anon` | INSERT | `anon` pode inserir — vetor de spam |
| `frontend_telemetry` | `frontend_telemetry_insert_anon` | INSERT | `anon` pode inserir — idem |
| `edge_rate_limits` | `Service role can do everything` | ALL | `{public}` — qualquer autenticado manipula rate limits |
| `ai_function_routing` | `ai_function_routing_dev_all` | ALL | `{public}` — acesso total ao roteamento de IA |
| `mockup_approval_links` | `mal_public_select_active` | SELECT | `anon` — by design, verificar |
| `password_reset_requests` | INSERT | INSERT | `anon+authenticated` — deve ter rate limit separado |

**Nota:** `roles = {public}` em Supabase não é anon — o risco real depende do `USING`/`WITH CHECK`. As políticas `_dev_all` para tabelas de AI com `{public}` merecem revisão.

---

### T03 — Índices vs Queries Frequentes 🔴

**Tabelas mais acessadas no frontend** (`.from()` calls): `quotes` (31), `profiles` (31), `custom_kits` (20), `quote_items` (18), `order_items` (18).

**Seq scans críticos (dado real de `pg_stat_user_tables`):**

| Tabela | seq_scan | idx_scan | % seq | seq_tup_read | Diagnóstico |
|---|---|---|---|---|---|
| `user_roles` | **101.866** | 4.351 | **96%** | 1.6M | CRÍTICO — verificações de role sem índice efetivo |
| `integration_credentials` | **101.042** | 41 | **100%** | — | CRÍTICO — trigger/RLS fazem full scan |
| `quotes` | **65.679** | 25 | **100%** | — | CRÍTICO — RLS usa `can_access_quote()` sem índice |
| `quote_items` | **14.097** | 126 | **99%** | — | Alto |
| `supplier_settings` | **11.166** | — | **91%** | — | Médio |
| `color_variations` | **7.218** | — | **100%** | 577k | Alto |

**Correções prioritárias:**
```sql
-- user_roles: queries de RLS usam apenas user_id
CREATE INDEX CONCURRENTLY idx_user_roles_user_id ON user_roles(user_id);

-- integration_credentials: buscas por name
CREATE INDEX CONCURRENTLY idx_integration_creds_name ON integration_credentials(name);

-- quotes: RLS + listagem por organização/usuário
CREATE INDEX CONCURRENTLY idx_quotes_user_org ON quotes(user_id, organization_id, status);
```

---

### T04 — Funções RPC no DB vs Código ✅

**RPCs no frontend (21 únicas):** todas existem no DB. Nenhuma chamada órfã.
**RPCs nas edge functions (15 únicas):** todas existem no DB.
**Funções SECURITY DEFINER com acesso externo:** `check_edge_rate_limit`, `claim_next_optimization`, `complete_optimization`, `cleanup_old_logs`, `sync_external_connections_from_credentials`.

---

### T05 — Triggers Ativos ⚠️

**Total de triggers:** ~180 (não-internos).
**DESABILITADO (tgenabled = 'D'):**
```
trg_log_price_change  →  tabela: product_variants  →  fn: fn_log_price_change
```
Mudanças de preço em variantes **não estão sendo registradas** — lacuna de auditoria financeira.

**Tabela `products` com 19+ triggers:** densidade que degrada INSERTs/UPDATEs em lote (confirma seq_scan de 18k na tabela).

**Ação:** Reabilitar `trg_log_price_change` ou documentar decisão com aprovação da área de negócio.

---

### T06 — Views e Materialized Views ✅

- **111 views** no schema `public`
- **0 materialized views** — views com prefixo `mv_` são views comuns computadas em tempo real
- **Risco:** `mv_product_cards`, `mv_product_intelligence`, `mv_stock_velocity` computam dados pesados sem materialização

---

### T07 — Extensões Habilitadas ⚠️

**15 extensões instaladas.** Críticas presentes: `uuid-ossp`, `pgcrypto`, `pg_cron`, `pg_net`, `wrappers`, `supabase_vault`, `pg_stat_statements`, `pg_trgm`.

**Extensões de desenvolvimento em produção:**
- `hypopg` (1.4.1) — índices hipotéticos, ferramenta de análise
- `index_advisor` (0.2.0) — advisor de índices, ferramenta de análise
- `pg_graphql` (1.5.11) — nenhum endpoint GraphQL identificado no código

**Ausente:** `pg_partman` — particionamento não implementado apesar do volume de dados.

---

### T08 — Drift de Migrations ✅ (com ressalva)

**Contagem:** 841 no DB = 841 arquivos locais (zero drift numérico).
**Ressalva:** Última versão no DB (`20260525193202`) mais recente que o último arquivo local — migration aplicada diretamente no Supabase sem arquivo local.

---

### T09 — Foreign Keys e Integridade Referencial ✅

- **0 FKs não validadas** (`convalidated = false`)
- Estrutura referencial coerente: `products → variants/images/materials`, `quotes → quote_items → personalizations`
- Tabelas de auditoria sem FK para `profiles` (intencional — log persiste mesmo após deleção de usuário)

---

### T10 — Enum Types no DB vs TypeScript ⚠️

**`app_role` no DB:** `{dev, supervisor, admin, manager, agente, coordenador, vendedor}` — **7 valores**.

**TypeScript em `telemetryService.ts`:** `"dev" | "supervisor" | "agente" | "admin" | "manager" | "vendedor"` — **sem `coordenador`**.

**Impacto:** Usuários com role `coordenador` têm comportamento incorreto no frontend — permissões erradas renderizadas.

**Correção:**
```typescript
// Adicionar 'coordenador' em todos os union types de AppRole
type AppRole = "dev" | "supervisor" | "admin" | "manager" | "agente" | "coordenador" | "vendedor";
```

---

## Grupo B — Edge Functions (T11–T20)

### T11 — Funções Deployadas vs Locais ⚠️

- **82 diretórios** locais em `supabase/functions/`
- **79 funções** deployadas no Supabase (todas ACTIVE)
- `rls-integration-tests` está deployado como **endpoint de produção ativo** — deve ser protegido por role `dev` estritamente
- `config.toml` local desatualizado: `ai-recommendations` e `get-visitor-info` constam como `verify_jwt=false` localmente mas API retorna `verify_jwt=true`

---

### T12 — `verify_jwt=false` sem Proteção Manual 🔴

**25 funções com `verify_jwt=false`** (config.toml). 24 têm alguma proteção (cronSecret, service_role, HMAC webhook).

**Vulnerável:**
```
get-visitor-info:
  - verify_jwt=false
  - Sem authenticateRequest(), sem runBotProtection(), sem rate limit
  - Faz fetch("http://ip-api.com/" + req.headers.get("x-forwarded-for"))
  - O IP no header x-forwarded-for é CONTROLÁVEL pelo cliente
  - Vetor: abusar cota do ip-api.com, geolocalizar IPs arbitrários (SSRF-like)
```

**Correção:**
```typescript
// Adicionar no início do handler:
await runBotProtection(req, supabase);
// OU converter para verify_jwt=true + getUser()
```

---

### T13 — Padrão de Autenticação por Função ⚠️

- **48/81** com autenticação explícita no código
- **33/81** dependem apenas do middleware JWT sem verificar role/claims

**Funções que aceitam qualquer JWT válido sem restrição de role:**
- `product-webhook` — escreve dados de produto
- `detect-new-device` — registra dispositivos
- `log-login-attempt` — escreve log de segurança
- `simulation-orchestrator` — inicia simulações

---

### T14 — Cobertura de CORS ✅

**100% das 81 funções** usam `_shared/cors.ts`. Zero definições inline. SSOT perfeito.

---

### T15 — Logging Estruturado 🔴

| Métrica | Valor |
|---|---|
| Funções com `createStructuredLogger` | **8/81 (10%)** |
| Funções com `console.log` direto | **51/81 (63%)** |
| Funções sem nenhum log identificável | **22/81 (27%)** |

**Funções críticas sem logger estruturado:** `ai-recommendations`, `bi-copilot`, `crm-db-bridge`, `expert-chat`, `webhook-dispatcher`, `manage-users`, `rls-audit`, `step-up-verify`.

**Impacto:** Logs de 73 funções chegam sem `request_id`, `fn`, `duration_ms` — impossível correlacionar traces em produção ou construir dashboards de latência por função.

---

### T16 — Tratamento de Erros ⚠️

- `cors-audit` é a única sem bloco `catch` (risco baixo — função interna de diagnóstico)
- Todas as demais têm 1 catch global — sem granularidade por estágio (auth vs DB vs externo)
- **Nenhum catch vazio** encontrado

---

### T17 — Circuit Breaker 🔴

| Métrica | Valor |
|---|---|
| Funções com `fetch()` externo | **20** |
| Com circuit breaker | **1** (`crm-db-bridge`) |
| Sem circuit breaker | **19** |

**Funções críticas sem proteção:**
- `webhook-dispatcher` — dispara para URLs arbitrárias de terceiros
- `bi-copilot` — chama AI API
- `expert-chat` — chama LLM
- `ai-recommendations` — chama HuggingFace
- `elevenlabs-tts` / `elevenlabs-scribe-token` — chama ElevenLabs
- `bitrix-sync` / `quote-sync` — sincronização CRM
- `cnpj-lookup` — consulta CNPJA

O colapso de 2026-05-24 foi causado por cascata em `external-db-bridge` — agora tem circuit breaker. As outras 19 funções repetem o mesmo padrão de risco.

---

### T18 — Propagação de X-Request-Id 🔴

| Métrica | Valor |
|---|---|
| Funções propagando `x-request-id` | **13/81 (16%)** |
| Sem propagação | **68/81 (84%)** |

**Funções críticas sem request ID:** `ai-recommendations`, `bi-copilot`, `expert-chat`, `manage-users`, `rls-audit`, `step-up-verify`, `webhook-dispatcher`, `send-transactional-email`.

**Impacto:** Impossível correlacionar logs de uma requisição entre funções encadeadas. Debugging de incidentes de produção depende de timestamps e heurísticas.

---

### T19 — Kill Switches 🔴

**Estado real do DB:**
```sql
SELECT switch_name, enabled FROM system_kill_switches;
-- Resultado: 1 linha
-- switch_name: edge_external_db_bridge | enabled: true
```

**Funções críticas sem kill switch:**
- `crm-db-bridge`, `ai-recommendations`, `comparison-ai-advisor`, `bi-copilot`
- `expert-chat`, `webhook-dispatcher`, `quote-sync`, `simulation-orchestrator`
- `market-intelligence-insights`, `trends-insights`
- `process-scheduled-reports`, `send-scheduled-reports`

**Modelo de expansão:**
```typescript
// Em cada função crítica, adicionar na primeira linha do handler:
await assertSwitchEnabled("edge_crm_db_bridge", req, corsHeaders);
// + INSERT em system_kill_switches:
-- INSERT INTO system_kill_switches (switch_name, enabled) VALUES ('edge_crm_db_bridge', true);
```

---

### T20 — Rate Limiting e Proteção contra Bots ⚠️

- **19 funções** com rate limiting ativo (`runBotProtection` / `check_rate_limit`)
- **`get-visitor-info`** — único endpoint público completamente desprotegido (ver T12)
- Cron jobs sem rate limit têm risco baixo (protegidos por `x-cron-secret`)
- `mcp-server` sem rate limit explícito — apenas autenticação MCP própria

---

## Grupo C — Frontend (T21–T30)

### T21 — useQuery/useMutation e Chaves de Cache ⚠️

**699 chamadas** de `useQuery`/`useMutation`/`useInfiniteQuery`.

**Problemas:**
1. **35 queries com `[QUERY_KEY]` genérico** — constante local com mesmo nome em arquivos diferentes, risco de invalidação cruzada acidental
2. **Colisão de chaves:** `['kit-templates']` em `useAdminKitTemplates.ts:11` e `useKitTemplates.ts:31` — dois hooks com mesma chave
3. **Ausência de factory de queryKey centralizada** — apenas `useTecnicas` usa `src/hooks/tecnicas/keys.ts` como modelo

---

### T22 — `select('*')` em Tabelas Sensíveis 🔴

**85 usos** de `select('*')`. Tabelas críticas expostas:

| Arquivo | Tabela |
|---|---|
| `usePasswordResetRequests.ts:28` | `password_reset_requests` |
| `useAccessSecurity.ts:58-63` | `access_security_settings`, `ip_whitelist`, `city_whitelist` |
| `useAllowedIPs.ts:47` | `allowed_ips` |
| `useGeoBlocking.ts:48-49` | `geo_allowed_countries`, `security_settings` |
| `RecentAuditTable.tsx:57` | tabela de auditoria |
| `useAiRouter.ts:168` | rota de AI |

**Correção (exemplo):**
```typescript
// Antes:
.from('access_security_settings').select('*')

// Depois:
.from('access_security_settings')
  .select('id, setting_key, setting_value, updated_at')
  // Nunca incluir: hash, token, secret_key, raw_value
```

---

### T23 — Auth State e Race Conditions ⚠️

**`getSession()` em 8+ arquivos fora do AuthContext:**
- `src/components/ai/AIChat.tsx:195`
- `src/components/expert/chat/useExpertChat.ts:479`
- `src/hooks/voice/processTranscript.ts:15`
- `src/hooks/voice/playTtsAudio.ts:88`
- `src/hooks/intelligence/useAIRecommendations.ts:135`
- `src/services/ramoAtividadeService.ts:18`
- `src/lib/external-db/bridge.ts:109`

**Problema:** `getSession()` retorna dados do cache local — não valida com o servidor. Para contextos que fazem chamadas autenticadas (especialmente `bridge.ts`), use `getUser()`.

**Positivo:** `onAuthStateChange` tem cleanup correto com `unsubscribe()`.

---

### T24 — Validação de Formulários ⚠️

**4 de ~24 formulários** usam `zodResolver`. Os demais não têm schema de validação robusto.

**Formulários críticos sem Zod:** `KeysValidationTab.tsx:178`, `QuotesConfigurableList.tsx:73`.

---

### T25 — Error Boundaries e Toasts Técnicos ⚠️

**Error Boundaries:** cobertura boa (app, ProtectedRoute, AdminRoute). Ausentes em páginas de AI, kit-builder.

**Toasts expondo `error.message` bruto** (10+ casos):
```typescript
// Padrão inseguro encontrado em DiscountApprovalQueue.tsx:52,
// SellerDiscountLimitsPanel.tsx:75, useProductsManager.ts:222,246
// AppHealthDashboard.tsx:66, McpTab.tsx:60...
toast.error(e.message)  // expõe detalhes de banco para o usuário

// Padrão correto:
import { sanitizeError } from "@/lib/security/sanitize-error";
toast.error(sanitizeError(e).userMessage)
```

---

### T26 — Realtime Subscriptions ✅

**6 pontos de subscription** — todos com `supabase.removeChannel()` no cleanup do `useEffect`.

---

### T27 — Sanitização de Inputs ✅

**1 uso de `dangerouslySetInnerHTML`** (`src/components/ui/chart.tsx:75`) — usa `sanitizeHtml()` com validação de cor por regex antes de inserir.

**`sanitizeError`** e **`sanitizeMessage`** existem e são usados na maioria dos componentes críticos.

---

### T28 — Rotas Protegidas ✅

Todas as rotas usam `ProtectedRoute` com verificação server-side de roles via `useProfileRoles`. Nenhuma rota sem guard identificada.

---

### T29 — Globals Expostos ⚠️

**`window.__personalizationSchemaStats`** em `src/lib/personalization/adapters/schema-detection.ts:49-59`:
- Exposto em **produção** sem guard `import.meta.env.DEV`
- Contém: versões de contrato, lista de campos legados, mismatches recentes
- Chamado via `useCustomizationPrice.ts` — sempre ativo em produção

**`window.__DIAGNOSTICS__`** em `DiagnosticProfiler.tsx:35`:
- Ativável por qualquer usuário via `?diagnostics=true` na URL em produção

**`VITE_AUTH_DEBUG=true`** em `auth-flow-tracer.ts:21`:
- Habilita logging detalhado de auth se definido no Vercel — verificar se está setado

**Correção:**
```typescript
// schema-detection.ts:49 — adicionar guard:
if (import.meta.env.DEV) {
  (window as any).__personalizationSchemaStats = publishStats();
}
```

---

### T30 — Code Splitting e Bundle Size ✅

- `src/routes/lazy-pages.ts` centraliza todos os imports via `lazyWithRetry()` — padrão excelente
- `vite.config.ts` com 14 `manualChunks` bem segmentados
- Imports dinâmicos para bibliotecas pesadas (`xlsx`, `jspdf`, `html2canvas`, `@dnd-kit/sortable`)
- Único alerta: `chunkSizeWarningLimit: 2000` — eleva o limiar de aviso para 2MB, pode mascarar chunks grandes

---

## Grupo D — Segurança (T31–T40)

### T31 — SECURITY DEFINER e search_path ⚠️

**137 funções SECURITY DEFINER** no schema `public`, todas de propriedade de `postgres`.

**Problema:** `SET search_path = 'public'` em vez de `SET search_path = ''` (vazio).

```sql
-- Padrão encontrado (mitigação parcial):
CREATE FUNCTION fn_exemplo() RETURNS void
  SECURITY DEFINER
  SET search_path = public  -- ← não é o gold-standard

-- Padrão seguro (gold-standard Supabase):
  SET search_path = ''       -- força schema-qualificação explícita
```

**Funções acessíveis por `anon` (atenção):**
- `submit_quote_response` — acesso anônimo a resposta de cotação
- `get_quote_token_by_value` — exposição de token de cotação para anon
- `sync_user_org_to_org_members` — sincronização acessível por anon

---

### T32 — CSP Headers 🔴

| Aspecto | vercel.json (frontend) | _shared/cors.ts (edge) |
|---|---|---|
| `unsafe-inline` em script-src | **SIM** ❌ | não |
| `unsafe-eval` em script-src | **SIM** ❌ | não |
| `unsafe-inline` em style-src | **SIM** ❌ | não |
| `strict-dynamic` | não | SIM ✅ |
| `report-uri` | **AUSENTE** ❌ | **AUSENTE** ❌ |
| Wildcard `*.vercel.app` em connect-src | **SIM** | não |

**CSP atual do vercel.json (script-src):**
```
script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.gpteng.co https://vercel.live https://*.vercel.app
```

**CSP proposto (fase 1 — sem quebrar funcionalidade):**
```
script-src 'self' 'nonce-{NONCE}' https://cdn.gpteng.co https://vercel.live;
style-src 'self' 'nonce-{NONCE}' https://fonts.googleapis.com;
report-uri https://seu-projeto.report-uri.com/r/d/csp/enforce
```

---

### T33 — CORS Allowlist ⚠️

**Wildcards problemáticos em `_shared/cors.ts`:**
```typescript
/^https:\/\/[a-z0-9-]+\.vercel\.app$/i      // qualquer app na Vercel
/^https:\/\/[a-z0-9-]+\.lovable\.app$/i     // qualquer subdomínio lovable
/^https:\/\/[a-z0-9-]+\.lovableproject\.com$/i
```

**`buildPublicCorsHeaders()` usa `'*'`** — usado em `process-scheduled-reports`, expondo CORS aberto em endpoint de relatórios.

**Fail-open no preflight:** origin desconhecida recebe fallback `https://criar-together-now.lovable.app` em vez de rejeição 403.

---

### T34 — Vault vs Env Vars ⚠️

**Apenas 3 segredos no Vault** (todos com `key_id: null` — sem KMS configurado):
- `CRON_SECRET`, `WEBHOOK_DISPATCHER_SECRET`, `CONNECTIONS_AUTO_TEST_SECRET`

**15+ funções lendo diretamente de `Deno.env.get()` sem `credentials.ts`:**
```
process-scheduled-reports → RESEND_API_KEY
ai-recommendations        → HUGGINGFACE_API_KEY
elevenlabs-scribe-token   → ELEVENLABS_API_KEY
elevenlabs-tts            → ELEVENLABS_API_KEY
dropbox-list              → DROPBOX_ACCESS_TOKEN
secure-upload             → VIRUSTOTAL_API_KEY
quote-sync                → QUOTE_SYNC_API_KEY
```

**Consequência:** Rotação de API keys exige redeploy das funções. O `credentials.ts` (que suporta DB → env fallback com cache e auditoria) é bypassado.

---

### T35 — SQL Injection ✅

Nenhuma query SQL raw, interpolação de string ou `rawQuery` encontrada. Uso exclusivo do Supabase JS client com métodos parametrizados.

---

### T36 — RLS Bypass Patterns ⚠️

- `anon` tem `SELECT` grant em **321 tabelas** — mas a maioria é bloqueada por RLS (auth.uid() = NULL para anon)
- **`_asia_api_staging`**: `anon` tem DELETE, INSERT, SELECT, UPDATE — tabela de staging sem RLS visível
- **Dead code ativo:** `SIMULATION_BYPASS_KEY` carregado em `auth.ts:30` mas não utilizado (removido como SEC-003). Porém **ainda funciona** em `external-db-bridge/index.ts:857`:
  ```typescript
  if (!!simulationKey && constantTimeEqual(token, simulationKey)) {
    // bypass de autenticação JWT
  }
  ```

---

### T37 — JWT Expiration e Token Revocation ⚠️

**Estado real:**
```sql
SELECT count(*) FROM user_token_revocations;
-- Resultado: 0
```

O mecanismo de revogação **nunca foi usado em produção**.

**Problemas:**
1. **30s de cache TTL** = tokens revogados ainda válidos por até 30s
2. **Fail-open** em erro DB — decisão documentada mas aumenta superfície
3. **Sem limpeza automática** — crescimento ilimitado se ativado
4. **Sem índice** em `user_token_revocations` — não tem `expires_at` para limpeza por TTL

**Configuração do cliente:**
- `autoRefreshToken: true` + `persistSession: true` em localStorage
- JWT expiry: 1h (padrão Supabase)

---

### T38 — Simulation Role e Privilégios ⚠️

**`simulation` não existe no enum `app_role` do DB** — INSERT com `role='simulation'` falha.

**Mas em `_shared/auth.ts:82,88`:**
```typescript
function isDevRole(auth: AuthResult): boolean {
  return auth.userRoles.includes('dev') || auth.userRoles.includes('simulation');
  // ↑ 'simulation' nunca será true (enum inválido no DB) mas é dead code perigoso
}
```

**`SIMULATION_BYPASS_KEY` em `external-db-bridge/index.ts:857`:**
```typescript
// Bypass JWT real — ainda funciona se a env var estiver definida:
if (!!simulationKey && constantTimeEqual(token, simulationKey)) {
  return await handleCrud(body, req, corsHeaders, requestStartTime);
}
```

**Verificar se `SIMULATION_BYPASS_KEY` está definida no Supabase Secrets** — se sim, é uma backdoor ativa.

---

### T39 — Configuração de Auth ⚠️

```typescript
// src/lib/supabase/client.ts
auth: {
  storage: localStorage,
  persistSession: Boolean(storage),  // true em browser
  autoRefreshToken: true,
}
```

**Risco combinado:**
- `unsafe-inline` + `unsafe-eval` no CSP → XSS viável
- `persistSession: true` em localStorage → token de sessão exfiltrável via XSS
- `autoRefreshToken: true` → sessão renova indefinidamente sem logoff por inatividade

**Mitigação parcial possível:** usar `httpOnly` cookies via `cookieOptions` do Supabase Auth (requer mudança de arquitetura).

---

### T40 — Webhook Security ✅ (com ressalvas)

**`webhook-inbound`:** HMAC-SHA256 com `timingSafeEqual()` + anti-replay via nonce ✅
**`product-webhook`:** HMAC-SHA256 com nonce + timestamp ✅
**`webhook-dispatcher`:** assina payloads outbound com `X-Signature-256` ✅

**Ressalvas:**
- `sync-quote-bitrix` e `bitrix-sync` sem validação de assinatura — apenas autenticação básica
- `quote-sync` lê `QUOTE_SYNC_API_KEY` diretamente de `Deno.env` sem `credentials.ts`

---

## Grupo E — Performance, Observabilidade e Qualidade (T41–T50)

### T41 — Queries N+1 no Frontend ⚠️

**Caso 1 — `RoleAuditLogPanel.tsx:85-115` (N+1 confirmado):**
```typescript
// Query 1: busca audit_log
useQuery → .from('admin_audit_log').select(...)

// Query 2: dentro do forEach do resultado
.forEach(e) => .from('profiles').select(...).in('user_id', ids)
// ↑ Query disparada APÓS a primeira completar — N+1 clássico
```

**Caso 2 — `useUserManagement.ts:17,20`:**
```typescript
// Duas queries separadas sem join — 2 roundtrips por render
const { data: profiles } = useQuery(...)
const { data: roles } = useQuery(...)
// Solução: .from('profiles').select('*, user_roles(*)')
```

**Caso 3 — `DiscountManagementPanel.tsx:74` + `SellerDiscountLimitsPanel.tsx:29,39`:**
Fetch de `profiles` seguido de fetch de `seller_discount_limits` sem join.

---

### T42 — Missing Indexes 🔴

(Ver T03 — dados consolidados do `pg_stat_user_tables`)

**Colunas de alta cardinalidade sem índice:**
```
product_images.title_text     → n_distinct=4.296, sem índice
image_import_log.product_id   → n_distinct=2.339, sem índice
```

---

### T43 — Slow Queries ✅

`pg_stat_statements` ativo. Hit% de cache 99-100%. Nenhuma query de usuário final com `mean_exec_time > 100ms`.

**Query mais lenta:** `fn_run_schema_drift_check()` com média de **34.093ms** — mas é job de smoke test mensal (jobid 32), não query de usuário.

---

### T44 — pg_cron Jobs ✅

**27 jobs ativos, 0 falhas nas últimas 24h.**

**Alerta:** `process_spot_products` aparece com 2 jobids (`2` e `3`) com comando idêntico — **duplicata não intencional**.

```sql
-- Verificar e remover duplicata:
SELECT jobid, schedule, command FROM cron.job WHERE command LIKE '%process_spot_products%';
-- Remover o duplicado:
SELECT cron.unschedule(2);  -- ou 3, manter apenas um
```

---

### T45 — Logs de Erro Recentes (24h) ✅

**Edge Functions:** Sem erros 4xx/5xx. Funções mais ativas: `external-db-bridge` e `get-visitor-info` (chamadas a cada ~5s).
**Postgres:** Apenas 4 erros — todos gerados por queries desta auditoria.
**Auth:** Dominado por requests `/user` com status 200 de `promogifts.com.br`.

Sistema operacionalmente saudável nas últimas 24h.

---

### T46 — Circuit Breakers por Integração Externa ⚠️

| Integração | Função | Circuit Breaker |
|---|---|---|
| External DB | `external-db-bridge` | ✅ `getBreaker("external-db")` |
| CRM interno | `crm-db-bridge` | ✅ `getBreaker("crm-db")` |
| ElevenLabs TTS | `elevenlabs-tts` | ❌ |
| ElevenLabs STT | `elevenlabs-scribe-token` | ❌ |
| Bitrix24 | `bitrix-sync` | ❌ |
| CNPJA | `cnpj-lookup` | ❌ |
| HuggingFace | `ai-recommendations` | ❌ |
| AI (genérico) | `bi-copilot`, `expert-chat` | ❌ |

---

### T47 — External DB Bridge ✅

**SEC-01 (autenticação antes de RPC) corrigido:** auth obrigatória verificada em `dispatcher-auth.ts` para todas as operações.

**Allowlist:** 57 tabelas CRUD + 28 views readonly + 9 RPCs + 34 tabelas bloqueadas explicitamente.

**Tabelas na allowlist potencialmente não usadas:** `product_group_members`, `product_relationships`, `variant_supplier_sources`, `stock_snapshots` — não encontradas em chamadas diretas do frontend.

---

### T48 — Webhook Dispatcher ✅

**Retry logic robusta:**
- `max_attempts`: default=3, máximo=5
- `backoff_seconds`: configurável, default=[5, 30, 120]
- **Auto-disable:** após 5 falhas consecutivas, webhook é desabilitado automaticamente no DB
- HMAC signing em todos os payloads outbound
- Anti-replay via `webhook_request_nonces`

---

### T49 — AI Usage Tracking ⚠️

**Quotas configuradas:**
| Role | Limite mensal | Ilimitado |
|---|---|---|
| `dev` | — | ✅ TRUE |
| `admin` | — | ✅ TRUE |
| `supervisor` | 5.000 | false |
| `manager` | 5.000 | false |
| `agente` | 1.000 | false |

**Risco:** `dev` e `admin` são ilimitados — comprometimento de conta pode gerar custo irrestrito.

**`ai_usage_logs` com 0 registros** — rastreamento não acionado em produção ou tabela recém-criada.

**Sem limite de custo diário** — apenas limite mensal de chamadas.

---

### T50 — Cobertura de Testes ⚠️

| Métrica | Valor |
|---|---|
| Arquivos de produção em `/src` | **1.646** |
| Arquivos de teste totais | **620** |
| Testes em edge functions | **34** |
| Razão test:prod | **0,38 (38%)** |

**Cobertos adequadamente:** auth, webhooks, bridges (crm + external), AI usage, E2E Playwright (auth, catálogo, quotes, RBAC).

**Módulos críticos sem cobertura:**
- `elevenlabs-tts`, `elevenlabs-scribe-token`
- `bitrix-sync`, `cnpj-lookup`
- `ai-recommendations`, `analyze-logo-colors`
- `quote-sync`
- Pagamentos / orders (nenhum teste de integração encontrado)

---

## Roadmap de Correção

### Sprint 0 — Hotfixes (≤ 2 dias)

| ID | Ação | Esforço |
|---|---|---|
| T03 | `CREATE INDEX CONCURRENTLY` em `user_roles(user_id)`, `integration_credentials(name)`, `quotes(user_id, organization_id, status)` | 1h |
| T12 | `get-visitor-info`: adicionar `runBotProtection()` ou converter para `verify_jwt=true` | 2h |
| T10 | Adicionar `coordenador` ao union type `AppRole` em todos os arquivos TypeScript | 30min |
| T38 | Verificar e remover `SIMULATION_BYPASS_KEY` dos Supabase Secrets | 15min |
| T05 | Reabilitar `trg_log_price_change` ou documentar decisão com aprovação | 30min |
| T44 | Remover duplicata de `process_spot_products` no pg_cron | 5min |

### Sprint 1 — Segurança (1 semana)

| ID | Ação | Esforço |
|---|---|---|
| T32 | Adicionar `report-uri` ao CSP + plano de migração para nonces | 1 dia |
| T22 | Substituir `select('*')` por colunas explícitas nas 5 tabelas mais sensíveis | 1 dia |
| T19 | Criar kill switches para `crm-db-bridge` e `webhook-dispatcher` | 2h |
| T29 | Adicionar guard `import.meta.env.DEV` em `window.__personalizationSchemaStats` | 30min |
| T36 | Adicionar RLS à `_asia_api_staging` ou removê-la se obsoleta | 1h |

### Sprint 2 — Resiliência (2 semanas)

| ID | Ação | Esforço |
|---|---|---|
| T17 | Circuit breaker em `elevenlabs-tts`, `bitrix-sync`, `ai-recommendations`, `webhook-dispatcher` | 2 dias |
| T15 | Migrar 10 funções de maior volume para `createStructuredLogger` | 3 dias |
| T18 | Propagar `x-request-id` nas 10 funções de maior tráfego | 1 dia |
| T34 | Migrar `RESEND_API_KEY`, `ELEVENLABS_API_KEY`, `HUGGINGFACE_API_KEY` para `credentials.ts` | 1 dia |
| T41 | Corrigir N+1 em `RoleAuditLogPanel` e `useUserManagement` com joins embedded | 4h |

### Sprint 3 — Qualidade (1 mês)

| ID | Ação | Esforço |
|---|---|---|
| T19 | Kill switches para todas as 13 funções críticas restantes | 1 dia |
| T15 | Adoção total do structured logger (81 funções) | 1 semana |
| T18 | Propagação completa de `x-request-id` (68 funções) | 3 dias |
| T50 | Adicionar testes para `elevenlabs-tts`, `bitrix-sync`, `quote-sync`, pagamentos | 2 semanas |
| T08 | Processo de "local-first" para migrations — nunca aplicar sem arquivo local | 2h (processo) |
| T01 | Exportar migration `20260525193202` e comitar como arquivo local | 1h |
| T06 | Avaliar materializar `mv_product_cards`, `mv_product_intelligence` com `REFRESH CONCURRENTLY` | 2 dias |

---

## Apêndice: Evidências de Infra Coletadas

### pg_stat_user_tables (top seq_scan, dado real)
```
user_roles: seq_scan=101.866, idx_scan=4.351, pct_seq=96%
integration_credentials: seq_scan=101.042, idx_scan=41, pct_seq=100%
quotes: seq_scan=65.679, idx_scan=25, pct_seq=100%
quote_items: seq_scan=14.097, idx_scan=126, pct_seq=99%
```

### pg_cron (27 jobs ativos, 0 falhas/24h)
```
*/5 min: auto-block-offenders, process-marked/pending/spot-products
*/15 min: connections-auto-test, connections-health-check, purge-expired-security
Diário: cleanup-notifications, cleanup-novelties, schema-drift-check
```

### Edge Functions Deployadas (79 ativas)
```
Todas as 79 com status: ACTIVE
25 com verify_jwt=false (24 com proteção manual, 1 sem: get-visitor-info)
```

### Vault Secrets (3 registros, key_id=null)
```
CRON_SECRET, WEBHOOK_DISPATCHER_SECRET, CONNECTIONS_AUTO_TEST_SECRET
```

### Kill Switches (1 no DB)
```
edge_external_db_bridge → enabled: true
```

### AI Quotas
```
dev/admin: ilimitado | supervisor/manager: 5.000/mês | agente: 1.000/mês
ai_usage_logs: 0 registros (sistema não acionado em produção)
```

### Logs Recentes (24h)
```
Edge Functions: 0 erros | Auth: 0 erros | Postgres: 4 erros (gerados por esta auditoria)
```
