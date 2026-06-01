# Relatório Pós-Fase 2 — Colapso 2026-05-24

**Data:** 2026-05-24, 21:15 UTC  
**Projeto:** `doufsxqlfjyuvxuezpln` (catálogo Promo Brindes)  
**Antecedente:** [`RELATORIO_COLAPSO_2026-05-24.md`](./RELATORIO_COLAPSO_2026-05-24.md) — Fase 1

## TL;DR

Fase 2 cortou o leak crônico de conexões PostgREST de **31 zumbis → 2** e fechou **9 tabelas críticas** (credenciais/MFA/audit) para `anon`. O kill-switch do `external-db-bridge` está armado em banco; falta apenas o deploy do código da edge function (patch manual em [`PATCH_external_db_bridge_kill_switch.md`](./PATCH_external_db_bridge_kill_switch.md)).

## Impacto medido

### Conexões Postgres (`pg_stat_activity`)

| Métrica | Antes (Fase 1) | Depois (Fase 2) | Variação |
|---|---:|---:|---:|
| Total | ~50+ | **16** | -68% |
| Idle | 31 (zumbis 10d) | **12** | -61% |
| Idle in transaction | n/d | **0** | ✅ |
| Idle >1h | 31 | **2** | -94% |

### Cron de segurança (`purge-expired-security`)

| Métrica | Antes (24h) | Depois (1h amostra) |
|---|---:|---:|
| Sucessos | 1 | **3** |
| Falhas | 95 | **1** |
| Taxa de erro | **99%** | **25%** (cai com próximos ciclos) |

### Tabelas críticas fechadas para `anon`

9 confirmadas, 20 totais via REVOKE. Critérios aplicados:
- ✅ Fechadas: credenciais (`integration_credentials`, `mcp_api_keys`, `secret_rotation_log`), MFA (`step_up_tokens`, `step_up_challenges`), audit interno (`admin_audit_log`, `auth_login_attempts`, `bot_detection_log`).
- ⏸ Preservadas (uso público legítimo via token + RLS): `kit_share_tokens`, `quote_approval_tokens`, `public_token_failures`.

## Ações aplicadas

### 1. ALTER ROLE timeouts (substitui Dashboard)

ALTER DATABASE para `idle_session_timeout` é bloqueado em Supabase Cloud. Alternativa: ALTER ROLE com precedência semelhante.

```sql
ALTER ROLE authenticator SET idle_in_transaction_session_timeout = '60000';   -- 60s
ALTER ROLE authenticator SET idle_session_timeout = '600000';                  -- 10min
ALTER ROLE anon SET idle_in_transaction_session_timeout = '30000';            -- 30s
ALTER ROLE authenticated SET idle_in_transaction_session_timeout = '60000';
ALTER ROLE service_role SET idle_in_transaction_session_timeout = '60000';
ALTER ROLE service_role SET idle_session_timeout = '300000';                   -- 5min
```

**Efeito imediato:** conexões PostgREST idle por mais de 10 minutos passam a ser limpas pelo PostgreSQL. Conexões em transação parada caem em 60s.

### 2. REVOKE em 20 tabelas sensíveis

Defesa em profundidade: mesmo com RLS ativa, REVOKE remove a tabela do schema introspection do PostgREST/GraphQL e impede acesso se a RLS for desabilitada por engano.

Aplicado via [`20260524130000_colapso_fase2_timeouts_e_revoke_sensitive.sql`](../supabase/migrations/20260524130000_colapso_fase2_timeouts_e_revoke_sensitive.sql).

### 3. Kill-switch da edge function `external-db-bridge`

O switch `edge_external_db_bridge=false` está armado em `public.system_kill_switches`. O helper `_shared/kill_switch.ts` foi refatorado para usar `anon` key + timeout 1.5s + cache 60s + fail-open.

**Falta:** o `external-db-bridge/index.ts` ainda não importa o helper. Patch cirúrgico de 2 mudanças documentado em [`PATCH_external_db_bridge_kill_switch.md`](./PATCH_external_db_bridge_kill_switch.md).

## Pendências (Fase 3)

1. **Aplicar patch cirúrgico do `external-db-bridge`** — 2 mudanças cirúrgicas, ~15 linhas, ver documento de patch.
2. **Identificar callers no front-end** — search-and-replace `external-db-bridge` em `src/`. Migrar para chamadas REST nativas.
3. **Otimizar `fn_run_schema_drift_check()`** — atualmente 40-60s. Reescrever ou tornar async.
4. **Auditoria de índices não usados** — 535 findings de `unused_index`. Drop seletivo em tabelas com alta taxa de writes (`supplier_unit_conversions`, `product_materials`, `commemorative_dates`, `kit_collaborators`).
5. **Supabase Dashboard manual:**
   - Auth → Connection Strategy → **Percentage 15%** (advisor `auth_db_connections_absolute`).
   - Postgres → Settings → `log_min_duration_statement = 2000` (logs apenas queries >2s).

## Quando reativar `external-db-bridge` (se necessário)

```sql
UPDATE public.system_kill_switches
SET enabled = true
WHERE switch_name = 'edge_external_db_bridge';
```

Cache em memória da edge function tem TTL 60s, então mudança propaga em ≤ 1 minuto sem redeploy.

## Reversibilidade

Todas as mudanças desta fase são reversíveis:

```sql
-- Reverter timeouts
ALTER ROLE authenticator RESET idle_in_transaction_session_timeout;
ALTER ROLE authenticator RESET idle_session_timeout;
-- (idem para anon, authenticated, service_role)

-- Reverter REVOKE (caso descoberta de regressão)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.<tabela> TO anon;
```
