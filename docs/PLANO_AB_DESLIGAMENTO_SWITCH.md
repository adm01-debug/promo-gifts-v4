# Plano A/B — Desligamento do `external-db-bridge`

**Data de início:** 2026-05-25  
**Switch:** `edge_external_db_bridge`  
**Tabela:** `public.system_kill_switches`

---

## Objetivo

Desligar a edge function `external-db-bridge` **progressivamente** (canary → 50% → 100%) com a possibilidade de **rollback instantâneo** se algo quebrar. Sem janela de manutenção, sem downtime.

## Mecanismo

A coluna `rollout_percentage` em `system_kill_switches` controla a % de tráfego que recebe o kill quando `enabled=false`:

```
enabled=true                        → nunca bloqueia (rollout ignorado)
enabled=false, rollout_percentage=N → N% dos clientes recebem o kill
```

A decisão é **determinística por `bucket_key`** (hash do user_id ou um UUID estável em localStorage para anon). Isso significa que o mesmo cliente sempre cai no mesmo grupo — nada de "funcionou agora, quebrou depois" entre reloads.

## Fases

### Fase 0 — Pré-rollout (estado atual)
```sql
UPDATE public.system_kill_switches 
  SET enabled = true, rollout_percentage = 100
  WHERE switch_name = 'edge_external_db_bridge';
```
- Switch ATIVO — todos os clientes usam a bridge normalmente
- `rollout_percentage = 100` configurado preventivamente para quando virar `false`

### Fase 1 — Canary 5% (24h de observação)
```sql
UPDATE public.system_kill_switches 
  SET enabled = false, rollout_percentage = 5
  WHERE switch_name = 'edge_external_db_bridge';
```
- ~5% dos clientes anon (deterministicamente escolhidos) param de chamar a bridge
- Esses clientes passam a usar **REST nativo** (dual-mode em `bridge.ts`) ou recebem `KillSwitchActiveError` se a chamada não estiver na whitelist

**Monitorar (dashboard admin `/admin/observability`):**
- `v_kill_switch_hits_summary` — hits 1h por origem/operação
- Sentry: erros `KillSwitchActiveError` (esperado: alguns, em operações não-whitelisted)
- Web vitals: LCP/INP da home (esperado: sem regressão, REST nativo é mais rápido)
- Edge functions invocações no Supabase Dashboard: deve cair ~5%

**Critério para avançar:** zero `FAIL` em smoke tests, < 5 `KillSwitchActiveError` reais nas 24h, sem regressão de web vitals.

### Fase 2 — Quarter 25% (48h)
```sql
UPDATE public.system_kill_switches 
  SET rollout_percentage = 25
  WHERE switch_name = 'edge_external_db_bridge';
```
- Sem mexer em `enabled` — transparente para os 5% já migrados
- Outros 20% são adicionados ao bucket de teste

**Monitorar:** mesmas métricas. Esperado: invocações de edge function caem ~25%, telemetria `kill_switch_hits` cresce proporcionalmente.

### Fase 3 — Half 50% (48h)
```sql
UPDATE public.system_kill_switches 
  SET rollout_percentage = 50
  WHERE switch_name = 'edge_external_db_bridge';
```

### Fase 4 — Full 100% (mantém em monitoramento por 7d)
```sql
UPDATE public.system_kill_switches 
  SET rollout_percentage = 100
  WHERE switch_name = 'edge_external_db_bridge';
```

Equivale ao comportamento original do switch.

### Fase 5 — Limpeza definitiva (após 7d em 100%)

Com `hits_24h = 0` em `kill_switch_hits` (sem callers reais):
1. Deletar a edge function `external-db-bridge` no Supabase Dashboard
2. Remover `src/lib/external-db/invoke.ts` ou esvaziar para só chamar REST nativo
3. Atualizar `src/lib/external-db/bridge.ts` para remover o caminho legado de invokeBridge

## Rollback (qualquer fase)

**Rollback instantâneo** — 1 query no banco, propagação em ≤ 60s nos clientes ativos:

```sql
-- VOLTA TODOS OS CLIENTES PARA A BRIDGE
UPDATE public.system_kill_switches 
  SET enabled = true
  WHERE switch_name = 'edge_external_db_bridge';
```

Nenhum deploy necessário. Nenhuma janela. Cache memory (60s) e localStorage (5min) vão auto-refresh.

## Critérios de Sucesso

- [ ] Smoke tests: 14/14 PASS em todas as fases (`v_smoke_tests_latest_run`)
- [ ] Web vitals home: LCP < 2.5s, INP < 200ms (sem regressão vs baseline)
- [ ] Edge function invocações: cair proporcionalmente ao rollout (5% → 25% → 50% → 100%)
- [ ] `kill_switch_hits` cresce, mas: callers críticos (search, listing, detail) **não aparecem** — eles usam REST nativo via whitelist
- [ ] Sentry: `KillSwitchActiveError` < 0.1% das transações
- [ ] Conexões PostgreSQL: idle zumbis estabilizadas em < 5

## Cronómetro estimado

| Fase | Duração | Comando | Risco |
|---|---|---|---|
| 0 | atual | (n/a) | nenhum |
| 1 (canary 5%) | 24h | `enabled=false, rollout=5` | baixo |
| 2 (25%) | 48h | `rollout=25` | baixo |
| 3 (50%) | 48h | `rollout=50` | médio |
| 4 (100%) | 7d obs | `rollout=100` | baixo (já testado em fases anteriores) |
| 5 (cleanup) | 1d | deletar edge function | nenhum |

**Total estimado: 12 dias** do canary até a limpeza final.

## Painel de Controle

```sql
-- ESTADO ATUAL
SELECT switch_name, enabled, rollout_percentage, legacy_message, updated_at
FROM public.system_kill_switches;

-- HITS NA ÚLTIMA HORA POR ORIGEM
SELECT operation, target, origin, hits_1h
FROM public.v_kill_switch_hits_summary
WHERE switch_name = 'edge_external_db_bridge'
ORDER BY hits_1h DESC LIMIT 10;

-- SMOKE TESTS ÚLTIMA EXECUÇÃO
SELECT result, test_name, details FROM public.v_smoke_tests_latest_run;

-- TESTÍ-DRIVE DO ROLLOUT (sem mexer no estado)
SELECT 
  public.fn_should_apply_kill_switch('edge_external_db_bridge', 'user-' || g) AS would_apply
FROM generate_series(1, 100) g;
```

## Referências

- `src/lib/external-db/kill-switch-client.ts` — cliente front com cache + rollout RPC
- `src/lib/external-db/rest-native.ts` — fallback REST nativo para SELECTs
- `src/lib/external-db/bridge.ts` — dual-mode integration
- `src/pages/admin/ObservabilityDashboard.tsx` — dashboard de monitoramento
- Migration: `colapso_fase5_kill_switch_rollout_gradual`
