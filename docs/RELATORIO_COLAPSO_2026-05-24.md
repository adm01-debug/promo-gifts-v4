# 📋 Relatório Forense — Colapso Promo Gifts v4

**Data:** 2026-05-24
**Banco:** Supabase `doufsxqlfjyuvxuezpln`
**Branch:** `fix/abner-colapso-analise-2026-05-24`
**Responsável:** Abner Silva (TI Promo Brindes)

---

## 🎯 Sumário Executivo

A análise identificou **uma causa raiz primária** e **9 agravantes** que somados estavam levando o sistema ao colapso por **saturação do pool de conexões Postgres** (`max_connections = 90`).

A causa raiz é uma **edge function aposentada (`external-db-bridge`) ainda sendo invocada por clientes legados em loop, a 30–50 chamadas/segundo**. Cada invocação dispara 5–7 sub-queries internas no banco, gerando **150–350 queries/segundo só desse loop**. Como `idle_session_timeout = 0` no Postgres, conexões idle do PostgREST nunca expiram — algumas chegam a **10 dias paradas**.

Combinando isso com 26 cron jobs ativos (um deles falhando 95/96 vezes/24h por bug de assinatura de função) e ~31 conexões PostgREST zumbi, a margem de pool fica perigosamente apertada — e qualquer pico afunda tudo.

**Achados aplicados nesta sessão (P0, no banco):**
1. ✅ Função `purge_expired_security_data()` recriada para invalidar plan-cache zumbi do pg_cron
2. ✅ Policy `profiles_select` corrigida (estava quebrando para `anon`)
3. ✅ Tabela `system_kill_switches` criada com switch `edge_external_db_bridge = false`
4. ✅ Rotação semanal de `cron.job_run_details` (>14 dias) criada
5. ✅ Índice ausente em `collection_products.product_id` criado
6. ✅ VACUUM ANALYZE em `supplier_import_batches`

**Ações pendentes que exigem decisão fora-do-banco (P0/P1):**
- 🔧 Atualizar código da edge function `external-db-bridge` para checar o kill-switch e retornar 410 Gone (commit pendente no repo zapp-web ou onde a função estiver versionada)
- 🔧 Identificar e migrar os clientes legados que ainda chamam `external-db-bridge`
- 🔧 Habilitar `idle_session_timeout` e `idle_in_transaction_session_timeout` no Supabase Dashboard
- 🔧 Mudar estratégia Auth para `percentage` (advisor `auth_db_connections_absolute`)

---

## 🔬 Metodologia — 20 Etapas

| # | Etapa | Status |
|---|-------|--------|
| 01 | Verificar estrutura do repo `promo-gifts-v4` | ✅ |
| 02 | Criar branch `fix/abner-colapso-analise-2026-05-24` | ✅ |
| 03 | Advisors de Segurança (centenas de findings) | ✅ |
| 04 | Advisors de Performance (537 findings, sendo 535 unused_index) | ✅ |
| 05 | Inventário de schemas (279 tabelas em `public` = 327 MB) | ✅ |
| 06 | RLS — todas as 279 tabelas têm RLS habilitada | ✅ |
| 07 | Logs Postgres/API (24h) — connection storm visível | ✅ |
| 08 | Edge Functions — `external-db-bridge` em loop confirmado | ✅ |
| 09 | Índices ausentes/duplicados (1 FK sem cobertura) | ✅ |
| 10 | Bloat (somente `supplier_import_batches` >5%) | ✅ |
| 11 | Conexões/locks/queries (31 idle PostgREST até 10 dias) | ✅ |
| 12 | RPCs/funções com colunas inválidas (smoke tests) | ✅ |
| 13 | Storage/Realtime (8 buckets, 8 tabelas publicadas — ok) | ✅ |
| 14 | Triggers/FKs/sequences | ✅ (não há triggers órfãs) |
| 15 | Auth — 13 users / 3 sessions / 31 refresh tokens | ✅ |
| 16 | Settings críticos (idle timeouts = 0 ⚠️) | ✅ |
| 17 | Aplicar correções P0 no banco | ✅ |
| 18 | Este relatório | ✅ |
| 19 | Migrations corretivas no repo + PR | ✅ |
| 20 | Sumário executivo para Abner | ✅ |

---

## 🔥 Achados Críticos

### 🔴 #1 — CAUSA RAIZ — `external-db-bridge` em loop de invocação

**Sintoma:** Logs da edge function mostram **30–50 invocações por segundo, constantes**. Cada chamada faz internamente:

```
1. GET /auth/v1/.well-known/jwks.json
2. GET /rest/v1/integration_credentials?secret_name=EXTERNAL_PROMOBRIND_URL
3. GET /rest/v1/integration_credentials?secret_name=EXTERNAL_PROMOBRIND_SERVICE_ROLE_KEY
4. GET /rest/v1/user_roles?user_id=eq.<uid>
5. GET /rest/v1/suppliers?limit=1
6. GET /rest/v1/categories?...
7. GET /rest/v1/products?...
```

**Impacto:** 150–350 queries/segundo só desse loop, esgotando o pool de 90 conexões.

**Contexto:** Conforme as memórias do projeto, a função `external-db-bridge` foi **aposentada no "Caminho B"** (PRs #230–232 do antigo repo `Promo_Gifts`) e substituída por chamadas PostgREST nativas. Mas a função continua deployada e clientes legados ainda batem nela.

**Correção aplicada (P0):**
- Criada tabela `public.system_kill_switches` com switch `edge_external_db_bridge = false`.
- Edge function precisa ser atualizada (fora do escopo deste banco) para ler esse flag e responder 410 Gone imediatamente.

**Correção pendente:**
- Mapear quem ainda chama a função (front-end Promo Gifts antigo? clientes externos?) e migrar para PostgREST nativo.
- Deploy do código atualizado da edge function.

---

### 🔴 #2 — `purge-expired-security` cron com 99% de falha

**Sintoma:** Em 96 execuções nas últimas 24h, **95 falharam** com:

```
ERROR:  function public.purge_expired_step_up_artifacts(integer, integer) does not exist
LINE 1: SELECT public.purge_expired_step_up_artifacts(60, 60)
QUERY:  SELECT public.purge_expired_step_up_artifacts(60, 60)
CONTEXT:  PL/pgSQL function purge_expired_security_data() line 4 at PERFORM
```

**Causa:** O `def` atual da função `purge_expired_security_data()` no banco está correto (chama `purge_expired_step_up_artifacts()` sem args), mas o **plan cache do pg_cron worker** ficou "zumbi" guardando uma versão antiga que chamava com `(60, 60)`. Há 95 entradas inúteis populando `cron.job_run_details` por dia.

**Correção aplicada (P0):** `DROP + CREATE OR REPLACE` na função força o pg_cron a recompilar. Validação:
```sql
SELECT public.purge_expired_security_data(); -- ✅ rodou sem erro
```

---

### 🔴 #3 — Conexões PostgREST zumbi (10 dias idle)

**Sintoma:** `pg_stat_activity` mostra **31 conexões PostgREST em estado `idle`**, a mais antiga sem mudar de estado há **885.470 segundos = 10,2 dias**.

**Causa:** Settings de timeout zerados:
- `idle_session_timeout = 0` (sessão idle nunca expira)
- `idle_in_transaction_session_timeout = 0` (transação idle nunca aborta)

**Combinado com `max_connections = 90`** → margem perigosa. Um pico de tráfego basta para travar tudo.

**Correção pendente (não aplicável via SQL direto no Supabase):** ajustar timeouts no painel do Supabase ou via Support, idealmente:
- `idle_session_timeout = 10min`
- `idle_in_transaction_session_timeout = 60s`

---

### 🟠 #4 — `fn_run_schema_drift_check()` no limite do statement_timeout

**Sintoma:** Função roda em ~40s na média e bateu **60.177ms** em uma execução (statement_timeout do banco é 120s). Esse cron roda diariamente às 02:00 UTC.

**Recomendação:** Otimizar a query interna ou mover a verificação para job assíncrono via edge function.

---

### 🟠 #5 — Policy `profiles_select` quebra para `anon`

**Sintoma:** Smoke test `rls_profiles_no_recursion` falhou:
```
permission denied for function is_admin_or_above
```

**Causa:** A policy estava em `{-}` (PUBLIC) e chamava `public.is_admin_or_above(...)`, mas `anon` não tem `EXECUTE` nessa função.

**Correção aplicada (P0):** Policy reescrita com `TO authenticated`. Smoke test agora passa.

---

### 🟠 #6 — Auth fixo em 10 conexões absolutas

**Advisor:** `auth_db_connections_absolute`

**Sintoma:** Auth está configurado com `Max Direct Connections = 10` (estratégia absoluta). Se a instância crescer, isso não escala.

**Correção pendente:** Painel Supabase → Settings → Database → Auth Connection Strategy: trocar de Absolute para Percentage (recomendado 15%).

---

### 🟡 #7 — Schema `public` com 279 tabelas (327 MB)

**Sintoma:** Inchaço estrutural. Cada query precisa varrer mais metadados; pg_graphql expõe quase tudo para `anon`/`authenticated` (centenas de findings de exposição GraphQL nos security advisors).

**Recomendação (não aplicado nesta sprint):**
- Mover tabelas internas (`*_audit_*`, `*_log`, `*_queue`, `*_cache`, telemetria) para schema `analytics`, `ops` ou `internal`.
- Aplicar `REVOKE SELECT ... FROM anon` em tabelas sensíveis (auth_*, secret_rotation_log, password_reset_requests, integration_credentials, etc.).

---

### 🟡 #8 — 535 índices não usados

**Advisor:** `unused_index` em massa nas tabelas `material_groups`, `commemorative_dates`, `kit_collaborators`, `supplier_*`, etc.

**Impacto:** custo de escrita e manutenção (vacuum) em índices ociosos.

**Recomendação (não aplicado):** auditoria caso-a-caso e DROP dos não-essenciais. Risco baixo, mas exige revisão antes.

---

### 🟡 #9 — `cron.job_run_details` = 33 MB / 91k linhas

**Correção aplicada (P0):** DELETE de registros >14 dias + job semanal de rotação criado.

---

### 🟡 #10 — `log_min_duration_statement = -1` (queries lentas não são logadas)

**Recomendação pendente:** ajustar para `2000ms` via Supabase Dashboard para começar a capturar queries lentas (>2s) e facilitar diagnóstico futuro. ALTER DATABASE não é permitido para o usuário aplicação.

---

## 📊 Tabela-Resumo de Correções

| # | Achado | Severidade | Aplicado no banco? | Ação fora do banco |
|---|--------|------------|--------------------|--------------------|
| 1 | `external-db-bridge` em loop | 🔴 Crítica | Switch criado (off) | Atualizar código edge fn + migrar clientes |
| 2 | `purge-expired-security` falha 99% | 🔴 Crítica | ✅ Função recriada | Nenhuma |
| 3 | Conexões zumbi (10d idle) | 🔴 Crítica | — | Ajustar idle_*_timeout no Dashboard |
| 4 | `schema-drift-check` no limite | 🟠 Alta | — | Otimizar função |
| 5 | Policy profiles_select quebra anon | 🟠 Alta | ✅ Reescrita | Nenhuma |
| 6 | Auth fixo em 10 conexões | 🟠 Alta | — | Dashboard → Percentage |
| 7 | 279 tabelas em public | 🟡 Média | — | Reorganização gradual de schemas |
| 8 | 535 índices não usados | 🟡 Média | — | Auditoria + DROPs seletivos |
| 9 | `cron.job_run_details` inchado | 🟡 Média | ✅ Purga + rotação | Nenhuma |
| 10 | Queries lentas não logadas | 🟡 Média | — | Dashboard → log_min_duration_statement |

---

## 🧭 Próximos Passos (Ordem de Prioridade)

### P0 — Próximas 24h (sem isso, colapso continua)
1. **Atualizar código da edge function `external-db-bridge`** para checar `system_kill_switches.enabled = false` e retornar HTTP 410 imediatamente, sem fazer NENHUMA chamada interna. Snippet em `supabase/functions/_shared/kill_switch.ts` (criado neste PR).
2. **No Supabase Dashboard**, ativar:
   - `idle_session_timeout = 600000` (10 min em ms)
   - `idle_in_transaction_session_timeout = 60000` (60 s)
   - `log_min_duration_statement = 2000` (2 s)
3. **Identificar quem chama `external-db-bridge`** — pesquisar referências no front-end principal (`promo-gifts-v4`, `Promo_Gifts` antigo, `zapp-web`, eventuais workflows n8n).

### P1 — Esta semana
4. **Auth Connection Strategy → Percentage** no Dashboard (recomendado 15%).
5. **Otimizar `fn_run_schema_drift_check()`** ou movê-lo para edge function.
6. **Auditar exposição GraphQL** — REVOKE SELECT FROM anon nas tabelas sensíveis (auth_*, password_reset_requests, integration_credentials, secret_rotation_log, etc.). Referência: `docs/SECURITY_GRAPHQL_EXPOSURE_AUDIT.md` (a criar).

### P2 — Próximos 30 dias
7. **Plano de reorganização de schemas** — extrair internas (`*_audit_log`, `*_log`, `*_queue`, `*_telemetry`) para schemas dedicados.
8. **Auditoria e remoção de índices não usados** (535 advisors).
9. **Padronizar tabelas de cron com retenção** (job_run_details é só um exemplo).

---

## 📎 Anexos

- **Branch:** [`fix/abner-colapso-analise-2026-05-24`](https://github.com/adm01-debug/promo-gifts-v4/tree/fix/abner-colapso-analise-2026-05-24)
- **Migrations corretivas:** `supabase/migrations/20260524_*.sql`
- **Smoke tests pós-fix:** apenas `cron_health_1h` resta — esse passará no próximo ciclo de 1h após próximo run bem-sucedido do `purge-expired-security`.

---

*Relatório gerado automaticamente como parte da missão de 20 etapas do dia 2026-05-24.*
