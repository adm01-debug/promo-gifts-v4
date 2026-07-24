# Auditoria de Arquitetura Back-End — promo-gifts-v4

> **Data:** 2026-05-25
> **Autor:** Revisão de Arquitetura Back-End (Sênior)
> **Escopo:** Banco de dados (Postgres/Supabase), Edge Functions (Deno), integração front↔back, segurança, performance, observabilidade, CI/CD, custos e manutenibilidade.
> **Método:** Leitura direta do código + 5 auditorias paralelas por domínio, com verificação manual independente das 6 falhas de maior severidade.

---

## 1. Sumário Executivo

O `promo-gifts-v4` é um sistema de e-commerce/brindes promocionais construído sobre **React + Vite + TypeScript** no front-end e **Supabase** (Postgres com RLS + ~82 Edge Functions Deno + pg_cron) no back-end. A base é **grande e madura**: 828 migrations (~78k linhas SQL), ~82 edge functions, 422 funções `SECURITY DEFINER`, infraestrutura de observabilidade própria, ~40 gates de CI e documentação extensa (131 arquivos markdown, runbooks, ADRs, post-mortems).

**Veredicto geral:** a equipe é **claramente sofisticada em segurança e governança** — Vault para segredos, hashing correto (bcrypt/sha256), gates de CI dedicados, kill-switches reais, rastreamento de custo de IA com quota *fail-closed*. Não é um sistema amador. Porém, sob o verniz de maturidade existem **riscos sistêmicos concretos**, a maioria deles introduzida pelo próprio ritmo intenso de "hardening reativo": correções aplicadas direto em produção e só depois *stubadas* no repositório, padrões de segurança que regridem em migrations recentes, e gates de qualidade que mascaram dívida.

### 1.1 Top riscos (ação imediata)

| # | Risco | Severidade | Categoria |
|---|-------|-----------|-----------|
| **SEC-01** | `external-db-bridge`: caminho `rpc` é despachado **antes** da checagem de auth → RPCs invocáveis anonimamente (`verify_jwt=false`) | 🔴 Alta | Segurança |
| **SEC-02** | SSRF em `connection-test-runner`: `n8n`/`webhook_outbound` validam só o *scheme* → `fetch()` alcança `169.254.169.254` e IPs internos | 🔴 Alta | Segurança |
| **DB-01** | `admin_audit_log` particionado só até **junho/2026** sem função de auto-criação de partição → INSERTs falham em ~5 semanas | 🔴 Alta | Estabilidade |
| **OPS-01** | Repo **não é fonte de verdade**: ~263 migrations são *stubs* (RLS/grants aplicados via MCP direto em prod) → impossível reconstruir prod do zero | 🔴 Alta | Operação |
| **DB-02** | Regressão do `auth_rls_initplan`: migrations recentes voltaram a usar `auth.uid()` "cru" em policies (penalidade 10–100× por linha) | 🟠 Média-Alta | Performance |
| **OBS-01** | Edge functions **sem sink de error-tracking** real (só `console.error`) apesar de comentários alegarem GlitchTip | 🟠 Média-Alta | Observabilidade |
| **SEC-03** | `bulk-random-passwords` (reseta senha de todos os usuários) protegido por token estático com comparação `!==` (timing-unsafe) e sem validação de schema | 🟠 Média | Segurança |
| **QA-01** | Thresholds de cobertura zerados em CI (`--thresholds=0`) e teste de RLS com `continue-on-error: true` → regressões não bloqueiam | 🟠 Média | Qualidade |

### 1.2 Scorecard por categoria

| Categoria | Nota | Comentário |
|-----------|:----:|-----------|
| Segurança — Segredos & Cripto | A | Vault, bcrypt/sha256, redação de logs, gitleaks. Exemplar. |
| Segurança — RLS & Autorização DB | B+ | Cobertura ampla e ativa; cauda de policies `USING(true)` e regressão de initplan. |
| Segurança — Edge Functions | C+ | Bons primitivos, mas auth inconsistente (4 padrões), bypass de RPC, SSRF. |
| Banco — Modelagem | C | Sub-normalizado: 105/142 tabelas sem FK, JSONB como dump, FK órfã. |
| Banco — Performance | C+ | Churn reativo de índices, MVs sem refresh, sem `statement_timeout`. |
| Migrations & Drift | C− | 828 migrations, ~263 stubs, drift já causou colapso de produção. |
| Integração Front↔Back | B− | React Query forte; sem camada de repositório; toast spam. |
| Observabilidade | B | Logging estruturado + dashboards ótimos; cego no servidor para erros/alertas. |
| CI/CD & Qualidade | B | Muitos gates reais; baselines mascaram dívida; sem gate de drift pré-merge. |
| Custos | B+ | Quota de IA fail-closed; cron fan-out e rate-limiter fail-open. |
| Manutenibilidade | B− | Docs excepcionais (mas defasadas); lockfiles duplicados; escala pesa. |
| Operação / Incidentes | A− | Kill-switch, runbooks, post-mortems, feature flags. Grau de produção. |

---

## 2. Metodologia & Escopo

A análise cobriu:

- **`supabase/migrations/`** — 828 arquivos, ~78k linhas SQL (RLS, funções, triggers, views, MVs, cron).
- **`supabase/functions/`** — ~82 edge functions + `_shared/` (auth, CORS, rate-limit, contratos zod, ai-router, kill-switch).
- **`src/`** — camada de integração Supabase, hooks/serviços, contextos de auth, padrões de acesso a dados.
- **Infra de qualidade** — `.github/workflows/`, `scripts/*.mjs`, baselines, `vitest`/`playwright`.

As 6 falhas de maior severidade (SEC-01, SEC-02, DB-01, DB-02, SEC-03, OPS-01) foram **verificadas manualmente** lendo o código-fonte, não apenas reportadas por agentes. Onde o estado de produção pode divergir do repositório (ver OPS-01), a recomendação inclui **"validar em prod"**.

> ⚠️ **Limitação importante:** como ~263 migrations são *stubs* (DDL aplicada via MCP, não materializada no repo), parte do estado real de RLS/grants/partições **não é observável só pelo repositório**. Findings dependentes desse estado estão marcados.

---

## 3. Detalhamento por Categoria

### 3.A Segurança

#### SEC-01 — `external-db-bridge`: caminho RPC sem autenticação 🔴 Alta
**OWASP:** A01 (Broken Access Control) · A07 (Auth Failures)

**Descrição.** A função `external-db-bridge` está em `config.toml` como `verify_jwt = false`. No handler principal, a operação `rpc` é despachada **antes** de qualquer checagem de autenticação — a auth real (JWT + role) vive dentro de `handleCrud`, que só é chamado para CRUD:

```ts
// supabase/functions/external-db-bridge/index.ts:530-537
if (operation === 'rpc') {
  return await handleRpc(body, corsHeaders);   // ← nenhuma auth aqui
}
// CRUD operations
const response = await handleCrud(body, req, corsHeaders, requestStartTime);
```

`handleRpc` (linha 736) só valida contra uma allowlist (`ALLOWED_RPCS`), sem JWT nem role:

```ts
// supabase/functions/external-db-bridge/index.ts:736-749
async function handleRpc(body, corsHeaders) {
  const rpcName = body.rpcName as string;
  if (!ALLOWED_RPCS.includes(rpcName)) { return jsonResponse({...}, 403, ...); }
  const externalSupabase = await getExternalClient(corsHeaders); // service-role no DB externo
  const { data, error } = await externalSupabase.rpc(rpcName, body.rpcParams || {});
```

A allowlist (`_shared/external-db-config.ts:8-18`) contém 9 RPCs, incluindo funções de **escrita/backfill** (`fn_link_product_print_areas`, `fn_backfill_product_print_areas`) e de **precificação** (`fn_get_customization_price*`, `fn_find_fornecedor_price_table`).

**Impacto.** Qualquer chamador anônimo pode invocar essas 9 RPCs com parâmetros arbitrários contra o Postgres externo usando a **service-role key**: exposição de lógica/tabelas de preço (sensível ao negócio) e potencial mutação de dados via as RPCs de backfill/link. O escopo é limitado pela allowlist, mas inclui operações de escrita.

**Recomendação.** Mover a auth para **antes** do dispatch, ou exigir JWT também no caminho RPC. Idealmente, migrar para o template `createEdge` (ver SEC-04):

```ts
// Antes de qualquer dispatch (rpc/crud/batch):
const auth = await authenticateRequest(req); // lança 401 se inválido
requireRole(auth, 'agente');
// só então: if (operation === 'rpc') return handleRpc(...)
```

---

#### SEC-02 — SSRF em `connection-test-runner` (n8n / webhook) 🔴 Alta
**OWASP:** A10 (SSRF)

**Descrição.** `validateUrlFormat` valida apenas o *scheme* para `n8n` e `webhook_outbound` — aceita `http://` puro — e em seguida os pings fazem `fetch()` direto, sem bloquear IPs privados/metadata:

```ts
// supabase/functions/_shared/connection-test-runner.ts:150-158
if (type === "n8n") {
  if (!/^https?:\/\//i.test(url)) return "URL_MALFORMED: ...";   // só o scheme
}
if (type === "webhook_outbound") {
  if (!/^https?:\/\//i.test(url)) return "URL_MALFORMED: ...";
}
```
```ts
// :201 (pingN8n) e :211 (pingWebhook) — fetch direto, sem allowlist de host/IP
const res = await fetch(url, { headers, signal });
```

Existe um validador robusto (`_shared/url-allowlist.ts → validateExternalUrl`, que bloqueia `169.254.0.0/16`, `10.x`, etc.), **mas ele não está conectado aqui**.

**Impacto.** Um usuário autenticado (gate de `supervisor` em `connection-tester/index.ts:54-73`) consegue submeter `http://169.254.169.254/latest/meta-data/...` (metadata da cloud → possíveis credenciais) ou `http://10.x/...` (serviços internos) e observar status/latência/corpo — SSRF semi-cego. Por exigir conta de supervisor, é vetor de insider/conta comprometida, mas o alvo (metadata) é crítico.

**Recomendação.** Reusar `validateExternalUrl` em **todos** os pings (resolver DNS → checar IP resolvido contra blocklist de ranges privados/link-local), e proibir `http://` em produção.

---

#### SEC-03 — `bulk-random-passwords`: token estático timing-unsafe + sem schema 🟠 Média
**OWASP:** A02/A07

**Descrição.** Endpoint que reseta a senha de **todos** os usuários (via service-role `listUsers`/update). A proteção é um único token estático comparado com `!==` (vulnerável a timing) e o corpo é parseado sem validação zod:

```ts
// supabase/functions/bulk-random-passwords/index.ts:101
if (!adminTokenHeader || adminTokenHeader !== expectedAdminToken) { /* 401 */ }
// :108 — sem schema:
const body = (await req.json().catch(() => ({}))) as BulkRequest;
```

**Impacto.** Comparação não constante permite descoberta do token por timing; ausência de schema deixa `maxUsers`, `mode`, `pageSize` sem validação de fronteira. Mitigantes: `mode` default `dry_run` e `pageSize` é *clampado* (linha 119). Mesmo com `verify_jwt`, a anon-key é um JWT válido para o gateway, então o token é o gate efetivo.

**Recomendação.** Comparação em tempo constante (já existe `constantTimeEqual` no projeto) **+** JWT obrigatório com role `dev`/`supervisor` **+** validação zod do corpo (`_shared/contracts/`).

---

#### SEC-04 — Auth inconsistente: `createEdge` com adoção ZERO 🟠 Média
**Descrição.** O template unificado `_shared/createEdge.ts` foi criado para resolver "4 padrões de auth coexistindo", mas **nenhuma** das 82 funções o adota (verificado: 0 imports fora do próprio teste). 25 funções usam `authenticateRequest` direto; 24 declaram `verify_jwt=false` e implementam auth própria (cron-secret/HMAC/bot-protection/allowlist) com qualidade variável.

**Impacto.** Superfície de auth heterogênea → mais difícil auditar e mais fácil introduzir gaps como SEC-01. Manutenibilidade comprometida.

**Recomendação.** Definir `createEdge` como **obrigatório** para novas edges (gate de CI já existe para outros padrões) e migrar incrementalmente as 25 legadas, priorizando as `verify_jwt=false`.

#### Pontos fortes de segurança (confirmados)
- **Segredos via Supabase Vault** (`vault.create_secret`/`decrypted_secrets`), não colunas plaintext (`20260514112056_edge_function_secrets_vault_setup.sql`). `dispatcher-auth.ts` faz comparação constante e *fail-closed* (503) quando o segredo não está setado.
- **Cripto correta:** `mcp_api_keys.key_hash` via sha256; OTP/senhas via `crypt(..., gen_salt('bf'))` (bcrypt).
- **Redação de logs** (`_shared/log-safety.ts`) cobre JWT, Bearer, refs Supabase. `.gitleaks.toml` no CI.
- **CORS** centralizado com headers de segurança (CSP, HSTS, X-Frame-Options). ⚠️ Atenção: os padrões `*.vercel.app` e `*.lovable.app` (`cors.ts:30-37`) são amplos — qualquer deploy nesses domínios passa no allowlist. Como não há `Allow-Credentials`, o risco é moderado, mas vale restringir a subdomínios conhecidos.

---

### 3.B Banco de Dados — Modelagem & Performance

#### DB-01 — Esgotamento de partição do `admin_audit_log` 🔴 Alta
**Descrição.** `admin_audit_log` é particionado por mês, mas em `src/integrations/supabase/types.ts` a última partição é **`admin_audit_log_y2026m06`** (junho/2026). Não há função de auto-criação de partição (`pg_partman`, `create_*_partition`, `PARTITION OF` agendado) no repo, nem partição `DEFAULT` detectável.

**Impacto.** Com a data atual em 2026-05-25, INSERTs com timestamp de julho/2026 **falharão** (sem partição destino e sem DEFAULT) em ~5 semanas — toda escrita de auditoria administrativa quebra. Como a DDL de particionamento pode estar *stubada* em prod (ver OPS-01), **validar em produção** se existe DEFAULT/auto-criação.

**Recomendação.** Função agendada (pg_cron) que cria as próximas N partições antecipadamente, ou adotar `pg_partman`:

```sql
CREATE OR REPLACE FUNCTION public.ensure_audit_partitions(months_ahead int DEFAULT 3)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE d date := date_trunc('month', now())::date; i int;
BEGIN
  FOR i IN 0..months_ahead LOOP
    EXECUTE format(
      'CREATE TABLE IF NOT EXISTS public.admin_audit_log_y%sm%s PARTITION OF public.admin_audit_log FOR VALUES FROM (%L) TO (%L)',
      to_char(d,'YYYY'), to_char(d,'MM'), d, (d + interval '1 month')::date);
    d := (d + interval '1 month')::date;
  END LOOP;
END $$;
-- cron: SELECT cron.schedule('ensure-audit-partitions','0 0 1 * *', $$SELECT public.ensure_audit_partitions(3)$$);
```

#### DB-02 — Regressão do `auth_rls_initplan` 🟠 Média-Alta
**Descrição.** A migration `20260512000001_t25_fix_auth_rls_initplan.sql` corrigiu **270 policies** para `(SELECT auth.uid())` (avaliação 1× por query em vez de 1× por linha). Mas migrations recentes regrediram: `20260524220150_restore_access_security_management_tables.sql` usa `auth.uid()` "cru" — **16 ocorrências, 0 envolvidas em `SELECT`** (verificado):

```sql
-- 20260524220150_restore_access_security_management_tables.sql:24
using (public.is_admin_or_above(auth.uid()))
with check (public.is_admin_or_above(auth.uid()));
```

**Impacto.** Re-introduz avaliação por linha (penalidade de 10–100× em tabelas grandes, conforme a própria nota da t25). 155 arquivos ainda contêm `auth.uid()` cru em contexto de policy.

**Recomendação.** Padronizar `(SELECT auth.uid())` e `(SELECT public.is_admin_or_above((SELECT auth.uid())))`. Adicionar **gate de CI** que rejeite `auth.uid()` cru em `CREATE POLICY` (lint de SQL).

#### DB-03 — Modelagem sub-normalizada 🟠 Média
**Descrição.** 105 de 142 tabelas têm `Relationships: []` (sem FK declarada) em `types.ts`. A tabela `products` perdeu FKs originais (categories/suppliers) e foi **desnormalizada** para strings livres (`category_name`, `supplier_name`) ao lado de `category_id`/`supplier_id` sem constraint. É um *dump* JSONB: `colors`, `kit_items`, `metadata`, `tags`, `variations` todos `Json`. **Não existe tabela `product_variants`** — variantes vivem em `products.variations` (JSONB), porém `price_history.variant_id` (`types.ts:4048`) referencia uma tabela de variantes inexistente (FK órfã, não verificável). 365 colunas JSONB em 194 tabelas.

**Impacto.** Integridade referencial não garantida pelo banco; risco de dados órfãos/inconsistentes; queries de preço/variante frágeis; dificuldade de evolução de schema.

**Recomendação.** (1) Reintroduzir FKs onde a cardinalidade é estável (preço/variante/categoria); (2) promover `products.variations` JSONB a tabela `product_variants` real com FK; (3) substituir strings livres redundantes por FK + view de leitura.

#### DB-04 — Índices: churn reativo e cobertura incompleta de FK 🟠 Média
**Descrição.** Em um único dia (2026-05-24) há **5 rounds de `drop_unused_indexes` (62 índices removidos)** intercalados com **4 migrations de `add_missing_fk_indexes`** (`20260524213000_index_unindexed_foreign_keys.sql`, `colapso_fase4_add_missing_fk_indexes.sql`, `perf_add_missing_fk_indexes.sql`, `t28b_fk_indexes_remaining.sql`). O sufixo "remaining"/"round N" indica cobertura incompleta a cada passada.

**Impacto.** FKs sem índice causam joins lentos e *lock escalation* em deletes do pai. O churn sugere ausência de estratégia de indexação desenhada (só remendos guiados por advisor).

**Recomendação.** Auditoria única e definitiva: `pg_stat_user_indexes` (uso) + checagem de toda FK sem índice de cobertura, consolidada numa migration. Estabelecer revisão de índice como parte do *design* de cada nova tabela.

#### DB-05 — Materialized views sem refresh agendado 🟠 Média
**Descrição.** Há 3 MVs em `analytics` (`mv_material_group_stats`, `mv_product_compositions`, `mv_media_health`). `refresh_materialized_views()` usa `REFRESH ... CONCURRENTLY` (bom), mas **só atualiza 2 das 3** (omite `mv_media_health`) e **não está agendada em nenhum cron**. Crons antigos de MV (`stock_mv_*`) ficaram órfãos e falhando até serem removidos (`p1_db_hardening`).

**Impacto.** Dados de MV permanentemente desatualizados → relatórios/BI incorretos.

**Recomendação.** Agendar `refresh_materialized_views()` via pg_cron (ex.: `*/30`), incluir `mv_media_health`, e adicionar alerta se o `last_refresh` ficar > N horas.

#### DB-06 — Sem `statement_timeout`; risco de pile-up de cron 🟠 Média
**Descrição.** Nenhum `SET statement_timeout` no repo (0 ocorrências); apenas `idle_in_transaction_session_timeout`. Vários jobs `*/15` se aglomeram e DELETEs/purges pesados colidem na janela 03:00–04:00 UTC.

**Impacto.** Queries em fuga rodam sem teto; contenção de lock/picos de carga na janela noturna.

**Recomendação.** `ALTER ROLE authenticated SET statement_timeout = '30s'` (e valor maior só para roles de batch); escalonar horários de cron pesado.

---

### 3.C Migrations, Drift & Reprodutibilidade

#### OPS-01 — Repositório não é fonte de verdade (≈263 stubs) 🔴 Alta
**Descrição.** Aproximadamente 263 das 828 migrations são **stubs** ("applied directly to production… Stub file created to keep Supabase CLI in sync"), incluindo migrations de **segurança crítica** — `enable_rls_all_tables_fuchsia_v2`, `fix_rls_*`, particionamento. `MIGRATIONS_SYNC_LOG.md` documenta bug de ordenação (collation `_` vs dígito) que exigiu `migration repair` manual; o git log confirma episódios repetidos de "reconcilia drift" e "reconcile Supabase drift causing system collapse".

**Impacto.** Impossível recriar o estado de produção a partir do repo (RLS/grants/partições). Risco estrutural de drift; auditoria de segurança fica incompleta (não dá para provar a postura real só pelo repo). O drift **já causou um colapso de produção**.

**Recomendação.** (1) **`pg_dump --schema-only` periódico** versionado como *snapshot* de verdade (fonte canônica para auditoria); (2) **gate de drift pré-merge** (não só o cron diário `0 2`), comparando schema do PR vs prod; (3) política: nenhuma DDL de segurança aplicada via MCP sem a migration real correspondente no mesmo PR.

#### Pontos fortes (confirmados)
- Idempotência geralmente boa (`CREATE ... IF NOT EXISTS`, guards em `pg_policies`, `to_regclass()`).
- DDL destrutiva guardada; o único `DROP COLUMN` sem guarda é `orders.tracking_code`.
- Infra de auditoria real: `audit_log` + `audit_trigger_func` universal, `secret_rotation_log`, `rls_denial_log`, `bot_detection_log`.

---

### 3.D Integrações Externas

- **SSRF (ver SEC-02)** é o risco central das integrações (n8n, webhooks, connection-tester).
- **`external-fetch.ts`** exige só `https://` e **não** chama `validateExternalUrl`; a allowlist forte é usada por apenas 1 função (`generate-mockup`). Recomenda-se centralizar todo fetch externo por um wrapper único que aplique a allowlist.
- **Rate-limiter fail-open** (`_shared/rate-limiter.ts:36-37,56-58`): em erro de RPC retorna `allowed:true` silenciosamente — um soluço no DB desliga toda a limitação. Contraste com a quota de IA (fail-closed, correto). Recomenda-se *fail-closed* (ou ao menos alertar) em endpoints sensíveis.
- **Bom:** `image-proxy` tem allowlist exata de domínios + anti-hotlink + cap de 5 MB + cache CDN; `crm-db-bridge` falha fechado com allowlist rígida de tabelas; segredos resolvidos DB-first (`integration_credentials`) com fallback `Deno.env`.
- **Backlog conhecido:** migrar `EXTERNAL_CRM_*` de env para `integration_credentials` (STATUS.md, prioridade baixa — depende de chaves do sponsor).

---

### 3.E Integração Front-End ↔ Back-End

- **Sem camada de repositório (🟠 Média).** `supabase.from(...)` espalhado por 67 arquivos (77 em hooks, 55 em componentes, 15 em pages, só 9 em `services/`). Nomes de tabela vazam para a UI. **Bom:** React Query é usado de forma consistente (~697 sites) com config central sólida (`src/lib/query-config.ts:71-117`): staleTimes em camadas, retry por tipo de erro, caminho `CLOUD_NOT_READY` para cold start.
- **Autorização cliente é só UI (🟠 Média).** `isAdmin` é derivado client-side; guards de rota são *cosméticos*. Há **102 writes diretos** (`insert/update/delete/upsert`) em código admin dependendo **inteiramente de RLS**. Como o repo não é fonte de verdade (OPS-01), é essencial **confirmar RLS em cada tabela alcançável por esses writes**.
- **Segredos no front (🟢 Baixa — bem gerido).** Nada sensível vaza: só a publishable/anon key (por design). `SERVICE_ROLE` no front são apenas *labels* de uma UI de conexões. `src/lib/sensitive-masking.ts` mascara tokens em logs.
- **XSS (🟢 Baixa).** Único `dangerouslySetInnerHTML` dinâmico (`src/components/ui/chart.tsx:75`) é duplamente protegido (DOMPurify + regex de cor). Sem `eval`/`innerHTML` perigosos.
- **Over-fetch / N+1 (🟠 Média).** 89 `select('*')`, alguns sem `LIMIT` (`useAccessSecurity.ts:59-60`) → fetch ilimitado conforme os dados crescem. N+1 majoritariamente evitado (iterações sobre resultados de RPC já buscados; `Promise.all`).
- **Toast spam (🟠 Média).** **1.074** sites de `toast.*`; baseline `.toast-leaks-baseline.json` (871 linhas) rastreia 173 toasts que vazam `error.message` cru ao usuário. Existe `sanitizeError` mas é usado só no módulo de conexões. **Recomenda-se** rotear todo `toast.error` por `sanitizeError`. Updates otimistas praticamente ausentes (1 `onMutate`) → UI pessimista.
- **Detalhe:** `window.queryClient` é exposto globalmente em produção (`query-config.ts:127`) — conveniência de debug que deveria ficar atrás de flag de dev.

---

### 3.F Observabilidade & Operação

- **OBS-01 — Edge functions sem error-tracking real (🟠 Média-Alta).** `grep` por `captureException|glitchtip|sentry` em `supabase/functions/` retorna vazio; comentários em `ai-usage.ts:64,92` alegam captura por GlitchTip, mas o mecanismo real é só `console.error` nos logs do Supabase. Erros de servidor só são vistos por *grep* de log, sem alerta.
- **OBS-02 — Observabilidade é pull/dashboard, não push (🟠 Média).** Não há PagerDuty/Opsgenie/Slack-webhook. Nada *pageia* um humano em incidente de produção.
- **Pontos fortes (confirmados):** logger estruturado SSOT (`_shared/structured-logger.ts`) com `request_id` propagado client→edge→DB→Sentry e **gate de CI** que o garante; Sentry no front (lazy, no-op sem DSN); dashboard admin de observabilidade (`/admin/observabilidade`) com métricas de webhook.
- **Recomendação:** plugar um sink server-side real (Sentry/GlitchTip SDK Deno) nas edges e configurar pelo menos 1 canal de alerta push para severidade alta.

---

### 3.G CI/CD & Qualidade

- **QA-01 — Thresholds de cobertura neutralizados (🟠 Média).** `vitest.config.ts:53-57` define 60/60/50/60, mas **todo run de cobertura no CI sobrescreve para 0** (`ci.yml:257-260,308-312`; `--thresholds=0` no `package.json`). O job de RLS é `continue-on-error: true` (`ci.yml:206`) → **regressão de RLS não bloqueia**.
- **QA-02 — Cultura de baseline mascara dívida (🟠 Média).** `lint`/`typecheck` rodam *baseline-diff* (só falham em erros novos). Dívida atual congelada: **`.tsc-baseline.json` = 508 erros TS / 196 arquivos; `.eslint-baseline.json` = 128 erros / 193 arquivos; `.toast-leaks-baseline.json` = 871 linhas**. O gate de structured-logging é uma allowlist congelada de 25 edges ("NÃO ADICIONAR novas entradas"). *Nuance positiva:* STATUS.md ainda cita 1.010/442 (defasado) — a dívida foi **cortada pela metade**, mas a doc não acompanhou.
- **QA-03 — Drift detectado tarde (🟠 Média).** O gate de drift é um **pg_cron diário (`0 2`)**, não pré-merge; o CI só bloqueia `supabase db push`. Dado que drift já causou colapso, falta um gate **pré-merge** (ver OPS-01).
- **Pontos fortes:** gates reais e bloqueantes — `typecheck-pr-gate`, guard de literais de bypass, hardening + ACL de SECURITY DEFINER, manifesto de authz de edge, propagação de CORS/request-id, `check-no-db-push`, e `required-checks-guard` que valida a própria proteção de branch. Pirâmide de testes ampla (unit, e2e smoke/regression/critical, edge integration, contract, fuzz, stress).

---

### 3.H Custos

- **Bom:** rastreamento de IA com quota **atômica e fail-closed** (`_shared/ai-usage.ts:88-101`), estimativa de custo por modelo (`MODEL_PRICING`), log em `ai_usage_logs`, router multi-provider com fallback. `image-proxy` com cap de bytes + cache CDN (`s-maxage=604800`).
- **COST-01 — Cron fan-out de IA (🟠 Média).** 4 cron jobs invocam edges via `net.http_post`; há ~11 edges de IA (`ai-recommendations`, `trends-insights`, `market-intelligence-insights`, `bi-copilot`, 3 `*-watcher`, `quote-followup-reminders`) em schedules `*/4`–`*/15`. Quotas são **por usuário**, então chamadas de IA **disparadas pelo sistema/cron podem escapar das quotas**. Confirmar teto de custo dos watchers.
- **COST-02 — Rate-limiter fail-open (ver 3.D)** remove proteção de custo num soluço de DB.
- **LOW:** front com 197 deps (jspdf, pptxgenjs, xlsx, html2canvas, framer-motion) — provavelmente lazy, mas falta *budget* de bundle.

---

### 3.I Manutenibilidade

- **Escala pesa (🟠 Média):** 828 migrations, 82 edges, 4 módulos de auth coexistindo (`auth.ts`, `authorize.ts`, `dispatcher-auth.ts`, `credentials.ts`), ~40 scripts `check-*`. Cada script mapeia a um gate de CI (governança intencional, não tooling órfão), mas a sobrecarga cognitiva é alta.
- **Lockfiles duplicados (🟠 Média):** `package-lock.json` (537 KB) **e** `bun.lock` (278 KB) versionados, com `packageManager: npm@10.9.7` e CI em `npm ci`. O `bun.lock` é drift inutilizado → remover ou `.gitignore`.
- **Doc-rot (🟢 Baixa):** documentação excepcional (131 .md, ADRs, runbooks, post-mortems) mas defasada (STATUS.md com números 2× errados).
- **Recomendação:** remover `bun.lock`; auto-gerar os números de STATUS.md no CI; consolidar os 4 módulos de auth atrás de `createEdge`.

#### Operação / Incidentes (forte)
Kill-switch real e ligado front↔back (`_shared/kill_switch.ts` + `KillSwitchBanner.tsx` + telemetria), feature flags/A-B, `SECURITY.md` com canal privado + PGP, `SECURITY_RUNBOOK.md`, `docs/incidents/`, `POSTMORTEM_TEMPLATE.md`. Postura de incidente de grau de produção.

---

## 4. Lista de Prioridades (Roadmap)

### 🔴 P0 — Crítico (esta semana)
1. **DB-01** — Criar função + cron de auto-partição do `admin_audit_log` (INSERTs quebram em ~5 semanas). *Validar em prod se há DEFAULT/partman.*
2. **SEC-01** — Mover auth para antes do dispatch RPC em `external-db-bridge` (ou exigir JWT no caminho RPC).
3. **SEC-02** — Conectar `validateExternalUrl` aos pings de `connection-test-runner` (bloquear IP privado/metadata).
4. **OPS-01** — Instituir snapshot `pg_dump --schema-only` versionado + **gate de drift pré-merge**.

### 🟠 P1 — Importante (este mês)
5. **DB-02** — Corrigir regressão de `auth.uid()` cru + gate de CI contra ele.
6. **SEC-03** — `bulk-random-passwords`: comparação constante + JWT/role + schema zod.
7. **OBS-01** — Sink de error-tracking real nas edges + 1 canal de alerta push.
8. **QA-01** — Re-habilitar thresholds de cobertura e tornar teste de RLS bloqueante.
9. **DB-05** — Agendar refresh das MVs (incluir `mv_media_health`).

### 🟡 P2 — Desejável (trimestre)
10. **SEC-04** — Migrar edges legadas para `createEdge` (priorizar `verify_jwt=false`).
11. **DB-03/DB-04** — Reintroduzir FKs-chave + `product_variants` real; auditoria definitiva de índices.
12. **DB-06** — `statement_timeout` + escalonar cron pesado.
13. **Front** — `sanitizeError` em todos os toasts; limitar `select('*')` sem `LIMIT`.
14. **COST-01** — Teto/quota de custo para IA disparada por cron.

### 🟢 P3 — Higiene
15. Remover `bun.lock`; auto-gerar números do STATUS.md; restringir CORS `*.vercel.app`; remover `window.queryClient` de prod.

---

## 5. Benchmarking (vs. padrões de mercado)

| Dimensão | Este sistema | Padrão de mercado maduro | Gap |
|----------|--------------|--------------------------|-----|
| Gestão de segredos | Vault + redação + gitleaks | Vault/KMS + rotação + scanning | ✅ No nível |
| RLS / multi-tenant | Ampla, com helpers e testes | RLS + testes de isolamento bloqueantes | 🟡 Testes não bloqueiam (QA-01) |
| IaC / reprodutibilidade | Migrations + ~263 stubs | Migrations versionadas = fonte única | 🔴 Drift estrutural (OPS-01) |
| Observabilidade | Logs estruturados + dashboards | Logs + traces + **alertas push** + APM | 🟠 Cego no servidor (OBS-01/02) |
| Error tracking | Front (Sentry) | Front **+ back** unificado | 🟠 Edges sem sink |
| Governança de CI | ~40 gates dedicados | Lint/type/test/security bloqueantes | ✅ Acima da média (mas baselines) |
| Padrão de auth de API | 4 padrões + template não adotado | 1 middleware único | 🟠 Inconsistente |
| Custo de IA | Quota fail-closed + tracking | Quota + budget + alerta | ✅ Bom (gap: cron) |
| Modelagem de dados | Sub-normalizada, JSONB-heavy | 3NF + JSONB pontual | 🟠 Abaixo |

**Leitura:** o sistema está **no nível ou acima do mercado** em segredos, governança de CI e postura de incidente; **abaixo** em reprodutibilidade de infra, alerta de produção e modelagem de dados. O perfil é típico de um produto que cresceu rápido com hardening reativo competente — a próxima fase de maturidade é **tornar o repo a fonte de verdade** e **fechar o loop de alerta de produção**.

---

## 6. Anexo — Tabela consolidada de findings

| ID | Categoria | Severidade | Prioridade | Evidência (arquivo:linha) |
|----|-----------|:----------:|:----------:|---------------------------|
| SEC-01 | Segurança/Authz | Alta | P0 | `external-db-bridge/index.ts:530-537,736-749`; `_shared/external-db-config.ts:8-18` |
| SEC-02 | Segurança/SSRF | Alta | P0 | `_shared/connection-test-runner.ts:150-158,201,211` |
| DB-01 | Estabilidade | Alta | P0 | `types.ts` (última partição `_y2026m06`); ausência de auto-criação |
| OPS-01 | Operação/Drift | Alta | P0 | `MIGRATIONS_SYNC_LOG.md`; ~263 stubs; git log "reconcile drift" |
| DB-02 | Performance | Média-Alta | P1 | `20260524220150_restore_access_security_management_tables.sql:24+` (16× `auth.uid()` cru) |
| OBS-01 | Observabilidade | Média-Alta | P1 | sem `captureException` em `supabase/functions/`; `ai-usage.ts:64,92` |
| SEC-03 | Segurança | Média | P1 | `bulk-random-passwords/index.ts:101,108` |
| QA-01 | Qualidade | Média | P1 | `ci.yml:206,257-260,308-312`; `vitest.config.ts:53-57` |
| DB-05 | Performance | Média | P1 | `refresh_materialized_views()` (2/3 MVs, sem cron) |
| SEC-04 | Manutenibilidade | Média | P2 | 0 imports de `createEdge`; 25× `authenticateRequest` |
| DB-03 | Modelagem | Média | P2 | `types.ts` (105/142 sem FK; `price_history.variant_id:4048`) |
| DB-04 | Performance | Média | P2 | `*drop_unused_indexes*` (5 rounds) + `*fk_indexes*` (4) em 2026-05-24 |
| DB-06 | Performance | Média | P2 | 0× `statement_timeout`; cluster de cron 03:00–04:00 UTC |
| COST-01 | Custos | Média | P2 | crons `net.http_post` → edges de IA; quota só por-usuário |
| INT-01 | Integração | Média | P2 | `_shared/rate-limiter.ts:36-37,56-58` (fail-open) |
| FE-01 | Front/UX | Média | P2 | `.toast-leaks-baseline.json` (173 toasts crus) |
| QA-02 | Qualidade | Média | P2 | baselines: 508 TS / 128 ESLint / 871 toast |
| MNT-01 | Manutenibilidade | Média | P3 | `bun.lock` + `package-lock.json` coexistindo |
| SEC-05 | Segurança | Baixa | P3 | `cors.ts:30-37` (`*.vercel.app`/`*.lovable.app` amplos) |

> **Nota final.** Vários findings dependem do estado real de produção que **não é totalmente observável pelo repositório** (OPS-01). As recomendações P0 incluem tornar o repo a fonte de verdade — pré-requisito para qualquer auditoria de segurança ter validade completa.
