# Relatório de Arquitetura Back-End — Análise Sênior Exaustiva
**promo-gifts-v4 · Data: 2026-05-25 · Branch: claude/backend-architecture-review-CIjq0**

> **Metodologia:** Análise direta do código-fonte (841 migrations SQL, ~82 Edge Functions Deno, camada de integração React/Supabase, ~40 scripts de CI, documentação interna). Os achados foram verificados manualmente — não inferidos automaticamente. Este relatório complementa e aprofunda a auditoria `docs/AUDITORIA-BACKEND-2026-05-25.md` com novos findings, evidências adicionais e recomendações concretas de implementação.

---

## 1. Sumário Executivo

O `promo-gifts-v4` é um sistema de brindes/presentes corporativos construído sobre **React 18 + Vite + TypeScript** no front-end e **Supabase** (Postgres 15 + RLS + 82 Edge Functions Deno + pg_cron) no back-end. A infraestrutura é deployada na **Vercel** (SPA) + **Supabase Cloud**, com banco externo de produtos (`EXTERNAL_PROMOBRIND`) e CRM externo (`EXTERNAL_CRM`) acessados por bridges.

### Veredicto Geral

A equipe demonstra **sofisticação técnica acima da média** para uma startup: Vault para segredos, bcrypt/sha256 corretos, 40+ gates de CI, kill-switches reais, circuit-breakers, quota de IA fail-closed, token revocation, rastreamento de custo por modelo. Não é um sistema amador.

No entanto, identificamos **riscos sistêmicos críticos** — em parte introduzidos pelo próprio ritmo intenso de "hardening reativo": correções aplicadas direto em produção sem refletir no repositório, padrões de auth que regridem em migrations recentes, e gates de qualidade que mascaram dívida técnica crescente.

### Top 8 Riscos (Ação Imediata)

| # | ID | Risco | Severidade | Categoria |
|---|----|-------|-----------|-----------|
| 1 | **SEC-01** | `external-db-bridge`: caminho `rpc` despachado **antes** de qualquer auth → RPCs com escrita invocáveis anonimamente | 🔴 Alta | Segurança |
| 2 | **SEC-02** | SSRF em `connection-test-runner`: n8n/webhook não bloqueiam IPs de metadata cloud (`169.254.169.254`) | 🔴 Alta | Segurança |
| 3 | **DB-01** | Partição de `admin_audit_log` esgota em ~5 semanas (última: junho/2026) sem auto-criação | 🔴 Alta | Estabilidade |
| 4 | **OPS-01** | ~263 migrations são stubs — repositório não é fonte de verdade; drift já causou colapso de produção | 🔴 Alta | Operação |
| 5 | **SEC-NEW-01** | Role `simulation` concede poder de `dev` (acesso total) mas não é documentada nem auditada | 🔴 Alta | Segurança |
| 6 | **DB-02** | Regressão do `auth_rls_initplan`: migrations recentes voltaram a usar `auth.uid()` cru (16 ocorrências) | 🟠 Média-Alta | Performance |
| 7 | **OBS-01** | Edge functions sem error-tracking real (apesar de comentários alegarem GlitchTip) | 🟠 Média-Alta | Observabilidade |
| 8 | **SEC-NEW-02** | CSP do Vercel contém `'unsafe-inline'` **e** `'unsafe-eval'` no `script-src` — anula proteção XSS | 🟠 Média-Alta | Segurança |

### Scorecard por Categoria

| Categoria | Nota | Comentário |
|-----------|:----:|-----------|
| Segredos & Cripto | A | Vault, bcrypt/sha256, redação de logs, gitleaks. Exemplar. |
| RLS & Autorização DB | B+ | Cobertura ampla; cauda de policies `USING(true)` e regressão de initplan. |
| Auth de Edge Functions | C+ | Bons primitivos, mas 24 funções `verify_jwt=false`, role `simulation` sem governança, bypass key dead code, 4 padrões coexistindo. |
| Banco — Modelagem | C | 105/142 tabelas sem FK, JSONB como dump, FK órfã, sub-normalização severa. |
| Banco — Performance | C+ | Churn reativo de índices, MVs sem refresh, sem `statement_timeout`. |
| Migrations & Drift | C− | 841 migrations, ~263 stubs, drift já causou colapso de produção confirmado. |
| Integração Front↔Back | B− | React Query forte; sem camada de repositório; `select('*')` em 82 locais; `window.queryClient` exposto sem feature flag. |
| Observabilidade | B | Logging estruturado + dashboards; cego no servidor para erros/alertas. |
| CI/CD & Qualidade | B | 40+ gates reais; thresholds de cobertura zerados; baselines mascaram dívida. |
| Custos | B+ | Quota de IA fail-closed; cron fan-out pode escapar de quotas; rate-limiter fail-open. |
| Manutenibilidade | B− | Docs excepcionais mas defasadas; lockfiles duplicados; 508 erros TS congelados. |
| Operação / Incidentes | A− | Kill-switch, runbooks, post-mortems. Grau de produção. |

---

## 2. Metodologia e Escopo

Foram analisados:

- **`supabase/migrations/`** — 841 arquivos, 79.377 linhas SQL (RLS, funções, triggers, views, MVs, cron, partições, grants)
- **`supabase/functions/`** — 82 edge functions + `_shared/` completo (auth, CORS, rate-limit, circuit-breaker, kill-switch, contratos Zod, ai-router, credentials)
- **`supabase/config.toml`** — configuração de cada função (verify_jwt, autenticação)
- **`src/`** — camada de integração Supabase, hooks, contextos de auth, queries
- **`vercel.json`** — headers de segurança, CSP, configuração de deploy
- **`package.json` / `vitest.config.ts` / `.github/workflows/`** — qualidade, testes, CI
- **`docs/`** e **`audit/`** — histórico de incidentes, ADRs, runbooks, post-mortems

> ⚠️ **Limitação estrutural confirmada:** ~263 migrations são stubs. O estado real de produção (RLS, grants, partições) **não é totalmente observável pelo repositório**. Achados dependentes desse estado estão marcados com `(validar em prod)`.

---

## 3. Detalhamento por Categoria

---

### 3.A Segurança

#### SEC-01 — `external-db-bridge`: caminho RPC sem autenticação 🔴 Alta
**OWASP:** A01 (Broken Access Control) · A07 (Identification and Authentication Failures)

**Evidência (verificada):**
```typescript
// external-db-bridge/index.ts:530-537
if (operation === 'rpc') {
  return await handleRpc(body, corsHeaders);  // ← NENHUMA auth aqui
}
// CRUD operations (tem auth dentro de handleCrud)
const response = await handleCrud(body, req, corsHeaders, requestStartTime);
```

```typescript
// external-db-bridge/index.ts:736-749
async function handleRpc(body: any, corsHeaders: Record<string, string>) {
  const rpcName = body.rpcName as string;
  if (!ALLOWED_RPCS.includes(rpcName as any)) {
    return jsonResponse({ error: `RPC '${rpcName}' não permitida` }, 403, corsHeaders);
  }
  const externalSupabase = await getExternalClient(corsHeaders);  // service-role no BD externo
  const { data, error } = await externalSupabase.rpc(rpcName, body.rpcParams || {});
```

A função tem `verify_jwt = false` no `config.toml`. A allowlist de RPCs em `_shared/external-db-config.ts` inclui:
- `fn_link_product_print_areas` (escrita)
- `fn_backfill_product_print_areas` (escrita em lote)
- `fn_get_customization_price` (tabelas de preço — sensível ao negócio)
- `fn_find_fornecedor_price_table` (tabelas de fornecedores)

**Impacto:** Qualquer chamador anônimo pode invocar essas RPCs com parâmetros arbitrários usando a service-role key do banco externo. RPCs de escrita podem mutar dados de produtos; RPCs de preço expõem dados comerciais sensíveis.

**Correção:**
```typescript
// Adicionar ANTES de qualquer dispatch (linha ~480):
const authHeader = req.headers.get('Authorization');
if (!authHeader?.startsWith('Bearer ')) {
  return jsonResponse({ error: 'Autenticação necessária' }, 401, corsHeaders);
}
const supabaseUser = createClient(SUPABASE_URL, ANON_KEY, {
  global: { headers: { Authorization: authHeader } }
});
const { data: { user }, error: userErr } = await supabaseUser.auth.getUser();
if (!user || userErr) {
  return jsonResponse({ error: 'Token inválido ou expirado' }, 401, corsHeaders);
}
```

---

#### SEC-02 — SSRF em `connection-test-runner` 🔴 Alta
**OWASP:** A10 (Server-Side Request Forgery)

**Evidência:**
```typescript
// _shared/connection-test-runner.ts:150-158
if (type === "n8n") {
  if (!/^https?:\/\//i.test(url)) return "URL_MALFORMED: ...";  // só valida scheme
}
// :201 — fetch direto sem checagem de IP
const res = await fetch(url, { headers, signal });
```

O validador robusto `_shared/url-allowlist.ts → validateExternalUrl` existe e bloqueia `169.254.0.0/16`, `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, mas **não está conectado** a `connection-test-runner`.

**Impacto:** Usuário com role `supervisor` pode submeter `http://169.254.169.254/latest/meta-data/iam/security-credentials/` como URL de n8n, obter credenciais temporárias da cloud (AWS/GCP) via resposta do fetch.

**Correção:**
```typescript
// Em connection-test-runner.ts, antes de fazer fetch():
import { validateExternalUrl } from "./url-allowlist.ts";
const urlValidation = await validateExternalUrl(url); // resolve DNS, checa IP
if (!urlValidation.ok) {
  return `URL_BLOCKED: ${urlValidation.reason}`;
}
// Proibir http:// em produção
if (url.startsWith('http://') && Deno.env.get('ENV') === 'production') {
  return "URL_INSECURE: use https:// em produção";
}
```

---

#### SEC-NEW-01 — Role `simulation` concede poder de `dev` sem governança 🔴 Alta
**OWASP:** A01 (Broken Access Control) · A07 (Authentication Failures)

**Evidência (verificada):**
```typescript
// supabase/functions/_shared/auth.ts:82
function isDevRole(auth: AuthResult): boolean {
  return auth.userRoles.includes('dev') || auth.userRoles.includes('simulation');
}
// :88
function isSupervisorOrAbove(auth: AuthResult): boolean {
  return (
    auth.userRoles.includes('dev') ||
    auth.userRoles.includes('simulation') ||  // ← mesmos poderes que dev
    auth.userRoles.includes('supervisor') ||
    auth.userRoles.includes('admin')
  );
}
```

A role `simulation` não aparece na hierarquia documentada (`RBAC_HELPERS.md`, `authorize.ts:27`), não tem tipo definido em `AppRole`, e **bypass completo de todos os checks de role** (incluindo `requireDev`).

Adicionalmente, `auth.ts:30` lê `SIMULATION_BYPASS_KEY` da env mas **nunca usa o valor**. O comentário "Fast-path de credenciais de transporte removido (SEC-003)" confirma que era um mecanismo de bypass que foi parcialmente removido, deixando dead code e a role `simulation` sem revisão.

**Impacto:**
- Qualquer usuário com a role `simulation` na tabela `user_roles` tem acesso total ao sistema (equivalente a `dev`)
- A role não é auditada, não tem processo de concessão documentado
- Não há gate de CI que detecte atribuição indevida dessa role

**Correção:**
1. Remover `simulation` do helper `isDevRole` / `isSupervisorOrAbove` — ou documentá-la explicitamente como uma sub-role de `dev` com processo de aprovação
2. Remover a variável dead code `simulationKey` (linha 30 de `auth.ts`)
3. Adicionar auditoria de concessão da role `simulation` (trigger ou alert)
4. Verificar em produção: `SELECT user_id FROM user_roles WHERE role = 'simulation';`

---

#### SEC-NEW-02 — CSP do Vercel com `'unsafe-inline'` e `'unsafe-eval'` 🟠 Média-Alta
**OWASP:** A03 (Injection — XSS)

**Evidência:**
```json
// vercel.json:30
"Content-Security-Policy": "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' ..."
```

O CSP dos headers de Edge Functions (`_shared/cors.ts:62`) usa `'strict-dynamic'` (correto para produção), mas o CSP do **deploy Vercel** — que é o que o browser realmente recebe — contém `'unsafe-inline'` **e** `'unsafe-eval'`.

Isso significa:
- `'unsafe-eval'`: `eval()`, `new Function()`, `setTimeout(string)` → execução arbitrária de JS
- `'unsafe-inline'`: scripts inline sem hash/nonce → qualquer `<script>` injetado executa

**Impacto:** Qualquer vulnerabilidade XSS (ainda que nenhuma crítica tenha sido encontrada) pode executar código arbitrário no browser do usuário. A proteção CSP que o edge serve é completamente anulada pelo CSP do Vercel.

**Contexto:** `'unsafe-eval'` é frequentemente exigido por `vite` em dev, mas em produção o bundle é estático e não precisa de `eval`. `'unsafe-inline'` pode ser substituído por hashes de scripts.

**Correção:**
```json
// vercel.json — remover unsafe-eval, usar nonce ou hash para unsafe-inline:
"script-src 'self' 'strict-dynamic' https://cdn.gpteng.co https://vercel.live"
// OU, se Vite gera inline scripts, usar hash específico:
// "script-src 'self' 'sha256-<hash>'"
```

---

#### SEC-03 — `bulk-random-passwords`: comparação timing-unsafe + sem schema 🟠 Média
**Evidência:**
```typescript
// bulk-random-passwords/index.ts:101
if (!adminTokenHeader || adminTokenHeader !== expectedAdminToken) { /* 401 */ }
// :108 — sem validação schema:
const body = (await req.json().catch(() => ({}))) as BulkRequest;
```

Endpoint que pode resetar a senha de **todos os usuários** protegido por comparação de string `!==` (vulnerável a timing attack para descoberta do token).

**Correção:**
```typescript
import { constantTimeEqual } from "../_shared/dispatcher-auth.ts";
// Substituir !== por:
if (!adminTokenHeader || !constantTimeEqual(adminTokenHeader, expectedAdminToken)) {
  return errorResponse(401, 'Unauthorized');
}
// + Adicionar validação Zod:
const BodySchema = z.object({
  mode: z.enum(['dry_run', 'execute']).default('dry_run'),
  maxUsers: z.number().int().min(1).max(1000).default(100),
  pageSize: z.number().int().min(1).max(100).default(50),
});
```

---

#### SEC-04 — `createEdge` com adoção zero 🟠 Média
24 funções têm `verify_jwt = false` no `config.toml`, implementando auth própria com qualidade variável (4 padrões diferentes coexistindo). O template unificado `_shared/createEdge.ts` foi criado para resolver isso mas tem **0 imports** fora do próprio arquivo de teste.

**Impacto:** Cada função com auth própria é um vetor potencial de inconsistência (como SEC-01).

**Correção:** Adicionar gate de CI que rejeite novas funções com `verify_jwt = false` sem `createEdge`, e migrar incrementalmente.

---

#### SEC-05 — Padrões CORS amplos (risco moderado) 🟡 Baixa
**Evidência:** `cors.ts:30-37`:
```typescript
const ALLOWED_ORIGIN_PATTERNS = [
  /^https:\/\/[a-z0-9-]+\.lovable\.app$/i,    // QUALQUER subdomínio *.lovable.app
  /^https:\/\/[a-z0-9-]+\.vercel\.app$/i,      // QUALQUER *.vercel.app
  ...
];
```

Sem `Access-Control-Allow-Credentials: true`, o risco é moderado, mas qualquer deploy público nesses domínios passa no allowlist. Restringir a subdomínios conhecidos (ex: `criar-together-now.lovable.app`).

---

#### Pontos Fortes de Segurança (Confirmados)
- **Vault para segredos:** `vault.create_secret` / `decrypted_secrets` — não há colunas plaintext para credenciais
- **Cripto correta:** `mcp_api_keys.key_hash` via SHA-256; OTPs/senhas via bcrypt (`crypt(..., gen_salt('bf'))`)
- **Token revocation:** `isTokenRevoked` com cache 30s — bloqueia JWTs emitidos antes de logout forçado
- **Redação de logs:** `_shared/log-safety.ts` mascara JWT/Bearer/refs Supabase; `.gitleaks.toml` no CI
- **Signup desabilitado:** `config.toml: enable_signup = false; enable_anonymous_sign_ins = false`
- **MCP Server:** autenticação por `X-MCP-Key` hasheada em DB, auditoria completa de cada tool, revogação por scope

---

### 3.B Banco de Dados — Modelagem e Performance

#### DB-01 — Partição de `admin_audit_log` esgota em ~5 semanas 🔴 Alta
**Evidência:** Última partição detectável em `types.ts`: `admin_audit_log_y2026m06`. Data atual: 2026-05-25. Sem `pg_partman`, sem função `create_*_partition`, sem cron de auto-criação no repo.

**(Validar em prod):** verificar se existe partição `DEFAULT` ou `pg_partman` ativo.

**Impacto:** INSERTs de auditoria começam a falhar em ~julho/2026 (em 5-6 semanas) se não houver partição `y2026m07`.

**Correção imediata:**
```sql
-- Criar partições manualmente para emergência:
CREATE TABLE IF NOT EXISTS public.admin_audit_log_y2026m07
  PARTITION OF public.admin_audit_log
  FOR VALUES FROM ('2026-07-01') TO ('2026-08-01');
CREATE TABLE IF NOT EXISTS public.admin_audit_log_y2026m08
  PARTITION OF public.admin_audit_log
  FOR VALUES FROM ('2026-08-01') TO ('2026-09-01');

-- Solução permanente: cron de auto-criação
CREATE OR REPLACE FUNCTION public.ensure_audit_log_partitions(months_ahead int DEFAULT 3)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  d date := date_trunc('month', now())::date;
  i int;
  partition_name text;
  next_month date;
BEGIN
  FOR i IN 0..months_ahead LOOP
    partition_name := format('admin_audit_log_y%sm%s', to_char(d,'YYYY'), to_char(d,'MM'));
    next_month := (d + interval '1 month')::date;
    EXECUTE format(
      'CREATE TABLE IF NOT EXISTS public.%I
       PARTITION OF public.admin_audit_log
       FOR VALUES FROM (%L) TO (%L)',
      partition_name, d, next_month
    );
    d := next_month;
  END LOOP;
END;
$$;

SELECT cron.schedule(
  'ensure-audit-log-partitions',
  '0 0 1 * *',  -- 1º dia de cada mês às 00:00 UTC
  $$SELECT public.ensure_audit_log_partitions(3)$$
);
```

---

#### DB-02 — Regressão do `auth_rls_initplan` 🟠 Média-Alta
**Evidência:**
```sql
-- 20260524220150_restore_access_security_management_tables.sql:24
-- 16 ocorrências de auth.uid() cru (verificadas manualmente):
using (public.is_admin_or_above(auth.uid()))
with check (public.is_admin_or_above(auth.uid()));
```

A migration de fixação `20260512000001_t25_fix_auth_rls_initplan.sql` corrigiu 270 policies para `(SELECT auth.uid())` (avaliação 1× por query). Migrations recentes desfazem parcialmente esse ganho.

**Impacto:** `auth.uid()` cru é re-avaliado para cada linha da tabela. Em tabelas grandes (ex: `access_security_management` com centenas de usuários), isso representa penalidade de 10–100× em queries de leitura.

**Correção:**
```sql
-- Padrão correto:
CREATE POLICY "example_policy" ON public.access_security_management
  USING (public.is_admin_or_above((SELECT auth.uid())))
  WITH CHECK (public.is_admin_or_above((SELECT auth.uid())));
```

**Gate de CI:**
```bash
# scripts/check-rls-initplan.sh
grep -r "auth\.uid()" supabase/migrations/*.sql \
  | grep -v "(SELECT auth\.uid())" \
  | grep "CREATE POLICY\|USING\|WITH CHECK"
```

---

#### DB-03 — Modelagem sub-normalizada e FKs ausentes 🟠 Média
**Evidências confirmadas:**
- 105/142 tabelas sem FK declarada (`Relationships: []` em `types.ts`)
- `products` perdeu FKs para `categories`/`suppliers`; tem strings redundantes (`category_name`, `supplier_name`) ao lado de `category_id`/`supplier_id` sem constraint
- 365 colunas JSONB em 194 tabelas (`colors`, `kit_items`, `metadata`, `tags`, `variations` todos `Json`)
- `price_history.variant_id:4048` referencia tabela `product_variants` inexistente (FK órfã)

**Impacto:** Integridade referencial não garantida pelo banco; risco de dados órfãos/inconsistentes; queries de preço/variante frágeis; dificuldade de evolução de schema.

**Roadmap de correção (por fases):**
1. **Fase 1 (semanas):** Reintroduzir FKs críticas: `products.category_id → categories.id`, `products.supplier_id → suppliers.id`
2. **Fase 2 (mês):** Promover `products.variations` JSONB a tabela `product_variants` real
3. **Fase 3 (trimestre):** Auditoria completa de todas as FKs faltantes usando `pg_stats_user_tables`

---

#### DB-04 — Churn reativo de índices 🟠 Média
Em 2026-05-24, houve **5 rounds de `drop_unused_indexes`** (62 removidos) + **4 migrations de `add_missing_fk_indexes`** no mesmo dia. O padrão "remaining"/"round N" indica que cada passada é incompleta.

**Impacto:** FKs sem índice causam joins lentos e lock escalation em deletes do pai. O churn sugere ausência de estratégia de indexação proativa.

**Query de auditoria definitiva:**
```sql
-- FK sem índice de cobertura:
SELECT
  tc.table_schema, tc.table_name, kcu.column_name,
  ccu.table_name AS foreign_table
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu USING (constraint_name, table_schema)
JOIN information_schema.referential_constraints rc ON rc.constraint_name = tc.constraint_name
JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = rc.unique_constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND NOT EXISTS (
    SELECT 1 FROM pg_index pi
    JOIN pg_attribute pa ON pa.attrelid = pi.indrelid AND pa.attnum = ANY(pi.indkey)
    WHERE pi.indrelid = (tc.table_schema || '.' || tc.table_name)::regclass
      AND pa.attname = kcu.column_name
  )
ORDER BY tc.table_name;
```

---

#### DB-05 — Materialized Views sem refresh agendado 🟠 Média
3 MVs em `analytics` (`mv_material_group_stats`, `mv_product_compositions`, `mv_media_health`). A função `refresh_materialized_views()` atualiza apenas 2 das 3 (omite `mv_media_health`) e **não está em nenhum cron**.

**Correção:**
```sql
-- Atualizar função para incluir mv_media_health:
REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_media_health;

-- Agendar:
SELECT cron.schedule('refresh-mvs', '*/30 * * * *',
  $$SELECT public.refresh_materialized_views()$$);
```

---

#### DB-06 — Sem `statement_timeout`; cluster de cron noturno 🟠 Média
- **0 ocorrências** de `SET statement_timeout` no repositório (verificado)
- Cluster de DELETEs/purges pesados na janela 03:00–04:00 UTC (5+ jobs simultâneos)
- Só `idle_in_transaction_session_timeout` está configurado (correto, mas insuficiente)

**Correção:**
```sql
-- Role principal:
ALTER ROLE authenticated SET statement_timeout = '30s';
-- Batch jobs:
ALTER ROLE service_role SET statement_timeout = '120s';
-- Escalonar crons pesados:
-- cleanup-notifications: 03:05 → 03:30
-- cleanup-novelties:     03:10 → 04:00
```

---

### 3.C Migrations, Drift e Reprodutibilidade

#### OPS-01 — Repositório não é fonte de verdade (~263 stubs) 🔴 Alta
**Evidências:**
- `MIGRATIONS_SYNC_LOG.md` documenta bug de collation (`_` vs dígito) exigindo `migration repair` manual
- ~263 migrations com "Stub file created to keep Supabase CLI in sync"
- Migrations de segurança crítica (RLS, grants, partições) estão entre os stubs
- Git log confirma episódios repetidos de "reconcile drift causing system collapse"

**Impacto:** Impossível recriar o estado de produção do repositório. Auditoria de segurança incompleta. O drift **já causou colapso de produção documentado** (`docs/RELATORIO_COLAPSO_2026-05-24.md`).

**Plano de correção:**
```bash
# 1. Snapshot semanal do schema real de produção:
pg_dump --schema-only -h $DB_HOST -U $DB_USER $DB_NAME \
  > audit/schema-$(date +%Y%m%d).sql
git add audit/schema-*.sql && git commit -m "chore: schema snapshot $(date +%Y-%m-%d)"

# 2. Gate de drift pré-merge (GitHub Actions):
# .github/workflows/schema-drift-check.yml
# - Compara schema do branch com snapshot mais recente
# - Falha se houver divergência não documentada

# 3. Política: nenhuma DDL de segurança via MCP sem migration no mesmo PR
```

---

### 3.D Integrações Externas

#### INT-01 — Rate-limiter fail-open em endpoints sensíveis 🟠 Média
**Evidência:** `_shared/rate-limiter.ts:36-37,56-58`:
```typescript
// Em erro de RPC → retorna allowed: true silenciosamente
if (error) {
  console.error('[rate-limiter] RPC error:', error);
  return { allowed: true, remaining: -1 };  // ← fail-open!
}
```

Contraste com a quota de IA que é **fail-closed** (`ai-usage.ts:63-75`). Um soluço no banco remove toda a proteção de rate-limit sem alarme.

**Correção:** Em endpoints sensíveis, mudar para fail-closed ou pelo menos emitir alerta Sentry/GlitchTip:
```typescript
if (error) {
  console.error('[rate-limiter] RPC error — failing closed for security:', error);
  Sentry.captureException(error, { extra: { endpoint, identifier } });
  return { allowed: false, reason: 'rate_limit_check_failed' };
}
```

#### INT-02 — `external-fetch.ts` exige apenas HTTPS, sem blocklist de IPs 🟡 Baixa
O wrapper de fetch externo não chama `validateExternalUrl`. A proteção forte só é usada por `generate-mockup`. Centralizar todo fetch externo pelo wrapper com blocklist.

#### INT-03 — Credential exposure no endpoint `creds_health` 🟡 Baixa
**Evidência:** `credentials.ts:240-245`:
```typescript
suffix4: res.value ? res.value.slice(-4) : null,  // últimos 4 chars do secret
```

O endpoint `?op=creds_health` expõe os últimos 4 caracteres de cada credencial. Embora protegido por autenticação, isso reduz significativamente o espaço de busca para força bruta de chaves de API. Remover `suffix4` do payload público ou restringir a role `dev`.

---

### 3.E Integração Front-End ↔ Back-End

#### FE-01 — 82 `select('*')` sem `LIMIT` 🟠 Média
**Evidência verificada:**
```bash
grep -rn "select('*')" src/ --include="*.ts" --include="*.tsx" | wc -l  # → 82
```

`useAccessSecurity.ts:59-60` faz `select('*')` sem LIMIT — à medida que a tabela cresce, o fetch pode retornar milhares de linhas para o browser.

**Correção:** Adicionar `.limit(200)` e paginação onde aplicável. Gate de CI: `grep -r "select('\*')" src/ | grep -v ".limit("` deve retornar vazio.

#### FE-02 — `window.queryClient` exposto em produção 🟡 Baixa
**Evidência:**
```typescript
// src/lib/query-config.ts:126-127
if (typeof window !== 'undefined') {
  (window as Record<string, unknown>).queryClient = client;  // sem feature flag
}
```

Permite acesso ao React Query cache via DevTools em produção, facilitando inspeção de dados em memória.

**Correção:**
```typescript
if (typeof window !== 'undefined' && import.meta.env.DEV) {
  (window as Record<string, unknown>).queryClient = client;
}
```

#### FE-03 — 173 toasts expondo `error.message` cru 🟠 Média
**Evidência:** `.toast-leaks-baseline.json` (871 linhas) rastreia 173 toasts que expõem `error.message` diretamente ao usuário. O módulo `sanitizeError` existe mas só é usado no módulo de conexões.

**Correção:** Rotear todos `toast.error(...)` por `sanitizeError`:
```typescript
// src/lib/error-handling.ts
export function toastError(message: unknown, opts?: ToastOptions): void {
  toast.error(sanitizeError(message), opts);
}
// Substituir todos os toast.error() por toastError()
```

#### FE-04 — Autorização client-side é só UI 🟡 Baixa (confirmado)
`isAdmin` é derivado client-side; guards de rota são cosméticos. Há 102 writes diretos dependendo inteiramente de RLS. **Desde que RLS esteja correto** (OPS-01), isso é aceitável por design em Supabase. Mas dado o drift de OPS-01, é necessário confirmar RLS em cada tabela alcançável.

---

### 3.F Observabilidade e Operação

#### OBS-01 — Edge functions sem error-tracking real 🟠 Média-Alta
**Evidência verificada:**
```bash
grep -r "captureException\|glitchtip\|sentry" supabase/functions/ --include="*.ts"
# → 0 resultados
```

Comentários em `ai-usage.ts:64,92` alegam captura por GlitchTip (`"→ capturado pelo GlitchTip (Onda 5)"`), mas o mecanismo real é só `console.error` nos logs do Supabase. Erros em produção só são vistos por grep manual de logs.

**Correção:**
```typescript
// supabase/functions/_shared/error-tracker.ts
import * as Sentry from "@sentry/deno";

export function initErrorTracking(): void {
  const dsn = Deno.env.get("SENTRY_DSN") || Deno.env.get("GLITCHTIP_DSN");
  if (!dsn) return;
  Sentry.init({ dsn, environment: Deno.env.get("ENV") ?? "production" });
}

export function captureError(error: unknown, context?: Record<string, unknown>): void {
  console.error("[error-tracker]", error);
  Sentry.captureException(error, { extra: context });
}
```

#### OBS-02 — Observabilidade é pull/dashboard, não push 🟠 Média
Não há PagerDuty/Opsgenie/Slack-webhook configurado. Nenhum mecanismo **pageia** um humano em incidente de produção. O kill-switch existente exige ação manual após descoberta manual do problema.

**Correção mínima:**
```typescript
// Webhook de alerta para falhas P0:
const ALERT_WEBHOOK = Deno.env.get("ALERT_WEBHOOK_URL");
if (ALERT_WEBHOOK && severity === "critical") {
  await fetch(ALERT_WEBHOOK, {
    method: "POST",
    body: JSON.stringify({ text: `🔴 ALERTA: ${message}`, ts: Date.now() }),
  });
}
```

**Pontos fortes confirmados:**
- Logger estruturado SSOT (`_shared/structured-logger.ts`) com `request_id` propagado client→edge→DB
- Dashboard admin de observabilidade (`/admin/observabilidade`) com métricas de webhook
- Sentry no front (lazy, no-op sem DSN configurado)
- Kill-switch real e ligado front↔back

---

### 3.G CI/CD e Qualidade

#### QA-01 — Thresholds de cobertura neutralizados em CI 🟠 Média
**Evidências verificadas:**
- `vitest.config.ts:53-57`: define thresholds 60/60/50/60 (linhas/funções/branches/statements)
- `ci.yml:257-260` e `308-312`: sobrescreve para `--thresholds=0` em todos os jobs de CI
- `ci.yml:206`: job de teste de RLS com `continue-on-error: true` → **regressão de RLS não bloqueia deploy**

**Impacto:** A cobertura de testes documentada é ilusória para fins de bloqueio de deploy.

**Correção:**
```yaml
# ci.yml — remover --thresholds=0 dos jobs críticos:
- name: Run tests
  run: TZ=America/Sao_Paulo vitest run --coverage
  # Não sobrescrever thresholds configurados em vitest.config.ts

# Job de RLS — tornar bloqueante:
- name: RLS Integration Tests
  run: TZ=America/Sao_Paulo vitest run tests/rls/
  # Remover continue-on-error: true
```

#### QA-02 — Baselines mascaram dívida técnica crescente 🟠 Média
Dívida atual congelada pelos baselines:
- **`.tsc-baseline.json`**: 508 erros TypeScript / 196 arquivos
- **`.eslint-baseline.json`**: 128 erros / 193 arquivos
- **`.toast-leaks-baseline.json`**: 871 linhas (173 toasts crus)

O `lint`/`typecheck` no CI só falham em erros **novos** — a dívida existente é invisível para o pipeline.

**Plano de redução:**
```bash
# Sprint de debt reduction: medir progresso semanal
node scripts/tsc-baseline-generate.mjs 2>&1 | tail -3  # deve diminuir
node scripts/eslint-baseline-generate.mjs 2>&1 | tail -3
```

#### QA-03 — Gate de drift detecta tarde demais 🟠 Média
O gate de drift é um pg_cron diário às 02:00 UTC, não pré-merge. Dado que drift já causou colapso de produção, adicionar verificação pré-merge é essencial (ver OPS-01).

**Pontos fortes confirmados:** 40+ gates reais e bloqueantes — `typecheck-pr-gate`, guard de bypass literals, hardening ACL de `SECURITY DEFINER`, manifesto de authz de edge, `check-no-db-push`, `required-checks-guard`, pirâmide de testes (unit, e2e smoke/regression, edge integration, contract, fuzz, stress).

---

### 3.H Custos e Eficiência

#### COST-01 — Quota de IA não cobre crons disparados pelo sistema 🟠 Média
**Evidência:** 4 cron jobs invocam edges via `net.http_post`. As quotas de IA são **por usuário** (`check_ai_quota(_user_id)`), então chamadas disparadas pelo sistema/cron (sem `userId` humano) podem escapar dos limites de custo configurados.

**Correção:**
```typescript
// Criar userId sintético para o sistema com quota própria:
const SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000001';
// E configurar quota restrita para esse usuário na tabela ai_user_quotas
```

#### COST-02 — Rate-limiter fail-open remove proteção de custo 🟡 Baixa
Ver INT-01. Um soluço no banco desliga todo rate-limiting, potencialmente disparando flood de requisições IA.

---

### 3.I Manutenibilidade

#### MNT-01 — Lockfiles duplicados 🟡 Baixa
`package-lock.json` (537 KB) + `bun.lock` (278 KB) versionados, com `packageManager: npm@10.9.7`. `bun.lock` é drift inutilizado.

**Correção:** Adicionar `bun.lock` ao `.gitignore`, ou migrar oficialmente para Bun removendo `package-lock.json`.

#### MNT-02 — 4 módulos de auth coexistindo 🟠 Média
`auth.ts` (authenticateRequest), `authorize.ts` (authorize), `dispatcher-auth.ts` (constantTimeEqual + HMAC), `credentials.ts` (resolveCredential). Alta carga cognitiva para novos desenvolvedores; facilita introdução de inconsistências como SEC-01.

#### MNT-03 — config.toml armazenado como base64 🟡 Baixa
O arquivo `/supabase/config.toml` está codificado em base64. Isso dificulta revisões de PR (diff ilegível), buscas por texto (`grep`) e auditoria de segurança. Converter de volta para texto plano e commitar o arquivo legível.

---

## 4. Roadmap de Correções (Priorizado)

### 🔴 P0 — Crítico (Esta Semana)

| # | ID | Ação | Estimativa |
|---|----|----|-----------|
| 1 | DB-01 | Criar partições 2026-07 e 2026-08 + função de auto-criação + cron | 2h |
| 2 | SEC-01 | Adicionar auth JWT antes do dispatch RPC em `external-db-bridge` | 1h |
| 3 | SEC-02 | Conectar `validateExternalUrl` aos pings de `connection-test-runner` | 1h |
| 4 | SEC-NEW-01 | Auditar role `simulation` em prod; remover dead code `simulationKey` | 2h |
| 5 | OPS-01 | Snapshot `pg_dump --schema-only` versionado + gate de drift pré-merge | 4h |

### 🟠 P1 — Importante (Este Mês)

| # | ID | Ação | Estimativa |
|---|----|----|-----------|
| 6 | SEC-NEW-02 | Remover `'unsafe-eval'` do CSP do Vercel; substituir `'unsafe-inline'` por hash | 2h |
| 7 | DB-02 | Corrigir 16 ocorrências de `auth.uid()` cru na migration recente + gate de CI | 2h |
| 8 | SEC-03 | `bulk-random-passwords`: comparação constante + JWT/role + schema Zod | 1h |
| 9 | OBS-01 | Sink de error-tracking real (Sentry SDK Deno) + canal de alerta push | 4h |
| 10 | QA-01 | Re-habilitar thresholds de cobertura; tornar teste de RLS bloqueante | 2h |
| 11 | DB-05 | Agendar refresh das MVs; incluir `mv_media_health` | 1h |
| 12 | INT-01 | Rate-limiter fail-closed em endpoints de IA + alerta | 2h |

### 🟡 P2 — Desejável (Trimestre)

| # | ID | Ação | Estimativa |
|---|----|----|-----------|
| 13 | SEC-04 | Migrar edges legadas para `createEdge` (priorizar `verify_jwt=false`) | 1 semana |
| 14 | DB-03 | Reintroduzir FKs críticas + `product_variants` real | 1 semana |
| 15 | DB-04 | Auditoria definitiva de índices (query SQL de cobertura) | 1 dia |
| 16 | DB-06 | `statement_timeout` por role + escalonar crons pesados | 2h |
| 17 | FE-01/FE-03 | `sanitizeError` em todos os toasts; limitar `select('*')` sem LIMIT | 1 dia |
| 18 | COST-01 | Quota para userId sintético do sistema | 2h |

### 🟢 P3 — Higiene (Backlog)

| # | ID | Ação |
|---|----|----|
| 19 | MNT-01 | Remover `bun.lock` ou migrar para Bun |
| 20 | MNT-03 | Decodificar `config.toml` e commitar como texto plano |
| 21 | SEC-05 | Restringir CORS `*.vercel.app`/`*.lovable.app` a subdomínios conhecidos |
| 22 | FE-02 | `window.queryClient` atrás de `import.meta.env.DEV` |
| 23 | INT-03 | Remover `suffix4` do payload público de `creds_health` |

---

## 5. Benchmarking vs. Padrões de Mercado

| Dimensão | Este Sistema | Padrão de Mercado Maduro | Gap |
|----------|:-------------|:------------------------|:----|
| Gestão de segredos | Vault + redação + gitleaks | Vault/KMS + rotação + scanning | ✅ No nível |
| RLS / multi-tenant | Ampla, com helpers e testes | RLS + testes de isolamento **bloqueantes** | 🟡 Testes não bloqueiam (QA-01) |
| IaC / reprodutibilidade | Migrations + ~263 stubs | Migrations versionadas = fonte única de verdade | 🔴 Drift estrutural (OPS-01) |
| Observabilidade | Logs estruturados + dashboards | Logs + traces + **alertas push** + APM | 🟠 Cego no servidor (OBS-01/02) |
| Error tracking | Front (Sentry/no-op) | Front + **back** unificado + alertas | 🟠 Edges sem sink |
| Governança de CI | 40+ gates dedicados | Lint/type/test/security bloqueantes | ✅ Acima da média (mas baselines) |
| Auth de API | 4 padrões + template não adotado | **1 middleware único** | 🟠 Inconsistente |
| Custo de IA | Quota fail-closed + tracking | Quota + budget + **alerta de custo** | ✅ Bom (gap: cron + alerta) |
| CSP / XSS | `unsafe-inline` + `unsafe-eval` no Vercel | CSP restrito com nonce/hash | 🟠 Abaixo |
| Modelagem de dados | Sub-normalizada, JSONB-heavy | 3NF + JSONB pontual | 🟠 Abaixo |
| Token revocation | Cache 30s, comparação de iat | Revogação imediata + blacklist | 🟡 Janela de 30s aceitável |

**Leitura geral:** O sistema está **no nível ou acima do mercado** em segredos, governança de CI, kill-switch e postura de incidente. Está **abaixo** em reprodutibilidade de infra, alerta de produção push, CSP, e modelagem de dados. O perfil é típico de um produto que cresceu rápido com hardening reativo competente — a próxima fase de maturidade é tornar o repositório a fonte de verdade e fechar o loop de alertas de produção.

---

## 6. Tabela Consolidada de Findings

| ID | Categoria | Severidade | Prioridade | Evidência |
|----|-----------|:----------:|:----------:|-----------|
| SEC-01 | Segurança/Authz | 🔴 Alta | P0 | `external-db-bridge/index.ts:530-537,736-749` |
| SEC-02 | Segurança/SSRF | 🔴 Alta | P0 | `_shared/connection-test-runner.ts:150-158,201` |
| SEC-NEW-01 | Segurança/Role | 🔴 Alta | P0 | `_shared/auth.ts:30,82,88` |
| DB-01 | Estabilidade | 🔴 Alta | P0 | `types.ts` (última partição `y2026m06`) |
| OPS-01 | Operação/Drift | 🔴 Alta | P0 | `MIGRATIONS_SYNC_LOG.md`; ~263 stubs |
| SEC-NEW-02 | Segurança/CSP | 🟠 Média-Alta | P1 | `vercel.json:30` (`unsafe-inline`, `unsafe-eval`) |
| DB-02 | Performance | 🟠 Média-Alta | P1 | `20260524220150:24+` (16× `auth.uid()` cru) |
| OBS-01 | Observabilidade | 🟠 Média-Alta | P1 | 0 `captureException` em `supabase/functions/` |
| SEC-03 | Segurança | 🟠 Média | P1 | `bulk-random-passwords/index.ts:101,108` |
| QA-01 | Qualidade | 🟠 Média | P1 | `ci.yml:206,257-260`; thresholds zerados |
| DB-05 | Performance | 🟠 Média | P1 | `refresh_materialized_views()` (2/3 MVs, sem cron) |
| INT-01 | Integração | 🟠 Média | P1 | `_shared/rate-limiter.ts:36-37` (fail-open) |
| FE-01 | Front/UX | 🟠 Média | P2 | 82 `select('*')` sem LIMIT |
| FE-03 | Front/UX | 🟠 Média | P2 | 173 toasts com `error.message` cru |
| SEC-04 | Manutenibilidade | 🟠 Média | P2 | 0 imports de `createEdge`; 24 `verify_jwt=false` |
| DB-03 | Modelagem | 🟠 Média | P2 | 105/142 sem FK; FK órfã `price_history.variant_id` |
| DB-04 | Performance | 🟠 Média | P2 | 5 rounds de `drop_unused_indexes` no mesmo dia |
| DB-06 | Performance | 🟠 Média | P2 | 0× `statement_timeout`; cluster de cron |
| COST-01 | Custos | 🟠 Média | P2 | crons → edges de IA sem quota por sistema |
| MNT-02 | Manutenibilidade | 🟠 Média | P2 | 4 módulos de auth coexistindo |
| QA-02 | Qualidade | 🟠 Média | P2 | 508 erros TS / 128 ESLint congelados em baseline |
| FE-02 | Front/Debug | 🟡 Baixa | P3 | `window.queryClient` em produção |
| INT-02 | Integração | 🟡 Baixa | P3 | `external-fetch.ts` sem blocklist de IPs |
| INT-03 | Segurança | 🟡 Baixa | P3 | `suffix4` exposto em `creds_health` |
| SEC-05 | Segurança | 🟡 Baixa | P3 | CORS `*.vercel.app`/`*.lovable.app` amplos |
| MNT-01 | Manutenibilidade | 🟡 Baixa | P3 | `bun.lock` + `package-lock.json` coexistindo |
| MNT-03 | Manutenibilidade | 🟡 Baixa | P3 | `config.toml` armazenado como base64 |

---

## 7. Apêndice — Contexto Operacional

### Incidentes Confirmados

O projeto possui documentação exemplar de incidentes:
- `docs/RELATORIO_COLAPSO_2026-05-24.md` — drift entre repo e produção causou colapso de produção
- `docs/incidents/2026-05-22-crm-db-bridge-url-malformada.md` — bug de URL causou downtime do CRM
- `docs/INCIDENTS/2026-04-env-exposure.md` — exposição de variáveis de ambiente

Esses incidentes confirmam que as preocupações levantadas (OPS-01, SEC-01, INT-01) são riscos **reais e materiais**, não hipotéticos.

### Decisões Arquiteturais (ADRs)

Os ADRs documentados mostram deliberação consciente:
- `ADR-0002: rls-first-security` — correto, mas drift de stubs compromete a garantia
- `ADR-0003: zod-edge-functions` — bom, mas SEC-01 mostra que nem todos seguem
- `ADR-0005: resilience-circuit-breaker` — implementado com qualidade
- `ADR-0006: migration-baseline` — a estratégia de baseline é a raiz do problema de drift

### Pontos de Excelência (Preservar)

Estes componentes representam padrões de mercado e devem ser **preservados e expandidos**:

1. **`_shared/credentials.ts`** — resolução DB-first com aliases legados, cache TTL, métricas per-name, bulk fetch, warmup — código exemplar
2. **`_shared/circuit-breaker.ts`** — implementação limpa com HALF_OPEN, diagnóstico serializável
3. **`_shared/ai-usage.ts`** — quota atômica fail-closed, tracking por modelo, router multi-provider
4. **`_shared/token-revocation.ts`** — cache 30s, fail-open consciente, `iat` comparison
5. **`_shared/kill_switch.ts`** — fail-open correto, cache 60s, timeout 1.5s
6. **React Query config** (`src/lib/query-config.ts`) — staleTimes em camadas, retry por tipo de erro

---

> **Nota Final:** Vários findings dependem do estado real de produção não totalmente observável pelo repositório (OPS-01). As recomendações P0 incluem tornar o repositório a fonte de verdade — pré-requisito para que qualquer auditoria de segurança futura tenha validade completa.
>
> **Novos findings neste relatório (não presentes na auditoria anterior):**
> - SEC-NEW-01: Role `simulation` com poder de `dev` sem governança
> - SEC-NEW-02: CSP do Vercel com `unsafe-inline` + `unsafe-eval` anulando proteção XSS
> - MNT-03: `config.toml` armazenado como base64 (ilegível para diff/audit)
> - INT-03: `suffix4` de credenciais exposto em `creds_health`
> - FE-01: 82 `select('*')` confirmados por contagem direta
