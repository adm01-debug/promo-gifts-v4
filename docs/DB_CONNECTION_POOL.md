# DB Connection Pool — Promo Gifts

> Bug P3-04 da auditoria 24/05/2026

## Estado atual (snapshot 24/05/2026 21h BRT)

- **`max_connections` = 90** (Supabase Free → Pro tier default)
- **3 reservadas** para superuser
- **88 disponíveis** para aplicação
- **Em uso:** 45 conexões (51%) — margem saudável
- **Breakdown:**
  - 3 truly active
  - 34 idle
  - 0 idle in transaction
  - 20 via PostgREST/pgbouncer pooler

`shared_buffers` = 1.5 GB · `effective_cache_size` = 512 MB · `work_mem` = 5 MB

## Quem usa conexões?

1. **Frontend → PostgREST** (`https://*.supabase.co/rest/v1/*`)
   - Pool interno do PostgREST: ~10 connections/worker, vários workers
   - Token via `apikey` + `Authorization: Bearer <JWT>` → mapping para role
   - **NÃO conta como conexão de usuário no `max_connections`** — PostgREST reusa.

2. **Edge Functions Deno** (`supabase/functions/*`)
   - Cada isolate frio cria 1 client → 1 connection
   - Cache 60s no `getInternalServiceClient()` em `_shared/credentials.ts`
   - **Conta no `max_connections`** quando faz query direta

3. **External-db-bridge + crm-db-bridge**
   - 2 clients externos (1 supabase production + 1 CRM) via tokens
   - Cada um faz keep-alive — ~2 conexões persistentes por isolate
   - Após P1-05 (bulk credentials + warmup), reduzimos thundering em cold start.

4. **pg_cron jobs**
   - Workers internos do Postgres; não contam no `max_connections`
   - Job `expire-stale-password-reset-requests` (criado em P0-04)
   - Job `purge_expired_security_data` (PR #293)

## Quando vai apresentar problema?

Cenário de pico estimado para hit em 88 conexões:
- 1.000 usuários concorrentes acessando catálogo (PostgREST reusa pool — sem pressure direta)
- + 10 edge functions simultâneas em cold start (10 conexões)
- + bulk-import rodando (1 conexão)
- + backup automático (1 conexão)

**Estimativa: ~50-60 conexões em pico real.** Margem confortável até 4k usuários
concorrentes no nível de pool atual.

## Sinais de alerta

Monitorar via Supabase Dashboard → Database → Connections:
- ⚠️ **WARN**: uso > 70% (62 conexões)
- 🔴 **CRITICAL**: uso > 85% (75 conexões) + `idle_in_transaction` > 5

Query para auditar:

```sql
SELECT
  COUNT(*) AS total,
  COUNT(*) FILTER (WHERE state = 'active') AS active,
  COUNT(*) FILTER (WHERE state = 'idle') AS idle,
  COUNT(*) FILTER (WHERE state = 'idle in transaction') AS idle_xact,
  COUNT(*) FILTER (WHERE now() - state_change > INTERVAL '5 minutes' AND state = 'idle in transaction') AS leaked_xact
FROM pg_stat_activity;
```

`leaked_xact > 0` = ALERTA — alguém esqueceu `COMMIT/ROLLBACK`.

## Plano de ação se atingir limite

### 1. Mitigação imediata (< 5 min)

```sql
-- Encerrar conexões idle > 10min (libera vagas sem matar transações ativas)
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE state = 'idle'
  AND now() - state_change > INTERVAL '10 minutes'
  AND pid != pg_backend_pid();
```

### 2. Diagnóstico (5-15 min)

Identificar o consumidor mais agressivo:

```sql
SELECT
  application_name,
  client_addr,
  state,
  COUNT(*) AS conn_count,
  MAX(now() - backend_start) AS oldest_conn_age
FROM pg_stat_activity
GROUP BY application_name, client_addr, state
ORDER BY conn_count DESC
LIMIT 20;
```

Se `application_name LIKE '%PostgREST%'` dominar: scale-up do tier Supabase.
Se for edge function específica: revisar uso de `serviceClient` (provavelmente
falta cache/singleton).

### 3. Solução durável (1 dia)

Migrar para o **Transaction Mode pooler do Supabase** (porta 6543):

```bash
# Em vez de:
postgres://postgres.<ref>:<pwd>@<region>.pooler.supabase.co:5432/postgres

# Usar:
postgres://postgres.<ref>:<pwd>@<region>.pooler.supabase.co:6543/postgres
```

Transaction mode multiplexes conexões: ~10.000 client connections viram
~100 connections reais no Postgres. **Restrições**: não suporta prepared
statements via session, `SET LOCAL` precisa estar em transação. Para
edges que usam apenas `from().select()` (PostgREST), é seguro.

### 4. Upgrade de tier (se nenhuma das anteriores resolver)

Supabase Pro → Pro Team: `max_connections` sobe para 200.

## Histórico

- **24/05/2026** (auditoria P3-04): documentação criada. Estado atual saudável.
  Nenhuma mudança aplicada — preventivo.
- **17/05/2026** (PR #297): kill_switch.ts trocou service_role por anon, reduziu
  pressão em ~30% em fail-open path.
- **15/05/2026** (PR #293): `purge_expired_security_data` corrigido — antes
  travava transação por 30s em pico, era responsável por idle_in_transaction
  picos.
