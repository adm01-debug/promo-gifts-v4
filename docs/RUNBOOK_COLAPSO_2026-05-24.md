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
| Edge function `external-db-bridge` retornar 410 | ⏳ **PENDENTE** — precisa deploy do código atualizado |
| `idle_session_timeout` / `idle_in_transaction` | ⏳ **PENDENTE** — Dashboard |
| `log_min_duration_statement = 2000ms` | ⏳ **PENDENTE** — Dashboard |
| Auth Connection Strategy → Percentage | ⏳ **PENDENTE** — Dashboard |

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
