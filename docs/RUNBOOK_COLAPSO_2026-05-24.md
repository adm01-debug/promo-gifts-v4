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
| **Deploy** da `external-db-bridge` com o código novo | ⏳ **PENDENTE** — via pipeline Supabase (PR merge) |
| `idle_session_timeout` / `idle_in_transaction` | ⏳ **PENDENTE** — Dashboard |
| `log_min_duration_statement = 2000ms` | ⏳ **PENDENTE** — Dashboard |
| Auth Connection Strategy → Percentage | ⏳ **PENDENTE** — Dashboard |

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

**Hoje:**
- [ ] Deploy do `external-db-bridge` com checagem do kill-switch
- [ ] Identificar clientes que ainda chamam `external-db-bridge` (logs de access)

**Esta semana:**
- [ ] Dashboard: `idle_session_timeout=10min`, `idle_in_transaction=60s`, `log_min_duration=2s`
- [ ] Dashboard: Auth Connection Strategy → Percentage 15%
- [ ] Otimizar `fn_run_schema_drift_check()` (40-60s no momento)

**Próximas 4 semanas:**
- [ ] Auditoria de exposição GraphQL (REVOKE em tabelas sensíveis)
- [ ] DROP de índices não usados (535 advisors)
- [ ] Reorganização de schemas (extrair `*_audit_log`, `*_telemetry`, `*_queue` de `public`)
