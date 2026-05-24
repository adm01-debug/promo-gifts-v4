# Redeploy Fase 4 — Gate CI de Schema Drift (Lovable ↔ Oficial)

**Data de implantação**: 2026-05-22
**Estado**: ✅ Operacional em produção
**Cron job**: `schema-drift-check` (jobid `25`) — diário às 02:00 UTC

## Objetivo

Detectar automaticamente quando o schema do banco Lovable Cloud interno (`pqpdolkaeqlyzpdpbizo`) divergir do banco Oficial / SSOT (`doufsxqlfjyuvxuezpln`), e alertar admins para corrigir antes que a divergência cause inconsistências em produção.

A Fase 4 nasce do princípio: **o Lovable Cloud altera o schema automaticamente em resposta a prompts do usuário**, o que pode reintroduzir drift que a Fase 3 corrigiu. O Gate CI é a defesa de runtime contra essa regressão.

## Arquitetura

```
┌─────────────────────────────────────────────────────────────────┐
│  Cron pg_cron jobid=25, diário 02:00 UTC                        │
│  schedule: '0 2 * * *'                                          │
│  command:  SELECT public.fn_run_schema_drift_check();           │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  fn_run_schema_drift_check() — orquestrador (Oficial)          │
│  1. trigger fetch  (net.http_post async → Lovable)              │
│  2. polling até 30s em net._http_response                       │
│  3. fn_compute_and_record_drift(signatures recebidas)           │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  fn_compute_and_record_drift(jsonb) — comparação (Oficial)     │
│  1. get_public_schema_signatures() local                        │
│  2. apply schema_drift_allowlist                                │
│  3. compute: only_oficial[], only_lovable[], schema_diff{}      │
│  4. record_schema_drift_result(payload)                         │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────┐       ┌──────────────────────────────────────┐
│ schema_drift_log │       │ workspace_notifications              │
│ (audit trail)    │       │ (admin alerts se has_drift=true)     │
└──────────────────┘       └──────────────────────────────────────┘
```

### Componentes implementados

**No Oficial (`doufsxqlfjyuvxuezpln`):**

| Objeto | Tipo | Função |
|---|---|---|
| `public.get_public_schema_signatures()` | RPC | Retorna `{tabela: signature_string}` para todas as tabelas em `public` (exclui `_backup_%`, `pg_%`). Grant EXECUTE TO anon, authenticated. |
| `public.schema_drift_log` | Tabela | Audit trail de cada execução. RLS admin-only. 11 colunas (id, ran_at, has_drift, tables_oficial, tables_lovable, only_oficial[], only_lovable[], schema_diff jsonb, notification_sent, error_message, allowlist_applied). |
| `public.schema_drift_allowlist` | Tabela | Divergências aceitáveis por design. RLS admin-only. 15 entradas atuais (ver `FASE-3.5-EXECUTION-LOG.md`). |
| `public.record_schema_drift_result(jsonb)` | Função | Grava log + cria `workspace_notifications` warning para admins se `has_drift=true`. |
| `public.fn_compute_and_record_drift(jsonb)` | Função | Compara signatures locais vs recebidas, gera diff aplicando allowlist, invoca record. |
| `public.fn_trigger_schema_drift_fetch()` | Função | Dispara `net.http_post` async para `lovable_url + /rest/v1/rpc/get_public_schema_signatures`. Lê config de `system_settings`. |
| `public.fn_run_schema_drift_check()` | Função | Orquestrador completo: trigger + polling + compute. |
| `system_settings.lovable_url` | Setting | `https://pqpdolkaeqlyzpdpbizo.supabase.co` |
| `system_settings.lovable_anon_key` | Setting | JWT publishable do Lovable interno (descoberta via `lovable_get_integrations`). |
| `pg_cron jobid=25` | Cron | `schema-drift-check` diário 02:00 UTC. |

**No Lovable (`pqpdolkaeqlyzpdpbizo`):**

| Objeto | Tipo | Função |
|---|---|---|
| `public.get_public_schema_signatures()` | RPC | Idêntica à do Oficial — retorna signatures do Lovable. Grant EXECUTE TO anon, authenticated. |

## Como executar manualmente

```sql
-- Execução completa em uma chamada (oficial)
SELECT public.fn_run_schema_drift_check();

-- Ou em duas etapas (mais controlável)
SELECT public.fn_trigger_schema_drift_fetch();  -- retorna request_id
-- Aguardar ~30s
SELECT public.fn_compute_and_record_drift(content::jsonb)
  FROM net._http_response WHERE id = <request_id>;
```

## Como inspecionar resultados

```sql
-- Últimas 5 execuções
SELECT to_char(ran_at, 'YYYY-MM-DD HH24:MI:SS') AS quando,
       has_drift,
       tables_oficial,
       tables_lovable,
       COALESCE(array_length(only_oficial, 1), 0) AS only_oficial,
       COALESCE(array_length(only_lovable, 1), 0) AS only_lovable,
       (SELECT COUNT(*) FROM jsonb_object_keys(schema_diff)) AS schema_drift
  FROM public.schema_drift_log
 ORDER BY ran_at DESC LIMIT 5;

-- Diff completo da última execução
SELECT schema_diff FROM public.schema_drift_log
 ORDER BY ran_at DESC LIMIT 1;

-- Notificações para admins
SELECT * FROM public.workspace_notifications
 WHERE category = 'system' AND title = 'Schema drift detectado'
 ORDER BY created_at DESC LIMIT 5;
```

## Como adicionar à allowlist

```sql
INSERT INTO public.schema_drift_allowlist (table_name, reason, added_by, metadata)
VALUES (
  '<table_name>',
  '<razao detalhada>',
  '<seu_user_or_id>',
  '{"category":"<categoria>"}'::jsonb
);
```

Categorias usadas atualmente:
- `infra_independente` — tabelas com schema distinto por design (ex: bot_detection_log)
- `cache_denormalizado` — caches locais do Lovable (ex: products)
- `particao_log` — partições mensais de tabelas particionadas
- `infra_lovable` — telemetria/runtime do Lovable Cloud

## Estado em produção (snapshot pós-Fase-3.5)

```
tables_oficial:    390
tables_lovable:    145
only_oficial:      261 (catálogo SSOT - esperado)
only_lovable:      3   (admin_audit_log_old, favorites, mcp_keys — pendência Fase 1.1)
schema_drift:      0   ✅
allowlist_applied: 15
has_drift:         true (apenas pelas 3 only_lovable acima)
```

## Troubleshooting

### Cron rodou mas não gravou log
Verificar `net._http_response` para o request mais recente. Se `status_code` é 200, rodar `fn_compute_and_record_drift` manualmente com o conteúdo. Se é null, request ainda está pendente ou o Lovable não respondeu — checar firewall, anon key expirada, ou função RPC ausente no Lovable.

### Resposta vem com 401/403
Verificar `system_settings.lovable_anon_key` — pode ter sido rotacionada. Obter nova via `lovable_get_integrations(project_id)` no MCP.

### Timeout > 30s
A função `fn_run_schema_drift_check` desiste após 30 tentativas (~30s de polling). Em casos raros (Lovable lento), a resposta chega depois. Solução: rodar `fn_compute_and_record_drift` manualmente lendo do `net._http_response` quando `status_code=200`.

### Out of memory ao construir headers
Lembrar que `system_settings.value` é `jsonb` — usar `value #>> '{}'` para extrair string sem aspas, **não** `value::text::text` (gera aspas duplas problemáticas).

## Referências cruzadas

- Fase 3 (33 tabelas alinhadas): `docs/redeploy/FASE-3-EXECUTION-LOG.md` (a criar)
- Fase 3.5 (8 schema_drift → 0): `docs/redeploy/FASE-3.5-EXECUTION-LOG.md`
- Fase 1.1 pendente (3 legacy drop): este é o bloqueio para Gate CI virar verde 100%.
