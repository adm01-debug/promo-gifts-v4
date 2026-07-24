# 🔌 Runbook — Módulo `/admin/conexoes`

Guia operacional do módulo de Conexões: diagnóstico, rotação de credenciais,
auto-test cron, e interpretação de logs.

---

## 🩺 Sintoma → Causa → Ação

### "Carregando..." infinito no seletor de empresas (front)

**Sintoma:** UI fica travada em "Carregando..." por 15-20s antes de ficar vazio.

**Causa raiz:** `crm-db-bridge` não consegue resolver `EXTERNAL_CRM_URL` /
`EXTERNAL_CRM_SERVICE_ROLE_KEY`. React Query reentra 3× em cada erro 500.

**Diagnóstico:**

```sql
-- 1. Confirmar que credenciais existem no DB
SELECT secret_name, secret_source, is_active
  FROM public.integration_credentials
 WHERE secret_name LIKE 'EXTERNAL_CRM%';

-- 2. Ver últimos erros do bridge nos logs estruturados
-- Filtrar por evt='credential_resolved' e source='none'
```

**Ação:**

1. Cadastrar credenciais via `/admin/conexoes` ou diretamente:
   ```sql
   -- Via secrets-manager (preferido)
   -- POST /functions/v1/secrets-manager
   -- { "action": "set", "name": "EXTERNAL_CRM_URL", "value": "https://..." }
   ```
2. Aliases legados (`CRM_SUPABASE_URL`) também funcionam como fallback via env.

---

### Banner "Credenciais alteradas" não mostra qual secret mudou

**Causa raiz:** payload realtime usa coluna `secret_name`, não `name`.
Foi corrigido em PR #70 (`CredentialsChangedBanner.tsx`).

**Validar:** alterar uma credencial e verificar que o toast mostra o nome.

---

### `AutoTestJobStatusCard` sempre "untested"

**Causa raiz:** cron `connections-auto-test` órfão (sem schedule).

**Diagnóstico:**

```sql
SELECT jobname, schedule, active
  FROM cron.job
 WHERE jobname = 'connections-auto-test';
-- Se vazio: migration 20260429163414_* não foi aplicada
```

**Ação:**

```sql
-- Aplicar a migration ou rodar manualmente:
SELECT cron.schedule(
  'connections-auto-test',
  '*/15 * * * *',
  $$ SELECT net.http_post(...); $$
);
```

**Validar intervalo configurado:**

```sql
SELECT public.get_connections_auto_test_interval();
-- Deve retornar 15 (default) ou outro valor configurado via UI.
```

---

## 🔐 Rotação de Credenciais CRM


### Rotação de chave usada por cron jobs (`apikey`)

Quando a chave de autenticação de Edge Functions for rotacionada, **os crons também precisam ser validados**.

**Pré-requisitos de runtime (sem hardcode em migration):**

```sql
-- Definir no ambiente/role do banco (ou via ALTER DATABASE ... SET)
-- app.supabase_functions_base_url = https://<project-ref>.supabase.co
-- app.supabase_anon_key           = <jwt anon atual>
SELECT current_setting('app.supabase_functions_base_url', true) AS base_url;
SELECT current_setting('app.supabase_anon_key', true)           AS anon_key_present;
```

**Checklist pós-rotação:**

```sql
-- 1) Validar comandos dos jobs (não pode conter host fixo nem 'eyJ...')
SELECT jobname, command
  FROM cron.job
 WHERE jobname IN ('connections-auto-test','external-db-bridge-keepalive');

-- 2) Disparo manual de fumaça
SELECT public.run_connections_auto_test();

-- 3) Saúde recente do cron
SELECT j.jobname, d.status, d.return_message, d.start_time
  FROM cron.job_run_details d
  JOIN cron.job j ON j.jobid = d.jobid
 WHERE j.jobname IN ('connections-auto-test','external-db-bridge-keepalive')
 ORDER BY d.start_time DESC
 LIMIT 20;
```

Se `current_setting(..., true)` retornar `NULL`, o cron vai falhar com erro de URL/header ausente. Ajuste as variáveis e reexecute a validação.

---


1. **Provedor:** gerar nova `service_role` key no dashboard Supabase do CRM.
2. **Aplicar:** `/admin/conexoes` → Tab "Supabase" → Card CRM → "Rotacionar".
3. **Verificar:** seletor de empresas no front carrega em <3s.
4. **Auditar:** linha em `secret_rotation_log` com user_id e timestamp.

> Cache TTL é 60s — propagação para edge functions é praticamente instantânea
> via `invalidateCredentialCache()` chamado pelo secrets-manager após rotação.

---

## 🩺 Endpoints de Diagnóstico do `crm-db-bridge`

Todos com **bypass de auth** — operadores precisam diagnosticar mesmo com JWT
quebrado ou breaker aberto.

```
GET  /functions/v1/crm-db-bridge?op=ping            → liveness
GET  /functions/v1/crm-db-bridge?op=diag            → boot/runtime metrics
GET  /functions/v1/crm-db-bridge?op=breaker_status  → circuit breaker
GET  /functions/v1/crm-db-bridge?op=creds_health    → resolução das credenciais
```

Exemplo de `creds_health` em estado saudável:

```json
{
  "ok": true, "ts": 1745000000000, "health": "healthy",
  "credentials": [
    { "name": "EXTERNAL_CRM_URL", "present": true,
      "source": "db", "via_alias": false, "resolved_name": "EXTERNAL_CRM_URL",
      "value_length": 41, "suffix4": "e.co" },
    { "name": "EXTERNAL_CRM_SERVICE_ROLE_KEY", "present": true,
      "source": "db", "via_alias": false, "resolved_name": "EXTERNAL_CRM_SERVICE_ROLE_KEY",
      "value_length": 219, "suffix4": "x9wA" },
    { "name": "EXTERNAL_CRM_ANON_KEY", "present": true,
      "source": "env", "via_alias": true, "resolved_name": "CRM_SUPABASE_ANON_KEY",
      "value_length": 219, "suffix4": "g4V0" }
  ]
}
```

| `health` | Significado | Ação |
|---|---|---|
| `healthy` | URL + 1 key presentes | nenhuma |
| `degraded` | só URL ou só key | cadastrar a parte faltante |
| `missing` | sem URL | bridge fora do ar — cadastrar credenciais |

---

## 📊 Logs Estruturados

### `connections-auto-test`

| Evento | Payload |
|---|---|
| `auto-test` | `{type, name, ok, status, latency_ms, attempts, retried, error}` |
| `auto-test-summary` | `{tested, ok_count, failed, retried, recovered, duration_ms}` |
| `auto-test-error` | `{id, type, error}` (erro por conexão) |
| `auto-test-fatal` | `{error}` (erro global, batch abortado) |

### `_shared/credentials.ts`

| Evento | Payload |
|---|---|
| `credential_resolved` | `{name, resolved_name, source, has_value, cached, duration_ms, via_alias}` |

> `source: "none"` indica credencial não encontrada — alarme precoce.
> Desabilitar verbosidade: `LOG_CREDENTIAL_RESOLUTION=off` no env.

---

## 🛡️ RLS de `integration_credentials`

Policies aceitam role `admin` **OU** `dev` (alinhado ao `secrets-manager`).
Migration: `20260429163441_align_integration_credentials_rls_with_dev.sql`.

```sql
-- Validar policies
SELECT policyname, cmd FROM pg_policies
 WHERE tablename = 'integration_credentials';
-- 4 linhas esperadas: SELECT, INSERT, UPDATE, DELETE
```

---

## 🔁 Edge Functions que dependem de credenciais CRM

| Função | Aliases consumidos | Impacto se faltar |
|---|---|---|
| `crm-db-bridge` | `EXTERNAL_CRM_URL`, `_SERVICE_ROLE_KEY`, `_ANON_KEY` | front "Carregando..." |
| `quote-sync` | `EXTERNAL_CRM_URL`, `_SERVICE_ROLE_KEY` | sync de orçamentos pausa |
| `expert-chat` | `EXTERNAL_CRM_URL`, `_SERVICE_ROLE_KEY` | chat sem contexto de cliente |
| `quote-public-view` | `EXTERNAL_CRM_URL`, `_SERVICE_ROLE_KEY` | link público quebra |

Todas usam `resolveCredential()` — DB-first, env como fallback.

---

## 📚 Referências

- `supabase/functions/_shared/credentials.ts` — SSOT de resolução
- `supabase/migrations/20260429163414_*.sql` — schedule do cron
- `supabase/migrations/20260429163441_*.sql` — RLS para dev
- `docs/RUNBOOK.md` — runbook geral

## Estratégia de promoção dev → stage → prod para jobs agendados (Edge URL)

A partir da migration `20260525113000_runtime_edge_function_base_url.sql`, os callers SQL (`cron`, trigger e RPC) **não dependem mais de URL hardcoded por ambiente**. A URL base é resolvida em runtime por `public.get_edge_functions_base_url()` com precedência:

1. `current_setting('app.edge_functions_base_url', true)`
2. Vault secret `EDGE_FUNCTIONS_BASE_URL`
3. Falha explícita (fail-closed)

### Como promover sem editar migration histórica

1. Defina o valor por ambiente:
   - **dev:** URL do projeto dev (`https://<dev-ref>.supabase.co`)
   - **stage:** URL do projeto stage (`https://<stage-ref>.supabase.co`)
   - **prod:** URL do projeto prod (`https://doufsxqlfjyuvxuezpln.supabase.co`)
2. Rode migrations normalmente em cada ambiente.
3. Valide resolução com:

```sql
SELECT * FROM public.validate_edge_functions_base_url('dev');
SELECT * FROM public.validate_edge_functions_base_url('stage');
SELECT * FROM public.validate_edge_functions_base_url('prod');
```

`ok=true` confirma que o endpoint resolvido está aderente ao padrão esperado do ambiente.

### Checklist operacional por ambiente

- Confirmar que `connections-auto-test` está agendado (`cron.job`) e ativo.
- Confirmar que os últimos runs chamam a edge correta (logs da função + `cron.job_run_details`).
- Em rotação de endpoint, atualizar configuração (GUC/secret) **antes** de janela de execução crítica de cron.
- Não reescrever migrations antigas para trocar URL: a promoção ocorre apenas por configuração de runtime.
