# Redeploy 2026-05 — Fase 1.1 — Log de Execução

**Data**: 2026-05-22 16:18–16:21 UTC (~3 min execução efetiva — operação trivial pelo pré-validado)
**Operador**: Agente Claude via Lovable MCP + GitHub MCP + MCP Supabase (Gestão de Produtos)
**Sponsor**: Abner Silva (`ti@promobrindes.com.br`)
**Banco**: Lovable Cloud interno `pqpdolkaeqlyzpdpbizo` (`is_managed_by_lovable: true`)
**Migration doc**: `supabase/migrations/20260522161900_fase_1_1_drop_legacy_lovable.sql`

## TL;DR

3 tabelas legacy ("fantasmas") foram dropadas no Lovable Cloud interno. Combinado com o fix de semântica de `has_drift` aplicado em seguida, o Gate CI passou de `has_drift=true` para **`has_drift=false`** — primeiro estado totalmente verde desde a implantação da Fase 4.

## TL;DR visual

| Indicador do Gate CI | Pré-Fase-1.1 | Pós-Fase-1.1 |
|---|:---:|:---:|
| `tables_lovable` | 145 | **142** |
| `only_lovable` | 3 | **0** ✅ |
| `schema_drift` | 0 | 0 ✅ |
| `only_oficial` (informativo) | 261 | 261 |
| `has_drift` | true | **false** ✅✅✅ |

## Tarefa 1 — Pré-validação (Tarefa BPM)

### 1.A — Inventário das 3 tabelas

| Tabela | Rows | Colunas | Tamanho | Índices | Policies | Sucessora ativa? |
|---|---:|---:|---:|---:|---:|---|
| `admin_audit_log_old` | 0 | 16 | 96 kB | 10 | 3 | ✅ `admin_audit_log` (particionada y2025m12 → y2026m06) |
| `favorites`            | 0 |  7 | 24 kB |  2 | 1 | ✅ `favorite_lists` + `favorite_items` |
| `mcp_keys`             | 0 |  9 | 40 kB |  4 | 2 | ✅ Sistema novo de `integration_credentials` |

### 1.B — Verificação de dependências

| Verificação | Resultado |
|---|---|
| FKs incoming (outras tabelas referenciando essas) | **0** |
| Views/funções/triggers em PG referenciando | **0** |
| Código runtime no repo (`.from('favorites')`, etc) | **0 hits** |
| Hits em `docs/` e `audit/` | 4 (irrelevantes - regenerados automaticamente) |

**Decisão (gateway BPM):** prosseguir. Drop seguro.

## Tarefa 2 — Drop seguro

```sql
BEGIN;
DROP TABLE IF EXISTS public.admin_audit_log_old CASCADE;
DROP TABLE IF EXISTS public.favorites           CASCADE;
DROP TABLE IF EXISTS public.mcp_keys            CASCADE;
COMMIT;
```

Aplicado via `lovable_db_query` (`pqpdolkaeqlyzpdpbizo`). Pós-validação imediata: nenhuma das 3 tabelas existe mais em `information_schema.tables`.

## Tarefa 3 — Pós-validação via Gate CI

Disparado o ciclo completo:

```sql
SELECT public.fn_trigger_schema_drift_fetch();  -- request_id = 3736
-- aguardar resposta HTTP do Lovable (~35s)
SELECT public.fn_compute_and_record_drift((SELECT content::jsonb FROM net._http_response WHERE id = 3736));
```

### Achado durante a validação — fix de semântica

O primeiro reprocessamento mostrou `has_drift=true` mesmo com `only_lovable=0` e `schema_drift=0`. **Causa raiz**: a definição original de `has_drift` considerava `only_oficial > 0` como divergência. Mas o Oficial é **SSOT por design** e é superset esperado.

**Fix aplicado** (migration `20260522162000_fix_has_drift_semantics.sql`): redefinir `has_drift` para considerar apenas:
- `only_lovable > 0` (algo novo no Lovable que não tá no Oficial = viola regra SSOT)
- `schema_diff > 0`  (tabelas em ambos com schemas divergentes)

`only_oficial` permanece no payload do log mas é puramente **informativo** — não dispara alerta.

### Resultado final

```
has_drift:         false ✅
tables_oficial:    390
tables_lovable:    142
only_oficial:      261 (informativo - SSOT é superset)
only_lovable:      0
schema_drift:      0
notification_sent: false  (sem alerta - perfeito)
```

## Tarefa 4 — Documentação

3 commits no `main`:

| Arquivo | Commit |
|---|---|
| `supabase/migrations/20260522161900_fase_1_1_drop_legacy_lovable.sql` | `88963014` |
| `supabase/migrations/20260522162000_fix_has_drift_semantics.sql`     | `7a174eb1` |
| `docs/redeploy/FASE-1.1-EXECUTION-LOG.md` (este arquivo)              | (próximo commit) |

## Impacto consolidado da sessão completa (22/05)

| Fase | Início | Fim |
|---|---|---|
| Fase 3.5 — Schema drift alignment | 8 tabelas com drift | 0 |
| Fase 4 — Gate CI cron diário 02:00 UTC | Inexistente | Operacional + monitorável |
| Fase 1.1 — DROP legacy | 3 tabelas fantasmas no Lovable | 0 |
| Semântica `has_drift` | Falso positivo (only_oficial dispara) | Corrigida |

**Estado terminal do redeploy de schemas: 🟢 100% verde.** O cron diário às 02:00 UTC agora gera alerta APENAS se algo realmente importante divergir.

## Próximas pendências (não bugs - decisões de roadmap)

- 🔴 **PR no app**: bloqueio real para migrar o app definitivamente para o Oficial. Lovable Cloud reescreve `client.ts` no build via `is_managed_by_lovable`. Solução requer sair do Lovable Cloud ou desconectar o supabase gerenciado.
- 🟡 **Monitorar Gate CI** nos próximos dias: confirmar que cron diário roda sem intervenção e que nenhum novo drift apareça (ex: Lovable Cloud reagindo a prompts do usuário criando tabelas novas no `pqpdolkaeqlyzpdpbizo`).

## Lições aprendidas

1. **Pré-validação salva tempo**: as 3 tabelas pareciam "grandes" (16/7/9 colunas), mas a checagem mostrou 0 rows e 0 dependências. O DROP em si demorou 5 segundos.
2. **Falsos positivos em monitoramento são tóxicos**: o `has_drift=true` por `only_oficial > 0` ia gerar alerta toda noite no admin. Corrigir a semântica na primeira oportunidade evita "alert fatigue".
3. **Allowlist + semântica granular** é melhor que tudo-ou-nada: o log mantém `only_oficial` para auditoria, mas só `only_lovable + schema_diff` disparam ação.
