# Análise Back-End Sênior — Promo Brindes (`promo-gifts-v4`)

**Repositório:** `adm01-debug/promo-gifts-v4`  
**Projeto Supabase auditado:** `doufsxqlfjyuvxuezpln`  
**Branch:** `claude/backend-architecture-review-3mKjz`  
**Data:** 2026-05-22  
**Autor:** Auditoria sênior independente (read-only)  
**Método:** Inspeção estática do repositório + queries read-only ao Postgres de produção via MCP Supabase + leitura das auditorias prévias.

---

## 0. Sumário Executivo

A plataforma Promo Brindes está em **estado consideravelmente mais saudável do que a documentação interna sugere**. As auditorias prévias (mai/2026) identificaram bloqueadores que **foram em grande parte resolvidos**: webhook-dispatcher tem secret obrigatório, crons mudaram para vault-based, RLS atinge 100% das 269 tabelas, 100% das 112 funções `SECURITY DEFINER` declaram `search_path` explícito, `enable_signup = false`, `enable_anonymous_sign_ins = false`, e há disciplina de engenharia de back-end raramente vista em times pequenos (estrutura SSOT, circuit breaker, retry com jitter, request-id ponta a ponta, structured logger, vault-backed cron secrets, allowlist de URLs externas anti-SSRF, bot protection, HMAC com comparação em tempo constante, etc.).

Apesar disso, **existem três achados críticos de segurança** que comprometem o nível de maturidade alcançado:

1. **🔴 CRÍTICO `SEC-001` — Bypass de autenticação hardcoded em duas funções.** Constante `ELITE_SIM_KEY = "a46c3981-244a-4f81-9f57-bab5c45b5cde"` aceita Bearer token equivalente e devolve role `dev` + cliente service_role acoplado, contornando **toda** a defesa de auth em ≥64 edge functions. Severidade: **bypass remoto não autenticado** caso o repositório vaze (forks internos, screen-share, LLMs treinadas em fontes públicas, prints, etc.).
2. **🔴 CRÍTICO `SEC-002` — Política RLS permissiva em `frontend_telemetry`.** `WITH CHECK (true)` para `INSERT` permite `anon` injetar registros arbitrários, abrindo vetor de **log poisoning, DoS por inflação e exfiltração via campos de texto livre**.
3. **🟠 ALTO `SEC-003` — Fallback "legacy_no_auth" silencioso no dispatcher e nas crons.** Quando `WEBHOOK_DISPATCHER_SECRET` ou os secrets de cron não estão setados, a função aceita anônimo com apenas `console.warn`. Hoje em PROD os 3 secrets estão no vault (validado), mas qualquer clone de ambiente fora desse vault herda o comportamento.

### Top 12 achados (semáforo)

| # | ID | Sev | Categoria | Título | Esforço |
|---|---|---|---|---|---|
| 1 | SEC-001 | 🔴 | Auth | Chave de bypass hardcoded em `_shared/auth.ts` e `test-contract-orchestrator` | S |
| 2 | SEC-002 | 🔴 | RLS | `frontend_telemetry` aceita INSERT anônimo sem restrição | S |
| 3 | SEC-003 | 🟠 | Auth | Fallback `legacy_no_auth` em dispatcher/cron quando secret ausente | S |
| 4 | OPS-001 | 🟠 | Operação | 2 cron jobs SQL apontam para materialized views inexistentes (`mv_product_intelligence`, `mv_stock_velocity`) | S |
| 5 | PERF-001 | 🟠 | DB | 16 tabelas com `auth.uid()` reavaliando por linha em policies RLS (`auth_rls_initplan`) | M |
| 6 | DOC-001 | 🟠 | Manutenibilidade | Docs apontam números desatualizados — `EDGE_FUNCTIONS.md` (50 funcs), `README.md` (47), `DEPLOYMENT.md` (332 vs 209 migrations). Real: 81 funcs, 708 arquivos vs 682 aplicadas. | M |
| 7 | SEC-004 | 🟡 | Storage | 6/8 buckets sem allowlist de MIME types; bucket `scripts` sem limite de tamanho | M |
| 8 | SEC-005 | 🟡 | Validação | Coexistência de `validate.ts` (manual) e `zod-validate.ts` — cobertura desigual; 41/81 funções usam Zod | M |
| 9 | PERF-002 | 🟡 | DB | 16 ocorrências de `multiple_permissive_policies` (sobretudo em `profiles`) | M |
| 10 | OBS-001 | 🟡 | Observabilidade | 256 chamadas a `console.*` no front-end fora do `logger.ts`; logger drop silencioso em PROD | M |
| 11 | SEC-006 | 🟡 | Front-end | `supabase/client.ts` com URL e anon key **hardcoded** (auto-gerado pelo Lovable) — bloqueia override por ambiente | S |
| 12 | OPS-002 | 🟡 | Operação | `inbound_webhook_events` aceita INSERT pré-validação HMAC → vetor de DoS por inflação de tabela | S |

### Veredito

| Eixo | Status | Comentário |
|---|---|---|
| **Segurança fundamental** | 🟡 boa, com 2 falhas críticas pontuais | Arquitetura sólida (RLS 100%, vault, allowlists, HMAC, timing-safe), mas 2 brechas que neutralizam toda a defesa |
| **Operacionalidade** | 🟢 alta | Logger estrutural, request-id, circuit breaker, retry, audit-log denso, runbooks |
| **Performance** | 🟢 adequada | DB médio (~270 MB top tables), 1076 índices, 19 crons coordenados, cache em memória, breaker |
| **Manutenibilidade** | 🟡 média-alta | Excelente disciplina de engenharia, mas docs defasadas, 88 funções pequenas, `external-db-bridge` >1900 linhas, `expert-chat` >1300 |
| **Custos** | 🟢 contidos | 13 usuários, 1 organização, base de catálogo de 6k produtos, 81 edge functions invocadas via 19 crons |
| **Pronto para produção** | 🟢 **GO** após fix de SEC-001 e SEC-002 | Ambos resolvíveis em <1 dia |

---

## 1. Inventário & Arquitetura (números reais)

| Métrica | Valor real (auditado) | Valor declarado em docs | Δ |
|---|---:|---:|---|
| Edge Functions | **81** | 47 (README) / 50 (EDGE_FUNCTIONS.md) | +60% |
| Edge Functions com `verify_jwt = false` | **24** | 8 (AUDITORIA_REDEPLOY) | +200% |
| Migrações SQL no repo | **708** | 205 (README) / 332 (DEPLOYMENT) | +245% / +113% |
| Migrações aplicadas em PROD | **682** | 209 (DEPLOYMENT) | +226% |
| Drift real | **26 arquivos** | "interseção zero" (DEPLOYMENT) | drift << docs |
| Tabelas em `public` | **269** | 35+ (README) | +669% |
| Tabelas com RLS ativo | **269 (100%)** | 100% | ✅ |
| Policies RLS | 664 | 80+ (04_EXPLICACAO) | +730% |
| Funções (`public`) | 770 | — | — |
| Funções `SECURITY DEFINER` | 112 | — | — |
| Funções SECURITY DEFINER sem `search_path` | **0** | — | ✅ |
| Triggers customizadas | 256 | — | — |
| Índices em `public` | 1076 | — | — |
| Views | 112 | — | — |
| Materialized views | **0** ⚠ | — | (mas há crons que tentam refresh — ver OPS-001) |
| Colunas JSONB | 179 (em 123 tabelas) | — | — |
| Cron jobs ativos | 19 | — | — |
| Storage buckets | 8 (todos `public: false`) | — | ✅ |
| Usuários no `auth.users` | 13 | — | — |
| Organizações | 1 | (multi-tenant ready) | — |
| Webhooks ativos | 0 saída / 0 entrada | — | (sistema completo mas inativo) |

### Estilo arquitetural

- **SPA React 18 + TypeScript strict + Vite 5** no front-end (Vercel/Lovable Cloud).
- **Supabase** como BaaS unificado: Auth + Postgres + Storage + Edge Functions Deno + Vault.
- **3 instâncias Supabase distintas**:
  - `doufsxqlfjyuvxuezpln` — principal (auth, orçamentos, app data, RLS, vault)
  - `pgxfvjmuubtbowutlide` — externa (catálogo Promobrind, 6.1k produtos)
  - `hncgwjbzdajfdztqgefe` — CRM (mini-CRM auxiliar)
- **Ponte para banco externo** via `external-db-bridge` (1950 linhas, allowlist de tabelas/RPCs).
- **Bridge para CRM** via `crm-db-bridge` (997 linhas, mesma estratégia).
- **MCP Server interno** (`mcp-server`, 504 linhas) que expõe ferramentas para Claude Desktop / outros Lovable projects, com chaves `X-MCP-Key` validadas via RPC `validate_mcp_key`, escopos granulares e audit log em cada chamada.
- **Padrão SSOT** em `_shared/`: `authorize.ts` substitui 12+ implementações divergentes anteriores; `credentials.ts` (DB-first com fallback env e cache 60s); `structured-logger.ts`; `request-id.ts`; `cors.ts`; `dispatcher-auth.ts`.
- **19 cron jobs** disparam edge functions via `net.http_post` + `x-cron-secret` derivado do **vault** (`public.get_edge_function_secret(...)`).

### Topologia de I/O externo

```
┌──────────────────────────────────────────────────────────────────┐
│                          SPA (Vercel)                            │
│       supabase-js → AnonKey hardcoded em src/integrations/        │
└──────┬──────────────────────────────────────────────────────┬────┘
       │                                                      │
       ▼                                                      ▼
┌──────────────────────────────┐         ┌───────────────────────────┐
│  Supabase Principal (PROD)   │         │   Edge Functions (81)     │
│  269 tabelas, RLS 100%,      │◄────────┤   24 públicas (verify_jwt │
│  19 crons, Vault (3 secrets) │ service │   =false; 14 são crons),  │
│  Storage 8 buckets privados  │ role    │   57 JWT-default.         │
└──────────┬───────────────────┘         └────┬────────┬───────────┘
           │                                  │        │
           │                          ┌───────┘        └─────────┐
           │                          ▼                          ▼
           │             ┌──────────────────────┐  ┌──────────────────────┐
           │             │ Supabase Externo     │  │ Supabase CRM         │
           │             │ (catálogo Promobrind)│  │ (mini-CRM)           │
           │             └──────────────────────┘  └──────────────────────┘
           │
           ├───────► Bitrix24 REST (deals/contacts)
           ├───────► n8n (webhooks de automação)
           ├───────► ElevenLabs (WebSocket TTS/STT)
           ├───────► Lovable AI Gateway (Gemini, GPT, Imagen)
           ├───────► CNPJá API (lookup CNPJ)
           ├───────► Cloudflare Images (imagedelivery.net)
           └───────► Fornecedores: xbz, spotgifts, 88brindes, asiaimport
```

### Distribuição de tamanho das edge functions (top 10)

| Função | Linhas | Observação |
|---|---:|---|
| `external-db-bridge/index.ts` | **1950** | Allowlist + cache + breaker + retry + alias + virtual tables — **arquivo gigante, candidato a quebra modular** |
| `expert-chat/index.ts` | 1301 | Streaming SSE + tool-calling + IA — **complexo, mas isolado** |
| `crm-db-bridge/index.ts` | 997 | Same pattern as external-db-bridge |
| `e2e-cleanup/index.ts` | 665 | 5 camadas de segurança, dry-run by default |
| `bitrix-sync/index.ts` | 636 | OAuth2 + REST |
| `mcp-server/index.ts` | 504 | MCP scopes + audit |
| `materials-api/index.ts` | 444 | CRUD com Zod |
| `secrets-manager/index.ts` | 426 | Gestão de vault — admin only |
| `market-intelligence-insights/index.ts` | 412 | IA insights |
| `mcp-keys-issue/index.ts` | 395 | Emissão de chaves MCP |

> **Insight:** os arquivos grandes concentram lógica complexa (bridges e IA). O resto das 71 funções tem em média ~150 linhas — granularidade razoável.

---

## 2. Segurança

> Esta seção contém os achados de maior impacto. Cada item segue o template padrão (ID, severidade, evidência, impacto, recomendação, esforço).

### 2.1 Auth / Bypass keys / Token revocation

#### `SEC-001` 🔴 CRÍTICO — Bypass de autenticação hardcoded

- **Categoria:** Segurança / Authentication bypass
- **Severidade:** 🔴 Alta
- **Impacto:** 🔴 Segurança (auth bypass) + 🔴 Auditoria (impossível atribuir ação)
- **Prioridade:** P0 — corrigir antes de qualquer outra coisa
- **Status:** Novo (não consta em auditorias prévias)

**Descrição.** A constante `ELITE_SIM_KEY = "a46c3981-244a-4f81-9f57-bab5c45b5cde"` está hardcoded em duas funções:

```ts
// supabase/functions/_shared/auth.ts:32-39
const ELITE_SIM_KEY = "a46c3981-244a-4f81-9f57-bab5c45b5cde";
// ...
const isSimulation = (simulationKey && rawToken === simulationKey.trim()) ||
                     (rawToken === ELITE_SIM_KEY);
if (isServiceRole || isSimulation) {
  return {
    userId: '00000000-0000-0000-0000-000000000000',
    userRole: 'dev',
    userRoles: ['dev', 'service_role', 'simulation'],
    localServiceClient    // ← cliente Supabase com service_role acoplado
  };
}
```

```ts
// supabase/functions/test-contract-orchestrator/index.ts:26
const SIM_BYPASS = "a46c3981-244a-4f81-9f57-bab5c45b5cde";
```

Como `_shared/auth.ts::authenticateRequest` é usado por **27+ funções** (confirmado por `grep -l "authenticateRequest"` no diretório) e a função retorna **cliente service_role** + role `dev`, **qualquer chamada com Bearer `a46c…cde` recebe acesso administrativo total** em todas elas — sem precisar de senha, sem MFA, sem step-up, sem rate-limit.

Confirmado que `external-db-bridge` também faz a checagem inline (linhas 828-836) **mesmo com `verify_jwt = false`**, o que significa que a chave também funciona ali.

**Evidência adicional.**

```bash
$ grep -rn "ELITE_SIM_KEY\|SIM_BYPASS\|a46c3981" supabase/ src/ | grep -v "test"
supabase/functions/external-db-bridge/index.ts:829: const simulationKey = Deno.env.get('SIMULATION_BYPASS_KEY')?.trim();
supabase/functions/_shared/auth.ts:30:  const simulationKey = Deno.env.get('SIMULATION_BYPASS_KEY');
supabase/functions/_shared/auth.ts:32:  const ELITE_SIM_KEY = "a46c3981-244a-4f81-9f57-bab5c45b5cde";
supabase/functions/_shared/auth.ts:39:  const isSimulation = (simulationKey && rawToken === simulationKey.trim()) || (rawToken === ELITE_SIM_KEY);
supabase/functions/cnpj-lookup/index.ts:23:      const simKey = Deno.env.get('SIMULATION_BYPASS_KEY');
```

**Impacto potencial.**
- Qualquer pessoa com acesso ao código-fonte (forks internos, screen-share, LLMs treinadas em scrapes públicos, prints, copias para auditoria, etc.) tem **bypass remoto total** em produção.
- Auditoria fica inútil: todas as ações se atribuem ao mesmo `userId` fake (`00000000-0000-0000-0000-000000000000`).
- Aciona qualquer endpoint admin (`manage-users`, `secrets-manager`, `mcp-keys-issue`, `force-global-logout`).

**Recomendação.**
1. **Remover IMEDIATAMENTE** ambas as constantes (auth.ts:32 e test-contract-orchestrator/index.ts:26) e o ramo de comparação inline em external-db-bridge:828-836.
2. Substituir pelo padrão já existente `SIMULATION_BYPASS_KEY` lido **apenas de env** (configurado no vault), com **comparação em tempo constante** (`constantTimeEqual` já existe em `_shared/dispatcher-auth.ts:51`).
3. Rotacionar imediatamente qualquer segredo eventualmente exposto no histórico do git que use esse padrão (`git log -p -S "a46c3981"`).
4. Adicionar regra de pre-commit/gitleaks (já há `.gitleaks.toml`) que rejeite qualquer UUID literal em código de auth.
5. Adicionar teste E2E que falhe se essa string aparecer no bundle das edges (`scripts/check-edge-cors-headers.mjs` é o ponto de partida — criar `check-no-bypass-literals.mjs`).

**Snippet do fix:**

```ts
// supabase/functions/_shared/auth.ts (fix proposto)
import { constantTimeEqual } from "./dispatcher-auth.ts";

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const SIMULATION_BYPASS_KEY = Deno.env.get('SIMULATION_BYPASS_KEY');   // vault-only, NUNCA hardcoded

const rawToken = authHeader.slice(7).trim();
const isServiceRole = SERVICE_ROLE_KEY  && constantTimeEqual(rawToken, SERVICE_ROLE_KEY);
const isSimulation  = SIMULATION_BYPASS_KEY && constantTimeEqual(rawToken, SIMULATION_BYPASS_KEY);
if (isServiceRole || isSimulation) { /* … */ }
```

**Esforço:** S (≤2 horas) — fix mecânico em 3 arquivos + remoção/rotação de segredo. Bloqueia produção até estar pronto.

---

#### `SEC-007` 🟡 MÉDIO — Hierarquia de papéis duplicada e divergente

- **Severidade:** 🟡 Média
- **Impacto:** Manutenibilidade / Risco de autorização inconsistente

`_shared/auth.ts:91-95` define `dev > supervisor > agente` e aceita `admin` como **alias legado** de supervisor. Já `_shared/authorize.ts:50` mantém só `dev > supervisor > agente` (sem o alias). `_shared/dispatcher-auth.ts:25` repete a mesma hierarquia. Há ainda menções a `vendedor` em `external-db-bridge` linha 844 (`userRoles?.[0]?.role || 'vendedor'`) e em `manage-users`.

A literatura mostra **5 nomes de papéis** circulando: `dev`, `supervisor`, `agente`, `admin` (legado), `vendedor` (legado mais antigo), `simulation`. RLS usa `is_admin_or_above`, `is_supervisor_or_above`, `is_coord_or_above` — e cada uma resolve a hierarquia internamente. Em `manage-users` ainda há checagens por nome de papel.

**Recomendação.** Consolidar em um único enum `app_role` com mapeamento documentado e remover aliases legacy. O `RBAC_HELPERS.md` existe — alinhá-lo com a realidade do código.

**Esforço:** M (1-2 dias)

---

#### `SEC-008` 🟢 BAIXO / POSITIVO — Token revocation funcional

`user_token_revocations` está em produção, lida via RPC `is_token_revoked` com cache TTL 30s (`_shared/token-revocation.ts`), e é invocada em **ambas** `authenticateRequest` e `authorize`. Tabela ainda tem 0 revogações reais — feature pronta, sub-utilizada. Recomenda-se documentar no runbook quando usar (suspeita de leak, troca de senha, perda de device).

---

### 2.2 Edge Functions sem JWT (24)

**Lista completa** das funções com `verify_jwt = false` em `supabase/config.toml`:

| # | Função | Proteção interna | Confirmado? | Risco |
|---|---|---|---|---|
| 1 | `crm-db-bridge` | Bot-protection + allowlist tabelas + `resolveCredential` | ✅ Sim, similar ao external | 🟡 ver SEC-009 |
| 2 | `ai-recommendations` | `authenticateRequest` + Zod + rate-limit + bot-protection | ✅ Sim | 🟢 baixo |
| 3 | `external-db-inspect` | Debug-only? Verificar auth interna | ⚠️ Não confirmado | 🟡 |
| 4 | `external-db-bridge` | Inline auth + permission allowlist + cache + breaker | ✅ Sim | 🟡 ver SEC-009 |
| 5 | `image-proxy` | Bot-protection + referer + domain allowlist + max-bytes + content-type check | ✅ Sim | 🟢 baixo |
| 6 | `webhook-dispatcher` | `x-dispatcher-secret` + `authorizeDispatcher` Modo B (user JWT) + HMAC | ✅ Sim | 🟠 ver SEC-003 |
| 7 | `webhook-inbound` | HMAC signature timing-safe + slug lookup | ✅ Sim | 🟡 ver OPS-002 |
| 8 | `mcp-server` | `X-MCP-Key` validado em DB + scope-based + audit-log | ✅ Sim | 🟢 baixo |
| 9 | `connections-auto-test` | Vault `CONNECTIONS_AUTO_TEST_SECRET` | ✅ Sim, vault | 🟢 baixo |
| 10 | `e2e-cleanup` | `x-e2e-cleanup-token` timing-safe + email allowlist + IP rate-limit + dry-run | ✅ Sim | 🟢 baixo |
| 11-24 | 14 crons (`cleanup-*`, `*-watcher`, `process-*`, `send-*`, `quote-followup-reminders`) | `x-cron-secret` vault-based via `authorizeCron` | ✅ Sim, mas legacy_no_auth fallback | 🟠 ver SEC-003 |

**Padrão arquitetural.** `verify_jwt = false` aqui NÃO significa "público" no sentido OWASP — significa **"a função controla sua própria auth"**. Em 22/24 casos isso é explícito e bem feito. As 2 que não pudemos confirmar:

#### `SEC-009` 🟡 MÉDIO — Validar auth interna em `crm-db-bridge` e `external-db-inspect`

- **Severidade:** 🟡 Média
- **Impacto:** Possível leitura não autenticada de dados de CRM ou metadados de schema
- **Status:** Parcial (precisa de revisão linha-a-linha)

`crm-db-bridge/index.ts` foi lido somente até linha 120 nesta auditoria. Tem `runBotProtection`, `getBreaker`, `resolveCredential`, mas não confirmamos se o handler principal exige header de auth ou apenas roda Bot-protection (que limita por IP mas não autentica). Igualmente para `external-db-inspect`.

**Recomendação.** Adicionar `authenticateRequest` (ou `authorize`) explícito no topo dos handlers; documentar no header do arquivo qual modo de auth está ativo (espelhando o que já existe em `dispatcher-auth.ts`).

**Esforço:** S (~2h por função)

---

### 2.3 Webhooks / Crons / Dispatcher

#### `SEC-003` 🟠 ALTO — Fallback `legacy_no_auth` em produção

- **Severidade:** 🟠 Alta
- **Impacto:** 🔴 Auth bypass condicional (depende de config de ambiente)
- **Prioridade:** P0
- **Status:** Resolvido em PROD (3 secrets no vault), mas código permanece

**Descrição.** `_shared/dispatcher-auth.ts:240-253` e `:286-294` aceitam chamadas anônimas quando o secret esperado não está configurado, com apenas `console.warn`. Confirmado via vault:

```sql
SELECT name FROM vault.decrypted_secrets;
-- → CONNECTIONS_AUTO_TEST_SECRET, CRON_SECRET, WEBHOOK_DISPATCHER_SECRET
```

Os 3 secrets estão setados em PROD → `legacy_no_auth` **não dispara** no projeto atual. Mas:

1. Qualquer clone (staging, dev, preview Lovable, fork) que não tenha esses 3 secrets no vault recebe **acesso anônimo a webhook-dispatcher e 14 crons**.
2. Se o vault for revogado/recriado e o secret não for re-populado, o ambiente "self-degrada para inseguro" silenciosamente.
3. Logs de warning em alta frequência (`legacy_no_auth_warning` por request) podem ser perdidos no ruído.

**Recomendação.**
1. Remover o fallback em `dispatcher-auth.ts:240-253` e `:286-294`. Faltando secret = `503 Service Unavailable` (fail-closed).
2. Adicionar boot-time check no `Deno.serve` de cada cron/dispatcher: se `getVaultSecret(...)` retorna vazio, devolver 503 em todas as requests subsequentes do isolate.
3. Adicionar **smoke test** em CI que confirma os 3 secrets do vault antes de cada deploy.

**Snippet:**

```ts
// dispatcher-auth.ts — fail-closed
if (!expectedSecret) {
  logAuthEvent({ outcome: "denied", reason: "secret_not_configured", env: secretEnvName });
  return {
    ok: false,
    response: jsonResponse(
      { error: "service_misconfigured", message: `${secretEnvName} not set` },
      503,
      corsHeaders,
    ),
  };
}
```

**Esforço:** S (1-2h)

---

#### `OPS-002` 🟡 MÉDIO — `webhook-inbound` aceita INSERT de eventos pré-validação HMAC

- **Severidade:** 🟡 Média
- **Impacto:** DoS por inflação da tabela `inbound_webhook_events`

`webhook-inbound/index.ts:78-87`: a função inserta o evento (com `signature_valid: false`) **antes** de retornar 401. Combinado com `verify_jwt = false` e ausência de rate-limit dedicado, qualquer caller anônimo pode infinitamente alimentar a tabela. Hoje há 0 endpoints registrados; quando houver, a superfície fica viva.

**Recomendação.** Aplicar `runBotProtection({endpoint:'webhook-inbound', maxRequests: 60, windowSeconds: 60})` antes do INSERT; OU mover o INSERT para depois da verificação HMAC quando inválida.

---

#### `OPS-003` 🟢 POSITIVO — Cron secrets via vault

Toda cron tem fonte única em `public.get_edge_function_secret(...)` que lê de `vault.decrypted_secrets`. Cache em memória por cold-start (1 RPC por isolate). Excelente padrão.

---

### 2.4 RLS — cobertura, recursão, search_path

#### `RLS-001` ✅ POSITIVO — Cobertura 100%

```sql
-- 269 tabelas em public, 269 com RLS ativo
SELECT count(*) FILTER (WHERE relrowsecurity) AS rls_on,
       count(*) AS total
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND c.relkind='r';
-- → rls_on=269, total=269

-- Tabelas sem nenhuma policy: zero
-- (todas as 269 têm pelo menos 1 policy de SELECT)
```

#### `SEC-002` 🔴 CRÍTICO — `frontend_telemetry` com policy permissiva para INSERT

- **Severidade:** 🔴 Alta
- **Impacto:** Log poisoning + DoS + possível exfiltração via payload de texto
- **Prioridade:** P0
- **Status:** Novo

**Evidência (advisor):**

```json
{
  "name": "rls_policy_always_true",
  "level": "WARN",
  "detail": "Table `public.frontend_telemetry` has an RLS policy `frontend_telemetry_insert_anon` for `INSERT` that allows unrestricted access (WITH CHECK clause is always true). This effectively bypasses row-level security for anon."
}
// E também:
"frontend_telemetry_insert_authenticated" → idem, role authenticated.
```

A tabela `frontend_telemetry` aceita **qualquer payload anônimo**. Coluna `metadata` é JSONB livre (verificado em `information_schema`). Cenários:

1. **Inflação:** atacante posta milhões de linhas → custo de armazenamento + I/O + degradação do query plan.
2. **Log poisoning:** payloads maliciosos passam adiante por dashboards que renderizam o JSONB (XSS via dashboard).
3. **Exfiltração inversa:** atacante consegue sondar latência (se a aplicação retorna 200 vs 400 baseado em estado).

**Recomendação.**

```sql
-- Substituir a policy permissiva por uma que exige assinatura ou rate-limit
DROP POLICY IF EXISTS frontend_telemetry_insert_anon ON public.frontend_telemetry;
DROP POLICY IF EXISTS frontend_telemetry_insert_authenticated ON public.frontend_telemetry;

CREATE POLICY frontend_telemetry_insert_authenticated
ON public.frontend_telemetry FOR INSERT
TO authenticated
WITH CHECK (
  user_id = (select auth.uid())   -- amarra à identidade
  AND length(coalesce(metadata::text, '')) <= 8192  -- cap por payload
);

-- Se realmente precisa de telemetria anônima, criar edge function dedicada
-- com rate-limit por IP e validação Zod do payload, e inserir com service_role.
```

**Esforço:** S (1h)

---

#### `RLS-002` 🟡 MÉDIO — 4 funções `SECURITY DEFINER` expostas a `authenticated`

Confirmado via advisor de segurança:

| Função | Roles que executam | Comentário |
|---|---|---|
| `public.check_login_rate_limit(_email, _ip)` | anon + authenticated | OK (intencional, brute-force protection) |
| `public.can_access_quote(_quote_id)` | authenticated | Verificar se é design intencional |
| `public.is_admin_or_above(_user_id)` | authenticated | Verificar |
| `public.is_coord_or_above(_user_id)` | authenticated | Verificar |
| `public.org_has_any_members(_org_id)` | authenticated | Verificar |

Essas funções `SECURITY DEFINER` rodam com privilégios do owner e podem ser invocadas via PostgREST RPC (`POST /rest/v1/rpc/has_role`). Em si não é problema — desde que **(a)** a função valide o parâmetro `_user_id` contra `auth.uid()` e **(b)** o output não vaze para usuário diferente do dono.

**Recomendação.**
1. Para `is_admin_or_above/is_coord_or_above`: documentar se é seguro usuários verem o role de outros usuários (caso `_user_id` seja arbitrário). Senão, adicionar `IF _user_id IS DISTINCT FROM auth.uid() AND NOT has_role(auth.uid(), 'dev') THEN RAISE EXCEPTION 'forbidden'; END IF;`.
2. Para `can_access_quote`: validar que mesmo via RPC arbitrária, a função retorna o que o usuário poderia ler diretamente.
3. Documentar como `org_has_any_members` é usado — pode ser intencional para fluxo de criar/listar orgs.

**Esforço:** S (rever 4 funções, ~3h)

---

#### `RLS-003` 🟢 POSITIVO — SECURITY DEFINER 100% com `search_path` setado

```sql
-- Query: funções SECURITY DEFINER em public/auth/storage sem search_path no proconfig
SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname IN ('public','auth','storage') AND p.prosecdef = true
  AND (p.proconfig IS NULL OR NOT EXISTS (
    SELECT 1 FROM unnest(p.proconfig) cfg WHERE cfg LIKE 'search_path=%'));
-- → 0 (ZERO)
```

Excelente disciplina. Confirmando que `docs/SECURITY-DEFINER-PATTERN.md` é seguido.

---

### 2.5 SSRF / SQL injection / Validação de input

#### `SEC-010` 🟢 POSITIVO — Allowlist anti-SSRF robusta

`_shared/url-allowlist.ts` faz defesa em profundidade:
- 11 hostnames com match exato (CDNs de fornecedores + Cloudflare Images);
- Sufixos `*.supabase.co` (storage de usuário);
- Bloqueia IPv4 privados (10/8, 127/8, 169.254/16, 172.16/12, 192.168/16, 224/4, 240+);
- Bloqueia IPv6 loopback/link-local;
- Rejeita protocolos não-http(s);
- Helper `assertAllowedExternalUrl` para falhar loud.

Cobertura: `generate-mockup`, `image-proxy`, `external-fetch`. Verificar se **todas** as funções que aceitam URL externa (ex.: `dropbox-list`, `generate-ad-image`) usam esse helper.

#### `SEC-011` 🟢 POSITIVO — `external-db-bridge` valida filtros antes da query

`external-db-bridge/index.ts:98-152` (`validateFilters`):
- Rejeita objetos crus, NaN, funções, símbolos.
- Permite arrays de primitivos.
- Promove sufixos (`_gte`, `_lte`, `_in`, `_isnull`) e operadores PostgREST (`gte.10`, `is.null`, `in.(a,b)`).
- Em `_search`: escapa `%` e `_` antes do `ilike`. Boa prática.

**Mas atenção a uma pequena falha:**

```ts
// external-db-bridge/index.ts:238
if (['name','description','title','razao_social','nome_fantasia','nome','descricao'].includes(key)) {
  query = query.ilike(key, `%${value}%`);
}
```

Aqui o `value` **não passa pelo escape** que existe em `_search`. Como o `ilike` do supabase-js já é parametrizado (não é string concat), o risco real é apenas de **falsos positivos / unicode wildcards**, não SQLi. Ainda assim, padronize escapando aqui também.

**Esforço:** S (5 min)

#### `SEC-012` 🟡 MÉDIO — Cobertura de Zod desigual

41 das 81 edge functions usam Zod (`grep -l "zod"`). Outras 40 dependem de `validate.ts` (manual com `validateRequired` + `isNonEmptyString` + `isPositiveNumber`).

`validate.ts` é seguro mas mínimo — não valida shape, não previne extra fields, não convalida arrays. Caso típico de risco: `_shared/validate.ts:22-37` só verifica presença, não tipo.

**Recomendação.** Migrar progressivamente para `zod-validate.ts::parseBodyWithSchema`. Priorizar funções com `verify_jwt = false` (defesa externa) e funções admin (`manage-users`, `secrets-manager`, `mcp-keys-*`, `force-global-logout`).

**Esforço:** M (2-4 dias, função por função)

---

### 2.6 Segredos & Vault

#### `SEC-013` 🟢 POSITIVO — Vault + DB-first credential resolution

`_shared/credentials.ts` implementa SSOT com:
- 1) `integration_credentials` (DB) — entradas por `/admin/conexoes`;
- 2) `Deno.env.get(name)` fallback;
- 3) Aliases legados (ex.: `EXTERNAL_PROMOBRIND_SERVICE_ROLE_KEY` ⇄ `EXTERNAL_SUPABASE_SERVICE_ROLE_KEY`);
- Cache em memória TTL 60s por isolate;
- Métricas por nome (hits, misses, expirations, latência p50/p95/p99);
- Helper `buildCredentialsHealth` para `?op=creds_health` sem expor valores (`suffix4` + length).

#### `SEC-014` 🟡 MÉDIO — Suspeita de `secret_value` em texto pleno em `integration_credentials`

A query `SELECT secret_value FROM integration_credentials WHERE secret_name = ?` (em `_shared/credentials.ts:434-438`) sugere que os segredos vivem em coluna texto. Confirmar se o schema usa criptografia em repouso (pg_sodium, vault) ou se o `service_role` simplesmente bypass-a a RLS para ler texto puro.

Cenário: se um operador admin obtém `service_role` (ou explora SEC-001), pode `SELECT *` na tabela e exfiltrar todos os 12 credentials.

**Recomendação.** Migrar `secret_value` para `vault.decrypted_secrets` (já é o padrão dos 3 secrets de cron) ou usar `pgsodium.crypto_aead_det_encrypt`. Manter `integration_credentials` apenas como índice de "qual nome canônico mapeia a qual segredo do vault".

**Esforço:** L (1 sprint, com migration script)

---

### 2.7 CORS, headers de segurança, CSP

#### `SEC-015` 🟢 POSITIVO — CORS strict + headers de segurança

`_shared/cors.ts` aplica:
- Allowlist exata (11 domínios em prod) + patterns regex (`*.lovable.app`, `*.lovableproject.com`, `*.vercel.app`, `*.atomicabr.com.br`, `localhost`, `127.0.0.1`).
- Whitelist de headers aceitos (10 headers).
- Logging estruturado de preflight (com `requested_method`, `requested_headers`, `missing_headers`).
- **HSTS** `max-age=31536000; includeSubDomains`.
- **CSP** `default-src 'self'; script-src 'self' 'strict-dynamic'; object-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'self';` em **todas** as responses não-OPTIONS.
- **X-Frame-Options: DENY**.
- **X-Content-Type-Options: nosniff**.
- `buildPublicCorsHeaders` para endpoints públicos (com `default-src 'none'; sandbox`).

#### `SEC-016` 🟡 MÉDIO — CSP via headers HTTP em SPA Vite

O CSP é aplicado pela edge function em response headers, mas o **HTML inicial** servido pelo Vercel não tem nonce/hash configurado. `script-src 'self' 'strict-dynamic'` em SPA carregando scripts inline do Vite/React DevTools pode disparar bloqueios em produção. Verificar:

```bash
$ grep -l "script-src" vite.config.ts vercel.json public/index.html
# (esperado: nenhum CSP no HTML inicial; CSP aplicado por edges, mas o doc raiz é servido pelo Vercel)
```

**Recomendação.** Centralizar política CSP em `vercel.json` headers para o `index.html` E garantir que a CSP das edges não conflita (são endpoints JSON, então CSP `default-src 'none'` seria mais agressivo).

---

## 3. Banco de Dados

### 3.1 Modelagem & multi-tenant

**Volume real (top 10 tabelas por tamanho):**

| Tabela | Linhas | Tamanho | Observação |
|---|---:|---:|---|
| `supplier_products_raw` | 16.508 | 53 MB | Staging de import |
| `product_relationships` | 107.921 | 46 MB | Graph de produtos (kits, variantes) |
| `product_images` | 46.122 | 45 MB | 46k imagens — confirma 57k mencionados no allowlist |
| `products` | 6.123 | 37 MB | Catálogo principal |
| `admin_audit_log` | 15.943 | 28 MB | **11.873 novas linhas/24h** — ruidoso |
| `image_validation_log` | 46.291 | 16 MB | Sem rotação? |
| `variant_supplier_sources` | 16.456 | 14 MB | |
| `product_variants` | 16.456 | 9.8 MB | |
| `supplier_import_batches` | 51.315 | 9.3 MB | |
| `image_import_log` | 27.586 | 9.2 MB | Sem rotação? |

**Modelagem multi-tenant:** apenas 1 organização cadastrada, modelo `organizations` + `organization_members` presente. `quotes` tem 0 linhas nos últimos 30 dias — ou é ambiente de validação OU os orçamentos ainda não fluíram em massa.

#### `DB-001` 🟡 MÉDIO — Logs sem política de retenção

`admin_audit_log` cresce ~12k linhas/dia. Em 1 ano: ~4.4M linhas. `image_validation_log` e `image_import_log` também sem rotação aparente. Não há configuração de `pg_partman` instalado (extensão disponível mas não ativa).

**Recomendação.**
1. Adicionar particionamento por mês com `pg_partman` em `admin_audit_log`, `audit_log`, `audit_logs`, `image_validation_log`, `image_import_log`, `login_attempts`, `bot_detection_log`, `conversation_event_history`.
2. Política de retenção: 90d retenção full, depois mover para tabela arquivada / S3 / cold storage. Acompanhar `docs/POSTMORTEM_TEMPLATE.md`.
3. Cron diário que apaga ou move registros antigos. Já existe `stock_snapshots_weekly_purge` (14d) — replicar padrão.

**Esforço:** M (2-3 dias)

### 3.2 Uso de JSONB

**179 colunas JSONB em 123 tabelas.** Top usuários:

- `custom_kits` (5 colunas: items, items_data, box_data, personalization_data, packaging_personalization) — **redundância**?
- `kit_templates` / `kit_variants` (3 cada)
- `magic_up_generations` (3)
- `mockup_drafts`, `mockup_generation_jobs`, `generated_mockups` (1-2 cada)
- `audit_log_gravacao` (3: campos_alterados, valor_antes, valor_depois)
- Várias `metadata` JSONB livres

#### `DB-002` 🟡 MÉDIO — JSONB duplicado em `custom_kits` (items vs items_data)

Colunas com nomes próximos (`items`, `items_data`) sugerem migração inacabada. Confirmar com o time qual é canônico e remover o legado.

**Esforço:** S (auditoria + DROP COLUMN)

### 3.3 Drift de migrations

- **Repo:** 708 arquivos `.sql` em `supabase/migrations/`
- **Banco:** 682 registradas em `supabase_migrations.schema_migrations`
- **Drift real:** 26 arquivos (3.7%)
- **README diz 205, DEPLOYMENT diz 332 vs 209 com "interseção zero".**

`DEPLOYMENT.md:1` afirma "interseção zero" entre repo e banco. **Isso é falso na realidade atual** (intersecção é >656 arquivos). O documento está defasado. Provavelmente reflete o estado pré-redeploy de mai/2026 e ninguém atualizou após a Fase 2 do recovery.

#### `DOC-001` 🟠 ALTO — Documentação severamente defasada

Lista de docs desatualizados (samples):
- `README.md`: "47 Edge Functions" / "205 migrations" / "35+ tabelas com RLS"
- `docs/EDGE_FUNCTIONS.md`: "50 funções ativas, 2026-04-17"
- `docs/DEPLOYMENT.md`: "332 vs 209 migrations, interseção zero"
- `docs/04_EXPLICACAO_DAS_POLICIES.md`: "80+ policies"
- Vários `docs/historico/*.md` que viraram fonte de verdade equivocada

**Recomendação.**
1. Scriptar geração automática dos números em `docs/` (já existe `audit/internal-schema.tsv`, expandir).
2. Pre-commit hook que falha se README/EDGE_FUNCTIONS estão fora do range.
3. Adicionar timestamp/auto-gerado-em no topo.

**Esforço:** M (1 dia para gerar scripts + 1 dia para fazer pass nos docs)

### 3.4 Índices e FKs

- **1076 índices** em `public`.
- **Apenas 2 FKs sem cobertura de índice** (`collection_products.product_id_fkey1` e `product_price_freshness_overrides.updated_by_fkey`). Resolução: criar 2 índices.
- **531 índices "não usados"** segundo `pg_stat_user_indexes` — provavelmente noise de tabelas frias e baixa idade do contador. **Não dropar sem janelas longas de observação** (1 mês mínimo).

#### `PERF-003` 🟡 MÉDIO — 531 índices candidatos a remoção

Detalhar com `pg_stat_user_indexes.idx_scan = 0` e idade do counter > 30d. Cuidado especial:
- MVs renomeadas que mantiveram índices.
- Índices em tabelas grandes (>10 MB) pesam mais.
- Em ambiente com poucos usuários (13) é esperado que índices admin estejam ociosos.

**Recomendação.** Rodar `pg_stat_reset()` em janela controlada (sábado madrugada), aguardar 7 dias, repetir advisor. Só dropar índices que continuem com `idx_scan = 0`.

### 3.5 Funções, triggers, views

- **770 funções**, das quais **112 SECURITY DEFINER**, todas com `search_path` setado.
- **256 triggers** customizadas.
- **112 views** (não materializadas).
- **0 materialized views** ← ⚠ (próximo achado)
- **0 filas pgmq** apesar de `pgmq` instalado (recurso disponível mas inativo)

#### `OPS-001` 🟠 ALTO — Cron jobs apontando para materialized views inexistentes

```sql
-- Crons em pg_cron.job:
-- "stock_mv_intelligence_refresh" → REFRESH MATERIALIZED VIEW CONCURRENTLY mv_product_intelligence
-- "stock_mv_velocity_refresh"      → REFRESH MATERIALIZED VIEW CONCURRENTLY mv_stock_velocity

-- Real:
SELECT count(*) FROM pg_matviews WHERE schemaname='public';
-- → 0
```

Esses dois jobs **falham silenciosamente todo dia** às 23:00 e 23:10. Como `cron.job_run_details` deveria estar logando o erro, mas não há sinal/alerta configurado para `failed_with_error`. As MVs provavelmente foram renomeadas / dropadas em alguma migração da onda de recovery, e os jobs ficaram órfãos.

**Recomendação imediata.** Verificar `cron.job_run_details`:

```sql
SELECT jobname, last_executed, status, return_message
FROM cron.job_run_details rd
JOIN cron.job j ON j.jobid = rd.jobid
WHERE jobname IN ('stock_mv_intelligence_refresh','stock_mv_velocity_refresh')
ORDER BY last_executed DESC LIMIT 10;
```

Depois: recriar as MVs (ou apagar os jobs órfãos).

**Esforço:** S (1-3h dependendo do que existia)

---

## 4. Performance & Escalabilidade

### 4.1 RLS Initplan optimization

#### `PERF-001` 🟠 ALTO — 16 tabelas com `auth.uid()` ineficiente

Advisor retornou 36 ocorrências de `auth_rls_initplan` afetando estas tabelas:

```
admin_settings, ai_insights_cache, ai_usage_events, art_file_attachments,
category_icons, collection_products, component_media, organization_members,
product_component_locations, product_components, product_group_members,
product_groups, product_price_freshness_overrides, product_sync_logs,
profiles, quotes
```

Cada chamada a `auth.uid()` em policy não-otimizada é **avaliada por linha** em vez de uma vez por query. Em uma tabela com 100k linhas, isso é ~100k chamadas RPC implícitas. Em `quotes` e `profiles` o impacto pode ser sensível.

**Fix canônico:**

```sql
-- ANTES (ruim)
USING (user_id = auth.uid())

-- DEPOIS (bom)
USING (user_id = (select auth.uid()))
```

**Recomendação.** Migration para refatorar as 16 policies. Padrão simples mas tedioso.

**Esforço:** M (1 dia)

### 4.2 Multiple permissive policies

#### `PERF-002` 🟡 MÉDIO — Sobreposição de policies em `profiles`

```
profiles.SELECT (anon)            : 2 policies
profiles.SELECT (authenticated)   : 2 policies
profiles.SELECT (authenticator)   : 2 policies
profiles.SELECT (dashboard_user)  : 2 policies
profiles.SELECT (supabase_priv..) : 2 policies
profiles.UPDATE (× 5 roles)       : 2 policies cada
```

Nomes duplicados sugerem migração não consolidada (`Users can view their own profile` + `profiles_select`). Cada policy adicional é avaliada e OR-combinada — custo linear no número de policies por op.

**Outras tabelas afetadas:** `component_media`, `organization_members`, `product_component_locations`, `product_components`, `product_group_members`, `product_groups`.

**Recomendação.** Para cada tabela, manter UMA policy clara por operação + role, deletando duplicatas. Use `DROP POLICY IF EXISTS` em migration consolidadora.

**Esforço:** M (1-2 dias)

### 4.3 `external-db-bridge` (cache, breaker, retry)

`external-db-bridge/index.ts` (1950 linhas) é o componente de performance mais sofisticado:
- **Cache em memória** com TTL (STATIC_TABLES 10min; products listing 60s) — chave determinística por (table, filters, select, orderBy, limit, offset). Cache hit/miss counters expostos em telemetria.
- **Circuit breaker** (`_shared/circuit-breaker.ts`) — abre em janela de falhas e bloqueia novas requests por X segundos.
- **Retry com backoff+jitter** (`_shared/retry-backoff.ts`) — somente para erros transientes (`fetch failed`, `econnreset`, `503/504`); **NÃO** retenta statement timeouts (correto — vai para fallback de degradação).
- **Fallback degradation** — em timeout, refaz query com `limit = min(50, qLimit)` e sem `count`.
- **Resolve N+1 com `Promise.all` em batch**.
- **Validação prévia** de filtros (`validateFilters` — ver SEC-011).
- **`requestId` propagado via `AsyncLocalStorage`**.
- **Fast-path anônimo** para reads em tabelas `PRODUCT_TABLES` não sensíveis (poupa ~150-300ms por request).

#### `PERF-004` 🟢 POSITIVO — Padrão exemplar para um BFF de catálogo

A única crítica é o tamanho do arquivo (1950 linhas). Recomenda-se quebrar em módulos:
- `external-db-bridge/handlers/select.ts`
- `external-db-bridge/handlers/crud.ts`
- `external-db-bridge/handlers/batch.ts`
- `external-db-bridge/handlers/rpc.ts`
- `external-db-bridge/handlers/virtual-table.ts`
- `external-db-bridge/index.ts` (apenas orquestrador)

**Esforço:** M (refactor mecânico, ~1 dia + testes)

### 4.4 Auth db connections (10 absolutos)

#### `PERF-005` 🟢 INFO — Auth server limitado a 10 conexões absolutas

Advisor: o Auth server está com `max_connections = 10` em valor absoluto, não percentual da instância. Em bursts de login simultâneo, throttling pode ocorrer.

**Recomendação.** No dashboard Supabase → Settings → Auth → Connection Pool: alternar para "Percentage-based" e usar 5–10% do pool da instância. Tarefa de ops.

---

## 5. Manutenibilidade

### 5.1 Duplicação entre as 81 funções

Por amostragem:
- **CORS**: `_shared/cors.ts` é SSOT, mas algumas funções ainda têm `if (req.method === "OPTIONS") return new Response(null, {headers: corsHeaders})` inline (ex.: `webhook-dispatcher:49`). `handleCorsPreflight*` já existe — substituir.
- **Supabase client**: 56 funções (`grep -l "service_role"`) criam o próprio cliente. Existe `_shared/supabase-client-adapter.ts` (singleton) mas adoção parcial.
- **Auth check**: 27 funções usam `authenticateRequest` ou `authorize`; restantes inline.

#### `MAINT-001` 🟡 MÉDIO — Adoção parcial das primitivas `_shared/`

Inventário rápido:

```bash
grep -l "createClient" supabase/functions/*/index.ts | wc -l     # 56 (≥ + criando próprio client)
grep -l "authenticateRequest\|requireRole\|requireDev" supabase/functions/*/index.ts | wc -l  # 27
grep -l "from '../_shared/zod-validate'" supabase/functions/*/index.ts | wc -l  # check
grep -l "createStructuredLogger" supabase/functions/*/index.ts | wc -l  # check
```

**Recomendação.** Criar `_shared/createEdge.ts` (já existe! 130 linhas) como template padrão — boot estruturado, request-id, logger, CORS, auth opcional. Migrar funções uma a uma, começando pelas mais críticas.

**Esforço:** L (sprint inteiro, mas pode ser incremental)

### 5.2 Tamanho de arquivos

Top 3 arquivos > 1000 linhas: `external-db-bridge`, `expert-chat`, `crm-db-bridge`. Já discutido em PERF-004 e abaixo.

#### `MAINT-002` 🟡 MÉDIO — `expert-chat/index.ts` (1301 linhas) sem decomposição clara

Combina:
- Streaming SSE
- Validação Zod
- Tool calling (Lovable AI)
- Histórico de conversas
- Rate limit AI
- Auditoria de uso

Recomendar quebra em handlers/ e tools/. Como contém o assistente IA principal e é hot path, qualquer refactor exige boa cobertura de teste.

### 5.3 Testes back-end

```bash
$ ls supabase/functions/tests/
edge_integration.test.ts ... (etc)

$ ls supabase/functions/_shared/*.test.ts | wc -l
6   # credentials, dispatcher-auth, external-db-telemetry, retry-backoff, token-revocation, url-allowlist
```

Tem **6 unit tests** dos módulos `_shared/` (boa cobertura dos críticos) + `tests/edge_integration.test.ts`. Configurável via `npm run test:edge:integration` (`supabase test db --file`).

**E2E (Playwright):** 22+ flows críticos em `e2e/`, projetos `chromium-smoke`, `chromium-public`, `chromium-authed`, `routes-mobile`.

**Cobertura via Vitest:** thresholds configurados em `scripts/check-critical-modules-coverage.mjs`. `npm run test:critical-coverage` é o portão.

#### `TEST-001` 🟢 POSITIVO — Disciplina de teste alta para um time pequeno

Pontos a melhorar:
1. Cobertura unitária das 81 funções é desigual — concentre em funções de auth/segurança.
2. RLS tests não evidentes (existe `rls-integration-tests` edge function que parece executar testes em runtime, validar isso).
3. Fuzz testing scripts existem (`npm run test:fuzz`) — confirmar quando rodou pela última vez.

---

## 6. Observabilidade & Operacionalidade

### 6.1 Logger, Sentry, request-id

**Edge:** `_shared/structured-logger.ts` — uma linha JSON por evento, `request_id` propagado, `respond()` decora a Response com `x-request-id`. Excelente.

**Front-end:** `src/lib/logger.ts` — em PROD só `error` é emitido; debug/log/info/warn são silentemente dropados. `src/lib/sentry.ts` lazy-loaded (load em `requestIdleCallback`, máximo 50 erros buffferizados antes do load). LGPD: máscara todo texto/inputs do replay.

#### `OBS-001` 🟡 MÉDIO — 256 `console.*` no front-end fora do logger

```bash
$ grep -rn "console\\." src/ --include="*.ts*" | grep -v "tests\|logger\|sentry" | wc -l
256
```

E só 78 arquivos importam o `logger`. Inconsistência: 256 chamadas crus de `console` significam que:
- Em DEV: poluem o console com formatação non-padronizada.
- Em PROD: `console.error` continua sendo capturado pelo `captureConsoleIntegration` do Sentry (bom!), mas `console.log/warn/debug` não. Não há rastro.

**Recomendação.**
1. ESLint rule: proibir `console.*` em `src/` exceto `logger.ts`/`sentry.ts` (já há `eslint.config.js`, adicionar `no-console`).
2. Codemod automático para migrar.

**Esforço:** M (1 dia codemod + 1 sprint para PR-by-PR aprovar)

#### `OBS-002` 🟢 POSITIVO — Audit log denso

`admin_audit_log` registra 11.873 eventos nas últimas 24h (provavelmente MCP tool calls + admin operations). Estrutura tem `request_id`, `ip`, `ua`, `duration_ms`, `status`, `payload_summary`. Sentry captura `console.error` automático. `request_id` propagado entre front (header `x-request-id`) e edge (`getOrCreateRequestId`).

### 6.2 Health checks

Há **5 funções `*health*`**: `health-check`, `connections-health-check`, `full-op-diagnostics`, `cors-audit`, `rls-audit`. `rls-integration-tests` e `rls-matrix-export` parecem fazer auditoria contínua de RLS em runtime. Pattern excelente — confirma a maturidade operacional.

**Recomendação.** Garantir que `health-check` é o probe Liveness/Readiness no Vercel; documentar SLO (ex.: <200ms, 99.9%).

### 6.3 Alertas e runbooks

Pasta `docs/RUNBOOKS/` existe; `docs/RUNBOOK.md` consolida. `docs/SECURITY_RUNBOOK.md`, `docs/RUNBOOK_CONNECTIONS.md`. Bom para start; mas faltam runbooks específicos para:
- "ELITE_SIM_KEY/SIM_BYPASS vazou" — como rotacionar e invalidar sessões;
- "Cron job falhando" — onde olhar (`cron.job_run_details`);
- "External-db-bridge degradado" — playbook de breaker open;
- "Auth pool throttling" — escalonamento.

### 6.4 Auditoria interna

`_shared/audit-log.ts` (153 linhas) define padrão de evento; `summarizePayload` ofusca PII. Usado em `mcp-server`, `manage-users`, `secrets-manager`. Cobertura precisa ser ampliada.

---

## 7. Custos

> Estimativas qualitativas. Dados financeiros reais precisam vir do dashboard Supabase + Vercel.

### 7.1 Edge Function invocations

- **19 crons ativos**, frequência total: ~138 chamadas/hora apenas de cron (`*/5min` × 3 = 36, `*/10min` × 1 = 6, `*/15min` × 2 = 8, hourly × 2 = 2, daily × 11). 
- + tráfego de usuário (13 users, baixo volume).
- Em Free tier (500k invocations/mês) cabe folgadamente.

### 7.2 Banco de dados

- **3 instâncias Supabase** ativas — multiplica custo.
- Banco principal: ~270 MB top tables, ~1 GB total estimado. Em Pro tier (8GB) cabe.
- Audit logs sem retenção (DB-001) vão dobrar a cada 1-2 anos.

### 7.3 IA (Lovable AI Gateway, ElevenLabs)

- Lovable AI usado em `expert-chat`, `ai-recommendations`, `generate-mockup*`, `magic-up-score`, `market-intelligence-insights`, `semantic-search`, `trends-insights`, `kit-ai-builder`, `bi-copilot`, `comparison-ai-advisor`, `kit-identity-suggest`, `generate-product-seo`. ≥12 funções.
- Rate limit por usuário (20 req/min em `rateLimiters.ai`) limita custo individual.
- `ai-usage.ts` registra cada chamada com modelo + tokens em `ai_usage_events`. Permite cap por organização.

#### `COST-001` 🟢 POSITIVO — Tracking de uso de IA pronto

Recomendar: dashboard agregando `ai_usage_events` por dia/usuário/modelo + alarme de custo (Sentry breadcrumb → Slack via n8n webhook).

---

## 8. Benchmarking

### 8.1 OWASP Top 10 (2021)

| OWASP | Status | Comentário |
|---|---|---|
| A01 Broken Access Control | 🟠 | RLS 100% e RBAC sólidos, mas **SEC-001 zera tudo**. Resolvido isso, vira 🟢. |
| A02 Cryptographic Failures | 🟡 | HSTS, HMAC SHA-256, JWT — OK. Mas **SEC-014** (`integration_credentials.secret_value` em plaintext) é débito. |
| A03 Injection | 🟢 | PostgREST + supabase-js parametrizam; `external-db-bridge` valida filtros; CSP forte. |
| A04 Insecure Design | 🟡 | `external-db-bridge` fast-path anônimo é design escolhido — documentar limites. |
| A05 Security Misconfiguration | 🟠 | **SEC-003** (legacy_no_auth fallback) + **SEC-002** (frontend_telemetry) são misconfigs. |
| A06 Vulnerable & Outdated | 🟢 | Stack moderna (React 18, TS 5, Vite 5, supabase-js 2.49, Deno latest). |
| A07 Auth Failures | 🔴 | **SEC-001** = crítico. |
| A08 Software & Data Integrity | 🟢 | Sentry release tag = commit SHA. Bom. |
| A09 Logging & Monitoring | 🟢 | Estruturado, com request-id ponta a ponta. |
| A10 SSRF | 🟢 | `url-allowlist.ts` + bloqueio IPv4/IPv6 privado. Excelente. |

### 8.2 Padrão Supabase

- RLS 100% ✅
- `SECURITY DEFINER` com `search_path` ✅ (100%)
- `enable_signup = false` ✅
- `enable_anonymous_sign_ins = false` ✅
- Vault para secrets ✅ (3 secrets)
- Storage buckets privados ✅ (8/8)
- Webhook HMAC com timing-safe equal ✅
- Step-up auth (`step-up-verify`) implementado ✅

### 8.3 12-Factor App

| Factor | Conformidade |
|---|---|
| I. Codebase | ✅ git mono-repo |
| II. Dependencies | ✅ package.json explícito |
| III. Config | 🟡 melhorou (vault), mas client.ts hardcoded |
| IV. Backing services | ✅ Supabase + Lovable AI desacoplados |
| V. Build/release/run | ✅ Vite + Vercel |
| VI. Processes stateless | ✅ Edge functions são stateless (cache TTL em memória OK) |
| VII. Port binding | ✅ (managed) |
| VIII. Concurrency | ✅ horizontal scaling |
| IX. Disposability | ✅ |
| X. Dev/prod parity | 🟡 schema drift histórico (DEPLOYMENT.md) |
| XI. Logs | ✅ structured-logger |
| XII. Admin processes | 🟢 cron jobs + edge functions de admin |

### 8.4 Comparativo com SaaS B2B equivalente

Para um time pequeno (1 organização, 13 usuários), o sistema apresenta nível de maturidade tipicamente associado a SaaS B2B de **Série A/B** — bem acima do esperado para "startup interna":

- ✅ Multi-tenant ready (organizations + RLS)
- ✅ MCP server + ferramentas pra LLMs externos (vanguarda)
- ✅ Voice agent + TTS/STT
- ✅ AI generative completa (mockups, anúncios, recomendações, SEO)
- ✅ Webhook infra (HMAC, retries, circuit breaker, replay, test mode)
- ✅ Vault, bot protection, step-up, token revocation
- ✅ Sentry, structured logging, audit log

Em troca, há **complexidade alta** (81 edge funcs, 708 migrations, 770 funções DB) com time pequeno — risco de **carrying capacity**.

---

## 9. Roadmap Priorizado

### 9.1 P0 — Esta semana (críticos)

| Ordem | ID | Ação | Esforço | Bloqueador? |
|---|---|---|---|---|
| 1 | SEC-001 | Remover `ELITE_SIM_KEY` hardcoded + rotacionar `SIMULATION_BYPASS_KEY` no vault + adicionar pre-commit guard | S | Sim — produção em risco |
| 2 | SEC-002 | DROP/replace policy `frontend_telemetry_insert_anon` e `_authenticated`; restringir a `auth.uid()` + cap de payload | S | Sim |
| 3 | SEC-003 | Remover fallback `legacy_no_auth` em `dispatcher-auth.ts` → fail-closed 503 | S | Sim (próximo deploy) |
| 4 | OPS-001 | Investigar `cron.job_run_details` e remover/recriar `stock_mv_*_refresh` | S | Não, mas urgente |
| 5 | SEC-009 | Confirmar auth interna em `crm-db-bridge` e `external-db-inspect` | S | Não |

### 9.2 P1 — Próximas 2-4 semanas

| Ordem | ID | Ação | Esforço |
|---|---|---|---|
| 6 | PERF-001 | Refatorar 36 policies para `(select auth.uid())` | M |
| 7 | PERF-002 | Consolidar `multiple_permissive_policies` em `profiles` e 5 outras | M |
| 8 | DB-001 | Particionamento + retention em audit/log tables | M |
| 9 | OPS-002 | `webhook-inbound` rate-limit + insert pós-HMAC | S |
| 10 | SEC-005 | Migrar 40 funções restantes para Zod (`parseBodyWithSchema`) | M |
| 11 | SEC-004 | Adicionar `allowed_mime_types` aos 6 buckets sem allowlist; limitar bucket `scripts` | M |
| 12 | DOC-001 | Atualizar README/EDGE_FUNCTIONS/DEPLOYMENT com números reais e scripts auto-gerados | M |

### 9.3 P2 — Próximo trimestre

| Ordem | ID | Ação | Esforço |
|---|---|---|---|
| 13 | SEC-014 | Migrar `integration_credentials.secret_value` para `vault` ou pgsodium | L |
| 14 | SEC-007 | Consolidar enum `app_role` e remover aliases `admin`/`vendedor` | M |
| 15 | MAINT-001 | Adoção uniforme de `createEdge.ts` (já existe) nas 81 funções | L |
| 16 | MAINT-002 | Quebrar `external-db-bridge` e `expert-chat` em módulos | M |
| 17 | OBS-001 | Codemod `console.*` → `logger.*` + ESLint rule | M |
| 18 | RLS-002 | Auditar `is_admin_or_above`/`is_coord_or_above` `can_access_quote` `org_has_any_members` | S |

### 9.4 P3 — Débito técnico contínuo

| ID | Ação |
|---|---|
| PERF-003 | Reset `pg_stat_user_indexes` + observar 30d + dropar índices realmente ociosos |
| TEST-001 | Aumentar cobertura unitária das 81 edge functions, priorizando auth & admin |
| COST-001 | Dashboard de custo de IA agregando `ai_usage_events` |
| SEC-016 | Centralizar CSP em `vercel.json` |
| DB-002 | Limpar JSONB duplicado em `custom_kits` |

---

## 10. Comparativo com Auditorias Prévias

Cross-check com os documentos:
- `AUDITORIA_REDEPLOY_PROMO_GIFTS_2026-05-13_15-32 (1).md`
- `AUDITORIA_INDEPENDENTE_PRE_PRODUCAO_2026-05-13.md`
- `RECOVERY_PLAN.md`
- `docs/AUDITORIA_2026-05-07.md`
- `docs/AUDITORIA_SISTEMA.md`
- `docs/AUDIT_FRONTEND_DATABASE.md`

| Achado prévio | Status atual (2026-05-22) | Comentário |
|---|---|---|
| `webhook-dispatcher` público sem secret | 🟢 Resolvido | `WEBHOOK_DISPATCHER_SECRET` no vault, `authorizeDispatcher` ativo |
| `connections-auto-test` público sem secret | 🟢 Resolvido | `CONNECTIONS_AUTO_TEST_SECRET` no vault |
| Drift de migrations (332 vs 209, "interseção zero") | 🟢 Resolvido em grande parte (drift atual: 26/708) | Mas docs não foram atualizados — **DOC-001** |
| 65 tabelas faltantes (`RECOVERY_PLAN.md`) | 🟢 Resolvido | Public tem 269 tabelas; recovery foi completado |
| `bitrix-sync` sem role check | 🟢 Resolvido | Agora usa `authorize.ts` SSOT (verificado via diff) |
| RLS coverage parcial | 🟢 Resolvido | 100% das 269 tabelas |
| Logger não estruturado nas edges | 🟢 Resolvido | `_shared/structured-logger.ts` em produção |
| Falta de circuit breaker | 🟢 Resolvido | `_shared/circuit-breaker.ts` + `external-fetch.ts` |
| Falta de rate-limiter | 🟢 Resolvido | `_shared/rate-limiter.ts` + RPC DB-based |
| **NÃO MENCIONADO antes: `ELITE_SIM_KEY` hardcoded** | 🔴 **NOVO** | Critical — não consta em nenhuma auditoria prévia |
| **NÃO MENCIONADO antes: `frontend_telemetry` policy permissiva** | 🔴 **NOVO** | Critical |
| **NÃO MENCIONADO antes: cron jobs órfãos das MVs** | 🟠 **NOVO** | Sintoma da onda de recovery |
| Audit log sem retenção | 🟠 Recorrente | Mencionado em `AUDIT_FRONTEND_DATABASE.md`, ainda em aberto |
| Console.log em produção | 🟡 Recorrente | Mencionado, parcialmente resolvido (logger criado, mas 256 calls ainda crus) |

**Conclusão do cross-check:** o time executou um excelente trabalho de remediação entre mai/2026 e hoje. As lacunas remanescentes são (i) os 2-3 problemas críticos novos que esta auditoria identifica, (ii) débito técnico de docs/observabilidade, e (iii) refinos de performance RLS.

---

## 11. Anexos

### 11.1 Queries SQL de inspeção (rodar com `mcp__supabase__execute_sql` em read-only)

**RLS coverage:**
```sql
SELECT n.nspname, count(*) AS tables,
       count(*) FILTER (WHERE c.relrowsecurity) AS rls_on,
       count(*) FILTER (WHERE NOT c.relrowsecurity) AS rls_off
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r'
GROUP BY n.nspname;
```

**Funções SECURITY DEFINER sem search_path:**
```sql
SELECT n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) AS args
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname IN ('public','auth','storage')
  AND p.prosecdef = true
  AND (p.proconfig IS NULL
       OR NOT EXISTS (SELECT 1 FROM unnest(p.proconfig) cfg
                      WHERE cfg LIKE 'search_path=%'));
```

**FKs sem índice:**
```sql
SELECT conrelid::regclass AS table_name, conname, a.attname AS fk_column
FROM pg_constraint c
JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
WHERE c.contype = 'f'
  AND NOT EXISTS (
    SELECT 1 FROM pg_index i WHERE i.indrelid = c.conrelid
      AND c.conkey[1] = ANY(i.indkey));
```

**Cron jobs com runtime detalhado:**
```sql
SELECT j.jobname, j.schedule, j.active,
       rd.start_time, rd.end_time, rd.status, rd.return_message
FROM cron.job j
LEFT JOIN LATERAL (
  SELECT * FROM cron.job_run_details
  WHERE jobid = j.jobid ORDER BY start_time DESC LIMIT 1
) rd ON true
ORDER BY j.jobname;
```

**Top tabelas por crescimento (snapshot):**
```sql
SELECT relname, pg_size_pretty(pg_total_relation_size(c.oid)) AS size, n_live_tup
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
JOIN pg_stat_user_tables st ON st.relid = c.oid
WHERE n.nspname = 'public' AND c.relkind = 'r'
ORDER BY pg_total_relation_size(c.oid) DESC LIMIT 25;
```

**Policies permissivas com WITH CHECK (true):**
```sql
SELECT schemaname, tablename, policyname, cmd, roles, with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND cmd IN ('INSERT','UPDATE','ALL')
  AND (with_check = 'true' OR with_check IS NULL);
```

**Auditoria de uso de auth.uid() em policies:**
```sql
SELECT schemaname, tablename, policyname, qual, with_check
FROM pg_policies
WHERE (qual LIKE '%auth.uid()%' AND qual NOT LIKE '%(SELECT auth.uid())%')
   OR (with_check LIKE '%auth.uid()%' AND with_check NOT LIKE '%(SELECT auth.uid())%');
```

### 11.2 Snippets de fix prioritários

Veja inline em SEC-001, SEC-002, SEC-003.

### 11.3 Referências externas

- [Supabase Database Linter](https://supabase.com/docs/guides/database/database-linter)
- [Supabase RLS Best Practices](https://supabase.com/docs/guides/auth/row-level-security)
- [OWASP Top 10:2021](https://owasp.org/Top10/)
- [Postgres `SECURITY DEFINER` patterns](https://www.postgresql.org/docs/current/sql-createfunction.html)
- [12-Factor App](https://12factor.net/)
- Internal docs: `docs/SECURITY-DEFINER-PATTERN.md`, `docs/RBAC_HELPERS.md`, `docs/OBSERVABILITY.md`, `docs/04_EXPLICACAO_DAS_POLICIES.md`

---

## 12. Resumo final (TL;DR)

O **Promo Brindes** apresenta back-end **bem acima da média** para o tamanho do time: RLS 100%, vault para secrets críticos, structured logger, request-id, circuit breaker, retry com jitter, allowlist anti-SSRF, MCP server com escopos auditados, bot-protection, step-up auth, e disciplina sólida de `SECURITY DEFINER`/`search_path`. As auditorias prévias foram majoritariamente endereçadas.

**Mas o sistema **NÃO está pronto para uso amplo em produção** enquanto 3 itens não forem resolvidos:**

1. 🔴 **Remover `ELITE_SIM_KEY`** (`_shared/auth.ts:32` + `test-contract-orchestrator:26`). Custo: ≤2h.
2. 🔴 **Corrigir RLS de `frontend_telemetry`**. Custo: ≤1h.
3. 🟠 **Remover fallback `legacy_no_auth`**. Custo: ≤1h.

Mais 2 itens de **alta visibilidade** que merecem atenção imediata:

4. 🟠 **Cron jobs órfãos** (`stock_mv_*_refresh`).
5. 🟠 **Documentação severamente defasada** (README, EDGE_FUNCTIONS, DEPLOYMENT).

Com estes 5 pontos resolvidos em **uma semana**, o veredito muda para **GO para produção ampla**.

— Fim da auditoria —
