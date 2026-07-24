# 🚨 Runbook — Colapso Promo Gifts v4 (2026-05-24)

Guia rápido pós-incidente. Para o relatório completo, ver [`RELATORIO_COLAPSO_2026-05-24.md`](./RELATORIO_COLAPSO_2026-05-24.md).

## TL;DR

A edge function `external-db-bridge` (aposentada no Caminho B) ainda recebia **30-50 chamadas/segundo**. Cada uma fazia 5-7 sub-queries no banco → saturava o pool de 90 conexões. Somado a `idle_session_timeout=0` (conexões zumbi há 10 dias) e um cron de segurança falhando 99% das execuções, o sistema entrava em colapso.

## Já está mitigado?

| Item | Status |
|------|--------|
| Bug do cron `purge-expired-security` | ✅ Corrigido (migration aplicada) |
| Policy `profiles_select` quebrando anon | ✅ Corrigida (migration aplicada) |
| Kill-switch para `external-db-bridge` | ✅ Tabela criada, switch OFF |
| Rotação de `cron.job_run_details` | ✅ Job semanal criado |
| Índice em `collection_products.product_id` | ✅ Criado |
| **Código** da `external-db-bridge` honrando o kill-switch (410) | ✅ **FEITO** (2ª sessão) — `assertSwitchEnabled` no topo do handler |
| **Deploy** da `external-db-bridge` com o código novo | ✅ **FEITO** (3ª sessão) — PR #574 mergeado → pipeline Supabase deployou |
| Cron `external-db-bridge-keepalive` (14 falhas/h) | ✅ **REMOVIDO** (3ª sessão) — migration `20260601140000` |
| Cron `connections-auto-test` (URL NULL) | ✅ **CORRIGIDO** (3ª sessão) — migration `20260601140100` — URL hardcoded |
| REVOKE SELECT `anon` em 27 tabelas internas | ✅ **FEITO** (2ª sessão) |
| DROP de 67 índices ociosos | ✅ **FEITO** (2ª sessão) |
| `fn_run_schema_drift_check` hold 30s→15s | ✅ **FEITO** (2ª sessão) |
| FK index + policy consolidation `system_kill_switches` | ✅ **FEITO** (2ª sessão) |
| `idle_session_timeout` / `idle_in_transaction` | ✅ **APLICADO** — verificado em pg_settings (600000ms / 60000ms) |
| `log_min_duration_statement = 2000ms` | ✅ **APLICADO** — verificado em pg_settings |
| Auth Connection Strategy → Percentage 15% | ⏳ **PENDENTE** — só Dashboard (não é GUC Postgres) |

## Atualização 2026-06-01 (3ª sessão — `claude/confident-heisenberg-M03BW`)

PR #574 mergeado. Pipeline Supabase deploiou `external-db-bridge` com o kill-switch ativo.
Dois crons corrigidos via migration:
- `external-db-bridge-keepalive` → **removido** (disparava a cada 4 min, falhava com NOT NULL violation na URL; 14+ falhas/h)
- `connections-auto-test` → **recriado** com URL literal hardcoded em vez de GUC inexistente
PR #572 auto-fechado pelo GitHub após rebase revelar que todos os commits já estavam em main.
`cron_health_1h` transiente: última falha dos crons removidos foi às 13:40 UTC — auto-resolve às ~14:40 UTC.

## Atualização 2026-05-24 (2ª sessão — `claude/confident-heisenberg-M03BW`)

Continuação da contenção. O achado central: **o kill-switch nunca tinha sido ligado no
código** da `external-db-bridge` (o helper `_shared/kill_switch.ts` existia, o switch no
banco estava OFF, mas o `index.ts` não importava nem chamava `assertSwitchEnabled`). Sem
isso, a função continuava executando 100% do trabalho a cada request — o gatilho do colapso.

Feito nesta sessão:
- **Código (repo)**: `assertSwitchEnabled("edge_external_db_bridge", req, corsHeaders)` como
  primeira ação do handler (antes de body/auth/credenciais/DB). + teste em
  `supabase/functions/_shared/kill_switch.test.ts`.
- **DB (aplicado via MCP em produção, idempotente)**:
  - `harden_anon_graphql_exposure` — REVOKE SELECT de `anon` em 27 tabelas internas de
    log/auditoria/telemetria/webhook (mantém `system_kill_switches`, catálogo e tokens
    de fluxo anônimo).
  - `drop_unused_indexes_logs_safe_batch` — DROP de 67 índices ociosos em tabelas
    append-only de log/staging (rollback no corpo da migration).
  - `kill_switches_fk_index_and_policy_consolidation` — índice de FK em `updated_by` +
    split da policy `FOR ALL` (admin) em INSERT/UPDATE/DELETE `TO authenticated`,
    deixando 1 só policy de SELECT pública (resolve `multiple_permissive` e protege a
    leitura anônima do kill-switch).
  - `capture_fn_handle_new_user_vendedor` (repo) — captura a definição corrigida de
    `fn_handle_new_user` ('seller'→'vendedor'), que só existia em produção.
  - `optimize_fn_run_schema_drift_check_hold` — reduz a retenção de conexão de 30s→15s.
- **Verificação**: `fn_run_smoke_tests()` 14/14 ✅; `purge-expired-security` último run
  `succeeded`; leitura anônima do `system_kill_switches` retornando `enabled=false` OK.

### ⚠️ Deploy da edge — por que via pipeline e não via MCP
A `external-db-bridge` importa 12 módulos de `_shared` (cada um com suas dependências).
Montar esse bundle à mão num deploy MCP arrisca subir uma versão com arquivo faltando →
503 em produção. Como **não há storm ativo agora** (conexões idle ~12s) e o fix de código
já está commitado, o deploy correto e seguro é pela pipeline Supabase ao mergear o PR
(ela empacota `_shared` corretamente). Se precisar de proteção imediata antes do merge,
o switch já está OFF — basta a pipeline subir o código novo para o 410 passar a valer.

## Como verificar se voltou ao normal

```sql
-- 1. Cron jobs - deveria estar tudo verde após 15min do fix
SELECT j.jobname, COUNT(*) FILTER (WHERE d.status='failed') AS falhas_24h
FROM cron.job j JOIN cron.job_run_details d ON d.jobid=j.jobid
WHERE d.start_time > now() - interval '24 hours'
GROUP BY j.jobname
HAVING COUNT(*) FILTER (WHERE d.status='failed') > 0;
-- Esperado: vazio após 24h do deploy
```

```sql
-- 2. Conexões zumbi - precisa Dashboard ajustar timeouts
SELECT state, COUNT(*), EXTRACT(EPOCH FROM (now() - MAX(state_change))) AS sec_max
FROM pg_stat_activity WHERE application_name='postgrest' GROUP BY state;
-- Aceitável: <10 idle, <1h
```

```sql
-- 3. Smoke tests
SELECT test_name, result FROM public.fn_run_smoke_tests() WHERE result NOT LIKE '%PASS%';
-- Esperado: vazio
```

```sql
-- 4. Edge external-db-bridge - taxa de invocação
-- (verificar painel de Edge Functions no Dashboard - deve cair pra ~0 após deploy do 410)
```

## Como ativar/desativar o kill-switch

```sql
-- Desligar uma edge function (faz ela retornar 410):
UPDATE public.system_kill_switches
   SET enabled=false, reason='motivo', updated_by=auth.uid()
 WHERE switch_name='edge_external_db_bridge';

-- Religar (não recomendado para edge_external_db_bridge):
UPDATE public.system_kill_switches
   SET enabled=true, updated_by=auth.uid()
 WHERE switch_name='edge_external_db_bridge';
```

## Como aplicar o kill-switch numa edge function

```typescript
// supabase/functions/<nome-da-funcao>/index.ts
import { assertSwitchEnabled } from "../_shared/kill_switch.ts";

Deno.serve(async (req) => {
  // PRIMEIRA linha do handler — antes de qualquer outra coisa
  const goneResp = await assertSwitchEnabled("edge_external_db_bridge", req);
  if (goneResp) return goneResp;

  // ...resto da função
});
```

## Próximos passos cronológicos

**Concluído (2026-06-01):**
- [x] Deploy do `external-db-bridge` com checagem do kill-switch (PR #574 mergeado)
- [x] Cron `external-db-bridge-keepalive` removido (migration `20260601140000`)
- [x] Cron `connections-auto-test` corrigido com URL hardcoded (migration `20260601140100`)
- [x] REVOKE SELECT `anon` em 27 tabelas internas de log/auditoria
- [x] DROP de 67 índices ociosos
- [x] `fn_run_schema_drift_check` hold reduzido para 15s

**Aplicado (verificado em pg_settings — sessão 2026-06-01):**
- [x] `idle_session_timeout = 600000ms` (10 min)
- [x] `idle_in_transaction_session_timeout = 60000ms` (1 min)
- [x] `log_min_duration_statement = 2000ms`

**Pendente — só Dashboard (não executável via MCP/SQL):**
- [ ] Auth Connection Strategy → **Percentage 15%** — Auth → Settings (resolve advisor `auth_db_connections_absolute`)

**Opcional:**
- [ ] Identificar e comunicar clientes que ainda chamam `external-db-bridge` (retornam 410 agora)
- [ ] Reorganização de schemas de longo prazo (`*_audit_log`, `*_telemetry` fora de `public`)
